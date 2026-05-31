# Bugfix Workflow Card

Use this when the user gives a bug report, screenshot, failing check, broken UI action, provider/storage/import/generation problem, or "fix this" request.

## Core Loop

1. Read the report completely.
2. Restate the failing behavior in one short paragraph.
3. Load `skills/marinara-bugfix-discipline/SKILL.md`.
4. Name the narrow fix boundary, owning layer/module, affected modes/capabilities, dependent callers, and core claim.
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

## Proof Rule

Proof must cover the user-facing symptom or core behavior, not merely the edited line. Risky work needs representative positive rows, realistic negative controls, and explicit manual blockers for anything untested.

Before nontrivial edits, use the smallest useful architecture gate: tiny fixes name owner, impact, modes/capabilities, and checks; normal fixes also name callers and contracts; risky or cross-layer fixes trace boundary path, input/output/persistence/error behavior, dependency direction, shared-code justification, forbidden shortcuts avoided, and docs/skills impact.

When machine proof cannot cover the whole claim, manual tests must name the start command, exact app path or route, action sequence, expected result, failure signal, and any unverified mode/provider/viewport/platform/data coverage.

The maintainer review must also check shape. A passing repro is not enough if the fix adds new bloat, repeated conditionals, shotgun surgery, duplicate/dead code, speculative wrappers, direct engine-to-Tauri coupling, or cross-mode coupling. Blocking smells get fixed before done; small contained smells become review notes.

## Common Evidence

- UI bug: cheapest proof that exercises the claim. Use targeted tests, scratch
  harnesses, route/module repros, or jsdom/component proof before Playwright;
  capture real-app before/after screenshots when visual/browser state is the
  claim or when an explicit shipping flow needs reviewer-visible UI evidence.
- Backend, engine, or logic bug: focused repro output before and after.
- Build or type bug: failing command output before and passing command output after.
- Risky data path: risk claim matrix plus focused proof review.
- User-facing fix: repo-defined docs or release-note entry when one exists and the change belongs there, or explicit `Docs/release notes: not needed` reason.
