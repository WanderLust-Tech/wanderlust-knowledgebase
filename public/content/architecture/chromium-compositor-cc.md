# Chromium Compositor (cc) - Technical Deep Dive

The Chromium Compositor, commonly known as `cc`, is a critical component of Chromium's rendering architecture. Despite its historical name, it's not actually "the" Chrome compositor but rather what some suggest should be called a "content collator." This document provides a comprehensive technical analysis of how cc works, its architecture, and its role in the browser's rendering pipeline.

## Overview

cc is embedded in multiple processes within Chromium:
- **Browser Process**: via ui/compositor or Android code
- **Renderer Process**: via Blink/RenderWidget 
- **MUS Utility Processes**: via ui/compositor

The component is responsible for:
- Taking painted inputs from its embedder
- Determining where and if content appears on screen
- Rasterizing and decoding images from painted input into GPU textures
- Forwarding textures to the display compositor as compositor frames
- Handling input forwarded from the browser process for responsive pinch and scroll gestures

## Process and Thread Architecture

cc can operate in two modes:

### Single-Threaded Mode
- **Lower overhead**
- **Used by**: Browser process (main thread is lightweight)
- **Direct commit**: Changes go straight to active tree
- **Trade-off**: Active tree cannot draw until all tiles are ready

### Multi-Threaded Mode
- **Higher latency cost** but enables responsiveness
- **Used by**: Renderer process (Blink main thread can be busy)
- **Benefit**: Allows input and animations on compositor thread while main thread is occupied
- **Uses pending tree**: For staging rasterization work

Both modes are driven by the **cc::Scheduler**, which determines when to submit frames, except in layout tests which use synchronous compositing via `LayerTreeHost::Composite`.

## Content Data Flow

The main interface to cc consists of:
- **LayerTreeHost** (with various LayerTreeSettings)
- **Tree of Layers** representing content rectangles with rendering properties

The data flow follows this pattern:

```
LayerTreeHost + Layer Tree → Property Trees → Commit → Pending Tree → Activation → Active Tree → Draw → Compositor Frame
```

### Key Steps:
1. **PropertyTreeBuilder** converts layer tree into property trees
2. **Commit process** forwards data from main thread to compositor thread
3. **Rasterization** occurs on pending tree
4. **Activation** moves ready content to active tree
5. **Draw** produces compositor frames with quads and render passes

*Note: As part of the slimming paint project, Blink will eventually set property trees and layer lists directly, bypassing the historical layer tree interface.*

## Layer Types

cc supports various specialized layer types:

### Core Layer Types

#### **PictureLayer**
- Most common layer type for painted content
- Contains recorded paint operations (PaintRecord)
- Handles tiling and rasterization of painted content
- Supports damage tracking for efficient updates

#### **SurfaceLayer** 
- References compositor frames from other producers
- Provides indirection to other frame streams
- Used for out-of-process iframes and embedded content
- Integrates with the Surfaces system

#### **SolidColorLayer**
- Simple colored rectangles
- Optimized for UI elements and backgrounds
- No texture resources required

#### **TextureLayer**
- Wraps externally-provided textures
- Used for video frames, WebGL contexts
- Handles texture lifecycle and GPU resource management

### Specialized Layer Types

#### **Scrollbar Layers**
- **SolidColorScrollbarLayer**: Android-style simple scrollbars
- **PaintedScrollbarLayer**: Desktop themed scrollbars with painted textures
- **PaintedOverlayScrollbarLayer**: ChromeOS nine-patch bitmap scrollbars
- Enable responsive scrolling on compositor thread

#### **UIResourceLayer / NinePatchLayer**
- Software bitmap equivalent of TextureLayer
- Handles bitmap uploads and recreation after context loss
- NinePatchLayer provides stretchable bitmap regions

#### **HeadsUpDisplayLayer**
- Supports developer tools rendering settings
- Displays frame rendering stats and debug overlays
- Updated last since it depends on damage calculations from other layers

## Tree Management: Commit and Activation

cc maintains multiple layer trees:

### Tree Types
1. **Main Thread Tree** (cc::Layers) - Always exists on main thread
2. **Pending Tree** (cc::LayerImpl) - Staging area for rasterization on compositor thread  
3. **Active Tree** (cc::LayerImpl) - Ready for drawing on compositor thread
4. **Recycle Tree** (cc::LayerImpl) - Cached previous pending tree (optimization)

### Tree Lifecycle

#### **Commit Process**
- Pushes layer trees and properties from main thread to pending tree
- Creates duplicate layer structure with same IDs, types, and properties
- Enables atomic updates for multiple simultaneous changes
- Provides snapshot isolation so main thread can continue updates

