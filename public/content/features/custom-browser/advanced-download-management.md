# Advanced Download Management

## Overview

The Advanced Download Management system provides enhanced download options, improved shelf management, and comprehensive download controls. This modernizes and extends Chromium's default download functionality with professional-grade features and user experience improvements.

## Architecture

- **Location**: `src/custom/chrome/browser/features/custom_download_manager.*`
- **Pattern**: Singleton with Observer pattern for event-driven architecture
- **Integration**: Chrome's download system, download shelf, and profile preferences

## Features

### Core Capabilities
- ✅ **Enhanced Download Shelf**: Auto-hide functionality and improved visual design
- ✅ **Custom Download Options**: Rich download configuration interface
- ✅ **Advanced Notifications**: Enhanced download progress and completion notifications
- ✅ **Custom Download Paths**: User-configurable download directories per session or globally
- ✅ **Download Item Controls**: Per-download custom settings and metadata

### Download Options
- **Auto-hide Shelf**: Automatically hide download shelf when all downloads complete
- **Show in Shelf**: Control whether downloads appear in the download shelf
- **Enhanced Notifications**: Rich notification system for download events
- **Download Confirmation**: Optional confirmation dialogs before starting downloads
- **Custom Paths**: User-selectable download directories
- **Dangerous Downloads**: Advanced controls for potentially dangerous file handling

## Configuration

### Build-time Configuration (`custom_browser_config.gni`)
```gn
# Advanced Download Management
custom_download_options = true
custom_download_shelf_enhanced = true
```

### Compile-time Defines
```cpp
#define CUSTOM_DOWNLOAD_OPTIONS_ENABLED 1
#define CUSTOM_DOWNLOAD_SHELF_ENHANCED 1
```

## API Reference

### CustomDownloadManager Class

#### Initialization
```cpp
// Get singleton instance
CustomDownloadManager* manager = CustomDownloadManager::GetInstance();

// Initialize (called automatically during browser startup)
manager->Initialize();
```

#### Observer Pattern
```cpp
// Observer interface for download events
class MyDownloadObserver : public CustomDownloadManager::Observer {
public:
  void OnDownloadOptionsRequested(download::DownloadItem* item) override {
    // Handle download options dialog request
  }
  
  void OnDownloadShelfStateChanged(bool visible) override {
    // Handle download shelf visibility changes
  }
  
  void OnDownloadCompleted(download::DownloadItem* item) override {
    // Handle download completion with custom logic
  }
};

// Register observer
MyDownloadObserver* observer = new MyDownloadObserver();
manager->AddObserver(observer);
```

#### Download Options Configuration
```cpp
// Get current download options
const CustomDownloadManager::DownloadOptions& options = manager->GetDownloadOptions();

// Set new download options
CustomDownloadManager::DownloadOptions new_options;
new_options.auto_hide_shelf = true;
new_options.show_notifications = true;
new_options.use_custom_download_path = true;
new_options.custom_download_path = "/path/to/downloads";
manager->SetDownloadOptions(new_options);
```

#### Download Shelf Management
```cpp
// Show/hide download shelf
manager->ShowDownloadShelf(profile, true);  // Show
manager->ShowDownloadShelf(profile, false); // Hide

// Check shelf visibility
bool visible = manager->IsDownloadShelfVisible(profile);

// Toggle shelf visibility
manager->ToggleDownloadShelf(profile);
```

#### Download Item Management
```cpp
// Show download options dialog
manager->ShowDownloadOptionsDialog(download_item, web_contents);

// Handle download completion
manager->HandleDownloadCompletion(download_item);

// Set per-item options
CustomDownloadManager::DownloadOptions item_options;
item_options.show_in_shelf = false;
manager->SetDownloadItemOptions(download_item, item_options);

// Get per-item options
auto options = manager->GetDownloadItemOptions(download_item);
```

