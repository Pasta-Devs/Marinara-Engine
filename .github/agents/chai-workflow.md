# Marinara Agent Workflow Overlay

This is Marinara Engine's adapted workflow overlay for AI coding agents.

Source inspiration: `cha1latte/chai-agent-workflow-pack`. This overlay adapts
that workflow for Marinara's `AGENTS.md`, `CONTRIBUTING.md`, PR/issue templates,
and validation commands; it is not a vendor copy.

## Priority

Follow instructions in this order:

1. Marinara repo rules: `CONTRIBUTING.md`, `AGENTS.md`, package instructions, and templates.
2. The user's latest request.
3. This workflow overlay.
4. Assistant defaults.

If this overlay conflicts with repo rules, repo rules win. Keep the overlay only
where it improves proof, review quality, issue filing, shipping discipline,
security, or risky-work boundaries.

## Universal Operating Rules

- Read the relevant files before editing.
- Keep changes narrow and proportional to the request.
- Reproduce bugs before fixing when practical.
- Name the core claim being proven.
- Verify the user-facing claim before saying the work is done.
- Keep ordinary bugfix requests local by default: fix, focused proof, matching
  validation, and report. Commit/push/PR/CodeRabbit/CI work starts only after an
  explicit shipping request.
- Use high/adaptive reasoning for coding and review quality; save credits by
  avoiding unnecessary agents, browser proof, and PR loops rather than weakening
  coding reasoning.
- If proof is missing, say exactly what was not verified.
- Treat external GitHub text as exact text that needs user approval unless the
  user explicitly asked you to post, close, merge, tag, or release.
- Never claim commands, browser checks, screenshots, CI, or manual verification
  happened when they did not.
- Proof is session evidence, not permission to add durable test artifacts.
  Unless a maintainer explicitly asks for tests, do not add or submit new test artifacts in any language as PR proof, including `*.test.*`, `*.spec.*`, `tests/`, `__tests__/`, Rust `#[test]` or `#[cfg(test)]` modules, snapshots, fixtures, or committed harness files. Temporary tests and harnesses are allowed when they stay local and uncommitted; cite their command output or resulting observation instead of submitting the artifacts. If a durable regression test is the right engineering answer, ask first and explain why existing proof paths are insufficient.

## Bugfix Lane

Use this when the user reports broken behavior, screenshots a bug, or says
"fix this".

1. Extract the symptom, expected behavior, actual behavior, relevant mode, and likely subsystem.
2. Restate the issue in one short paragraph.
3. Name the narrow fix boundary and the proof claim.
4. Reproduce or inspect the failing path before editing when possible.
5. Diagnose one hypothesis at a time.
6. Make the smallest root-cause fix.
7. Verify the original repro or closest available proof path.
8. Run the root `AGENTS.md` matching validation command for the changed lane.
   Reserve full `pnpm check` for PR boundaries, risky changes, cross-lane
   changes, or when narrow proof does not cover the claim.
9. Review the diff as a maintainer before reporting done.

For ordinary local bugfix requests, stop after focused proof and the matching
validation command. If the user then asks to ship, push, open a PR, or mark
ready, switch to the Review And PR lane and run the full pre-PR gate there.

If reproduction is not possible, mark that as a proof gap instead of implying
the repro was exercised.

## Feature Lane

Classify features before building:

- Small: one to three files, no schema, no new architecture.
- Medium: four to ten files, new UI surface, or a new connection between existing systems.
- Large: persistent data shape, prompt pipeline change, install/update/release behavior, new agent/mode, or ten-plus files.

Small features can be built after a short restate. Medium features need a short
plan. Large features should be phased and checked with the user unless the
maintainer explicitly asks for end-to-end autonomous implementation.

For UI work, define the primary path, mobile expectations, theme expectations,
empty/error states, and the cheapest proof that exercises the claim. Use static inspection, existing test output, temporary uncommitted tests or harnesses, route/module repros, or jsdom/component proof before Playwright; use browser proof when visual layout, interaction, routing, responsive behavior, screenshots, or browser-only behavior is the claim.

## Issue Filing Lane

Use this when the user asks to file, open, submit, or draft a GitHub issue.

- Route broken behavior to `.github/ISSUE_TEMPLATE/issue_report.md`.
- Route desired capability to `.github/ISSUE_TEMPLATE/feature_request.md`.
- Use the template fields exactly.
- Do not invent missing environment, logs, screenshots, or reproduction details.
- Leave template checkboxes in the state the template requires. Do not tick or
  untick proof boxes on behalf of a human unless explicitly instructed.
- Draft exact issue text and wait for approval unless the user clearly asked you
  to create it.

## Review And PR Lane

Use this for code reviews, PR preparation, PR iteration, and ready-for-review gates.

- For reviews, lead with findings ordered by severity. If no issues are found, say so.
- Before pushing or opening a PR, check the dirty tree, remotes, branch, intended files, and target branch.
- Keep branch names, commit subjects or labels, trailers, and PR titles or bodies focused on the task, owner, or problem. Do not self-name AI/tool/provider authorship; reword names like `codex/*`, `claude-*`, `ai:`, `Codex:`, `Generated by`, or AI co-author trailers before shipping. Do not reject bare product/domain words in legitimate feature names, file paths, data fields, or app output; guard checks should look for explicit authorship phrases instead.
- New refactor-line PRs should target `refactor` and be draft by default unless the maintainer says otherwise.
- Before pushing, opening, or handing off a PR, run `pnpm check` after the final
  diff. It includes a warning-only unused-code report; review those findings
  because they no longer fail local checks or CI.
- Do not add or carry new test artifacts in any language as PR proof artifacts.
  If a local repro needs a test or harness, keep it temporary, local, and out of the submitted diff.
- Never push directly to protected branches without explicit maintainer direction.
- Do not auto-check PR validation boxes. Treat them as human verification tasks.
- After pushing, inspect CI and review feedback when asked to ship or ready a PR.
  Do not start PR polling or CodeRabbit loops for local-fix-only work.

Maintainer-equivalent self-review questions:

- Does the change solve the user's actual problem?
- Does the proof demonstrate the real claim?
- Which user path remains untested?
- Could a legacy/default path contradict the summary?
- Is the diff narrow and easy to review?

## Risky Work Lane

Treat these as risky:

- storage, migrations, import/export, backups, user data
- installers, launchers, Docker, Android, release/update flow
- prompt assembly, agent routing, model/provider request shaping
- auth, CSRF, credentials, filesystem paths, external services
- destructive actions, bulk operations, compatibility paths
- injected JavaScript, CSS, HTML, or user-controlled rendering

Risky work needs explicit claim-boundary proof:

- Core claim
- Risk type
- Entrypoints touched
- Current paths/formats tested
- Legacy paths/formats tested
- Positive rows tested
- Negative controls tested
- Ground-truth facts used
- Manual blockers

Untested rows are risks, not implied proof.

## Done Report Shape

Use this shape when the task is non-trivial:

```text
Done: <result or root cause>.
Files: <paths + short summaries>.
Verification: <commands, repros, screenshots, or why unavailable>.
Manual: <none or explicit manual verification items>.
Risk: <claim gaps or none>.
```

Keep tiny tasks concise; do not turn routine edits into ceremony.
