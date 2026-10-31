# Ruleset guide split, ruleset play and Game Mode developer pages catch-up - 2026-10-31

Tracking issues: [#8602](https://github.com/Pasta-Devs/Marinara-Engine/issues/8602) and [#8610](https://github.com/Pasta-Devs/Marinara-Engine/issues/8610), both finished here.

## Source and scope

- English: Engine `staging` at `0a53d4275d4de84e67d6ae77a135deab3b38ef5c` (every manifest's `sourceCommit`).

All ten documentation packs receive the same updates:

| Guide | Content |
| --- | --- |
| `extending/writing-rulesets.md` | The capabilities 1.392 to 1.812 and the other #8600 changes, then the split (#8612): this page keeps the introduction, the Quickstart and "The pages of this guide" |
| `extending/ruleset-checks.md`, `ruleset-sheets.md`, `ruleset-catalogs.md`, `ruleset-mechanics.md`, `ruleset-character-builder.md`, `ruleset-items.md`, `ruleset-combat.md`, `ruleset-layers-and-translations.md` | New pages split from it by top-level section, with the back-link lines, shortened headings and updated links (#8612) |
| `game/rulesets.md`, `game/fighting-on-a-ruleset.md` | New pages built mostly from moved text (#8609) |
| `development/game-combat-ai.md` | Renamed from `game-combat-ai-design.md`: the kept sections without their numbers, and "Difficulty and weather" moved in from `game-combat-difficulty-weather.md` (#8614) |
| `development/game-mode-architecture.md` | New page (#8614) |
| `development/optional-agent-packages.md` | Two links (#8614) |
| `game/combat.md`, `game/getting-started.md`, `game/party-and-npcs.md`, `game/dice-and-skill-checks.md`, `agents/agents-overview.md` | Moved sections replaced by links, and the other #8609 changes |

This supersedes the "Not done" section of `2026-10-31-ruleset-combat-ai-partial-catchup.md`: `extending/writing-rulesets.md` no longer lags English.

Deleted from every pack, as in English (#8614): `development/game-rulesets-and-sheets-implementation.md`, `development/game-combat-rulesets-implementation.md`, `development/game-combat-roadmap.md` and `development/game-combat-difficulty-weather.md`.

## Not done

- `chats/slash-commands.md` and `roleplay/getting-started.md` lag English by #8587, tracked in #8603, although the manifests name a newer commit.

## Verification

- All 19 changed guides in all ten packs have the same heading counts and levels, bullets and table rows as English, byte-identical fenced code blocks, and the same link targets. Inline code matches too, except for a few extra spans in existing text of `optional-agent-packages.md` in hi, ja, ko and zh-hans, which this catch-up leaves as they were.
- Every `#fragment` to or from these guides resolves in its pack, and no translated guide links to a renamed or deleted page.
- Text that did not change in English keeps its existing translation byte for byte. The one exception is the repeated heading `### Money` in fr, hi and zh-hans, which now reads the same in both places.
- The largest guide is `hi/extending/ruleset-mechanics.md` at 1,022,387 bytes, under Professor Mari's 1 MiB (1,048,576 byte) limit.
- `build-manifest.mjs <pack> --source-commit 0a53d4275d4de84e67d6ae77a135deab3b38ef5c` and `validate-pack.mjs <pack>` passed for all ten packs.
- `git diff --check` passed. Markdown and JSON only.
