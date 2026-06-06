# Bugfix Workflow Card

Use this when the user gives a bug report, screenshot, failing check, broken UI action, provider/storage/import/generation problem, or "fix this" request.

## Core Loop

1. Read the report completely.
2. Restate the failing behavior in one short paragraph.
3. Load `skills/marinara-bugfix-discipline/SKILL.md`.
4. Name the cheap gate first: core claim, likely owner/lane, risk level, and proof target.
5. Name the main code-smell risk when the bug is not tiny.
6. Reproduce before editing when practical; if not practical, state the closest representative proof.
7. Trace one hypothesis at a time across UI, feature API/hook, engine, shared API adapter, Tauri command, and Rust capability as needed.
8. Fix the lowest correct owner, not the most convenient caller.
9. Remove obsolete fake-success, catch-and-ignore, old-shape compatibility, broad default, or placeholder branches exposed by the fix.
10. Verify the original repro or closest representative path no longer fails.
11. Run the checks that match the touched area.
12. Report root cause, files changed, docs/release-note status when relevant, verification, related issues not fixed, and manual blockers.

Ordinary bugfix language means local fix and verification. Commit, push, PR
creation, CodeRabbit, CI polling, screenshot upload, ready marking, and merge
start only after an explicit shipping request.

Do not run full `pnpm check` for every ordinary local bugfix. Use the focused
proof and the matching lane validation command. When the user asks to ship, push,
open a PR, or mark ready, switch to the PR workflow and run full `pnpm check`
there before the PR leaves local hands.

## Fast + Cheap Tiering

- Tiny local path: use this for narrow, low-risk, machine-provable bugs that do not touch schema/version/dependency/auth/storage/import/export/prompt/provider/security-sensitive paths, cross-entrypoint behavior, PR state, or browser-evidence-dependent claims. Do not create a full ledger by default. Finish with a compact receipt: `Claim`, `Proof`, `Validation`, `Files`, `Risk`, and `Vault`.
- Full workflow path: use the ledger, proof-health, and fast-lane helpers for nontrivial, risky, PR-affecting, cross-boundary, browser-evidence-dependent, or uncertain bugs. If risk appears during a tiny fix, stop treating it as tiny and upgrade the workflow.
- Exploration budget: read the report completely, then inspect the likely owner path and direct callers first. Pivot only after the current hypothesis is falsified; do not search broadly just to feel safer.
- When available, `workflow-health.mjs` is for nontrivial work, PR work, issue selection, and risky workflow changes. It is not mandatory for a tiny one-file local bug unless repo policy or visible risk requires it.

## Proof Rule

Proof must cover the user-facing symptom or core behavior, not merely the edited line. Risky work needs representative positive rows, realistic negative controls, and explicit manual blockers for anything untested.

Before nontrivial edits, use the smallest useful architecture gate: tiny fixes name only the cheap gate; normal fixes also name callers and contracts; risky or cross-layer fixes trace boundary path, input/output/persistence/error behavior, dependency direction, shared-code justification, forbidden shortcuts avoided, and docs/skills impact.

When machine proof cannot cover the whole claim, manual tests must name the start command, exact app path or route, action sequence, expected result, failure signal, and any unverified mode/provider/viewport/platform/data coverage.

The maintainer review must also check shape. A passing repro is not enough if the fix adds new bloat, repeated conditionals, shotgun surgery, duplicate/dead code, speculative wrappers, direct engine-to-Tauri coupling, or cross-mode coupling. Blocking smells get fixed before done; small contained smells become review notes.

## Common Evidence

- UI bug: cheapest proof that exercises the claim. Use existing test output,
  temporary uncommitted tests or harnesses, route/module repros, or
  jsdom/component proof before Playwright;
  capture real-app before/after screenshots when visual/browser state is the
  claim or when an explicit shipping flow needs reviewer-visible UI evidence.
- Backend, engine, or logic bug: focused repro output before and after.
- Build or type bug: failing command output before and passing command output after.
- Risky data path: risk claim matrix plus focused proof review.
- User-facing fix: repo-defined docs or release-note entry when one exists and the change belongs there, or explicit `Docs/release notes: not needed` reason.
