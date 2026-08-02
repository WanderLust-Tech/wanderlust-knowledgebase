# Unused video/social component cluster

Decision recorded 2026-08-01 (Tier 5 housekeeping item from
`FEATURE_DEEP_DIVE_ROADMAP.md`): **left in place, deliberately, not
removed.**

## What exists

`pathfinder-ui`'s `src/components/` contains a cluster of short-form-
video/social components with no current consumer anywhere in the
WanderLust ecosystem (`custom-browser`, `remote_ntp`, or any other
frontend):

- `VideoFeed`, `VideoPlayer`, `VideoUploader`
- `SwipeableCards`
- `SocialMediaCard`, `SocialInteraction` (`src/components/SocialMedia.md`
  also documents this pair)
- `NftCard` (plus `src/assets/img/nfts`)
- `TikTokHeader`, `TikTokLayout`, `TikTokSidebar`

None of these map to any shipped or planned browser feature. They're
almost certainly inherited wholesale from an earlier, unrelated project
this component library (or a predecessor) was extracted from.

## Why they're staying

This was a live decision, not an oversight: given the choice between
deleting the cluster outright or repurposing it into a real feature
(e.g. an opt-in NTP "Discover" content feed, the kind of thing
Opera/Edge ship), the call was made to leave the code exactly as-is for
now and simply record that this is a known, accepted state rather than
an open question.

## How to apply

- **Don't treat this as a TODO.** A future session shouldn't re-flag
  "pathfinder-ui has dead code" as a new finding — it's already been
  looked at and intentionally deferred.
- **If a future NTP "Discover" feed is scoped**, these components are a
  legitimate starting point to evaluate (real, already-built video/card/
  social UI primitives) rather than building from scratch — but that's a
  new feature decision to make at that time, not implied by this note.
- **If pathfinder-ui's own bundle size or maintenance burden becomes a
  problem**, this cluster is the first candidate for removal — nothing
  about this decision is permanent, it's just not being acted on now.
