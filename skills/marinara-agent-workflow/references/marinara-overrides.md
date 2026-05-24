# Marinara Overrides For Workflow Pack Assumptions

Use this file when auditing source-pack assumptions or translating workflow-pack wording into this repo.

## Repo Rules Win

`AGENTS.md` and the repo-local skills are the authority. The workflow pack is an overlay for proof, review, risk, and communication discipline.

## Architecture Sources

The pack's `docs/ARCHITECTURE_MAP.md` reference maps to:

- `AGENTS.md`
- `docs/developer/architecture.html`
- `docs/developer/modules.html`
- `docs/developer/impact-areas.html`
- `skills/marinara-architecture-guard/SKILL.md`
- `skills/marinara-mode-separation/SKILL.md`

## Changelog And Release Notes

This repo currently has no root `CHANGELOG.md`. Do not invent one just because a source card mentions changelog discipline.

For user-facing or PR-affecting changes, update the repo-defined docs or release-note source only when one exists and the change belongs there. Otherwise report `Docs/release notes: not needed` or `Release notes: not applicable` with the reason.

## Scratch And Durable State

Use temporary/session-local proof notes for transient work. Do not add a new `scratch/` convention unless the task explicitly needs a local throwaway artifact.

Do not use repo-local update folders for status tracking. Durable bug ownership and active work status belong in GitHub issues or PRs; reusable debugging lessons and architecture decisions belong in repo docs or skill references only when they change durable guidance.

Do not store secrets, private user data, bulky raw logs, or machine-local paths in durable repo files.

## Automation Helpers

The source pack mentions `.agents/automation/scripts/*`, `workflow-health`, `pr-health`, `proof-health`, `publish-evidence`, and `automation-ledger`. This repo does not currently provide those helpers.

When a helper is missing, use equivalent direct checks: `git status`, `git remote -v`, focused tests, `pnpm typecheck`, `pnpm build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `pnpm check:docs`, GitHub CLI/API checks, browser automation, or manual verification scripts.

Do not treat missing pack automation as a blocker. Treat it as a reason to make the evidence explicit in the final report.

## Branches And PR Targets

The source pack has Marinara assumptions about legacy `staging` and team-branch workflow. This checkout is `Pasta-Devs/Marinara-Engine` on the `refactor` branch unless the current task says otherwise.

Always verify `git status --short --branch`, `git branch --show-current`, and `git remote -v` before shipping. Do not assume `staging`, `main`, fork workflow, or team-branch workflow unless the current repo and user request confirm it.

Never push directly to protected branches or force-push without explicit approval.

## Issue Templates And Labels

This repo currently has no issue templates under `.github`. If templates or labels are absent, draft honest issue text without pretending template fields or labels exist.

When labels are available, apply only labels from the live repo label list. Leave uncertain labels off.

## UI And Evidence

For UI changes, classify UX risk:

- Low: tiny visual or interaction fix, no new flow, no new user decision point.
- Medium: new panel, modal, settings section, empty/error/loading state, or workflow inside an existing surface.
- High: onboarding, first-run setup, destructive action, import/export, mobile-heavy flow, or advanced feature exposed to nontechnical users.

For medium/high UX risk, define the primary user path, expected states, mobile/theme proof, and whether an Impeccable critique/polish pass is useful.

Use Playwright or the in-app browser for repeatable UI proof when practical. Commit screenshots only when they are intentional docs/reference assets, not temporary proof clutter.

## Issue Intake Extras

Before filing a bug, require enough information to fill required summary, expected behavior, actual behavior, reproduction, environment, and needed screenshot/log evidence honestly.

Before filing a feature request, check whether existing Marinara features, settings, docs, prompts, lorebooks, or workflows already cover the requested outcome. If they do, explain the existing path and do not file unless the user explicitly says to file anyway.
