# Slice 8f — Access Model, Onboarding, and Scheduling Overhaul

Detail design document for Slice 8f. The
[NoodleR PR-Split Living Plan](./noodler-pr-split-living-plan.md) remains the planning
authority for slice ordering and product decisions; this file owns 8f's design detail
because it does not fit the Living Plan's per-slice section length.

**Status: planning. No implementation has started.** Open questions are listed at the
bottom and are part of the document, not a defect in it. Update the changelog when
decisions land.

**Reviewer note:** the scheduling decision is settled. Slice 8f-3 uses front-loaded
generation with a private scheduled-post reserve. The former platform-day-plan/catch-up and
gap-backfill candidates are retired. Everything outside that section is settled unless
marked otherwise.

8f ships as **six independent units, 8f-1 through 8f-6** — see "Shipping units" under
Rough plan. This document designs all six; it is not one PR.

## Problem

**Access confusion.** Follow, Subscribe, and PPV sit side by side without making clear
what depends on what. The per-creator `subscriptionIncludesPpv` switch makes it worse: it
silently redefines what `subscriber` and `ppv` mean for that creator. Users cannot reason
about it, and the generating model faces a three-way enum whose meaning depends on a
separate account-level boolean.

**Onboarding.** After the age gate the user lands in an empty NoodleR home with no next
step. Two user groups exist — those who want it to just work, and those who want precise
control — and one system has to support the other so users can grow from the first into
the second instead of being stuck in a mode.

**Scheduling.** NoodleR's automatic posting is `now + 24h/intensity ± 25% jitter`
(`noodle-autopost-cadence.ts`). It only works while the server is running, cannot show a
reliable future shape, can clump, and has no notion of what a character is plausibly doing
at publication time. Generating missed work on restart either creates a provider burst or
fabricates a past. Slice 8f-3 instead prepares future posts while Marinara is already
running and publishes those prepared items at their assigned times.

## The access model

### A profile has two levels

- **Follow** — decides whether the creator appears in your NoodleR feed at all.
  Follow is attention.
- **Subscribe** — decides whether you can read that creator's locked posts.
  Subscribe is access.

**Subscribing implies following.** Being subscribed to a creator who does not appear
anywhere is a state nobody wants to create on purpose. Unfollowing while subscribed
remains possible, but only as a deliberate extra action.

**This is not in tension with "no auto-follow", and the sheet says so out loud.** Someone
who subscribes to a service wants the service delivered: a subscription that did not put
the creator in your feed would be a subscription to nothing. The rule the no-auto-follow
decision protects is that *the system* never follows on the user's behalf — bulk-creating
40 creators must not manufacture 40 follows. Subscribing is a deliberate user act, so the
follow it carries is one the user performed. The Unlock sheet's Subscribe row states the
consequence in its own label rather than leaving it silent.

### The feed has two tabs

Today: `feedTab: "all" | "subscribed"` — "All creators" and "Subscribed". This becomes:

- **Following** — the curated feed.
- **All creators** — the discovery surface.

The Subscribed tab is dropped. Whether you are subscribed is visible on the post itself
by the absence of a lock; it does not need its own tab. Two tabs, two jobs.

**Decided: no auto-follow. Following is the default tab; onboarding lands on All creators
because Following starts empty.** These are two separate facts, not one. Bulk creation does
not follow the creators it makes, because a follow the user never performed is a curation
decision made on their behalf, and Follow only carries meaning if the user did it. The tab
the UI opens to on every ordinary visit is Following — that is the curated feed and the
point of the product. But immediately after onboarding, Following has nothing in it, so the
wizard's completion step selects All creators instead, one time, so the user does not land
on an empty screen. An almost-empty Following tab is not a defect to engineer around; public
Noodle starts that way too — but "starts empty" is not the same claim as "opens by default."

### A post has three states

**public**, **locked**, and — after unlocking — **unlocked**.

Posts no longer carry a PPV button or a Subscribe button. They carry a single **Unlock**
button, whose sheet offers exactly two choices:

- `Unlock this post` — just this one post
- `Subscribe` — everything from this creator

**No prices are shown.** Slice 9b establishes that support points are a score with "no
spendable balance". Putting a number on the Unlock button would make it the first
spendable thing in the product and would quietly reverse that decision. The two rows
distinguish themselves by *reach*, not by price.

### Not every post is locked

Automatic posts still default to locked, but generation may deliberately produce public
teaser posts. A brand-new creator that is nothing but a wall of padlocks gives a
non-subscriber no reason to care.

Public teasers are visible to non-followers in the **All creators** tab. That is what the
discovery tab is for: you see a public post from a creator you do not follow, it
interests you, you follow. Without this the teaser is decoration; with it, it has a job.

## Scheduling rework

**Decision: front-loaded generation with a scheduled-post reserve.** The two earlier
candidates, a platform day plan with startup catch-up and gap backfill with chosen past
timestamps, are replaced. Both started from the assumption that content must be generated
when it becomes due. NoodleR instead prepares ordinary scheduled posts while Marinara is
already running, then publishes those prepared posts when their assigned times pass.

This matches the product fiction better. A creator can prepare and schedule content ahead
of time, as creators on the service NoodleR draws from do. The user returns to an ordinary
chronological feed containing posts at their planned publication times. The audience feed
gets no special return-time surface and no startup batch pretending that newly generated
content existed earlier.

### Product contract

1. **Both user populations get useful behaviour.** Always-on users see posts publish as
   their times arrive. Start-and-quit users can still receive activity from the reserve
   prepared during their previous session.
2. **One user-set number produces explicit automatic cost ceilings.** The user chooses N
   automatic posts per day. Automatic text-generation attempts, including failed paid
   attempts, cannot exceed N in any rolling 24 hours. If automatic images are enabled, a
   separate derived image-attempt ceiling is also N, so combined automatic provider load is
   at most 2N attempts. The UI states both numbers.
3. **One post remains one text-provider call.** NoodleR generation is per creator because
   stage identity, disclosure, redaction, and operation locking are per creator.
4. **Publication times are real commitments.** A post is generated before its publish time.
   NoodleR never generates a post after that time and then assigns it a fabricated earlier
   time.
5. **Per-stage-profile enablement survives.** A creator can be removed from automatic
   posting without disabling the product or other creators.
6. **The process may be offline without owing work.** A depleted reserve means fewer posts,
   not catch-up debt, a later burst, or an invented history.
7. **Foreground work wins.** Reserve preparation is sequential, low priority, and must not
   begin while Marinara has an active foreground request on the same configured connection.
   An already-running provider call is never preempted.

The user-facing wording is therefore **"up to N automatic posts per day"**. N is both the
maximum publication density the planner targets and the automatic text-attempt ceiling.
Provider failures, an empty reserve, ineligible creators, or the process being offline
longer than the reserve horizon may deliver fewer.

### Generation and publication are separate operations

A prepared item has two relevant times:

- **generated at**: internal operational metadata recording when provider work finished;
- **publish at**: the future time chosen before generation and later used as the feed
  post's creation/publication time.

Generation performs the expensive work. Publication is a local, idempotent database
transition with no provider call. While the server is running, a timer publishes due
items near their assigned times. After a restart, reconciliation publishes every valid due
item from the existing reserve using its already-persisted publish time.

This is not backfill. A due item already existed, with its content and publication time,
before the gap. Reconciliation merely makes the time-based state visible after the process
returns.

### The rolling reserve

The first release maintains a fixed rolling reserve horizon of **24 hours**. Do not add a
second onboarding choice for reserve length. If real use shows that one day is too short,
an advanced 1/3/7-day control can be designed later with its storage and provider-cost
consequences visible.

The planner:

1. Reads the future publication times already covered by valid prepared items.
2. Distributes uncovered times across the next 24 hours using the same windowed random
   placement principle as public Noodle, constrained by night quiet and character
   schedules.
