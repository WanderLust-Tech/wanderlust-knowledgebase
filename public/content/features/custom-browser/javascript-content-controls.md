# JavaScript Content Controls

## Overview

The JavaScript Content Controls system provides enhanced per-page JavaScript management with granular blocking/allowing functionality. This modernizes the original patch's command IDs with full integration into Chromium's content settings system.

## Architecture

- **Location**: `src/custom/chrome/browser/features/custom_javascript_controller.*`
- **Pattern**: Singleton with WebContentsObserver for real-time navigation monitoring
- **Integration**: Chromium's HostContentSettingsMap for persistent settings

## Features

### Core Capabilities
- ✅ **Per-page JavaScript Control**: Block/allow JavaScript on specific URLs or domains
- ✅ **Content Settings Integration**: Uses Chromium's modern content settings system
- ✅ **Browser Command Integration**: Full browser command system support
- ✅ **Real-time Application**: Immediate JavaScript state changes without page reload
- ✅ **Persistent Settings**: Settings persist across browser sessions

### Command Integration
The system provides three browser commands (matching original patch):
- **Command 35080**: Block JavaScript on current page
- **Command 35081**: Use default JavaScript setting  
- **Command 35082**: Allow JavaScript on current page

## Configuration

### Build-time Configuration (`custom_browser_config.gni`)
```gn
# JavaScript Content Control System
custom_javascript_controls = true
```

### Compile-time Defines  
```cpp
#define CUSTOM_JAVASCRIPT_CONTROLS_ENABLED 1
```

### Command ID Definitions
```cpp
enum CommandIds {
  kPageBlockJavaScript = 35080,   // IDC_PAGE_BLOCK_JAVASCRIPT
  kPageDefaultJavaScript = 35081, // IDC_PAGE_DEFAULT_JAVASCRIPT  
  kPageAllowJavaScript = 35082,   // IDC_PAGE_ALLOW_JAVASCRIPT
};
```

## API Reference

### CustomJavaScriptController Class

#### Initialization
```cpp
// Get singleton instance
CustomJavaScriptController* controller = CustomJavaScriptController::GetInstance();

// Initialize (called automatically during browser startup)
controller->Initialize();
```

#### Permission Management
```cpp
// Set JavaScript permission for current page
controller->SetJavaScriptPermissionForPage(web_contents, 
                                            JavaScriptPermission::kBlock);

// Set JavaScript permission for specific URL
GURL url("https://example.com");
controller->SetJavaScriptPermissionForURL(url, profile, 
                                           JavaScriptPermission::kAllow);

// Get current JavaScript permission for URL
JavaScriptPermission permission = 
    controller->GetJavaScriptPermissionForURL(url, profile);
```

#### Command Execution
```cpp
// Execute browser command
bool handled = controller->ExecuteCommand(35080, web_contents); // Block JS

// Check if command is supported
bool supported = controller->IsCommandSupported(35080);

// Get command label for UI
std::u16string label = controller->GetCommandLabel(35080);
// Returns: "Block JavaScript on this page"
```

#### Feature State
```cpp
// Check if JavaScript controls are enabled
bool enabled = controller->IsJavaScriptControlsEnabled();
```

### JavaScript Permission States
```cpp
enum class JavaScriptPermission {
  kDefault = 0,  // Use system default (usually allow)
  kBlock = 1,    // Block JavaScript execution
  kAllow = 2,    // Allow JavaScript execution
};
```

## Integration with Original Patch

### Original Patch Commands
The original patch added these command IDs to `chrome/app/chrome_command_ids.h`:
```cpp
// Original patch approach
#define IDC_PAGE_BLOCK_JAVASCRIPT       35080
#define IDC_PAGE_DEFAULT_JAVASCRIPT     35081  
#define IDC_PAGE_ALLOW_JAVASCRIPT       35082
```

