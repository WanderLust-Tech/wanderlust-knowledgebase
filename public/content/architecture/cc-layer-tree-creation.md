# CC Layer Tree Creation Process

A comprehensive technical analysis of how Chromium's CC (Compositor) module creates and manages the Layer Tree from WebKit's Graphics Layer Tree for hardware-accelerated rendering.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Foundation](#architecture-foundation)
3. [Graphics Layer to CC Layer Mapping](#graphics-layer-to-cc-layer-mapping)
4. [Layer Creation Process](#layer-creation-process)
5. [Layer Tree Synchronization](#layer-tree-synchronization)
6. [Threading and Compositing](#threading-and-compositing)
7. [Layer Tree Initialization](#layer-tree-initialization)
8. [Performance and Optimization](#performance-and-optimization)
9. [Related Documentation](#related-documentation)

---

## Overview

The CC (Content Compositor) Layer Tree is a critical component in Chromium's rendering architecture that bridges WebKit's Graphics Layer Tree with the actual GPU-accelerated compositing system. This document analyzes the complete process of how the CC module creates its Layer Tree from the Graphics Layer Tree provided by WebKit.

### Key Relationships

```text
Graphics Layer Tree (WebKit/Blink)
    ↓ [1:1 Mapping]
WebContentLayerImpl (Content Layer)
    ↓ [Wrapping]
WebLayerImpl (Content Layer)  
    ↓ [CC Integration]
PictureLayer/ContentLayer (CC Layer)
    ↓ [Tree Structure]
CC Layer Tree (CC Module)
```

**Important Note**: Each Graphics Layer corresponds to exactly one CC Layer, but the mapping is established through intermediate wrapper objects in the Content layer.

---

## Architecture Foundation

### Process Architecture

The CC Layer Tree creation involves multiple processes and threads:

```text
Render Process:
├── Main Thread (Blink)
│   ├── Graphics Layer Tree Management
│   ├── Layer Creation Requests
│   └── Paint Recording
├── Compositor Thread
│   ├── CC Layer Tree Management
│   ├── Animation Coordination
│   └── GPU Process Communication
└── Raster Threads
    ├── Paint Operation Execution
    └── Texture Generation
```

### Module Hierarchy

The layer creation process involves three distinct module layers:

1. **Blink Layer** (WebKit): `GraphicsLayer`
2. **Content Layer**: `WebContentLayerImpl` → `WebLayerImpl`  
3. **CC Layer**: `PictureLayer` / `ContentLayer`

---

## Graphics Layer to CC Layer Mapping

### Creation Chain Analysis

#### 1. GraphicsLayer Constructor

```cpp
GraphicsLayer::GraphicsLayer(GraphicsLayerClient* client)
: m_client(client), 
  // ... other initialization
{
    // Create delegate for paint operations
    m_opaqueRectTrackingContentLayerDelegate = 
        adoptPtr(new OpaqueRectTrackingContentLayerDelegate(this));
    
    // Request CC layer creation through platform support
    m_layer = adoptPtr(Platform::current()->compositorSupport()
        ->createContentLayer(m_opaqueRectTrackingContentLayerDelegate.get()));
}
```

**Key Components**:
- `client`: Points to `CompositedLayerMapping` object
- `m_opaqueRectTrackingContentLayerDelegate`: Paint operations delegate
- `m_layer`: WebContentLayerImpl wrapper for CC integration

#### 2. WebContentLayerImpl Creation

```cpp
WebContentLayer* WebCompositorSupportImpl::createContentLayer(
    WebContentLayerClient* client) {
    return new WebContentLayerImpl(client);
}
```

The `WebCompositorSupportImpl` class creates the bridge between Blink and the Content layer.

#### 3. WebContentLayerImpl Constructor

```cpp
WebContentLayerImpl::WebContentLayerImpl(blink::WebContentLayerClient* client)
: client_(client), // ... initialization
{
    if (WebLayerImpl::UsingPictureLayer())
        layer_ = make_scoped_ptr(new WebLayerImpl(PictureLayer::Create(this)));
    else
        layer_ = make_scoped_ptr(new WebLayerImpl(ContentLayer::Create(this)));
}
```

**Layer Type Selection**:
- **PictureLayer**: Used when Impl Side Painting enabled (`--enable-impl-side-painting`)
- **ContentLayer**: Used for immediate painting to canvas

### Impl Side Painting vs Direct Painting

#### Impl Side Painting (Modern Path)

When `--enable-impl-side-painting` is enabled:

```cpp
// Graphics Layer records paint commands only
// Actual rasterization happens on Compositor thread
PictureLayer → Records DisplayItemList → GPU Rasterization
```

**Benefits**:
- Parallel rasterization on Compositor thread
- Better main thread responsiveness
- Advanced GPU acceleration capabilities

#### Direct Painting (Legacy Path)

Without Impl Side Painting:

```cpp  
// Graphics Layer paints directly to canvas on Main thread
ContentLayer → Direct Canvas Painting → GPU Upload
```

---

## Layer Creation Process

### PictureLayer Creation

```cpp
scoped_refptr<PictureLayer> PictureLayer::Create(ContentLayerClient* client) {
    return make_scoped_refptr(new PictureLayer(client));
}

PictureLayer::PictureLayer(ContentLayerClient* client)
: client_(client),
  pile_(make_scoped_refptr(new PicturePile())),
  // ... initialization
{
}
```

**Core Components**:
- `client_`: Points to WebContentLayerImpl
- `pile_`: PicturePile for recording paint commands
- Inherits from `cc::Layer` base class

### WebLayerImpl Wrapping

```cpp
WebLayerImpl::WebLayerImpl(scoped_refptr<Layer> layer) 
: layer_(layer) 
{
    // Store CC Layer reference for Content layer access
}
```

The WebLayerImpl serves as the Content layer's interface to CC Layer functionality.

---

## Layer Tree Synchronization

### Parent-Child Relationship Establishment

#### Graphics Layer Tree Structure

```cpp
void GraphicsLayer::addChild(GraphicsLayer* childLayer) {
    addChildInternal(childLayer);
    updateChildList(); // Synchronize to CC Layer Tree
}

void GraphicsLayer::addChildInternal(GraphicsLayer* childLayer) {
    childLayer->setParent(this);
    m_children.append(childLayer);
}
```

#### CC Layer Tree Synchronization

```cpp
void GraphicsLayer::updateChildList() {
    WebLayer* childHost = m_layer->layer(); // Get WebLayerImpl
    
    for (size_t i = 0; i < m_children.size(); ++i)
        childHost->addChild(m_children[i]->platformLayer());
}

void WebLayerImpl::addChild(WebLayer* child) {
    layer_->AddChild(static_cast<WebLayerImpl*>(child)->layer());
}
```

### Layer Tree Synchronization Process

```text
1. Graphics Layer Tree Modified
    ↓
2. updateChildList() Called
    ↓  
3. WebLayerImpl::addChild() 
    ↓
4. PictureLayer::AddChild()
    ↓
5. CC Layer Tree Structure Updated
    ↓
6. SetNeedsFullTreeSync() Notification
```

### Tree Sync Notification

```cpp
void Layer::InsertChild(scoped_refptr<Layer> child, size_t index) {
    child->RemoveFromParent();
    child->SetParent(this);
    child->stacking_order_changed_ = true;
    
    children_.insert(children_.begin() + index, child);
    SetNeedsFullTreeSync(); // Request tree synchronization
}

void Layer::SetNeedsFullTreeSync() {
    if (!layer_tree_host_)
        return;
    layer_tree_host_->SetNeedsFullTreeSync();
}
```

---

## Threading and Compositing

### LayerTreeHost Management

#### Main Thread Coordination

```cpp
void LayerTreeHost::SetNeedsFullTreeSync() {
    needs_full_tree_sync_ = true;
    SetNeedsCommit(); // Request compositor thread synchronization
}

void LayerTreeHost::SetNeedsCommit() {
    proxy_->SetNeedsCommit(); // Forward to ThreadProxy
}
```

#### Compositor Thread Notification

```cpp
void ThreadProxy::SetNeedsCommit() {
    if (main().commit_requested)
        return; // Batch multiple requests
        
    main().commit_requested = true;
    SendCommitRequestToImplThreadIfNeeded();
}

void ThreadProxy::SendCommitRequestToImplThreadIfNeeded() {
    main().commit_request_sent_to_impl_thread = true;
    Proxy::ImplThreadTaskRunner()->PostTask(
        FROM_HERE,
        base::Bind(&ThreadProxy::SetNeedsCommitOnImplThread,
                   impl_thread_weak_ptr_));
}
```

### Root Layer Management

#### Root Layer Creation Process

The CC Layer Tree root is established when WebKit creates the Graphics Layer Tree root:

```cpp
// 1. Document creates RenderView (Render Object Tree root)
void Document::attach(const AttachContext& context) {
    m_renderView = new RenderView(this);
    m_renderView->setStyle(StyleResolver::styleForDocument(*this));
}

// 2. RenderLayer created for root RenderView
void RenderLayerModelObject::styleDidChange(StyleDifference diff, const RenderStyle* oldStyle) {
    LayerType type = layerTypeRequired();
    if (type != NoLayer) {
        if (!layer() && layerCreationAllowedForSubtree()) {
            createLayer(type);
        }
    }
    if (layer()) {
        layer()->styleChanged(diff, oldStyle);
    }
}

// 3. Graphics Layer Tree root creation triggered
void RenderLayerCompositor::ensureRootLayer() {
    if (!m_rootContentLayer) {
        m_rootContentLayer = GraphicsLayer::create(graphicsLayerFactory(), this);
    }
    // Create layer hierarchy: OverflowControlsHost → Container → Scroll → RootContent
    attachRootLayer(expectedAttachment);
}
```

#### Root Layer Attachment to CC

```cpp
void ChromeClientImpl::attachRootGraphicsLayer(GraphicsLayer* rootLayer) {
    m_webView->setRootGraphicsLayer(rootLayer);
}

void WebViewImpl::setRootGraphicsLayer(GraphicsLayer* layer) {
    m_rootGraphicsLayer = layer;
    m_rootLayer = layer ? layer->platformLayer() : 0; // Get WebLayerImpl
    setIsAcceleratedCompositingActive(layer);
}
```

---

## Layer Tree Initialization

### Render Process Layer Tree Setup

#### RenderWidget Initialization

```cpp
void RenderWidget::initializeLayerTreeView() {
    compositor_ = RenderWidgetCompositor::Create(this, is_threaded_compositing_enabled_);
    
    if (init_complete_)
        StartCompositor(); // Activate scheduler
}
```

#### RenderWidgetCompositor Creation

```cpp
scoped_ptr<RenderWidgetCompositor> RenderWidgetCompositor::Create(
    RenderWidget* widget, bool threaded) {
    
    scoped_ptr<RenderWidgetCompositor> compositor(
        new RenderWidgetCompositor(widget, threaded));
    
    // Configure CC settings based on command line flags
    CommandLine* cmd = CommandLine::ForCurrentProcess();
    cc::LayerTreeSettings settings;
    
    // Debug visualization settings
    settings.initial_debug_state.show_debug_borders = 
        cmd->HasSwitch(cc::switches::kShowCompositedLayerBorders);
    settings.initial_debug_state.show_fps_counter = 
        cmd->HasSwitch(cc::switches::kShowFPSCounter);
    // ... additional debug settings
    
    compositor->Initialize(settings);
    return compositor.Pass();
}
```

### LayerTreeHost Creation

#### Threading Configuration

```cpp
void RenderWidgetCompositor::Initialize(cc::LayerTreeSettings settings) {
    RenderThreadImpl* render_thread = RenderThreadImpl::current();
    
    if (render_thread) {
        compositor_message_loop_proxy = 
            render_thread->compositor_message_loop_proxy();
    }
    
    if (compositor_message_loop_proxy.get()) {
        // Threaded compositing enabled
        layer_tree_host_ = cc::LayerTreeHost::CreateThreaded(
            this, shared_bitmap_manager, settings, compositor_message_loop_proxy);
    } else {
        // Single-threaded fallback
        layer_tree_host_ = cc::LayerTreeHost::CreateSingleThreaded(
            this, this, shared_bitmap_manager, settings);
    }
}
```

#### Compositor Thread Creation

```cpp
void RenderThreadImpl::EnsureWebKitInitialized() {
    if (webkit_platform_support_)
        return;
        
    // Initialize WebKit platform support
    webkit_platform_support_.reset(new RendererWebKitPlatformSupportImpl);
    blink::initialize(webkit_platform_support_.get());
    
    // Create Compositor thread if threaded compositing enabled
    const CommandLine& command_line = *CommandLine::ForCurrentProcess();
    bool enable = command_line.HasSwitch(switches::kEnableThreadedCompositing);
    if (enable) {
        if (!compositor_message_loop_proxy_.get()) {
            compositor_thread_.reset(new base::Thread("Compositor"));
            compositor_thread_->Start();
            compositor_message_loop_proxy_ = 
                compositor_thread_->message_loop_proxy();
        }
    }
}
```

### LayerTreeHostImpl Creation

#### Impl Thread Initialization

```cpp
scoped_ptr<LayerTreeHost> LayerTreeHost::CreateThreaded(
    LayerTreeHostClient* client,
    SharedBitmapManager* manager, 
    const LayerTreeSettings& settings,
    scoped_refptr<base::SingleThreadTaskRunner> impl_task_runner) {
    
    scoped_ptr<LayerTreeHost> layer_tree_host(
        new LayerTreeHost(client, manager, settings));
    layer_tree_host->InitializeThreaded(impl_task_runner);
    return layer_tree_host.Pass();
}

void LayerTreeHost::InitializeThreaded(
    scoped_refptr<base::SingleThreadTaskRunner> impl_task_runner) {
    InitializeProxy(ThreadProxy::Create(this, impl_task_runner));
}
```

#### ThreadProxy Coordination

```cpp
void ThreadProxy::InitializeImplOnImplThread(CompletionEvent* completion) {
    // Create LayerTreeHostImpl for Compositor thread
    impl().layer_tree_host_impl = 
        layer_tree_host()->CreateLayerTreeHostImpl(this);
    
    // Create scheduler for coordinating rendering work
    SchedulerSettings scheduler_settings(layer_tree_host()->settings());
    impl().scheduler = Scheduler::Create(this, scheduler_settings, 
                                       impl().layer_tree_host_id,
                                       ImplThreadTaskRunner());
    
    impl_thread_weak_ptr_ = impl().weak_factory.GetWeakPtr();
    completion->Signal(); // Notify Main thread initialization complete
}
```

### Layer Tree Root Assignment

#### Setting CC Layer Tree Root

```cpp
void RenderWidgetCompositor::setRootLayer(const blink::WebLayer& layer) {
    layer_tree_host_->SetRootLayer(
        static_cast<const WebLayerImpl*>(&layer)->layer());
}

void LayerTreeHost::SetRootLayer(scoped_refptr<Layer> root_layer) {
    root_layer_ = root_layer; // Store CC Layer Tree root
    SetNeedsFullTreeSync(); // Request tree synchronization
}
```

---

## Performance and Optimization

### GPU Rasterization Configuration

#### Rasterization Strategy Selection

```cpp
bool LayerTreeHost::UseGpuRasterization() const {
    if (settings_.gpu_rasterization_forced) {
        return true; // --force-gpu-rasterization
    } else if (settings_.gpu_rasterization_enabled) {
        return has_gpu_rasterization_trigger_ && 
               content_is_suitable_for_gpu_rasterization_;
    } else {
        return false;
    }
}

void LayerTreeHostImpl::SetUseGpuRasterization(bool use_gpu) {
    if (use_gpu == use_gpu_rasterization_)
        return;
        
    use_gpu_rasterization_ = use_gpu;
    ReleaseTreeResources();
    
    if (tile_manager_) {
        DestroyTileManager();
        CreateAndSetTileManager(); // Recreate with new rasterization mode
    }
    active_tree_->SetRequiresHighResToDraw();
}
```

### Memory Management

#### Layer Tree Resource Management

```cpp
// Active Tree manages currently displayed content
// Pending Tree handles incoming updates
// Recycle Tree provides object reuse for efficiency

scoped_ptr<LayerTreeImpl> active_tree_;   // Currently displayed
scoped_ptr<LayerTreeImpl> pending_tree_;  // Incoming updates  
scoped_ptr<LayerTreeImpl> recycle_tree_;  // Object recycling
```

### Scheduling Optimization

#### Commit Batching

```cpp
void ThreadProxy::SetNeedsCommit() {
    if (main().commit_requested)
        return; // Batch multiple commit requests
        
    main().commit_requested = true;
    SendCommitRequestToImplThreadIfNeeded();
}
```

**Benefits**:
- Reduces redundant synchronization overhead
- Batches multiple WebKit changes into single CC update
- Improves overall rendering performance

---

## Related Documentation

### Core Architecture
- [Rendering Architecture Fundamentals](rendering-architecture-fundamentals.md) - Complete rendering pipeline overview
- [Graphics Layer Tree Creation](graphics-layer-tree-creation.md) - WebKit Graphics Layer Tree creation
- [Render Pipeline](render-pipeline.md) - Modern rendering pipeline stages

### Process and Threading
- [Process Model](process-model.md) - Multi-process architecture 
- [Task Posting Patterns](task-posting-patterns.md) - Threading coordination patterns
- [IPC Internals](ipc-internals.md) - Inter-process communication

### Implementation Details  
- [Browser Components](browser-components.md) - Component interaction patterns
- [Module Layering](module-layering.md) - Software architecture organization

### Performance and Debugging
- [Chrome Internals URLs](../debugging/chrome-internals-urls.md) - `chrome://tracing` for CC analysis
- [Debugging Tools](../debugging/debugging-tools.md) - Layer tree inspection tools

---

**This document provides a comprehensive technical analysis of CC Layer Tree creation, covering the complete process from Graphics Layer Tree mapping through threaded compositor initialization. The implementation details demonstrate the sophisticated coordination required between WebKit/Blink and Chromium's compositing system for efficient hardware-accelerated rendering.**