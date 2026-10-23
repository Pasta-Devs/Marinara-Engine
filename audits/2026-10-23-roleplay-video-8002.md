# Roleplay video documentation update, 2026-10-23

Incremental follow-up for #8002, owned by @SpicyMarinara (Codex). English
implementation #8001 merged into `staging` as
`d44814a34f675ac060bd96e4527e4a38a8d18ce3`. Canonical English follow-up #8191
merged as `e6b1ac67afca21592557fd9b6d4dac2390ca417b`, correcting the intro and
troubleshooting claims that incorrectly required a still image for every clip.
All four final guide blobs match reviewed #8191 head
`4f5246ce880939e39fb2c13c3acc3cd655943b97` byte-for-byte; the other three guides
also retain their original reviewed contributor bytes from
`b3367e27449baaad7307b4b1eab1bc1c3fba0bdb`.

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
| `docs/media/scene-video.md` | `b2ff128560aba20f08014193eaeee624dca8c8389c6929ce19a772715e925da9` |
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
fingerprint. Advancing it to `e6b1ac67afca21592557fd9b6d4dac2390ca417b` records
this four-guide source snapshot; it does not certify that every guide has been
retranslated against every intervening Engine change. Separate lorebook and
audio guide work remains tracked by #8155 and #8173, and Scene documentation by
#8008. Their unrelated guide entries are intentionally unchanged here.

The initial 51-file local review reported zero findings. Hosted review then
identified a Polish wording error for reusable instructions and the inherited
canonical English image requirement. The Polish wording is corrected, and the
two canonical #8191 claims are translated in all ten packs. An independent
read-only review confirms all twenty corrected claims preserve the still-image
or Roleplay-story-only distinction and its first-frame condition. The final
repair delta receives a separate local review; its outcome and dispositions
are recorded in the PR.

Substantive local review, its findings and dispositions are recorded in the PR.
Before closing #8002, delivery must also verify the actual docs merge ancestry,
all 51 changed raw files against the reviewed head, and all 1,410 published
manifest hash/size entries. Local validation alone is not publication proof.