### Modern Implementation  
The modernized approach uses the Custom JavaScript Controller:
```cpp
// Modern command handling
bool BrowserCommandController::ExecuteCommandWithDisposition(
    int id, WindowOpenDisposition disposition, base::TimeTicks time_stamp) {
  
  CustomJavaScriptController* js_controller = 
      CustomJavaScriptController::GetInstance();
      
  if (js_controller->IsCommandSupported(id)) {
    return js_controller->ExecuteCommand(id, GetActiveWebContents());
  }
  
  // Fall back to default command handling
  return ExecuteCommandWithDisposition(id, disposition, time_stamp);
}
```

## Content Settings Integration

### HostContentSettingsMap Usage
The system integrates with Chromium's content settings:
```cpp
void SetJavaScriptPermissionForURL(const GURL& url, Profile* profile, 
                                   JavaScriptPermission permission) {
  HostContentSettingsMap* settings_map = 
      HostContentSettingsMapFactory::GetForProfile(profile);
      
  ContentSetting setting = PermissionToContentSetting(permission);
  
  settings_map->SetContentSettingDefaultScope(
      url, GURL(),
      ContentSettingsType::JAVASCRIPT,
      setting);
}
```

### Permission Conversion
```cpp
ContentSetting PermissionToContentSetting(JavaScriptPermission permission) {
  switch (permission) {
    case JavaScriptPermission::kBlock:
      return CONTENT_SETTING_BLOCK;
    case JavaScriptPermission::kAllow:  
      return CONTENT_SETTING_ALLOW;
    case JavaScriptPermission::kDefault:
    default:
      return CONTENT_SETTING_DEFAULT;
  }
}
```

## WebContentsObserver Integration

### Navigation Monitoring
```cpp
class CustomJavaScriptController : public content::WebContentsObserver {
public:
  void DidFinishNavigation(content::NavigationHandle* navigation_handle) override {
    if (!navigation_handle->IsInMainFrame() || !navigation_handle->HasCommitted()) {
      return;
    }
    
    // Check if this URL has a custom JavaScript setting
    content::WebContents* web_contents = navigation_handle->GetWebContents();
    Profile* profile = Profile::FromBrowserContext(web_contents->GetBrowserContext());
    GURL url = navigation_handle->GetURL();
    
    JavaScriptPermission permission = GetJavaScriptPermissionForURL(url, profile);
    if (permission != JavaScriptPermission::kDefault) {
      ApplyJavaScriptSetting(web_contents, permission);
    }
  }
};
```

## Browser Command Integration

### Command Registration
```cpp
// In chrome_command_ids.h (or custom command registration)
const int IDC_CUSTOM_PAGE_BLOCK_JAVASCRIPT = 35080;
const int IDC_CUSTOM_PAGE_DEFAULT_JAVASCRIPT = 35081;
const int IDC_CUSTOM_PAGE_ALLOW_JAVASCRIPT = 35082;
```

### Menu Integration Example
```cpp
// Example menu item creation
void AddJavaScriptControlsToMenu(ui::SimpleMenuModel* menu_model,
                                 content::WebContents* web_contents) {
  CustomJavaScriptController* controller = 
      CustomJavaScriptController::GetInstance();
      
  if (!controller->IsJavaScriptControlsEnabled()) {
    return;
  }
  
  menu_model->AddSeparator(ui::NORMAL_SEPARATOR);
  menu_model->AddItemWithStringId(IDC_CUSTOM_PAGE_BLOCK_JAVASCRIPT,
                                  IDS_BLOCK_JAVASCRIPT);
  menu_model->AddItemWithStringId(IDC_CUSTOM_PAGE_DEFAULT_JAVASCRIPT,  
                                  IDS_DEFAULT_JAVASCRIPT);
  menu_model->AddItemWithStringId(IDC_CUSTOM_PAGE_ALLOW_JAVASCRIPT,
                                  IDS_ALLOW_JAVASCRIPT);
}
```

## Benefits Over Original Patch

### Modern Content Settings
- **Persistent Storage**: Settings saved to profile preferences
- **Domain/URL Granularity**: Supports both domain and specific URL permissions
- **Standards Compliance**: Uses Chromium's standard content settings system
- **Sync Support**: Can integrate with Chrome Sync for setting synchronization

