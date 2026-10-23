# Music and sound-effects documentation publication

Owner: @SpicyMarinara (Codex). Issue #8168; English PR #8167.
English is actually merged at `3a7081f3223f112860e59550d863c8418849ca69`, verified as an ancestor of staging.
The four source guide bytes exactly match frozen candidate `4abb699ced7d920715c23c44d7136120626d556f`.
This publication changes four guides in each of ten packs; it adds no guide paths.

## Exact English inventory

| Path under docs/ | Bytes | SHA-256 |
| --- | ---: | --- |
| `connections/providers-reference.md` | 23230 | `1d9c6eec19a861b5141bf5233ca07cfe1070256fd29e88e4e502824cfc2a88d8` |
| `media/tts-setup.md` | 23031 | `f9b9c6b6ac4104c9945f7635edbf507a335ccc248deba16c63b1dbbfca2427fe` |
| `game/game-assets.md` | 14060 | `99513e61aed4831e139cc68b55c19460b1fccf0688275e78923593943269f5ee` |
| `development/optional-agent-packages.md` | 152710 | `b2197dc60d5ffbab0fc85165060844427a427a8a662c292e581fb9ee4a01f760` |

## Translation and review scope

All 40 guide bytes match reviewed translation head `fc62bf864`. Prior full-guide
and provider-clarification reviews are scoped separately; the final conditional
migration paragraph review examined all ten packs and this audit with zero
findings. Source/literal checks preserve inline code, link targets, fences and
English UI labels. The prose value "3 seconds" is translated natively, and the
provider category retains its canonical Music & Sound Effects label plus one
native gloss. Three canonical section anchors per pack remain unique.

The guides retain the actual speech/generation Defaults labels, corrected Gacha
setup labels, scene/world audio lifecycle and API 1.381 selection fallback rules.
Saved Game IDs remain separate from availability and requested generation-channel
eligibility. Provider limits and the unverified paid SunoAPI sound-effects boundary
are preserved without new guarantees. No paid-provider or physical-device proof
is claimed by this documentation update.

## Manifest and publication validation

All ten pack validators pass against the merged English snapshot: 141 guides per
pack and 1,410 manifest entries. Every local blob matches its size and SHA-256.
Only the four listed guide entries change per manifest, alongside sourceCommit.
All other published guide content and hashes are preserved from `8c77fd30e6e00bb49b53e4d207809a20a8c3414c`,
including the preceding agent-reference, Roleplay-video and scene-guide publications. Global sourceCommit
identifies this scoped English snapshot; it does not certify every other guide
as fully current.

Final delivery still requires the docs-i18n merge, 51 raw published-file matches,
all 1,410 published entry hashes and reviewed-head/published ancestry verification.
App download/rendering and independent native-reader checks remain manual.
