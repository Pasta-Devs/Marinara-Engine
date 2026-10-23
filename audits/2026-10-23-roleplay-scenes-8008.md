# Scene profile and opening documentation — #8008

This incremental update mirrors `docs/roleplay/scenes.md` in all ten existing documentation packs. It resolves #8008 after the actual English #8007 merge, without changing application code or UI locale packs.

## English provenance

- Reviewed contributor head: `59fc3e8c3faf7fd3292eb30a26cdc74ebc9310f7`.
- Actual English merge: `6a6a06e899ac472bbb4b35fa00b156759a0fa1ec`.
- Manifest source epoch: actual staging `b2a126f952272ed6c5be51ee8b6fef7babdcbfc1`, which contains that merge and the later agent-reference guide delivery.
- The scene guide is byte-identical at all three commits: SHA256 `95ea9069832df2d4d79f6ae0ed5dd42ed7b575e377b7604e5db9a928eb23db32` (8,295 bytes).
- Translation base: actual `docs-i18n` merge `3e821df7d4327dfef1ef48a8ee614a7805f254ed` from #8155.

## Translated delta

Only step 4 and the following opening explanation change. **None** uses the preset from the starred Roleplay settings profile. A new scene starts from that profile; its description is a separate narrator message before the opening. A single-character opening uses the character's voice, with double-quoted speech unless writing instructions override it. A group opening follows the profile's group mode: merged by default with one narrator, or **Individual** with the opening character writing it.

Each guide follows its existing language glossary and retains its original title, code, links, surrounding prose and English UI labels. The newly introduced **Individual** label keeps its English spelling with a native gloss. No terminology or glossary changes are introduced.

| Pack | Translated scene-guide SHA256 |
| --- | --- |
| `de` | `3305cbac4187c984182124b8db59ac08fa8786561f1dcc4ca3c2c2956778220d` |
| `es` | `f4687bff640f53b31b7740811f2510bde7ee201b53b243b88440c792b171106d` |
| `fr` | `55b418cd27999bba13b37ae4152fbea735d81f7ae40e0ecb8bfc6e9c7547a157` |
| `hi` | `78a4855977d89f850a2ea0cd7bb62f5673cfb6044e293b7fed5565bfc3bee447` |
| `ja` | `ec9ab2527b6e8bc891645f8b09a69c5a2b128f556576829010e0aabe1c6320a0` |
| `ko` | `b79825ed696d2407180ea7448d010303077cf4df3b54394f57c99f885d587bcc` |
| `pl` | `61a27c5e70a379975f735e1095a8137a41c191b016bf57ac6fc297c91c32ebe1` |
| `pt-br` | `09924d2842263577a666f22f3cc11cb8ca903dbc540278457cf1823caf12f5b8` |
| `ru` | `5e750f800f184ffab1dbcf7c21b17dbb39e0f8e3fec3490574e224dda92c7c9d` |
| `zh-hans` | `072f514fe24c1f7bb55f67b2ea4b8585d1b0cc33e2b312c8972ed2459dce7b24` |

## Validation and limits

All ten guides have exactly two changed regions: one step replacement and a six-line insertion with three bullets. Inverse boundary checks preserve every other byte. Code/fence/link and UI-label checks, NFC/LF and locale typography checks pass. A separate reviewer inspected the changed German, French, Japanese and Korean meanings; this is not a native-reader panel or a fresh full-guide review.

The ten manifests are rebuilt and pack-validated with the tools from actual staging `b2a126f952272ed6c5be51ee8b6fef7babdcbfc1`. All 1,410 hash/byte entries are checked against the on-disk guides. Exactly the `roleplay/scenes.md` entry changes in each pack; the other 1,400 entries are identical to the actual translation base. In particular, #8155's agent-reference guide and the four pending audio-guide entries are preserved.

`sourceCommit` is a pack-wide provenance epoch, not a per-guide promise that every translation matches that commit's prose. This patch does not absorb the separate four-guide audio work in #8173. That work remains outside this issue and needs its own English provenance and publication proof.

Local prose review completed with zero findings across the ten changed guides. The final manifest/audit review and the remote publication checks are separate delivery steps. Runtime tests and live-provider behavior are owned by the English feature PR; no new application, provider or physical-device test is claimed here. Before closing #8008, verify the merged branch's 21 changed files, all 1,410 published manifest records and merge ancestry against the reviewed source.
