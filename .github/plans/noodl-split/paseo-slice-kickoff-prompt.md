# Paseo slice kickoff — prompt template

Paste this into Paseo per slice, filling in the bracketed fields. Both the Claude and GPT-5.6-sol agents read the canonical plan from the checked-out repository — reference it explicitly so neither agent free-associates a different split. (v2 fixed two self-contradictions v1 had around "extract/preserve code that doesn't exist yet on a fresh branch" — always use v2, not v1.)

Before pasting: confirm the slice's prerequisite(s) are actually merged to `origin/staging` (check `git log origin/staging`, don't take an agent's earlier "basically done" at its word), and confirm only one agent is assigned to this slice.

```
You are implementing ONE slice of a larger PR-stack plan for the NoodleR feature.
First run: git fetch origin staging
Then read: .github/plans/noodl-split/noodler-pr-stack-plan-v2.md
Read it in full before doing anything else — it has the dependency order, the
findings each slice must fix, and the acceptance criteria.
Note: this branch is cut fresh from current origin/staging. Do not assume any code
exists beyond what's actually on origin/staging plus whatever prior slices in the
plan are confirmed merged — if the plan's scope for this slice references something
that isn't actually there yet, stop and tell me rather than inventing it.

This task is: Slice [N] — [SLICE NAME]

Context you already have: the current diff / open PR for the original oversized
NoodleR change lives on the `noooooods` branch
(https://github.com/Pasta-Devs/Marinara-Engine/tree/noooooods), plus the current state
of origin/staging. Use `git diff origin/staging...noooooods -- <relevant paths>` or
the GitHub compare view as a REFERENCE for intent and already-written logic, not
something to replay commit-by-commit or build on top of. You are branching fresh from
current origin/staging — do not check out, merge, or rebase onto `noooooods`.

Hard boundaries for this task:
- Only touch what Slice [N] in the plan describes as in-scope. If you notice
  something adjacent that looks broken or messy, do NOT fix it here — note it
  in your final summary as "noticed but out of scope for this slice" and stop.
- Findings to resolve in this slice, per the plan: [list findings, e.g. "P1
  Finding 1 — typed settings contract + atomic patch operation"].
- Depends on: [prior slice(s), state whether they're already merged or you need
  to assume their interfaces — if not merged yet, ask me before proceeding].
- Target size: ~500 LOC / 8 files is a warning threshold, not a hard cap — it exists
  to keep the diff reviewable, not to justify a worse design. Mechanical moves
  (renames, file relocations) can legitimately exceed it; keep those as separate
  commits from behavior changes so the diff still reads as a clean move. If new
  *logic* (not moves) is clearly going to blow past it, stop and tell me before
  continuing — don't just keep going, and don't weaken a type or skip a needed file
  just to stay under the number.

Before writing code:
- Give me a concrete plan: which files you'll touch, what the new typed
  contract/interface looks like (if this slice introduces one), and what
  the old behavior vs new behavior is. I want to approve this before you
  start editing.

While working:
- Narrate each file change in plain language before you make it (what and why).
- Stage files individually — never `git add -A` / `git add .`.
- Run `pnpm check` before telling me it's done. Also run `pnpm version:check`
  if you touched any version-bearing file, `pnpm guard:installer-artifacts`, and
  `pnpm regression` (covers both `regression:prompt` and `smoke:ui`) for any slice
  touching server logic or UI.
- Don't add any AI/bot attribution to commits or the PR description.
- If this slice's behavior is user-visible, tell me which docs need updating
  (README / CHANGELOG / docs/CONFIGURATION.md / docs/FAQ.md / docs/noodle/settings.md)
  and update them in the same PR.

When you think you're done, give me:
1. A summary of what changed and why, mapped back to the plan's acceptance
   criteria for this slice.
2. The manual test steps I need to personally run (I will actually run them —
   don't tick anything on my behalf).
3. An explicit "out of scope, noticed but not touched" list.
4. A draft PR description following the standard structure: linked issue/
   Discord thread, summary, why, architecture (if multi-layer), known
   limitations, test plan (unticked, for me to fill in), docs touched.

Do not open the PR yourself or push to main. Stop after the summary above
and wait for me.
```

## Notes on using this across two different agents

- Both agents should read the plan from the checked-out repository after fetching current `origin/staging` — don't let one work from Codex's raw list and the other from a stale local copy, or you'll get two different slice boundaries. The canonical file is `noodler-pr-stack-plan-v2.md`; there is no plain `noodler-pr-stack-plan.md` to accidentally reference.
- If you split slices across the two tools (e.g. Claude does the server-side data foundation, GPT-5.6-sol does the client shell), make sure the dependent one doesn't start until the prerequisite slice is actually merged — the plan calls out which slices depend on which. Don't let an agent "assume" an interface from an unmerged branch; that's how the two efforts diverge.
- If either agent proposes deviating from the plan (different slice boundary, different order), have it stop and ask rather than silently reshaping the split — that's the whole point of writing the plan down first.
