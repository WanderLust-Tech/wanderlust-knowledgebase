# Workspaces/Spaces

Tier 3 differentiator (full scope: tabs + sidebar config + proxy routing
per workspace), added 2026-08-01. A workspace is a named collection
scoped *inside* one profile — not a whole separate `Profile`, which is
too heavy a unit (see `custom_profile_picker`) — that groups: which real
Chromium `SavedTabGroup`s belong to it, which sidebar panel to show, and
which of the profile's existing proxy routing rules are active while
it's the current workspace.

## Why this shape

- **Tab membership = SavedTabGroup membership**, not a whole-tab-strip
  overhaul. Chromium has no native "hidden tab" primitive, so live
  show/hide reuses the real, already-shipped tab-group **collapse**
  mechanism (`tab_groups::TabGroupVisualData::is_collapsed()` +
  `TabStripModel::ChangeTabGroupVisuals()`) — the same toggle the
  color-dot collapse arrow already uses. A workspace's member groups
  expand (and reopen via `TabGroupSyncService::OpenTabGroup()` if closed
  elsewhere); its non-member groups collapse. **Ungrouped tabs are never
  touched by a workspace switch.**
- **Switching is profile-wide, not per-window.** `SidebarService` and
  `ProxyRoutingManager` are both profile-wide singletons with a single
  flat active-state slot each (confirmed: `sidebar.type` is one pref,
  proxy rules are one flat list) — there was no existing per-window
  scoping to build on for either, so a workspace switch updates every
  open `Browser` window of the profile at once (collapsing/expanding/
  reopening tab groups everywhere they appear) rather than trying to
  invent per-window sidebar/proxy state.
- **No native text-prompt dialog exists in this fork.** New workspaces
  are auto-named ("Workspace N"), mirroring
  `VerticalTabBar::SaveCurrentTabsAsSession()`'s exact same precedent.
  Renaming, color, sidebar panel, proxy rules, and tab-group assignment
  all happen on the `chrome://settings/workspaces` page instead.
- **The switcher is a native popup menu**, not a new WebUI panel —
  extends the vertical tab bar's existing right-click "Sort tabs by"
  background menu (`VerticalTabBarSortMenuDelegate`) with a "Switch
  workspace" submenu, "New workspace", and "Manage workspaces…", using
  the exact same dynamic-named-list-as-submenu pattern already used for
  that menu's Restore/Delete session entries.

## File map

| Path | Role |
|---|---|
| `custom/browser/workspaces/workspace_types.h/.cc` | `struct Workspace {id, name, color, sidebar_type, proxy_rule_ids[], saved_group_ids[]}` + `ToValue()`/`FromValue()` |
| `custom/browser/workspaces/workspace_service.h/.cc` | Per-profile `KeyedService`. CRUD (`CreateWorkspace`, `RenameWorkspace`, `SetWorkspaceColor`, `DeleteWorkspace`, `AssignGroupToWorkspace`/`RemoveGroupFromWorkspace`, `SetWorkspaceProxyRuleIds`, `SetWorkspaceSidebarType`) plus `SwitchToWorkspace(id)` — the core method described above |
| `custom/browser/workspaces/workspace_service_factory.h/.cc` | Standard `BrowserContextKeyedServiceFactory`, mirrors `ProxyRoutingManagerFactory` |
| `custom/browser/net/proxy_routing_manager.h/.cc` | Gained `ApplyRuleSubset(rule_ids)` — applies a PAC built from only the given rule ids without touching the stored rule list/prefs. `GeneratePacScript()`/`ApplyPac()` refactored into `GeneratePacScriptFrom()`/`ApplyPacScript()` helpers so both the full-list and subset paths share one PAC-building/applying implementation |
| `custom/browser/ui/views/frame/vertical_tab_bar.h/.cc` | `VerticalTabBarSortMenuDelegate` gained the workspace submenu (checkable, active workspace ticked) + New/Manage items; `VerticalTabBar` gained `GetWorkspaces()`, `GetActiveWorkspaceId()`, `SwitchToWorkspace()`, `CreateAndSwitchToNewWorkspace()`, `OpenWorkspacesSettings()` |
| `custom/browser/ui/webui/settings/custom_settings_handler.h/.cc` | New IPC: `workspacesGetAll`, `workspacesGetSavedGroups`, `workspacesCreate`, `workspacesUpdate`, `workspacesDelete`, `workspacesSwitchTo` + `workspacesChanged`/`workspacesActiveChanged` listeners |
| `custom/components/custom_settings/components/WorkspacesPage.tsx` | Management page — mirrors `ProxyRoutingPage.tsx`'s table + inline add/edit form shape exactly. Name, color swatch, sidebar-panel `<select>`, checkbox multi-select of saved tab groups (`workspacesGetSavedGroups`) and of existing proxy rules (reuses the existing `proxyRoutingGetRules` read — no new proxy IPC) |
| `custom/common/custom_pref_names.h` | `kWorkspacesList` (`workspaces.list`, syncable list pref), `kWorkspacesActiveId` (`workspaces.active_id`, unsynced string pref) |

