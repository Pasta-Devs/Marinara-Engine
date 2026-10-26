# Generated worlds and Game Mode catch-up - 2026-10-26

Tracking issue: [#7512](https://github.com/Pasta-Devs/Marinara-Engine/issues/7512).

## Source and scope

- English: Engine `staging` at `7a81756e3b2c5e92a244a3ec0163fb70c660e7f5` (every manifest's `sourceCommit`).
- Translation branch baseline: `b6623348bb` on `docs-i18n`.
- Scope: every guide named in #7512 and its comments (#7470-#7474, #7563, #7568, #7579, #7584, #7587-#7589,
  #7613, #7629, #7996 and its parts, #8049, #8063, #8170, #8220, #8233, #8235, #8254, #8278, #8310), plus
  guides whose translated structure had drifted from English (`chats/branches.md`) and the guides changed by
  #8359 and #8362 (`characters/colors-and-stats.md`, `characters/personas.md`,
  `development/optional-agent-packages.md`).

All ten documentation packs were compared with English section by section; missing or changed
sections, paragraphs, bullets and table rows were translated following each language's glossary.
Guides already up to date were left alone (for example `game/map-time-weather.md`,
`game/sessions-and-saves.md` and `game/game-assets.md`).

| Guide | Packs updated |
| --- | --- |
| `extending/writing-rulesets.md`, `extending/writing-story-scripts.md`, `extending/writing-creature-packs.md` | all 10 |
| `development/optional-agent-packages.md`, `development/game-rulesets-and-sheets-implementation.md` | all 10 |
| `agents/memory.md`, `chats/branches.md`, `characters/colors-and-stats.md`, `characters/personas.md`, `home/professor-mari.md` | all 10 |
| `game/getting-started.md`, `game/party-and-npcs.md`, `game/dice-and-skill-checks.md` | all 10 |
| `CONFIGURATION.md` | 7 |
| `agents/hierarchical-maps.md` | 4 |
| `game/combat.md` | 2 |
| `development/game-combat-roadmap.md`, `development/game-combat-rulesets-implementation.md` | 1 |

## UI packs

All eleven UI packs gain the Game Mode fight-text keys (`game.combat.*`, 109 keys including
`game.combat.ruleset.note.leadAway`). Engine shows them once the code that uses them reaches `staging`;
until then the validator lists them as stale keys, which Engine ignores. The changed
`game.combat.ruleset.event.dyingRevived` text keeps its current translation here and is updated
together with the English change.

## Verification

- For each language, every guide in scope has the same heading count and levels, bullet count, table rows
  and byte-identical fenced code blocks as English at the source commit.
- Rebuilt each manifest with `build-manifest.mjs <pack> --source-commit 7a81756e3b2c5e92a244a3ec0163fb70c660e7f5`
  and ran `validate-pack.mjs <pack>` against that English: all ten passed (141 translated guides / 141 English guides).
- `scripts/ui-i18n/validate-packs.mjs <staging en.json> --write-manifest`, then again without it: passed.
- `git diff --check` passed. Markdown and JSON only.
