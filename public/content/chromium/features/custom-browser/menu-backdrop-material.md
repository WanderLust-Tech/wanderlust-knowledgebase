# Menu Backdrop Material (Windows 11 Acrylic)

Applies the same DWM "transient window" backdrop material native Windows 11
flyouts and right-click menus use to the browser's own Views-based popup
context menus — a translucent, blurred material showing through behind the
menu rather than a flat opaque background. Added v1.9.15 (2026-09-10).
Inspired by looking at the third-party TranslucentFlyouts project, but
reimplemented natively against Chromium's own source rather than via its
API-hooking approach, since this fork owns the code directly.

---

## Where to find it

Settings → Appearance → "Window effects" → **"Modern acrylic material for
context menus"**.

**Pref:** `custom.menu_backdrop_material.enabled` (bool, default `false`).
This is a **local-state** pref (applies to every profile on the machine,
not per-profile/synced) — `ChromeViewsDelegate`/`MenuHost` have no reliable
path back to a specific `Profile`, so it's exposed via dedicated
`customGetMenuBackdropMaterialEnabled`/`customSetMenuBackdropMaterialEnabled`
WebUI messages rather than the generic `usePref()` protocol (same pattern
as the existing UA global compatibility mode).

Requires **Windows 11 22H2 or later** (build 22621+, where
`DWMWA_SYSTEMBACKDROP_TYPE` exists). No-ops cleanly on older Windows and on
non-Windows platforms — the toggle still shows and can be turned on, it
just has no visible effect.

---

## How it works

Getting a visible effect required two separate things working together,
not just one DWM call:

1. **The DWM call itself** — `ApplyMenuBackdropMaterial(HWND)` calls
   `::DwmSetWindowAttribute(hwnd, DWMWA_SYSTEMBACKDROP_TYPE, ...)` with
   `DWMSBT_TRANSIENTWINDOW`, the material Windows' own flyouts/context
   menus use (distinct from `DWMSBT_MAINWINDOW`/`DWMSBT_TABBEDWINDOW` —
   Mica — which this fork's vanilla `browser_frame_view_win.cc` already
   applies to the main browser window). This alone had **no visible
   effect** the first time it was implemented: `DwmSetWindowAttribute`'s
   backdrop material only composites behind *unpainted/translucent*
   pixels, and Chromium's menu background paints fully opaque by default —
   there was nothing for the material to show through.
2. **A translucent background paint** — the actual fix: when the feature
   is active, the menu's background color is resolved via the
   `ColorProvider` and repainted at ~92% opacity (`SkColorSetA`) instead of
   fully opaque, letting the DWM material show through subtly — matching
   how real Windows 11 context menus look (a tinted overlay atop blurred
   content, not literally see-through).

**Where the HWND actually comes from:** `MenuHost` (a `views::Widget`
subclass, `ui/views/controls/menu/menu_host.cc`) gets a real, top-level
native HWND on Windows because `ChromeViewsDelegate::CreateNativeWidget()`
(`chrome/browser/ui/views/chrome_views_delegate_win.cc`) routes
`TYPE_MENU`/`TYPE_TOOLTIP` widgets to `DESKTOP_NATIVE_WIDGET_AURA` rather
than a child widget sharing the parent's HWND.

**A genuine layering problem, and how it's solved:** the menu's background
paint code lives in `ui/views/controls/menu/menu_scroll_view_container.cc`
— part of the foundational `ui/views` component, which has no access to
`PrefService`/`g_browser_process` (chrome-level concepts), and in this
fork's component (Debug) build is a **separate DLL** (`ui_views.dll`) from
`chrome.dll` entirely — confirmed via the actual link graph during
development. A naive patch calling chrome-level code directly from
`ui/views` wouldn't even link. The fix: a tiny, dependency-free shared
flag, `custom::menu_backdrop::{Set,Is}Active()`
(`menu_backdrop_state.{h,cc}`), compiled *into* `ui/views` itself (patched
into `ui/views/BUILD.gn`) and marked `VIEWS_EXPORT` so the higher-level
chrome/browser/ui component — which already depends on `ui/views`, the
normal direction — can call into it safely. `ChromeViewsDelegate::
CreateNativeWidget()` refreshes this flag (pref + OS-version check) every
time a menu widget is created, before that same menu's content view builds
its background.

**Getting the actual DWM call timed correctly:** `Widget::Init()` returns
*before* the real native HWND exists. `MaybeApplyMenuBackdropMaterial()`
attaches a one-shot `views::WidgetObserver` to the widget; its
`OnWidgetCreated()` (fired once the HWND genuinely exists) calls
`ApplyMenuBackdropMaterial()` and then detaches/deletes itself.

**Finding the actual code path:** the translucent-background fix initially
landed in `MenuScrollViewContainer::CreateDefaultBorder()` — which turned
out to be dead code for this case. On Windows, `MenuConfig` sets
`use_bubble_border = corner_radius > 0`, and modern Chromium's default
rounded-corner menus mean `corner_radius` is non-zero — so
`HasBubbleBorder()` is true, and `CreateBorder()` actually dispatches to
`CreateBubbleBorder()` instead, which paints the menu's background via a
`BubbleBorder` object, not the plain `Background` the default-border path
uses. The fix was moved there once this was traced through.

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/ui/views/menu_backdrop/menu_backdrop_material_win.h/.cc` | The DWM call, the one-shot `WidgetObserver`, and the pref+OS-version eligibility check |
| `custom/browser/ui/views/menu_backdrop/menu_backdrop_state.h/.cc` | The shared, dependency-free `ui/views`-safe flag (compiled into `ui/views`, not this fork's own sources) |
| `custom/custom_browser_config.gni` | `enable_menu_backdrop_material` declare_arg |
| `custom/buildflags/BUILD.gn` | `ENABLE_MENU_BACKDROP_MATERIAL` buildflag |
| `custom/common/custom_pref_names.h` | `kMenuBackdropMaterialEnabled` |
| `custom/browser/prefs/custom_prefs.cc` | Registers the pref in `RegisterLocalState()`, default `false` |
| `custom/browser/ui/webui/settings/custom_settings_handler.{h,cc}` | `customGet/SetMenuBackdropMaterialEnabled` WebUI messages |
| `custom/components/custom_settings/components/AppearancePage.tsx` | The Settings toggle (`MenuBackdropMaterialSection`) |
| `chrome/browser/ui/views/chrome_views_delegate_win.cc` *(vanilla, patched)* | Refreshes the shared flag and attaches the one-shot observer on every `TYPE_MENU` widget creation |
| `ui/views/controls/menu/menu_scroll_view_container.cc` *(vanilla, patched)* | The translucent background paint, in `CreateBubbleBorder()` |
| `ui/views/BUILD.gn` *(vanilla, patched)* | Compiles `menu_backdrop_state.{h,cc}` into the `views` component |

---

## Known limitations

- Menus only — tooltips use a separate widget/HWND path
  (`ui/views/corewm/tooltip_aura.cc`) not yet wired up, though the same
  approach would apply.
- Not user-configurable beyond on/off — the ~92% opacity level and the
  `DWMSBT_TRANSIENTWINDOW` material choice are fixed constants, not
  exposed as separate settings (matching how the reference extension this
  was inspired by exposed far more granular controls than this
  implementation does).
- Windows-only; the toggle is visible everywhere but only does anything on
  Windows 11 22H2+.
