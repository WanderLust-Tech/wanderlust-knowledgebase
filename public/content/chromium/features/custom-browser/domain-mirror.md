# Domain Mirror

"When I open **site A**, take me to **site B** instead." A per-profile list of
`source → destination` domain redirects applied **before any request is made**
to the original site — for using a mirror or alternative front-end of a site
that is blocked or slow for you, or simply preferring one host over another.

Not gated by a buildflag: with no rules configured it is a no-op (same approach
as UA overrides). Settings: `chrome://custom-settings/domain-mirror`
(Privacy and security → Domain Mirror).

Added in v1.11.6 (2026-10-12). Inspired by the "Uncensor Domains" extension in
the BitPop browser, re-designed to avoid its flaws: it redirected only after
the original request had already started, matched with a plain text suffix
(so `notexample.com` matched `example.com`), and trusted an unauthenticated
plain-HTTP rule list.

## Behaviour

- A rule applies to the source domain **and its subdomains**, preserving the
  subdomain prefix: with `example.com → mirror.net`, `www.example.com` goes to
  `www.mirror.net`. Matching is on label boundaries — `notexample.com` is not
  matched. Scheme, port, path, query and fragment are kept.
- Only main-frame **http(s) GET** navigations are rewritten. POSTs are never
  touched (re-opening would silently turn them into GETs). Server-side
  redirects into a mirrored domain are caught too (`WillRedirectRequest`).
- The original navigation is **cancelled before sending anything** and the mirror
  is opened as a fresh navigation, so every other throttle (parental controls,
  content policy, ad blocking) evaluates the *real* destination.
- After the mirror loads, an infobar says "Redirected a.example to b.example."
  with **Open original**. That button stops the rule until the browser restarts
  (a session-scoped bypass — nothing is persisted). Turn the bar off with
  *Tell me when a page was redirected*. To exempt a site permanently, disable
  its rule.
- Incognito windows use the regular profile's rules and session bypasses.
  Guest profiles have no service.

### Redirect-loop safety

`ValidateRuleSet()` rejects, at add/edit time:

- invalid host names (must be 2+ labels of `[a-z0-9-]`, ≤253 chars, non-numeric
  TLD — so IP literals, `localhost`, URLs, paths and ports are refused);
- duplicate sources;
- any rule whose destination is itself covered by a rule — including its own
  source (`a.test → a.test`, `a.test → www.a.test`), chains (`a→b`, `b→c`) and
  cycles (`a→b`, `b→a`).

Loop detection treats **every rule as enabled**, so re-enabling a disabled rule
later can never create a chain.

## Architecture

```
DomainMirrorNavigationThrottle  (registered in custom_content_browser_client.cc)
  │  main-frame http(s) only; WillStartRequest + WillRedirectRequest
  │  DomainMirrorService::Resolve(url) ──► DomainMirrorMatch | nullopt
  │       └─ ResolveMirror()  (pure, domain_mirror_rules)
  │  on a hit: DomainMirrorTabHelper::RedirectTo(...)  ──►  CANCEL_AND_IGNORE
  ▼
DomainMirrorTabHelper  (created on demand by the throttle; not in TabHelpers)
  │  posts OpenURL(mirror) async (same pattern as SchemeAliasNavigationThrottle)
  │  DidFinishNavigation: mirror host committed ──► DomainMirrorInfoBarDelegate
  ▼
DomainMirrorInfoBarDelegate (ConfirmInfoBarDelegate)
     Accept ("Open original") ──► helper->OpenOriginal() ──► service->AddSessionBypass(rule_id)
```

## Files

| Path | Purpose |
|---|---|
| `browser/domain_mirror/domain_mirror_rules.{h,cc}` | **Pure (base-only).** `DomainMirrorRule`, `NormalizeMirrorHost`, `ResolveMirror`, `ValidateRuleSet`, JSON round-trip. |
| `browser/domain_mirror/BUILD.gn` | `source_set("domain_mirror_core")` (linked via `custom_browser_deps`) + `test("domain_mirror_unittests")`. |
| `browser/domain_mirror/domain_mirror_service{,_factory}.{h,cc}` | Per-profile `KeyedService`. Rules in pref `custom.domain_mirror.rules`; `AddRule`/`UpdateRule` normalise and validate and return an error string; `Resolve(GURL)`; `AddSessionBypass`. Factory: `WithRegular(kRedirectedToOriginal)`, guest/ash `kNone`. |
| `browser/domain_mirror/domain_mirror_navigation_throttle.{h,cc}` | The throttle. |
| `browser/domain_mirror/domain_mirror_tab_helper.{h,cc}` | Async re-open + notice scheduling. |
| `browser/domain_mirror/domain_mirror_infobar_delegate.{h,cc}` | The notice. Identifier `WANDERLUST_DOMAIN_MIRROR_INFOBAR_DELEGATE = 135`. |
| `browser/ui/webui/settings/custom_settings_handler.{h,cc}` | `domainMirrorGetRules` / `AddRule` / `UpdateRule` / `DeleteRule`; fires `domainMirrorRulesChanged` (list) or `domainMirrorRuleError` (string). |
| `components/custom_settings/components/DomainMirrorPage.tsx` | Settings page. Route `domain-mirror` in `App.tsx`; card in `HubPages.tsx` (Privacy and security). |
| `common/custom_pref_names.h`, `browser/prefs/custom_prefs.cc` | `custom.domain_mirror.rules` (`"[]"`), `custom.domain_mirror.show_notice` (true). |

Vanilla Chromium patched: `components/infobars/core/infobar_delegate.h` (enum
value 135).

## Where to find it

| What | Where |
|---|---|
| Rules | Settings → Privacy and security → **Domain Mirror** (`chrome://custom-settings/domain-mirror`) |
| Rules pref | `custom.domain_mirror.rules` (JSON array of `{id, source, destination, enabled}`) |
| Redirect notice | `custom.domain_mirror.show_notice` (default on) |

## Not included (deliberately)

- **No remote/auto-updated list.** BitPop fetched an unauthenticated list over
  plain HTTP, which would let a poisoned list redirect users to an attacker's
  domain. If a curated list is ever added it must be HTTPS + signed, and any
  destination outside the source's registrable domain must be shown to the user
  rather than applied silently.
- **No wildcard/regex sources** — domains only, to keep loop detection exact.

## Tests

```
autoninja -C out/Debug domain_mirror_unittests
out\Debug\domain_mirror_unittests.exe
```

Covers host normalisation, label-boundary matching (including the
`notexample.com` case), first-match-wins, disabled/bypassed rules, loop/chain/
cycle rejection and JSON tolerance. The throttle, tab helper and infobar are
**not** unit-tested (they need a content browser test harness) — they were
verified by hand for v1.11.6, and this is the regression check to repeat:
add `example.com → example.org`, open `https://www.example.com/path?q=1`, expect
`https://www.example.org/path?q=1` plus the infobar; click **Open original**
and confirm the original loads and stays unredirected until restart.