### DownloadOptions Structure
```cpp
struct DownloadOptions {
  // Enhanced shelf behavior
  bool auto_hide_shelf = false;
  bool show_in_shelf = true;
  bool show_notifications = true;
  
  // Advanced download controls
  bool allow_dangerous_downloads = false;
  bool confirm_before_download = false;
  bool show_download_options_dialog = false;
  
  // Custom download locations
  bool use_custom_download_path = false;
  std::string custom_download_path;
};
```

## Enhanced Download Shelf Features

### Auto-Hide Functionality
The auto-hide feature automatically hides the download shelf when all downloads complete:

```cpp
void HandleDownloadCompletion(download::DownloadItem* item) {
  if (options_.auto_hide_shelf) {
    Profile* profile = Profile::FromBrowserContext(item->GetBrowserContext());
    if (profile && AllDownloadsComplete(profile)) {
      ShowDownloadShelf(profile, false);
    }
  }
}
```

### Enhanced Visual Design
The enhanced shelf provides:
- **Improved Progress Indicators**: Better visual feedback for download progress
- **Rich Notifications**: Detailed download status with thumbnails and metadata
- **Contextual Actions**: Quick access to download management actions
- **Style Customization**: Branded appearance matching Custom Browser design

## Download Options Dialog

### Dialog Features
The custom download options dialog provides:
- **Download Location Selection**: Browse and select custom download directories
- **File Naming Options**: Custom file naming patterns and collision handling
- **Security Settings**: Enhanced security options for download validation
- **Notification Preferences**: Per-download notification configuration

### Implementation Example
```cpp
void ShowDownloadOptionsDialog(download::DownloadItem* item, 
                               content::WebContents* web_contents) {
  if (!IsAdvancedDownloadEnabled()) {
    return;
  }
  
  // Create custom download options dialog
  auto dialog = std::make_unique<CustomDownloadOptionsDialog>(
      item, web_contents, 
      base::BindOnce(&CustomDownloadManager::OnDownloadOptionsSet,
                     weak_factory_.GetWeakPtr()));
  
  // Show dialog to user
  dialog->Show();
  
  // Notify observers
  for (Observer& observer : observers_) {
    observer.OnDownloadOptionsRequested(item);
  }
}
```

## Integration with Chrome's Download System

### Browser Integration
```cpp
// Integration with BrowserDownloadManagerDelegate
class CustomBrowserDownloadManagerDelegate : public ChromeDownloadManagerDelegate {
public:
  bool ShouldOpenDownload(
      download::DownloadItem* item,
      content::DownloadOpenDelayedCallback callback) override {
    
    CustomDownloadManager* custom_manager = CustomDownloadManager::GetInstance();
    
    if (custom_manager->IsAdvancedDownloadEnabled()) {
      // Apply custom download handling
      custom_manager->HandleDownloadCompletion(item);
    }
    
    return ChromeDownloadManagerDelegate::ShouldOpenDownload(item, callback);
  }
};
```

### Profile Integration  
```cpp
void ApplyOptionsToDownloadManager(Profile* profile) {
  if (!IsAdvancedDownloadEnabled() || !profile) {
    return;
  }
  
  DownloadPrefs* download_prefs = DownloadPrefs::FromDownloadManager(
      profile->GetDownloadManager());
  
  if (download_prefs && options_.use_custom_download_path) {
    base::FilePath custom_path(options_.custom_download_path);
    if (!custom_path.empty()) {
      download_prefs->SetDownloadPath(custom_path);
    }
  }
}
```

## Notification System

### Enhanced Notifications
The custom notification system provides:
- **Rich Progress Updates**: Detailed progress with speed and time estimates
- **Completion Notifications**: Customizable completion notifications with actions
- **Error Notifications**: Enhanced error reporting with recovery suggestions
- **Batch Notifications**: Summary notifications for multiple downloads