3. For the earliest uncovered time, chooses one eligible creator, generates one post, and
   stores it as prepared.
4. Repeats gradually while Marinara remains running, never exceeding concurrency 1 or the
   rolling automatic-attempt budget.
5. Stops when the horizon is covered, the budget is exhausted, foreground provider work
   needs the connection, or no creator is eligible.

The reserve is allowed to be incomplete. Initial activation warms it gradually rather
than launching N calls. The existing explicit first-post action may create visible posts
now; it is not silently repurposed into a reserve-filling burst. If a future "Prepare
offline activity now" action is added, it must show the exact estimated text and image call
count and require an explicit user action.

Changing `postsPerDay` reconciles only future coverage. Raising it adds uncovered future
times gradually. Lowering it discards the latest excess prepared items and cleans up their
owned media, but does not release attempt claims already made; preparation waits until
rolling usage falls below the new limit. Neither direction publishes an item immediately
or creates historical work.

**The old default of 24 posts per day is not carried forward.** **Decided 2026-07-29: the
default is 4, with a 1..24 validation range.** Four is deliberately low — it is a visible
day's activity for a small library, it caps automatic load at 4 text attempts plus at most 4
image attempts per rolling 24 hours, and it is a number a user raises once they want more
rather than one they discover by being billed. It ships as the default rather than blocking
8f-3 behind provider measurement; the two real runs (one paid provider, one local model)
remain worth doing to tune it, but they are no longer a gate.

### Foreground provider work has admission priority

Concurrency 1 inside the reserve is not enough: chat, Guide, or another creator can use the
same local connection outside the reserve scheduler. Add one narrow connection-scoped
admission seam shared by foreground and background model operations:

- foreground operations register active use of the configured connection;
- background preparation may acquire one background lease only when no foreground use is
  active and the connection has been idle for 30 seconds;
- a foreground request arriving after a background call started does not cancel or preempt
  that call, but no further background call starts;
- failure to acquire the lease leaves the reserve incomplete and retries later with normal
  backoff.

This is admission priority, not a general provider job queue. It coordinates only
Marinara-owned work on the same configured connection and cannot detect another external
program using a local-model server.

### Creator selection and plausible timing

A future publication time is chosen first. The creator is then selected from accounts that
will plausibly be available at that time:

- NoodleR and the global automatic schedule are enabled;
- the stage profile's auto-posting switch is enabled;
- the account and its source resolve;
- the character is not asleep or busy according to its weekly schedule;
- characters without a schedule pass the configured night-quiet window.

If nobody is eligible, that time is left uncovered. It is not moved into the morning and
does not become debt.

Use a NoodleR-specific selector. Public Noodle's
chooseNoodleParticipantAccounts() also contains invitation, follow, random-user, priority,
and recent-activity semantics that are not the promised NoodleR rule. The private selector
orders by least recent published activity while also considering already prepared future
items, then uses a deterministic stable tie-break. Otherwise one quiet creator can own the
whole reserve before any of those prepared posts have published.

The generation prompt receives the intended publication time and the permitted schedule
context so that the content fits the time it will appear. It must not claim knowledge of
events created after generation.

Front-loading deliberately trades some freshness for offline continuity. Prepared
automatic posts are standalone snapshots: they cannot answer a viewer interaction that
has not happened yet or depend on another future post. Slice 8g replies remain reactive
work generated from the interaction path, not reserve content. The 24-hour horizon bounds
how stale an otherwise valid prepared post can become.

### State belongs in a private outbox

Prepared content must not be placed into the ordinary post table with only a future
createdAt value. Existing projections and queries assume rows in that table are published,
so doing that risks exposing locked future content or making it reachable through an
unrelated endpoint.

Use a capability-owned private outbox. Each item needs, conceptually:

- a durable item ID and creator account ID;
- generatedAt and publishAt;
- the complete validated private-post payload;
- ownership of any prepared private media;
- a source/policy/schedule fingerprint sufficient to detect invalidation;
- a state such as prepared, published, discarded, or failed.

Publication atomically inserts the ordinary post with createdAt equal to publishAt and
marks the outbox item published. A unique link from the post to the outbox item makes the
transition idempotent across crashes and restarts. Provider and image work remain outside
the publication transaction.

The outbox is not raw settings JSON. It owns generated content, lifecycle state, and
possibly media, so it needs the same transactional and cleanup guarantees as other private
content. Typed settings remain under the capability-owned `scheduler.creatorPosts` leaf;
the generated outbox records remain separate from settings.

Persist a bounded attempt ledger with a durable ID, kind (`text` or `image`), `claimedAt`,
and terminal outcome. Immediately before provider work, after connection admission, claim
an attempt in the same transaction that verifies fewer than the allowed attempts exist in
the preceding 24 hours. The provider call starts only after that transaction commits.
Completed calls and potentially billable failures both keep their claims. A crash or
ambiguous outcome after claiming also keeps the claim conservatively; never release it and
risk paying twice. Prune claims only after they leave the rolling window.

Use a persisted last-observed budget time so a backward wall-clock change cannot create a
fresh allowance. The proof must cover backward and forward clock changes. A forward jump
may expire old claims normally; a later rollback must not grant extra capacity.

Prepared payloads are never returned through audience-facing projections or ordinary post
endpoints. Operator status exposes counts and publication times, not unpublished bodies or
private media.

### Revalidation and invalidation

A prepared post is not permission to ignore later user changes. Immediately before
publication, revalidate that:

- the product and global automatic schedule are enabled;
- the creator still exists and auto-posting remains enabled;
- the source still resolves;
- disclosure, access, and private-media policy still match the prepared item.

A creator being disabled or deleted discards that creator's prepared items and cleans up
outbox-owned media. A stage-profile, source-identity, disclosure, or access-policy change
invalidates affected prepared items so future output cannot publish under stale or weaker
policy. Weekly schedule edits, night-quiet changes, and timezone changes also invalidate
affected future items because both creator selection and prompt context depended on them.
The publication path checks all of this defensively in case an import or migration bypassed
an ordinary mutation hook.

Invalid items are discarded. Do not regenerate synchronously at publication time. Normal
reserve preparation may replace them later while the server is running and budget remains.

The global schedule switch stops publication immediately without disabling NoodleR.
Prepared future items may remain dormant. When the schedule is re-enabled, expired items
are discarded and still-future valid items may remain; nothing accumulated during the
pause publishes as a burst.

### Startup and long absences

If the global automatic schedule is enabled, startup does two cheap things in order:

1. reconcile valid prepared items whose publishAt has passed;
2. discard invalid prepared items.

If the schedule is disabled, startup performs neither publication nor preparation. It may
clean up items made invalid by deletion or policy changes, but otherwise preserves still-
future prepared items until the user re-enables the schedule.

Startup returns after that local work. Only after normal server startup completes and the
configured connection satisfies the ordinary 30-second idle rule may the background
scheduler begin preparing future coverage. Startup itself performs **no provider
generation**, whether called catch-up, refill, or anything else. There is no missed-slot
counter, plannedThrough cursor, min(missedSlots, N), chosen historical timestamp, or
startup concurrency burst.

If Marinara was closed longer than the reserve horizon, NoodleR eventually goes quiet.
That is the explicit bounded failure mode. On return, due prepared posts still appear at
their real planned times, and new preparation covers the future rather than manufacturing
the uncovered gap.

### Cost and image generation

Automatic text attempts are durably claimed immediately before preparation calls the
provider, because that is when cost begins. Failed or ambiguous attempts keep their claim.
Publication itself is free.

Images remain per creator and per prepared post. If automatic images are enabled, at most N
automatic low-level image-provider attempts may be claimed in any rolling 24 hours, derived
from `postsPerDay`; retries consume another claim and stop when the budget is exhausted.
This is the number the wizard states. A retry helper may improve success rate but may not
silently exceed it.

