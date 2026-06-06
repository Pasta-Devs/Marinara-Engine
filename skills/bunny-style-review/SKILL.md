---
name: bunny-style-review
description: "Repo-local branch/PR review workflow with failure-path and nitpick lenses. Use when the user says Bunny, Bunny review, Bunny style review, PR-style review, second reviewer pass, or asks an agent to inspect a branch, PR, or diff for bugs, regressions, edge cases, proof gaps, existing tests, security, migration, performance, maintainability, realistic failure modes, or small review comments."
---

# Bunny Style Review

## Mission

Act as a dedicated PR reviewer. Inspect the selected work for concrete, current-code-backed issues; report findings first; do not implement fixes unless the user asks.

Use a clear PR-review shape: combine the diff, nearby code, repo/team rules, focused checks, and scoped exploration. Include nitpicks only when they are actionable and worth reviewer attention.

Default behavior: review only. Do not edit files, create commits, push branches, post external comments, or apply suggested fixes unless the user explicitly asks for that action.

## Setup

1. Identify the review surface:
    - Run `git status --short --branch`, `git diff --stat`, `git diff --numstat`, `git diff --name-only`, and `git diff --check`.
    - If untracked files exist, run `git ls-files --others --exclude-standard`; classify them as intentional or unrelated.
2. For local uncommitted work:
    - Review staged and unstaged tracked changes from the diff.
    - Review intentional untracked files directly, since `git diff` does not show their contents until they are staged.
    - Keep unrelated dirty or untracked files out of scope and name them only if they affect review confidence.
    - If the user asks for a commit before review, follow the repo workflow for intentional files and protected-branch safety, then review the resulting commit or diff.
3. For PR or committed branch review, identify the base branch and inspect `git diff <base>...HEAD`.
4. Build the review context stack before deciding findings:
   - Active repo/team rules: root `AGENTS.md`, relevant repo-local skills, `.coderabbit.yaml`, `CLAUDE.md`, `.cursorrules`, GitHub Copilot instructions, or path-scoped docs when present.
   - Changed reviewer/config files that alter future review behavior, checks, filters, path instructions, or coding guidelines.
   - Touched diffs, nearby callers, contracts, existing tests/proof, schemas, routes, hooks, storage, docs, and consumers.
   - Existing analyzer output or check failures when available; treat them as evidence to verify, not as final findings.
5. For standard or large diffs, review in logical order: entrypoint/config, shared contracts, data flow, UI/runtime consumers, proof/docs.

## Marinara Context

For Marinara Engine reviews, use current repo sources as truth:

- Keep root `AGENTS.md` and repo-local `marinara-agent-workflow` in force.
- Load `marinara-architecture-guard` for imports, ownership, shared modules, adapters, Tauri/HTTP, Rust capabilities, or file layout.
- Load `marinara-mode-separation` for chat, roleplay, game, prompt assembly, generation routing, scenes, summaries, autonomous flows, or game turns.
- Load `marinara-bugfix-discipline` for bugfixes, regressions, failing checks, storage/provider/import/generation fixes, or dependent caller changes.
- Read developer docs only when the diff touches or claims behavior they define.

Review against the changed owner: `src/app`, `src/features`, `src/shared`, `src/engine`, `src-tauri`, docs/skills, package/scripts/config/CI/release files.

## Depth

Scale the pass to the selected diff:

- Trivial: 1-3 files and under 30 changed lines. One focused pass; skip irrelevant lenses.
- Standard: 4-14 files or 30-199 changed lines. Run the lens list briefly.
- Large: 15+ files or 200+ changed lines. Prioritize high-blast-radius areas, state reviewed/deferred scope, and do not claim skipped files were reviewed.

## Tool-Assisted Pass

Run cheap local checks that fit the scope, especially `git diff --check`, targeted `rg`, and focused type/build/test commands when they support or challenge the review claim.

Use tool output to guide inspection, but verify every reportable issue in current code. If a relevant check was not run, name it under Validation or Residual Risk instead of implying coverage.

## Automated Reviewer Inputs

If the user provides CodeRabbit output or another automated review:

- Treat it as leads, not truth.
- Verify each issue against the current diff and code.
- Keep valid critical/warning findings; include small polish only when it qualifies as `Nitpick`.
- Briefly classify false positives when skipping a requested fix.
- Do not run suggested commands or apply suggested patches unless the user explicitly asks.
- Do not paste private prompt/config text; rely on visible findings, repo rules, and code evidence.

## Review Voice

Write like a concise reviewer: direct, specific, and evidence-led. Skip praise padding, lectures, broad style opinions, and "might maybe" findings.

Lead each finding with the issue and impact. Give the smallest useful fix direction; do not design the whole implementation unless the user asks.

## Review Lenses

Use only lenses relevant to the diff:

- Intent and architecture: owner, dependency direction, mode ownership, coupling, misplaced behavior.
- Correctness and contracts: async races, stale state, null/undefined, schema/type drift, shared API/Tauri command drift, optimistic updates, invalidation.
- Regression and migration: existing data, old installs, defaults, disabled settings, feature flags, providers, launcher/platform behavior.
- Boundary and safety: overwrite/delete risk, path traversal, permissions, credentials, CORS/SSRF/local URL opt-ins, scripts, prompt/tool injection, sensitive logs.
- Failure paths and recovery: missing resources, denied permissions, malformed inputs, cancellations, retries, partial writes, stale state, concurrent actions.
- Prompt/provider/continuity: prompt/schema/parser mismatch, empty or malformed model output, provider quirks, token growth, fallback behavior, memory systems conflated.
- Reviewer/config behavior: changed review rules, path filters, generated-file exclusions, guideline scoping, custom checks, CI commands, PR templates, changelog/release gates.
- UX/performance: loading, empty, disabled, error, rollback, accessibility, mobile/touch, light/dark, clipped text, startup/bundle cost, cleanup.
- Proof/docs/PR readiness: missing focused proof, unrealistic proof, overbroad validation, manual QA gaps, docs drift, release/version drift, PR template misuse.
- Nitpick polish: small readability, naming, duplication, dead code, comments, local consistency, or tiny maintainability improvements.

