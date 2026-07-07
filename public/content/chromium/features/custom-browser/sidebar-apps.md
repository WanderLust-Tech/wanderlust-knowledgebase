# Sidebar Apps

An extension to the [sidebar](sidebar.md) that lets users pin native Windows
applications to the sidebar's pane-button strip. Right-clicking any `.lnk`
shortcut (desktop, File Explorer, Windows 10 Start) shows an **"Add to
Wanderlust Sidebar"** context menu entry. Clicking the pinned icon in the
sidebar launches the target executable directly.

Gated by `BUILDFLAG(ENABLE_SIDEBAR)` — there is no separate buildflag.
The feature is additive: the existing `SidebarContainerView` / `SidebarTopPane`
stay unchanged until the app list is non-empty.

## Shell integration — how the right-click entry gets there

No COM shell extension DLL is required. The installer writes two static
registry verbs under `HKEY_CLASSES_ROOT\lnkfile\shell`:

```
HKEY_CLASSES_ROOT\lnkfile\shell\AddToWanderlustSidebar
  (Default)  =  "Add to Wanderlust Sidebar"
  Icon       =  "C:\Program Files\Wanderlust\wanderlust.exe,0"

HKEY_CLASSES_ROOT\lnkfile\shell\AddToWanderlustSidebar\command
  (Default)  =  "\"C:\Program Files\Wanderlust\wanderlust.exe\" --add-to-sidebar \"%1\""
```

The installer expands `%PROGRAMFILES%` to the actual install path at write
time; the registry entries store absolute paths. The uninstaller deletes both
keys. No elevation is required for reads; the installer already runs elevated
to write to `HKEY_CLASSES_ROOT`.

**Coverage:**

| Surface | Outcome |
|---|---|
| Desktop `.lnk` shortcuts | ✅ Context menu entry appears |
| File Explorer shortcuts | ✅ Context menu entry appears |
| Windows 10 Start pinned apps | ✅ Start menu items are `.lnk`-backed |
| Windows 11 Start pinned apps | ❌ MSIX-backed; classic shell verbs are suppressed |
| Taskbar pinned apps | ❌ Taskbar jump-list context menus are not extensible without a COM extension DLL |

## Architecture

```
Installer
  └─► HKCR\lnkfile\shell\AddToWanderlust...  (registry verb)
        │
        │  user right-clicks .lnk, picks "Add to Wanderlust Sidebar"
        ▼
wanderlust.exe --add-to-sidebar "C:\path\to\shortcut.lnk"
        │
        ├── [browser already running]
        │     ProcessSingleton IPC (named pipe)
        │     ↳ first instance receives command line on UI thread
        │
        └── [browser not running]
              CustomMainExtraParts::PreMainMessageLoopRun()
              ↳ processes the flag, then opens a normal browser window
        │
        ▼
  ResolveLnkToSidebarApp()   (IShellLink + base::win::ResolveShortcut)
  Extracts: exe_path, display name, icon_path, icon_index
        │
        ▼
  SidebarAppRegistry::AddApp()     (KeyedService, per-profile)
  Writes to prefs: custom.sidebar.apps  (ListValue of dicts)
        │
        ▼
  SidebarAppsSection::OnAppsChanged()   (observer, View layer)
  Rebuilds icon row → SHGetFileInfo → gfx::ImageSkia
```

## .lnk resolution

`custom/browser/sidebar/sidebar_app_resolver_win.cc` — `#if BUILDFLAG(IS_WIN)`
guarded throughout.

Chromium's `base/win/shortcut.h` wraps `IShellLink` + `IPersistFile` for the
target path. The icon location is not exposed by that helper and requires a
direct `IShellLink::GetIconLocation` call:

```cpp
SidebarApp ResolveLnkToSidebarApp(const base::FilePath& lnk) {
  base::FilePath target;
  if (!base::win::ResolveShortcut(lnk, &target, nullptr))
    return {};

  wchar_t icon_buf[MAX_PATH] = {};
  int icon_index = 0;
  Microsoft::WRL::ComPtr<IShellLinkW> link;
  if (SUCCEEDED(CoCreateInstance(CLSID_ShellLink, nullptr,
                                 CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&link)))) {
    Microsoft::WRL::ComPtr<IPersistFile> pf;
    link.As(&pf);
    if (pf && SUCCEEDED(pf->Load(lnk.value().c_str(), STGM_READ)))
      link->GetIconLocation(icon_buf, MAX_PATH, &icon_index);
  }

  SidebarApp app;
  app.id         = ComputeAppId(target);   // SHA1 of exe_path, hex-encoded
  app.name       = lnk.BaseName().RemoveFinalExtension().AsUTF16Unsafe();
  app.exe_path   = target;
  app.icon_path  = icon_buf[0] ? base::FilePath(icon_buf) : target;
  app.icon_index = icon_index;
  app.added_at   = base::Time::Now();
  return app;
}
```

