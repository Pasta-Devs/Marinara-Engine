# Music and sound-effects documentation translation audit

Owner: @SpicyMarinara (Codex). Linked issue: #8168; English source PR: #8167.

Preparation is in progress. The four English guide paths are frozen at local candidate `daeaae573b1506b64cbc5cec9df7359d2188a6f2`; their final merged source commit will be recorded before publication. No candidate manifests or translated guide content are published by this ownership commit.

The ten packs are `de`, `es`, `fr`, `hi`, `ja`, `ko`, `pl`, `pt-br`, `ru`, and `zh-hans`. Scope is four existing guides per pack; the current pack inventory stays at 141 guides. The pending #8155 publication is serialized first.

## Frozen English byte inventory

| Path under docs/ | Bytes | SHA-256 |
| --- | ---: | --- |
| `connections/providers-reference.md` | 22650 | `242c372ab3740f087c509647f728ad7feb85136290f865017a2335192b7edee9` |
| `media/tts-setup.md` | 22776 | `43ec97b1d41100250028db2931de70047e842385ca133ab0d71e59958fdce085` |
| `game/game-assets.md` | 14060 | `99513e61aed4831e139cc68b55c19460b1fccf0688275e78923593943269f5ee` |
| `development/optional-agent-packages.md` | 152305 | `e2908147b7e9e48f5ce48293bdf53a3914afa4b1364ec01789dd9cf7a3106ba8` |

## Publication requirements

Translate only the changed prose, headings, tables and link text. Preserve code, inline code, paths, links and UI labels; add canonical anchors for new headings. Retain paid-provider and shared SunoAPI task-lookup qualification without introducing promises. Regenerate all ten manifests only against the final merged English source, validate every pack, complete substantive review, then verify raw published bytes and all 1,410 manifest entry hashes before closing #8168.
