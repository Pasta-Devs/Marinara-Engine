# Ruleset combat AI and package language packs catch-up (partial) - 2026-10-31

Tracking issue: [#8602](https://github.com/Pasta-Devs/Marinara-Engine/issues/8602).

## Source and scope

- English: Engine `staging` at `262ef5d131553ae5b64ad66a9f6800f83526f27f` (every manifest's `sourceCommit`).

All ten documentation packs receive the same updates:

| Guide | Content |
| --- | --- |
| `development/game-combat-ai-design.md` | The ruleset combat AI: morale and fleeing, roles, bodyguards, leaders, named-only temperaments, GM-played named opponents and the Engine's ranked suggestions (#8600) |
| `development/optional-agent-packages.md` | Ruleset language packs, Capability API 1.811 (#8600), and the section "Capability API 1.391: Advanced Memory scene summaries and the memory block" (#8592) |

## Not done

`extending/writing-rulesets.md` is deliberately left out and still matches English at `1ed80e8809`, although the manifests name a newer commit. It lacks the capabilities 1.392 to 1.812 and the other #8600 changes to that guide, so #8602 stays open for it. Diff that guide from `1ed80e8809`, not from the manifest's `sourceCommit`. `extending/ruleset.schema.json` is generated and is not translated.

## Verification

- Both guides in all ten packs have the same heading counts and levels, bullets and table rows as English, and byte-identical fenced code blocks.
- Link targets match English, and every `#fragment` in both guides resolves in its pack. The one new heading has an English-slug anchor.
- New literals (`Capability API 1.811`, `Capability API 1.391`, `locales`, `advancedMemory`, `summaryMemoryInstruction`, `POST /api/capability-packages/rulesets/language`) appear as often as in English.
- `build-manifest.mjs <pack> --source-commit 262ef5d131553ae5b64ad66a9f6800f83526f27f` and `validate-pack.mjs <pack>` passed for all ten packs.
- `git diff --check` passed. Markdown and JSON only.
