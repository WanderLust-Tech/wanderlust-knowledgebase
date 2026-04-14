# Security Research Notes

This directory contains security research notes about parts of Chromium of particular interest to attackers.

The notes represent our understanding of a particular area of functionality at time of publishing, which we know is often incomplete, can become stale as code evolves, and may accidentally contain inaccuracies.

We publish these notes to
1. Preserve our understanding of areas of interest to security so we can refresh our memory of complex features after visiting other topics.
2. Give new team members a learning resource.
3. Boost productivity for external researchers making contributions to the [Chrome Vulnerability Rewards Program](https://www.chromium.org/Home/chromium-security/vulnerability-rewards-program/).

## Research Documents

### Vulnerability Analysis
- **[RenderFrameHost Use-After-Free Vulnerability Analysis](renderframehost-uaf-analysis.md)** - Comprehensive analysis of CVE-2020-6416, demonstrating browser sandbox escape through Mojo interface lifetime mismanagement
- **[V8 SuperIC Type Confusion Vulnerability Analysis](v8-superic-type-confusion-analysis.md)** - Advanced analysis of CVE-2022-1134 and the SuperIC vulnerability trilogy, covering V8 inline cache exploitation, JavaScript inheritance patterns, and sophisticated V8-Blink interaction attacks
