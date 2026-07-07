---
title: "Custom Download Shelf"
description: "Replaces Chrome's default download bubble with a bottom shelf UI offering extended download commands, zero-delay transient downloads, and a per-profile preference to revert to the bubble."
category: "Features"
tags: ["download", "ui", "views", "buildflag", "custom-download-shelf"]
difficulty: "advanced"
date: "2026-07-02"
author: "Wanderlust Team"
estimated_reading_time: "10 minutes"
---

# Custom Download Shelf

Gated by `BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)`. Replaces Chrome's default download
bubble with a bottom shelf-style UI that shows active and recent downloads, with
extended commands (hide, delete from list, delete file) and a zero-delay
transient-download appearance. A per-profile preference
(`custom.enable_download_bubble`) lets users revert to the bubble at runtime.

## Build / activation

| Where | What |
|---|---|
| [`custom_browser_config.gni`](../src/custom/custom_browser_config.gni) | `custom_download_shelf = true` — gates source compilation |
| [`buildflags/BUILD.gn`](../src/custom/buildflags/BUILD.gn) | Emits `BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)` via `custom_features_buildflags.h` |
| [`browser/sources.gni`](../src/custom/browser/sources.gni) | Adds `download/download_options_item_model.{cc,h}` and `download/download_options_shelf.{cc,h}` |
| [`browser/ui/sources.gni`](../src/custom/browser/ui/sources.gni) | Adds `views/download/download_options_{item,shelf}_view.{cc,h}` |
| [`browser/prefs/custom_prefs.cc`](../src/custom/browser/prefs/custom_prefs.cc) | Registers `custom.enable_download_bubble` (default `false`) |

## Architecture

```
Download event (DownloadItem*)
   │
   ▼
DownloadOptionsShelf  (abstract, src/custom/browser/download/)
   │  GetTransientDownloadShowDelay() → 0 s  (vs upstream 2 s)
   │  AddDownload() / Open() / Close() / Hide() / Unhide()
   │
   ▼
DownloadOptionsShelfView  (views::AccessiblePaneView, src/custom/browser/ui/views/download/)
   │  Manages a list of DownloadOptionsItemView widgets
   │  Slide animation for show/hide (gfx::SlideAnimation)
   │  "Show All Downloads" + close buttons
   │
   └── DownloadOptionsItemView  (per download)
         Shows progress, file icon, filename, status text
         Context menu: open, pause/resume, cancel, hide, delete from list, delete file
         Driven by DownloadOptionsItemModel

DownloadOptionsItemModel  (DownloadUIModel implementation)
   Tracks DownloadItem* state
   Supports custom commands:
     HIDE_DOWNLOAD_ITEM_VIEW  — marks item hidden in this session
     DELETE_LIST              — removes from download history
     DELETE_FILE              — removes file from disk + history
```

### Class hierarchy

```
DownloadOptionsShelf (Abstract Base)
└── DownloadOptionsShelfView (Views Implementation)
    ├── Inherits: views::AccessiblePaneView
    ├── Inherits: views::AnimationDelegateViews
    └── Inherits: views::MouseWatcherListener
```

## Custom download commands

Three commands are added to `DownloadCommands::Command` when
`CUSTOM_DOWNLOAD_SHELF` is enabled:

| Enum value | ID | Behaviour |
|---|---|---|
| `HIDE_DOWNLOAD_ITEM_VIEW` | 23 | Hides this item from the shelf for this session |
| `DELETE_LIST` | 24 | Removes the download entry from history (keeps file) |
| `DELETE_FILE` | 25 | Deletes the file from disk and removes from history |

These are wired through `DownloadUIModel`, `DownloadItemModel`, and the shelf's
context menu.

## Download bubble interop

The patched `download_bubble_prefs.cc` adds a profile-aware overload:

```cpp
// Returns false → show custom shelf; true → show Chrome's bubble.
bool IsDownloadBubbleEnabled(Profile* profile);
```

When `custom.enable_download_bubble` is **false** (the default), the custom
shelf is used exclusively. When **true**, Chrome's built-in download bubble
takes over and the shelf is not shown.

Call sites patched to use the profile-aware overload:

| File | Change |
|---|---|
| `download_ui_controller.cc` | Chooses shelf vs bubble per profile |
| `chrome_download_manager_delegate.cc` | Skips ephemeral-warning scheduling when shelf is active |
| `downloads_api.cc` | Extension downloads API uses profile-aware check |

