# Settings, world clock and package SDK translation follow-up

Issue: [#8303](https://github.com/Pasta-Devs/Marinara-Engine/issues/8303).

English source: `3ffae95df89001f4d5116c344687ac0dd3fe57bd` on `staging`.
Initial translation base: `d814c33379e782d35e3765a9b3fe92b6cdf1d48b` on `docs-i18n`.

This follow-up covers the documentation and interface changes from PRs #8302,
#8301 and #8210. Runtime behavior and unrelated translation drift are outside
this patch.

## Scope

- Update Card CSS control locations, extension revision-history retention,
  tracked world-clock macros and the native/legacy Zod SDK boundary in the four
  affected guides across the ten existing documentation languages.
- Translate the three world-clock macro descriptions, the two existing Card CSS
  help strings and the extension revision-history interface strings across the
  eleven existing UI packs, preserving interpolation tokens and English fallback.
- Correct the existing `game.combat.ruleset.event.area` message in each UI pack:
  English removed the coordinate and cell-count placeholders in `f5f031330`.
  The unchanged old translations failed the official token validator; this
  compatibility repair removes those unsupported values without changing combat.
- Preserve code blocks, inline literals, paths and link targets. No existing
  translated pack carries `extending/ruleset.schema.json`; no translated schema
  is introduced. Its canonical generated English artifact stays authoritative.
- Rebuild and validate documentation and UI manifests, complete review, and
  verify the changed published bytes before closing the issue.

## Delivery evidence

The scoped updates cover 40 guides in `de`, `es`, `fr`, `hi`, `ja`, `ko`, `pl`,
`pt-br`, `ru` and `zh-hans`. All eleven UI packs cover the 15 requested keys plus
the one proven pre-existing combat-message token repair. Other partial UI
translations retain English fallback; existing stale keys are reported rather
than padded or deleted.

Completed local validation:

- Frozen Engine dependency installation and full `pnpm check` passed against
  the pinned English source. No Engine runtime source is changed by this PR.
- The actual documentation-language and UI-language-pack regressions passed.
- All ten rebuilt documentation manifests validate, covering 141 files each.
  Their `sourceCommit` records the canonical validation reference, not a claim
  that this limited patch updates every guide's unrelated historical drift.
- The UI pack validator passed generation and verification against the pinned
  English catalog. Its earlier failure and the old placeholder strings were
  retained as a negative control before the compatibility repair.
- An independent size/hash pass verified all 1,410 documentation entries and
  all eleven UI manifest entries.
- Structural comparison of all 40 edited guides preserved every existing fenced
  example and link target; inline-literal additions and removals match the exact
  English PR deltas. Scoped UI edits preserve interpolation, metadata, native
  wording, ordering and normalization. `git diff --check` passed.
- Language-owner self-review and independent cross-checks of the additional
  combat message found no actionable wording or token defect.

Local CodeRabbit review is part of the PR delivery record. Hosted Dottore and
application CI are configured for runtime branches, not this orphan translation
branch; a skipped review is not recorded as a substantive examination. Manual
in-app navigation, search and language refresh remain separate checks.

The linked PR records the final review outcome, merge ancestry and post-merge
comparison of all changed raw files on both immutable and live `docs-i18n`
URLs. Issue closure requires that publication check to pass.