Prepared media stays in the private NoodleR namespace, owned by the outbox until
publication. Image failure or budget exhaustion leaves a valid prepared text post under
the existing text-survives-image-failure policy.

When prompt review is enabled, preparation stores the private text item and its pending
image prompt without blocking the publication time. Approval before publishAt may generate
the image under the image-attempt budget. If the prompt remains pending, is rejected, or
image generation fails when publishAt arrives, publish the text-only post and expire and
clean up the pending prompt. Publication never waits for image work: it atomically closes
the attachment opportunity before publishing. An approved image call still in flight at
that moment may finish, but its result sees the closed item, is cleaned up, and never
mutates the published text-only post. Approval after publication does not retroactively
attach an image; that would be a separate post-edit feature.

Steady state approaches one preparation call for each published post. The initial reserve
takes time to warm because the automatic ceiling still applies. An explicit user-triggered
generation action may exceed the automatic ceiling only when its estimated call count is
shown before confirmation.

### User controls and inspectability

NoodleR-wide settings contain:

- automatic schedule on/off;
- up to N posts per day;
- automatic text-attempt usage in the last 24 hours;
- reserve status in operational language, for example "6 posts prepared through tomorrow
  18:20".

Reserve status belongs in Settings or another operator surface, not in the audience feed.
The ordinary feed does not explain that content was prepared in advance.

Per creator, retain:

- automatic posting enabled;
- automatic images enabled;
- read-only next prepared publication time when one exists.

Remove intensity, nextRunAt, and the per-creator recurring reschedule API. The first
version's reserve schedule is inspectable but not individually reschedulable. Editing
future times is not needed to prove the product contract and would require rechecking
schedule eligibility and content fit after every move.

### Ad-hoc posting is not a second schedule

Slice 7's creator composer remains the explicit "post now" path. A successful immediate
post makes that creator recently active. For the first release, discard every prepared item
for the same creator where `manualCreatedAt < publishAt <= manualCreatedAt + 60 minutes`.
Sixty minutes is one internal constant, not another user setting. The item is not silently
rewritten or published immediately; normal reserve preparation may replace it later.

The global "Refresh NoodleR now" action remains explicit user-authorized work. It shows its
estimated call count, uses bounded concurrency appropriate to the configured provider, and
does not masquerade as scheduler recovery.

Scheduling a user-authored one-off for later remains a separate feature. Do not widen the
automatic reserve into a general-purpose post composer scheduler in 8f-3.

### Consequence for later fan activity and projects

Creator-post preparation and fan activity keep separate capability state. Slice 9a may
later prepare fan events against a prepared post or reconcile them after publication, but
8f-3 does not fabricate reactions for an offline gap and does not make fan work a condition
of publishing a prepared creator post.

Slice 12 projects supply content context when a reserve item is prepared. Because
generation now precedes publication, a project beat must be reserved with the outbox item
and finalized only when that item publishes; discarding the item releases the reservation.
Slice 8f-3 does not implement projects, but it must leave that ownership seam rather than
assuming generation and publication are the same moment.

### Migration from Slice 8

The existing per-account autoPosting.enabled and imagesEnabled values survive. Intensity
and nextRunAt are removed from the type and normalizer; stale persisted keys disappear on a
later write as already documented.

Initialize an empty reserve, empty attempt ledger, the budget clock watermark at migration
time, and `preparationNotBefore = migrationAt + 24 hours`. The old scheduler has no durable
attempt ledger, so the 24-hour hold is the only way to guarantee its recent calls plus new
automatic calls cannot exceed the new rolling ceiling. Do not translate overdue nextRunAt
values into prepared posts, historical publications, or guessed claims. After the hold,
existing users begin warming the reserve only through normal post-start idle preparation.
Explicit user-triggered generation remains available during the hold and is not presented
as automatic reserve work.

### Proof required for 8f-3

Use controlled-clock/provider regression coverage for:

- windowed reserve planning and least-recent creator selection;
- atomic pre-provider text/image attempt claims, including paid failures and crashes;
- sequential preparation, connection-scoped foreground admission, and the 30-second idle rule;
- due publication with the preassigned timestamp;
- restart/crash idempotence at the publication transaction;
- startup with due items making zero provider calls;
- schedule pause/re-enable without a release burst;
- creator disable/delete and source/disclosure/access/schedule/timezone invalidation;
- prompt-review approval, expiry, and text-only publication at the fixed deadline;
- the exact 60-minute manual-post invalidation boundary;
- outbox media cleanup;
- an exhausted 24-hour reserve producing no catch-up debt;
- rolling-budget expiry, wall-clock changes, timer shutdown, and active-work draining.

### This revises Slice 8

**Survives:** the global product kill switch, the automatic-schedule switch, per-stage-
profile enablement, per-creator image preference, the shared private-post generation core,
same-account exclusion, and explicit manual generation through the immediate-publish
operation.

**Removed:** per-creator cadence, intensity, nextRunAt, recurring per-creator rescheduling,
refresh-times-creators multiplication, startup catch-up, gap backfill, and generated-after-
the-fact historical timestamps.

**Added:** a private scheduled-post outbox, a rolling future reserve, separate generation
and publication operations, automatic-attempt accounting, policy invalidation, and
idempotent due-item publication.

## Onboarding

> **Decided: a real wizard, four steps, front and center.** The "one screen with one
> button" alternative is dropped. We cannot decide everything for the user, but we can make
> every step answerable by pressing Continue — defaults are applied, visible, and
> changeable in place. Disclosure stays in the wizard (see below); it cannot move to the
> creator page, because the creator does not exist yet.

### One wizard, two densities

The wizard modal asks **Simple or Advanced** — but these are not two wizards. They are
the same wizard at two densities.

Simple shows the same steps with defaults applied, collapsed, but with the choices
visible: "All 8 characters · hinted · up to N posts/day · images off". Each line has a *change*
affordance
that expands the corresponding advanced control in place. Advanced is therefore not a
separate mode; it is what happens when you click a Simple line. The learning path is
built in, and there is one code path that can drift instead of two.

### Wizard steps

The wizard opens directly after the age gate — there is no separate tutorial screen before
it. Step 1 carries the tutorial content inline, so the wizard is the on-ramp and the lesson
in one place instead of two sequential things that each claim to come first.

All four are visible as lines in Simple:

1. **Characters, with the tutorial folded in** — the step opens with the same three concepts
   Mari's post used to cover up front (why creators appear in the feed, why some posts are
   locked, that characters post on their own), directly above the character list, then every
   eligible character, individually selectable, pre-checked **only
   up to a threshold** (start at 12). Above it nothing is pre-checked and "select all" is
   an explicit action, because one click on Continue at a 40-character library is 40
   creator creations and 40 stage-profile drafts — 40 provider calls — for a user whose
   intent was "let me try this". The threshold value is a guess and should be set by
   someone with a real library. Uses `/noodler/eligible-accounts` and the Slice 8c bulk
   creation path.
2. **Disclosure** — stays here, because a stage profile cannot be generated without it and
   bulk creation happens in this wizard. Asked in product language, not jargon: *"How openly do your characters
   deal with being here?"* with three answers describing the effect rather than the
   mechanism — same name and everyone knows; an alter ego with a different name that a
   close look still connects; strictly separate with no visible link. These map onto
   `open`/`hinted`/`secret`. The character list expands underneath for individual
   exceptions. One concept, one line, still changeable.
3. **Activity** — one plain number: "up to N automatic posts per day". Explain that N is
   also the daily automatic text-attempt ceiling and that Marinara prepares future posts
   while it is running. Do not expose reserve horizon, slot multiplication, catch-up, or
   provider-concurrency concepts in onboarding.
4. **Images on/off** — whether automatic posts get generated images (Slice 8b). A large
   cost and impact factor, so it belongs in the visible flow.

Plus the night-quiet question for characters without a schedule.

### Two modes, one button

