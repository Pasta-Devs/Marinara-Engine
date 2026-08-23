# AGENTS.md

This file is a thin maintainer note for contributors using Codex. Canonical workflow, validation, and release guidance lives in `CONTRIBUTING.md`.

## Agent Workflow Overlay

- Follow `.github/agents/chai-workflow.md` as the repo's additive AI-agent workflow overlay for proof discipline, bugfix lanes, feature sizing, issue filing, PR gates, and risky-work claim boundaries.
- The overlay does not replace this file, `CONTRIBUTING.md`, package instructions, or maintainer requests. Repo rules and the user's latest request still win.

## Ponytail Implementation Discipline

- Apply [Ponytail](https://github.com/DietrichGebert/ponytail) as an additive minimalism overlay after understanding the task and tracing the affected flow. It never overrides repository rules, validation requirements, or the maintainer's latest request.
- Before adding code, stop at the first option that works: skip unnecessary work, reuse an existing helper or pattern, use the standard library, use a native platform capability, use an already-installed dependency, choose a clear inline solution, then write the minimum new code.
- Prefer shared root-cause fixes after checking every caller, deletion over addition, boring over clever, and the fewest files. Avoid speculative abstractions, dependencies, and boilerplate.
- Never trade away trust-boundary validation, data-loss prevention, security, accessibility, real-hardware calibration, or explicitly requested behavior.
- Non-trivial logic must leave behind the smallest runnable regression proof. Trivial one-line and instruction-only changes do not need a dedicated test.
- Mark a deliberate shortcut with a `ponytail:` comment that names its known ceiling and the upgrade path.

## Preferred Workflow

- Start with `pnpm install`.
- Run `pnpm check` as the baseline validation command.
- Run `pnpm version:check` when you touch release metadata, version-bearing files, or README release references.
- For every bug fix, behavior change, or new feature, add a concise user-focused entry under the appropriate `CHANGELOG.md` `[Unreleased]` heading. Purely mechanical changes with no product or contributor-workflow impact do not need an entry.

## Temporary Tests

- Do not add temporary or exploratory test files to the repository.
- Tests created solely for local proof, debugging, or experimentation must be removed after use.
- Permanent automated tests belong under `tests/` and its subdirectories.
- Permanent test files may use the `*.test.ts`, `*.spec.ts`, or `*.e2e.ts` naming conventions.

## Repo-Specific Cautions

- Keep edits non-destructive. Do not revert unrelated work in the tree.
- Make Marinara Engine changes against `staging` first; do not target `main` directly unless the user or maintainer explicitly asks for a mainline change. See `CONTRIBUTING.md § Branches`.
- Required checks and CodeRabbit must complete before any `staging` merge. PRs from active Pasta-Devs organization members and owners do not require another human approval; outside and first-time contributors require an approving review from `SpicyMarinara`. Organization members with repository merge permission may merge internal PRs after those gates pass.
- Only `SpicyMarinara` may promote the repository's `staging` branch into `main` or merge a same-repository `hotfix/*` branch.
- Prefer focused patches that keep code, docs, and release metadata aligned in the same change.
- Route changes to downloadable agents such as Illustrator, Music DJ, and Lorebook Keeper to [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Agent definitions, default prompts, package-owned runtime code, metadata, artwork/assets, manifests, artifacts, and catalog entries must be fixed and submitted there against its `staging` branch, not in Marinara Engine.
- Keep host integration changes in Marinara Engine. Package loading, capability APIs and shared contracts, Engine UI/settings, storage, provider/model routing, orchestration, and compatibility handling remain Engine-owned even when the affected feature is an agent. Determine which side of this boundary owns a fix before opening an issue, branch, or PR; split cross-repository changes when both sides are affected.
- Agent-specific coordination rule: before starting issue work, check for an existing issue-linked branch, open PR, draft PR, or project board item so multiple agents do not duplicate effort. See `CONTRIBUTING.md` for the general contributor workflow.
- Agent-specific coordination rule: when implementation effort starts for an issue, open a draft PR immediately so the project Kanban board shows the work in progress.
- Agent-specific coordination rule: when starting work on an issue, tag or identify the GitHub user or agent owning that issue/PR on the single issue so ownership is visible before implementation proceeds.
- When preparing a PR, make the why explicit in the description so reviewers can see the user problem or rationale, not just the file changes.
- Check `README.md`, `android/README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/CONFIGURATION.md`, `docs/TROUBLESHOOTING.md`, and `docs/FAQ.md` together when install, update, or release behavior changes.
- When a change adds, renames, or edits user-facing docs under `docs/`, also update every translated language pack on the `docs-i18n` branch to match — or open a `[docs-i18n] <paths>` follow-up issue. Renames/deletions must be mirrored there or the translation is silently orphaned. See `CONTRIBUTING.md § Translated documentation`.

## AI-Generated Pull Request

- **Never auto-check validation or test-plan checkboxes in a PR.** Those boxes are a to-do list for the human contributor, not evidence that work is done. If you generate a test plan, leave every box unchecked.
- When preparing a PR description, list what needs manual verification clearly and explicitly. Write entries like "Manually verify X in browser" rather than "Works correctly."
- If there is no linked issue or feature request, note that one should be opened before the PR is submitted. See `CONTRIBUTING.md § Before You Open a Pull Request`.

## Version Truth

- Canonical version: root `package.json`
- Release tag format: `vX.Y.Z`
- Release-notes source: `CHANGELOG.md`
- Derived version files that must stay in sync:
  - `packages/client/package.json`
  - `packages/server/package.json`
  - `packages/shared/package.json`
  - `packages/shared/src/constants/defaults.ts`
  - `win/installer/installer.nsi`
  - `win/installer/install.bat`
  - `android/app/build.gradle`

Android-specific rule:

- `versionName` matches the app version.
- `versionCode` increments for every shipped APK.

## Safe Multi-File Updates

- When changing version numbers, bump root `package.json` first, then run `pnpm version:sync -- --android-version-code <next-code>`.
- When changing version numbers or preparing a release, run `pnpm credits:check`; if it fails, run `pnpm credits:sync` and include the Credits modal update.
- Run `pnpm version:check` before tagging or publishing.
- Keep `CONTRIBUTING.md` authoritative. Add Codex-specific notes here only when they are operationally useful and not already covered there.

## Logging

- **Never use `console.log/warn/error` in server code.** Always import the shared Pino logger:
  ```ts
  import { logger } from "../lib/logger.js"; // adjust relative path
  ```
- Use the correct level: `logger.error` for failures, `logger.warn` for non-fatal issues, `logger.info` for operational milestones, `logger.debug` for verbose traces (prompts, timing, state patches).
- When adding a new agent, model generation route, image generation route, or prompt-building helper, wire prompt logging before shipping it. Accept/pass UI `debugMode` where relevant, honor `DEBUG_AGENTS`, and use `logDebugOverride(...)` or an equivalent `debugLog` callback so the final prompt sent to the provider is visible in debug mode even when the default log level is not `debug`.
- Use Pino format specifiers for multi-arg calls: `logger.info("Resolved %d agents", count)` — not `logger.info("Resolved agents:", count)`.
- Log errors with the error object first: `logger.error(err, "Import failed")`.
- Client code (`packages/client/`) should keep using `console.*` — the browser has no Pino, and production builds strip `console.log` automatically.
- See `CONTRIBUTING.md § Logging` for full guidelines and `docs/CONFIGURATION.md § Logging Levels` for the user-facing reference.

## Frontend Changes

- **Read `packages/client/.instructions.md` before editing any client code.** It is the authoritative reference for architecture, patterns, conventions, and common-mistake avoidance.
- Treat localization as part of every client UI change. New or changed user-facing labels, messages, tooltips, placeholders, toasts, confirmations, accessibility text, tutorials, and similar copy must use semantic localization keys and update the canonical English catalog in the same change. Community locale files are intentionally partial: update only translations the contributor can responsibly supply, and let missing keys fall back to English. Never touch every bundled locale merely to copy English or satisfy key parity. Do not translate model prompts or user-authored content. Run `pnpm localization:check` before shipping.
- Validate with `pnpm check` (TypeScript + ESLint). Use `pnpm regression:prompt` for prompt/lorebook/macro regressions and `pnpm smoke:ui` for the browser shell smoke suite when the change touches those areas.
