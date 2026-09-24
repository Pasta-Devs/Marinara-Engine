# Agent achievement translation follow-up — 2026-09-25

This follow-up addresses [#6645](https://github.com/Pasta-Devs/Marinara-Engine/issues/6645) after the full catchup in [#6636](https://github.com/Pasta-Devs/Marinara-Engine/pull/6636) merged.

## Source and scope

- English source: [PR #6635](https://github.com/Pasta-Devs/Marinara-Engine/pull/6635), commit `6c900594d06e6de14e1d4c4577bc78b1ce86232b`. The source PR was still open when translation began; this follow-up depends on that feature.
- Translation baseline: `a0df7a43f85a081be0d5eed9fbd8b459ea826bc4` on `docs-i18n`.
- Pages: `home/achievements.md` and `development/optional-agent-packages.md` in `de`, `es`, `fr`, `hi`, `ja`, `ko`, `pl`, `pt-br`, `ru`, and `zh-hans`.
- Translate the new agent-achievement section and Capability API 1.36 section, preserving executable examples, identifiers and link targets. Existing API 1.32 guidance is already present from the merged catchup.
- This is a focused follow-up, not a new whole-pack date audit. The earlier audit retains its original source snapshot and timestamps.

## Included correction

While adding API 1.36, the same page’s API 1.34 text was found to prohibit block actions in seven translations (`de`, `hi`, `ja`, `ko`, `pl`, `ru`, `zh-hans`). English means that a sheet-backed creature may omit them. `rulesetCreatureSchema` confirms this: `actions` defaults to an empty array, while only the six `CREATURE_SHEET_REPLACES` fields are refused beside a sheet. These sentences now express optional actions while preserving the forbidden fields. Spanish, French and Brazilian Portuguese were already correct. The full implementation handoff already describes optional actions correctly in every language and was left unchanged.

## Verification

- Both source sections are translated in all ten packs: four user-facing paragraphs and all seven API rules, including permission and ownership checks, the methods, paired progress fields, the asynchronous-only two-second timeout, artwork and locale keys, the 32-badge atomic registration limit, and retained unlocks after removal.
- The focused 20-file comparison passes: exact fenced examples and inline-code occurrence counts, unchanged link targets, source heading levels, section structure, NFC and whitespace. Surrounding content is unchanged except the documented API 1.34 correction; that correction preserves all technical literals.
- Integration corrected three new API headings from level two to the source’s level three before the final check passed.
- All ten manifests were rebuilt against the pinned source and passed the official pack validator: **132 translated guides / 132 English guides** per pack, with matching hashes and no missing or orphaned guides.
- `pnpm install` and `pnpm check` passed in the unchanged Engine checkout. The first restricted check could not run its context loader; the permitted rerun completed successfully. No application code or release metadata changed.
- Local CodeRabbit review is in progress; its result will be recorded before readiness.
- Manual Download & Replace, in-app display/search and independent native-reader sampling remain unperformed human checks. No runtime verification of the feature in #6635 is claimed by this translation PR.
