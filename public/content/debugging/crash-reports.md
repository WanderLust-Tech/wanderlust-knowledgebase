# Crash Reports in Chromium

Crash reports are an essential part of debugging and maintaining Chromium. They provide detailed information about crashes, helping developers identify and resolve issues efficiently.

---

## Generating a Crash Report

To generate a crash report in Chromium:

1. Open Chromium and access the URL `http://crash/` to trigger the generation of a crash report.
2. The crash report will be saved in the following locations:
   - **Linux**: `~/.config/google-chrome/Crash Reports/`
   - **Windows/Mac**: `/path/to/profile/Crash Reports`

### Preventing Crash Reports from Being Sent (Linux)

On Linux platforms, you can prevent crash reports from being sent to the server by setting the `CHROME_HEADLESS` environment variable. For example:

```bash
$ env CHROME_HEADLESS=1 ./out/Debug/chrome-wrapper
```

This ensures that crash reports are generated locally without being uploaded to the server.

## Parsing a Crash Report
Crash reports in Chromium can be parsed using the minidump_stackwalk tool. This tool processes the .dmp files generated during a crash and provides a readable stack trace.

Steps to Parse a Crash Report:
Use the following command to parse a crash report:
```bash
$ minidump_stackwalk <report-name>.dmp
```
For crash reports generated on Linux, you may need to remove the file header before parsing. To do this:
Open the .dmp file in a text editor.
Search for the MDMP character sequence.
Delete the header before the MDMP sequence.

## References
For more information on decoding and handling crash reports in Chromium, refer to the following resources:

![Decoding Crash Dumps](https://www.chromium.org/developers/decoding-crash-dumps)
![Linux Crash Dumping](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/linux_crash_dumping.md)

## Additional Notes
Crash Report Locations:
Ensure you have the correct permissions to access the crash report directories.
Licensing:
The original content referenced in this document is licensed under ![CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/).