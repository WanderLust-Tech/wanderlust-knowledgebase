# Demystifying FrameTree Concepts (Chromium v134+)

**Note for v134+**: This document reflects the current state of frame tree architecture in Chromium v134 and later, including modern isolation features, enhanced security boundaries, and updated API patterns.

## What are Frame Trees?

There are two representations of FrameTrees used in rendering Web Pages.
- Blink's [FrameTrees](https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/core/page/frame_tree.h)
- Content's [FrameTrees](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/renderer_host/frame_tree.h)

These concepts are very similar, however on the content side a placeholder
[FrameTreeNode](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/renderer_host/frame_tree_node.h) can
be placed in the FrameTree to hold another frame tree. This `FrameTreeNode`'s
current RenderFrameHost will have a valid
`RenderFrameHostImpl::inner_tree_main_frame_tree_node_id` frame tree node
ID.

The renderer side (Blink) will have no notion of this placeholder in the
frame tree and its frame tree appears as it would for the web exposed
[window.frames](https://developer.mozilla.org/en-US/docs/Web/API/Window/frames)

## Why do we nest frame trees?

Certain features that nest documents require a stronger boundary than what would
be achievable with iframes. We want to prevent the exposure of information
across this boundary. This may be for privacy reasons where we enforce
communication restrictions between documents on the web (e.g. fenced frames).
The boundary could also be between content on the web and parts of the user
agent implemented with web technologies (e.g. Chrome's PDF viewer, webview tag).

**Modern Use Cases (v134+)**:
- **Fenced Frames**: Enhanced privacy boundaries for advertising and analytics
- **Portal Elements**: Seamless navigation with preloaded content isolation
- **WebView Embedding**: Secure isolation for embedded web content
- **PDF Viewer**: Browser-native PDF rendering with web technology isolation
- **Extension Content**: Isolated frames for browser extension content

## What are Outermost Main Frames?

Building on the concept above that a `FrameTree` can have an embedded
`FrameTree` (and many nesting levels of them), there is the concept of
the `OutermostMainFrame`. The OutermostMainFrame is the main frame (root)
of a FrameTree that is not embedded in other FrameTrees.
[See footnote 1.](#footnote_1)

So that does mean there can be __multiple main frames__ in a displayed
tab to the user. For features like `fencedframes` the inner `FrameTree`
has a main frame but it will not be an `OutermostMainFrame`.

**Modern API Usage (v134+)**:
To determine whether something is a main frame `RenderFrameHost::GetParent()`
is typically used. For determining if something is an `OutermostMainFrame`, 
use `RenderFrameHost::GetParentOrOuterDocument()`. Modern code should also 
consider using `RenderFrameHost::IsInPrimaryMainFrame()` for primary page checks.

```
Example Frame Tree:
    A (Primary Main Frame)
     B (iframe)
     C (fenced frame - placeholder frame) [See footnote 2.]
      C* (main frame in fenced frame)
     D (portal element - placeholder frame)
      D* (main frame in portal)

    C* GetParent() returns null.
    C* GetParentOrOuterDocument() returns A.
    C* IsInPrimaryMainFrame() returns false.
    
    D* GetParent() returns null.
    D* GetParentOrOuterDocument() returns A.
    D* IsInPrimaryMainFrame() returns false.
    
    C GetParent() & GetParentOrOuterDocument() returns A.
    B GetParent() & GetParentOrOuterDocument() returns A.
    A GetParent() & GetParentOrOuterDocument() returns nullptr.
    A IsInPrimaryMainFrame() returns true.
```

## Can I have multiple outermost main frames?

**Yes!** Prerender and back/forward cache are features where there can be
other outermost main frames present in a `WebContents`.

**Modern Features (v134+)** that create multiple outermost main frames:
- **Prerendering**: Pages pre-loaded for faster navigation
- **Back/Forward Cache**: Cached pages for instant back/forward navigation  
- **Portal Elements**: Preloaded content for seamless transitions
- **Speculation Rules**: Predictive loading based on user behavior patterns

Use `WebContentsObserver::PrimaryPageChanged()` to track when the primary 
page changes between these different outermost main frames.

## What are Pages?

Pages can be an overloaded term so we will clarify what we mean by the
class concepts:
- Blink's [Page](https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/core/page/page.h)
- Content's [Page](https://source.chromium.org/chromium/chromium/src/+/main:content/public/browser/page.h)

The two usages are very similar, they effectively are an object representing
the state of a `FrameTree`. Since frames can be hosted in different renderers
(for isolation) there may be a number of Blink `Page` objects, one for each
renderer that participates in the rendering of a single `Page` in content.

**Modern Considerations (v134+)**:
- Pages now have enhanced lifecycle management for better memory efficiency
- Improved coordination between Blink and Content Page objects
- Better support for cross-origin isolation and process allocation

## What is the Primary Page?

There is only ever one Primary Page for a given `WebContents`. The primary
page is defined by the fact that the main frame is the `OutermostMainFrame`
and being actively displayed in the tab.

The primary page can change over time (see
`WebContentsObserver::PrimaryPageChanged()`). The primary page can change when
navigating, a `Page` is restored from the `BackForwardCache`, or when
transitioning from prerendering pages.

**Modern Primary Page Events (v134+)**:
- Navigation to a new document
- Restoration from Back/Forward Cache
- Activation of a prerendered page
- Portal adoption (when a portal becomes the main frame)
- Page lifecycle state changes (frozen, discarded, etc.)

## Relationships between core classes in content/

A WebContents represents a tab. A WebContents owns a FrameTree, the "primary
frame tree," for what is being displayed in the tab. A WebContents may
indirectly own additional FrameTrees for features such as prerendering.

A FrameTree consists of FrameTreeNodes. A FrameTreeNode contains a
RenderFrameHost. FrameTreeNodes reflect the frame structure in the renderer.
RenderFrameHosts represent documents loaded in a frame (roughly,
[see footnote 3](#footnote_3)). As a frame navigates its RenderFrameHost may
change, but its FrameTreeNode stays the same.

In the case of nested frame trees, the RenderFrameHost corresponding to the
hosting document owns the inner FrameTree (possibly through an intermediate
object, as is the case for content::FencedFrame).

**Modern Architecture Notes (v134+)**:
- Enhanced process isolation means RenderFrameHosts may be distributed across
  multiple processes for security
- Improved memory management with better cleanup of unused FrameTreeNodes
- Better coordination between frame trees for features like Portals and 
  Fenced Frames

## "MPArch"

"MPArch," short for Multiple Page Architecture, refers to the name of the
project that introduced the capability of having multiple FrameTrees in a
single WebContents.

You may also see comments which describe features relying on multiple FrameTrees
in terms of MPArch (e.g. "ignore navigations from MPArch pages"). These are in
reference to "non-primary" frame trees as described above.

**Modern MPArch Features (v134+)**:
- Enhanced support for Fenced Frames with better isolation
- Improved Prerendering with more efficient resource management  
- Portal elements for seamless navigation experiences
- Better integration with Back/Forward Cache

See the original [design doc](https://docs.google.com/document/d/1NginQ8k0w3znuwTiJ5qjYmBKgZDekvEPC22q0I4swxQ/edit?usp=sharing)
for historical context and the current [MPArch documentation](https://source.chromium.org/chromium/chromium/src/+/main:docs/mp_arch.md) for up-to-date details.

## Debugging and Development Tools (v134+)

**Chrome DevTools Enhancements**:
- Frame tree visualization in the Security panel
- Enhanced Application panel showing multiple frame trees
- Better debugging support for Fenced Frames and Portals

**Debugging APIs**:
- `chrome://inspect/#pages` shows all frame trees in a WebContents
- `WebContentsObserver::FrameTreeNodeCreated()` for monitoring frame tree changes
- Enhanced logging for frame tree operations with `--enable-logging --vmodule=frame_tree*=3`

**Testing Utilities**:
- `content::WebContentsTester` provides utilities for testing frame tree scenarios
- `content::TestRenderFrameHost` for unit testing frame tree logic
- `content::FakeFrameWidget` for testing frame interactions

## Footnotes

<a name="footnote_1"></a>1: GuestViews (embedding of a WebContents inside another WebContents) are
considered embedded FrameTrees as well. However for consideration of
OutermostMainFrames (ie. GetParentOrOuterDocument, Primary page) they do not
escape the WebContents boundary because of the logical embedding boundary.

<a name="footnote_2"></a>2: The placeholder RenderFrameHost is generally not exposed outside
of the content boundary. Iteration APIs such as `ForEachRenderFrameHost()`
do not visit this node. In v134+, this isolation is even stronger with 
enhanced security boundaries for features like Fenced Frames.

<a name="footnote_3"></a>3: RenderFrameHost is not 1:1 with a document in the renderer.
See [RenderDocument](https://source.chromium.org/chromium/chromium/src/+/main:docs/render_document.md) for details.

## See Also

For developers working with frame trees in Chromium v134+:

- [RenderDocument Architecture](https://source.chromium.org/chromium/chromium/src/+/main:docs/render_document.md)
- [Site Isolation](site_isolation.md) - How frame trees interact with process isolation
- [Navigation Architecture](navigation_architecture.md) - How navigations affect frame trees  
- [Fenced Frames Developer Guide](https://source.chromium.org/chromium/chromium/src/+/main:docs/fenced_frames.md)
- [Portal Elements Specification](https://source.chromium.org/chromium/chromium/src/+/main:docs/portals.md)
