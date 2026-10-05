# Chat window guide catch-up (#7054)

This record tracks the translation work requested in [#7054](https://github.com/Pasta-Devs/Marinara-Engine/issues/7054). All ten packs contain the 37 guide updates and have completed local content validation. The linked pull requests record each group's review and delivery results; translation and pack checks do not replace native-reader sampling.

## English source and scope

- Before the chat-window guides: `94ce3d6851ab635f4b08c8570dcaed5973f93fbc`.
- Working English snapshot: `d1339485460a6ce82a4248b8459c45b67af910db` (the merged #7049/#7057 guides, the merged #7062 color-control follow-up and the #7071 close-button/unpinned-section correction).
- Translation starting point: `e3c6a3744cb367de6fef3e707b8f6cbce08ed67c`. Existing work such as #7064 is retained. The later `docs-i18n` base `29f59ce8f0401ef736b299e3251ff8e85ae4e470` is integrated; its #7067 autonomous group-chat and scheduling paragraphs are preserved, not counted as new translation work here.
- All 37 requested guides already exist in all ten packs. Edit the affected passages; preserve unrelated translations.
- The original chat-window English delta contains 386 added and 112 removed lines, mainly navigation instructions, the Chat Settings guide, tracker guidance and the custom-theme reference.
- UI review scope: 126 relevant new or changed chat-window strings, plus the 41 removed keys. The full English comparison has 124 added keys and 4 changed values; its two unrelated **Keep guidance after regenerating** strings are outside this translation scope and keep English fallback. The final source excludes the two discarded minimize-button labels. Missing translations may keep the English fallback; do not copy English into packs merely to increase coverage.

## Bounded review groups

Each group stays below the hosted review file limit and can be reviewed independently. Keep #7054 open until all groups and shared validation are complete.

| Group | Packs | Status |
| --- | --- | --- |
| Europe | `pl`, `de`, `ru` | [#7065](https://github.com/Pasta-Devs/Marinara-Engine/pull/7065): all three packs complete; merged after local and hosted review as `e77b90b06ce6282775bab2d4ed6bf984a15cea13` on 2026-10-04 |
| Romance languages | `es`, `fr`, `pt-br` | [#7068](https://github.com/Pasta-Devs/Marinara-Engine/pull/7068): all three packs complete; merged after local and hosted review as `3386e3518c81802abf2dd0bdf998bb3e3499800c` on 2026-10-04 |
| East Asian languages | `ja`, `ko`, `zh-hans` | [#7070](https://github.com/Pasta-Devs/Marinara-Engine/pull/7070): all three packs and local validation complete; see the PR for review and delivery evidence |
| Hindi | `hi` | [#7069](https://github.com/Pasta-Devs/Marinara-Engine/pull/7069): complete; merged after local and hosted review as `56fd8fbed59b99c394c150581fe775160abe9ab3` on 2026-10-05 |

## Affected guides

Counts describe the English change, not lines already translated.

| English guide | Added lines | Removed lines |
| --- | ---: | ---: |
| `docs/FAQ.md` | 2 | 2 |
| `docs/TROUBLESHOOTING.md` | 3 | 3 |
| `docs/agents/agents-overview.md` | 1 | 1 |
| `docs/agents/approvals-and-agent-suite.md` | 3 | 3 |
| `docs/agents/hierarchical-maps.md` | 1 | 1 |
| `docs/agents/memory.md` | 4 | 4 |
| `docs/appearance/custom-css-themes.md` | 112 | 0 |
| `docs/characters/choosing-your-persona.md` | 1 | 1 |
| `docs/chats/branches.md` | 10 | 10 |
| `docs/chats/chat-settings.md` | 106 | 9 |
| `docs/chats/connected-chats.md` | 5 | 3 |
| `docs/chats/export-import.md` | 6 | 7 |
| `docs/chats/group-chats.md` | 2 | 2 |
| `docs/chats/managing-chats.md` | 1 | 1 |
| `docs/chats/settings-profiles.md` | 14 | 0 |
| `docs/conversation/schedules.md` | 1 | 1 |
| `docs/conversation/selfies.md` | 1 | 1 |
| `docs/extending/custom-tools.md` | 1 | 1 |
| `docs/game/game-assets.md` | 5 | 3 |
| `docs/game/getting-started.md` | 14 | 0 |
| `docs/game/ltx-2-3-storyboards.md` | 1 | 1 |
| `docs/game/party-and-npcs.md` | 1 | 1 |
| `docs/game/sessions-and-saves.md` | 12 | 12 |
| `docs/game/storyboard.md` | 3 | 3 |
| `docs/lorebooks/entries.md` | 1 | 1 |
| `docs/lorebooks/token-budgets.md` | 2 | 2 |
| `docs/media/illustrator-agent.md` | 2 | 2 |
| `docs/media/music.md` | 1 | 1 |
| `docs/media/scene-backgrounds.md` | 5 | 5 |
| `docs/media/scene-video.md` | 5 | 5 |
| `docs/media/tts-setup.md` | 1 | 1 |
| `docs/prompts/generation-parameters.md` | 1 | 1 |
| `docs/prompts/presets.md` | 1 | 1 |
| `docs/roleplay/backgrounds.md` | 2 | 2 |
| `docs/roleplay/combat-encounters.md` | 1 | 1 |
| `docs/roleplay/getting-started.md` | 18 | 12 |
| `docs/roleplay/hud-and-trackers.md` | 36 | 8 |

## Validation before each group is ready

Read each pack glossary and the current `CONTRIBUTING.md` translation rules. Preserve English UI labels, code, paths, links and anchors. Review the changed prose for a clear, natural explanation of what to click and what happens.

From an Engine checkout at the final English source revision:

```sh
node scripts/docs-i18n/build-manifest.mjs /path/to/docs-i18n/<lang> --source-commit <engine-sha>
node scripts/docs-i18n/validate-pack.mjs /path/to/docs-i18n/<lang>
```

From the translation checkout, after any UI edits:

```sh
node scripts/ui-i18n/validate-packs.mjs /path/to/Engine/packages/client/src/localization/locales/en.json --write-manifest
node scripts/ui-i18n/validate-packs.mjs /path/to/Engine/packages/client/src/localization/locales/en.json
git diff --check
```

Also compare the changed guides with their English source: check fenced code, inline identifiers, relative targets and explicit anchors, balanced Markdown and NFC text. Rebuild only the relevant documentation manifests; coordinate the shared UI manifest between groups. Record completed validation and review results here before delivery. Browser/device tests are not evidence of translation fluency; in-app download, navigation and native-reader sampling remain separate manual checks.

## Completed local checks

Europe group (`pl`, `de`, `ru`):

- Updated the affected passages in all 37 guides per pack (111 pages), including the corrected Advanced Recall location in **Chat Settings > Agent activity**. Unrelated translations remain intact.
- Documentation manifests generated at the working English SHA above; each whole pack passed validation for all 136 guides.
- New English fenced examples, inline identifiers, relative links and linked fragments were checked against all 111 translated pages. Explicit anchors retain the new English fragment targets. No missing targets, changed code examples or unbalanced fences were found.
- Changed paragraphs passed NFC and language-specific typography checks. Larger guides received a prose and terminology pass against each pack glossary.
- Translated 126 relevant UI delta entries in each pack. The two unrelated guided-regeneration UI keys are outside this scope and retain English fallback; the separate guide changes from #7064 remain intact. Reviewed the 41 removed English keys and removed those present in these packs: 26 Polish, 12 German and 12 Russian entries. The final close-button correction also removes the two newly introduced minimize labels from each pack.
- At the reviewed Europe candidate, UI validation passed with no stale keys: 726 current Polish keys, 669 German and 280 Russian. Interpolation and rich-text tokens remain intact; the shared UI manifest is refreshed.
- Independent source/meaning review by the Romance-group agent found no substantive issues in the new layout, tracker or style instructions, or in introduced links and code. This is not native-reader certification.
- `git diff --check` passed. Local CodeRabbit reviewed all 120 changed files at `f4f8a84eae899b694ef5ece6c328d414a9c9c011` with zero findings. The hosted review then identified a Polish verb-agreement error and this outdated review-status entry; both have been corrected. Pack and UI validation were rerun for these small documentation corrections. Hosted re-review approved exact head `8f0249a141ca1772060fb14f8f3bb49688a3295a` on 2026-10-04 at 23:30:31 UTC, with both threads resolved, before the merge recorded above. Manual and native-reader checks are not claimed.

## Remaining group evidence

- Romance: local CodeRabbit reviewed all 118 changed files at `01a3585f49f2892a63733fbbb19919bd8dd29ee1`, with zero findings. Hosted review approved that head on 2026-10-04 at 23:02:51 UTC before its merge.
- Hindi: local CodeRabbit reviewed all 41 changed files at `bf7ce35b7192a1b3266121ec9e5c63b3dd121f12`, with zero findings and exit 0. A mechanical base merge preserved the newer CharacterTavern translations and regenerated manifests. Hosted review approved the resulting `49c491ddf832ca0b364c30f66869184fddcf44f3` on 2026-10-05 at 00:14:56 UTC, with no unresolved threads, before its merge.
- East Asian packs: at `64e07130e413cf337e4ea5be1391cf49252e9bf0`, all three packs passed validation for 136 translated guides against all 136 English guides at `d1339485460a6ce82a4248b8459c45b67af910db`. UI validation against the integrated CharacterTavern catalog passed for Japanese (162 current keys, 0 stale), Korean (11,035 current, 28 pre-existing stale) and Simplified Chinese (8,671 current, 10 pre-existing stale). Existing stale keys outside this change remain separate. [PR #7070](https://github.com/Pasta-Devs/Marinara-Engine/pull/7070) records its exact final review, download proof and delivery results.

The newer CharacterTavern translations from #7079 are preserved when integrating the groups. The #7054 source remains `d133948`; later Echo/tracker and chat-style/menu documentation is tracked separately in #7078 and #7085. These translation updates do not claim browser rendering, physical-device testing or native-reader certification.
