# Agent Organizer, dice and package API catch-up - 2026-10-31

Tracking issue: [#8499](https://github.com/Pasta-Devs/Marinara-Engine/issues/8499).

## Source and scope

- English: Engine `staging` at `1ed80e8809afd536f32eb295d9aecbaabbdfe09d` (every manifest's `sourceCommit`).
- The **Agent Organizer** rename already landed in #8439 and the `respond as` change in #8504, so they are not repeated here.

All ten documentation packs receive the same updates:

| Guide | Content |
| --- | --- |
| `development/optional-agent-packages.md` | Shared libraries (#8394), Capability API 1.388 and `hostOnly` (#8413), the store layout (#8494), Capability API 1.389 (#8496) |
| `agents/agents-overview.md`, `TROUBLESHOOTING.md` | The store's pages, the update window and **Not now** (#8494) |
| `prompts/macros.md` | The `{{roll:XdY}}` row (#8495) |
| `chats/slash-commands.md` | Keep and drop dice (#8497) |
| `extending/personal-extensions.md`, `extending/writing-personal-extensions.md` | Dice formats and `dice.registerFormat` (#8500) |
| `game/dice-and-skill-checks.md`, `extending/writing-rulesets.md` | Symbol dice by name (#8503) |

## Verification

- All nine guides in all ten packs have the same heading counts and levels, bullets and table rows as English, and byte-identical fenced code blocks.
- New literals (`4d6kh3`, `1d8+3`, `dice.registerFormat`, `hostOnly`, the API versions and the example dice line) appear as often as in English.
- `build-manifest.mjs <pack> --source-commit 1ed80e8809afd536f32eb295d9aecbaabbdfe09d` and `validate-pack.mjs <pack>` passed for all ten packs (141 translated guides / 141 English guides).
- `git diff --check` passed. Markdown and JSON only.
