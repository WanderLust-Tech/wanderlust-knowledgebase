# Workspaces (Spaces)

A **workspace** is a named, coloured, per-profile bundle that switches several
things at once: which of your saved tab groups are open, which sidebar panel is
showing, and which smart-proxy-routing rules are live. A workspace never owns
any tabs itself — it only points at things that already exist. Switching one is
a single action that applies to every open window of the profile. A restart bug
was fixed in v1.11.12 (see [History](#history)).

---

## Where to find it

- **Switch / create:** right-click empty space in the vertical tab bar →
  **Switch workspace ▸** (a check mark shows the active one), **New workspace**,
  **Manage workspaces…**. The submenu is left out entirely while you have no
  workspaces. The horizontal tab strip has no way to switch; the vertical tab
  bar's menu is the only in-browser switch surface.
- **Edit:** Settings page `chrome://settings/workspaces` — name, colour, sidebar
  panel, saved tab groups and proxy rules for each workspace.

Always compiled in (no build flag). Workspaces are stored per profile and are
**not** synced. An incognito window shares its parent profile's workspaces.

**Prefs:** `workspaces.list` (list of workspace dicts, default empty) and
`workspaces.active_id` (string, empty = none).

---

## What a switch does

Switching to workspace *W* (`WorkspaceService::SwitchToWorkspace`):

1. Collapses the saved tab groups of the workspace you are leaving.
2. Expands the groups assigned to *W*, and re-opens any that are closed.
3. Sets the sidebar to *W*'s panel.
4. If Smart Proxy Routing is on, applies *W*'s subset of proxy rules.
5. Remembers *W* as the active workspace.

Tabs that are not in a saved tab group are never touched. A workspace can only
*narrow* which of your proxy rules are live — it cannot enable a rule you
disabled, and a workspace with no rules selected switches routing to "no rules".

### Data model

```
Workspace {
  id              lowercase UUID, generated on create
  name            empty → "Workspace N"
  color           "#RRGGBB" swatch, may be empty
  sidebar_type    sidebar panel to restore on switch
  proxy_rule_ids  ids of Smart Proxy Routing rules to keep live
  saved_group_ids UUIDs of Chromium SavedTabGroups
}
```

Groups are **referenced, not copied**: tab titles, colours and sync stay owned by
Chromium's tab-group sync service, which is why a switch can re-open a group with
the stock open-group path and why groups still restore normally.

Each saved workspace carries a `schemaVersion` (currently 1); a build ignores a
workspace written by a newer version.

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/workspaces/workspace_types.{h,cc}` | The `Workspace` struct and its (de)serialisation |
| `custom/browser/workspaces/workspace_service.{h,cc}` | The per-profile service: CRUD, switch, observers |
| `custom/browser/workspaces/workspace_service_factory.{h,cc}` | Factory; created with the profile; shares the original profile in incognito |
| `custom/browser/ui/webui/settings/custom_settings_handler.cc` | `workspacesGetAll` / `GetSavedGroups` / `Create` / `Update` / `Delete` / `SwitchTo` messages |
| `custom/components/custom_settings/components/WorkspacesPage.tsx` | The settings page |
| `custom/browser/ui/views/frame/vertical_tab_bar.{h,cc}` | The vertical-tab-bar menu items |
| `custom/common/custom_pref_names.h`, `custom/browser/prefs/custom_prefs.cc` | The two prefs |

No vanilla Chromium patches.

---

## Known limitations

- **Restarting does not re-run the switch.** The active workspace id is restored,
  but the sidebar, proxy PAC and group collapsed state "survive" only because
  those services persist themselves.
- **Deleting the active workspace** clears the active id but leaves the sidebar
  panel and proxy subset as that workspace left them until the next switch.
- **Turning proxy routing off and on again** resets to *all* rules, discarding the
  workspace's subset until the next switch.
- **A deleted saved group** (locally or via sync) leaves its id in the workspace;
  it is skipped silently.
- **Several windows:** a switch re-opens groups into whichever window of the
  profile Chromium returns, not necessarily the one you switched from; if no
  window exists nothing is opened.
- **Default names are not unique:** create, create, delete the first, create again
  gives two "Workspace 2". Ids are unique.
- **Downgrading** to an older build and then editing can erase workspaces written
  by a newer build (the older build drops them on load and rewrites the list).

### History

- **v1.11.12:** the workspace service used to be created lazily, so after a
  restart the settings list was empty and the "Switch workspace" submenu was
  missing until something wrote to it. Nothing was lost. The service is now
  created with the profile.

See the [QA checklist](qa-testing-checklist) section "Workspaces (Spaces)" for the
manual test steps.
