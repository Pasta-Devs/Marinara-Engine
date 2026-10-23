# Generated Videos documentation follow-up, 2026-10-23

## Source and scope

Follow-up for #7994, owned by @SpicyMarinara (Codex).
Canonical English snapshot: Engine `staging`
`bf791797fac694d1351bf1ff1a4828dfcff4d998` (merged #7993).

The following four guides are updated in all ten packs (de, es, fr, hi, ja,
ko, pl, pt-br, ru and zh-hans):

- `agents/built-in-agents.md`: separate image/video intervals, clip modes and
  manual-only video interval.
- `conversation/selfies.md`: the default-off Generated Videos control, recent
  conversation context, profiles, Commands shortcut, interval, manual requests,
  swipes and group-chat limits.
- `media/illustrator-agent.md`: appearance for prompt-only clips, avatar-reference
  choices, clip modes, separate cadence, first frames, manual re-runs and fallbacks.
- `media/scene-video.md`: Videos per reply, its default/range, one clip per
  Conversation character, request costs and manual-request exclusion.

English UI labels, code literals and link targets remain intact. The new
translated Generated Videos heading has its canonical `generated-videos` anchor.
Only the four guides and their manifest entries change in each pack.

#8002 and #8008 remain separate follow-ups for their unmerged English source
PRs #8001 and #8007. This update does not publish their changes speculatively.

## Validation

- Rebuilt all ten manifests with the English source commit above.
- All ten `scripts/docs-i18n/validate-pack.mjs` runs pass against that exact
  English snapshot: 140 guides per pack, 1,400 manifest entries in total.
- Focused comparison of all 40 edited guides verifies unchanged link targets
  and fenced code, inline-code additions/removals identical to the merged English
  delta, and the English UI labels being documented, with one extra reference each
  to Clips only and Video Run Interval to clarify their independent cadence.
- All edited guides are NFC-normalized, use LF, and have no non-breaking spaces.
- The canonical Generated Videos fragment is present once in every pack; the
  obsolete bold Run Interval label is absent from each Illustrator guide.
- `git diff --check` passes. This orphan documentation branch has no runtime
  packages or `pnpm check` command; the checks above validate the shipped packs.

## Local review disposition

The first local CodeRabbit pass completed with five minor findings across
three subjects: an ambiguous Hindi
phrase for copying a face/outfit, image/fallback promises that needed the
existing first-frame exceptions beside them, and the image-interval paragraph
that could read as stopping clips too. The Hindi phrase now explicitly says
copy. Every pack now makes the generated-image Gallery/fallback conditional on
an image actually being drawn and says Video Run Interval controls Clips only.
Pictures and clips adds a clip beside the image; the subsequent First frame
bullets continue to describe which frame the clip uses.

These clarifications preserve the complete meaning of the merged English
source, including its explicit avatar/no-image and independent-cadence
exceptions. They do not introduce behavior from unmerged #8001. Repeated
findings about the same two paragraphs were treated as the same subjects.
A follow-up local CodeRabbit review of all 51 changed files completed with
zero findings. Raw publication verification is pending the docs-i18n merge.
Native-reader review of the prose and in-app download/render checks remain
manual verification items; neither is claimed by the structural checks.
