# Reader Mode on Desktop Platforms
Reader Mode is an accessibility feature which offers a simplified version of the
original page that focuses on the "core" text, stripping out extraneous images,
UI, scripts, and other elements. It is launched on Android as "Simplified View".

Reader Mode is based on the DOM distiller project which provides functionality
for simplifying a webpage. This document focuses on how the
[DOM distiller](https://chromium.googlesource.com/chromium/dom-distiller)
project is integrated into Chrome on Desktop.

## Overview

Desktop Reader Mode is hidden behind a
[base::Feature](https://source.chromium.org/chromium/chromium/src/+/master:components/dom_distiller/core/dom_distiller_features.cc)
flag, 'enable-reader-mode'. To run Chrome with Reader Mode, set the "Enable
Reader Mode" flag to "Enabled" in chrome://flags or start Chrome with
--enable-feature="ReaderMode".

### Code Locations

Most of Reader Mode code is in components/dom_distiller (see the
[DOM distiller project](https://chromium.googlesource.com/chromium/dom-distiller)).
It is tied into Chrome via hooks in chrome/browser/dom_distiller (Desktop) and
chrome/browser/android/dom_distiller (Android).

### Tests

Most Reader Mode tests are in components_unittests or components_browsertests.
Tests for integration with Chrome Desktop are in browser_tests, including tests
of ReaderModeIconView and dom_distiller/tab_utils.h.

### Bugs

Reader Mode bugs should be filed under
[UI>Browser>ReaderMode](https://bugs.chromium.org/p/chromium/issues/list?q=component:UI%3EBrowser%3EReaderMode)
in crbug.com.

## How Reader Mode works in Desktop Chrome

### Deciding whether to offer Reader Mode

Reader Mode classifies all pages visited by the user as "distillable" or
"not distillable". A page is distillable, roughly speaking, when it has a
http or https scheme, contains an article and when DOM Distiller is likely to
accurately extract its core content. For example, many news articles are
distillable because they mostly consist of a single column of core text. In
contrast, the Wikipedia main page is not distillable because it contains several
unrelated text areas that are of roughly equal importance.

The [DistillabilityAgent](https://cs.chromium.org/chromium/src/components/dom_distiller/content/renderer/distillability_agent.h),
located in the renderer process, examines the page contents whenever the
compositor makes a meaningful change to the layout, which happens 1 to 3 times
as the page loads. It then uses one of several different heuristics to determine
whether the page is distillable or not. The browser receives the result obtained
by the DistillabilityAgent for a given web contents via the
[DistillabilityService](https://cs.chromium.org/chromium/src/components/dom_distiller/content/common/mojom/distillability_service.mojom),
which is wrapped by a helper class, the
[DistillabilityDriver](https://cs.chromium.org/chromium/src/components/dom_distiller/content/browser/distillability_driver.h).
The DistillabilityDriver packages this information as a
[DistillabilityResult](https://cs.chromium.org/chromium/src/components/dom_distiller/content/browser/distillable_page_utils.h),
forwards it to all registered observers, and caches it.

### Toggling Reader Mode
Users can toggle reader mode using an omnibox icon or an option, Toggle Reader
Mode, in the "customize and control Chrome" menu, both of which execute
BrowserCommands [ToggleDistilledView()](https://source.chromium.org/chromium/chromium/src/+/master:chrome/browser/ui/browser_commands.cc;bpv=1;bpt=1;l=1364?q=browser_commands%20dom_distiller&ss=chromium%2Fchromium%2Fsrc).

[ReaderModeIconView](https://cs.chromium.org/chromium/src/chrome/browser/ui/views/reader_mode/reader_mode_icon_view.h)
is a DistillabilityObserver and sets its visibility based on the latest result
for the currently active web contents. Reader Mode on desktop only considers
whether the page is a distilled page, or, if not, the field
DistillabilityResult::is_distillable when deciding whether to display the icon;
the other fields are ignored. The icon's visibility is updated when
 * the user navigates to a new page within the same tab,
 * the user switches tabs, and
 * when a new distillability result is available.

### Representing Reader Mode in the tab strip and omnibox
Reader Mode should be considered a way of viewing a page, rather than a separate
page to users. For this reason, we display most of the original page's
information:

 * The omnibox displays the original page URL, minus the scheme.
    * The actual URL of the Reader Mode page is still "chrome-distiller://"
    which is still returned from WebContents::GetLastCommittedURL() and
    WebContents::GetVisibleURL().
    * A special case in LocationBarModel::GetFormattedURL converts from
    "chrome-distiller://" URLs to the original URL minus the scheme
      * However, if a user types in an invalid chrome-distiller:// URL,
      it will be displayed in the omnibox, because it doesn't correspond to any
      article.
    * Users cannot copy the hidden "chrome-distiller://" URLs, instead
    OmniboxEditModel::AdjustTextForCopy converts Reader Mode URLs to their
    original URLs, if the chrome-distiller:// url encodes a valid original URL.
 * The security badge shows a Reader Mode-specific icon plus the phrase
 "Reader Mode"
    * SecurityState's GetSecurityLevel returns SecurityLevel::NONE for
    "chrome-distiller://" scheme pages. Distilled pages should not contain forms,
    payment handlers, or other JS from the original URL, so they won't be
    affected by downgraded security level.