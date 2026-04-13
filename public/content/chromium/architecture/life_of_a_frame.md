# Life of a Frame (Chromium v134+)

**Status**: Active | **Last Updated**: December 2024 | **Applies to**: Chromium v134+

This document describes the complete lifecycle of a frame inIn which the length of each segment demonstrates the latency of that stage.
Also SubmitCompositorFrameToPresentationCompositorFrame would have its own breakdown, which includes:
- SubmitToReceiveCompositorFrame: The time of communicating the submit (step `[9]`)
- ReceiveCompositorFrameToStartDraw: The time it takes for steps `[10]` to `[14]`
- StartDrawToSwapStart: The time that "Draw" takes in GPU Main (step `[15]`)
- Swap: The time that "Swap" takes in GPU Main (step `[16]`)
- SwapEndToPresentationCompositorFrame: The remaining time until presentation (step `[17]`)

**v134+ Additional Metrics**:
- **ResourceLoading**: Time spent waiting for textures, shaders, and other GPU resources
- **ThermalThrottling**: Delays caused by thermal management
- **PowerManagement**: Impact of power saving modes on timingum's rendering pipeline, 
from the initial BeginFrame signal to pixels appearing on screen. The pipeline has evolved 
significantly with v134+ to include enhanced performance optimizations, improved scheduling, 
and modern GPU integration.

