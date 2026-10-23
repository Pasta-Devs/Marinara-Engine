# Roleplay video documentation update, 2026-10-23

Incremental follow-up for #8002, owned by @SpicyMarinara (Codex). English
implementation #8001 merged into `staging` as
`d44814a34f675ac060bd96e4527e4a38a8d18ce3`. Its four guide blobs match the
reviewed contributor head `b3367e27449baaad7307b4b1eab1bc1c3fba0bdb` byte-for-byte.

## Scope

Only the changed prose in these existing guides is updated in all ten packs
(`de`, `es`, `fr`, `hi`, `ja`, `ko`, `pl`, `pt-br`, `ru`, `zh-hans`):

- `chats/slash-commands.md`
- `media/illustrator-agent.md`
- `media/scene-video.md`
- `roleplay/getting-started.md`

The changes document `/video`, Roleplay clips made from the latest reply or
story alone, the shared First frame setting, historical-image animation context,
and opt-in character-requested clips with their existing limits. Unchanged
translated text is preserved. Code and link targets follow the merged English
source; actual UI labels stay English with native glosses, while descriptive
emphasis and headings are translated. Each contributor read the corresponding
language glossary. The new section keeps the canonical `video-clips` anchor.

## Source provenance

| Merged English guide | SHA-256 |
| --- | --- |
| `docs/chats/slash-commands.md` | `99b5257a4848df10fbe4e8cbb3ebb3b9c2c231715cd2bf8bc77653734c0e604e` |
| `docs/media/illustrator-agent.md` | `6852f221aad42183f4321f0908e5655926a5f35dceb48d03f6054c94a36a40e8` |
| `docs/media/scene-video.md` | `268a4c89f6f3b12bca594260cbac52fedcc0697e390cfa04843de890e09c814b` |
| `docs/roleplay/getting-started.md` | `4501340532b7e7e2f8761b99e59a78c61bebfba99b9914bdfe4411e15253f2ff` |

The English validation snapshot contains only Markdown and the two canonical
docs-i18n manifest/validation scripts extracted from that actual merge. It does
not install dependencies or execute contributor application code.

## Validation and publication

All 40 translated guide deltas have language-lane checks for the exact added
and removed code literals, unchanged link targets and fences, canonical anchors,
and NFC/LF text. The canonical manifest builder and pack validator pass for all
ten packs against the merged English snapshot. All 1,410 manifest entries match
their files' hashes and byte counts. Exactly four entries change per pack; the
other 1,370 entries remain byte-identical to the published docs base
`a84eaafa6d7dfa7dfd0fa179a7198e5efbab1cbc`, including its memory-default update.

The manifest format has one pack-wide `sourceCommit`, not a per-guide English
fingerprint. Advancing it to `d44814a34f675ac060bd96e4527e4a38a8d18ce3` records
this four-guide source snapshot; it does not certify that every guide has been
retranslated against every intervening Engine change. Separate lorebook and
audio guide work remains tracked by #8155 and #8173, and Scene documentation by
#8008. Their unrelated guide entries are intentionally unchanged here.

Substantive local review, its findings and dispositions are recorded in the PR.
Before closing #8002, delivery must also verify the actual docs merge ancestry,
all 51 changed raw files against the reviewed head, and all 1,410 published
manifest hash/size entries. Local validation alone is not publication proof.
