# Container Tabs

Firefox-Multi-Account-Containers-style per-tab isolation: a tab assigned to
a named container gets its own `content::StoragePartition` (separate
cookie jar/localStorage/IndexedDB), while still sharing history/bookmarks/
extensions within the profile. Useful for keeping two logins to the same
site apart without needing separate browser profiles or Incognito.

This is the first feature in this fork to create or touch a non-default
`content::StoragePartition` anywhere.

New tabs opened directly into a container, child tabs (links ctrl-clicked
or `window.open()`'d from a container tab) inheriting that container,
session restore / "reopen closed tab", SavedTabGroups reopen, and tab
discard/reactivate all preserve container isolation as of v1.8.17 — see
"Session restore, SavedTabGroups, and discard/reactivate" below for how
each path re-derives the container assignment after recreating the
`WebContents`. SavedTabGroups container assignment is local-only (not
synced) by deliberate choice — see that section for why.

## Architecture

```
ContainerService (per-profile keyed service)
  │  Named containers: {id, name, color}. JSON list in
  │  containers.list pref. No group/tab associations stored here —
  │  see ContainerTabHelper below for why.
  │
  └──► GetStoragePartitionConfigForContainer(container_id)
         content::StoragePartitionConfig::Create(profile,
           "wanderlust-container", container_id, /*in_memory=*/false)
         — same primitive <webview>'s partition="name" attribute uses
         (extensions/browser/guest_view/web_view/web_view_guest.cc),
         reused here for ordinary top-level tabs.

ContainerTabHelper (WebContentsUserData<ContainerTabHelper>)
  │  Just a container_id string, attached to a WebContents at creation
  │  time. NOT a persisted association -- lives and dies with the
  │  WebContents it's attached to. This is intentional: a
  │  SiteInstance's fixed StoragePartition already survives renderer
  │  crashes/BFCache for the life of one WebContents (upstream
  │  guarantee, see BrowsingInstance::is_fixed_storage_partition and
  │  SiteInstanceImpl::DeriveSiteInfo) -- the helper only needs to
  │  answer "does this specific, still-alive tab have a container, and
  │  which" for child-tab propagation. It is not a durable record.
```

## Core mechanism

### Assigning a container at tab-creation time

`NavigateParams` (`chrome/browser/ui/browser_navigator_params.h`, patched)
gained a `std::string container_id` field, alongside the existing
`std::optional<tab_groups::TabGroupId> group`.

`CreateTargetContents()` (`chrome/browser/ui/browser_navigator.cc`, patched
— the exact point vanilla Chromium builds `WebContents::CreateParams`/
`SiteInstance` from `params.browser->profile()`) branches:

- `params.opener` set → unchanged, inherits the opener's `SiteInstance`
  (this is deliberate — see "window.open() and containers" below).
- `params.opener` empty and `params.container_id` non-empty → builds the
  `SiteInstance` via
  `content::SiteInstance::CreateForFixedStoragePartition(profile, url,
  container_service->GetStoragePartitionConfigForContainer(container_id))`
  instead of the default `tab_util::GetSiteInstanceForNewTab(...)`, then
  attaches a `ContainerTabHelper` to the newly created `WebContents`.
- Otherwise → unchanged, default partition.

### Child-tab inheritance

`ConfigureTabGroupForNavigation()` (`chrome/browser/ui/browser_tabstrip.cc`,
patched) is vanilla Chromium's existing single, shared hook — called from
both `Browser::OpenURLFromTab` (ctrl-click a link) and
`chrome::AddWebContents`/`Browser::AddNewContents` (`window.open()`) right
before `Navigate()` — that already propagates the source tab's
`TabGroupId` into `NavigateParams::group` for `NEW_FOREGROUND_TAB`/
`NEW_BACKGROUND_TAB` dispositions. Container propagation was added right
alongside it: if the source tab has a `ContainerTabHelper`, its
`container_id()` is copied into `nav_params->container_id` under the same
disposition check. This means the child-tab-inherits-container behavior
required **zero** new call sites — it reuses the exact same shared
function `.group` already relies on.

### window.open() and containers

Deliberate v1 decision: a `window.open()`-created tab (which has an
`opener`) always inherits the opener's `SiteInstance` regardless of
`container_id` — this is existing, unmodified behavior in
`CreateTargetContents()` (the `params.opener` branch is checked first and
short-circuits). A popup opened via `window.open()` from a container tab
therefore also lands in that container (same `SiteInstance`, same
partition) — but via the opener-inheritance path, not the
`container_id`/`CreateForFixedStoragePartition` path. Practically this
means `window.open()` popups inherit correctly today; the `!params.opener`
guard exists so that `ConfigureTabGroupForNavigation`'s propagation into
`container_id` (used for ctrl-click/new-tab dispositions, which do *not*
carry an opener the same way) doesn't conflict with or duplicate what
opener-inheritance already does.

## UI

Right-click empty space in the vertical tab bar (`VerticalTabBarSortMenuDelegate`
in `browser/ui/views/frame/vertical_tab_bar.cc`) — the same fork-owned
context menu Workspaces already extends — gained:

- **"New tab in container ▸"** submenu, one entry per `ContainerService::GetContainers()`,
  opening a new foreground tab with `NavigateParams::container_id` set
  (`VerticalTabBar::OpenNewTabInContainer`).
- **"Manage containers…"**, opening `chrome://settings/containers`
  (`VerticalTabBar::OpenContainersSettings`).

This intentionally does **not** touch the per-tab right-click menu
(`VerticalTabContextMenuContents`, which wraps vanilla Chromium's own
`TabMenuModel`) — extending that would mean patching a vanilla Chromium
menu-model file, a bigger and riskier change than extending this fork's
own `VerticalTabBarSortMenuDelegate`. "New tab in container" (create a
fresh tab in a container) rather than "move this tab into a container"
(reassign an already-open tab) is the v1 UX as a result — matches Firefox's
own primary container-tabs entry point (new-tab-button/link context menu),
just via a different menu location in this fork's UI.

### Settings page

`chrome://settings/containers` (`ContainersPage.tsx`) — create/rename/
recolor/delete containers, backed by `containersGetAll`/`Create`/`Update`/
`Delete` handlers in `CustomSettingsHandler`, following the exact
`workspaces*`/`pinnedPanels*` handler pattern (see the Sidebar Web Panels
doc for why dedicated handlers were used instead of a raw pref write).

## Session restore, SavedTabGroups, and discard/reactivate (fixed in v1.8.17)

A container-pinned `SiteInstance`'s fixed partition is a property of one
specific `WebContents` object — it survives renderer crashes and BFCache
restores for free (confirmed via `BrowsingInstance::is_fixed_storage_partition`
and `SiteInstanceImpl::DeriveSiteInfo`/`RenderFrameHostManager`'s explicit
propagation of the fixed-partition flag across BrowsingInstance swaps).
It does **not** survive anything that destroys and recreates the
`WebContents` from scratch. Three such paths exist in this fork; each
re-derives the container assignment from its own carrier right before
recreating the `WebContents`, then re-attaches a fresh
`ContainerTabHelper`:

1. **Session restore / "reopen closed tab"** — `CreateRestoredTab()`
   (`chrome/browser/ui/browser_tabrestore.cc`) used to build `SiteInstance`/
   `WebContents::CreateParams` directly, bypassing `NavigateParams`/
   `CreateTargetContents()` entirely, so a restored container tab silently
   fell back to the default partition. Fixed by capturing the container ID
   into `sessions::tab_restore::Tab::extra_data` at close time
   (`BrowserLiveTabContext::GetExtraDataForTab`,
   `chrome/browser/ui/browser_live_tab_context.cc`) under the
   `custom::kContainerIdExtraDataKey` key, and reading it back out in
   `CreateRestoredTab()` to build a `SiteInstance::CreateForFixedStoragePartition`
   the same way `CreateTargetContents()` does.

2. **SavedTabGroups reopen** (`WorkspaceService::EnsureGroupOpen` →
   `TabGroupSyncService::OpenTabGroup` → ... →
   `SavedTabGroupUtils::OpenTabInBrowser`) — mechanically *does* funnel
   through `NavigateParams`/`Navigate()`/`CreateTargetContents()`, so
   threading `container_id` onto that call "just works" — but
   `SavedTabGroupTab` (the synced data model) has no field to source a
   container ID from. Rather than add a synced field (a schema/protobuf
   change that would make container assignment follow a tab group to other
   devices), this stays **local-only by design**: `ContainerService` keeps
   a local (non-synced) `{saved_tab_guid: container_id}` map
   (`containers.saved_tab_map` pref), populated in
   `SavedTabGroupUtils::CreateSavedTabGroupTabFromWebContents()` when a tab
   is saved and read back in `MaybeOpenTabFromSavedTab()`
   (`tab_group_sync_delegate_desktop.cc`) when it's reopened. A saved group
   reopened on a different device won't have this mapping there — that's
   the accepted trade-off for not touching sync schema.

3. **Tab discard → reactivate** — `TabLifecycleUnit::FinishDiscard()`
   (`chrome/browser/resource_coordinator/tab_lifecycle_unit.cc`) used to
   construct a brand-new `WebContents` with no `SiteInstance` argument and
   delete the old one, unconditionally losing any container-fixed
   partition. Fixed by reading the discarded tab's `ContainerTabHelper`
   before `old_contents` is destroyed and, if present, building the
   replacement's `WebContents::CreateParams` with a
   `SiteInstance::CreateForFixedStoragePartition` for the same container,
   then re-attaching `ContainerTabHelper` to the new `WebContents`.
   (`FinishDiscardAndPreserveWebContents`, which reuses the existing
   `WebContents` and would sidestep this entirely, remains gated behind
   `features::kWebContentsDiscard` — disabled by default upstream and not
   overridden in this fork, so `FinishDiscard()` is still the path that
   actually runs.)

**Known minor limitation**: the local saved-tab-guid map has no
garbage collection for deleted saved tabs — stale entries (a short string
each) accumulate harmlessly rather than being cleaned up. Not worth the
extra plumbing for v1.

## File map

| File | Role |
|---|---|
| [`browser/containers/container_types.h/.cc`](../src/custom/browser/containers/container_types.cc) | `Container {id, name, color}`, `ToValue()`/`FromValue()` |
| [`browser/containers/container_service.h/.cc`](../src/custom/browser/containers/container_service.cc) | Per-profile `KeyedService`, CRUD + `GetStoragePartitionConfigForContainer()` |
| [`browser/containers/container_service_factory.h/.cc`](../src/custom/browser/containers/container_service_factory.cc) | Standard `BrowserContextKeyedServiceFactory`; OTR shares the parent profile's containers |
| [`browser/containers/container_tab_helper.h/.cc`](../src/custom/browser/containers/container_tab_helper.cc) | `WebContentsUserData` marking a tab's container; also defines `kContainerIdExtraDataKey`, the session-restore carrier key |
| `chrome/browser/ui/browser_live_tab_context.cc` (patched) | `GetExtraDataForTab()` captures a closing tab's container ID for session restore |
| `chrome/browser/ui/browser_tabrestore.cc` (patched) | `CreateRestoredTab()` rebuilds the container's fixed `SiteInstance` from that captured ID |
| `chrome/browser/ui/tabs/saved_tab_groups/saved_tab_group_utils.cc/.h` (patched) | Captures a saved tab's container into `ContainerService`'s local map; `OpenTabInBrowser()` gained an optional `container_id` param |
| `chrome/browser/ui/tabs/saved_tab_groups/tab_group_sync_delegate_desktop.cc` (patched) | `MaybeOpenTabFromSavedTab()` looks up and threads the container ID through on reopen |
| `chrome/browser/resource_coordinator/tab_lifecycle_unit.cc` (patched) | `FinishDiscard()` preserves container isolation across discard/reactivate |
| `chrome/browser/ui/browser_navigator_params.h` (patched) | `NavigateParams::container_id` |
| `chrome/browser/ui/browser_navigator.cc` (patched) | `CreateTargetContents()` — `SiteInstance::CreateForFixedStoragePartition` routing + `ContainerTabHelper` attachment |
| `chrome/browser/ui/browser_tabstrip.cc` (patched) | `ConfigureTabGroupForNavigation()` — container-id propagation to child tabs |
| [`browser/ui/views/frame/vertical_tab_bar.cc`](../src/custom/browser/ui/views/frame/vertical_tab_bar.cc) | "New tab in container ▸" / "Manage containers…" menu entries |
| [`components/custom_settings/components/ContainersPage.tsx`](../src/custom/components/custom_settings/components/ContainersPage.tsx) | Manage-containers settings page |

Three vanilla Chromium files are patched (corresponding `.patch` files in
`src/custom/patches/`):

- `chrome-browser-ui-browser_navigator_params.h.patch`
- `chrome-browser-ui-browser_navigator.cc.patch`
- `chrome-browser-ui-browser_tabstrip.cc.patch`

## Testing

1. Create two containers via `chrome://settings/containers`.
2. Right-click empty space in the vertical tab bar → "New tab in container ▸"
   → pick one, log into a site. Repeat for the other container, same site,
   different account.
3. Confirm the two tabs don't share cookies/session (different logged-in
   account in each).
4. Ctrl-click a link in a container tab; confirm the new tab is also in
   that container (same account already logged in, no fresh login prompt).
5. Open the same link via `window.open()` (e.g. a "login with provider"
   popup); confirm it also lands in the container.
6. Restart the browser; confirm the previously-container tabs (now
   restored) do **not** retain their container isolation — this is the
   documented v1 gap, not a bug, but worth confirming it fails the way
   this doc says it should rather than some other way.
