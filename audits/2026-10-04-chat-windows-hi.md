# Hindi chat window guide update — issue #7054

This group updates the 37 Hindi guides affected by the chat window redesign and widget color controls. It translates the changed passages rather than replacing unrelated existing translations.

## Source

- English baseline before the redesign: `94ce3d6851ab635f4b08c8570dcaed5973f93fbc`.
- English source for this update: `6d6cb06e53aa9333e2c84dcf495b58d598e5ba48` (PR #7062, following merged #7049).
- Translation branch baseline: `e3c6a3744cb367de6fef3e707b8f6cbce08ed67c`.
- Related translation issue: #7054. This language group alone does not close it.

## Content and checks

The changed instructions explain movable chat controls, drawers, pins and locks, saved profiles and favorite layouts, desktop and phone tracker views, onboarding, widget presets and the three color controls. Paths now lead to the current Chat Settings sections. Advanced Recall progress points to Agent activity.

- All 37 targeted guides updated; pack validation passes for 136 Hindi / 136 English guides.
- New CSS API identifiers and the complete CSS example are byte-identical to English. Relative link targets are validated against English.
- Twelve English fragment aliases keep the new cross-guide links usable when the translated files are read directly on GitHub.
- Whole-pack Devanagari token audit introduces no new nukta-stripped spelling splits. Existing unrelated residuals recorded in the Hindi glossary remain separate.
- No new nonbreaking spaces or zero-width characters. Changed prose follows the glossary's आप, modern technical Hindi and danda conventions.
- The UI pack translates all 128 relevant new/changed keys. The two guided-regeneration keys were already translated by #7064 and remain unchanged. Removed the 12 obsolete chat-help keys that were present among the 41 deleted English keys.
- UI validation checks key ordering, interpolation/markup preservation and manifest hashes. Missing unrelated UI keys continue to use English fallback. Other language packs' existing stale keys are reported separately.

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
