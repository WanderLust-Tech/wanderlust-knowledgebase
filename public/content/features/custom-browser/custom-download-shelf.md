# Custom Download Shelf Implementation

## Overview

The Custom Browser implements an enhanced download shelf system that extends Chromium's standard download UI with additional functionality and customization options. This implementation provides users with more control over download visibility and management while maintaining compatibility with the standard Chromium download system.

## Key Features

### 1. Custom Download Options Shelf

The implementation adds a secondary download shelf (`DownloadOptionsShelfView`) that provides enhanced download management capabilities:

- **Enhanced UI**: Custom styling and layout for download items
- **Additional Controls**: Extended context menu options for better download management
- **Flexible Positioning**: Positioned above the standard download shelf when both are visible
- **Conditional Display**: Can be toggled independently of the main download shelf

### 2. Extended Context Menu

The download context menu has been enhanced with custom options:

- **Hide Download Item**: `HIDE_DOWNLOAD_ITEM_VIEW` command allows users to hide specific downloads from view
- **Enhanced Labels**: Uses extension-specific string resources for better integration
- **Progressive Display**: Available in both in-progress and finished download states

### 3. Build Flag Integration

The feature is controlled by the `CUSTOM_DOWNLOAD_SHELF` build flag, ensuring clean separation from vanilla Chromium code:

```cpp
#if BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)
// Custom implementation
#endif
```

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────┐
│                 BrowserView                         │
├─────────────────────────────────────────────────────┤
│              Standard Content Area                  │
├─────────────────────────────────────────────────────┤
│          DownloadOptionsShelfView (Custom)          │
├─────────────────────────────────────────────────────┤
│           Standard Download Shelf                   │
└─────────────────────────────────────────────────────┘
```

### Class Hierarchy

```
DownloadOptionsShelf (Abstract Base)
└── DownloadOptionsShelfView (Views Implementation)
    ├── Inherits: views::AccessiblePaneView
    ├── Inherits: views::AnimationDelegateViews  
    └── Inherits: views::MouseWatcherListener
```

### Key Files

#### Core Implementation
- **[src/custom/browser/download/download_options_shelf.h](../src/custom/browser/download/download_options_shelf.h)**: Abstract base class defining the download options shelf interface
- **[src/custom/browser/ui/views/download/download_options_shelf_view.h](../src/custom/browser/ui/views/download/download_options_shelf_view.h)**: Views-based implementation of the custom download shelf
- **[src/custom/browser/ui/views/download/download_options_shelf_view.cc](../src/custom/browser/ui/views/download/download_options_shelf_view.cc)**: Implementation of shelf view with custom rendering and behavior

#### Integration Points
- **[src/chrome/browser/ui/views/frame/browser_view.cc](../src/chrome/browser/ui/views/frame/browser_view.cc)**: Integration with main browser window
- **[src/chrome/browser/ui/views/frame/browser_view_layout.cc](../src/chrome/browser/ui/views/frame/browser_view_layout.cc)**: Layout and positioning logic
- **[src/chrome/browser/download/download_shelf_context_menu.cc](../src/chrome/browser/download/download_shelf_context_menu.cc)**: Extended context menu functionality

#### Supporting Files
- **[src/custom/browser/ui/views/download/download_options_item_view.h](../src/custom/browser/ui/views/download/download_options_item_view.h)**: Individual download item representation in the custom shelf

## Implementation Details

### Layout Integration

The custom download shelf is positioned above the standard download shelf in the browser layout hierarchy:

```cpp
int BrowserViewLayout::LayoutDownloadOptionsShelf(int bottom) {
  if (download_options_shelf_ && download_options_shelf_->GetVisible()) {
    const int height = download_options_shelf_->GetPreferredSize().height();
    download_options_shelf_->SetBounds(vertical_layout_rect_.x(), bottom - height,
                               vertical_layout_rect_.width(), height);
    bottom -= height;
  }
  return bottom;
}
```

### Context Menu Enhancements

The context menu system has been extended with custom commands:

```cpp
// In-progress downloads menu
#if BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)
    in_progress_download_menu_model_->AddItem(
        DownloadCommands::HIDE_DOWNLOAD_ITEM_VIEW, 
        l10n_util::GetStringUTF16(IDS_EXTENSIONS_HIDE_DETAILS));
#endif

