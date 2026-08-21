# Sidebar Apps

An extension to the [sidebar](sidebar.md) that lets Windows users pin
native desktop applications (`.lnk` shortcuts) to the sidebar's
pane-button strip via a right-click shell context-menu entry. Clicking
the pinned icon launches the target executable directly.

> **Note on this doc's history:** an earlier version of this page was
> written as a pre-implementation spec — per the feature's own landing
> commit, "`docs/sidebar-apps.md` fully specified this feature, but no
> code existed for it at all." Three parts of that spec turned out
> different once actually built (registry scope, the exact shell-command
> syntax, and the UI layer), corrected below (2026-08-20/21, v1.8.36 +
> v1.8.38 fix).

Gated by `BUILDFLAG(ENABLE_SIDEBAR)` — no separate buildflag. The
feature is additive; the existing `SidebarContainerView`/`SidebarTopPane`
are unaffected until at least one app is pinned.

---

## Where to find it

Right-click any `.lnk` shortcut on the Desktop or in File Explorer →
"Add to Wanderlust Sidebar". Pinned apps appear as icons in the
sidebar's existing button strip.

---

## Shell integration — self-heal, not installer-driven

Unlike the original spec (which had the *installer* write elevated
`HKEY_CLASSES_ROOT` verbs), the shipped implementation registers a
**per-user, unelevated** verb under `HKEY_CURRENT_USER`, and does it as a
self-heal check on every browser launch rather than a one-time install
step:

```
HKEY_CURRENT_USER\Software\Classes\lnkfile\shell\AddToWanderlustSidebar
  (Default)  =  "Add to Wanderlust Sidebar"
  Icon       =  "<resolved exe path>,0"

HKEY_CURRENT_USER\...\AddToWanderlustSidebar\command
  (Default)  =  "<resolved exe path>" --add-to-sidebar="<lnk path>"
```

`EnsureSidebarAppsContextMenuRegistered()`
(`custom/browser/sidebar/sidebar_apps_shell_integration_win.cc`) runs
from `CustomMainExtraParts` on every launch. The common case is a single
registry read that finds the command already correct and returns —
writes only happen when it's missing or stale. This means installs that
somehow ended up with a broken or outdated verb (see the v1.8.38 fix
below) correct themselves on the very next browser start, with no
reinstall and no manual registry cleanup.

### v1.8.38 fix: the switch/value had to be one token

The shell command must join the switch and its value with `=` —
`--add-to-sidebar="%1"` — not space-separated
(`--add-to-sidebar "%1"`, what the feature originally shipped with in
v1.8.36). `base::CommandLine::IsSwitch()` splits argv tokens on `=`; it
does not pair a bare `--add-to-sidebar` flag with a following
*positional* argument as its value. With the space-separated form,
`HasSwitch("add-to-sidebar")` was true but
`GetSwitchValuePath("add-to-sidebar")` was always empty, so app
resolution silently failed — clicking the verb while the browser was
running did nothing, and on cold start the `.lnk` path fell through to
Chromium's default "open this file" handling instead of being pinned.

**Coverage** (unchanged from the original design):

| Surface | Outcome |
|---|---|
| Desktop `.lnk` shortcuts | ✅ Context menu entry appears |
| File Explorer shortcuts | ✅ Context menu entry appears |
| Windows 11 Start pinned apps | ❌ MSIX-backed; classic shell verbs are suppressed |
| Taskbar pinned apps | ❌ Not extensible without a COM shell extension DLL |

---

## Startup handling — cold start and already-running

```
wanderlust.exe --add-to-sidebar="C:\path\to\shortcut.lnk"
        │
        ├── [browser not running]
        │     CustomMainExtraParts (PostProfileInit)
        │     ↳ resolves the .lnk, pins the app, then opens a normal window
        │
        └── [browser already running]
              ProcessSingleton IPC → patched ProcessSingletonNotificationCallbackImpl
              in chrome/browser/chrome_browser_main.cc
              ↳ first instance receives the command line, pins the app;
                second instance exits without opening a window
```

---

## `.lnk` resolution

