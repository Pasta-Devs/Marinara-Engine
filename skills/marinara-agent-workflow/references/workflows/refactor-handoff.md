# Refactor Team Handoff

Use this for refactor, cleanup, architecture, and modernization work. It is not a replacement for `AGENTS.md`, `marinara-architecture-guard`, or `marinara-mode-separation`.

## What This Card Is For

Use this card when refactor work needs stronger guardrails around:

- proving behavior did not regress
- keeping PRs reviewable
- separating real blockers from architectural taste
- naming debt instead of hiding it
- avoiding cleanup that spreads coupling or ownership confusion

## Refactor Operating Rules

- State the refactor's behavioral claim before editing.
- Identify the owner subsystem or architectural boundary before moving code.
- Name the likely code-smell risk: bloat, repeated conditionals, shotgun surgery, disposable code, or coupling.
- Keep the first PR small enough to review.
- Prefer preserving behavior first, then improving structure in follow-up PRs when the safer path is split work.
- Verify the user-facing or API-facing behavior, not only the files touched.
- If behavior cannot be verified, say exactly what proof is missing.
- Do not call a refactor safe while known risky paths are untested.

## Safe Extraction Queue

Use this queue for hygiene-first testability work that must not change product
behavior:

- `GameSurface.tsx`: extract pure game time parsing, combat status normalization, inventory transforms, and background tag scoring one cluster at a time.
- `ChatMessage.tsx`: extract speaker-tag rendering, chat HTML/CSS sanitizing, attachment helpers, and timestamp formatting one cluster at a time.
- `PresetEditor.tsx`: extract tab/section reorder helpers, marker config readers, macro reference data, and textarea commit helpers one cluster at a time.
- `SettingsPanel.tsx`: extract tracker appearance option helpers, background-library normalization, import button state helpers, and advanced-setting option data one cluster at a time.

Each extraction PR must move one pure helper cluster plus focused proof, preserve
all UI behavior, and avoid broad component rewrites. Use existing tests or
temporary uncommitted tests/harnesses when useful; do not add durable test
artifacts unless a maintainer explicitly requested them.

## Blockers Vs Review Notes

Treat these as blockers:

- proof does not cover the stated behavioral claim
- changed code touches storage, migrations, auth, import/export, prompt assembly, destructive actions, or user data without claim-boundary proof
- the refactor changes public behavior without an explicit product decision
- the diff spreads the same conditional, mode, provider, or ownership rule across more files
- dead/speculative layers are added without an immediate caller
- the PR cannot be understood or reviewed as one coherent change

Treat these as review notes unless they create concrete correctness, proof, data-safety, security, or shipping risk:

- local duplication that is smaller than the abstraction needed to remove it
- naming or file-placement preferences
- contained bloat in code that was already scheduled for later cleanup
- style disagreements that do not affect maintainability or proof

## Refactor Proof Shape

```text
Core claim: <what behavior remains true after the refactor>
Owner boundary: <subsystem/service/module/component this work belongs to>
Risk: <none or storage/auth/import/export/prompt/destructive/user-data/etc.>
Positive proof: <commands, screenshots, scripts, or API/UI checks>
Negative controls: <should-not-change or should-not-match cases>
Untested paths: <explicit gaps, not implied confidence>
Debt: <none or deliberate/inadvertent + prudent/reckless + follow-up>
Mud risk: <none or label + containment/follow-up>
```