`CoCreateInstance` requires COM to be initialised on the calling thread.
`PreMainMessageLoopRun` and the `ProcessSingleton` notification callback both
run on the UI thread after Chromium's startup has called `CoInitialize` —
no extra initialisation is needed.

## Data model

### `SidebarApp` struct

`custom/browser/sidebar/sidebar_app.h`

```cpp
struct SidebarApp {
  std::string    id;           // SHA1(exe_path) as a hex string — dedup key
  std::u16string name;         // shortcut filename without extension
  base::FilePath exe_path;     // resolved .lnk target
  base::FilePath icon_path;    // path passed to SHGetFileInfo / ExtractIconEx
  int            icon_index = 0;
  base::Time     added_at;

  static SidebarApp   FromValue(const base::Value::Dict&);
  base::Value::Dict   ToValue() const;
};
```

`id` is derived from `exe_path` so that adding the same application twice
(e.g. via two different shortcuts that both point to `notepad.exe`) is a
no-op. Callers that resolve to the same `exe_path` always produce the same
`id`; `SidebarAppRegistry::AddApp` checks for the id before inserting.

### Pref storage

Stored under `custom.sidebar.apps` as a `base::Value::LIST` of dicts.
Registered in `RegisterCustomProfilePrefs()` alongside the other
`custom.sidebar.*` prefs.

```json
[
  {
    "id":         "a3f2c8e1...",
    "name":       "Notepad",
    "exe_path":   "C:\\Windows\\System32\\notepad.exe",
    "icon_path":  "C:\\Windows\\System32\\notepad.exe",
    "icon_index": 0,
    "added_at":   1748000000.0
  }
]
```

`added_at` is stored as a `base::Value::Double` of `base::Time::ToDoubleT()`.
Order in the list is insertion order; the UI presents them in that order.

## `SidebarAppRegistry` service

`custom/browser/sidebar/sidebar_app_registry.{h,cc}` +
`custom/browser/sidebar/sidebar_app_registry_factory.{h,cc}`

```cpp
class SidebarAppRegistry : public KeyedService {
 public:
  static SidebarAppRegistry* GetForProfile(Profile*);

  void AddApp(SidebarApp app);           // no-op if app.id already present
  void RemoveApp(const std::string& id);
  const std::vector<SidebarApp>& GetApps() const;
  void LaunchApp(const std::string& id);  // base::LaunchProcess

  base::CallbackListSubscription AddObserver(base::RepeatingClosure);

 private:
  void LoadFromPrefs();
  void SaveToPrefs();

  raw_ptr<PrefService>    prefs_;
  std::vector<SidebarApp> apps_;
  base::RepeatingCallbackList<void()> observers_;
};
```

`LaunchApp` calls `base::LaunchProcess({app.exe_path}, {})`. This does not go
through the shell, so it does not inherit any shell-associated elevation. If
the target executable has a manifest that requests elevation (`requireAdministrator`),
the launch will fail silently — acceptable for v1 since admin tools are an
edge case. Use `ShellExecuteEx` with `runas` if elevation becomes a
requirement.

## Startup handler

### Browser not running — first instance

```cpp
// custom/browser/custom_main_extra_parts.cc
void CustomMainExtraParts::PreMainMessageLoopRun() {
  const auto& cmd = *base::CommandLine::ForCurrentProcess();
  if (!cmd.HasSwitch("add-to-sidebar"))
    return;

  base::FilePath lnk = cmd.GetSwitchValuePath("add-to-sidebar");
  SidebarApp app = ResolveLnkToSidebarApp(lnk);
  if (app.exe_path.empty())
    return;

  Profile* profile = GetLastUsedProfile();
  SidebarAppRegistry::GetForProfile(profile)->AddApp(std::move(app));
  // The browser continues with its normal startup (opens a window).
  // Optionally: show a toast via ToastController ("Notepad added to sidebar").
}
```

### Browser already running — ProcessSingleton IPC

When the browser is running, `ProcessSingleton` forwards the second instance's
command line to the first instance over a named pipe. The second instance
exits without opening a window.

```cpp
// Register in CustomMainExtraParts::PreCreateMainMessageLoop():
process_singleton_->SetNotificationCallback(
    base::BindRepeating(&CustomMainExtraParts::OnSecondInstance,
                        base::Unretained(this)));

// Fires on the UI thread of the already-running instance:
ProcessSingleton::NotificationAckAction
CustomMainExtraParts::OnSecondInstance(
    const base::CommandLine& cmd,
    const base::FilePath& /*working_dir*/) {
  if (!cmd.HasSwitch("add-to-sidebar"))
    return ProcessSingleton::PROCESS_NOTIFIED;  // normal open-window path

  SidebarApp app =
      ResolveLnkToSidebarApp(cmd.GetSwitchValuePath("add-to-sidebar"));
  if (!app.exe_path.empty())
    SidebarAppRegistry::GetForProfile(GetLastUsedProfile())
        ->AddApp(std::move(app));

  return ProcessSingleton::PROCESS_NONE;  // second instance exits cleanly
}
```

`PROCESS_NONE` tells the second instance not to open a browser window — the
right behaviour when the sole purpose of that launch was to add an app.

