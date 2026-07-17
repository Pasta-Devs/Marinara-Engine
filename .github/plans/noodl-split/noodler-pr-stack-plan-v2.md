# NoodleR PR Stack Plan (v2)

v1 had two self-contradictions Codex caught on review: it wrote extraction/preservation
steps for code that, under our own "branch fresh from origin/staging" rule, doesn't
exist yet at that point in the stack. This version fixes that, corrects three wrong
dependencies, splits Slice 1 into 1A/1B (two genuinely independent high-risk data
changes), and replaces the testing policy with what the repo actually has (verified
directly against `package.json` on `main` — not assumed from either source).

Note on scope: Codex also suggested splitting Slice 2 into 2A (nav state) / 2B
(containers). Declined — nav state and container ownership are tightly coupled (a
container's job is largely to consume the nav state), unlike 1A/1B which are
genuinely independent bugs. Slice 2 stays one slice, done as two commits (move/
behavior separated per the LOC-limit rule below), with the standing option to split
into two PRs mid-work if it turns out bigger than expected — same escape hatch every
other slice already has, applied consistently instead of pre-forked.

**Amendment note (Slice 1A):** after v2 was written, a second Codex review caught
that the original 3-subtree settings contract (profile/scheduler/privacy) left an
escape hatch — current `staging` has existing writers (follow graph, notifications,
avatar sync) that don't fit those three and would keep bypassing the fix. Slice 1A
below is updated to a 4-subtree contract (adds `social`) and requires closing the
generic settings-update path entirely, not just adding a new one alongside it. If
you already started Slice 1A implementation before this note existed, re-check it
against the current Slice 1A section.

**Testing policy correction:** the repo has real regression tooling: `pnpm regression`
(runs `regression:prompt` + `smoke:ui`), `pnpm regression:prompt` (prompt-pipeline
regression via tsx script), `pnpm smoke:ui` (Playwright). There is **no**
`regression:noodle` today — that doesn't exist yet. If a slice needs NoodleR-specific
regression coverage, building it is part of that slice's scope, not a given tool to
invoke. Don't ship new *permanent* tests beyond what the maintainer's current policy
calls for; use the existing regression/smoke lanes plus temporary, removed-before-
handoff scripts for one-off proofs (e.g. concurrency checks).

## Ground rules for every slice (unchanged, still non-negotiable)

- One logical change per PR. No "while we're here" cleanup riding along.
- Branch from current `origin/staging`, fresh, every time — not from the old oversized
  PR's history. That old work lives on the `noooooods` branch
  (`https://github.com/Pasta-Devs/Marinara-Engine/tree/noooooods`) — use its diff
  against `origin/staging` as reference material for intent and prior art only. Do
  **not** check it out, merge it, rebase onto it, or copy-paste from it wholesale.
- Validation trio: `pnpm check`, `pnpm version:check` (if version-bearing files
  touched), `pnpm guard:installer-artifacts`. Add: run `pnpm regression` and
  `pnpm smoke:ui` for any slice touching server logic or UI respectively.
- No bot self-attribution in commits/PRs.
- Update the relevant doc (README / CHANGELOG / docs/CONFIGURATION.md / docs/FAQ.md /
  **docs/noodle/settings.md**) in the same PR as any user-visible or contract change.
- **One writer per slice.** Don't have both Claude and GPT-5.6-sol touching the same
  slice concurrently, even in different worktrees — pick one owner per slice.
- **Separate git worktrees for the two agents** if they're working different slices in
  parallel, so neither's uncommitted state leaks into the other's branch.
- **No dependent slice starts until its prerequisite is actually merged to
  `origin/staging`** — not "branched," not "the other agent says it's basically done."
  Check `origin/staging` yourself before kicking off a dependent slice.
- Branch naming: `noodl-split-<slice>-<short-kebab-name>`, e.g.
  `noodl-split-1a-typed-settings`, `noodl-split-8-auto-posting`. Shared prefix so
  `git branch -a` groups the whole effort together and anyone else on the project can
  tell at a glance these all belong to this split.
- Before implementation on any slice: confirm there's a linked GitHub issue or Discord
  thread a maintainer has acknowledged. If not, that's step zero, before code.

### LOC-limit clarification (was too rigid in v1)

The ~500 LOC / 8 file guideline is a **warning threshold for new logic**, not a hard
cap on mechanical extraction. A behavior-preserving file move (e.g. pulling a function
out of a route file into a service file, unchanged) can legitimately show a large diff
while containing near-zero semantic change. Rule: **pure moves and behavior changes
must be separate commits (ideally separate PRs).** Use `git mv` / rely on GitHub's
move-detection so reviewers see "renamed, no changes" rather than a wall of red/green.
If a "move" PR's diff doesn't render as a clean rename, something is wrong — stop and
check before pushing.

**Never weaken correctness to dodge the number.** If touching one more file (e.g.
updating a fixture so a type can stay strict/non-optional) is the price of not
loosening something the slice is specifically trying to make strict, pay it. The
guideline exists to keep diffs reviewable, not to justify a worse design. (This came
up for real in Slice 1A: the agent proposed making settings subtree containers
optional just to avoid touching a 9th fixture file — rejected, fixture updated
instead.)

---

## Corrected dependency graph

```
0.  Independent Noodle improvements     [no dependency]
1A. Typed settings + atomic patches     [no dependency]
1B. Private-account schema + isolation  [no dependency, but coordinate w/ 1A on file overlap]
2.  Client nav shell + real containers  [depends on 1A/1B merged — feature gate exists]
3.  Public generation service seam      [depends on 1A/1B]
4.  Private generation operation        [depends on 3]
5.  Stage identity + guided generation  [depends on 2, 4]
6.  Subscriptions & access              [depends on 1A/1B, 2 — NOT 5, see note]
7.  Fan activity                        [depends on 6]
8.  Auto-posting                        [depends on 3, 4, 5]
9.  Cross-mode integration              [depends on 2, 5, 6]
10. Creator projects                    [depends on ~everything, esp. 3]
```

Changes from v1, and why:

- **Slice 1 split into 1A/1B.** Typed-settings and private-account-schema are two
  independent high-risk data changes bundled into one slice before — reviewing them
  together makes it hard to isolate which change caused a problem if one shows up.
  (Slice 2's nav-state/container split was considered and declined — see note above;
  those two are coupled enough that one slice with two commits fits better.)
- **Slice 3 scope corrected.** v1 had Slice 3 extracting fan-simulation, private
  generation, identity, and project-orchestration logic — none of which exists yet on a
  branch cut fresh from `origin/staging` after only Slices 0–2 are merged. Slice 3 now
  only extracts the **existing public Noodle generation pipeline** (the code that's
  already on `origin/staging` today) into a typed service seam. Later slices *add* to
  that seam as their own features land — they don't reach back to "finish" Slice 3.
- **Slice 2 scope corrected.** v1's acceptance criteria required preserving NoodleR
  navigation paths that don't exist until later slices. Slice 2 now just builds the
  discriminated nav shell and container pattern from scratch, for whatever exists at
  that point (public Noodle + the NoodleR stub from 1B) — not a refactor of something
  that hasn't been built.
- **Slice 7 (fan activity) now depends on Slice 6 (subscriptions).** Fan activity
  simulates fans subscribing, commenting, and unlocking PPV content — it needs the
  subscription/access system to exist first, not the other way around.
- **Slice 8 (auto-posting) now depends on 4 and 5, not just 1/3/7.** Auto-posting needs
  private generation and stage identity to have something to post.
- **Slice 6's dependency on Slice 5 removed** — it was asserted in v1 without a concrete
  contract behind it. Open question, flag to a maintainer before starting Slice 6:
  does subscription/access gating need to know about stage identity at all, or can
  access rules be defined purely in terms of account + viewer-persona, independent of
  whether stage identity (Slice 5) has landed? If there's a real contract dependency,
  add it back explicitly with the reason; if not, 6 can start as soon as 1A/1B/2 are
  merged, in parallel with 3/4/5.

---

## Slice 0 — Independent Noodle improvements

**Branches:** one per sub-PR — `noodl-split-0-grid-view`, `noodl-split-0-pagination`,
`noodl-split-0-filler-accounts`

Unchanged from v1: grid view, pagination, editable filler accounts. 2–3 separate PRs,
no NoodleR involvement, no dependency.

---

## Slice 1A — Typed settings + atomic patching

**Branch:** `noodl-split-1a-typed-settings`

**Findings:** P1 Finding 1 (settings race).

**AMENDED after a second Codex pass caught a real gap:** the original three-subtree
version (profile / scheduler / privacy) left an escape hatch. Current `staging`
already has independent writers beyond those three — follow graph, follow
timestamps, notification read state, avatar sync, generated follow activity — none of
which fit cleanly into profile/scheduler/privacy. If the generic account-update path
still accepts a raw `settings` object, any of those existing writers can bypass the
new patch operation entirely and the race stays open for them. This is not scope
creep; it's required for the fix to actually be complete against the real baseline.
**First step for the implementing agent: confirm against the actual schema/storage
files which fields currently live in `NoodleAccount.settings` vs. elsewhere — the
subtree list below is a starting hypothesis, not a verified inventory.**

**Scope:**
- Typed `NoodleAccountSettings` contract with **four** owned subtrees, not three:
  - `profile` — avatar crop, banner, location, generated/manual-edit markers
  - `social` — following IDs, follow timestamps, notification read cursor, generated
    follow activity
  - `scheduler` — future fan-activity and auto-post scheduling state. Only commit to
    what the plan already requires: shared `1 | 3 | 6` intensity + per-account
    `nextRunAt`. Do not pre-decide fan-activity or auto-post semantics beyond that —
    those belong to Slices 7/8.
  - `privacy` — future hidden-from and access settings. Do not pre-decide
    subscription/access semantics — that belongs to Slice 6.
- `patchAccountSettings(accountId, { subtree, patch })` as a discriminated-union
  input. Implementation: open a transaction, read the account inside it, normalize any
  legacy flat settings shape into the canonical nested one, merge only the named
  subtree, write the full canonical object back, return the updated account. Rely on
  the transaction to serialize concurrent patches rather than hand-rolled locking.
- **Close the escape hatch:** the generic account-update operation must stop accepting
  a `settings` field at all. Every current settings writer (profile, follow graph,
  notifications, avatar sync, generated follow activity) must be migrated onto
  `patchAccountSettings()` in this same slice — leaving even one on the old path means
  Finding 1 isn't actually fixed for that writer.
- Likely touched files (confirm against actual repo, not assumed): shared types,
  shared schema, server storage service, server routes, client settings hook, the
  main Noodle view, and a new regression script for this behavior.

**Explicitly out of scope:** no user-facing docs change in this slice — it's
data-integrity hardening, and documenting NoodleR-specific controls (subscriptions,
stage identity, scheduling cadence) before those controls exist would be misleading.
Doc updates land with the slice that actually introduces the user-facing behavior.

**Acceptance:**
- Controlled concurrency proof: `Promise.all` across the currently writable
  `profile` and `social` subtrees on the same account, then inspect both the live
  in-memory result and the reopened persisted storage — not just one or the other.
  (`scheduler` and `privacy` are strict empty containers in this slice; verify their
  schemas accept `{}` and reject unknown fields, but do not claim meaningful
  concurrency coverage until later slices add writable fields.) "Send two requests
  quickly" is not sufficient proof.
- Negative-case proof: a patch attempting to touch fields across subtree boundaries
  fails schema validation, not a runtime check.
- Search the entire repository, not only the current diff or touched files, and
  confirm no caller passes a `settings` field through the generic account-update
  operation. Also prove the generic operation's type or schema rejects `settings`;
  both checks must pass before the escape hatch is considered closed.
- `pnpm check`, `pnpm guard:installer-artifacts`, and `pnpm regression` all green
  (`pnpm regression` runs both `regression:prompt` and `smoke:ui` — settings changes
  can affect prompt assembly and UI behavior alike, verify both rather than assuming
  either is unaffected).

---

## Slice 1B — Private-account schema + isolation

**Branch:** `noodl-split-1b-private-account-schema`

**Findings:** P1 Finding 3 (non-atomic private account creation).

**Scope:** `publicAccountId` as a unique column on the private account row, reverse
link derived rather than separately written. Creation becomes one insert under a
unique constraint. Feature gate + basic data isolation (private data genuinely
inaccessible from public-mode queries).

**Acceptance:**
- Concurrent creation-request proof: `Promise.all` two creation requests for the same
  public account — second fails cleanly on the constraint, no orphan, no duplicate.
- If a schema migration is required: call it out explicitly in the PR, flag in
  Discord per the contributor pre-flight (migrations on live installs are higher risk).

---

## Slice 2 — Client nav shell + real containers

**Branch:** `noodl-split-2-nav-shell`

**Findings:** P2 Finding 6 (invalid nav-state combinations) + P2 Finding 7 (puppet
components). Kept as one slice — see the note near the top of this doc on why 2A/2B
weren't split: nav state and container ownership are coupled, unlike 1A/1B.

**Scope, as two commits within this one PR** (move/behavior separation per the
LOC-limit rule):

1. **Nav state commit:** one discriminated navigation state (e.g.
   `{mode:'public',view:'home'} | {mode:'public',view:'profile',accountId} |
   {mode:'private',view:'hub'} | {mode:'private',view:'profile',accountId} |
   {mode:'verification'} | {mode:'settings'}`) replacing the three independent
   variables in the existing Noodle view. Invalid combinations should be
   unconstructable, not merely avoided by convention. Built from scratch, not
   refactored — no NoodleR views exist yet beyond the 1B stub.
2. **Container commit:** `NoodleHome` (and the future `NoodlerHome`, stubbed now)
   become real containers owning their own queries/derived state/mutations instead of
   receiving everything as props. Typed notification item shapes, no `unknown[]`
   casts.

**Escape hatch:** if, once you're actually in the code, this is clearly two people's
worth of review, split into two PRs (nav state first, containers second, same
dependency direction) rather than forcing it through as one. Don't decide this
upfront — decide it once you can see the actual diff size.

**Acceptance:**
- Every existing *public* Noodle navigation path still reaches the same screen as
  before. No claim about private paths — they don't exist yet.
- Measurable reduction in the parent view's local state count (state the before/after
  number in the PR body). No `unknown` casts remain in touched code.