The wizard **opens by itself** the first time, immediately after the age gate, from both
paths including Skip. It is not behind a button on first run: the failure this whole slice
exists to fix is landing on an empty page with no next action, and a button the user has
to notice does not fix that.

Afterwards there is one wizard button in the NoodleR header, reading as "add creators".
The second run is character selection only — the global values are not per-creator and
must not be re-asked or silently overwritten. Existing creators are never overwritten by
a later run.

### First posts

The wizard's final step asks whether to generate first posts now, rather than deciding
silently. This is honest about the cost, and it avoids the current failure mode where a
freshly configured NoodleR shows an empty page for hours. It reuses the existing global
"Refresh NoodleR now" path.

**The prompt states concrete call counts, not just a yes/no.** "Generate now?" alone lets a
user believe they are only configuring a feature. The step must show the actual estimated
provider calls for the choices already made in this wizard run, split by when they happen:
one-time setup ("Create N profiles: about N text requests"), and recurring load ("Automatic
activity: up to P text-provider attempts and P image-provider attempts in any 24 hours" if
images are on, with retries included in those ceilings). Numbers come from this run's own
selections — character count, posts per day, images on/off — not a generic disclaimer.

**Declining, or a failure, must not leave "All creators has content" as a silent lie.** The
wizard's completion step needs an explicit outcome for each case, not just the happy path:

- **Declined** — land on All creators with the wizard's own summary state ("first posts not
  generated yet — trigger Refresh NoodleR now whenever you're ready"), not a bare empty tab.
- **Generation failed** (partial or total) — show which creators succeeded and which did not,
  with a retry action scoped to only the failed ones, not a re-run of the whole batch.
- **Zero eligible characters, or zero selected** — state that plainly and point at the "add
  creators" entry point; do not imply a feed that has nothing in it is broken.

The emulated Mari post in step 1 is a rendered illustration, not creator content, and does
not substitute for any of these states.

### Tutorial: an emulated post inside the wizard

There is no explanatory overlay and no coach-mark tour, and no separate tutorial screen
before the wizard — the wizard opens straight after the age gate, and its first step
carries the three concepts inline (see "Wizard steps" above). The same three things are
otherwise misunderstood: why some creators appear in the feed, why some posts are locked,
and that the characters post on their own.

**Decided 2026-07-29: the teaching post is emulated inside the wizard, not seeded into the
feed.** Step 1 renders a **mock post from Professor Mari** using the real post-card
component — hand-written copy, in her voice, showing a locked example so the padlock and
the Unlock control are explained by a thing the user is looking at rather than by a
paragraph. It is a rendered illustration, not a row in the post table.

This avoids the plumbing the seeded version quietly required. Mari has no NoodleR account
today; `allowProfessorMari` is a *public Noodle* participation flag, so a real feed post
would have meant minting a `platform: "noodler"` account for her and then answering whether
she is followable, subscribable, deletable, and whether she ever posts again — a creator in
All creators that is not one of the user's characters. None of that is needed to teach three
concepts. A mock card needs no account, no post row, no migration, and no cleanup.

It also removes the ordering problem the seeded version had: with no auto-follow, Following
is empty on first run, so a post placed there would be invisible at exactly the moment it is
meant to be read.

Explanatory text in a product like this does not get read; a post does, because reading
posts is the activity — and an emulated post keeps that property. What is lost is the
"scroll back to it later" reference. Accepted: the wizard is reachable again from its header
button, and the three concepts are also what the empty and locked states say in place.

**Why this is not the thing the "no fabricated posts" rule forbids.** Onboarding content
must never show a user's own character saying something the user did not approve. Mari is a
shipped in-world support voice, not one of the user's characters; the copy is hand-written
rather than generated; and it is now explicitly a mock rather than a stored post, so nothing
is put in anyone's mouth and nothing enters the user's data.

## User flow

### First run

1. User enables NoodleR in settings, passes the age gate (either path, including Skip).
2. **Wizard**, Simple by default, opens immediately — no separate tutorial screen precedes it:
   - characters, pre-checked only up to the threshold (see Wizard steps), with the
     three-concept tutorial folded into this step
   - disclosure, one plain-language question
   - up to N automatic posts per day
   - images on/off
   - night quiet for characters without a schedule
   - "generate first posts now?" — shown with estimated call counts for this run's choices
3. Creators are created in bulk and the future-post reserve begins warming gradually under
   the automatic daily attempt ceiling. **No auto-follow** — a follow
   the user never performed is a curation decision made for them, and Follow only means
   something if the user did it. Public Noodle is also near-empty at first; this is normal,
   not a defect to engineer around.
4. User lands on **All creators** — the wizard's completion step selects it once, since
   Following starts empty. The three concepts were taught by the emulated Mari post in step
   1; nothing is seeded into the feed. If first-post generation was declined or failed, the completion state
   says so explicitly instead of implying an empty tab is broken (see "First posts" above).
5. Following fills as the user follows people; from then on Following is the tab the UI
   opens to by default.

### Returning user

1. Opens NoodleR. Valid prepared posts whose publication times passed are already ordinary
   chronological feed posts. Startup performs no provider catch-up and presents no special
   absence or synchronization surface.
2. **Following** shows the curated feed; locked posts show a lock and an Unlock button.
3. **All creators** shows public teasers, including from creators not yet followed.

### Unlocking

1. User taps **Unlock** on a locked post.
2. Sheet offers "Unlock this post" or "Subscribe — everything from this creator".
3. Either choice reveals content immediately. Subscribing also establishes a follow.

### Adding creators later

1. Same wizard button, now reading as "add creators".
2. Existing creators are shown as already present and are left untouched.
3. Only newly selected characters are created.

## Watching is two thirds of the product

NoodleR's charter is to show sides of a character that ordinary conversation does not
expose. Measured against that, roughly two thirds of real use is **watching** — opening
NoodleR to see what your characters have been up to — and one third is directing them.

The slice history has been the other way round: composer, Guide, control plane, cadence,
access tiers, fan simulation, projects. Almost all authoring and machinery. The watching
experience has never had a slice of its own, and it shows in three concrete gaps.

### The feed is an audience surface

Authoring lives on the creator's own page — composer, automation state, source-changed
notice. The feed carries no operator controls. Every operator button in the feed is a
reminder that the whole thing is scenery, which is exactly what the watching mode should
not be reminded of. This continues Slice 7's direction of removing the main-timeline
stage-profile picker.

Ordering stays strictly chronological, newest first. No interest ranking: a feed whose
order the user cannot predict is a feed in which they quietly miss things.

### The creator page keeps its two roles apart

Slice 7 requires one profile surface rather than separate viewer and management modes,
and that stands. But the operator controls are gathered into one clearly delimited area
instead of being interleaved with the audience view: the profile reads as a profile —
image, bio, Subscribe, posts — and composer, automation toggle, and the source-changed
notice sit together below it.

Same single page, same Slice 7 contract, without Subscribe and Delete sitting side by
side as if they were the same kind of act.

### What is new since last time

Two mechanisms, deliberately both:

- a **counter on the NoodleR entry point**, so there is a reason to come back at all;
- a **divider in the feed** reading "new since your last visit", so returning users can
  see where they stopped instead of guessing while scrolling.

The divider needs one stored timestamp **per viewer persona**, not one per user and not
per-post read state. NoodleR follows and locked-post access are already persona-scoped
(`followingAccountIds`, subscriptions), so a single account-wide timestamp would let
visiting as one persona silently clear another persona's counter and divider despite them
having different Following feeds. The timestamp advances only after that persona's feed has
actually been shown, not merely on app entry.

### The creator never answers you — 8g

Viewer interactions are stored (`POST /noodler/posts/:id/interactions`), but no generation
path makes a creator respond to them. The generation service has no notion of replies at
all: it produces posts and nothing else.

For a product whose payoff is a character addressing you from a role the chat does not
show, this is the missing centre. Five planned slices make *invented* fans talk; nobody
planned for the figure to talk to the *real* user.

