---
name: marinara-agent-workflow
description: "Apply Marinara's repo-local version of the Chai agent workflow pack for proof discipline, investigations, feature sizing, refactor handoffs, reviews, PR readiness, reviewer feedback iteration, issue drafting, UI/UX proof, security-sensitive checks, risky-work evidence, debt notes, and final status reports. Use for nontrivial coding work, ambiguous symptoms, refactors, reviews, PR/issue workflows, or any task where an agent must prove claims while preserving Marinara's code separation and module ownership rules."
---

# Marinara Agent Workflow

## Overview

Use this as a repo-specific workflow overlay, not a replacement for `AGENTS.md`
or more specific Marinara skills. It keeps proof, review, risk, and
communication discipline aligned with Marinara's layered Tauri architecture.
Source context: adapted from `cha1latte/chai-agent-workflow-pack`.

## Priority

Follow instructions in this order:

1. Root `AGENTS.md` and repo-local skills.
2. The user's latest request.
3. This workflow overlay.
4. Assistant defaults.

When this workflow conflicts with a repo rule, keep the repo rule. When it makes verification, security, destructive actions, external communication, or user-data handling safer, call out the conflict briefly and use the safer path if it does not violate repo policy.

## Load With

- Load `skills/marinara-architecture-guard/SKILL.md` for imports, file layout, shared modules, runtime adapters, Tauri/HTTP boundaries, Rust capabilities, repositories, or cross-feature boundaries.
- Load `skills/marinara-mode-separation/SKILL.md` for chat, roleplay, game, prompt assembly, generation routing, scene logic, autonomous flows, or mode UI.
- Load `skills/marinara-bugfix-discipline/SKILL.md` for regressions, broken UI actions, failing checks, provider/storage/import/generation problems, or root-cause repairs.

Load only the workflow card that matches the current lane:

- `references/workflows/investigate.md` for symptoms, logs, screenshots, confusing runtime behavior, or suspected regressions.
- `references/workflows/bugfix.md` for broken behavior and root-cause fixes.
- `references/workflows/feature-build.md` for new capability work.
- `references/workflows/refactor-handoff.md` for refactor, cleanup, architecture, and modernization work.
- `references/workflows/review-and-pr.md` for reviews, PR readiness, shipping, and reviewer feedback.
- `references/workflows/issue-submission.md` for GitHub issue drafting or filing.
- `references/workflows/durable-notes.md` for durable bug ownership, work status, reusable debugging lessons, or architecture decisions.

Use `references/marinara-overrides.md` when auditing a source-pack assumption or deciding how to translate pack wording into this repo.

Read `references/proof-templates.md` as the template index when a task needs a risk matrix, PR proof block, reviewer thread ledger, manual verification script, debt note, or final done shape. The concrete pack-derived templates live under `references/templates/`.

Read `references/source-map.md` when auditing or updating this skill against `cha1latte/chai-agent-workflow-pack`.

## Repo Boundary Gate

Before nontrivial edits, scale the gate to risk:

- Tiny local bug: core claim, likely owner/lane, risk level, and proof target.
- Normal: owner, impact area, callers, contracts, affected modes/capabilities, checks.
- Risky or cross-layer: boundary path, input/output/persistence/error behavior, dependency direction, shared-code justification, forbidden shortcuts avoided, docs/skills impact.

For new implementation work on the refactor line, read `CONTRIBUTING.md`, confirm the current checkout against `origin/refactor`, and start from a fresh topic branch unless the user explicitly says to continue the current branch. For PRs, read `.github/pull_request_template.md` and preserve its sections.

This workflow does not restate Marinara's architecture rules. For module ownership, import direction, mode boundaries, or hostable runtime details, load the specific owner skill:

- `marinara-architecture-guard` for layer placement, shared API wrappers, Tauri/HTTP dispatch, Rust capabilities, and remote runtime allowlists.
- `marinara-mode-separation` for chat, roleplay, game, prompt, generation, and mode UI boundaries.
- `marinara-bugfix-discipline` for root-cause repair rules and anti-band-aid constraints.

If ownership, callers, contract shape, or dependency direction cannot be named clearly after loading the owner skill, resolve that before editing.

## Core Loop

1. Pick the lane: investigate, bugfix, feature build, refactor, review/PR, issue drafting, or durable note.
2. State the narrow claim being proven.
3. Name the owner and expected impact before editing.
4. Reproduce or inspect enough evidence to avoid patching the wrong layer.
5. Make the smallest coherent change in the owning module.
6. Verify the claim with the cheapest proof that exercises it: targeted command, existing test output, temporary uncommitted test or harness, route/module repro, jsdom/component proof, browser proof, or manual script.
7. Review the diff for ownership, duplication, coupling, bloat, repeated conditionals, and hidden fallbacks.
8. Report verification gaps as gaps, not confidence.

## Credit-Aware Defaults

