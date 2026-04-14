---
created: 2022-08-03T12:07:46 (UTC -05:00)
tags: []
source: https://developer.chrome.com/docs/extensions/reference/app_window/#type-ContentBounds
author: 
---

# chrome.app.window - Chrome Developers

> ## Excerpt
> Build the next generation of web experiences.

---
This API is part of the deprecated Chrome Apps platform. Learn more about [migrating your app](https://developer.chrome.com/docs/apps/migration/).

-   Description
    
    Use the `chrome.app.window` API to create windows. Windows have an optional frame with title bar and size controls. They are not associated with any Chrome browser windows. See the [Window State Sample](https://github.com/GoogleChrome/chrome-app-samples/tree/master/samples/window-state) for a demonstration of these options.
    

## Summary

-   Types
    
-   Methods
    
-   Events
    

## Types

### AppWindow

#### Properties

-   The JavaScript 'window' object for the created child.
    
-   The id the window was created with.
    
-   The position, size and constraints of the window's content, which does not include window decorations. This property is new in Chrome 36.
    
-   The position, size and constraints of the window, which includes window decorations, such as the title bar and frame. This property is new in Chrome 36.
    
-   Clear attention to the window.
    
    The `clearAttention` function looks like: `() => {...}`
    
-   Close the window.
    
    The `close` function looks like: `() => {...}`
    
-   Draw attention to the window.
    
    The `drawAttention` function looks like: `() => {...}`
    
-   Focus the window.
    
    The `focus` function looks like: `() => {...}`
    
-   Fullscreens the window.
    
    The user will be able to restore the window by pressing ESC. An application can prevent the fullscreen state to be left when ESC is pressed by requesting the `app.window.fullscreen.overrideEsc` permission and canceling the event by calling .preventDefault(), in the keydown and keyup handlers, like this:
    
    `window.onkeydown = window.onkeyup = function(e) { if (e.keyCode == 27 /* ESC *\/) { e.preventDefault(); } };`
    
    Note `window.fullscreen()` will cause the entire window to become fullscreen and does not require a user gesture. The HTML5 fullscreen API can also be used to enter fullscreen mode (see [Web APIs](https://developer.chrome.com/docs/apps/api_other) for more details).
    
    The `fullscreen` function looks like: `() => {...}`
    
-   Use innerBounds or outerBounds.
    
    Get the window's inner bounds as a [`ContentBounds`](https://developer.chrome.com/docs/extensions/reference/app_window/#type-ContentBounds) object.
    
    The `getBounds` function looks like: `() => {...}`
    
-   Hide the window. Does nothing if the window is already hidden.
    
    The `hide` function looks like: `() => {...}`
    
-   Is the window always on top?
    
    The `isAlwaysOnTop` function looks like: `() => {...}`
    
-   Is the window fullscreen? This will be true if the window has been created fullscreen or was made fullscreen via the `AppWindow` or HTML5 fullscreen APIs.
    
    The `isFullscreen` function looks like: `() => {...}`
    
-   Is the window maximized?
    
    The `isMaximized` function looks like: `() => {...}`
    
-   Is the window minimized?
    
    The `isMinimized` function looks like: `() => {...}`
    
-   Maximize the window.
    
    The `maximize` function looks like: `() => {...}`
    
-   Minimize the window.
    
    The `minimize` function looks like: `() => {...}`
    
-   Deprecated since Chrome 43
    
    Use outerBounds.
    
    Move the window to the position (`left`, `top`).
    
    The `moveTo` function looks like: `(left: number, top: number) => {...}`
    
-   Deprecated since Chrome 43
    
    Use outerBounds.
    
    Resize the window to `width`x`height` pixels in size.
    
    The `resizeTo` function looks like: `(width: number, height: number) => {...}`
    
-   Restore the window, exiting a maximized, minimized, or fullscreen state.
    
    The `restore` function looks like: `() => {...}`
    
-   Set whether the window should stay above most other windows. Requires the `alwaysOnTopWindows` permission.
    
    The `setAlwaysOnTop` function looks like: `(alwaysOnTop: boolean) => {...}`
    
-   Use innerBounds or outerBounds.
    
    Set the window's inner bounds.
    
    The `setBounds` function looks like: `(bounds: [ContentBounds](https://developer.chrome.com/docs/extensions/reference/app_window/#type-ContentBounds)) => {...}`
    
-   setVisibleOnAllWorkspaces
    
    function
    
    Set whether the window is visible on all workspaces. (Only for platforms that support this).
    
    The `setVisibleOnAllWorkspaces` function looks like: `(alwaysVisible: boolean) => {...}`
    
-   Show the window. Does nothing if the window is already visible. Focus the window if `focused` is set to true or omitted.
    
    The `show` function looks like: `(focused?: boolean) => {...}`
    

### Bounds

#### Properties

-   This property can be used to read or write the current height of the content or window.
    
-   This property can be used to read or write the current X coordinate of the content or window.
    
-   This property can be used to read or write the current maximum height of the content or window. A value of `null` indicates 'unspecified'.
    
-   This property can be used to read or write the current maximum width of the content or window. A value of `null` indicates 'unspecified'.
    
-   This property can be used to read or write the current minimum height of the content or window. A value of `null` indicates 'unspecified'.
    
-   This property can be used to read or write the current minimum width of the content or window. A value of `null` indicates 'unspecified'.
    
-   This property can be used to read or write the current Y coordinate of the content or window.
    
-   This property can be used to read or write the current width of the content or window.
    
-   Set the maximum size constraints of the content or window. The maximum width or height can be set to `null` to remove the constraint. A value of `undefined` will leave a constraint unchanged.
    
    The `setMaximumSize` function looks like: `(maxWidth: number, maxHeight: number) => {...}`
    
-   Set the minimum size constraints of the content or window. The minimum width or height can be set to `null` to remove the constraint. A value of `undefined` will leave a constraint unchanged.
    
    The `setMinimumSize` function looks like: `(minWidth: number, minHeight: number) => {...}`
    
-   Set the left and top position of the content or window.
    
    The `setPosition` function looks like: `(left: number, top: number) => {...}`
    
-   Set the width and height of the content or window.
    
    The `setSize` function looks like: `(width: number, height: number) => {...}`
    

### BoundsSpecification

#### Properties

-   The height of the content or window.
    
-   The X coordinate of the content or window.
    
-   The maximum height of the content or window.
    
-   The maximum width of the content or window.
    
-   The minimum height of the content or window.
    
-   The minimum width of the content or window.
    
-   The Y coordinate of the content or window.
    
-   The width of the content or window.
    

### ContentBounds

#### Properties

### CreateWindowOptions

#### Properties

-   alwaysOnTop
    
    boolean optional
    
    If true, the window will stay above most other windows. If there are multiple windows of this kind, the currently focused window will be in the foreground. Requires the `alwaysOnTopWindows` permission. Defaults to false.
    
    Call `setAlwaysOnTop()` on the window to change this property after creation.
    
-   bounds
    
    [ContentBounds](https://developer.chrome.com/docs/extensions/reference/app_window/#type-ContentBounds) optional
    
    Use innerBounds or outerBounds.
    
    Size and position of the content in the window (excluding the titlebar). If an id is also specified and a window with a matching id has been shown before, the remembered bounds of the window will be used instead.
    
-   If true, the window will be focused when created. Defaults to true.
    
-   frame
    
    string | [FrameOptions](https://developer.chrome.com/docs/extensions/reference/app_window/#type-FrameOptions) optional
    
    Frame type: `none` or `chrome` (defaults to `chrome`). For `none`, the `-webkit-app-region` CSS property can be used to apply draggability to the app's window. `-webkit-app-region: drag` can be used to mark regions draggable. `no-drag` can be used to disable this style on nested elements.
    
    Use of `FrameOptions` is new in M36.
    
-   If true, the window will be created in a hidden state. Call show() on the window to show it once it has been created. Defaults to false.
    
-   URL of the window icon. A window can have its own icon when showInShelf is set to true. The URL should be a global or an extension local URL.
    
-   Id to identify the window. This will be used to remember the size and position of the window and restore that geometry when a window with the same id is later opened. If a window with a given id is created while another window with the same id already exists, the currently opened window will be focused instead of creating a new window.
    
-   innerBounds
    
    [BoundsSpecification](https://developer.chrome.com/docs/extensions/reference/app_window/#type-BoundsSpecification) optional
    
    Used to specify the initial position, initial size and constraints of the window's content (excluding window decorations). If an `id` is also specified and a window with a matching `id` has been shown before, the remembered bounds will be used instead.
    
    Note that the padding between the inner and outer bounds is determined by the OS. Therefore setting the same bounds property for both the `innerBounds` and `outerBounds` will result in an error.
    
    This property is new in Chrome 36.
    
-   Use innerBounds or outerBounds.
    
    Maximum height of the window.
    
-   Use innerBounds or outerBounds.
    
    Maximum width of the window.
    
-   Use innerBounds or outerBounds.
    
    Minimum height of the window.
    
-   Use innerBounds or outerBounds.
    
    Minimum width of the window.
    
-   outerBounds
    
    [BoundsSpecification](https://developer.chrome.com/docs/extensions/reference/app_window/#type-BoundsSpecification) optional
    
    Used to specify the initial position, initial size and constraints of the window (including window decorations such as the title bar and frame). If an `id` is also specified and a window with a matching `id` has been shown before, the remembered bounds will be used instead.
    
    Note that the padding between the inner and outer bounds is determined by the OS. Therefore setting the same bounds property for both the `innerBounds` and `outerBounds` will result in an error.
    
    This property is new in Chrome 36.
    
-   resizable
    
    boolean optional
    
    If true, the window will be resizable by the user. Defaults to true.
    
-   showInShelf
    
    boolean optional
    
    If true, the window will have its own shelf icon. Otherwise the window will be grouped in the shelf with other windows that are associated with the app. Defaults to false. If showInShelf is set to true you need to specify an id for the window.
    
-   singleton
    
    boolean optional
    
    Multiple windows with the same id is no longer supported.
    
    By default if you specify an id for the window, the window will only be created if another window with the same id doesn't already exist. If a window with the same id already exists that window is activated instead. If you do want to create multiple windows with the same id, you can set this property to false.
    
-   The initial state of the window, allowing it to be created already fullscreen, maximized, or minimized. Defaults to 'normal'.
    
-   Chrome 45+ Deprecated since Chrome 69
    
    All app windows use the 'shell' window type
    
    Type of window to create.
    
-   visibleOnAllWorkspaces
    
    boolean optional
    
    If true, and supported by the platform, the window will be visible on all workspaces.
    

### FrameOptions

#### Properties

-   activeColor
    
    string optional
    
    Allows the frame color of the window when active to be set. Frame coloring is only available if the frame type is `chrome`.
    
    Frame coloring is only available if the frame type is `chrome`.
    
    Frame coloring is new in Chrome 36.
    
-   Allows the frame color to be set. Frame coloring is only available if the frame type is `chrome`.
    
    Frame coloring is new in Chrome 36.
    
-   inactiveColor
    
    string optional
    
    Allows the frame color of the window when inactive to be set differently to the active color. Frame coloring is only available if the frame type is `chrome`.
    
    `inactiveColor` must be used in conjunction with `color`.
    
    Frame coloring is new in Chrome 36.
    
-   Frame type: `none` or `chrome` (defaults to `chrome`).
    
    For `none`, the `-webkit-app-region` CSS property can be used to apply draggability to the app's window.
    
    `-webkit-app-region: drag` can be used to mark regions draggable. `no-drag` can be used to disable this style on nested elements.
    

### State

State of a window: normal, fullscreen, maximized, minimized.

#### Type

"normal"

,

"fullscreen"

,

"maximized"

, or

"minimized"

### WindowType

Specifies the type of window to create.

#### Type

## Methods

### canSetVisibleOnAllWorkspaces

`chrome.app.window.canSetVisibleOnAllWorkspaces()`

Whether the current platform supports windows being visible on all workspaces.

#### Returns

### create

`chrome.app.window.create(     url: string,     options?: [CreateWindowOptions](https://developer.chrome.com/docs/extensions/reference/app_window/#type-CreateWindowOptions),     callback?: function,   )`

The size and position of a window can be specified in a number of different ways. The most simple option is not specifying anything at all, in which case a default size and platform dependent position will be used.

To set the position, size and constraints of the window, use the `innerBounds` or `outerBounds` properties. Inner bounds do not include window decorations. Outer bounds include the window's title bar and frame. Note that the padding between the inner and outer bounds is determined by the OS. Therefore setting the same property for both inner and outer bounds is considered an error (for example, setting both `innerBounds.left` and `outerBounds.left`).

To automatically remember the positions of windows you can give them ids. If a window has an id, This id is used to remember the size and position of the window whenever it is moved or resized. This size and position is then used instead of the specified bounds on subsequent opening of a window with the same id. If you need to open a window with an id at a location other than the remembered default, you can create it hidden, move it to the desired location, then show it.

#### Parameters

-   options
    
    [CreateWindowOptions](https://developer.chrome.com/docs/extensions/reference/app_window/#type-CreateWindowOptions) optional
    
-   callback
    
    function optional
    
    The `callback` parameter looks like: `(createdWindow: [AppWindow](https://developer.chrome.com/docs/extensions/reference/app_window/#type-AppWindow)) => void`
    

### current

`chrome.app.window.current()`

Returns an [`AppWindow`](https://developer.chrome.com/docs/extensions/reference/app_window/#type-AppWindow) object for the current script context (ie JavaScript 'window' object). This can also be called on a handle to a script context for another page, for example: otherWindow.chrome.app.window.current().

#### Returns

### get

`chrome.app.window.get(     id: string,   )`

Gets an [`AppWindow`](https://developer.chrome.com/docs/extensions/reference/app_window/#type-AppWindow) with the given id. If no window with the given id exists null is returned. This method is new in Chrome 33.

#### Parameters

#### Returns

### getAll

`chrome.app.window.getAll()`

Gets an array of all currently created app windows. This method is new in Chrome 33.

#### Returns

## Events

### onBoundsChanged

`chrome.app.window.onBoundsChanged.addListener(     callback: function,   )`

Fired when the window is resized.

#### Parameters

-   The `callback` parameter looks like: `() => void`
    

### onClosed

`chrome.app.window.onClosed.addListener(     callback: function,   )`

Fired when the window is closed. Note, this should be listened to from a window other than the window being closed, for example from the background page. This is because the window being closed will be in the process of being torn down when the event is fired, which means not all APIs in the window's script context will be functional.

#### Parameters

-   The `callback` parameter looks like: `() => void`
    

### onFullscreened

`chrome.app.window.onFullscreened.addListener(     callback: function,   )`

Fired when the window is fullscreened (either via the `AppWindow` or HTML5 APIs).

#### Parameters

-   The `callback` parameter looks like: `() => void`
    

### onMaximized

`chrome.app.window.onMaximized.addListener(     callback: function,   )`

Fired when the window is maximized.

#### Parameters

-   The `callback` parameter looks like: `() => void`
    

### onMinimized

`chrome.app.window.onMinimized.addListener(     callback: function,   )`

Fired when the window is minimized.

#### Parameters

-   The `callback` parameter looks like: `() => void`
    

### onRestored

`chrome.app.window.onRestored.addListener(     callback: function,   )`

Fired when the window is restored from being minimized or maximized.

#### Parameters

-   The `callback` parameter looks like: `() => void`
    

Table of contents

-   [Types](https://developer.chrome.com/docs/extensions/reference/app_window/#type)
    -   [AppWindow](https://developer.chrome.com/docs/extensions/reference/app_window/#type-AppWindow)
    -   [Bounds](https://developer.chrome.com/docs/extensions/reference/app_window/#type-Bounds)
    -   [BoundsSpecification](https://developer.chrome.com/docs/extensions/reference/app_window/#type-BoundsSpecification)
    -   [ContentBounds](https://developer.chrome.com/docs/extensions/reference/app_window/#type-ContentBounds)
    -   [CreateWindowOptions](https://developer.chrome.com/docs/extensions/reference/app_window/#type-CreateWindowOptions)
    -   [FrameOptions](https://developer.chrome.com/docs/extensions/reference/app_window/#type-FrameOptions)
    -   [State](https://developer.chrome.com/docs/extensions/reference/app_window/#type-State)
    -   [WindowType](https://developer.chrome.com/docs/extensions/reference/app_window/#type-WindowType)
-   [Methods](https://developer.chrome.com/docs/extensions/reference/app_window/#method)
    -   [canSetVisibleOnAllWorkspaces](https://developer.chrome.com/docs/extensions/reference/app_window/#method-canSetVisibleOnAllWorkspaces)
    -   [create](https://developer.chrome.com/docs/extensions/reference/app_window/#method-create)
    -   [current](https://developer.chrome.com/docs/extensions/reference/app_window/#method-current)
    -   [get](https://developer.chrome.com/docs/extensions/reference/app_window/#method-get)
    -   [getAll](https://developer.chrome.com/docs/extensions/reference/app_window/#method-getAll)
-   [Events](https://developer.chrome.com/docs/extensions/reference/app_window/#event)
    -   [onBoundsChanged](https://developer.chrome.com/docs/extensions/reference/app_window/#event-onBoundsChanged)
    -   [onClosed](https://developer.chrome.com/docs/extensions/reference/app_window/#event-onClosed)
    -   [onFullscreened](https://developer.chrome.com/docs/extensions/reference/app_window/#event-onFullscreened)
    -   [onMaximized](https://developer.chrome.com/docs/extensions/reference/app_window/#event-onMaximized)
    -   [onMinimized](https://developer.chrome.com/docs/extensions/reference/app_window/#event-onMinimized)
    -   [onRestored](https://developer.chrome.com/docs/extensions/reference/app_window/#event-onRestored)