`custom/browser/sidebar/sidebar_app_resolver_win.cc` (Windows-only,
`#if BUILDFLAG(IS_WIN)`). Uses `base::win::ResolveShortcut` for the
target path plus a direct `IShellLink::GetIconLocation` call for the
icon (not exposed by the `base::win::shortcut` helper). Produces a
`SidebarApp` (`custom/browser/sidebar/sidebar_app.h`):

```cpp
struct SidebarApp {
  std::string    id;           // SHA1(exe_path) hex — dedup key
  std::u16string name;         // shortcut filename without extension
  base::FilePath exe_path;     // resolved .lnk target
  base::FilePath icon_path;    // path passed to SHGetFileInfo
  int            icon_index = 0;
  base::Time     added_at;
};
```

`id` is derived from `exe_path`, so pinning the same executable twice
via two different shortcuts is a silent no-op —
`SidebarAppRegistry::AddApp` checks for the id before inserting.

---

## `SidebarAppRegistry` — data model and storage

`custom/browser/sidebar/sidebar_app_registry.{h,cc}` (a per-profile
`KeyedService`) owns the list and persists it as a **JSON-string** pref,
`sidebar.apps` — mirroring `SidebarPinnedPanelsService`'s existing
JSON-string-pref pattern rather than a `base::Value::List` pref.
Exposes `AddApp`/`RemoveApp`/`GetApps()` and an `Observer` interface
(`OnSidebarAppsChanged()`) that the UI subscribes to.

---

## UI layer — reused, not new

The original spec called for dedicated `SidebarAppsSection`/
`SidebarAppButton` `views::View` classes. Neither exists in the shipped
code. Instead, pinned apps reuse `SidebarTopPane`'s existing
pinned-button infrastructure — the same code path already used for Web
Panels (see [Sidebar](sidebar.md)) — extended to also render
`SidebarAppRegistry`'s entries. Icons are loaded via `SHGetFileInfo` on
a thread-pool task (blocking I/O) and converted to `gfx::ImageSkia`, the
same pattern `SidebarTopPane` already used for Web Panel favicons.
Right-clicking a pinned app button shows a "Remove from Sidebar" entry,
wired to `SidebarAppRegistry::RemoveApp`.

---

## File map

| File | Purpose |
|---|---|
| `custom/browser/sidebar/sidebar_app.{h,cc}` | `SidebarApp` struct + `ToValue`/`FromValue` |
| `custom/browser/sidebar/sidebar_app_resolver_win.cc` | `.lnk` → `SidebarApp` resolution (Windows-only, COM) |
| `custom/browser/sidebar/sidebar_app_registry.{h,cc}` | `KeyedService` — owns the list, persists to prefs, notifies observers |
| `custom/browser/sidebar/sidebar_app_registry_factory.{h,cc}` | Standard `BrowserContextKeyedServiceFactory` |
| `custom/browser/sidebar/sidebar_apps_shell_integration_win.{h,cc}` | Self-heal registry verb registration |
| `custom/browser/custom_main_extra_parts.cc` | Cold-start `--add-to-sidebar` handling + calls the self-heal check |
| `custom/browser/ui/views/frame/sidebar_top_pane.{h,cc}` | Reused pinned-button UI, icon loading, context menu |

`sidebar_app_resolver_win.cc` and `sidebar_apps_shell_integration_win.cc`
are Windows-only at the GN level.

---

## Known limitations

| | |
|---|---|
| **Windows 11 Start not supported** | MSIX-backed pinned apps suppress classic shell verbs. |
| **Taskbar not supported** | Not extensible without a COM shell extension DLL. |
| **No elevation passthrough** | Launching a target with a `requireAdministrator` manifest will fail silently. |
| **No drag-to-reorder** | Apps appear in insertion order. |
| **No icon for non-`.exe` targets** | A shortcut resolving to a `.bat`/`.cmd`/document gets the generic file-type icon. |
| **English-only context menu** | "Remove from Sidebar" / "Add to Wanderlust Sidebar" are hardcoded strings, not localized resources. |
