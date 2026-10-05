# Hindi chat window guide update — issue #7054

This group updates the 37 Hindi guides affected by the chat window redesign and widget color controls. It translates the changed passages rather than replacing unrelated existing translations.

## Source

- English baseline before the redesign: `94ce3d6851ab635f4b08c8570dcaed5973f93fbc`.
- Combined English source for this update: `d1339485460a6ce82a4248b8459c45b67af910db` (merged PR #7062 and the #7071 close-button/unpinned-section correction, following merged #7049 and #7066). The chat-window translation was reviewed against `6d6cb06e53aa9333e2c84dcf495b58d598e5ba48`; the later source preserves the autonomous-pacing guide additions translated by #7067.
- Translation branch baseline: `e3c6a3744cb367de6fef3e707b8f6cbce08ed67c`.
- Related translation issue: #7054. This language group alone does not close it.

## Content and checks

The changed instructions explain movable chat controls, drawers, pins and locks, saved profiles and favorite layouts, desktop and phone tracker views, onboarding, widget presets and the three color controls. Paths now lead to the current Chat Settings sections. Advanced Recall progress points to Agent activity.

- All 37 targeted guides updated; pack validation passes for 136 Hindi / 136 English guides.
- New CSS API identifiers and the complete CSS example are byte-identical to English. Relative link targets are validated against English.
- Twelve English fragment aliases keep the new cross-guide links usable when the translated files are read directly on GitHub.
- Whole-pack Devanagari token audit introduces no new nukta-stripped spelling splits. Existing unrelated residuals recorded in the Hindi glossary remain separate.
- No new nonbreaking spaces or zero-width characters. Changed prose follows the glossary's आप, modern technical Hindi and danda conventions.
- The UI pack translates all 126 relevant new/changed keys. The two guided-regeneration keys are outside this chat-window UI scope and retain English fallback. Existing guide updates from #7064 are preserved. Removed the 12 obsolete chat-help keys that were present among the 41 deleted English keys. The final close-button correction also removes the two newly introduced minimize labels.
- UI validation passed for the 280-key chat-window candidate against English `d133948`. Integration with the current translation branch preserves four newer CharacterTavern strings from #7079, giving 284 current Hindi keys with zero stale entries against that upstream English catalog. Key ordering, interpolation/markup and manifest hashes pass. Missing unrelated UI keys continue to use English fallback. Other language packs' existing stale keys are reported separately.

An independent agent checked the three largest guides, the changed UI strings, new links and source parity. Its two substantive wording/evidence refinements were applied. The two autonomous-pacing paragraphs from #7067 are preserved during integration.

These checks are not a claim of independent native-reader or physical-device review.

## Reproduce pack checks

From an Engine checkout at the source revision, run `node scripts/docs-i18n/validate-pack.mjs /path/to/docs-i18n/hi`.

From the translation checkout, run `node scripts/ui-i18n/validate-packs.mjs /path/to/Engine/packages/client/src/localization/locales/en.json`. Regenerate the UI manifest with `--write-manifest` after later UI edits.

## Updated guides

- `docs/FAQ.md`
- `docs/TROUBLESHOOTING.md`
- `docs/agents/agents-overview.md`
- `docs/agents/approvals-and-agent-suite.md`
- `docs/agents/hierarchical-maps.md`
- `docs/agents/memory.md`
- `docs/appearance/custom-css-themes.md`
- `docs/characters/choosing-your-persona.md`
- `docs/chats/branches.md`
- `docs/chats/chat-settings.md`
- `docs/chats/connected-chats.md`
- `docs/chats/export-import.md`
- `docs/chats/group-chats.md`
- `docs/chats/managing-chats.md`
- `docs/chats/settings-profiles.md`
- `docs/conversation/schedules.md`
- `docs/conversation/selfies.md`
- `docs/extending/custom-tools.md`
- `docs/game/game-assets.md`
- `docs/game/getting-started.md`
- `docs/game/ltx-2-3-storyboards.md`
- `docs/game/party-and-npcs.md`
- `docs/game/sessions-and-saves.md`
- `docs/game/storyboard.md`
- `docs/lorebooks/entries.md`
- `docs/lorebooks/token-budgets.md`
- `docs/media/illustrator-agent.md`
- `docs/media/music.md`
- `docs/media/scene-backgrounds.md`
- `docs/media/scene-video.md`
- `docs/media/tts-setup.md`
- `docs/prompts/generation-parameters.md`
- `docs/prompts/presets.md`
- `docs/roleplay/backgrounds.md`
- `docs/roleplay/combat-encounters.md`
- `docs/roleplay/getting-started.md`
- `docs/roleplay/hud-and-trackers.md`

## Review and base integration

Local CodeRabbit completed all 41 changed files at `bf7ce35b7192a1b3266121ec9e5c63b3dd121f12` against `3386e3518c81802abf2dd0bdf998bb3e3499800c`, with zero findings. The subsequent merge of `docs-i18n` at `72ba79633069a4e5333596980ad92d8d97e03150` preserves its already-reviewed CharacterTavern guide changes and four Hindi UI strings. The three conflicts were generated manifests and adjacent JSON additions; there was no conflicting translation wording. Both manifests were regenerated and the 136-guide pack and UI pack validated again.

The #7054 translation source remains `d1339485460a6ce82a4248b8459c45b67af910db`. Later movable Echo/tracker and chat-style/menu changes are separate follow-ups. Hosted review is requested after this integration; local review alone is not merge clearance.