## Preferences

| Pref key | Type | Default | Description |
|---|---|---|---|
| `custom.enable_download_bubble` | bool | `false` | `true` → use Chrome's bubble; `false` → use custom shelf |
| `download.shelf_invisible` | bool | `false` | Hide the shelf bar itself (downloads still tracked) |
| `toolbar.show_download_button` | bool | — | Show/hide the download toolbar button |

Prefs are registered in [`custom_prefs.cc`](../src/custom/browser/prefs/custom_prefs.cc)
under `#if BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)`. Constants live in
[`custom_pref_names.h`](../src/custom/common/custom_pref_names.h).

## Settings page

The toggle is in the custom browser **Others** settings section
(`chrome://settings/customOthers`):

| Control | Pref | Effect |
|---|---|---|
| "Use Chrome's download bubble instead of the custom download shelf" | `custom.enable_download_bubble` | Switches UI mode; takes effect on next download |
| "Invisible download bar" | `download.shelf_invisible` | Hides the shelf visually while keeping tracking active |
| "Show download button" | `toolbar.show_download_button` | Toolbar icon visibility |

## Toolbar button

[`custom_download_button.{cc,h}`](../src/custom/browser/ui/views/toolbar/custom_download_button.cc)
adds a `ToolbarButton` wired to `IDC_SHOW_DOWNLOADS` with the
`kDownloadToolbarButtonIcon` vector icon. It is shown/hidden based on the
`toolbar.show_download_button` pref and is placed in the toolbar by the patched
`toolbar_view.cc`.

## Animation behaviour

When `CUSTOM_DOWNLOAD_SHELF` is enabled, `scroll_offset_animation_curve.cc` is
patched to use `kEaseInOut` instead of `kLinear` for scroll animations, giving
the shelf slide a smoother feel.

## Patched upstream files

| Upstream file | Nature of patch |
|---|---|
| `download_commands.h` | Adds `HIDE_DOWNLOAD_ITEM_VIEW`, `DELETE_LIST`, `DELETE_FILE` enum values |
| `download_ui_model.h/cc` | Hooks for new commands |
| `download_item_model.cc` | `IsCommandEnabled` / `ExecuteCommand` for new commands |
| `download_shelf_context_menu.cc` | Context menu entries for new commands |
| `download_stats.h/cc` | Tracking enums for new command usage |
| `download_bubble_prefs.h/cc` | Profile-aware `IsDownloadBubbleEnabled(Profile*)` |
| `chrome_download_manager_delegate.h/cc` | Ephemeral-warning short-circuit |
| `download_ui_controller.cc` | Shelf vs bubble routing |
| `downloads_api.cc` | Extension API profile-aware bubble check |
| `toolbar_view.h/cc` | Injects `CustomDownloadButton`; `OnShowDownloadButtonChanged()` |
| `browser_view.h/cc` | Frame-level shelf integration |
| `scroll_offset_animation_curve.cc` | `kEaseInOut` animation |

## File map

| File | Purpose |
|---|---|
| [`browser/download/download_options_shelf.{cc,h}`](../src/custom/browser/download/download_options_shelf.h) | Abstract shelf base; zero-delay transient downloads |
| [`browser/download/download_options_item_model.{cc,h}`](../src/custom/browser/download/download_options_item_model.h) | Per-download UI model with custom commands |
| [`browser/ui/views/download/download_options_shelf_view.{cc,h}`](../src/custom/browser/ui/views/download/download_options_shelf_view.h) | Main shelf view with animation |
| [`browser/ui/views/download/download_options_item_view.{cc,h}`](../src/custom/browser/ui/views/download/download_options_item_view.h) | Per-item widget with progress, icons, context menu |
| [`browser/ui/views/toolbar/custom_download_button.{cc,h}`](../src/custom/browser/ui/views/toolbar/custom_download_button.h) | Toolbar button → `IDC_SHOW_DOWNLOADS` |
| [`common/custom_pref_names.h`](../src/custom/common/custom_pref_names.h) | `kCustomEnableDownloadBubble`, `kDownloadShelfInvisible`, `kToolbarShowDownloadButton` constants |
| [`browser/resources/settings/others_page/`](../src/custom/browser/resources/settings/others_page/) | Polymer settings UI |
| [`app/generated_resources.grdp`](../src/custom/app/generated_resources.grdp) | `IDS_DOWNLOAD_*` string resources |