This becomes its own slice, **8g**, after this overhaul and before the fan work. It is
worth more than synthetic fan ambience, and it reuses the interaction plumbing 9a would
otherwise build first.

## Source drift

A stage profile is a **snapshot**. The linked Noodle account stores its own name and
handle (see commit 9d3adc21e), and the stage profile's display name, handle, bio, and
`stagePersonality` are drafted once at creation and never re-read. Editing the underlying
character afterwards changes nothing.

That is mostly the right default — the stage profile is a curated work, not a mirror —
but three consequences need handling.

### The identity-protection hole

`protectNoodlerGeneratedIdentity()` redacts exactly two strings: the *stored* account
`displayName` and `handle`. Meanwhile `generateNoodlerStageProfileDraft()` feeds
`sourceText(source.data)` from the **live** character card, including its current `Name:`.

So for a renamed character with a `hinted` profile: the prompt carries the new name, the
disclosure rule is handed the old one, and output redaction scrubs only the old one. The
new real name can land in the stage profile unredacted. It fires when a stage profile is
re-drafted after a rename.

This breaks the disclosure promise the Living Plan states as a product guarantee, so 8f
fixes it: redaction must protect the current source identity as well as the stored
snapshot, with a regression covering the rename-then-redraft path.

### Drift is not only about names

The user-visible cases are broader than renames — "the character now has blonde hair
instead of black" is the same class of problem. Appearance drift additionally affects
generated images, because `noodle-private-images.service.ts` builds image prompts from
character appearance while the stage profile still describes the old look.

### One mechanism: a source-changed notice

Nothing is applied automatically. Instead the creator page carries one affordance stating
that the source has changed since this creator was created, showing what changed, with
explicit actions:

- **adopt name and handle** — offered for `open` profiles, which are meant to show the
  linked identity. Not offered for `hinted` and `secret`, whose different name is the
  entire point.
- **re-draft the stage profile** — feeds the current character card through the existing
  draft flow. The user decides whether an edit propagates; hand-written
  `stagePersonality` is never silently overwritten.
- **dismiss** — accept the drift.

Detection should be cheap: persist a snapshot or hash of the source fields used at draft
time on the noodler account, and compare when the creator page is read. No polling, no
background job.

### Orphaned creators are the same notice

A character can vanish from a creator's perspective in two ways: deletion, or a profile
import that mints fresh character IDs while the character still exists. Slice 8's merged
fix contains the damage by filtering unresolvable accounts out of generation, but the
user never learns why a creator went quiet.

8f surfaces it as the same source-changed affordance in a "source missing" variant, with
actions to **relink** the creator to an existing character or **delete** it. Relinking is
always an explicit user choice — never guessed from a matching name, because guessing
wrong would bind the wrong character to an 18+ stage profile.

## What the code already provides

Most of this exists and mainly needs consolidating.

| Concept | Where it lives today |
| --- | --- |
| Follow | `followingAccountIds` on the account, `packages/shared/src/types/noodle.ts` |
| Subscribe | `noodle_account_subscriptions` table |
| Feed tabs | `feedTab: "all" \| "subscribed"` in `NoodlerHome.tsx` |
| Post access | `access: "public" \| "subscriber" \| "ppv"` plus `ppvPrice`; unlocks in `noodle_post_unlocks` |
| Gate logic | **one** function: `canViewNoodlerPost()` in `noodler-access.ts` |
| Locked projection | server already returns `locked: true`, nulls content, keeps counts as a teaser |
| Windowed time placement | `noodle-refresh-schedule.ts` — reuse the narrow planning principle, not its persisted refresh state |
| NoodleR cadence | `noodle-autopost-cadence.ts` — the model to replace |
| Per-creator enable | `autoPosting.enabled` — already the eligibility flag |
| Character schedules | `WeekSchedule` in `conversation-presence.ts`, opt-in via `includeCharacterSchedules` |
| Per-creator wizard | `source → disclosure → draft → automatic` in `NoodlerHome.tsx` |
| Age gate | `NoodlerAgeGate.tsx`, ends in `enableNoodler()` — and then nothing |
| Bulk creation | `POST /noodler/accounts/bulk` and `NoodlerBulkCreatePanel` (Slice 8c) |
| Generate now | global "Refresh NoodleR now" from Slice 8 |

`unlockPost` charges nothing today, and `ppvPrice` is already display-only.

## Rough plan

Deliberately without file and line lists — those come once the design settles.

### Shipping units

8f is **six units, not one slice**. They share no code and no risk profile, and bundled
they guarantee the outcome the Outside review predicts: the watching work is what gets cut
when the slice runs long.

| Unit | Steps below | Depends on |
| --- | --- | --- |
| **8f-1** identity-redaction fix | Source drift § "The identity-protection hole" | nothing |
| **8f-2** access collapse | A, B, C, D, H | 8e |
| **8f-3** scheduling | E | 8f-2 |
| **8f-4** onboarding | F, G | 8f-2, 8f-3, 8c |
| **8f-5** watching surface | I, plus "What is new since last time" | 8f-2 |
| **8f-6** source-drift notice | J | nothing beyond 8f-1 |

8f-1 is a defect, not a design change: a `hinted` or `secret` profile can emit the real
name after a rename. It ships on its own and must not wait behind a scheduler rewrite.

8f-5 is the cheapest item in this document — one stored timestamp, no provider budget — and
is split out precisely so a scope cut cannot eat it.

**Slice 8g sequences after 8f-2 and before 8f-3.** It needs the settled access and
interaction model, which is 8f-2; it needs nothing from scheduling, onboarding, or the
divider. Putting it behind all of 8f defers what this document itself calls the missing
centre behind two units it does not depend on.

### Steps

