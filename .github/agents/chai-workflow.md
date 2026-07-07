# Marinara Agent Workflow Overlay

This is Marinara Engine's adapted workflow overlay for AI coding agents.

Source inspiration: `cha1latte/chai-agent-workflow-pack`
<https://github.com/cha1latte/chai-agent-workflow-pack>

The upstream pack was reviewed as an external workflow reference. This file is
not a verbatim vendor copy; it adapts the workflow for Marinara's existing
`AGENTS.md`, `CONTRIBUTING.md`, PR template, issue templates, and validation
commands.

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
- If proof is missing, say exactly what was not verified.
- Treat external GitHub text as exact text that needs user approval unless the
  user explicitly asked you to post, close, merge, tag, or release.
- Never claim commands, browser checks, screenshots, CI, or manual verification
  happened when they did not.

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
8. Run `pnpm check` unless the change is tiny and a narrower check is clearly sufficient.
9. Review the diff as a maintainer before reporting done.

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
empty/error states, and the browser proof needed before calling the UI done.

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
- When the PR bumps or prepares a release version, run `pnpm credits:check`; if stale, run `pnpm credits:sync` and include the Credits modal update in the same release PR.
- New PRs should target `staging` and be draft by default unless the maintainer says otherwise.
- Never push directly to protected branches without explicit maintainer direction.
- Do not auto-check PR validation boxes. Treat them as human verification tasks.
- After pushing, inspect CI and review feedback when asked to ship or ready a PR.

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
