# Management Page (chrome://management)

A real enterprise-policy visibility page — reads actual
`policy::PolicyService` state rather than showing static/fake content,
so an unmanaged personal profile correctly shows "not managed" and a
genuinely enrolled profile shows real policy-driven data.

---

## Architecture

**Controller/handler:** `CustomManagementUI` / `CustomManagementHandler`
(`custom/browser/ui/webui/management/custom_management_{ui,handler}.{h,cc}`).
Host: `kChromeUICustomManagementHost = "management"`. No dedicated GN
flag — compiled in unconditionally.

`CustomManagementHandler` observes the real `policy::PolicyService`
(`AddObserver(POLICY_DOMAIN_CHROME, this)` on the profile's
`ProfilePolicyConnector`) and computes two flags:

- `account_managed_` — via `ProfilePolicyConnector::IsManaged()`
- `browser_managed_` — via `BrowserPolicyConnector::HasMachineLevelPolicies()`

| Message | Purpose |
|---|---|
| `getContextualManagedData` | The managed/unmanaged notice text, driven by the two flags above |
| `getExtensions` | Powerful extensions, via `PermissionMessageProvider` |
| `initBrowserReportingInfo` / `initProfileReportingInfo` | Reporting status, gated on real `enterprise_reporting::kCloudReportingEnabled` (local state) / `kCloudProfileReportingEnabled` (profile prefs), or the presence of an on-prem reporting extension ID |
| `getManagedWebsites` | Managed origins from `ManagedConfigurationAPI` |
| `getApplications` | Apps forced to run on OS login via policy (`web_app::RunOnOsLoginMode`, non-user-controllable) |

Fires `report-sources-updated` and `managedDataChanged` listeners on
change.

---

## Unmanaged vs. managed

On an **unmanaged personal profile**, both flags are false: the notice
reads roughly "Your browser is not managed," and every list (extensions,
reporting, websites, apps) is still genuinely queried but comes back
empty — there's no force-installed reporting extension, no cloud
reporting prefs set, no managed origins, no policy-pinned
run-on-login apps. This is real "nothing to report" behavior, not a
stub returning empty arrays unconditionally.

On a **managed profile or machine**, the notice text changes and the
lists above populate with whatever the real policy state actually
contains.

---

## Known limitations

Deliberately drops several upstream pieces this fork's policy
infrastructure doesn't support: `GetThreatProtectionInfo`, the GAIA
promotion banner, and the device-signals consent UI — there's no
enterprise-connectors infrastructure in this fork to back any of them.
