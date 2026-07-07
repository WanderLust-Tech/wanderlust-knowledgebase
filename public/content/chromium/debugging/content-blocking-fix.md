# Content Blocking Exception Configuration

## Overview
This file contains configuration to fix ERR_BLOCKED_BY_CLIENT errors in the WanderLust browser's sidebar webview content.

## Issue Description
- **Error**: `dilkochpjplnaiapncbdigfghljnlano is blocked`
- **Type**: `ERR_BLOCKED_BY_CLIENT`  
- **Context**: Sidebar webview content

## Root Cause Analysis

### Potential Blocking Mechanisms
1. **Privacy Guard URL Purification**: Even when disabled, may still affect some content
2. **Extension Content Blocking**: Browser security policies blocking extension-like IDs
3. **WebView Security Policies**: Chromium's built-in webview content restrictions
4. **Content Security Policy**: CSP headers blocking specific content types

### The Blocking ID
- **ID**: `dilkochpjplnaiapncbdigfghljnlano`
- **Type**: Appears to be a Chrome extension ID or resource identifier
- **Length**: 32 characters (standard Chrome extension ID format)

## Fixes and Workarounds

### Fix 1: Privacy Guard Override
Although Privacy Guard is disabled in configuration, ensure it's not affecting webview content:

```cpp
// In privacy_guard/core/url_purify_rule.cc
#if BUILDFLAG(CUSTOM_BROWSER) && BUILDFLAG(ENABLE_PRIVACY_GUARD)
bool URLPurifyRule::ShouldPurify(const GURL& url) {
  // Whitelist sidebar and webview content
  if (url.host().find("sidebar") != std::string::npos ||
      url.host().find("webview") != std::string::npos ||
      url.spec().find("dilkochpjplnaiapncbdigfghljnlano") != std::string::npos) {
    return false;
  }
  
  return ShouldPurifyInternal(url);
}
#endif
```

### Fix 2: Extension ID Whitelist
Create exception for the specific resource being blocked:

```cpp
// In browser security policies
class ContentBlockingExceptions {
 public:
  static bool IsWhitelisted(const std::string& identifier) {
    static const std::vector<std::string> whitelist = {
      "dilkochpjplnaiapncbdigfghljnlano",  // Sidebar webview content
      // Add other IDs as needed
    };
    
    return std::find(whitelist.begin(), whitelist.end(), identifier) != 
           whitelist.end();
  }
};
```

### Fix 3: WebView Content Policy Override
Modify webview content security policies:

```javascript
// For JavaScript-based content
if (typeof chrome !== 'undefined' && chrome.webview) {
  chrome.webview.contentSecurityPolicy = 
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: " +
    "chrome-extension://dilkochpjplnaiapncbdigfghljnlano/";
}
```

### Fix 4: Browser Command Line Flags
Add these flags to bypass content blocking during development:

```bash
# Development flags to disable blocking
--disable-web-security
--disable-site-isolation-for-policy
--disable-features=BlockInsecurePrivateNetworkRequests
--disable-extensions-http-throttling
--allow-running-insecure-content
```

### Fix 5: Content Security Policy Headers
If the content is served via HTTP, ensure proper CSP headers:

```
Content-Security-Policy: default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: chrome-extension://dilkochpjplnaiapncbdigfghljnlano/
```

## Implementation Steps

### Step 1: Update Build Configuration
1. Ensure Privacy Guard is disabled: `enable_privacy_guard = false`
2. Verify ad blocker is disabled: `enable_ad_blocker = false`
3. Clean and rebuild the browser

### Step 2: Add Development Flags (Temporary)
For testing, launch the browser with development flags:

```powershell
wanderlust-browser.exe --disable-web-security --allow-running-insecure-content
```

### Step 3: Check Browser Extensions
1. Open `chrome://extensions/` in the browser
2. Look for any extensions that might be blocking content
3. Temporarily disable all extensions to test

### Step 4: Inspect Network Requests
1. Open Developer Tools (F12)
2. Go to Network tab
3. Look for failed requests with ERR_BLOCKED_BY_CLIENT
4. Check the request headers for CSP violations

### Step 5: Test in Incognito Mode
Try accessing the sidebar content in incognito mode to bypass:
- Extensions
- Cached security policies
- User data that might affect blocking

## Debugging Tools

### Browser Debug Commands
```
chrome://net-internals/#events
chrome://network-error-logging/
chrome://content-security-policy/
chrome://site-engagement/
```

### Console Debugging
```javascript
// Check for CSP violations
console.log(document.contentSecurityPolicy);

// Check for blocked resources
performance.getEntriesByType('navigation').forEach(entry => {
  if (entry.name.includes('dilkochpjplnaiapncbdigfghljnlano')) {
    console.log('Resource status:', entry);
  }
});
```

## Verification Steps

### Test 1: Direct URL Access
Try accessing the blocked resource directly in the address bar:
```
chrome-extension://dilkochpjplnaiapncbdigfghljnlano/
```

### Test 2: Network Inspection
1. Open DevTools Network tab
2. Reload the page
3. Look for the blocked request
4. Check the failure reason

### Test 3: Console Errors
Check for JavaScript console errors related to:
- Content Security Policy violations
- CORS errors
- Extension API errors

## Emergency Workarounds

### Workaround 1: Disable All Security (Development Only)
```bash
# WARNING: Only for development testing
--disable-web-security --disable-site-isolation --disable-features=VizDisplayCompositor
```

### Workaround 2: Alternative Content Source
If the blocked content is not critical:
1. Replace the blocked resource with alternative content
2. Host content on a different domain
3. Use data URIs for small resources

### Workaround 3: Browser Reset
If the issue persists:
1. Clear browser data completely
2. Reset browser to default settings
3. Restart with clean profile

## Prevention

### Code Review Checklist
- [ ] Privacy Guard rules don't affect webview content
- [ ] Ad blocker exceptions include necessary resources  
- [ ] CSP policies allow required content sources
- [ ] Extension whitelist includes necessary IDs
- [ ] WebView security policies are appropriately configured

### Regular Testing
- Test sidebar content after each build
- Verify content loading in different browser modes
- Check for new blocking rules in dependency updates

---

*This document should be updated as new blocking mechanisms are discovered or as browser security policies change.*