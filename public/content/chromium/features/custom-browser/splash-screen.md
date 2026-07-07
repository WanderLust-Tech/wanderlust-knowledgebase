# Splash Screen

A branded startup overlay displayed for 2.5 seconds when the browser launches.
Ported from Timberwolf (AmigaOS Firefox fork) feature #7 — Splash Screen with Startup Progress.

---

## Build flag

Gated by `BUILDFLAG(ENABLE_SPLASH_SCREEN)`. Controlled by `enable_splash_screen = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).

---

## What it does

A frameless 480×280 window is shown immediately after the first browser window opens
(`PostBrowserStart()`). It displays the WanderLust brand name and tagline centred on a
dark background. After 2.5 seconds it fades out and closes. The window is always-on-top
and excluded from the taskbar / Alt+Tab switcher.

---

## Architecture

```
CustomBrowserMainExtraPartsProfiles::PostBrowserStart()
  └─ SplashScreenController::Show()
       │  Creates SplashScreenWindow, adds widget observer, starts 2.5s timer.
       │
       SplashScreenWindow (plain class, views::WidgetObserver)
         │  TYPE_POPUP; remove_standard_frame=true; z_order=kFloatingWindow.
         │  set_focus_on_creation(false) → ShowInactive() so focus stays on browser.
         │  On Windows: WS_EX_TOOLWINDOW added via HWNDForWidget → excluded from
         │  taskbar and Alt+Tab. No cross-platform code needed elsewhere.
         │  Owns raw_ptr<views::Widget>; self-deletes via OnWidgetDestroyed.
         │
         SplashContentView (anonymous views::View in .cc)
           SetContentsView'd onto the Widget; handles OnPaint and
           CalculatePreferredSize. TYPE_POPUP is naturally frameless so no
           custom NonClientFrameView is needed.
           OnPaint: DrawColor(#122844), "WanderLust" 34pt bold white,
                    "Private · Fast · Yours" 14pt subtitle.

       SplashScreenController (views::WidgetObserver)
         │  Holds the window pointer.
         │  fallback_timer_: 2.5s → calls Dismiss().
         │  Dismiss(): stops timer, removes observer, calls window->Dismiss().
         │  window->Dismiss(): 300ms delay then Widget::Close() (smooth close).
         │  OnWidgetDestroying: removes observer, nulls pointer, stops timer.
```

The `SplashScreenController` is owned by `CustomBrowserMainExtraPartsProfiles` via a
`std::unique_ptr`, ensuring it lives for the lifetime of the browser main parts.

---

## Timing

| Phase | Duration | Notes |
|---|---|---|
| Visible | 2500 ms | `kSplashDuration` in controller |
| Dismiss animation | 300 ms | `kDismissDelay` in window |

The controller's fallback timer calls `Dismiss()` after 2.5 s. If the widget is
destroyed externally (e.g., user closes it), `OnWidgetDestroying` fires, which removes
the observer and stops the timer to prevent a double-dismiss.

---

## Visual design

| Element | Value |
|---|---|
| Window size | 480 × 280 px |
| Background color | `#122844` (deep navy) |
| Title font | 34pt bold, white |
| Subtitle font | 14pt regular, white |
| Title text | `"WanderLust"` |
| Subtitle text | `"Private · Fast · Yours"` |

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/ui/views/splash/splash_screen_window.h/.cc` | `WidgetObserver`-based owner + anonymous `SplashContentView`; paint, WS_EX_TOOLWINDOW |
| `custom/browser/ui/views/splash/splash_screen_controller.h/.cc` | Lifetime owner; timer, widget observer, dismiss logic |
| `custom/browser/custom_browser_main_extra_parts_profiles.h/.cc` | `PostBrowserStart()` override; owns `splash_controller_` |
| `custom/browser/ui/sources.gni` | Source listing |

---

## Platform notes

The `WS_EX_TOOLWINDOW` extended style (Windows) is the only platform-specific code.
It is applied conditionally after `ShowInactive()` via `views::HWNDForWidget(widget)`.
On macOS and Linux the window simply appears on top without taskbar exclusion — the
frameless always-on-top behaviour still works correctly.
