# RSS Feature User Documentation

## Overview
The Custom Browser includes comprehensive RSS feed support with automatic detection, subscription management, and extension API access.

## Features

### 🔍 Automatic Feed Detection
- Automatically detects RSS/Atom feeds on web pages
- Shows RSS InfoBar notification when feeds are found
- Supports multiple feeds per page

### 📋 Subscription Management
- One-click feed subscription
- "Don't ask again" option for specific sites
- Configurable detection settings

### 🔧 Extension API
- Full RSS data access for browser extensions
- Real-time feed detection events
- Comprehensive feed management API

## How to Use

### Basic Usage
1. **Navigate to a website with RSS feeds**
   ![RSS Detection](screenshots/rss-detection.png)
   
2. **RSS InfoBar appears automatically**
   ![RSS InfoBar](screenshots/rss-infobar.png)
   
3. **Click "Subscribe" to add the feed**
   ![RSS Subscribe](screenshots/rss-subscribe.png)

### Settings Configuration
Access RSS settings in `chrome://settings/`:

- **Enable RSS Detection**: ✅ Recommended
- **Show InfoBars**: ✅ For notifications
- **Update Interval**: Configure refresh frequency
- **Omnibox Integration**: Enable search suggestions

![RSS Settings](screenshots/rss-settings.png)

### Testing Sites
Try these sites to test RSS functionality:
- BBC News: https://www.bbc.com/news
- GitHub Blog: https://github.blog/
- CSS-Tricks: https://css-tricks.com/

## Extension Development

### API Access
```javascript
// Get available feeds
chrome.rss.getFeeds((feeds) => {
  console.log('Available feeds:', feeds);
});

// Listen for new feeds
chrome.rss.onFeedDetected.addListener((feedInfo) => {
  console.log('New feed:', feedInfo.title, feedInfo.url);
});
```

### Permissions Required
```json
{
  "permissions": ["rss"]
}
```

## Screenshots Checklist

### Required Screenshots:
- [ ] RSS InfoBar appearance on news site
- [ ] Multiple feeds detection
- [ ] Settings page with RSS options  
- [ ] Extension API test page results
- [ ] Feed reader interface (if implemented)
- [ ] Don't ask again checkbox interaction

### Screenshot Tips:
1. Use high-quality PNG format
2. Highlight UI elements with annotations
3. Show realistic feed examples
4. Include browser chrome for context
5. Test on both light and dark themes

## Troubleshooting

### RSS Not Detecting Feeds
- Check `rss.detection_enabled` setting
- Verify site has valid RSS links
- Check developer console for errors

### InfoBar Not Showing
- Verify `rss.show_rss_infobar` setting
- Check if "Don't ask again" was clicked
- Reset RSS preferences if needed

### Extension API Issues
- Ensure RSS permission is declared
- Check Extension API is properly loaded
- Verify modern Chrome extension manifest

## Technical Details

### Supported Feed Formats
- RSS 1.0, 2.0
- Atom 1.0
- JSON Feed 1.0

### Architecture
- **RSSTabHelper**: Core detection logic
- **RSS InfoBar**: User interface
- **RSS Extension API**: Developer access
- **RSS Components**: Feed management