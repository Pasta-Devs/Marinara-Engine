# Review And PR Workflow Card

Use this for quick checks, formal reviews, PR iteration, shipping, and ready-for-review gates.

## Review Types

- Code review/default: findings first, ordered by severity, with file/line references and concrete suggestions.
- Quick check: short personal verdict, findings first, no formal PR-comment framing.
- Formal team review: severity-grouped findings suitable for a PR, still grounded in exact files and lines.

If the user asks for a review without specifying the type, default to code-review stance. Ask only when posting format or external action is genuinely ambiguous.

## PR Shipping Gates

Before push or PR creation:

1. Check dirty tree and include only intentional files.
2. Read `CONTRIBUTING.md` and verify remotes and target branch from the current checkout; do not assume `staging`, fork workflow, or team-branch workflow.
3. Confirm the branch name, commit subject or label, trailers, and PR title or body do not self-name AI/tool/provider authorship. Rename or reword explicit authorship phrases before pushing or opening the PR. Do not reject bare product/domain words in legitimate feature names, file paths, data fields, or app output.
4. Confirm only intentional files will ship.
5. Verify evidence exists for the PR claim.
6. Run `pnpm check` after the final diff or reviewer-fix pass and before pushing or handing off the PR. It includes a warning-only unused-code report; review those findings because they no longer fail local checks or CI.
   If it cannot run, record the exact blocker and why the PR is still being handed off.
7. Confirm repo-defined docs/release notes are updated for user-facing changes when an appropriate source exists, or explicitly record why not needed.
8. If `.github/pull_request_template.md` exists, use it as the PR body, preserve its sections, and fill applicable placeholders.
9. If the work came from or references a GitHub issue, put a GitHub closing keyword in the linked-issue field, such as `Closes #123`, so GitHub links the PR to the issue and automatically closes the issue when the PR merges.
10. Draft external text exactly.

`pnpm check` is the general pre-PR gate. It does not replace targeted proof
such as existing test output, lint, build, size checks, clippy, native Tauri QA,
or browser checks when the change needs them.

Proof is session evidence, not permission to add durable test artifacts. Unless
a maintainer explicitly asks for tests, do not add or submit new test artifacts
in any language as PR proof, including `*.test.*`, `*.spec.*`, `tests/`,
`__tests__/`, Rust `#[test]` or `#[cfg(test)]` modules, snapshots, fixtures, or
committed harness files. Temporary tests and harnesses are allowed when they stay
local and uncommitted; cite their command output or resulting observation
instead of submitting the artifacts. If a durable regression test is the right
engineering answer, ask first and explain why existing proof paths are
insufficient.

If `pnpm check` fails, do not push or mark the PR ready. Classify the failure as
in-scope or pre-existing/unrelated, fix in-scope failures, and report unrelated
failures clearly instead of letting CI be the first place they appear.

Open new PRs as draft unless the user or target workflow says it should be ready for review. Never push directly to protected branches or force-push without explicit approval.

For new implementation work on the refactor line, start from current `origin/refactor` on a fresh topic branch unless the user explicitly says to continue the current branch.

## After Push

After creating a PR, re-read the submitted PR body and fix it immediately if the repo template sections or closing-keyword issue link did not survive the creation path.

Wait for required checks when available. Inspect unresolved inline review threads, not only PR-level summaries. Address clear in-scope feedback; ask before posting arbitrary external replies.

Use `references/templates/reviewer-thread-ledger.template.json` when handling inline review or automated review threads. Record each thread's finding, classification, fix/defer/pushback, commit or reason, approved reply text, posted status, and whether human resolution remains.

## Maintainer-Equivalent Review

Ask:

- Does the implementation match the actual user problem?
- Does proof demonstrate the real claim?
- What user path did proof fail to prove?
- What adjacent legacy/default path could contradict the PR body?
- Are repo-defined docs/release notes handled when the change is user-facing?
- Did the author name the owner, impact, callers, contracts, checks, and any risky boundary path before editing?
- Is the diff narrow, current, and easy to review?
- Did the diff worsen bloat, ownership, duplication, repeated conditionals, shotgun surgery, dead/speculative code, direct engine-to-Tauri coupling, or cross-mode coupling?