## `SwitchToWorkspace(id)` step-by-step

1. Look up the outgoing (currently active) and incoming `Workspace`.
2. For each `saved_group_id` in the **outgoing** workspace: resolve via
   `TabGroupSyncService::GetGroup(sync_id)` → if it has a
   `local_group_id()` open in some window of the profile, collapse it
   there (`ChangeTabGroupVisuals(local_id, {..., is_collapsed: true})`).
3. For each `saved_group_id` in the **incoming** workspace: if open
   anywhere, expand it the same way; if not open anywhere,
   `TabGroupSyncService::OpenTabGroup(sync_id, TabGroupActionContextDesktop)`
   reopens it into the profile's last-active `Browser`.
4. `SidebarService::SetType(incoming.sidebar_type)`.
5. If `ProxyRoutingManager::IsEnabled()`: `ApplyRuleSubset(incoming.proxy_rule_ids)`.
   If proxy routing is disabled globally, workspace proxy selection is a
   no-op — it only takes effect when the user has turned routing on at
   all, so the workspace's rule subset never fights with the global
   on/off toggle.
6. Persist `workspaces.active_id`, notify observers.

## Known limitations (deferred, not fixed)

- This fork comments out `DisconnectSavedTabGroups` in
  `TabStripModel::CommandCloseTabsToLeft` (`tab_strip_model.cc:2466`) —
  pre-existing, unrelated to this feature, but means a saved group's
  membership can go stale on that one specific close path.
- No "Add to workspace ▸" entry on Chromium's own native tab-group
  color-dot context menu (that menu lives in vanilla
  `TabGroupEditorBubbleView`/related upstream files — patching it is a
  bigger, riskier upstream-file change than this fork-owned settings
  page). Group assignment for v1 happens from `chrome://settings/workspaces`'s
  checkbox multi-select instead.

## Manual test (post-build)

1. Create two `SavedTabGroup`s (right-click a tab group's color dot →
   "Save group", or however this fork's tab-group UI exposes it) in one
   window.
2. Open `chrome://settings/workspaces`, add two workspaces, assign one
   saved group to each, give each a different sidebar panel (and, if
   Smart Proxy Routing is enabled, a different proxy rule).
3. Right-click empty space in the vertical tab bar → **Switch workspace**
   → pick the first workspace. Confirm its assigned group expands (or
   reopens if it had been closed) and the other's group collapses to a
   pill, in every open window of the profile — ungrouped tabs untouched.
4. Confirm the sidebar panel switches to the workspace's chosen panel,
   and (if proxy routing is enabled) `chrome://net-internals/#proxy`
   reflects only that workspace's active rule(s).
5. Switch to the second workspace and repeat; switch back and forth to
   confirm the collapse/expand state and reopening both work reliably.
