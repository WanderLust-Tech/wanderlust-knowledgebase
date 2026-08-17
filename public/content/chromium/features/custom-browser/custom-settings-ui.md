# Custom Settings UI

> **Retired 2026-08-17.** This page described an architecture that never
> existed in this codebase — a hand-written `components/custom_settings_ui/`
> directory with a `CustomSettingsHandler::HandleGetCustomSettings`/
> `HandleSetCustomSetting`/`HandleResetCustomSettings` message trio, a static
> `custom_settings_page.html` template, a vanilla-JS `CustomSettingsPage`
> controller, and a hand-rolled `web_ui("custom_settings_resources")` GN
> template. None of that ever existed; it appears to have been written
> speculatively (or generated) before the real feature was built, and was
> never corrected. `custom-webui/pages-inventory.md` flagged this page as
> no longer matching the real code.
>
> The real settings surface is `chrome://settings`, a React/TypeScript SPA
> at `src/custom/components/custom_settings/` (directory has **no** `_ui`
> suffix) — a hub-and-spoke app with ~30 sub-pages under
> `components/*Page.tsx`, routed by `App.tsx`'s `ROUTES` map, built via the
> `build_react_webui("custom_settings")` GN template (not a hand-rolled
> `source_set`/`web_ui()` pair). Its native backend is
> `browser/ui/webui/settings/custom_settings_ui.h/.cc` (the
> `WebUIController`) plus `custom_settings_handler.h/.cc` (a large,
> ~90-message `settings::SettingsPageUIHandler` covering everything from
> generic pref read/write — `customGetPrefs`/`customSetPref`/
> `customObservePrefs`, the real protocol the frontend's `usePref()` hook
> talks to — to search engines, autofill, site permissions, workspaces,
> and dozens of other features).
>
> For an accurate description of this architecture, see:
> - [`custom-webui/pages-inventory.md`](custom-webui/pages-inventory.md)'s
>   "Multi-page hubs" section, which documents `custom_settings`'s real
>   structure directly.
> - [`custom-webui/getting-started.md`](custom-webui/getting-started.md),
>   which walks through the real React → esbuild → grit → `.pak` →
>   `WebUIController` pipeline, using `custom_settings` as its worked
>   example.

---

*This page is intentionally left short — it exists only so the URL
doesn't 404 for anything still linking to it. See the pointers above for
the real documentation.*
