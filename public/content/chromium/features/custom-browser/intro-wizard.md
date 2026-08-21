# First-Run Intro & Import Wizard (chrome://intro)

The real first-run flow — a Welcome step followed by a genuine
cross-browser import step (Firefox, legacy Edge bookmarks, or a
Bookmarks HTML file), backed by real, unmodified Chromium import
machinery rather than a placeholder.

---

## Where to find it

`chrome://intro` — normally reached automatically on first run; can also
be navigated to directly.

Registered under the same host vanilla Chromium uses (`intro`), swapped
in via `#if BUILDFLAG(ENABLE_CUSTOM_WEBUI)` in
`chrome_web_ui_configs.cc` — so upstream's real first-run trigger points
fire unmodified; only the rendered content at that host changes. Gated
by `enable_custom_webui` (default `true`), not a feature-specific flag.

---

## Architecture

**Controller/handler:** `CustomIntroUI` / `CustomIntroHandler`
(`custom/browser/ui/webui/intro/custom_intro_{ui,handler}.{h,cc}`).

| Message | Purpose |
|---|---|
| `initializeImportDialog` | Returns detected sources: name, index, profile name, and per-source booleans for history/favorites/passwords/search/autofill data availability |
| `importData` | `(browser index, item-type selection dict)` — kicks off the import |
| `importFromBookmarksFile` | Opens a native file picker for an HTML bookmarks file |

Real `ImporterList::DetectSourceProfiles()` /
`ExternalProcessImporterHost` / `ProfileWriter` do the actual work —
this is unmodified Chromium import infrastructure, not custom logic.
Progress is reported via a `FireWebUIListener("import-data-status-changed",
"inProgress" | "succeeded" | "failed")` sequence.

The selection dict maps to real prefs:
`kImportDialogAutofillFormData`, `kImportDialogBookmarks`,
`kImportDialogHistory`, `kImportDialogSavedPasswords`,
`kImportDialogSearchEngine`.

---

## Importable sources

Whatever `ImporterList` genuinely detects installed on the host machine:

- **Firefox** — full import (bookmarks, history, passwords, autofill, search engines)
- **Legacy Edge ("Spartan")** — bookmarks only
- **Safari** — macOS only
- **Bookmarks HTML File** — a synthetic source, not a browser; opens a file picker

There is **no Chrome importer** — this Chromium version doesn't ship one
upstream, and none was added.

---

## Known limitations

- Import errors surface only as the generic `"failed"` status string —
  no per-error detail (e.g. "profile locked," "corrupt data") reaches
  the JS side.
- Source detection depends entirely on what's actually installed and
  closed on the host machine (standard Chromium importer constraint,
  e.g. Firefox must not be running with a locked profile).