**A. Consolidate access.** `access` collapses to `public | locked`. `ppvPrice` and
`subscriptionIncludesPpv` are removed. Gate rule: public is visible, otherwise subscribed
**or** individually unlocked. Every reader routes through one function, so this is a
single edit plus a migration, following the pattern Slice 8e establishes in
`noodle-platform-migration.ts` (on staging since #4129).
See **Migration** below — the data step is not optional and the read-normalizer's fallback
is a security decision.

**B. Follow as curation.** Feed tabs become Following / All creators. Subscribe
establishes a follow. The viewer scope filters by follow for the Following tab.

**C. Simplify generation.** The model decides locked yes/no, and may choose public for
teasers. Affects the structured response format and prompt fragments.

**D. Post UI.** One Unlock button; behind it a sheet with two options.

**E. Scheduling.** Replace interval cadence with a 24-hour rolling reserve of private,
pre-generated scheduled posts. Separate low-priority sequential preparation from
idempotent publication, store prepared content in a capability-owned outbox, enforce one
automatic text-attempt ceiling, and invalidate stale items when creator or policy state
changes. Delete `noodle-autopost-cadence.ts`, `intensity`, and `nextRunAt`. Startup
materializes valid due items without provider work and resumes preparing only future
coverage. Night quiet and character schedules constrain future publication planning.

**F. Setup wizard.** Opens once after activation from both age-gate paths; afterwards
from a header button in "add creators" mode. Mostly a shell over existing endpoints.

**G. Tutorial.** Folded into the wizard's first step (three concepts), taught through an
emulated Professor Mari post rendered with the real post card — no separate tutorial screen,
no seeded feed post, and no NoodleR account for Mari.

**H. Docs.** `docs/noodle/overview.md` and `docs/noodle/settings.md` describe the old
three-level model and `subscriptionIncludesPpv`. Translated packs on `docs-i18n` must
follow, or a `[docs-i18n]` follow-up issue must be opened.

**I. Creator-page role separation.** Gather composer, automation toggle, and the
source-changed notice into one delimited operator area below the profile, per "The creator
page keeps its two roles apart". Still one surface, per Slice 7; layout only, no contract
change. Ships with 8f-5 because it is the same watching-side concern.

**J. Source-changed notice.** Snapshot the source card fields used at draft time on the
noodler account, compare on creator-page read, and surface one notice with adopt
name/handle (`open` only), re-draft, and dismiss — plus the "source missing" variant with
relink or delete. Per "Source drift"; the redaction hole in that section is 8f-1 and ships
separately.

## Migration

Three of the four removals need no data step at all, and the fourth needs a careful one.

### Which unit owns which step

This section is one analysis but **two separately shipped migrations**, and the ordering
rule below is not the property of whichever one goes first:

| Step | Owner |
| --- | --- |
| `posts.access` → `public \| locked`, drop `ppvPrice`, fail-closed normalizer | **8f-2** |
| Drop `subscriptionIncludesPpv` from the settings type and normalizer | **8f-2** |
| Drop `intensity` and `nextRunAt` from the settings type and normalizer | **8f-3** |
| Initialize the outbox, attempt ledger, budget watermark, and the `migrationAt + 24 hours` preparation hold | **8f-3** |

**The rule that a data step runs before the normalizer that reads it applies to both units,
not only to 8f-2.** 8f-2's is the dangerous one — an unmigrated row read by a collapsed
normalizer becomes world-readable — but 8f-3's settings removals must still land in the
order described here, and 8f-3's own initialization must be transactional in the same way.
Neither unit may assume the other has already run: 8f-3 ships after 8f-2, but a user may
upgrade across both at once, so each migration states its own preconditions and is
idempotent on re-run.

### What migrates for free

Account settings are rebuilt field by field on read (`noodle.storage.ts:243`,
`normalizePersistedBoolean(rawAccess.subscriptionIncludesPpv) ?? false`). A field that the
normalizer stops reading is simply not carried into the object and disappears on the next
write. So `subscriptionIncludesPpv`, `intensity`, and `nextRunAt` need **no** migration —
deleting them from the type and the normalizer is the migration. Stale keys may linger in
stored JSON until the row is next written, which is harmless because nothing reads them.

`noodle_post_unlocks` rows also survive untouched: individual unlock stays a real concept
under the new model, so no row is orphaned and no cleanup is needed.

### What does not: `posts.access`

Post access is normalized on read at `noodle.storage.ts:510`:

```ts
access: row.access === "subscriber" || row.access === "ppv" ? row.access : "public",
```

**Anything unrecognized becomes `public`.** If the type collapses to `public | locked` and
this line is rewritten to recognize `"locked"` before the stored rows are migrated, every
existing `subscriber` and `ppv` post in the database silently becomes world-readable. That is
the exact failure Slice 9e prohibits, arriving through a normalizer default rather than
through a leak in the projection.

Two consequences, both mandatory:

1. The data migration (`subscriber` → `locked`, `ppv` → `locked`, `ppvPrice` → dropped) runs
   **before** the normalizer changes, in one transaction, in the 8e migration pattern.
2. The new normalizer must **fail closed**: unknown value → `locked`, not `public`. An
   unreadable access value is not evidence that a post is public. This also makes the
   migration order forgiving instead of catastrophic if the two land out of step.

### The one real behaviour change

The collapse is not purely cosmetic. Today's gate (`noodler-access.ts:12-15`) says a `ppv`
post is visible only if individually unlocked, *or* if the viewer subscribes **and** the
creator has `subscriptionIncludesPpv` enabled. For a creator with that flag **off**, a
subscriber currently cannot see `ppv` posts at all. After the collapse the rule is
`subscribed || unlocked`, so those posts become visible to that subscriber.

Migration therefore *reveals* previously hidden posts — it never hides a visible one. That is
acceptable here, and worth stating rather than discovering: NoodleR is single-user and local,
the "subscriber" is the person who owns the character, and nobody loses access they paid for
because nothing was ever paid. It is also irreversible, so the migration is forward-only by
design; a rollback cannot reconstruct which locked posts used to be `ppv`.

If that reveal is ever unacceptable, the alternative is migrating `ppv` → `locked` **plus**
seeding an unlock row for nothing — i.e. keeping them hidden from subscribers, which
contradicts the whole point of the two-level model. Not recommended; named so the choice is
visible.

### Code paths that reference `ppv` directly

`ppvPrice`/`subscriptionIncludesPpv` appear in **12 files**, not the two the earlier draft
of this section named. Verified 2026-07-28:

| Layer | Files |
| --- | --- |
| server | `noodle.storage.ts`, `noodle.routes.ts`, `noodler-access.ts`, `noodle-private-post.operation.ts`, `noodle-private-generation.service.ts`, `db/schema/noodle.ts` |
| shared | `schemas/noodle.schema.ts`, `types/noodle.ts` |
| client | `NoodlerHome.tsx`, `hooks/use-noodle.ts` |
| i18n | `locales/en.json`, `locales/ko.json` |

Known line-level anchors: `noodle.storage.ts:771-799` (post projection), `:1562`
(`ppvPrice: input.access === "ppv" ? ... : null` on write), `:2386` (a public-persona viewer
rule keyed on `access !== "ppv"`), and `noodle.routes.ts:335,409` (exposing
`subscriptionIncludesPpv`). Each disappears rather than being rewritten — the point of the
collapse is that these special cases stop existing.

**The generation service and the shared schema are on this list, which the rough plan's
"single edit plus a migration" framing understates.** `noodle-private-generation.service.ts`
holds the structured response format the model fills in, so step C is not optional
polish — the model cannot emit an access value the schema no longer has.

**Slice 10 is merged and its contract names PPV.** Slice 10 shipped the composer's
`ppvPrice` field and states that literal Post publishes "title, body, image, poll, access,
and PPV values". Removing `ppvPrice` therefore changes merged, shipped behavior: the price
field and the PPV access option come out of the composer. Recorded in the Living Plan's
Slice 10 section as well, so the change is not discovered during implementation.

**Localization is only partly translated.** The three `ppv` keys exist in `en.json`; `ko.json`
carries two of them and the other ten locales carry none. Deleting the keys is safe in all
twelve, but the replacement Unlock-sheet strings land untranslated everywhere except English —
that is the existing state for NoodleR strings, not a regression this slice introduces.

### Regression to write

Extend the 8e migration regression: a fixture with one `public`, one `subscriber`, one `ppv`
with `ppvPrice`, and one `ppv` with an existing unlock row, against a creator with
`subscriptionIncludesPpv` false. Assert after migration that all three non-public posts are
`locked`, `ppvPrice` is gone, the unlock row still grants access, and — the important one —
that a **non**-subscriber still sees none of them.

## Relationship to the Living Plan

**Confirmed unchanged:**

- Slice 9b's support events still hold and map one-to-one onto the new sheet: "Joined the
  inner circle" is the Subscribe row, "Unlocked a post" is the single-post row.
- Slice 9e's rule that a locked post's existence must never leak becomes easier to honor,
  because there is one locked projection instead of two.
- The two-level control plane stands. The wizard is explicitly **not a third place where
  settings live** — it is an on-ramp onto the two existing levels.

**Changed by this slice:**

- Slice 8's "automatic posts default to `subscriber` access" becomes "default to
  `locked`". Same meaning, new name.
- `subscriptionIncludesPpv`, from Slice 6, is removed with no replacement.
- Slice 8's per-creator interval cadence is replaced by a rolling private reserve of
  pre-generated posts with fixed future publication times. Per-creator enable/disable
  survives; `intensity`, per-creator `nextRunAt`, recurring rescheduling, startup catch-up,
  and generated-after-the-fact historical timestamps are removed.
- **Slice 11's rule that source-character schedules guide content but never own publication
  timing is narrowed rather than reversed.** A sleeping or busy character is not selected
  for a future publication time. Schedules constrain eligibility and prompt context, but
  never determine how often a creator posts.

## Known limits, deliberately accepted

Without cost, choosing between a single unlock and a subscription is not a real choice:
subscribing is free and strictly better, so every rational user subscribes. The value of
this slice is comprehensibility, not balance. That is acceptable as long as we name it
rather than pretending it is an economy.

If a balance is ever introduced it hooks in at exactly two places, `unlockPost` and
`subscribe`. Those stay the only mutation points for that reason — not because a wallet
is being built, but so that one could be.

## Outside review — 2026-07-27

An outside read of this document against four lenses: onboarding, usability, server cost,
and the daily user experience. Recorded as a review, not as product decisions. Two of its
onboarding proposals were weighed and rejected and are kept here so they are not
re-proposed. Scheduler observations in this dated review describe the retired day-plan
candidate; the current Scheduling rework section supersedes them.

### What a user expects, and what 8f delivers

After the age gate the expectation is roughly *"my characters have an Instagram, I check it
daily, they post on their own, and they react to me."* Against that:

| Expectation | 8f |
| --- | --- |
| See something immediately | Wizard's "generate first posts now?" covers it |
| Something new after the server was closed | Prepared scheduled posts cover the reserve horizon; no startup generation or invented history |
| She answers me | **8g. Explicitly not in 8f.** |
| Understand why something is locked | The Unlock sheet covers it |

The reply path is the largest gap between what the product promises and what this slice
ships, and this document already says so ("the missing centre"). Worth carrying as a stated
consequence of the slice boundary rather than as a footnote: 8f makes NoodleR coherent, not
responsive.

### Weighting

This document states that watching is two thirds of the product and then spends roughly two
thirds of its length on scheduling internals and migration. The section on what a user does
daily is half a page. That is a fair reflection of where the *risk* sits, not of where the
*value* sits — worth knowing when the slice is cut into PRs, so the watching work does not
become the part that gets dropped when the slice runs long.

### Weighed and rejected: subscribing the owner by default

The proposal was that creating a creator also subscribes to them, leaving the lock as a
teaser device toward non-followers only — on the grounds that with a free subscription the
Unlock sheet is an extra tap before a one-time click that nothing gates, as "Known limits"
already concedes.

**Rejected.** The Unlock sheet stays as specified: the platform fiction is the product, and
a feed in which nothing is ever locked to the viewer is not the thing being simulated.
Recorded so this is not re-litigated as a fresh idea.

### Weighed and rejected: a one-screen wizard

The proposal was one screen (character selection plus "generate first posts"), with activity
and images left to the settings that already exist, and disclosure defaulted to `hinted` and
changed on the creator page where the generated name sits next to the real one.

**Rejected.** Four steps at two densities stay. Two risks from the review remain live and
should be watched while building rather than argued again:

- prefilled lines still have to be read and judged, so "Simple" is only simpler if the lines
  are genuinely skimmable — if a Simple line needs a sentence to explain, that step has
  failed its own premise;
- disclosure is asked before the user has seen a single stage profile, so the plain-language
  phrasing carries the entire burden of making the choice meaningful.

### Advertised frequency versus delivered frequency

"Up to N automatic posts per day" remains a ceiling, not a promise. Schedule eligibility,
provider failures, an incomplete reserve, and an absence longer than the reserve horizon
may deliver fewer. Settings therefore show both automatic attempts used in the last 24
hours and how far the prepared reserve currently reaches; the audience feed carries neither
operator detail.

### Cost observations

- **Pre-selecting every character** was listed under Open questions as something to
  "consider". The review rated it as a hard limit rather than a judgement call: one click on
  Continue at a 40-character library is 40 creator creations and 40 stage-profile drafts,
  i.e. 40 provider calls, for a user whose intent was "let me try this". **Adopted** — see
  wizard step 1: no pre-checking above a threshold, "select all" as an explicit action.
- **The images switch** roughly doubles or halves total spend and is the fourth line of a
  four-line wizard, i.e. the one most likely to be clicked past. It is the single most
  expensive answer in the flow and should not read like the least important one.

### Cheapest real win in the document

The "new since your last visit" divider plus the entry-point counter costs one stored
timestamp per viewer persona and no provider budget, and it is what gives a user a reason to
come back at all. It currently sits as a sub-point of a section whose remaining content is
deferred. If any part of the watching work survives a scope cut, it should be this one.

## Open questions

- ~~**Default `postsPerDay`.**~~ Resolved 2026-07-29 — **4**, range 1..24. Tuning it from a
  real paid-provider run and a real local-model run (latency, noise, output quality, image
  cost) is still worthwhile, but no longer blocks 8f-3.
- **The plain-language disclosure phrasing.** Disclosure stays in the wizard, but the words
  are still abstract — "an alter ego with a different name that a close look still connects"
  has no referent for a user who has not seen a stage profile yet. Needs writing and one
  comprehension check on a real person. This is the highest-risk item left in the flow.
- **The pre-check threshold number.** The mechanism is decided; 12 is a guess. Should be set
  by someone with a real character library.

### Decided, kept for the reasoning

- ~~**Auto-follow and which tab opens first.**~~ No auto-follow. Following is the tab the UI
  opens to on every ordinary visit; onboarding's completion step selects All creators once,
  because Following starts empty right after setup. A follow the user never performed is
  curation done for them, and public Noodle is near-empty at first too.
- ~~**The wizard's shape.**~~ A real wizard, four steps, front and center, every step
  answerable with Continue. The one-screen alternative is dropped. It opens automatically on
  first run; later runs are character selection only.
- ~~**Does disclosure belong in the wizard?**~~ Yes, and it cannot move: bulk creation
  happens in the wizard and a stage profile cannot be generated without it. Only the wording
  is open, above.
- ~~**Pre-selecting every character.**~~ Pre-check only up to a threshold; "select all" is an
  explicit action above it. Only the number is open, above.
- ~~**Discovery beyond teasers.**~~ Both, but not both now. All creators is the surface;
  browse/search is its own work and earns itself once a library is large enough to lose a
  creator in. Deferred with a trigger, not open.
- ~~**Scheduler shape.**~~ Front-loaded generation with a private scheduled-post reserve.
  The day-plan/catch-up and gap-backfill candidates are retired. Startup performs no
  provider generation and posts are never generated after the fact with historical times.
- ~~**Migration.**~~ Resolved — see the Migration section. Old `subscriber` and `ppv` posts
  do render identically, and the acceptable part is not the rendering but the reveal: a
  subscriber to a creator with `subscriptionIncludesPpv` off gains access to posts they
  previously could not see. Accepted, because the subscriber is the owner.

## Changelog

- **2026-07-29** — Coherence pass before implementation. Fixed a self-contradiction: the
  User flow said "all pre-checked" while Wizard steps said pre-check only up to a threshold,
  which would have shipped the 40-provider-call behaviour the threshold exists to prevent.
  Mari's welcome post became an **emulated post inside wizard step 1** rather than a seeded
  feed post — she has no NoodleR account, and with no auto-follow a real post would have
  landed in an empty Following tab. Recorded why subscribe-implies-follow does not conflict
  with no-auto-follow (the system never follows for you; subscribing is the user acting) and
  required the Unlock sheet to say so. Set `postsPerDay` default to **4**, range 1..24, so
  8f-3 is no longer gated on provider measurement. Split the Migration section's ownership
  across 8f-2 and 8f-3 and stated that the data-step-before-normalizer rule binds both.
- **2026-07-29** — Factual refresh against current staging, no design change. Slice 8e is
  merged (#4129), so `noodle-platform-migration.ts` is on staging and 8f-2 is unblocked.
  Code references updated for the rename: `protectPrivateGeneratedIdentity` →
  `protectNoodlerGeneratedIdentity`, `generateNoodlePrivatePost` →
  `generateAndApplyNoodlerPost`. The access normalizer this document's fail-closed argument
  points at moved to `noodle.storage.ts:510`.
- **2026-07-30** — Replaced both scheduler candidates with the decided front-loaded
  scheduled-post reserve. NoodleR now prepares future posts gradually while Marinara is
  running, stores them in a private capability-owned outbox, and publishes due items
  idempotently at their preassigned times. Startup performs no provider catch-up; a depleted
  24-hour reserve produces a quiet gap rather than a burst or fabricated history. Collapsed
  activity to one "up to N posts/day" setting and automatic text-attempt ceiling, required
  concurrency 1 and foreground-provider precedence, added policy/source invalidation and
  private-media ownership, and rewrote onboarding, user flow, migration, Slice 12 seams,
  proof, and Living Plan references around the new contract. The ordinary feed carries no
  absence recap or synchronization surface. Architecture closure added atomic rolling
  text/image attempt claims, conservative crash accounting, connection-scoped admission
  after 30 foreground-idle seconds, a strict no-provider-work startup boundary, image
  prompt-review expiry to text-only publication, schedule/night-quiet/timezone invalidation,
  and the exact 60-minute immediate-post conflict rule.
- **2026-07-29** — Scheduling section now carries **two candidate designs for review** rather
  than one asserted design. Option A is the existing platform day plan, unchanged but
  labelled. Option B is new: backfill the gap since the last pass and stamp each post with a
  plausible instant inside it, on the premise that a local single-user app's user cannot
  observe a posting time they were absent for. B collapses the settings to one number, needs
  one ISO timestamp of state, serves both user populations through one code path, and
  dissolves the open post-versus-run cap question; its costs are a second scheduling pattern
  in the codebase and a commitment to chosen `createdAt` values. Added a comparison table, a
  stated recommendation (B), and the shared requirements either must satisfy. Recorded that
  fan activity is a different schedule shape under either option — anchored to a post, not a
  clock — that it is where Noodle's batched call actually fits, and that under B backfilled
  posts need backfilled reactions.
- **2026-07-29** — Coherence pass. Two designed features had no shipping unit and would have
  been discovered as scope during implementation: the source-changed/orphaned-creator notice
  is now step J and unit **8f-6**, and the creator-page operator-control grouping is now step
  I, folded into 8f-5 as the same watching-side concern. Five units became six. Removed the
  stale "All creators opens first" line from Decided, which contradicted the same day's
  clarification that Following is the default tab and All creators is onboarding's one-time
  exception. Still open and deliberately not resolved here: the catch-up cap says it bounds
  posts while `min(missedSlots, 3)` bounds refreshes, and its "a creator cannot post twice"
  claim does not hold for small libraries where the selection sort re-picks the same
  creators.
- **2026-07-29** — Closed five items from an internal usability review. Tutorial no longer
  has its own screen: it is folded into the wizard's first step, then reinforced as Mari's
  post afterward. "Generate first posts now?" now shows estimated call counts, and the
  wizard's completion state defines explicit outcomes for declined, failed, zero-eligible,
  and zero-selected cases instead of assuming All creators always has content. The
  new-since-last-visit timestamp is per viewer persona, not one per account. Clarified that
  Following is the default tab on every ordinary visit; onboarding's one-time exception is
  landing on All creators because Following starts empty. Left open: the catch-up
  post-vs-refresh cap wording, the Unlock/Subscribe false-choice framing, and whether "up to
  N posts/day" should become a live actual-count. Creator-reply UX (8g) scoping deferred to
  its own task.
- **2026-07-28** — Split into five shipping units (8f-1..8f-5) rather than one slice, so the
  redaction fix ships immediately and the watching surface cannot be cut with the scope. 8g
  re-sequenced to after 8f-2 instead of after all of 8f. Replaced the two-file `ppv` code-path
  list with the verified 12-file list, which adds the shared schema, the generation service,
  both client files, and two locale files. Recorded that Slice 10 is merged and its shipped
  contract names PPV values, so removing `ppvPrice` changes shipped composer behavior.
- **2026-07-27** — Onboarding and access questions closed. No auto-follow, All creators
  opens first. A real four-step wizard, opening automatically on first run, one-screen
  alternative dropped. Disclosure stays in the wizard (the creator does not exist yet);
  only its wording is open. Character pre-check capped at a threshold. Discovery deferred
  with a trigger. Startup catch-up stays `min(missedSlots, 3)` — a single catch-up post
  was proposed and rejected, reasoning recorded. Added why Mari's welcome post does not
  violate the no-fabricated-posts rule. Post quality at 12 × 2 demoted from an open
  question to a test task. Reviewer's accessibility concern about the age-gate dodging
  checkbox checked against `NoodlerAgeGate.tsx:315-328` and found already handled
  (reduced-motion, coarse pointer, and keyboard all skip the dodge) — no change made.
- **2026-07-26** — First draft: idea, code inventory, rough plan, relationship to the
  Living Plan, open questions.
- **2026-07-26** — Added access decisions (Follow as curation, subscribe implies follow,
  Following/All tabs with All first, public teasers visible to non-followers), the
  scheduling rework (platform day plan, bounded catch-up, character-schedule slot
  shifting, ad-hoc trigger instead of a second clock), the source-drift policy including
  the identity-protection defect, and the full onboarding and user flow.
- **2026-07-26** — Usability pass. Scheduling reduced to plain round-robin with no weights
  and no `intensity`; activity expressed per creator so slots scale with library size.
  Added the watching-side analysis: feed as audience surface, chronological order,
  new-since-last-visit divider and counter, operator controls gathered on the creator
  page, and Slice 8g for creators replying to real viewers. Tutorial replaced by a seeded
  Professor Mari welcome post.
- **2026-07-26** — Scheduling simplified after reading how public Noodle actually does it.
  A slot is now a **refresh** rather than one creator's turn, which is Noodle's own model
  (`noodle-refresh-scheduler.service.ts:128`). That deletes round-robin state, slot
  hand-over, position preservation, the ad-hoc slot-burning rule and the catch-up burst
  case; selection reuses the existing ordering in `chooseNoodleParticipantAccounts()` and
  the fan-out in `refreshAllNoodlerCreatorsNow()`. Recorded that NoodleR generation stays
  one provider call per post — batching is not portable, because disclosure and identity
  redaction are per creator. Reversed the per-creator activity scaling in favour of one
  stated ceiling, N × k. Character schedules became an eligibility filter instead of a
  re-timing mechanism. Added what the creator page shows in place of `nextRunAt`.
- **2026-07-26** — Activity became two plain numbers, refreshes per day and creators per
  refresh, mirroring public Noodle's existing `refreshesPerDay`/`participantMin`/
  `participantMax` settings; the three named levels are dropped, along with the need to test
  invented level names for comprehension. Defaults 12 × 2. The wizard's shape moved to Open
  questions rather than staying asserted — one screen versus four collapsed steps, and
  whether disclosure belongs in it at all — together with the pre-selection cost at large
  libraries and the second-run rule.
- **2026-07-26** — Migration worked out and the open question closed. Key findings: settings
  removals (`subscriptionIncludesPpv`, `intensity`, `nextRunAt`) need no data step because the
  storage normalizer rebuilds settings field by field; `posts.access` does, and the existing
  normalizer at `noodle.storage.ts:510` falls back to `public`, so an unmigrated or unknown
  value would turn every locked post world-readable. The new normalizer must fail closed to
  `locked`. Also recorded the one real behaviour change: the collapse reveals `ppv` posts to
  subscribers of creators that had `subscriptionIncludesPpv` off.
- **2026-07-27** — Outside review appended as its own section. One change to the design:
  startup catch-up runs `min(missedSlots, N)` refreshes instead of collapsing every missed
  slot into one, because for a Marinara that is started for an evening the collapse is the
  normal case, not a rare repair, and it would deliver k posts where the settings promise a
  day's worth. Two review proposals were weighed and rejected — subscribing the owner by
  default, and shrinking the wizard to one screen — and are recorded as rejected so they are
  not re-proposed. The remaining findings are observations; the open questions below are
  unchanged.