---

## Slice 3 — Public generation service seam

**Branch:** `noodl-split-3-public-generation-seam`

**Findings:** P2 Finding 5 (routes-as-service-layer) — scoped correctly this time.

**Scope:** extract **only the existing public Noodle generation pipeline** (what's
actually on `origin/staging` right now) out of the route files into a typed service.
Routes call the service; the service is where the logic lives. Establish the
invariant — "routes never own reusable business logic" — as a stack-wide rule going
forward, but don't pre-build seams for fan-simulation/identity/private-gen/project
logic that hasn't been written yet. Those slices add their own service seams when they
land.

**Acceptance:** behavior-identical manual test — existing public generation flow
produces the same output as before the extraction. `pnpm regression:prompt` green.

---

## Slice 4 — Private generation operation

**Branch:** `noodl-split-4-private-generation`

**Findings:** P2 Finding 4 (flattened public/private generation pipeline).

**Depends on:** Slice 3 (the seam this attaches to).

**Scope:** add `generatePrivatePost()` as its own typed operation, sharing only
lower-level prompt/image helpers with the public path from Slice 3. Request shape is a
discriminated union so a public-mode request cannot carry private-only fields at the
schema level.

**Acceptance:** negative-case proof — constructing a public request with private-only
fields fails schema validation, not a runtime `if` check.