Keep coding and review quality high. Use high/adaptive reasoning for code edits,
reviews, risky debugging, and architecture; save credits by avoiding unnecessary
agents, browser proof, and PR/CI loops.

Ordinary bugfix language means local fix and verification by default. Do not
commit, push, open or update PRs, trigger CodeRabbit, poll CI, mark ready, upload
screenshots, or merge unless the user explicitly asks to ship, push, open a PR,
or ready the work.

For a narrow, low-risk, machine-provable local bug, use the tiny path: no full
ledger by default, a narrow owner/proof gate before editing, the matching
validation command after editing, and a compact final receipt. Upgrade to the
full workflow as soon as the bug is nontrivial, PR-affecting, cross-boundary,
storage/import/export/prompt/provider/security-sensitive,
browser-evidence-dependent, or uncertain.

Use a proof ladder before browser automation: static inspection, existing test
output, temporary uncommitted tests or harnesses, route/module repros, and
jsdom/component proof first; use
Playwright/browser proof when visual layout, interaction, routing, responsive
behavior, screenshots, console/network behavior, or browser-only behavior is the
claim.

Proof is session evidence, not permission to add durable test artifacts. Unless
a maintainer explicitly asks for tests, do not add or submit new test artifacts
in any language as PR proof, including `*.test.*`, `*.spec.*`, `tests/`,
`__tests__/`, Rust `#[test]` or `#[cfg(test)]` modules, snapshots, fixtures, or
committed harness files. Temporary tests and harnesses are allowed when they stay
local and uncommitted; cite their command output or resulting observation
instead of submitting the artifacts. If a durable regression test is the right
engineering answer, ask first and explain why existing proof paths are
insufficient.

## Risky Work

Treat these as risky: storage, migrations, import/export, installers, user data, prompt assembly, provider transport, auth/secrets, destructive actions, cross-entrypoint behavior, legacy compatibility, and new abstractions.

Risky work needs claim-boundary proof: core claim, entrypoints, current and legacy paths, positive rows, negative controls, ground-truth facts, user-facing copy when relevant, manual blockers, and untested paths.

Ground-truth facts for app-owned behavior must come from the app, artifact, fresh build/install, code path, or focused harness. Use external docs only for outside behavior such as third-party APIs, operating-system semantics, or tool behavior.

Detection and destructive logic needs negative controls. If code decides that a file is user data, a path is safe, an import is valid, a provider response is parseable, or an action is safe to delete/overwrite, prove at least one realistic should-not-match row when the claim depends on it.

User-data, backup, destructive-action, import/export, and migration warnings must name the exact files, folders, companion files, current/legacy layouts, and user action when those details affect safety.

For security-sensitive work, check client-only trust, hardcoded secrets, leaked environment values, missing authorization, unsafe paths, unsafe import/export assumptions, destructive-action ambiguity, overbroad network/origin behavior, and should-not-match rows.

For generation or memory work, trace the full path from input or persisted data through prompt assembly, model/provider call, parser/repair/validation, persistence, and UI/debug visibility. Do not conflate chat memory, roleplay scene memory, game state text, lorebook activation, summaries, knowledge retrieval, or autonomous memory.

## Communication

- Keep routine updates short and concrete.
- For reviews, lead with findings.
- For PR bodies, issue bodies, and reviewer replies, draft exact external text and wait for approval unless the user already gave standing approval.
- Do not claim tests, browser checks, screenshots, pushes, posts, or command verification happened unless they did.
- Final reports for code changes must include behavior changed, files/modules touched, impact area, dependent areas reviewed, verification, and remaining risk.

## Tool Capability Fallback

Use the best local tools available. If the current agent cannot read files, run commands, inspect screenshots, browse local UI, or fetch current docs, ask for the smallest exact artifact needed or provide the exact command/manual test for the user to run.

For transient proof notes, prefer temporary local notes or command output in the session. Do not create repo-local work update files. Durable bug ownership and active work status belong in GitHub issues, PRs, or the final handoff; repo docs and skill references are only for architecture decisions, reusable debugging lessons, or agent guidance that should survive the task.

## Code Smell Guard

For nontrivial work, name the main structural risk before coding and check it again before done:

- Bloat: large mixed files, long functions, long parameter lists, data clumps.
- Repeated conditionals: mode/type/provider branching spreading across files.
- Shotgun surgery: one change requiring scattered edits across owners.
- Disposable code: dead code, speculative wrappers, compatibility shims, fake fallbacks.
- Coupling: feature internals, cross-mode imports, wrong-layer dependencies, message chains.

Escalate a smell to a blocker when it creates correctness, proof, data-safety, security, or shipping risk. Otherwise report it as a bounded review note or follow-up.
Existing broad files and raw invoke sites in the repo are not permission to add more. When touching one, either contain the change inside the current owner or carve out the smallest owner module/wrapper needed for the current behavior.
