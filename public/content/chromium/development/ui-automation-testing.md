# UI Automation Testing

Plan for a UI automation framework covering the custom browser's native Views
UI and its WebUI pages. Nothing is implemented yet — this doc captures the
approach so work can be picked up later.

---

## Existing test infrastructure

Two test files already exist and prove the build plumbing works:

| File | Framework | What it tests |
|---|---|---|
| [`custom/browser/ntp/remote_ntp_browsertest.cc`](../src/custom/browser/ntp/remote_ntp_browsertest.cc) | `InProcessBrowserTest` | 40+ NTP browser tests |
| [`custom/ui/views/dropdown_combo_box_view_unittest.cc`](../src/custom/ui/views/dropdown_combo_box_view_unittest.cc) | `ViewsTestBase` | 5 widget unit tests |

Only the `dropdown_combo_box_view_unittest.cc` has a BUILD.gn target
(`source_set("dropdown_combo_box_test")` in `custom/ui/views/BUILD.gn`).
`remote_ntp_browsertest.cc` compiles but is not wired to a GN test target.

---

## Recommended approach

Two complementary layers, each targeting a different surface:

### Layer 1 — `InteractiveUITest` for native Views UI

Chromium's `//chrome/test/interaction/interactive_browser_test.h` adds a fluent
step-based sequencer (`InteractiveTestApi`) on top of `InProcessBrowserTest`.
It's the right tool for toolbar buttons, bubble dialogs, the sidebar widget, and
any other native Views component. The sequencer handles async rendering,
animations, and focus automatically.

Example test shape (not implemented):

```cpp
// src/custom/test/interactive/privacy_shield_interactive_uitest.cc

IN_PROC_BROWSER_TEST_F(PrivacyShieldInteractiveTest, ToggleConnectionControl) {
  RunTestSequence(
    // Click the Privacy Shield toolbar button
    PressButton(kPrivacyShieldButtonElementId),
    // Wait for the bubble to become visible
    WaitForShow(kPrivacyShieldBubbleElementId),
    // Toggle Connection Control on
    PressButton(kConnectionControlToggleElementId),
    // Assert the toggle reflects the new state
    CheckViewProperty(kConnectionControlToggleElementId,
                      &views::ToggleButton::GetIsOn, true)
  );
}
```

**Prerequisite:** Each custom widget that tests need to reference must declare
an `ui::ElementIdentifier`. This is a one-liner per widget:

```cpp
// In the widget header:
DECLARE_ELEMENT_IDENTIFIER_VALUE(kPrivacyShieldButtonElementId);

// In the widget .cc:
DEFINE_ELEMENT_IDENTIFIER_VALUE(kPrivacyShieldButtonElementId);

// In the constructor, after the view is added:
SetProperty(views::kElementIdentifierKey, kPrivacyShieldButtonElementId);
```

All identifier declarations should live in a single shared header:
`src/custom/test/custom_element_ids.h`.

### Layer 2 — Playwright for WebUI pages

For `chrome://custom-settings`, the NTP, and other React/Pathfinder WebUI
pages, Playwright (Node.js) is simpler and faster than a C++ browser test. The
browser is launched externally with `--remote-debugging-port=9222` and
Playwright connects via CDP.

Example npm script (not implemented):

```json
"test:webui": "playwright test --config=test/playwright.config.ts"
```

No C++ required. Since the WebUI pages are standard React apps served over an
embedded test server, normal DOM assertions work.

---

## Proposed directory layout

```
src/custom/test/
  custom_browser_interactive_test.h/.cc   ← base fixture; sets up common prefs,
                                            exposes typed accessors for custom views
  custom_element_ids.h                    ← all DECLARE_ELEMENT_IDENTIFIER_VALUE
  interactive/
    privacy_shield_interactive_uitest.cc
    sidebar_interactive_uitest.cc
    toolbar_interactive_uitest.cc
    connection_control_interactive_uitest.cc
  unit/
    (widget-level ViewsTestBase tests go here)
  BUILD.gn                                ← wires everything into interactive_ui_tests
```

```
test/                                     ← at repo root, alongside package.json
  playwright.config.ts
  webui/
    custom_settings.spec.ts
    ntp.spec.ts
    page_notes.spec.ts
```

---

## Build wiring (Layer 1)

The `BUILD.gn` for the interactive tests will look like:

```gn
import("//build/config/features.gni")

if (is_custom_browser) {
  source_set("custom_browser_interactive_tests") {
    testonly = true
    sources = [
      "custom_browser_interactive_test.cc",
      "custom_browser_interactive_test.h",
      "custom_element_ids.h",
      "interactive/privacy_shield_interactive_uitest.cc",
      "interactive/sidebar_interactive_uitest.cc",
      "interactive/toolbar_interactive_uitest.cc",
    ]
    deps = [
      "//chrome/test/interaction:interactive_browser_test",
      "//chrome/test/base:test_support",
      "//custom/browser/ui/views/...",
      "//testing/gtest",
    ]
  }
}
```

This target would then be added to Chromium's `interactive_ui_tests` binary via
the root `chrome/test/BUILD.gn` or a custom top-level test binary.

---

## Implementation order

1. **Add element IDs** to the widgets you want to test first. No test code yet —
   just add `DEFINE_ELEMENT_IDENTIFIER_VALUE` + `SetProperty(kElementIdentifierKey)`
   to `PrivacyShieldButton`, `SidebarButton`, and `AdBlockButton`. This is the
   lowest-risk change.

2. **Create `src/custom/test/`** with `custom_element_ids.h` and a minimal
   `CustomBrowserInteractiveTest` base fixture that opens a browser window and
   exposes `GetCustomToolbar()`.

3. **Write one end-to-end test** — Privacy Shield open/close is the simplest
   meaningful case. Wire it into a BUILD.gn target and verify it compiles and
   runs green.

4. **Add Playwright** as a separate npm script for WebUI pages. Start with
   `chrome://custom-settings` since it has the most user-visible state.

---

## References

- `//chrome/test/interaction/interactive_browser_test.h` — `InteractiveTestApi` mixin
- `//ui/base/interaction/element_identifier.h` — `ElementIdentifier` system
- `//chrome/test/base/in_process_browser_test.h` — base browser test class
- `//ui/views/test/views_test_base.h` — base for isolated widget tests
- Chromium docs: [InteractiveUITest](https://chromium.googlesource.com/chromium/src/+/main/docs/ui/interactive_test_api.md)
- `remote_ntp_browsertest.cc` — existing in-tree example of `InProcessBrowserTest` pattern