## UI layer

### `SidebarAppsSection`

A new `views::View` added at the bottom of `SidebarContainerView` (below
the existing pane-button strip). It subscribes to `SidebarAppRegistry` and
rebuilds its icon row on any registry change.

```cpp
void SidebarAppsSection::OnAppsChanged() {
  RemoveAllChildViews();
  for (const auto& app : registry_->GetApps()) {
    auto* btn = AddChildView(std::make_unique<SidebarAppButton>(app));
    btn->SetCallback(base::BindRepeating(
        &SidebarAppRegistry::LaunchApp,
        base::Unretained(registry_), app.id));
    btn->SetContextMenuController(this);  // right-click → "Remove from Sidebar"
  }
  InvalidateLayout();
}
```

### Icon loading

Icons are loaded via `SHGetFileInfo` on a thread pool task (blocking I/O),
then handed back to the UI thread:

```cpp
base::ThreadPool::PostTaskAndReplyWithResult(
    FROM_HERE, {base::MayBlock()},
    base::BindOnce(&LoadIconForApp, app),     // SHGetFileInfo on pool thread
    base::BindOnce(&SidebarAppsSection::OnIconLoaded,
                   weak_factory_.GetWeakPtr(), app.id));
```

Request `SHGFI_ICON | SHGFI_SMALLICON` for the 16×16 rep; request again via
`SHGetImageList(SHIL_EXTRALARGE, ...)` for the 32×32 rep on HiDPI displays.
Convert both to `gfx::ImageSkia` with `gfx::win::CreateImageSkiaFromHICON`
and destroy the `HICON` with `DestroyIcon` immediately after conversion.
Cache by `app.id` — `OnAppsChanged` only fetches icons for ids not already
in the cache.

### Right-click context menu on an app button

`SidebarAppsSection` implements `views::ContextMenuController`.
`ShowContextMenuForViewImpl` builds a one-item `SimpleMenuModel`:

| Command | Label | Action |
|---|---|---|
| `kCmdRemoveApp` | "Remove from Sidebar" | `registry_->RemoveApp(id)` |

`RemoveApp` writes through to prefs and fires the observer, which triggers
`OnAppsChanged` and removes the button.

## New files

| File | Purpose |
|---|---|
| `custom/browser/sidebar/sidebar_app.h` | `SidebarApp` POD struct + `FromValue` / `ToValue` |
| `custom/browser/sidebar/sidebar_app_resolver_win.cc` | `ResolveLnkToSidebarApp` (Windows only, COM) |
| `custom/browser/sidebar/sidebar_app_registry.{h,cc}` | `KeyedService` — owns the list, persists prefs, notifies observers |
| `custom/browser/sidebar/sidebar_app_registry_factory.{h,cc}` | Standard `BrowserContextKeyedServiceFactory` |
| `custom/browser/ui/views/frame/sidebar_apps_section.{h,cc}` | View — icon row, rebuilds on observer callback |
| `custom/browser/ui/views/frame/sidebar_app_button.{h,cc}` | Individual icon button with tooltip |

`sidebar_app_resolver_win.cc` must be guarded at the GN level with
`if (is_win)` in `sources.gni` — the `IShellLink` headers are Windows-only.

## Pref registration

Add to `RegisterCustomProfilePrefs()`:

```cpp
registry->RegisterListPref(prefs::kSidebarApps);
```

And add the constant to `custom/common/custom_pref_names.h`:

```cpp
inline constexpr char kSidebarApps[] = "custom.sidebar.apps";
```

## Known limitations

| | |
|---|---|
| **Windows 11 Start not supported** | MSIX-backed pinned apps suppress classic shell verbs. No workaround without a packaged shell extension. |
| **Taskbar not supported** | Taskbar context menus are not extensible without a COM shell extension DLL. |
| **No elevation passthrough** | `base::LaunchProcess` does not request elevation. Executables with `requireAdministrator` manifests will fail silently. |
| **No drag-to-reorder** | Apps appear in insertion order. Reordering requires a drag-and-drop gesture on the `SidebarAppsSection` layout and writing the new order to prefs. |
| **No icon for non-`.exe` targets** | If a shortcut resolves to a `.bat`, `.cmd`, or document, `SHGetFileInfo` returns the generic file-type icon. No special handling exists. |
| **Icon cache is in-memory only** | Icons are re-fetched from disk on every browser start. Persisting them to the profile directory (as PNG) would speed up cold-start rendering of the app strip. |
| **English-only context menu** | "Remove from Sidebar" and "Add to Wanderlust Sidebar" are hardcoded strings. Wire to `IDS_SIDEBAR_APPS_*` resources when the feature stabilises. |
| **No duplicate-exe guard on the shell side** | The registry verb fires unconditionally. If the user adds the same executable twice via two different `.lnk` files, `SidebarAppRegistry::AddApp` silently drops the duplicate (same `id` = same `exe_path`), which is correct — but there's no feedback to the user explaining why nothing appeared. |
