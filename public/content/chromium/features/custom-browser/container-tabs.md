# Container Tabs

Firefox-Multi-Account-Containers-style per-tab isolation: a tab assigned to
a named container gets its own `content::StoragePartition` (separate
cookie jar/localStorage/IndexedDB), while still sharing history/bookmarks/
extensions within the profile. Useful for keeping two logins to the same
site apart without needing separate browser profiles or Incognito.

This is the first feature in this fork to create or touch a non-default
`content::StoragePartition` anywhere.

**v1 scope — core mechanism only.** New tabs opened directly into a
container, and child tabs (links ctrl-clicked or `window.open()`'d from a
container tab) inheriting that container, both work correctly. Container
assignment does **not** currently survive session restore, SavedTabGroups
reopen, or tab discard/reactivate — see "Known v1 gaps" below for exactly
why and what each would need. This was a deliberate scope decision, not an
oversight — each of those three paths is separate, non-trivial work, and
one of them (SavedTabGroups) raises a real product question (does
container assignment sync across devices?) rather than being pure
plumbing.

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

## Known v1 gaps

A container-pinned `SiteInstance`'s fixed partition is a property of one
specific `WebContents` object — it survives renderer crashes and BFCache
restores for free (confirmed via `BrowsingInstance::is_fixed_storage_partition`
and `SiteInstanceImpl::DeriveSiteInfo`/`RenderFrameHostManager`'s explicit
propagation of the fixed-partition flag across BrowsingInstance swaps).
It does **not** survive anything that destroys and recreates the
`WebContents` from scratch. Three such paths exist in this fork today,
none of them handled:

1. **Session restore / "reopen closed tab"** — `CreateRestoredTab()`
   (`chrome/browser/ui/browser_tabrestore.cc`) builds `SiteInstance`/
   `WebContents::CreateParams` directly, bypassing `NavigateParams`/
   `CreateTargetContents()` entirely. A restored container tab silently
   falls back to the default partition. Fixing this needs a second hook
   mirroring `CreateTargetContents()`'s logic inside `CreateRestoredTab()`,
   plus a way to carry `container_id` across a full browser relaunch —
   `AddRestoredTab`/`ReplaceRestoredTab`'s existing `extra_data` map
   (`std::map<std::string,std::string>`) is the natural place to stash it.

2. **SavedTabGroups reopen** (`WorkspaceService::EnsureGroupOpen` →
   `TabGroupSyncService::OpenTabGroup` → ... →
   `SavedTabGroupUtils::OpenTabInBrowser`) — mechanically *does* funnel
   through `NavigateParams`/`Navigate()`/`CreateTargetContents()`, so
   threading `container_id` onto that call would "just work" — **but**
   `SavedTabGroupTab` (the synced data model) has no field to source a
   container-id from today. This is a real product decision, not just
   plumbing: does container assignment sync cross-device as part of the
   saved group (schema change to a type that syncs), or stay purely local
   (a fork-local table keyed by saved-tab-guid, this device only)? Not
   resolved in v1.

3. **Tab discard → reactivate** — this fork's "discard inactive tabs"
   feature uses stock `resource_coordinator::TabLifecycleUnit`. Its
   *default* path, `TabLifecycleUnit::FinishDiscard()`
   (`chrome/browser/resource_coordinator/tab_lifecycle_unit.cc`),
   constructs a brand-new `WebContents` with **no** `SiteInstance` argument
   at all and deletes the old one — unconditionally losing any
   container-fixed partition. (The alternative path,
   `FinishDiscardAndPreserveWebContents`, reuses the existing `WebContents`
   and would be safe for free — but it's gated behind
   `features::kWebContentsDiscard`, which is disabled by default upstream
   and not overridden anywhere in this fork.) Fixing this needs a hook in
   `FinishDiscard()` reading the discarded tab's `ContainerTabHelper`
   before `old_contents` is destroyed, mirroring `CreateTargetContents()`'s
   logic for the replacement `WebContents`.

None of these three block the core mechanism from being useful today — a
container tab that stays open behaves correctly for its entire session.
They matter once the user restarts the browser, discards the tab, or
reopens it via a saved workspace/tab group.

## File map

| File | Role |
|---|---|
| [`browser/containers/container_types.h/.cc`](../src/custom/browser/containers/container_types.cc) | `Container {id, name, color}`, `ToValue()`/`FromValue()` |
| [`browser/containers/container_service.h/.cc`](../src/custom/browser/containers/container_service.cc) | Per-profile `KeyedService`, CRUD + `GetStoragePartitionConfigForContainer()` |
| [`browser/containers/container_service_factory.h/.cc`](../src/custom/browser/containers/container_service_factory.cc) | Standard `BrowserContextKeyedServiceFactory`; OTR shares the parent profile's containers |
| [`browser/containers/container_tab_helper.h/.cc`](../src/custom/browser/containers/container_tab_helper.cc) | `WebContentsUserData` marking a tab's container, non-persisted (see "Known v1 gaps") |
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
