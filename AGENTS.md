# AGENTS.md

This is the repository guide for coding agents. Canonical workflow, validation, and release guidance lives in `CONTRIBUTING.md`.

Shared skills live in `.claude/skills`; Codex accesses them through `.agents/skills → ../.claude/skills`. Use the instructions and capabilities supported by the current agent host.

## Codex Runtime and Models

- Use the instructions and tools actually supplied by the current Codex host. Codex discovers `AGENTS.md`/`AGENTS.override.md` and repository skills through `.agents/skills`; a Claude command, agent definition or hook is not automatically a Codex capability. Read the selected skill's `SKILL.md` before using it.
- Preserve the user's configured model and reasoning effort unless a model change is requested or an applicable workflow authorizes a selection. Verify model IDs and supported effort levels against the current host; API availability does not guarantee availability in Codex. Do not change the user's global configuration to carry out a repository task.
- When selecting an OpenAI model for an authorized task, use this repository's task-based guidance, not a supposed one-to-one translation of Claude model tiers:

| Work | OpenAI model, when available |
| --- | --- |
| Difficult architecture, cross-system debugging, final integration and demanding review | `gpt-6-astra` |
| Substantial implementation or detailed review | `gpt-5.6-sol` |
| Bounded implementation where balanced cost and capability matter | `gpt-5.6-terra` |
| Narrow searches, mechanical edits or focused checks | `gpt-5.6-luna` |

- The table is project guidance, checked against the available host models on 2026-09-17. Honor an explicitly requested supported model, including `gpt-5.5`, rather than silently substituting another. Use only reasoning levels exposed by that host/model; larger effort is not mandatory for routine work.
- When delegation is authorized, use the available Codex subagent tools for independent, bounded work with clear ownership. Keep integration and verification with the primary agent. Do not create user-visible tasks as a substitute for subagents unless the user asks for a new task. If delegation is unavailable, continue locally.
- Treat the runtime's sandbox, network permissions and approval tools as authoritative. Existing user authorization should not cause another conversational confirmation, but it does not bypass a tool-enforced boundary. Explain an actual denial or timeout accurately and use the permitted retry/recovery path.

References: [OpenAI agent instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [skills](https://learn.chatgpt.com/docs/build-skills), and [model catalog](https://developers.openai.com/api/docs/models).

## Expected Completion and Authorization

- Carry the requested work through implementation, appropriate validation, review fixes and the authorized publication steps. Do not stop at a plan, a clean local review, or a local commit when the user has asked for a PR.
- Local CodeRabbit review, including uploading the relevant branch changes, is part of this repository's expected review workflow. Do not ask the maintainer for a separate confirmation on each run. Honor any explicit restriction on external uploads and the host's permission controls.
- A request to publish or update a PR covers the necessary feature-branch commit/push, PR creation/update and transition to ready for review. Reuse that authorization across turns. Do not infer authorization to merge, promote to `main`, deploy or release.
- Ask only for missing decisions that materially block the task or for actions outside its authorized scope. A previously agreed phase does not need another phase-approval question. Current maintainer instructions override default workflow or skill guidance within the platform's instruction hierarchy.
- Report what was completed and verified, link the PR, and identify real remaining blockers. Do not imply that queued, skipped or pending checks passed.

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

- Do not keep `.test.ts` files in the repo. If an agent creates one for local proof, remove it after the test is done.

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

1. Open a draft early while implementation is in progress, so issue ownership and work status are visible.
2. Finish implementation and the required local checks. Run CodeRabbit locally; reproduce or trace each finding, fix legitimate defects and rerun review after substantive fixes. Record code-based reasons for rejecting false positives, non-regressions and purely pedantic suggestions. Do not claim zero findings when findings were dismissed.
3. Once implementation, required local validation and substantive local review are complete, **push and mark the PR ready for review in the same workflow without asking again**. If the first PR is only being created at that point, create it ready rather than draft. A user request to keep it draft is an exception.
4. Keep a PR draft only for unfinished implementation, unresolved substantive local findings, blocked required local validation, or an explicit maintainer instruction. Unchecked human checklist items and documented optional follow-ups are not automatic draft blockers. Pending GitHub CI and GitHub CodeRabbit are merge gates, not reasons to leave completed local work in draft; the GitHub review must be allowed to run.
5. Inspect CI/review feedback when preparing a PR for review or shipping it. Address valid failures within scope. Never merge until all repository merge gates pass and merging is authorized.

The local review conserves the shared CodeRabbit quota and complements the GitHub review. Use an existing PR rather than creating another for follow-up fixes.

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

Storage-format rule (separate from the app version — never touched by `version:sync`):

- Root `storage-format.json` must equal `STORAGE_VERSION` in `packages/server/src/db/file-backed-store.ts`. It changes only when the on-disk storage layout changes; the launcher/updater downgrade guard reads it via `git show` on the update target, so a missed bump silently disables that protection. The launcher-format-guard regression pins the pairing.

## Safe Multi-File Updates

- When changing version numbers, bump root `package.json` first, then run `pnpm version:sync -- --android-version-code <next-code>`.
- When changing version numbers or preparing a release, run `pnpm credits:check`; if it fails, run `pnpm credits:sync` and include the Credits modal update.
- Run `pnpm version:check` before tagging or publishing.
- Keep `CONTRIBUTING.md` authoritative. Add agent-specific notes here only when they are operationally useful and not already covered there.

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