### Professional Architecture  
- **Observer Pattern**: Real-time navigation monitoring
- **Singleton Management**: Standard Chromium architectural pattern
- **Command Abstraction**: Clean separation between UI commands and logic
- **Extensible Design**: Easy to add new JavaScript control features

### Enhanced Functionality
- **Real-time Application**: Settings apply without page reload
- **Profile Integration**: Per-profile settings support
- **Error Handling**: Comprehensive error handling and validation
- **Logging**: Detailed logging for debugging and monitoring

## User Interface Integration

### Context Menu Integration
```cpp
// Add JavaScript controls to page context menu
void AddJavaScriptControlsToContextMenu(RenderViewContextMenu* menu) {
  CustomJavaScriptController* controller = 
      CustomJavaScriptController::GetInstance();
      
  content::WebContents* web_contents = menu->source_web_contents();
  Profile* profile = menu->GetProfile();
  GURL url = web_contents->GetLastCommittedURL();
  
  JavaScriptPermission current_permission = 
      controller->GetJavaScriptPermissionForURL(url, profile);
      
  // Add menu items based on current state
  if (current_permission != JavaScriptPermission::kBlock) {
    menu->AddMenuItem(IDC_CUSTOM_PAGE_BLOCK_JAVASCRIPT,
                      controller->GetCommandLabel(IDC_CUSTOM_PAGE_BLOCK_JAVASCRIPT));
  }
  
  if (current_permission != JavaScriptPermission::kAllow) {
    menu->AddMenuItem(IDC_CUSTOM_PAGE_ALLOW_JAVASCRIPT,
                      controller->GetCommandLabel(IDC_CUSTOM_PAGE_ALLOW_JAVASCRIPT));
  }
  
  menu->AddMenuItem(IDC_CUSTOM_PAGE_DEFAULT_JAVASCRIPT,
                    controller->GetCommandLabel(IDC_CUSTOM_PAGE_DEFAULT_JAVASCRIPT));
}
```

### Settings Page Integration
The system can be extended to include a settings page interface:
```cpp
// Example settings page integration
class JavaScriptControlsSettingsHandler : public settings::SettingsPageUIHandler {
public:
  void RegisterMessages() override {
    web_ui()->RegisterMessageCallback(
        "getJavaScriptExceptions",
        base::BindRepeating(&JavaScriptControlsSettingsHandler::HandleGetExceptions,
                            base::Unretained(this)));
  }

private:
  void HandleGetExceptions(const base::ListValue* args) {
    // Return list of JavaScript permission exceptions for settings UI
  }
};
```

## Development Workflow

### Testing JavaScript Controls
```bash
# Build with JavaScript controls enabled
npm run build

# Test with test page
# 1. Navigate to a JavaScript-heavy page
# 2. Use context menu to block JavaScript
# 3. Verify JavaScript is blocked immediately
# 4. Test persistence across page reloads
```

### Adding Custom Commands
1. Define new command ID in appropriate header
2. Add command handling to `ExecuteCommand` method
3. Update command label strings
4. Add UI integration points (menus, toolbars, etc.)

## Migration from Original Patch

### Original Approach Problems
- ❌ Only provided command IDs without implementation
- ❌ No integration with content settings system
- ❌ No persistence across browser sessions
- ❌ No real-time application of settings

### Modern Solution Benefits
- ✅ Full implementation with content settings integration
- ✅ Persistent settings stored in profile
- ✅ Real-time application without page reload
- ✅ Professional architecture following Chromium patterns
- ✅ Extensible for future enhancements

## Related Components

- **Feature Flag Management**: Controls whether JavaScript controls are enabled
- **Content Settings System**: Underlying storage and retrieval mechanism
- **Profile Management**: Per-profile JavaScript permission storage
- **Browser Command System**: Command execution and UI integration

## See Also

- [Feature Flag Management System](feature-flag-management.md)
- [Content Settings Architecture](../architecture/content-settings.md)
- [Browser Command Integration](../development-guide/browser-commands.md)
- [Privacy and Security Features](privacy-and-security.md)