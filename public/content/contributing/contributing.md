# Test# Contributing Guide

Thank you for your interest in contributing to Chromium! This guide walks you through our workflow, from cloning the repo to landing your first patch.

---

## 1. Getting Ready

### 1.1. Prerequisites

- You’ve [set up and built Chromium][setup-build].  
- You have a Google account and have signed the [Chromium Contributor License Agreement (CLA)][cla].  
- On Linux/macOS you have Python 3 and Git installed; on Windows you’re using PowerShell with Depot Tools in your `PATH`.

### 1.2. Configure Your Environment

1. **Clone with Depot Tools**  
   ```bash
   mkdir -p ~/chromium && cd ~/chromium
   fetch --nohooks chromium
   cd src
   gclient sync --with_branch_heads --with_tags
Set your Git identity

bash
Copy
Edit
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
Enable Gerrit SSH

Upload your SSH public key in the Gerrit UI.

Test: ssh -p 29418 chromium-review.googlesource.com

2. Coding Conventions
We follow the Chromium C++ Style Guide and JavaScript Style Guide. Key points:

Indent with 2 spaces (no tabs).

Line length ≤ 80 chars for code, ≤ 100 for comments.

Brace placement:

cpp
Copy
Edit
if (condition) {
  // …
} else {
  // …
}
Naming:

Classes & structs: CamelCase

Variables & functions: lower_case_with_underscores

Comments: use // for short notes, /* … */ for longer blocks.

Run clang-format before submitting.

3. Commit Message Format
A good commit message looks like:

bash
Copy
Edit
[component] Brief summary (50 chars or less)

More detailed description of your change:
- What problem it solves
- How you tested it
- Any known limitations

Bug: https://bugs.chromium.org/p/chromium/issues/detail?id=123456
Reviewed-on: https://chromium-review.googlesource.com/c/chromium/src/+/987654
Test: manual steps or automated test name
Prefix each message with [area], e.g. [content], [net], [ui].

Include a Bug: link if you’re fixing or closing an issue.

Mention tests in the Test: line.

4. Presubmit & Tests
Before uploading:

Run presubmit checks

bash
Copy
Edit
tools/lint/lint.py
tools/clang/scripts/run-clang-format.py --shrink-to-fit
Run unit and browser tests relevant to your change:

bash
Copy
Edit
autoninja -C out/Default my_test_target
out/Default/my_test_target --gtest_filter=MyTestSuite.*
Manual smoke test

Launch with your change: out/Default/chrome

Verify basic browser startup, navigation, and any feature you touched.

5. Code Review Workflow
Commit & Upload

bash
Copy
Edit
git checkout -b my-feature-branch
git commit -a
git cl upload
Reviewer Feedback

Address comments by amending your commit:

bash
Copy
Edit
git commit --amend
git cl upload --replace
Getting LGTM
Once two reviewers give LGTM and CQ+1 passes, your change will land automatically.

6. Working with Gerrit
View your changes:
https://chromium-review.googlesource.com/q/status:open+owner:self

Cherry-picking / rebasing:

bash
Copy
Edit
git fetch https://chromium.googlesource.com/chromium/src refs/changes/54/12354/2 && git cherry-pick FETCH_HEAD
Undoing a landed CL:
Upload a revert by clicking “Revert Change” in the Gerrit UI.

7. Troubleshooting & Common Pitfalls
Presubmit failures

Check the Buildbucket logs for style or test errors.

Merge conflicts

Rebase onto main:

bash
Copy
Edit
git fetch origin main && git rebase origin/main
Slow builds

Use autoninja -j<N> matching your CPU cores.

8. Beyond Code
Design Documents

For large features, submit a design doc under docs/ and get early feedback.

Localization

UI strings live in chrome/app/resources/; use l10n tools to extract/update translations.

Documentation

Keep inline /README.md files up to date in each directory you touch.

9. Getting Help & Community
Mailing Lists: chromium-dev@chromium.org

IRC/Slack: channels listed on the Chromium Community wiki

Weekly Office Hours: check the Chromium Calendar

10. Next Steps
Read Getting Started → Project Layout to orient yourself in the tree.

Pick a Good First Issue and try submitting a small fix.

Celebrate landing your first commit—welcome to the Chromium community!

Happy coding!

arduino
Copy
Edit

This guide will give newcomers a clear path: set up their environment, follow style and commit guidelines, run tests, and navigate Chromium’s Gerrit-based review process. Let me know if you’d like any tweaks or additions!