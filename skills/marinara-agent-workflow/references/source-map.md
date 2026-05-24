# Workflow Pack Source Map

Source: `cha1latte/chai-agent-workflow-pack` at GitHub HEAD `2dfc66070c476abffd0be520b6094319999ccdb5`.

This map explains how source files connect to this repo-local skill.

## Derived As Workflow Cards

- `workflows/bugfix.md` -> `references/workflows/bugfix.md`
- `workflows/feature-build.md` -> `references/workflows/feature-build.md`
- `workflows/investigate.md` -> `references/workflows/investigate.md`
- `workflows/issue-submission.md` -> `references/workflows/issue-submission.md`
- `workflows/review-and-pr.md` -> `references/workflows/review-and-pr.md`
- `workflows/vault-capture.md` -> `references/workflows/durable-notes.md`
- `REFACTOR_HANDOFF.md` -> `references/workflows/refactor-handoff.md`

These cards are source-derived but rewritten where needed so they do not assume a root `CHANGELOG.md`, `.agents/automation` helpers, legacy `staging` workflow, issue templates, labels, or Obsidian vaults.

## Imported As Templates

- `templates/bugfix-verification.template.json` -> `references/templates/bugfix-verification.template.json`
- `templates/risk-claim-matrix.template.json` -> `references/templates/risk-claim-matrix.template.json`
- `templates/reviewer-thread-ledger.template.json` -> `references/templates/reviewer-thread-ledger.template.json`
- `templates/pr-proof-block.md` -> `references/templates/pr-proof-block.md`
- `templates/status-snippets.md` -> `references/templates/status-snippets.md`

The JSON and PR proof templates are kept source-shaped. `status-snippets.md` is lightly rewritten from `Vault` to `Durable note`. The index for when to use these is `references/proof-templates.md`.

## Rewritten For Marinara

- `workflow/UNIVERSAL_AGENT_INSTRUCTIONS.md` -> `SKILL.md`, `references/proof-templates.md`, and workflow cards.
- `workflow/OVERLAY_PROMPT.md` -> `SKILL.md` priority, core loop, risky-work, communication, and code-smell sections.
- `workflow/ONE_FILE_AGENT_PROMPT.md` -> `SKILL.md` plus individual workflow cards and templates.
- `reference/FULL_WORKFLOW_REFERENCE.md` -> `SKILL.md`, `references/marinara-overrides.md`, `references/proof-templates.md`, and the workflow/template files.
- `adapters/codex.md`, `adapters/claude.md`, `adapters/generic-chat.md` -> `SKILL.md` tool capability fallback.

## Not Imported

- `README.md`, `GET_STARTED.md`, `SETUP.md`, `ADD_TO_EXISTING_WORKFLOW.md`, `manifest.json`, and `CHANGELOG.md`: distribution/setup files for sharing the workflow pack. They are represented by this source map and the skill metadata, not copied into the repo skill.
- `scripts/check-workflow-pack.ps1` and `scripts/make-zip.ps1`: package validation/export scripts for the external workflow pack, not useful for Marinara agent behavior.

## Local Repo Assumptions

- Repo instruction authority: `AGENTS.md`.
- Architecture docs: `docs/developer/architecture.html`, `modules.html`, and `impact-areas.html`.
- Durable bug/work tracking: GitHub issues and PRs, not repo-local update files.
- Current refactor workflow target: `Pasta-Devs/Marinara-Engine`, branch `refactor`.
- No root `CHANGELOG.md`, no `.agents/automation/scripts`, and no `.github/ISSUE_TEMPLATE` directory were present during import.
