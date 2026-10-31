# Ruleset guide split and ruleset play pages catch-up - 2026-10-31

Tracking issues: [#8602](https://github.com/Pasta-Devs/Marinara-Engine/issues/8602) (finished here) and [#8610](https://github.com/Pasta-Devs/Marinara-Engine/issues/8610) (the #8609 and #8612 parts).

## Source and scope

- English: Engine `staging` at `ff236573fb214351cf83c4548a057ba409818a0f` (every manifest's `sourceCommit`).

All ten documentation packs receive the same updates:

| Guide | Content |
| --- | --- |
| `extending/writing-rulesets.md` | The capabilities 1.392 to 1.812 and the other #8600 changes, then the split (#8612): this page keeps the introduction, the Quickstart and "The pages of this guide" |
| `extending/ruleset-checks.md`, `ruleset-sheets.md`, `ruleset-catalogs.md`, `ruleset-mechanics.md`, `ruleset-character-builder.md`, `ruleset-items.md`, `ruleset-combat.md`, `ruleset-layers-and-translations.md` | New pages split from it by top-level section, with the back-link lines, shortened headings and updated links (#8612) |
| `game/rulesets.md`, `game/fighting-on-a-ruleset.md` | New pages built mostly from moved text (#8609) |
| `game/combat.md`, `game/getting-started.md`, `game/party-and-npcs.md`, `game/dice-and-skill-checks.md`, `agents/agents-overview.md` | Moved sections replaced by links, and the other #8609 changes |

This supersedes the "Not done" section of `2026-10-31-ruleset-combat-ai-partial-catchup.md`: `extending/writing-rulesets.md` no longer lags English.

## Not done

- The developer pages of #8614 are not merged in English yet.
- `chats/slash-commands.md` and `roleplay/getting-started.md` lag English by #8587, tracked in #8603, although the manifests name a newer commit.

## Verification

- All 16 guides in all ten packs have the same heading counts and levels, bullets and table rows as English, byte-identical fenced code blocks, and the same inline code and link targets.
- Every `#fragment` to or from these guides resolves in its pack.
- Text that did not change in English keeps its existing translation byte for byte.
- The largest guide is `hi/extending/ruleset-mechanics.md` at 1,022,387 bytes, under Professor Mari's 1 MiB (1,048,576 byte) limit.
- `build-manifest.mjs <pack> --source-commit ff236573fb214351cf83c4548a057ba409818a0f` and `validate-pack.mjs <pack>` passed for all ten packs.
- `git diff --check` passed. Markdown and JSON only.
