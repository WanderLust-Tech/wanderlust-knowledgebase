# RSS Infobar: Subscribe / Cancel

The feed-detection infobar — the one that pops up when the browser finds an
RSS feed on the current page — now renders **Subscribe** / **Cancel** buttons
instead of the default OK / Cancel pair, and **Subscribe** actually wires
through to the RSS service.

## Build flag

Gated by `BUILDFLAG(ENABLE_RSS_READER)`. Controlled by `enable_rss_reader = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).

## What changed

Before, `RSSInfoBarDelegate` inherited `ConfirmInfoBarDelegate`'s default
button behaviour: two buttons labelled "OK" and "Cancel", with `Accept()`
returning the base-class no-op. The user got a prompt but pressing OK did
nothing observable.

The delegate now overrides four members:

| Override | Returns / does |
|---|---|
| `GetButtons()` | `BUTTON_OK \| BUTTON_CANCEL` (explicit — was relying on inherited default) |
| `GetButtonLabel(BUTTON_OK)` | `IDS_RSS_INFOBAR_BUTTON_TEXT` → "Subscribe" |
| `GetButtonLabel(BUTTON_CANCEL)` | Falls through to `ConfirmInfoBarDelegate::GetButtonLabel(button)` (default "Cancel" via `IDS_CANCEL`) — avoids pulling in `components/strings/grit/components_strings.h` |
| `Accept()` | Resolves `Profile` via `infobars::ContentInfoBarManager::WebContentsFromInfoBar(infobar())` (NOT `browser_->profile()` — that path crashes when the originating Browser has been swapped or closed while the infobar was still alive, since the stored `raw_ptr<Browser>` goes dangling), looks up `RSSService`, logs each feed via `LOG(WARNING)`, returns `true` to close. The actual subscription is currently a logging stub — see [Subscribe behaviour](#subscribe-behaviour). |
| `Cancel()` | `LOG(WARNING)` for the dismissal, returns `true` to close |

The string `IDS_RSS_INFOBAR_BUTTON_TEXT` already existed in
[`src/custom/app/generated_resources.grdp`](../src/custom/app/generated_resources.grdp)
with the value "Subscribe", so no new string was added.

## Files touched

| File | Change |
|---|---|
| [`src/custom/components/rss/rss_infobar_delegate.h`](../src/custom/components/rss/rss_infobar_delegate.h) | Uncommented and added overrides for `GetButtons` / `GetButtonLabel` / `Accept` / `Cancel`. |
| [`src/custom/components/rss/rss_infobar_delegate.cc`](../src/custom/components/rss/rss_infobar_delegate.cc) | Implementations of the four overrides. |

## Rendering path

`RSSInfoBarDelegate::Create()` calls `CreateConfirmInfoBar(...)`, which gives
the delegate to Chromium's stock `ConfirmInfoBar` views implementation
(`chrome/browser/ui/views/infobars/confirm_infobar.cc`). That view reads
`GetButtons()` and `GetButtonLabel()` directly off the delegate, so the
override is the only thing needed to relabel the button — the custom views in
[`src/custom/browser/ui/views/infobars/rss_infobar_*`](../src/custom/browser/ui/views/infobars/)
(`rss_infobar_view`, `rss_infobar_button_container`,
`rss_infobar_contents_view`) are **not** on the active path here. They look
like an earlier prototype of a fully-custom RSS infobar; leaving them alone
for now, but flag for cleanup if no other code reaches them.

## Subscribe behaviour

`Accept()` now:

1. Resolves `Profile` from the infobar's `WebContents` (NOT from `browser_` —
   that path crashes when the originating Browser has been swapped or closed
   while the infobar was still alive).
2. Fetches `RSSService` and then `RSSFeed` via `RSSServiceFactory`.
3. Iterates the detected feed list, skipping anything `IsKnownChannelURL`
   already reports as subscribed.
4. For each new feed, builds an `RSSChannelInfo` (`url`, `title`,
   `group_id = 0` for the Ungrouped bucket) and calls
   `RSSFeed::AddRSSChannel(channel)`.

`AddRSSChannel` fires `NotifyRSSChanged` → the `RssServiceObserver` list →
`ReaderDOMHandler::OnRssChanged` → `FireWebUIListener("readerFeedsChanged")`
→ the React reader's `useFeedList` refetches and the new feed appears in
the sidebar live (no reload needed).

`RegisterRSSURL` on the delegate is still present but only used by the
unused `RSSInfoBarContentsView` path (see [Rendering path](#rendering-path)).
It uses `browser_->profile()` and so retains the older lifetime concern;
the active `Accept()` path is the safe one.

## Manual test

1. Build with the RSS feature enabled.
2. Navigate to a page with a `<link rel="alternate" type="application/rss+xml">`
   element (e.g. a typical blog).
3. The infobar appears with message "RSS feed detected: \<title\>" and
   buttons **Subscribe** | **Cancel**.
4. Press **Subscribe** — infobar dismisses; LOG(INFO) lines from
   `RSSInfoBarDelegate::Accept()` appear in `chrome_debug.log`.
5. Press **Cancel** — infobar dismisses; the `Cancel()` LOG line appears.