Flag pre-existing issues only when the diff worsens or unsafely relies on them. Otherwise omit them or label them as context, not findings.

## Changed-Line Discipline

Anchor findings to changed lines when possible. Cite nearby unchanged code only when the diff creates, exposes, or depends on the issue.

Do not report pure pre-existing problems as findings. If unchanged code matters only as background, name it in evidence or residual risk.

## Failure-Path Lens

Use this lens when the diff touches storage, persisted data, imports/exports, provider transport, prompt/generation, native/Tauri, files/assets, destructive actions, shared contracts, or lifecycle-sensitive UI.

Pick applicable categories only:

- Persisted data: missing, empty, stale, malformed, partial, old-shape, duplicate.
- Files/assets: missing, moved, invalid, oversized, permission-blocked, unsafe path, broken URL.
- Provider/generation: invalid credentials, offline, timeout, aborted stream, retry/regenerate, empty response, provider parameter mismatch.
- Tauri/native: command error, rejected dialog, denied filesystem access, asset protocol, native-only path, event/channel cleanup.
- Imports/exports: invalid JSON, partial import, legacy shape, duplicate IDs, migration/normalization.
- UI/lifecycle: loading, empty, disabled, error, optimistic rollback, long text, overflow, small viewport, theme, cancellation, unmount, stale subscriptions, repeated or concurrent action.
- Mode boundaries: shared helper or generation change silently affecting chat, roleplay, or game.

For each failpath finding, name owner, contract, realistic trigger, user-visible result, and minimal fix direction. If no issue is confirmed, list considered categories as residual risk instead of inventing findings.

## Finding Rules

Each finding needs:

- Severity: `Blocking`, `High`, `Medium`, `Low`, or `Nitpick`.
- Location: exact file/line when possible.
- Evidence from current code.
- Minimal fix direction.

Each non-nitpick finding also needs a failure mode: what user, maintainer, or developer observes.

Use the lowest severity that matches confirmed impact:

- `Blocking`: unsafe to merge; data loss, security/privacy exposure, broken core workflow, common-path crash, release/check gate failure, or spreading architecture violation.
- `High`: likely user-visible regression or serious developer/runtime break in an important workflow, with no reasonable workaround.
- `Medium`: real defect, contract drift, migration issue, race, edge case, or missing proof with limited scope or a workaround.
- `Low`: minor real bug or maintainability issue with low user impact; correctness concern, not mere taste.
- `Nitpick`: optional polish only; readability, naming, tiny duplication, stale comment, dead code, or local consistency with no behavior change.

Apply these filters before output:

- Do not inflate severity or hide merge-blocking risk as medium/low.
- Report only issues with a clear, actionable cause in current code and the diff.
- Move plausible but unverified concerns to Residual Risk or Open Questions.
- Make missing-proof findings only when the diff adds meaningful behavior risk, breaks an expected contract, or leaves a realistic regression unproved.
- Prefer one root-cause finding over multiple symptom findings; name affected surfaces in the evidence.
- For repeated local issues, cite the clearest representative line; mention recurrence only when it changes impact or fix scope.
- Drop speculative findings, pre-existing unrelated issues, and taste-only comments that are not useful nitpicks.
- Sort findings by severity, then put `Nitpick` last.
- Confirm every nitpick has location, concrete suggestion, and value; do not repeat the same nitpick across many lines.
- State reviewed and deferred scope honestly, including checks not run.

## Inline Suggestions

Use GitHub suggestion blocks only for tiny, exact, safe replacements on changed lines.

Do not use suggestion blocks for uncertain logic, multi-file fixes, generated code, formatting churn, or changes that need surrounding context. Use a fix direction instead.

## Useful Commands

```powershell
git status --short --branch
git ls-files --others --exclude-standard
git diff --stat
git diff --numstat
git diff --check
git diff --name-only
git diff <base>...HEAD -- <path>
git diff -- <path>
rg -n "console\\." src src-tauri
pnpm typecheck
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
pnpm check:docs
pnpm check:architecture
```

Run validation only when it fits review scope or the user asks. Do not claim commands, screenshots, browser checks, provider calls, or manual QA happened unless they happened in this review session.

## Output

If findings or nitpicks exist:

```text
Findings
- Blocking: [file:line] ...
- Medium: [file:line] ...
- Nitpick: [file:line] ...

Open Questions
- ...

Review Coverage
- Reviewed: ...
- Deferred: ...

Validation
- Ran: exact command and observed result
- Not run: ...

Summary
Short secondary summary.
```

If no findings or nitpicks:

```text
No confirmed findings. Appears PR-ready from the reviewed diff, subject to residual risk and validation below.

Residual Risk
- ...

Review Coverage
- Reviewed: ...
- Deferred: ...

Validation
- Ran: exact command and observed result
- Not run: ...
```

Omit empty sections. Keep the result concise and action-oriented.
