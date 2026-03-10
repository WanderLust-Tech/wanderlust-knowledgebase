# Select to Speak (for developers)

Select to Speak is a Chrome OS feature to read text on the screen out loud.


There are millions of users who greatly benefit from some text-to-speech but
don't quite need a full screen reading experience where everything is read
aloud each step of the way. For these users, whether they are low vision, 
dyslexic, neurologically diverse, or simply prefer to listen to text read
aloud instead of visually reading it, we have built Select-to-Speak. 

## Using Select to Speak

Go to Chrome settings, Accessibility settings, "Manage accessibility Features",
and enable "Select to Speak". You can adjust the preferred voice, highlight
color, and access text-to-speech preferences from the settings page.

With this feature enabled, you can read text on the screen in one of three ways:

- Hold down the Search key, then use the touchpad or external mouse to tap or
drag a region to be spoken

- Tap the Select-to-Speak icon in the status tray and use the mouse or
touchscreen to select a region to be spoken

- Highlight text and use Search+S to speak only the selected text.

Read more on the
[Chrome help page](https://support.google.com/chromebook/answer/9032490?hl=en)
under "Listen to part of a page".

## Reporting bugs

Use bugs.chromium.org, filing bugs under the component
[UI>Accessibility>SelectToSpeak](https://bugs.chromium.org/p/chromium/issues/list?sort=-opened&colspec=ID%20Pri%20M%20Stars%20ReleaseBlock%20Component%20Status%20Owner%20Summary%20OS%20Modified&q=component%3AUI%3EAccessibility%3ESelectToSpeak%20&can=2).

## Developing

*Select to Speak will be abbreviated STS in this section.*

### Code location

STS code lives mainly in three places:

- A component extension to do the bulk of the logic and processing,
chrome/browser/resources/chromeos/accessibility/select_to_speak/

- An event handler, ash/events/select_to_speak_event_handler.h

- The status tray button, ash/system/accessibility/select_to_speak_tray.h

In addition, there are settings for STS in 
chrome/browser/resources/settings/a11y_page/manage_a11y_page.*

### Tests

Tests are in ash_unittests and in browser_tests:

```
out/Release/ash_unittests --gtest_filter="SelectToSpeak*"
out/Release/browser_tests --gtest_filter="SelectToSpeak*"
```
### Debugging

Developers can add log lines to any of the C++ files and see output in the
console. To debug the STS extension, the easiest way is from an external
browser. Start Chrome OS on Linux with this command-line flag:

```
out/Release/chrome --remote-debugging-port=9222
```

Now open http://localhost:9222 in a separate instance of the browser, and
debug the Select to Speak extension background page from there.

## How it works

Like [Chromevox](chromevox.md), STS is implemented mainly as a component
Chrome extension which is always loaded and running in the background when
enabled, and unloaded when disabled. The only STS code outside of the
extension is an EventRewriter which forwards keyboard and mouse events to
the extension as needed, so that the extension can get events systemwide.

The STS extension does the following, at a high level:

1. Tracks key and mouse events to determine when a user has either:

    a. Held down "search" and clicked & dragged a rectangle to specify a
    selection

    b. Used "search" + "s" to indicate that selected text should be read

    c. Has requested speech to be canceled by tapping 'control' or 'search'
    alone

2. Determines the Accessibility nodes that make up the selected region

3. Sends utterances to the Chrome Text-to-Speech extension to be spoken

4. Tracks utterance progress and updates the focus ring and highlight as needed.