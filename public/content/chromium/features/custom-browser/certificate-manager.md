# Certificate Manager (chrome://certificate-manager)

**Status: stub.** No backend exists yet — this page does not currently
do anything beyond render.

> Note: the QA testing checklist's Fleet Smoke Test entry for this page
> ("certificate list loads") is inaccurate as written; nothing loads.
> Worth correcting there too.

---

## What exists today

`CustomCertificateManagerUI`/`CustomCertificateManagerUIConfig`
(`custom/browser/ui/webui/certificate_manager/custom_certificate_manager_ui.{h,cc}`)
is a plain `content::WebUIController` + `content::DefaultWebUIConfig<>`
with **zero** `WebUIMessageHandler` attached — no `RegisterMessages()`,
no `chrome.send`/mojo wiring of any kind.

The React component
(`custom/components/custom_certificate_manager/App.tsx`) is a static
placeholder card reading "The certificate manager UI for this Wanderlust
WebUI is not wired up yet," with a note directing users to the OS
certificate store in the meantime.

Host constant: `kChromeUICustomCertificateManagerHost = "certificate-manager"`.
No dedicated GN build flag — always compiled in.

---

## What real implementation would need

Per the placeholder's own code comment: the upstream `certificate_manager`
mojo interface — root-store enumeration, fingerprint display,
import/export (PEM/PKCS12), and a trust-flag editor — plus handling the
cross-platform certificate-store differences (NSS on Linux, CryptoAPI on
Windows, Keychain on macOS) that interface hides.

---

## Where to find it

`chrome://certificate-manager` — loads, but is inert.
