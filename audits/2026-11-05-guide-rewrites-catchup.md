# Guide rewrites catch-up for 2.5.2 - 2026-11-05

Tracking issues, all finished here: [#8724](https://github.com/Pasta-Devs/Marinara-Engine/issues/8724), [#8730](https://github.com/Pasta-Devs/Marinara-Engine/issues/8730), [#8731](https://github.com/Pasta-Devs/Marinara-Engine/issues/8731), [#8734](https://github.com/Pasta-Devs/Marinara-Engine/issues/8734), [#8737](https://github.com/Pasta-Devs/Marinara-Engine/issues/8737), [#8738](https://github.com/Pasta-Devs/Marinara-Engine/issues/8738), [#8741](https://github.com/Pasta-Devs/Marinara-Engine/issues/8741), [#8745](https://github.com/Pasta-Devs/Marinara-Engine/issues/8745), [#8749](https://github.com/Pasta-Devs/Marinara-Engine/issues/8749), [#8750](https://github.com/Pasta-Devs/Marinara-Engine/issues/8750), [#8761](https://github.com/Pasta-Devs/Marinara-Engine/issues/8761), [#8766](https://github.com/Pasta-Devs/Marinara-Engine/issues/8766), [#8768](https://github.com/Pasta-Devs/Marinara-Engine/issues/8768), [#8813](https://github.com/Pasta-Devs/Marinara-Engine/issues/8813), [#8830](https://github.com/Pasta-Devs/Marinara-Engine/issues/8830), [#8834](https://github.com/Pasta-Devs/Marinara-Engine/issues/8834) and [#8835](https://github.com/Pasta-Devs/Marinara-Engine/issues/8835).

## Source and scope

- English: Engine `staging` at `0313889a4a2f3b7de9536e0a77fe39f9f7d1939e` (every manifest's `sourceCommit`). Its `docs/` matches `3e8f5b97854a8212478de9d6b6f78c5ae27b27fd`, the commit most translations were checked against, except for the #8834 and #8835 edits below, which were checked against it directly.

All ten documentation packs receive the same updates:

| Issue | Guides |
| --- | --- |
| #8724 | `INSTALLATION.md`, `UPGRADING.md`, `installation/containers.md`, `windows.md`, `ios-pwa.md`, `macos-linux.md`, `android-termux.md` |
| #8730 | `chats/chat-settings.md`, `group-chats.md`, `slash-commands.md`, `settings-profiles.md`, `messages.md`, `peek-prompt.md`, `sending-and-streaming.md`, `branches.md`, `managing-chats.md`, `guided-and-impersonate.md`, `export-import.md`, `connected-chats.md` |
| #8731 | `connections/decision-models.md`, `providers-reference.md`, `local-model.md`, `connecting-to-a-provider.md`, `organizing-connections.md`, `subscription-clis.md`, `local-self-hosted.md` |
| #8734 | `roleplay/getting-started.md`, `hud-and-trackers.md`, `scenes.md`, `narrative-director.md`, `combat-encounters.md`, `backgrounds.md` |
| #8737 | `characters/creating-and-editing-characters.md`, `sprites.md`, `bot-browser.md`, `interactive-onboarding.md`, `personas.md`, `colors-and-stats.md`, `galleries.md`, `library-organization.md`, `import-export.md`, `choosing-your-persona.md` |
| #8738 | `TROUBLESHOOTING.md`, `CONFIGURATION.md`, `FAQ.md`, `home/professor-mari.md`, `welcome.md`, `achievements.md`, `tutorial.md` |
| #8741 | `lorebooks/*` (6), `prompts/*` (6) and `appearance/*` (5) guides |
| #8745 | `extending/*` (15 guides; the eight ruleset pages in patch mode) |
| #8749 | `game/*` (12 guides) |
| #8750 | `agents/*` (8), `media/*` (9) and `integrations/*` (4) guides |
| #8768 | `noodle/overview.md` and `noodle/settings.md` moved to `agents/noodle.md` and `agents/noodle-settings.md`, as in English; links to them updated in `development/noodle-internals.md` and the other guides |
| #8766 | `REMOTE_ACCESS.md`, `FAQ.md` |
| #8761 | `home/professor-mari.md`: "Sending messages while she works" |
| #8813 | `chats/group-chats.md`, `appearance/card-css-theming.md` (#8796) |
| #8830 | `REMOTE_ACCESS.md` (Admin Access rewritten), `CONFIGURATION.md`, `TROUBLESHOOTING.md`, `connections/local-model.md` (#8829) |
| #8834 | `agents/memory.md`: **Updating continuity** halves summaries with only the Combine prompt (#8837) |
| #8835 | `agents/memory.md`: the recent message tail is a strict limit; `chats/peek-prompt.md`: **Show current context** (#8841) |

Also brought up to date: `development/optional-agent-packages.md` gains the Capability API 1.814 and 1.815 sections (#8781, #8790), and the explicit anchor `capability-api-1359-items-that-cost-a-story-number` that `extending/writing-story-scripts.md` now links to.

## Not done

- Terminology splits that were already in the packs before this catch-up, which each language's reviewer listed and left alone because the English did not change there. Examples are de **Schedule timezone** glosses, es "fragmento" for both chunk and excerpt, fr label glosses such as **Reveal spoilers**, hi मेनू/मेन्यू, ja ペナルティ/ペナルティー, ko **Put back in Chat Settings**, pl **Game controls**, pt-br `célula`/`casa` in `extending/ruleset-mechanics.md`, ru кости/кубики, and zh-hans **Arrange**. They need a glossary decision per language.

## Verification

- Every planned guide in every pack was translated by section, then checked against English: the same headings, list items and table rows, byte-identical fenced code, the same link targets, inline code and numbers. Each language then had one reviewer. The reviewer reran the check over all 118 guides (0 failures in every pack), compared at least eight guides paragraph by paragraph, including the three largest, and made terminology consistent with the glossary. The only check warnings left are inline code spans that the English wraps across two lines.
- The #8834 and #8835 edits were applied in patch mode and then read paragraph by paragraph against the English by a second reviewer per language, who fixed six ambiguous sentences (de, fr, hi, ja, pt-br, ru).
- Every `#fragment` link in all ten packs resolves to a heading or explicit anchor in its target, in the pack or in the English it falls back to.
- `build-manifest.mjs <pack> --source-commit 0313889a4a2f3b7de9536e0a77fe39f9f7d1939e` and `validate-pack.mjs <pack>` passed for all ten packs: 148 translated guides for 148 English guides each.
- `git diff --check` passed. Markdown and JSON only.
