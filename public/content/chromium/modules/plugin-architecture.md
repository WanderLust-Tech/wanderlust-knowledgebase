# Plugin Architecture and Process Startup

## Table of Contents
1. [Overview](#overview)
2. [Plugin Types and Architecture](#plugin-types-and-architecture)
3. [Plugin Process Modes](#plugin-process-modes)
4. [Multi-Process Architecture](#multi-process-architecture)
5. [Plugin Process Startup Flow](#plugin-process-startup-flow)
6. [HTML Plugin Element Processing](#html-plugin-element-processing)
7. [FrameLoaderClient Integration](#frameloaderclient-integration)
8. [Content Layer Plugin Creation](#content-layer-plugin-creation)
9. [Plugin Module Management](#plugin-module-management)
10. [IPC Communication Architecture](#ipc-communication-architecture)
11. [Browser Process Plugin Handling](#browser-process-plugin-handling)
12. [Plugin Channel Establishment](#plugin-channel-establishment)
13. [In-Process vs Out-of-Process Plugins](#in-process-vs-out-of-process-plugins)
14. [Security and Sandboxing](#security-and-sandboxing)
15. [Related Documentation](#related-documentation)

## Overview

Chromium's plugin architecture provides a sophisticated multi-process system for running browser plugins safely and efficiently. This document provides a comprehensive analysis of the plugin process startup sequence, focusing on PPAPI (Pepper Plugin API) plugins and their integration with Chromium's multi-process architecture.

Browser plugins extend web page functionality and are developed by third parties. Due to security and stability concerns, they run in isolated processes separate from the main Browser and Render processes.

### Plugin vs Extensions

It's important to distinguish between browser plugins and browser extensions:

- **Browser Plugins**: Work at the web page level to extend page functionality (e.g., PDF display, Flash videos)
- **Browser Extensions**: Work at the browser level to extend browser functionality (e.g., toolbar buttons, API access)

## Plugin Types and Architecture

### NPAPI Plugins (Legacy)

**Netscape Plugin API (NPAPI)** represents the legacy plugin standard:

- **Origin**: Defined by Netscape Navigator browser
- **Compatibility**: Cross-platform standard supported by most browsers
- **Issues**: Outdated API design, crash-prone, security vulnerabilities
- **Status**: Chromium dropped NPAPI support starting January 2014

### PPAPI Plugins (Modern)

**Pepper Plugin API (PPAPI)** is Chromium's modern plugin architecture:

- **Purpose**: Address NPAPI limitations with better security and stability
- **Technology**: Uses Native Client (NaCl) for security
- **Language Support**: C/C++ development with compile-time restrictions
- **Communication**: IPC-based communication with web pages
- **Rendering**: Access to browser-provided OpenGL capabilities

### Native Client (NaCl) Security

The PPAPI plugin architecture leverages Native Client technology for enhanced security:

#### Compile-Time Security
- **Toolchain Restrictions**: NaCl compilation tools check and restrict API calls
- **API Validation**: Prohibits illegal API calls at compile time
- **Code Verification**: Ensures only safe native code execution

#### Runtime Security
- **Sandboxed Execution**: Plugins run in restricted processes
- **API Mediation**: Browser-provided APIs through PPAPI interfaces
- **Process Isolation**: Complete separation from Browser and Render processes

## Plugin Process Modes

PPAPI plugins support three execution modes:

### 1. Sandboxed Independent Process
- **Security**: Highest security level with full sandbox restrictions
- **Isolation**: Complete process separation
- **Default Mode**: Standard execution mode for most plugins

### 2. Unrestricted Independent Process
- **Security**: Reduced restrictions for specialized plugins
- **Use Cases**: Plugins requiring broader system access
- **Risk**: Higher security risk but more functionality

### 3. In-Process Execution
- **Location**: Runs directly within Render process
- **Performance**: Fastest execution with no IPC overhead
- **Usage**: Internal plugins or command-line specified plugins
- **Control**: Enabled via `--ppapi-in-process` command line argument

## Multi-Process Architecture

### Process Relationships

The plugin architecture involves three core process types:

```
[Browser Process] ←→ [Plugin Process] ←→ [Render Process]
       ↑                     ↑                   ↑
   PpapiPluginProcessHost  ChildProcess    HTMLPlugInElement
```

#### Browser Process Role
- **Process Management**: Creates and manages plugin processes
- **Resource Control**: Manages plugin lifecycle and resources
- **IPC Coordination**: Coordinates communication between processes
- **Security Enforcement**: Applies sandbox policies

#### Plugin Process Role
- **Plugin Execution**: Hosts actual plugin code execution
- **Native Code**: Runs C/C++ plugin modules under NaCl restrictions
- **IPC Communication**: Communicates with both Browser and Render processes
- **Resource Management**: Manages plugin-specific resources

#### Render Process Role
- **HTML Integration**: Processes `<embed>` tags in web pages
- **Plugin Instances**: Creates and manages plugin instance proxies
- **DOM Integration**: Integrates plugin content with page DOM
- **Event Handling**: Routes user events to plugin instances

## Plugin Process Startup Flow

### High-Level Startup Sequence

1. **HTML Parsing**: Render process encounters `<embed>` tag
2. **Plugin Request**: Render process requests plugin creation from Browser process
3. **Process Creation**: Browser process creates new plugin process
4. **Channel Establishment**: Plugin and Render processes establish IPC channels
5. **Plugin Initialization**: Plugin instance is created and initialized

### Detailed Startup Process

```cpp
// 1. HTML Plugin Element Processing
HTMLPlugInElement::loadPlugin()
  ↓
// 2. Frame Loader Integration  
FrameLoaderClientImpl::createPlugin()
  ↓
// 3. Content Layer Processing
RenderFrameImpl::createPlugin()
  ↓
// 4. Plugin Module Creation
PluginModule::Create()
  ↓
// 5. Browser Process Communication
ViewHostMsg_OpenChannelToPepperPlugin
  ↓
// 6. Plugin Process Creation
PpapiPluginProcessHost::Init()
```

## HTML Plugin Element Processing

### HTMLPlugInElement::loadPlugin()

The plugin startup process begins when the Render process encounters an `<embed>` tag:

```cpp
bool HTMLPlugInElement::loadPlugin(const KURL& url, const String& mimeType, 
                                   const Vector<String>& paramNames, 
                                   const Vector<String>& paramValues, 
                                   bool useFallback, bool requireRenderer) {
    LocalFrame* frame = document().frame();
    
    RefPtr<Widget> widget = m_persistedPluginWidget;
    if (!widget) {
        // Create new plugin instance
        widget = frame->loader().client()->createPlugin(this, url, paramNames, 
                                                       paramValues, mimeType, 
                                                       loadManually, policy);
    }
    
    return true;
}
```

**Key Components:**
- **HTMLPlugInElement**: Represents `<embed>` tag in DOM
- **m_persistedPluginWidget**: Caches existing plugin instances
- **LocalFrame**: Represents the web page frame containing the plugin
- **FrameLoader**: Handles frame loading operations

## FrameLoaderClient Integration

### Platform Abstraction Layer

The **FrameLoaderClientImpl** class provides platform-specific operations for WebKit:

```cpp
PassRefPtr<Widget> FrameLoaderClientImpl::createPlugin(
    HTMLPlugInElement* element, const KURL& url,
    const Vector<String>& paramNames, const Vector<String>& paramValues,
    const String& mimeType, bool loadManually, DetachedPluginPolicy policy) {
    
    // Request plugin creation from Content layer
    WebPlugin* webPlugin = m_webFrame->client()->createPlugin(m_webFrame, params);
    
    // Create plugin container
    RefPtr<WebPluginContainerImpl> container = 
        WebPluginContainerImpl::create(element, webPlugin);
        
    // Initialize plugin
    if (!webPlugin->initialize(container.get()))
        return nullptr;
        
    return container;
}
```

**Architecture Integration:**
- **WebKit Layer**: Handles HTML parsing and DOM integration
- **Content Layer**: Provides multi-process architecture
- **Browser Layer**: Implements browser-specific functionality

## Content Layer Plugin Creation

### RenderFrameImpl::createPlugin()

The Content layer handles the actual plugin creation and process coordination:

```cpp
blink::WebPlugin* RenderFrameImpl::createPlugin(
    blink::WebLocalFrame* frame, const blink::WebPluginParams& params) {
    
    // Check for browser layer override
    blink::WebPlugin* plugin = NULL;
    if (GetContentClient()->renderer()->OverrideCreatePlugin(
        this, frame, params, &plugin)) {
        return plugin;
    }
    
    // Handle Browser Plugin
    if (base::UTF16ToASCII(params.mimeType) == kBrowserPluginMimeType) {
        return render_view_->GetBrowserPluginManager()->CreateBrowserPlugin(
            render_view_.get(), frame, false);
    }
    
    // Query Browser process for plugin info
    WebPluginInfo info;
    Send(new FrameHostMsg_GetPluginInfo(routing_id_, params.url, 
         frame->top()->document().url(), params.mimeType.utf8(), 
         &found, &info, &mime_type));
         
    if (!found) return NULL;
    
    return CreatePlugin(frame, info, params_to_use);
}
```

**Key Decision Points:**
1. **Browser Layer Override**: Check if browser implements custom plugin handling
2. **Browser Plugin Detection**: Handle iframe-like browser plugins
3. **Plugin Discovery**: Query Browser process for installed plugins
4. **Plugin Creation**: Create appropriate plugin instance

### Content Client Architecture

Chromium's layered architecture allows browser customization through Content Clients:

- **Browser Content Client**: Customizes Browser process behavior
- **Renderer Content Client**: Customizes Render process behavior
- **Plugin Override**: Browsers can implement custom plugin handling

## Plugin Module Management

### PluginModule System

The **PluginModule** class manages plugin instances and their lifecycle:

```cpp
scoped_refptr<PluginModule> PluginModule::Create(
    RenderFrameImpl* render_frame, const WebPluginInfo& webplugin_info,
    bool* pepper_plugin_was_registered) {
    
    *pepper_plugin_was_registered = true;
    base::FilePath path(webplugin_info.path);
    
    // Check for existing module
    scoped_refptr<PluginModule> module = 
        PepperPluginRegistry::GetInstance()->GetLiveModule(path);
    
    if (module.get()) {
        if (!module->renderer_ppapi_host()) {
            CreateHostForInProcessModule(render_frame, module.get(), webplugin_info);
        }
        return module;
    }
    
    // Get plugin info
    const PepperPluginInfo* info = 
        PepperPluginRegistry::GetInstance()->GetInfoForPlugin(webplugin_info);
    
    if (!info) {
        *pepper_plugin_was_registered = false;
        return scoped_refptr<PluginModule>();
    }
    
    // Create out-of-process module
    if (info->is_out_of_process) {
        // Request plugin channel from Browser process
        render_frame->Send(new ViewHostMsg_OpenChannelToPepperPlugin(
            path, &channel_handle, &peer_pid, &plugin_child_id));
    }
    
    return module;
}
```

### PepperPluginRegistry

The **PepperPluginRegistry** singleton manages all plugin modules in the Render process:

- **Module Tracking**: Maintains registry of active plugin modules
- **Shared Instances**: Multiple plugin instances can share the same module
- **Lifecycle Management**: Handles module creation and cleanup
- **Path-Based Indexing**: Uses file paths as unique module identifiers

## IPC Communication Architecture

### Plugin Channel Creation

Plugin processes communicate with Render processes through dedicated **Plugin Channels**:

#### Channel Establishment Process

1. **Channel Request**: Render process requests plugin channel from Browser process
2. **Socket Creation**: Plugin process creates UNIX socket
3. **Handle Distribution**: Browser process distributes socket handles
4. **Dispatcher Creation**: Both processes create IPC dispatchers

#### Channel Components

```cpp
// Plugin Process (Server Side)
HostDispatcher* host_dispatcher = new HostDispatcher(
    plugin_module, socket_server_handle, permissions);

// Render Process (Client Side)  
PluginDispatcher* plugin_dispatcher = new PluginDispatcher(
    socket_client_handle, permissions);
```

### IPC Message Types

#### ViewHostMsg_OpenChannelToPepperPlugin
- **Direction**: Render → Browser
- **Purpose**: Request plugin channel creation
- **Response**: Channel handle, process ID, child ID

#### Plugin Channel Messages
- **PPB Interface Calls**: Browser-to-plugin API invocations
- **PPI Interface Calls**: Plugin-to-browser API invocations
- **Resource Management**: Handle plugin resource lifecycle

## Browser Process Plugin Handling

### PpapiPluginProcessHost

The Browser process manages plugin processes through **PpapiPluginProcessHost**:

```cpp
class PpapiPluginProcessHost : public BrowserChildProcessHostImpl {
    // Plugin process lifecycle management
    bool Init(const PepperPluginInfo& info, bool is_broker);
    
    // IPC channel management
    void OnProcessLaunched() override;
    void OnChannelOpened(const IPC::ChannelHandle& channel_handle);
    
    // Plugin communication
    void OpenChannelToPlugin(RenderFrameHost* render_frame_host,
                           const base::FilePath& path,
                           const OpenChannelCallback& callback);
};
```

**Responsibilities:**
- **Process Creation**: Launches and manages plugin process
- **Channel Coordination**: Establishes IPC channels between processes
- **Resource Management**: Manages plugin process resources
- **Security Enforcement**: Applies sandbox policies

### Plugin Process Lifecycle

1. **Process Launch**: Browser creates plugin process using ChildProcessLauncher
2. **IPC Establishment**: Plugin process connects to Browser via IPC channel
3. **Channel Creation**: Browser requests plugin to create Render communication channel
4. **Ready State**: Plugin process ready to handle plugin instances

## Plugin Channel Establishment

### UNIX Socket Communication

Plugin channels use UNIX sockets for high-performance IPC:

#### Socket Creation Process

```cpp
// 1. Plugin process creates socket pair
int socket_pair[2];
socketpair(AF_UNIX, SOCK_STREAM, 0, socket_pair);

// 2. Server handle stays in plugin process
IPC::ChannelHandle server_handle(socket_pair[0]);

// 3. Client handle sent to render process  
IPC::ChannelHandle client_handle(socket_pair[1]);
```

#### Dispatcher Architecture

**Plugin Process - HostDispatcher:**
```cpp
class HostDispatcher : public Dispatcher {
    // Handles messages from render process
    // Dispatches to plugin instance
    // Manages plugin resources
};
```

**Render Process - PluginDispatcher:**
```cpp
class PluginDispatcher : public Dispatcher {
    // Sends messages to plugin process
    // Handles plugin responses
    // Manages render-side plugin proxy
};
```

## In-Process vs Out-of-Process Plugins

### In-Process Plugin Configuration

```cpp
void CreateHostForInProcessModule(RenderFrameImpl* render_frame,
                                PluginModule* module,
                                const WebPluginInfo& webplugin_info) {
    ppapi::PpapiPermissions perms = /* get permissions */;
    RendererPpapiHostImpl* host_impl = 
        RendererPpapiHostImpl::CreateOnModuleForInProcess(module, perms);
}
```

**Characteristics:**
- **Performance**: No IPC overhead
- **Security**: Reduced isolation
- **Use Cases**: Trusted internal plugins
- **Communication**: Direct function calls

### Out-of-Process Plugin Configuration

```cpp
bool PluginModule::CreateOutOfProcessModule(RenderFrameImpl* render_frame,
                                          const base::FilePath& path,
                                          ppapi::PpapiPermissions permissions,
                                          const IPC::ChannelHandle& channel_handle,
                                          base::ProcessId peer_pid,
                                          int plugin_child_id,
                                          bool is_external) {
    // Create plugin hung detector
    scoped_refptr<PepperHungPluginFilter> hung_filter = 
        new PepperHungPluginFilter(path, render_frame->GetRoutingID(), 
                                 plugin_child_id);
    
    // Create renderer PPAPI host
    scoped_ptr<RendererPpapiHostImpl> renderer_ppapi_host = 
        RendererPpapiHostImpl::CreateOnModuleForOutOfProcess(
            this, permissions, channel_handle, peer_pid, hung_filter);
            
    return true;
}
```

**Characteristics:**
- **Security**: Full process isolation
- **Stability**: Plugin crashes don't affect browser
- **Communication**: IPC-based message passing
- **Overhead**: Higher memory and performance cost

## Security and Sandboxing

### Multi-Layer Security Model

#### 1. Compile-Time Security (Native Client)
- **API Restrictions**: NaCl toolchain prevents dangerous API calls
- **Code Verification**: Compile-time analysis ensures code safety
- **ABI Compliance**: Enforces safe calling conventions

#### 2. Runtime Security (Process Sandbox)
- **Process Isolation**: Plugins run in separate sandboxed processes
- **System API Mediation**: All system calls go through browser APIs
- **Resource Restrictions**: Limited access to system resources

#### 3. Communication Security (IPC)
- **Message Validation**: All IPC messages are validated
- **Capability-Based**: Only authorized operations allowed
- **Resource Tracking**: Browser tracks all plugin resources

### Sandbox Implementation

```cpp
// Plugin process sandbox configuration
SandboxType GetSandboxType() override {
    return SANDBOX_TYPE_PPAPI;
}

void SetupSandbox() {
    // Configure process restrictions
    // Limit system call access
    // Restrict file system access
    // Limit network capabilities
}
```

## Related Documentation

### Architecture Documents
- [Process Model](../architecture/process-model.md) - Chromium's multi-process architecture
- [IPC Internals](../architecture/ipc-internals.md) - Inter-process communication mechanisms  
- [Security Model](../security/security-model.md) - Chromium security architecture

### Module Documents
- [Plugin 3D Rendering](plugin-3d-rendering.md) - 3D rendering through plugins
- [JavaScript V8](javascript-v8.md) - JavaScript engine integration
- [Networking HTTP](networking-http.md) - Network stack architecture

### Implementation References
- **HTMLPlugInElement**: `third_party/WebKit/Source/core/html/HTMLPlugInElement.cpp`
- **FrameLoaderClientImpl**: `third_party/WebKit/Source/web/FrameLoaderClientImpl.cpp`
- **RenderFrameImpl**: `content/renderer/render_frame_impl.cc`
- **PluginModule**: `content/renderer/pepper/plugin_module.cc`
- **PpapiPluginProcessHost**: `content/browser/ppapi_plugin_process_host.cc`

### External Resources
- [Pepper Plugin API Documentation](https://developer.chrome.com/docs/native-client/pepper_stable/)
- [Native Client Developer Guide](https://developer.chrome.com/docs/native-client/)
- [Chromium Multi-Process Architecture](https://www.chromium.org/developers/design-documents/multi-process-architecture/)