[Original google doc](https://docs.google.com/document/d/1y6ZlGc2uH4ZBIrpEVM_wmfHgyvrcQG3LPRzG32FuVkQ/edit?usp=sharing)

![flow diagram](images/Life_of_frame.png)

## Frame Pipeline Overview (v134+)

The Chromium frame pipeline is a sophisticated multi-process, multi-threaded system designed to deliver 
smooth 60fps (or higher) rendering performance. In v134+, the pipeline has been optimized for:

- **Variable Refresh Rate (VRR)**: Adaptive sync with high-refresh-rate displays (120Hz, 144Hz, etc.)
- **HDR Content**: Enhanced color space handling and tone mapping
- **GPU Optimization**: Improved Vulkan backend and hardware acceleration
- **Power Efficiency**: Better scheduling to reduce battery usage on mobile devices
- **WebGPU Integration**: Native support for modern graphics APIs

## Steps

### `[1]` BeginFrame (Enhanced v134+)
BeginImplFrame starts a compositor frame (with each vsync or VRR signal) that will wait up until a deadline for a BeginMainFrame plus activation to complete before it times out and draws any asynchronous animation and scroll/pinch updates.

**v134+ Improvements**:
- **Adaptive Frame Pacing**: Dynamic deadline adjustment based on display refresh rate and system load
- **Predictive Scheduling**: Machine learning-based prediction of frame completion times
- **Priority-based Processing**: High-priority frames (e.g., input-driven) get preferential treatment

### `[2]` Compositor Updates (v134+ Optimized)
All updates on Impl thread such as scrolls, zoom animations, and transform effects.

**v134+ Enhancements**:
- **Smooth Scrolling Improvements**: Better kinetic scrolling with reduced jank
- **Touch Response Optimization**: Lower latency for touch-driven animations
- **Hardware-accelerated Effects**: Enhanced support for CSS filters and backdrop-filter

### `[3]` BeginMainFrame (Smart Scheduling v134+)
If there is main thread damage, BeginMainFrame will be sent and if there is no main thread damage steps [3], [4] and [5] will be skipped ([SchedulerStateMachine::ShouldSendBeginMainFrame()](https://source.chromium.org/chromium/chromium/src/+/main:cc/scheduler/scheduler_state_machine.cc)).

**v134+ Intelligence**:
- **Damage Detection**: More precise algorithms to detect when main thread work is needed
- **Preemptive Scheduling**: Early preparation for known expensive operations
- **Worker Thread Coordination**: Better integration with Web Workers and Service Workers

### `[4]` MainThreadUpdates (Performance Optimized v134+)
All updates on main thread such as HandleInputEvents, Animate, StyleUpdate, LayoutUpdate, and Paint.

**v134+ Performance Features**:
- **LayoutNG**: Next-generation layout engine with improved performance and correctness
- **Incremental Style Updates**: Minimal recalculation for CSS changes
- **Paint Optimization**: Enhanced paint invalidation and caching strategies
- **Container Queries**: Efficient implementation of CSS Container Queries
- **View Transitions API**: Hardware-accelerated page transitions

### `[5]` Commit (Optimized Transfer v134+)
Commits updates back to Impl thread for activation. Specifically, the main thread copies its own version of layertree onto the pending tree (pending_tree_) on the impl thread. The main thread is blocked during the copying process.

**v134+ Commit Improvements**:
- **Incremental Commits**: Only changed portions of the layer tree are transferred
- **Compressed Layer Data**: Reduced memory overhead for large layer trees
- **Priority-based Commits**: Critical updates are committed first to reduce perceived latency

### `[6]` Wait for Raster (Advanced GPU Pipeline v134+)
Rasterization may occur asynchronously on separate threads, or even another process (OOP-R, or out-of-process rasterization). If rasterization cannot be finished before the deadline for activation, the pipeline will not perform the copying from pending tree to the active tree in step [7], and will instead proceed to step [8] with whatever is already in the active tree.

**v134+ Rasterization Features**:
- **GPU Rasterization**: Hardware-accelerated rasterization for complex content
- **Vulkan Backend**: Modern graphics API support for better performance
- **Shared Image System**: Efficient memory sharing between processes
- **HDR Rasterization**: Native support for wide color gamut and HDR content
- **WebGPU Integration**: Direct rasterization for WebGPU-rendered content

### `[7]` Activation
Activation is the process of pushing layer trees and properties from the pending tree to the active tree (active_tree_). Note that Impl thread can also directly manipulate the activate tree to reflect updates the impl thread makes in step [2].

### `[8]` Wait for Deadline (Intelligent Timing v134+)
The deadline for compositor frame submission is provided by the GPU process ([Scheduler::BeginImplFrameWithDeadline()](https://source.chromium.org/chromium/chromium/src/+/main:cc/scheduler/scheduler.cc)).

**v134+ Deadline Management**:
- **Adaptive Deadlines**: Dynamic adjustment based on display characteristics and system performance
- **Power-aware Scheduling**: Extended deadlines on battery power to improve efficiency
- **Thermal Throttling**: Deadline adjustments to prevent device overheating
- **Frame Rate Targeting**: Intelligent targeting of 30fps, 60fps, 120fps, or variable rates

### `[9]` SubmitCompositorFrame
All activated updates will be submitted to the GPU process as a compositor frame that is produced based on the content of the active tree. If any of the steps [2], [3], [4], [5], [6] takes so long that the update that step is responsible for cannot be delivered to the active tree by deadline, the pipeline will proceed to submit with the existing active tree without said update. This is a possible source of a dropped frame.

### `[10]` AggregateSurfaces (Enhanced Composition v134+)
After each client submitted CompositorFrame (or signalled that it DidNotProduceFrame) the Display Compositor can proceed with the draw. Note that if the DisplayScheduler hits a deadline it will still draw if any client has submitted a new CompositorFrame, even if it's still waiting on a response for other clients. Before the actual draw could happen [SurfaceAggregator](https://source.chromium.org/chromium/chromium/src/+/main:components/viz/service/display/surface_aggregator.h) will recursively walk over compositor frames and replace SurfaceQuads (quads produced by SurfaceLayer) with contents of the embedded compositor frame. This step produces single CompositorFrame in the end that can be drawn by the Display Compositor.

**v134+ Surface Management**:
- **Damage Propagation**: Efficient tracking of which surfaces need updates
- **Surface Synchronization**: Better coordination between multiple embedded surfaces
- **Cross-origin Isolation**: Enhanced security for iframe content aggregation

### `[11]` Draw Frame (Modern Rendering v134+)
During draw Display Compositor will go over quads and render passes in the aggregated compositor frame and produce draw commands. For [SkiaRenderer](https://source.chromium.org/chromium/chromium/src/+/main:components/viz/service/display/skia_renderer.h) it's recording of Deferred Display Lists (DDL).

**v134+ Rendering Features**:
- **Advanced Skia Integration**: Latest Skia features including GPU tessellation
- **Vulkan Renderer**: Modern graphics API for better performance and lower CPU overhead
- **HDR Pipeline**: Full HDR rendering support with proper tone mapping
- **Variable Rate Shading**: GPU optimization for complex scenes

### `[12]` RequestSwap
After commands were recorded they will be submitted to the GPU thread to replay along with SwapBuffers request to show the result on screen.

### `[13]` Wait Until Ready to Draw (Advanced Synchronization v134+)
When the draw was submitted to GPU Main Thread some of the resources may be not ready yet. Chrome uses [SyncTokens](https://source.chromium.org/chromium/chromium/src/+/main:gpu/command_buffer/common/sync_token.h) to ensure this type of synchronization. GPU Task submitted at step [12] won't be scheduled until all associated SyncTokens will be signaled.

**v134+ Synchronization**:
- **Timeline Semaphores**: Vulkan-based efficient GPU synchronization
- **Shared Image Sync**: Optimized synchronization for cross-process shared resources
- **Predictive Resource Loading**: Proactive resource preparation to reduce wait times

### `[14]` Queueing Delay (Smart Scheduling v134+)
GPU Main Thread does all the GPU work and by the time display compositor is ready to draw it might still be busy doing other tasks (e.g raster for next frame). [gpu::Scheduler](https://source.chromium.org/chromium/chromium/src/+/main:gpu/command_buffer/service/scheduler.h) uses cooperative multi-tasking and can't preempt the current task unless it yields, so the task submitted by the display compositor might have to wait until the current task (and potentially some other high priority tasks) are finished.

**v134+ Queue Management**:
- **Priority Scheduling**: Display tasks get higher priority than background raster
- **Adaptive Time Slicing**: Dynamic adjustment of task execution time based on deadline pressure
- **Power-aware Scheduling**: Queue management optimized for battery life

### `[15]` GPU Draw (Hardware Accelerated v134+)
Finally tasks that DisplayCompositor posted to GPU Main thread executed and we replay draw commands recorded during Draw Frame [11]. For SkiaRenderer Skia will be replaying DDLs and issue commands to the GPU. This step is when we finally submit the job to the GPU (not GPU thread on CPU).

**v134+ GPU Features**:
- **Vulkan Command Buffers**: Modern GPU command submission for better performance
- **GPU Memory Management**: Advanced memory allocation and deallocation strategies
- **Multi-queue Execution**: Parallel GPU command execution when supported
- **Hardware Ray Tracing**: Support for RT cores in compatible GPUs

### `[16]` Swap (Display Integration v134+)
The GPU work has been submitted and we signal that we want to present the result (Submits commands to request displaying framebuffer and/or overlays after drawing new content into them). Depending on the platform this step can be blocking or not and take a substantial amount of time (e.g. if we have too many queued swaps sometimes this will just block until the next vblank).

**v134+ Display Features**:
- **Variable Refresh Rate**: Adaptive sync support (FreeSync, G-Sync)
- **HDR Swapchains**: Proper HDR presentation with correct color space
- **Direct Composition**: Windows DirectComposition integration for reduced latency
- **Overlay Optimization**: Hardware overlay usage for video and UI elements

### `[17]` Presentation (Advanced Display Pipeline v134+)
This is when the GPU has finished all the work and the display controller started scanning out the results. The pixels are finally visible on the screen. Depending on the platform, before this could happen the system compositor might need to do its work. Unfortunately it's not possible to get the exact timestamp on every platform and Chrome makes best efforts to estimate it. This estimation can be something like the swap time (on mac where we don't have any better information), the completion time for work on the GPU aligned to the next vblank as a good estimate, or a signal from the OS with the exact time the content was displayed.

**v134+ Presentation Features**:
- **High-precision Timestamps**: Better presentation timing estimation across platforms
- **VRR Coordination**: Proper timing with variable refresh rate displays
- **Multi-monitor Support**: Enhanced handling of different display characteristics
- **Color Management**: Accurate color reproduction across different display technologies

## PipelineReporter Trace Events (Enhanced v134+)

Multiple stages of the pipeline are highlighted for each frame in the traces titled **PipelineReporter**. In v134+, these traces have been enhanced with additional metrics and better granularity.

**Tracked Stages**:
- BeginImplFrameToSendBeginMainFrame
- SendBeginMainFrameToCommit  
- Commit
- EndCommitToActivation
- Activation
- EndActivateToSubmitCompositorFrame
- SubmitCompositorFrameToPresentationCompositorFrame

**v134+ Trace Enhancements**:
- **GPU Process Breakdown**: Detailed timing within GPU process operations
- **Power Consumption Metrics**: Energy usage tracking for each pipeline stage
- **Thermal State**: CPU/GPU temperature impact on performance
- **Memory Pressure**: How memory constraints affect pipeline timing

Image below shows how each segment of the Pipeline is tracked in PipelineReporter trace events.

![segmented flow diagram](images/Life_of_frame_segmented.png)

In the traces these pipeline reporters would look like

![PipelineReporter trace event](images/PipelineReporter.png)

In which the length of each segment demonstrates the latency of that stage.
Also SubmitCompositorFrameToPresentationCompositorFrame would have its own, which are:
- SubmitToReceiveCompositorFrame: The time of communicating the submit (step `[9]`)
- ReceiveCompositorFrameToStartDraw: The time it takes for steps `[10]` to `[14]`
- StartDrawToSwapStart: The time that “Draw” takes in GPU Main (step `[15]`)
- Swap: The time that “Swap” takes in GPU Main (step `[16]`)
- SwapEndToPresentationCompositorFrame: The remaining time until presentation (step `[17]`)

## Overlapping pipeline reporter events

One advantage of having multiple processes handling the frame is that multiple frames can be worked on simultaneously. This might create some overlapping pipeline reporter events. In this section we would explore a few examples of these cases.

### Example 1:

![PipelineReporter trace event example_1](images/PipelineReporter_example_1.png)

In this example the PipelineReporter(PR) on the bottom started earlier and while it was in the *EndActivateToSubmitCompositorFrame*, vsync for the next frame is reached. In this stage, the compositor thread is already done with activation and is waiting for the deadline to submit the compositor frame, so it can start working on the second frame (top PR).
When we reach the deadline for submission of frame#1, the frame#2 is in the stage of *SendBeginMainFrameToCommit* (on the main thread). Frame#1 will be submitted while frame#2 will continue on its stages and will be submitted in the next vsync.

### Example 2:

![PipelineReporter trace event example_2](images/PipelineReporter_example_2.png)

In this example the two PipelineReporters start at the same time but would not end at the same time. If we look into the arguments of each we would notice that they both correspond to the same sequence number (this would be expected for PRs that start at the same time corresponding to the same vsync).
In this case, the PR on top has been in middle of *SendBeginMainFrameToCommit* while the second PR moves to *EndActivateToSubmitCompositorFrame* and then *SubmitCompositorFrameToPresentationCompositorFrame*. That means that while the main thread work was taking place we reached the deadline and submitted the compositor updates that were ready (bottom PR), and the PR on top would do the same with main thread updates on the next vsync.

### Example 3:

![PipelineReporter trace event example_3](images/PipelineReporter_example_3.png)

In this example the two PRs started at different times but are ending at the same time. This would often happen when a PR takes longer than one vsync and its last stage (e.g. *SubmitCompositorFrameToPresentationCompositorFrame*) would be synced with the next PR (top PR on the image).
In such cases the combined update from two PRs would be submitted to the GPU process and be presented together.

## Modern Performance Optimizations (v134+)

### Variable Refresh Rate (VRR) Support
Chromium v134+ includes comprehensive support for adaptive sync technologies:
- **Automatic Detection**: Recognition of VRR-capable displays
- **Dynamic Frame Pacing**: Adjustment of frame timing to match optimal refresh rates
- **Content-aware Scaling**: Different refresh rates for different content types (e.g., video vs. UI)

### WebGPU Integration
Native WebGPU support is fully integrated into the rendering pipeline:
- **Shared Command Buffers**: Efficient sharing between WebGPU and compositor
- **Timeline Synchronization**: Proper ordering of WebGPU and regular content
- **Resource Sharing**: Zero-copy sharing of textures and buffers

### Power Efficiency
Enhanced power management for better battery life:
- **Adaptive Quality**: Dynamic quality reduction during low power states
- **Frame Rate Scaling**: Intelligent reduction of frame rates when appropriate
- **GPU Clock Management**: Coordination with GPU power states

## Debugging and Analysis Tools (v134+)

### Chrome DevTools Integration
- **Frame Timeline**: Detailed per-frame analysis in DevTools
- **Layer Inspector**: Real-time layer tree visualization
- **Composite Layer Analysis**: Understanding of compositing decisions

### Performance Profiling
- **chrome://tracing**: Enhanced tracing with v134+ specific events
- **Telemetry Integration**: Automated performance regression detection
- **Real User Monitoring**: Field data collection for performance optimization

### Command Line Flags
Key debugging flags for v134+:
```bash
--enable-gpu-rasterization          # Force GPU rasterization
--disable-gpu-sandbox               # Disable GPU process sandbox
--enable-vulkan                     # Use Vulkan backend
--show-fps-counter                  # Display FPS overlay
--enable-logging=stderr             # Enable detailed logging
--vmodule=compositor=3              # Verbose compositor logging
```

## Platform-Specific Considerations (v134+)

### Windows
- **DirectComposition**: Enhanced integration for reduced latency
- **D3D12 Support**: Modern Direct3D backend for better performance
- **HDR Support**: Proper HDR10 and Dolby Vision support

### macOS
- **Metal Backend**: Native Metal support for improved performance
- **Core Animation Integration**: Better coordination with system compositor
- **Retina Display Optimization**: Enhanced handling of high-DPI displays

### Linux
- **Vulkan Priority**: Vulkan as the preferred backend on Linux
- **Wayland Support**: Native Wayland compositor integration
- **Multi-GPU Support**: Better handling of discrete/integrated GPU setups

### Android
- **Vulkan Mobile**: Optimized Vulkan implementation for mobile GPUs
- **Surface Control**: Enhanced integration with Android's SurfaceFlinger
- **Power Management**: Advanced thermal and battery optimizations

## Common Performance Issues and Solutions (v134+)

### Identifying Bottlenecks
1. **Main Thread Blocking**: Use `chrome://tracing` to identify long-running main thread tasks
2. **GPU Bottlenecks**: Monitor GPU utilization and memory usage
3. **Memory Pressure**: Track shared image memory usage and garbage collection

### Optimization Strategies
1. **Layer Promotion**: Understand when and why elements get their own layers
2. **Paint Optimization**: Minimize paint area and frequency
3. **Animation Performance**: Use compositor-only properties for smooth animations

## See Also

- [Chromium Graphics Architecture](https://source.chromium.org/chromium/chromium/src/+/main:docs/graphics/)
- [GPU Process Architecture](https://source.chromium.org/chromium/chromium/src/+/main:docs/design/gpu_process_architecture.md)
- [Compositor Thread Architecture](./render-pipeline.md)
- [Browser Process Model](./process-model.md)
- [Memory Management](https://source.chromium.org/chromium/chromium/src/+/main:docs/memory/)
- [Performance Best Practices](https://web.dev/rendering-performance/)

---

**Document History**: Updated for Chromium v134+ with modern GPU pipeline, VRR support, WebGPU integration, and enhanced debugging capabilities.

**Last Updated**: December 2024 (Chromium v134+)  
**Status**: Active development and optimization