---

## Slice 5 — Stage identity + guided generation

**Branch:** `noodl-split-5-stage-identity`

**Depends on:** Slice 2 (container to add the modal into), Slice 4 (operation to call).

**Scope:** stage profiles, identity-leak protection, guided post modal.

**Acceptance — identity leak (corrected from v1's unfalsifiable "cannot leak in any
response path"):** build a concrete test matrix and manually walk it, don't rely on a
single pass/fail judgment call on nondeterministic model output:

| Disclosure mode | Output surface | Known public name/handle in context | Expected result |
|---|---|---|---|
| open | text | yes | permitted — identity may appear |
| hinted | text | yes | redacted/generalized, no exact handle |
| secret | text | yes | fully withheld |
| open | image prompt | yes | permitted |
| hinted | image prompt | yes | redacted |
| secret | image prompt | yes | fully withheld |
| any | profile metadata | yes | matches the account's declared disclosure mode |

Run each row manually, record actual vs. expected. This is inherently sampling-based
for text-generation modes — note the sample size you tested, don't claim exhaustive
proof.

---

## Slice 6 — Subscriptions & access

**Branch:** `noodl-split-6-subscriptions-access`

**Depends on:** 1A/1B, 2. **Not** 5 — see open question above; confirm with a
maintainer before starting whether a real contract dependency on stage identity exists.

**Scope:** subscriber posts, PPV unlocks, hidden-from rules, viewer-persona scoping.
Access rules should live as a typed subtree in the Slice 1A settings contract, not a
new ad-hoc field.

**Acceptance:** manually verify hidden-from rules against one viewer persona that
should be blocked and one that shouldn't, for at least one PPV and one subscriber-only
post.

---

## Slice 7 — Fan activity

**Branch:** `noodl-split-7-fan-activity`

**Depends on:** Slice 6 (fan activity creates subscribers/comments/unlocks — needs the
subscription system to exist first).

**Scope:** first of the two automation PRs. If this introduces its own scheduling
logic, apply the same "one model, no shadow global schedule" principle from Slice 8
rather than inventing a third pattern — coordinate the two slices' scheduling design
even though they're separate PRs.

---

## Slice 8 — Auto-posting

**Branch:** `noodl-split-8-auto-posting`

**Findings:** P1 Finding 2 (scheduling contract mismatch).

**Depends on:** Slice 3 (service seam), Slice 4 (private generation — auto-posting
needs something to post), Slice 5 (stage identity — auto-posted content needs an
identity/disclosure mode to respect).

**Scope:** pick one scheduling model — per-account `nextRunAt`, intensity (1/3/6
posts/day, matching the documented and schema-declared contract) determines cadence.
Delete the competing global `postsPerDay` schedule and the undeclared
`lastAutomaticPostAt` write. `nextRunAt` and intensity live in the Slice 1A typed
settings contract. Update `settings.md` (and `docs/noodle/settings.md` if that's where
the canonical doc ends up) so docs and code agree by the end of this PR.

**Acceptance:**
- Manually verify: intensity=1 account receives at most 1 post/day even when the
  scheduler runs more frequently than that.
- Schema and docs agree on field name/semantics.
- No account selected outside its own `nextRunAt` window — use a controlled
  concurrency/time-manipulation proof script (temporary, remove before handoff), not
  just observation over a live period.

---

## Slice 9 — Cross-mode integration

**Branch:** `noodl-split-9-cross-mode-integration`

**Depends on:** 2, 5, 6. Global persona, slash commands, roleplay posting, optionally
showing public NoodleR posts on Noodle.

---

## Slice 10 — Creator projects

**Branch:** `noodl-split-10-creator-projects`

**Depends on:** ~everything, especially Slice 3's service seam (project orchestration
adds its own service on top of it — see Slice 3's note that later slices extend the
seam rather than Slice 3 pre-building for them).

