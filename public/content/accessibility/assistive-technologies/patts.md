# The Chrome OS PATTS speech synthesis engine

Chrome OS comes with a speech synthesis engine developed internally at Google
called PATTS. It's based on the same engine that ships with all Android devices.

[Read more about Text-to-Speech in Chrome](tts.md).

[See also the eSpeak engine](espeak.md).

## Building from source

This is for Googlers only.

Visit [http://go/chrome-tts-blaze](http://go/chrome-tts-blaze)
for instructions on how to build the engine from source and get the
latest voice files.

When debugging, start Chrome from the command-line and set the
NACL_PLUGIN_DEBUG environment variable to 1 to print log messages to stdout.

If running on Chrome OS on desktop Linux, you can put the unpacked extension in
your downloads directory, and hide the existing TTS extension by temporarily
renaming /usr/share/chromeos-assets to something else. Then in
chrome://extensions you can enable developer mode and "load unpacked extension".
You must hide the existing TTS extension because extension keys must not be
duplicated, and ChromeOS will crash if you try to load the unpacked extension
while the built-in one is already loaded.

To test, use the [TTS Demo extension](https://chrome.google.com/webstore/detail/tts-demo/chhkejkkcghanjclmhhpncachhgejoel)
in Chromeos. This should automatically recognize the unpacked TTS extension
based on its manifest key. You can also use any site that uses a web speech API
demo. In addition, the Chrome Accessibility team has a 
[TTS Debug extension](https://chrome.google.com/webstore/detail/idllbaaoaldabjncnbfokacibfehkemd)
which can run several automated tests.

## Updating

First, follow the public
[Chromium OS Developer Guide](http://www.chromium.org/chromium-os/developer-guide) to check out the source.
At a minimum you'll need to create a chroot and initialize the build for your board.
You do not need to build everything from source.
You do need to start the devserver.

Next, flash your device to a very recent test build. Internally at Google
you can do this with the following command when the dev server is running,
where CHROMEBOOK_IP_ADDRESS is the IP address of your Chromebook already
in developer mode, and $BOARD is your Chromebook's board name.

```cros flash ssh://CHROMEBOOK_IP_ADDRESS xbuddy://remote/$BOARD/latest-dev/test```