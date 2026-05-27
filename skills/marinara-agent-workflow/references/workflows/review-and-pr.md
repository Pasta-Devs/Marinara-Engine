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
3. Confirm only intentional files will ship.
4. Verify evidence exists for the PR claim.
5. Confirm repo-defined docs/release notes are updated for user-facing changes when an appropriate source exists, or explicitly record why not needed.
6. If `.github/pull_request_template.md` exists, use it as the PR body, preserve its sections, and fill applicable placeholders.
7. If the work came from or references a GitHub issue, put a GitHub closing keyword in the linked-issue field, such as `Closes #123`, so GitHub links the PR to the issue and automatically closes the issue when the PR merges. Do not use only a bare issue reference such as `#123` when merge-time auto-close is intended.
8. Draft external text exactly.

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
