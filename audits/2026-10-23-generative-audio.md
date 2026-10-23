# Music and sound-effects documentation translation audit

Owner: @SpicyMarinara (Codex). Linked issue: #8168; English source PR: #8167.

Preparation is in progress. The four English guide paths are frozen at local candidate `61d5b4404e5dcd2e183ab9538013615b4a9e8974`; their final merged source commit will be recorded before publication. No candidate manifests or translated guide content are published by this ownership commit.

The ten packs are `de`, `es`, `fr`, `hi`, `ja`, `ko`, `pl`, `pt-br`, `ru`, and `zh-hans`. Scope is four existing guides per pack; the current pack inventory stays at 141 guides. The pending #8155 publication is serialized first.

## Frozen English byte inventory

| Path under docs/ | Bytes | SHA-256 |
| --- | ---: | --- |
| `connections/providers-reference.md` | 22650 | `242c372ab3740f087c509647f728ad7feb85136290f865017a2335192b7edee9` |
| `media/tts-setup.md` | 23031 | `f9b9c6b6ac4104c9945f7635edbf507a335ccc248deba16c63b1dbbfca2427fe` |
| `game/game-assets.md` | 14060 | `99513e61aed4831e139cc68b55c19460b1fccf0688275e78923593943269f5ee` |
| `development/optional-agent-packages.md` | 152710 | `b2197dc60d5ffbab0fc85165060844427a427a8a662c292e581fb9ee4a01f760` |

## Publication requirements

Translate only the changed prose, headings, tables and link text. Preserve code, inline code, paths, links and UI labels; add canonical anchors for new headings. Retain paid-provider and shared SunoAPI task-lookup qualification without introducing promises. Regenerate all ten manifests only against the final merged English source, validate every pack, complete substantive review, then verify raw published bytes and all 1,410 manifest entry hashes before closing #8168.

## Local translation candidate

All 40 guide deltas are prepared across all 10 packs. The frozen English source includes the corrected Gacha setup/control labels and distinguishes scene dialogue cancellation from continuing/changing music and world-exit audio disposal. Three canonical heading anchors per pack preserve the English link targets. Surrounding translations remain unchanged.

The final package guide delta uses audio capability API 1.381 and preserves the documented speech-selection distinction: a stale requested connection ID follows normal resolution, while an unavailable saved speech selection refuses playback. All ten translations carry that qualification without promising a particular fallback connection.

The integrated structural audit checks source hashes, added/removed inline code, link targets, fences and exact English UI-label deltas. Two explicit presentation rules apply: the emphasized prose value "3 seconds" is translated natively, and every provider-category introduction includes the canonical **Music & Sound Effects** label with one native gloss after its translated heading. These changes introduce no behavior promise. All 40 files pass NFC, whitespace, heading and relevant pack typography checks.

No manifests have been regenerated against the unmerged candidate, and translated content is still held locally. Final English ancestry, all 10 pack builds, the 1,410 entry hashes, substantive local review and raw publication proof remain required. The publication order is #8155 first, then #8173.