#### **Activation Process**  
- Moves completed content from pending tree to active tree
- Only occurs when all required rasterization is complete
- Ensures atomic presentation of visual changes
- Pending tree becomes recycle tree for optimization

#### **Synchronization**
- Layer IDs maintain correspondence across trees
- Tree synchronization handles creation and removal of layers
- Recycle tree optimization avoids allocation costs when structure unchanged

### Why Pending Trees?

The pending tree enables atomic visual updates when multiple changes occur in a single JavaScript callstack:
- Canvas drawing operations
- DOM element movements  
- Style changes (background colors, etc.)

All changes must be rastered before any can be presented, ensuring visual consistency.

## Raster and Tile Management

### TileManager Architecture

The **TileManager** orchestrates rasterization across the system:

1. **Tile Discovery**: Each PictureLayer provides tiles (subrectangles at specific scales)
2. **Priority Classification**:
   - Required tiles for active tree drawing
   - Required tiles for pending tree activation  
   - Nearby tiles for smooth scrolling
   - Offscreen image decoding

3. **Work Scheduling**: Coordinates between raster work and tile requirements
4. **Resource Management**: Handles GPU texture allocation and lifecycle

### Rasterization Pipeline

```cpp
// Simplified raster pipeline flow
PaintRecord → RasterSource → RasterBuffer → RasterTask → GPUTexture
```

#### **Paint Operations**
- **PaintRecord**: Recorded sequence of paint commands
- **PaintCanvas**: Abstract interface for recording (SkiaPaintCanvas or PaintRecordCanvas)  
- **Display Lists**: Efficient representation of paint operations

#### **Raster Execution**
- **RasterSource**: Provides paint content for specific tiles
- **RasterBuffer**: Target for rasterization (CPU or GPU memory)
- **TaskGraph**: Coordinates parallel rasterization work
- **GPU Acceleration**: Leverages Skia GPU backend when available

## Scheduling and Frame Production

### cc::Scheduler

The cc::Scheduler manages the rendering pipeline timing:

#### **Input Signals**
- Visibility changes
- Begin frame messages from display compositor
- Content change notifications ("needs redraw")
- Rasterization completion ("ready to draw", "ready to activate")

#### **State Machine**
The **cc::SchedulerStateMachine** determines actions:
- `Commit` - Process main thread changes
- `ActivateSyncTree` - Move pending tree to active
- `PrepareTiles` - Initiate rasterization work
- `Draw` - Produce compositor frame

#### **Frame Types**
- **BeginImplFrame**: Should cc produce a compositor frame?
- **BeginMainFrame**: Should cc request main thread work (Blink RAF)?

### Scheduling Flow Examples

#### **Fast Pipeline** (low latency):
```
BeginImplFrame → BeginMainFrame → Commit → ReadyToActivate → Activate → ReadyToDraw → Draw
```

#### **Slow Raster Pipeline** (parallel work):
```  
BeginImplFrame1 → BeginMainFrame1 → Commit1 → (slow raster)
BeginImplFrame2 → BeginMainFrame2 → ReadyToActivate1 → Activate1 → Commit2 → ReadyToDraw1 → Draw1
```

#### **Latency Management**
- **High Latency Mode**: Increases pipelining when main thread is slow
- **Catch-up Mechanism**: Skips BeginMainFrame to return to low latency
- **Deadline Management**: Maintains target frame timing with heuristics

## Compositor Frames and Rendering Output

### Compositor Frame Structure

```cpp
struct CompositorFrame {
  CompositorFrameMetadata metadata;        // Device scale, color space, size
  std::vector<RenderPass> render_passes;   // Ordered list of render passes
  std::vector<Resource> resource_list;     // Referenced textures/resources
};
```

### Render Passes and Quads

#### **Render Pass**
- Contains ordered set of quads (back-to-front)
- Supports composited effects (masks, filters, opacity on subtrees)
- Dependency ordering: dependent passes appear first in list
- Root render pass always last

#### **Quad Types**
- **ContentDrawQuad**: Painted layer content
- **TextureDrawQuad**: External texture content  
- **SolidColorDrawQuad**: Solid color regions
- **RenderPassDrawQuad**: References output of another render pass

#### **SharedQuadState**
- Optimization for quads with common properties
- Reduces per-quad memory overhead
- Contains transform, clip, opacity information

### 3D Rendering and Sorting

- **Painter's Algorithm**: Default back-to-front quad ordering
- **3D Context Handling**: BSP tree for `transform-style: preserve-3d`
- **Intersection Resolution**: Automatic quad splitting for 3D overlap

## Advanced Features

### Damage Tracking

cc tracks three types of invalidation:

#### **Paint Invalidation** (Blink)
- Document regions requiring repaint
- Triggers style recalculation and layout