### Implementation
```cpp
class CustomDownloadNotificationManager {
public:
  void ShowDownloadProgressNotification(download::DownloadItem* item) {
    if (!options_.show_notifications) {
      return;
    }
    
    // Create rich notification with progress bar
    auto notification = std::make_unique<DownloadProgressNotification>(
        item->GetTargetFilePath().BaseName().value(),
        item->PercentComplete(),
        CalculateDownloadSpeed(item),
        EstimateTimeRemaining(item));
    
    notification_manager_->Display(std::move(notification));
  }
  
  void ShowDownloadCompleteNotification(download::DownloadItem* item) {
    auto notification = std::make_unique<DownloadCompleteNotification>(
        item->GetTargetFilePath().BaseName().value(),
        item->GetTargetFilePath().DirName().value());
    
    // Add action buttons
    notification->AddAction("Open", base::BindOnce(&OpenDownload, item));
    notification->AddAction("Show in Folder", 
                           base::BindOnce(&ShowDownloadInFolder, item));
    
    notification_manager_->Display(std::move(notification));
  }
};
```

## Performance Optimizations

### Efficient State Management
- **Lazy Initialization**: Components initialize only when needed
- **Event-driven Updates**: Observer pattern minimizes unnecessary processing
- **Cached Preferences**: Download preferences cached for performance
- **Asynchronous Operations**: Non-blocking UI operations for download handling

### Memory Management
```cpp
// Efficient download item tracking
class DownloadItemTracker {
private:
  // Use weak pointers to avoid circular references
  std::map<download::DownloadItem*, std::unique_ptr<DownloadMetadata>> metadata_;
  base::WeakPtrFactory<DownloadItemTracker> weak_factory_{this};

public:
  void TrackDownloadItem(download::DownloadItem* item) {
    metadata_[item] = std::make_unique<DownloadMetadata>(item);
    
    // Register for download item destruction
    item->AddObserver(this);
  }
  
  void OnDownloadDestroyed(download::DownloadItem* item) override {
    metadata_.erase(item);
  }
};
```

## Development Workflow

### Testing Download Features
```bash
# Build with enhanced download features
npm run build

# Test download scenarios:
# 1. Start multiple downloads
# 2. Test auto-hide shelf functionality
# 3. Verify custom download paths
# 4. Test notification behavior
# 5. Validate options dialog functionality
```

### Extending Download Options
```cpp
// Add new download option
struct DownloadOptions {
  // Existing options...
  
  // New custom option
  bool enable_download_scanning = true;
  int max_concurrent_downloads = 3;
  std::string download_completion_sound;
};

// Update configuration handling
void SetDownloadOptions(const DownloadOptions& options) {
  options_ = options;
  
  // Apply new options
  ApplyDownloadScanning(options.enable_download_scanning);
  SetMaxConcurrentDownloads(options.max_concurrent_downloads);
  
  SaveOptionsToPreferences();
}
```

## Security Considerations

### Safe Download Handling
- **File Type Validation**: Enhanced validation of download file types
- **Virus Scanning Integration**: Optional integration with antivirus systems
- **Dangerous Download Controls**: Advanced controls for potentially dangerous files
- **Download Source Verification**: Enhanced verification of download sources

### Privacy Protection
- **Download History Management**: Enhanced control over download history retention
- **Temporary File Cleanup**: Automatic cleanup of temporary download files
- **Metadata Scrubbing**: Option to remove metadata from downloaded files

## Migration and Compatibility

### Browser Migration
The system provides migration support for:
- **Chrome Download Settings**: Import existing Chrome download preferences
- **Firefox Download Settings**: Convert Firefox download configurations
- **Edge Download Settings**: Migrate Edge download preferences

### Update Compatibility
- **Settings Migration**: Automatic migration of settings across Custom Browser updates
- **Backward Compatibility**: Support for older download preference formats
- **Profile Migration**: Seamless profile migration with download settings preservation

## Related Components

- **Feature Flag Management**: Controls whether advanced download features are enabled
- **Profile Management**: Per-profile download preferences and settings
- **Notification System**: Rich notification framework for download events
- **File System Integration**: Enhanced file system operations for downloads

## See Also

- [Feature Flag Management System](feature-flag-management.md)
- [Notification System Architecture](../architecture/notifications.md)
- [Profile and Preferences Management](../development-guide/profiles.md)
- [File System Integration](../development-guide/file-system.md)