// Finished downloads menu  
#if BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)
    finished_download_menu_model_->AddItem(
        DownloadCommands::HIDE_DOWNLOAD_ITEM_VIEW, 
        l10n_util::GetStringUTF16(IDS_EXTENSIONS_HIDE_DETAILS));
#endif
```

### Visibility Management

The custom shelf provides independent visibility control:

```cpp
void BrowserView::SetDownloadOptionsShelfVisible(bool visible) {
  DCHECK(download_options_shelf_);
  browser_->UpdateDownloadOptionsShelfVisibility(visible);
  ToolbarSizeChanged(false);
}

bool BrowserView::IsDownloadOptionsShelfVisible() const {
  return download_options_shelf_ && download_options_shelf_->IsShowing();
}
```

## Build Configuration

### Build Flag Definition

The `CUSTOM_DOWNLOAD_SHELF` build flag controls compilation of custom download shelf features. This flag should be defined in the project's build configuration files.

### Conditional Compilation Areas

The following components are conditionally compiled based on the build flag:

1. **Browser View Integration**: Custom shelf creation and management
2. **Layout System**: Positioning and sizing logic
3. **Context Menu**: Extended menu items and commands
4. **Download Statistics**: Custom metrics and tracking
5. **Preference System**: Download bubble preferences customization

## Usage Patterns

### Developer Integration

To extend the custom download shelf functionality:

1. **Add New Commands**: Extend `DownloadCommands::Command` enum
2. **Update Context Menu**: Modify context menu generation logic
3. **Implement Handlers**: Add command execution logic in `DownloadCommands`
4. **Update UI**: Extend download item view components as needed

### User Interface

The custom download shelf is designed to:
- Automatically show/hide based on download activity
- Provide intuitive controls for download management
- Maintain consistency with Chromium UI patterns
- Support keyboard navigation and accessibility features

## Configuration Options

### Runtime Behavior

- **Auto-hide**: Shelf can automatically hide after download completion
- **Manual Control**: Users can manually show/hide the shelf
- **Integration Mode**: Works alongside or independently of standard download shelf

### Customization Points

- **Styling**: Custom themes and visual appearance
- **Positioning**: Configurable placement within browser window
- **Animation**: Customizable show/hide animations
- **Item Limits**: Configurable maximum number of displayed items

## Testing

### Unit Tests

Custom download shelf components should be tested for:
- Proper initialization and cleanup
- Correct layout calculations
- Context menu functionality
- Visibility state management

### Integration Tests

System integration testing should cover:
- Browser window layout with shelf visible/hidden
- Interaction with standard download system
- Multi-download scenarios
- Window resizing and repositioning

## Compatibility

### Chromium Integration

The custom download shelf implementation:
- Maintains compatibility with standard Chromium download APIs
- Uses established UI frameworks (Views, Animation system)
- Follows Chromium coding standards and patterns
- Supports standard accessibility features

### Platform Support

The implementation is designed to work across Chromium's supported platforms:
- Windows (primary development platform)
- macOS (with platform-specific adaptations)
- Linux (following standard Views implementation patterns)

## Future Enhancements

### Planned Features

- **Extended Download Management**: Additional download manipulation options
- **Enhanced Notifications**: Improved download progress and completion notifications  
- **Customizable Layouts**: User-configurable shelf appearance and behavior
- **Download Categorization**: Grouping and filtering of downloads by type or source

### Extension Points

The architecture supports future extensions through:
- Abstract base class design for alternative implementations
- Build flag system for feature toggling
- Established integration patterns with Chromium systems
- Modular component design for independent feature development

## Troubleshooting

### Common Issues

1. **Shelf Not Visible**: Check `CUSTOM_DOWNLOAD_SHELF` build flag inclusion
2. **Layout Problems**: Verify browser view layout integration
3. **Context Menu Missing**: Ensure proper command registration
4. **Performance Issues**: Review animation and rendering optimizations

### Debug Information

Enable debug logging for download shelf components:
- Browser view layout calculations
- Download shelf visibility state changes
- Context menu construction and command execution
- Animation state transitions

## Related Documentation

- [Chromium Download System](https://chromium.googlesource.com/chromium/src/+/HEAD/chrome/browser/download/README.md)
- [Views UI Framework](https://chromium.googlesource.com/chromium/src/+/HEAD/ui/views/README.md)
- [Build Flag System](../build-system.md)
- [Custom UI Components](custom-ui-components.md)