# Chat window guide catch-up (#7054)

Status: in progress. This record tracks the translation work requested in [#7054](https://github.com/Pasta-Devs/Marinara-Engine/issues/7054); it does not claim that the packs are updated yet.

## English source and scope

- Before the chat-window guides: `94ce3d6851ab635f4b08c8570dcaed5973f93fbc`.
- Working English snapshot: `505f8986915b1ebc1c55ee07808cd3dd7f47c1ba` (the merged #7049/#7057 guides plus the #7062 color-control follow-up). The final review will compare it with staging after #7062 lands.
- Translation starting point: `e3c6a3744cb367de6fef3e707b8f6cbce08ed67c`. Existing work such as #7064 is retained.
- All 37 requested guides already exist in all ten packs. Edit the affected passages; preserve unrelated translations.
- The English delta contains 385 added and 111 removed lines, mainly navigation instructions, the Chat Settings guide, tracker guidance and the custom-theme reference.
- UI review scope: 126 added keys, 4 changed values and 41 removed keys. Review the corresponding translations; missing translations may keep the English fallback. Do not copy English into packs merely to increase coverage.

## Bounded review groups

Each group stays below the hosted review file limit and can be reviewed independently. Keep #7054 open until all groups and shared validation are complete.

| Group | Packs | Status |
| --- | --- | --- |
| Europe | `pl`, `de`, `ru` | Inventory prepared; Polish starts first |
| Romance languages | `es`, `fr`, `pt-br` | Pending |
| East Asian languages | `ja`, `ko`, `zh-hans` | Pending |
| Hindi | `hi` | Pending |

## Affected guides

Counts describe the English change, not lines already translated.

| English guide | Added lines | Removed lines |
| --- | ---: | ---: |
| `docs/FAQ.md` | 2 | 2 |
| `docs/TROUBLESHOOTING.md` | 3 | 3 |
| `docs/agents/agents-overview.md` | 1 | 1 |
| `docs/agents/approvals-and-agent-suite.md` | 3 | 3 |
| `docs/agents/hierarchical-maps.md` | 1 | 1 |
| `docs/agents/memory.md` | 3 | 3 |
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