**Scope:** projects and milestones. Last, confirmed correct in both v1 and this review.

---

## Coordination rules (new in v2, from Codex's point 8)

- **One writer per slice** — don't split a single slice's implementation across Claude
  and GPT-5.6-sol.
- **Separate git worktrees** when the two agents are working different slices at the
  same time, so uncommitted work doesn't cross-contaminate branches.
- **No dependent slice starts until the prerequisite is merged to `origin/staging`.**
  Run `git fetch origin` first — a stale local `origin/staging` ref can show a
  prerequisite as unmerged (or merged) incorrectly. Then verify with
  `git log origin/staging` before kicking off the kickoff prompt for a dependent
  slice — don't take an agent's word that a prior slice is "basically done."
- Confirm an issue/Discord thread exists and has maintainer acknowledgment before
  starting implementation on any slice, per the standard contributor pre-flight.

---

## Coverage check — run once, before relying on this plan further

Purpose: confirm every feature area from the original `noooooods` branch is actually
accounted for in some slice below, so nothing gets quietly dropped in the split. Run
this once now (or re-run if the plan changes significantly), not per-slice.

Prompt to give an agent:

```
Compare the noooooods branch against origin/staging:
  git diff origin/staging...noooooods --stat

List every file changed and, in your own words, what functional area each belongs to
(e.g. "fan activity scheduling", "PPV unlock UI", "stage profile generation").

Then read .github/plans/noodl-split/noodler-pr-stack-plan-v2.md and check
each functional area you listed against the slices. For each one, tell me: which
slice covers it, or flag it clearly as NOT COVERED if you can't find a match.

Do not modify any files. This is a read-only audit. Give me the full list, including
areas that ARE covered — I want to see the complete mapping, not just the gaps.
```

If anything comes back "NOT COVERED," that's a plan gap to fix before that area's
functionality gets built — not a reason to panic, just something to slot into the
right slice (or add a new one) before it's needed.

---

## Keeping this file current

This plan's canonical location is
`.github/plans/noodl-split/noodler-pr-stack-plan-v2.md` on `staging`. Whenever it is
amended, merge the update to `staging` before any agent starts a dependent slice — a
stale local copy defeats the point of having one shared source of truth.