#### **Raster Invalidation** (cc)  
- Layer regions requiring re-rasterization
- Includes paint invalidation plus synthetic cases
- Texture loss recovery and initial rasterization

#### **Draw Invalidation/Damage** (Compositor)
- Screen regions requiring redraw
- **Invalidation Damage**: Changed content
- **Expose Damage**: Layer add/remove/reorder
- Enables partial swap and overlay optimizations

### Mask Layers

Special layer handling for CSS mask effects:
- Exist outside normal parent/child tree
- Owned by masked layer
- Require special iteration consideration
- Processed through RenderSurfaceImpl for effect integration

### Implementation Details

#### **"Impl" Naming Convention**
In cc, "Impl" suffix indicates **compositor thread usage**, not implementation pattern:
- **LayerImpl**: Compositor thread layer representation
- **LayerTreeImpl**: Compositor thread tree structure  
- **LayerTreeHostImpl**: Compositor thread host object

Historical naming from early main/compositor thread separation.

## Integration with Chromium Architecture

### Process Integration
- **Browser Process**: UI compositing and window management
- **Renderer Process**: Web content compositing via Blink
- **GPU Process**: Texture management and final composition

### Related Systems
- **Viz Display Compositor**: Final frame aggregation and display
- **Blink**: Main thread content preparation and painting
- **Skia**: 2D graphics library for rasterization
- **GPU Service**: Hardware acceleration and texture management

## Performance Optimization Strategies

### Tile-Based Rendering
- **Viewport Prioritization**: Focus resources on visible content
- **Predictive Loading**: Pre-raster likely-needed tiles
- **Scale Optimization**: Multiple tile resolutions for smooth zooming

### GPU Acceleration
- **Texture Caching**: Avoid redundant rasterization
- **GPU Rasterization**: Hardware-accelerated paint operations
- **Zero-Copy Textures**: Direct GPU memory access

### Threading Optimization
- **Work Stealing**: Dynamic load balancing across threads
- **Priority Queues**: Critical work scheduling
- **Deadline Scheduling**: Frame timing constraints

## Common Patterns and Best Practices

### Layer Management
```cpp
// Efficient layer updates
layer->SetNeedsDisplay();  // Trigger repaint
layer->SetOpacity(0.5f);   // Composited property change
layer->SetPosition(gfx::PointF(10, 20));  // Transform update
```

### Damage Optimization
```cpp
// Minimal damage regions
layer->SetNeedsDisplayRect(damage_rect);  // Partial invalidation
layer->SetNeedsPushProperties();          // Property-only change
```

### Resource Management
```cpp
// Texture lifecycle
std::unique_ptr<TextureLayer> texture_layer = TextureLayer::Create();
texture_layer->SetTextureId(texture_id);
texture_layer->SetPremultipliedAlpha(true);
texture_layer->SetBlendBackgroundColor(true);
```

## Future Considerations

### Architecture Evolution
- **Simplified Layer Interface**: Direct property tree usage from Blink
- **Unified Rendering**: Further integration with Viz architecture
- **Mobile Optimization**: Enhanced efficiency for resource-constrained devices

### Performance Improvements  
- **Predictive Rasterization**: ML-powered tile prediction
- **Variable Rate Shading**: GPU efficiency optimization
- **Content-Aware Compression**: Intelligent texture compression

## Summary

The Chromium Compositor (cc) represents a sophisticated approach to browser rendering that balances performance, responsiveness, and visual quality. Its multi-threaded architecture, advanced scheduling system, and comprehensive tile management enable smooth 60+ FPS rendering even with complex web content.

Key architectural strengths include:
- **Separation of Concerns**: Clear division between content preparation and presentation
- **Atomic Updates**: Consistent visual state through tree-based staging
- **Performance Optimization**: Tile-based rendering with predictive loading
- **Responsiveness**: Independent animation and input handling
- **Extensibility**: Support for advanced effects and future enhancements

Understanding cc's architecture is essential for developers working on Chromium's rendering pipeline, performance optimization, or related graphics systems.

## Related Documentation

For additional context on Chromium's rendering architecture:
- [Render Pipeline](render-pipeline.md) - High-level rendering pipeline overview
- [GPU Synchronization](gpu_synchronization.md) - GPU rendering coordination
- [Threading and Tasks](threading_and_tasks.md) - Threading patterns used in cc
- [Performance Optimization](../modules/performance.md) - Rendering performance best practices

External resources:
- [Chromium Graphics Documentation](https://www.chromium.org/developers/design-documents/chromium-graphics)
- [cc/ Source Code](https://chromium.googlesource.com/chromium/src/+/main/cc/)
- [Compositor Design Documents](https://chromium.googlesource.com/chromium/src/+/main/docs/)