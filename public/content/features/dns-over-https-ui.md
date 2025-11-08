# DNS-over-HTTPS (DoH) UI Feature Implementation

## Table of Contents
1. [Overview](#overview)
2. [Feature Background](#feature-background)
3. [Implementation Architecture](#implementation-architecture)
4. [UI Components](#ui-components)
5. [Backend Implementation](#backend-implementation)
6. [Code Review Process](#code-review-process)
7. [Testing Strategy](#testing-strategy)
8. [Platform Considerations](#platform-considerations)
9. [Security & Privacy](#security--privacy)
10. [Performance Considerations](#performance-considerations)
11. [Development Lessons](#development-lessons)
12. [Related Documentation](#related-documentation)

## Overview

The DNS-over-HTTPS (DoH) UI feature represents a significant privacy and security enhancement to Chrome, allowing users to encrypt their DNS queries through HTTPS. This document provides a comprehensive analysis of the feature implementation based on the original code review (CL 1194946) from Chrome M71.

**Feature Summary:**
- **Purpose**: Enable user-friendly configuration of DNS-over-HTTPS
- **Target Release**: Chrome M71 (September 2018)
- **Implementation Scope**: Frontend UI settings + backend integration
- **User Benefit**: Enhanced privacy and security for DNS resolution

## Feature Background

### What is DNS-over-HTTPS?

DNS-over-HTTPS (DoH) is an IETF standard ([RFC 8484](https://tools.ietf.org/html/draft-ietf-doh-dns-over-https-14)) that encrypts DNS queries by sending them over HTTPS connections rather than plain text UDP/TCP connections.

**Benefits:**
- **Privacy Protection**: DNS queries are encrypted and cannot be easily monitored
- **Security Enhancement**: Protection against DNS manipulation and spoofing
- **Bypass Censorship**: DNS-based content blocking becomes ineffective
- **ISP Independence**: Reduces reliance on ISP-provided DNS servers

### Pre-Implementation Status

Before this feature:
- Chrome had backend DoH implementation accessible via command-line flags
- No user-accessible interface for configuring DoH servers
- Feature was hidden from general users

### User Experience Goals

The feature aimed to provide:
1. **Simple Toggle**: Easy enable/disable of secure DNS
2. **Provider Selection**: Dropdown of pre-approved DoH providers  
3. **Custom Configuration**: Allow advanced users to specify custom DoH servers
4. **Automatic Detection**: Intelligent method selection (GET vs POST)

## Implementation Architecture

### Component Overview

The DoH UI implementation spans multiple layers of Chrome's architecture:

```text
┌─────────────────────────────────────────────────────────────┐
│                     Privacy Settings UI                     │
│                  privacy_page.html/js                      │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Secure DNS Input Component                 │
│               secure_dns_input.html/js                     │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Settings Handler (C++)                      │
│            settings_secure_dns_handler.cc/h                │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              System Network Context Manager                 │
│           system_network_context_manager.cc                │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Network Service                          │
│                network_service.cc                          │
└─────────────────────────────────────────────────────────────┘
```

### File Structure

The implementation touched 30 files across Chrome's codebase:

**UI Layer:**
- `chrome/browser/resources/settings/privacy_page/privacy_page.{html,js}`
- `chrome/browser/resources/settings/privacy_page/secure_dns_input.{html,js}`
- `chrome/app/settings_strings.grdp` (localization)

**Backend Layer:**
- `chrome/browser/ui/webui/settings/settings_secure_dns_handler.{cc,h}`
- `chrome/browser/net/system_network_context_manager.cc`
- `services/network/network_service.cc`

**Preferences:**
- `chrome/common/pref_names.{cc,h}`
- `chrome/common/chrome_features.{cc,h}`

**Networking:**
- `net/dns/dns_util.{cc,h}`

## UI Components

### Privacy Page Integration

The DoH settings are integrated into Chrome's Privacy and Security settings page:

```html
<!-- Location: chrome/browser/resources/settings/privacy_page/privacy_page.html -->
<settings-toggle-button 
    class="cr-row"
    pref="{{prefs.dns.secure_dns.enabled}}"
    label="$i18n{secureDnsLabel}"
    sub-label="[[getSecureDnsDescription_(prefs.dns.secure_dns.enabled.value)]]">
</settings-toggle-button>

<div class="cr-row continuation" 
     hidden$="[[!prefs.dns.secure_dns.enabled.value]]">
  <div class="start settings-box-text">
    <settings-radio-group
        pref="{{prefs.dns.secure_dns.use_preapproved}}"
        options="[[secureDnsRadioOptions_]]">
    </settings-radio-group>
    
    <secure-dns-input
        pref="{{prefs.dns.secure_dns.custom_server}}"
        hidden$="[[prefs.dns.secure_dns.use_preapproved.value]]">
    </secure-dns-input>
  </div>
</div>
```

### Secure DNS Input Component

Custom component for DoH server configuration:

```javascript
// Location: chrome/browser/resources/settings/privacy_page/secure_dns_input.js
Polymer({
  is: 'secure-dns-input',
  
  properties: {
    pref: Object,
    showError: {
      type: Boolean,
      value: false,
    }
  },

  /** @private */
  onInput_: function() {
    this.validateInput_();
  },

  /** @private */
  validateInput_: function() {
    const valid = this.browserProxy_.validateCustomDnsEntry(this.value);
    this.showError = !valid && this.value.length > 0;
    
    if (!valid && this.value.length > 0) {
      this.fire('value-rejected');
    }
  }
});
```

### User Interface Flow

1. **Initial State**: Toggle for "Use secure DNS" is off by default
2. **Enable DoH**: User toggles secure DNS on
3. **Provider Selection**: 
   - Radio button: "Use pre-approved providers" (default)
   - Radio button: "Use custom provider"
4. **Custom Configuration**: Text input for custom DoH server templates
5. **Validation**: Real-time validation of custom server URLs
6. **Error Handling**: Clear error messages for invalid configurations

## Backend Implementation

### Settings Handler

The `SettingsSecureDnsHandler` class bridges the UI and Chrome's preferences system:

```cpp
// Location: chrome/browser/ui/webui/settings/settings_secure_dns_handler.cc
class SettingsSecureDnsHandler : public settings::SettingsPageUIHandler {
 public:
  SettingsSecureDnsHandler() = default;
  ~SettingsSecureDnsHandler() override = default;

  // SettingsPageUIHandler implementation
  void RegisterMessages() override;
  void OnJavascriptAllowed() override;
  void OnJavascriptDisallowed() override;

 private:
  void HandleGetSecureDnsResolverList(const base::ListValue* args);
  void HandleValidateCustomDnsEntry(const base::ListValue* args);
  
  // Pre-approved DoH providers list
  std::vector<SecureResolver> GetSecureResolverList();
};

struct SecureResolver {
  int name_id;
  std::string template_uri;
  bool default_selection;
};
```

### Preference Management

DoH configuration is managed through Chrome's preference system:

```cpp
// Location: chrome/common/pref_names.cc
namespace prefs {
  // Whether secure DNS is enabled
  const char kDnsOverHttpsMode[] = "dns.secure_dns.enabled";
  
  // Whether to use pre-approved providers vs custom
  const char kDnsOverHttpsUsePreapproved[] = "dns.secure_dns.use_preapproved";
  
  // Custom DoH server template
  const char kDnsOverHttpsCustomTemplate[] = "dns.secure_dns.custom_server";
  
  // Selected pre-approved provider
  const char kDnsOverHttpsPreapprovedProvider[] = "dns.secure_dns.preapproved_selection";
}
```

### Network Service Integration

The `SystemNetworkContextManager` observes preference changes and updates the network service:

```cpp
// Location: chrome/browser/net/system_network_context_manager.cc
void SystemNetworkContextManager::OnPrefChanged() {
  // Observe DoH preference changes
  PrefService* local_state = g_browser_process->local_state();
  
  bool secure_dns_enabled = local_state->GetBoolean(prefs::kDnsOverHttpsMode);
  bool use_preapproved = local_state->GetBoolean(prefs::kDnsOverHttpsUsePreapproved);
  
  if (secure_dns_enabled) {
    std::vector<std::string> doh_servers;
    
    if (use_preapproved) {
      // Use pre-approved provider list
      doh_servers = GetPreapprovedDoHServers();
    } else {
      // Use custom server template
      std::string custom_template = local_state->GetString(prefs::kDnsOverHttpsCustomTemplate);
      if (IsValidDoHTemplate(custom_template)) {
        doh_servers.push_back(custom_template);
      }
    }
    
    // Update network service configuration
    network_service_->ConfigureSecureDns(doh_servers);
  }
}
```

### DNS Template Validation

Server template validation ensures user-provided URLs are valid DoH endpoints:

```cpp
// Location: net/dns/dns_util.cc
bool IsValidDoHTemplate(const std::string& server_template) {
  GURL url(server_template);
  
  if (!url.is_valid() || !url.SchemeIs(url::kHttpsScheme)) {
    return false;
  }
  
  // Check for template variables indicating GET method
  if (server_template.find("{") != std::string::npos) {
    // GET method template validation
    return url.has_query();
  }
  
  // POST method endpoint validation
  return true;
}
```

## Code Review Process

### Initial Submission

The implementation went through extensive code review (CL 1194946) with multiple iterations:

**Initial Comments (Michael Giuffrida):**
- Concerns about code size and feature freeze timing
- Request for DoH abbreviation explanation
- Questions about client-side business logic placement

**Key Review Feedback:**

1. **Architecture Concerns:**
   ```
   "This method observes two prefs, not the toggle buttons. So the Settings UI 
   is responsible for enabling/disabling secure DNS when the underlying prefs change?
   
   Generally if Chrome needs to update something when prefs change, Chrome should 
   observe those prefs directly in C++."
   ```

2. **UI Component Design:**
   ```
   "I think this element is doing too much. It should only concern itself with 
   emitting a text value for the custom DNS field."
   ```

3. **Security Considerations:**
   ```
   "Variables with static storage duration are not allowed (unless the destructor 
   is trivial): https://google.github.io/styleguide/cppguide.html#Static_and_Global_Variables"
   ```

### Resolution Pattern

The implementation evolved through multiple patch sets addressing:

1. **Preference Initialization**: Moved from JavaScript to C++ `RegisterPrefs()`
2. **Component Responsibility**: Simplified custom input component
3. **Architecture Cleanup**: Moved pref observation logic to `SystemNetworkContextManager`
4. **Code Style**: Addressed C++ style guide violations
5. **Testing**: Added comprehensive unit and browser tests

### Final Architecture

The final design properly separated concerns:
- **UI Layer**: Only handles user interactions and validation display
- **Settings Handler**: Validates input and manages pre-approved provider list
- **System Manager**: Observes preferences and configures network service
- **Network Service**: Handles actual DoH implementation

## Testing Strategy

### Unit Tests

Comprehensive testing of the settings handler:

```cpp
// Location: chrome/browser/ui/webui/settings/settings_secure_dns_handler_unittest.cc
class SettingsSecureDnsHandlerTest : public testing::Test {
 protected:
  void SetUp() override {
    local_state_ = std::make_unique<ScopedTestingLocalState>(
        TestingBrowserProcess::GetGlobal());
    handler_ = std::make_unique<TestSecureDnsHandler>();
  }

  void TestValidateCustomDnsTemplate(const std::string& template_uri,
                                   bool expected_valid) {
    local_state()->SetBoolean(prefs::kDnsOverHttpsUsePreapproved, false);
    
    base::ListValue args;
    args.AppendString(kCallbackId);
    args.AppendString(template_uri);
    
    handler()->HandleValidateCustomDnsEntry(&args);
    
    const content::TestWebUI::CallData& data = *web_ui()->call_data().back();
    EXPECT_EQ("cr.webUIResponse", data.function_name());
    EXPECT_EQ(kCallbackId, data.arg1()->GetString());
    EXPECT_EQ(expected_valid, data.arg2()->GetBool());
  }
};

TEST_F(SettingsSecureDnsHandlerTest, ValidateCustomDnsTemplate) {
  TestValidateCustomDnsTemplate("https://dns.google/dns-query{?dns}", true);
  TestValidateCustomDnsTemplate("https://cloudflare-dns.com/dns-query", true);
  TestValidateCustomDnsTemplate("http://insecure.example.com/dns-query", false);
  TestValidateCustomDnsTemplate("invalid-url", false);
}
```

### Browser Tests

Integration testing of the complete feature:

```cpp
// Location: chrome/browser/net/system_network_context_manager_browsertest.cc
IN_PROC_BROWSER_TEST_F(SystemNetworkContextManagerBrowserTest, SecureDnsUIChange) {
  PrefService* local_state = g_browser_process->local_state();
  
  // Test enabling DoH with pre-approved providers
  local_state->SetBoolean(prefs::kDnsOverHttpsMode, true);
  local_state->SetBoolean(prefs::kDnsOverHttpsUsePreapproved, true);
  local_state->SetString(prefs::kDnsOverHttpsPreapprovedProvider, 
                        kGooglePostTemplate);
  
  auto servers = GetConfiguredDoHServers();
  EXPECT_EQ(1u, servers.size());
  EXPECT_EQ(kGooglePostTemplate, servers[0]);
  
  // Test custom provider configuration
  local_state->SetBoolean(prefs::kDnsOverHttpsUsePreapproved, false);
  local_state->SetString(prefs::kDnsOverHttpsCustomTemplate, 
                        kCustomGetTemplate);
  
  servers = GetConfiguredDoHServers();
  EXPECT_EQ(1u, servers.size());
  EXPECT_EQ(kCustomGetTemplate, servers[0]);
}
```

### WebUI Tests

Frontend component testing:

```javascript
// Location: chrome/test/data/webui/settings/privacy_page_test.js
suite('PrivacyPageTest', function() {
  let page;
  let testBrowserProxy;

  setup(function() {
    testBrowserProxy = new TestPrivacyPageBrowserProxy();
    settings.PrivacyPageBrowserProxyImpl.instance_ = testBrowserProxy;
    
    PolymerTest.clearBody();
    page = document.createElement('settings-privacy-page');
    page.prefs = createTestPrefs();
    document.body.appendChild(page);
  });

  test('SecureDnsInputFocus', function() {
    page.set('prefs.dns.secure_dns.enabled.value', true);
    page.set('prefs.dns.secure_dns.use_preapproved.value', false);
    
    Polymer.dom.flush();
    
    const secureDnsInput = page.$$('secure-dns-input');
    assertTrue(!!secureDnsInput);
    
    const input = secureDnsInput.$$('#input');
    assertFalse(input.focused);
    
    secureDnsInput.focus();
    assertTrue(input.focused);
  });
});
```

## Platform Considerations

### Chrome OS Integration

Special considerations for Chrome OS deployment:

**Question from Code Review:**
> "Some of this code is Chrome OS only, but some is included on Chrome OS. What's the plan there?"

**Implementation Approach:**
- Core DoH functionality available on all platforms
- Platform-specific UI adjustments where needed
- Consistent user experience across desktop platforms

### Mobile Platforms

The feature was designed primarily for desktop Chrome, with mobile considerations for future implementation:

- **Android**: Backend support ready, UI integration separate effort
- **iOS**: Limited by platform networking restrictions

## Security & Privacy

### Privacy Benefits

DoH provides significant privacy enhancements:

1. **Query Encryption**: DNS requests encrypted in transit
2. **ISP Independence**: Bypass ISP DNS monitoring
3. **Censorship Resistance**: Harder to block DNS-based filtering

### Security Considerations

**Input Validation:**
- Strict validation of custom DoH server URLs
- HTTPS-only enforcement for custom servers
- Template parameter validation for GET requests

**Default Provider Curation:**
- Pre-approved provider list managed by Chrome team
- Regular security audits of recommended providers
- Geographic diversity for performance

### Potential Risks

**Centralization Concerns:**
- Risk of DNS centralization if users default to major providers
- Mitigated by allowing custom provider configuration

**Performance Impact:**
- HTTPS overhead for DNS queries
- Mitigated by connection reuse and HTTP/2

## Performance Considerations

### DNS Query Performance

**Optimization Strategies:**
1. **Connection Reuse**: HTTPS connections kept alive for multiple queries
2. **HTTP/2 Multiplexing**: Multiple DNS queries over single connection
3. **Caching**: Standard DNS caching still applies
4. **Fallback**: Graceful degradation to traditional DNS if DoH fails

### UI Performance

**Frontend Optimizations:**
- Lazy loading of secure DNS input component
- Debounced validation for custom server input
- Minimal DOM manipulation for radio button switching

### Network Service Impact

**Backend Considerations:**
- Preference observation minimizes unnecessary updates
- Bulk configuration updates when multiple prefs change
- Efficient provider list management

## Development Lessons

### Architecture Evolution

The implementation went through significant architectural refinement:

**Initial Approach (Problems):**
- JavaScript-based preference initialization
- UI components directly manipulating multiple preferences
- Business logic distributed between UI and backend

**Final Approach (Solutions):**
- C++ preference initialization in `RegisterPrefs()`
- Single-responsibility UI components
- Centralized business logic in `SystemNetworkContextManager`

### Code Review Insights

Key lessons from the extensive code review process:

1. **Separation of Concerns**: UI should only handle presentation, not business logic
2. **Preference Architecture**: Avoid setting prefs from JavaScript on page load
3. **Component Design**: Custom components should have narrow, well-defined responsibilities
4. **Testing Strategy**: Comprehensive testing at all layers prevents integration issues

### Chrome Development Best Practices

**C++ Style Guide Compliance:**
- Avoid static storage duration for non-trivial destructors
- Use `= default` for empty destructors
- Prefer `std::make_unique` over raw `new`

**WebUI Development:**
- Use one-way bindings `[[]]` when components don't need to update properties
- Validate user input in C++ backend, not just JavaScript
- Design for testability from the beginning

### Feature Flag Strategy

The feature was initially behind the `SecureDnsSetting` feature flag:

```cpp
// Location: chrome/common/chrome_features.cc
const base::Feature kSecureDnsSetting{"SecureDnsSetting", 
                                     base::FEATURE_DISABLED_BY_DEFAULT};
```

**Benefits:**
- Safe rollout to canary and beta users
- A/B testing capabilities
- Easy rollback if issues discovered
- Gradual feature exposure

## Related Documentation

### Core Architecture
- [Networking & HTTP](../modules/networking-http.md) - HTTP stack and network service architecture
- [IPC Internals](../architecture/ipc-internals.md) - Inter-process communication for settings
- [Security Model](../security/security-model.md) - Security implications of DNS encryption

### Development Guides
- [Chrome Features Development](./chrome-features-development.md) - Guide to developing Chrome features (future document)
- [WebUI Development](../development/webui-development.md) - Building Chrome settings UI (future document)
- [Debugging Tools](../debugging/debugging-tools.md) - Tools for feature debugging

### Privacy & Security
- [Advanced Mojo IPC & Security Research](../security/advanced-mojo-ipc-security.md) - Security considerations for Chrome features
- [Sandbox Architecture](../architecture/security/sandbox-architecture.md) - Process isolation model

---

*This document represents a comprehensive analysis of a major Chrome feature implementation, providing insights into the development process, architectural decisions, and best practices for Chrome feature development. The DoH UI feature demonstrates the complexity and care required for user-facing privacy and security enhancements.*