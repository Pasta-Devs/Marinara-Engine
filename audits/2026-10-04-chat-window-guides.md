# Chat window guide catch-up (#7054)

Status: in progress. This record tracks the translation work requested in [#7054](https://github.com/Pasta-Devs/Marinara-Engine/issues/7054); Polish, German and Russian have completed translation and local validation; review and the remaining groups are still in progress.

## English source and scope

- Before the chat-window guides: `94ce3d6851ab635f4b08c8570dcaed5973f93fbc`.
- Working English snapshot: `6d6cb06e53aa9333e2c84dcf495b58d598e5ba48` (the merged #7049/#7057 guides plus the #7062 color-control follow-up). The final review will compare it with staging after #7062 lands.
- Translation starting point: `e3c6a3744cb367de6fef3e707b8f6cbce08ed67c`. Existing work such as #7064 is retained.
- All 37 requested guides already exist in all ten packs. Edit the affected passages; preserve unrelated translations.
- The English delta contains 386 added and 112 removed lines, mainly navigation instructions, the Chat Settings guide, tracker guidance and the custom-theme reference.
- UI review scope: 126 added keys, 4 changed values and 41 removed keys. Review the corresponding translations; missing translations may keep the English fallback. Do not copy English into packs merely to increase coverage.

## Bounded review groups

Each group stays below the hosted review file limit and can be reviewed independently. Keep #7054 open until all groups and shared validation are complete.

| Group | Packs | Status |
| --- | --- | --- |
| Europe | `pl`, `de`, `ru` | [#7065](https://github.com/Pasta-Devs/Marinara-Engine/pull/7065): All 37 guides and related UI entries per pack complete; local review pending |
| Romance languages | `es`, `fr`, `pt-br` | [#7068](https://github.com/Pasta-Devs/Marinara-Engine/pull/7068): all three packs complete; local review pending |
| East Asian languages | `ja`, `ko`, `zh-hans` | [#7070](https://github.com/Pasta-Devs/Marinara-Engine/pull/7070): Chinese complete; Japanese and Korean in progress |
| Hindi | `hi` | [#7069](https://github.com/Pasta-Devs/Marinara-Engine/pull/7069): content and validation complete; review in progress |

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
- Translated 128 relevant UI delta entries in each pack. The two unrelated guided-regeneration UI keys are outside this scope and retain English fallback; the separate guide changes from #7064 remain intact. Reviewed the 41 removed English keys and removed those present in these packs: 26 Polish, 12 German and 12 Russian entries.
- UI validation passed with no stale keys: 728 current Polish keys, 671 German and 282 Russian. Interpolation and rich-text tokens remain intact; the shared UI manifest is refreshed.
- Independent source/meaning review by the Romance-group agent found no substantive issues in the new layout, tracker or style instructions, or in introduced links and code. This is not native-reader certification.
- `git diff --check` passed. Local CodeRabbit is pending coordinated quota, so the group remains draft. No native-reader or in-app verification is claimed.
