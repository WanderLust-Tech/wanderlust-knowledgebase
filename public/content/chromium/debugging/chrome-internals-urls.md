# Chrome Internal URLs (Pseudo-URLs)

Chrome provides a set of internal URLs (pseudo-URLs) that allow developers and advanced users to access various debugging, configuration, and diagnostic tools. These URLs are accessible by typing them into the Chrome address bar.

---

## Common Chrome Internal URLs

### 1. Accessibility
- **URL**: `chrome://accessibility/`
- **Description**: Displays accessibility analysis tools. By default, accessibility is off. Clicking "Show Accessibility Tree" displays the analysis tree.

---

### 2. Application Cache
- **URL**: `chrome://appcache-internals/`
- **Description**: Displays a list of all application cache paths.

---

### 3. Installed Apps
- **URL**: `chrome://apps/`
- **Description**: Lists all currently installed Chrome apps.

---

### 4. Blob Files
- **URL**: `chrome://blob-internals/`
- **Description**: Displays the current list of internal blob files.

---

### 5. Bookmarks
- **URL**: `chrome://bookmarks/`
- **Description**: Opens the Bookmark Manager.

---

### 6. Cache
- **URL**: `chrome://cache/`
- **Description**: Displays a list of cached URLs. Clicking a URL shows detailed information about the cache file, including type, encoding, expiration time, and binary content.

---

### 7. Chrome About Page
- **URL**: `chrome://chrome/`
- **Description**: Displays the current Chrome version information.

---

### 8. Chrome URL List
- **URL**: `chrome://chrome-urls/`
- **Description**: Displays a list of all available Chrome pseudo-URLs.

---

### 9. Components
- **URL**: `chrome://components/`
- **Description**: Lists Chrome components. You can check for updates and download new versions if available.

---

### 10. Crashes
- **URL**: `chrome://crashes/`
- **Description**: Displays the current Chrome crash reports. Crash reporting must be enabled for this to work. Refer to [Google Support](https://support.google.com/chrome/answer/96817) for enabling crash reporting.

---

### 11. Device Logs
- **URL**: `chrome://device-log/`
- **Description**: Displays device logs. Use `chrome://device-log/?refresh=seconds` to enable automatic refresh.

---

### 12. Discards
- **URL**: `chrome://discards/`
- **Description**: Displays discarded tab pages, sorted by priority. Tabs with the lowest priority may be discarded if memory usage exceeds available resources.

---

### 13. DNS
- **URL**: `chrome://dns/`
- **Description**: Displays DNS pre-resolution and TCP pre-connection data. If disabled, you can enable "Pre-fetch resources for faster loading of web pages" in settings.

---

### 14. Downloads
- **URL**: `chrome://downloads/`
- **Description**: Opens the Downloads page.

---

### 15. Extensions
- **URL**: `chrome://extensions/`
- **Description**: Lists all installed extensions.

---

### 16. Experimental Features
- **URL**: `chrome://flags/`
- **Description**: Displays a list of experimental features that can be enabled or disabled.

---

### 17. GPU Information
- **URL**: `chrome://gpu/`
- **Description**: Displays GPU information, including hardware acceleration status and GPU memory buffer details.

---

### 18. Histograms
- **URL**: `chrome://histograms/`
- **Description**: Displays histogram data for browser performance metrics.

---

### 19. IndexedDB Internals
- **URL**: `chrome://indexeddb-internals/`
- **Description**: Displays a list of internal IndexedDB instances, including paths, modification times, and database sizes.

---

### 20. Inspect Devices
- **URL**: `chrome://inspect/`
- **Description**: Detects devices, pages, extensions, and apps. Displays all currently open tabs under the "Pages" tab, with an option to inspect them using developer tools.

---

### 21. Memory Usage
- **URL**: `chrome://memory/`
- **Description**: Redirects to `chrome://memory-redirect/`, showing memory usage for each process, including private, shared, and total memory.

---

### 22. Network Internals
- **URL**: `chrome://net-internals/`
- **Description**: Displays network-related information, including proxy settings, DNS cache, and timing data.

---

### 23. Plugins
- **URL**: `chrome://plugins/`
- **Description**: Displays information about installed plugins. (Note: This URL is deprecated in newer versions of Chrome.)

---

### 24. Print
- **URL**: `chrome://print/`
- **Description**: Opens the browser's print dialog.

---

### 25. Sync Internals
- **URL**: `chrome://sync-internals/`
- **Description**: Displays synchronization information for Chrome accounts, including last sync time, token requests, and event logs.

---

### 26. System Information
- **URL**: `chrome://system/`
- **Description**: Displays diagnostic data, including Chrome version, OS version, memory usage, and USB device information.

---

### 27. Tracing
- **URL**: `chrome://tracing/`
- **Description**: Allows recording and monitoring of Chrome's performance data.

---

### 28. User Actions
- **URL**: `chrome://user-actions/`
- **Description**: Displays a list of user actions, including the type of operation and when it occurred.

---

### 29. Version Information
- **URL**: `chrome://version/`
- **Description**: Displays detailed version information for Chrome, including the JavaScript engine version, Flash plugin version, and user agent string.

---

## References

For a complete list of Chrome internal URLs, visit `chrome://chrome-urls/` in your browser.

---

*This document consolidates information from various sources, including the Chromium documentation and external references.*