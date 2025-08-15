# Factory Pattern

The Factory pattern provides a way to create objects without specifying the exact class of the object to create. Chromium uses factories to abstract platform-specific or feature-specific instantiation.

---

## 1. Purpose & Usage

- **Encapsulate object creation**: hide complex `new` logic behind factory methods.
- **Examples**: creating platform-specific UI widgets, protocol handlers, URLLoader instances.

---

## 2. Key Interfaces & Classes

- **`Factory` classes**: static `Create()` methods returning interface pointers.

- **`BrowserMainParts`** (`chrome/browser/browser_main_parts.h`)
  - Factory for initializing browser process parts per platform.
  - E.g. `CreateBrowserMainParts()` returns `BrowserMainParts` for Windows, Mac, Linux.

- **`URLLoaderFactory`**
  - In Renderers, `RenderFrameHostImpl` uses `mojo::PendingRemote<network::mojom::URLLoaderFactory>` factory proxy.

---

## 3. Usage in Code

1. **Platform Parts**
   ```cpp
   std::unique_ptr<BrowserMainParts> parts(
       CreateBrowserMainParts(executable_path));
   ```

2. **Content Module Factories**

  - RenderProcessHostFactory::Create() (controlled by --renderer-process-type).

3. **Service Factories**

  - ServiceManagerConnection::GetForProcess()->GetConnector() provides factories for services.

## 4. Best Practices

- Keep factory methods lightweight; move heavy initialization into Init() methods.

- Use interfaces (std::unique_ptr<MyInterface>) to allow mocking in tests.

## 5. Links & References

- chrome/browser/browser_main_parts.h

- content/public/browser/render_process_host_factory.h