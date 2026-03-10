# Chrome Accessibility on Android

Chrome plays an important role on Android - not only is it the default
browser, but Chrome powers WebView, which is used by many built-in and
third-party apps to display all sorts of content.

This document covers some of the technical details of how Chrome
implements its accessibility support on Android.

As background reading, you should be familiar with
[Android Accessibility](https://developer.android.com/guide/topics/ui/accessibility)
and in particular
[AccessibilityNodeInfo](https://developer.android.com/reference/android/view/accessibility/AccessibilityNodeInfo)
and
[AccessibilityNodeProvider](https://developer.android.com/reference/android/view/accessibility/AccessibilityNodeProvider).

## WebContentsAccessibility

The main Java class that implements the accessibility protocol in Chrome is
[WebContentsAccessibilityImpl.java](https://cs.chromium.org/chromium/src/content/public/android/java/src/org/chromium/content/browser/accessibility/WebContentsAccessibilityImpl.java). It implements the AccessibilityNodeProvider
interface, so a single Android View can be represented by an entire tree
of virtual views. Note that WebContentsAccessibilityImpl represents an
entire web page, including all frames. The ids in the java code are unique IDs,
not frame-local IDs.

On most platforms, we create a native object for every AXNode in a web page,
and we implement a bunch of methods on that object that assistive technology
can query.

Android is different - it's more lightweight in one way, in that we only
create a native AccessibilityNodeInfo when specifically requested, when
an Android accessibility service is exploring the virtual tree. In another
sense it's more heavyweight, though, because every time a virtual view is
requested we have to populate it with every possible accessibility attribute,
and there are quite a few.

## Populating AccessibilityNodeInfo

Populating AccessibilityNodeInfo is a bit complicated for reasons of
Android version compatibility and also code efficiency.

WebContentsAccessibilityImpl.createAccessibilityNodeInfo is the starting
point. That's called by the Android framework when we need to provide the
info about one virtual view (a web node).

We call into C++ code - 
[web_contents_accessibility_android.cc](https://cs.chromium.org/chromium/src/content/browser/accessibility/web_contents_accessibility_android.cc) from
there, because all of the information about the accessibility tree is
using the shared C++ BrowserAccessibilityManager code.