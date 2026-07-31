# NoodleR PR-Split — Living Plan

Authoritative repository plan as of 2026-07-31. Update the status table and merged list as
work lands. Historical slice numbers are retained where useful, but the order below
is the current intended order.

This Living Plan replaces the historical repository v2 plan. Kickoff prompts remain
self-contained; this file is the planning authority unless product direction
explicitly replaces it.

Slice 8f additionally has a detail design document,
[NoodleR Access Model and Onboarding Overhaul](./noodler-access-and-onboarding.md). This
file stays authoritative for ordering and decisions; that file owns 8f's design detail.

## Terminology — "private" is retired

Earlier slices called the NoodleR side of the split **private**. That word is gone from the
code and the UI as of the platform rename. It read as a real privacy or security guarantee to
users, and it collided with the genuine access concept one level down.

Historical slice descriptions below are left in their original wording; **new work must use the
current vocabulary**:

| Old | Current |
| --- | --- |
| `visibility: "public" \| "private"` | `platform: "noodle" \| "noodler"` |
| `publicAccountId` | `noodleAccountId` |
| "private account" / "private post" | "NoodleR account" / "NoodleR post" |
| `generatePrivatePost` / `noodlePrivate*` | `generateNoodlerPost` / `noodleNoodler*` — see `packages/server/src/services/noodle/noodle-noodler-*.ts` |
| `privatePostGuide` | `noodlerPostGuide` |
| `privateGenerationGuidance` | `noodlerGenerationGuidance` |

The current post-level access enum is `access: "public" | "locked"`
(`noodler-access.ts`). `subscriber`, `ppv`, `ppvPrice`, and `subscriptionIncludesPpv` are
retired access-model terms retained below only where a historical shipped contract or the
8f-2 migration needs to name them. `platform` says *which simulated app an account lives
on*; `access` says *who may read a post*.

## Product charter

NoodleR is Marinara's standalone **18+ adult creator-platform simulation**, analogous
to how Noodle simulates Twitter-like social media. Its purpose is to give users a new,
exciting way to interact with their personas and characters through creator/stage
profiles, including exploring sides of those characters that their ordinary public
identity or conversation may not expose.

The product experience therefore needs both agency and life:

- users can create, play, guide, and control stage-profile creators;
- characters can sustain those profiles autonomously enough to feel active rather
  than like a static post generator;
- the user can experience the creator platform through profiles, feed content,
  access choices, interactions, and eventually audience response;
- stage identity/disclosure supports open alter egos and concealed sides while server
  policy prevents accidental identity leaks.
- Open profiles show their linked identity directly. Hinted profiles reveal the linked
  display name and handle only through a deliberate profile-badge hint while keeping
  exact identifiers out of generated content. Secret profiles expose no identity hint.

## Merged so far

| Slice | What | PR |
| --- | --- | --- |
| 1A | Typed settings + atomic patching (four subtrees: profile/social/scheduler/privacy; closed the raw-settings escape hatch) | #3744 |
| 1B | Private-account schema + isolation (unique `publicAccountId`, atomic creation) | #3751 |
| 2 | Client navigation shell + real containers (discriminated navigation state, `NoodleShell`) | #3759 |
| 3 | Public generation service seam (public generation extracted from routes) | #3782 |
| 4 | Private generation operation (`generatePrivatePost`, discriminated public/private request union) | #3795 |
| 5 | Stage identity + guided generation (open/hinted/secret disclosure and identity-leak protection) | #3830 |
| 6 | Subscriptions & access (subscriber posts, PPV unlocks, hidden-from, viewer-persona scoping) | #3856 |
| 6b | Shell/feed parity and private interactions (real component reuse, pink theming, merged feed, access-gated interactions, coin popover, mode toggle) | #3888 |
| 7 | Roleplay authoring and creator-profile parity (literal Post, optional Guide, titles, unified profiles, stage creation) | #3969 |
| 8 | Text-only automatic creator posting and control plane | #3984 |
| 10 | Composer media parity (one uploaded image, optional poll, private media storage) | #3981 |
| 8b | Access-protected generated creator images | #4001 |
| 8c | Bulk creator operations, creation-flow hardening, noodle-blue → noodle-accent migration | #4047 |
| 8d | NoodleR shell/profile UI pass (pink shell, profile return navigation, viewer scope, reply-manage override) | #4063 |
| 8e | `private` → `noodler` rename across code, data, and UI | #4129 |

## Current status and intended order

| Order | Work | Status | Dependency |
| --- | --- | --- | --- |
| 0 | Slice 6b stabilization and browser proof | Integrated Playwright proof passed with a Guided-output coverage gap; bare staging proof not isolated | Merged 1A–6b |
| 1 | Slice 7 — roleplay authoring and creator-profile parity | Merged through #3969 | 4, 5, 6, 6b |
| 2 | Slices 8, 8b, 8c, 8d, 10 | Merged; see the table above | — |
| 3 | Slice 8e — `private` → `noodler` rename across code, data, and UI | Merged through #4129 (2026-07-27), with `noodle-platform-migration.ts` and its regression | none beyond merged staging |
| 4 | Slice 8f-1 — identity-redaction fix (rename-then-redraft) | Implemented on `big-chungus-1`, unmerged; `buildNoodlerPublicIdentity()` widens the identity union, covered by `noodle-prompt.regression.ts` | none |
| 5 | Slice 8f-2 — access collapse to `public \| locked` + migration | Implemented on `big-chungus-1`, unmerged; see [detail document](./noodler-access-and-onboarding.md) | 8e (same files) |
| 6 | Slice 8g — creators reply to the viewer | Implemented on `big-chungus-1`, unmerged; `noodle-noodler-creator-reply.operation.ts` + `noodle-noodler-reply-generation.service.ts`, covered by `noodle-creator-reply.regression.ts` | 8f-2 access model only |
| 7 | Slice 8f-3 — front-loaded scheduled-post reserve | Implemented on `big-chungus-1`, unmerged; `noodle-noodler-reserve.operation.ts`, `noodle-autopost-cadence.ts` deleted | 8f-2 |
| 8 | Slice 8f-4 — setup wizard with an emulated Professor Mari teaching post | Implemented on `big-chungus-1`, unmerged; `noodler-onboarding.ts` + wizard screens | 8f-2, 8f-3, 8c bulk creation |
| 9 | Slice 8f-5 — watching surface: new-since-last-visit divider and entry-point counter | Planning; cheapest win in the design, split out so a scope cut cannot eat it | 8f-2 |
| 9+ | Slice 8f-6 — creator-page operator area, including source-changed and source-missing notices | Planning; independent of the access and scheduling work, so it may land any time after 8f-1 | 8f-1 |
| 10 | Slice 9a — quiet synthetic fan engagement | Later, and **optional** rather than the road ahead — see the note below | 6, 6b, 8, 8f-2, 8g |
| 11 | Slice 9c — persona-first named superfans and non-economic visible moments | Roleplay-first, compute-bounded follow-up | 9a |
| 12 | Slice 9d — opt-in real-character named fans | Planned later | 9c |
| 13 | Slice 9b — support points and visible economic events | Optional low-priority fun addition | 9a; defer if scope grows |
| 14 | Slice 9e — named-fan profiles and access-filtered history | Ambient identity follow-up | 9c; extended by 9d |
| 15 | Slice 11 — cross-mode integration | Blocked on product contract | manual/automatic posting paths |
| 16 | Slice 12 — creator projects/milestones | Last | Explicit prerequisites to be defined |

Order note: after Slice 8b the actual work ran 8c → 8d — UX consolidation rather than the
originally planned jump to fan simulation. That deviation is deliberate and is recorded
rather than reversed. Slices 8e and 8f continue it, and both precede 9a on purpose:
Slices 9a, 9b, and 9e depend on the settled `public | locked` model, so simplifying access
after the fan work would have meant writing those slices twice.

**The 9 band is optional, not the road ahead.** Slices 9a–9e and 12 simulate an audience
economy — invented fans, named superfans, support points, fan profiles, milestones — and
NoodleR has no economy for them to be an economy of. Coins exist as of 8f-2 and are charged,
but at a 999999 starting balance with no prices rendered, nothing is scarce and no user
reaches zero — so subscribing is still effectively free. They are scenery for scenery, and
every one of them spends provider budget on ambience. If coins are ever made scarce, revisit
this judgement; until then it stands. What actually carries the product is watching (the 8 band's audience surface) and
being addressed (8g). They are listed but deliberately kept thin — see "The 9 band" below —
because a slice that may never ship should not carry a design that must be maintained.
Reassess after 8g is real.

## Product and UX principles

- Optimize for fun and roleplay payoff before simulation realism. A realistic system
  does not earn scope unless it makes the experience more enjoyable or controllable.
- A character-backed creator is still the user's real character behind a stage
  identity—an alter ego that may be open or concealed—not an unrelated synthetic
  actor. Keep source identity and stage presentation separate in data and policy.
- Ship sensible defaults so NoodleR works without configuration. Put optional
  switches, dials, and overrides behind the global/per-creator control plane for
  advanced users; define precedence before adding each override.
- Treat desktop and mobile as required surfaces, not separate follow-up products.
- Preserve multiple roleplay entry points without duplicating capability logic:
  creator-profile authoring in Slice 7, autonomous creator activity in Slice 8, and
  later chat/cross-mode bridges in Slice 11 all call typed application operations.

## Functional foundation — already merged, not a release candidate

Slices 1A–6b already form a functional AI-guided NoodleR product:

1. Enable NoodleR.
2. Create a stage profile from an eligible persona or character.
3. Manually trigger a generated private post as any managed stage profile through
   the existing inline guided composer/profile selector.
4. Choose public, subscriber, or PPV access.
5. View the merged private feed as a selected viewer persona.
6. Subscribe, unlock, like, reply, and repost under server-side access rules.

This is a useful guided foundation, but it does not meet the agreed release threshold.
A release candidate must support roleplay autonomy: at minimum, required Slice 7's
authoring/profile shape plus toggleable per-character automatic posting and a user-
approved way to guide and control the experience in Slice 8.

### Stabilization gate — passed on the integrated branch, see the receipt below

Historical. No speculative product work belonged in this gate; it used the merged behavior
and fixed only reproduced blockers. Retained because the residual gap it names — an
isolated run of bare `origin/staging` — was never closed.

Required proof:

- Enable/disable NoodleR and confirm disabled routes/surfaces stay hidden.
- Create, edit, and delete a stage profile.
- Generate a public, subscriber, and PPV post from the existing guided composer.
- Switch viewer personas and verify hidden/subscriber/PPV access.
- Subscribe, unlock, like, reply, and repost; reload and confirm persisted results.
- Exercise desktop and mobile layouts, themes, loading, empty, disabled, and
  actionable error states.
- Confirm hinted/secret generated content and prompt data do not expose the linked
  public name/handle.

**Proof receipt (2026-07-23):** seeded desktop and mobile Playwright Chromium runs
passed on `noodl-split-7-roleplay-authoring` at `b2b9adc6`. They covered disabled
route/surface hiding; stage-profile create/edit/delete; public/subscriber/PPV guided
generation; viewer switching and hidden/subscriber/PPV access; subscribe, unlock,
like, reply, repost, and reload persistence; loading, empty, disabled, forced-error
retry, dark/light themes, and responsive bounds. A local OpenAI-compatible stub drove
the real server generation path, verified that hinted/secret provider requests did
not contain the linked public name/handle, deliberately returned those identifiers,
and confirmed stored title/body/image-prompt output removed them. Screenshots were
inspected after animations settled. No functional blocker was reproduced. Temporary
specs, data, screenshots, traces, and the local server were removed.

This is integrated branch proof, not an isolated run of bare `origin/staging`.
Therefore it strengthens Slice 7 readiness but does not, by itself, close the
historical claim that 6b alone passed before Slice 7 was applied. A real external
provider smoke remains separate from the deterministic local-provider proof.

**Follow-up gap (2026-07-23):** the proof exercised identity redaction with a
non-null `imagePrompt`, while its stub returned `poll: null`. It therefore did not
assert Slice 7's text-only output constraint. A real Guided run subsequently
reproduced one composite post containing a title, body, poll, and image prompt.
Static tracing confirmed that the inherited private generator asked for, validated,
persisted, and displayed those fields together. This did not invalidate the access,
persistence, responsive-layout, or identity-redaction results above. It was corrected
before #3969 merged: generation requests only title/body and defensively persists neither
poll nor image-prompt output.

Passing this gate proves the merged foundation and unblocks Slice 7. It does **not**
make 6b a release candidate.

## Release-candidate definition

NoodleR reaches release-candidate status only after all of the following are true:

1. The 6b stabilization/browser/reload proof passes.
2. Required Slice 7 roleplay authoring and creator-profile parity land.
3. Slice 8 provides text-only automatic posting that is independently toggleable per
   stage profile and safe to stop globally.
4. The user can guide and control autonomous behavior through an explicitly accepted
   control plane.

The currently specified minimum control-plane proposal is:

- existing global `enableNoodler` product kill switch;
- a dedicated NoodleR section in application settings for NoodleR-wide automation
  controls and defaults;
- a global automatic-schedule on/off control, rather than a separately named
  “pause all” feature;
- a global **Refresh NoodleR now** action over automation-enabled creators;
- per-stage-profile automatic-posting enable/disable;
- one rolling NoodleR reserve of pre-generated posts with fixed future publication times
  (Slice 8f; replaces per-creator cadence, per-creator next-run status, and startup
  catch-up);
- editable stage profile identity/personality as durable generation guidance;
- Slice 7's optional one-shot guide for user-triggered posts.

Creator-specific controls live on that creator's stage-profile page. Later fan
controls extend the same two-level information architecture: NoodleR-wide controls in
Settings and creator-specific controls on the creator page. They still use separate
typed capability leaves and server-owned timestamps; shared UI placement does not
permit one raw settings object or one shared schedule.

Slice 8 originally defaulted automatic posts to `subscriber` and excluded automatic PPV
posts and currency. The current default is `locked`; coins now exist under the 8f-2 hidden
balance contract, and automatic posting still does not create a distinct higher access tier.

Quiet time constrains future publication planning for creators without a weekly schedule
of their own and is asked once in the Slice 8f wizard. It is not a per-creator field.
Character schedules and night quiet decide whether a creator is plausible at a proposed
future publication time; they do not create another clock.

“Automatic-post creative brief” would mean persistent per-creator instructions used
only for scheduled posts, for example “focus on backstage updates; avoid spoilers.”
This is distinct from stage identity/personality and from Slice 7's one-shot guide.
It would also differ from a project: a project ends after its configured post count,
while this text would affect every future automatic post until edited or cleared.
Product direction rejected this extra layer. Do not add it. Stage identity/personality owns
durable character direction, Guide owns one post, and Project owns the next bounded
sequence of posts.

## Authoring terminology

“Manual” can describe three different behaviors:

- **The user manually triggers AI generation from direction text.** This already
  exists on merged staging.
- **The user triggers AI generation without a guide.** The server contract already
  permits an omitted `noodlerPostGuide`, but the merged composer at that point required
  non-empty direction text. Slice 7 must expose this as the normal unguided path and
  make guidance optional.
- **The user's literal text is published without an LLM.** This does not exist on
  staging or on the reference `noodl-split-7-post-as-character` branch. Product
  direction explicitly selected this behavior for Slice 7: **Post** publishes the draft literally, while
  **Guide** sends the current draft through the existing NoodleR generation pipeline.

Literal authoring therefore landed in Slice 7 through a strict NoodleR-post input,
stage-profile author scope, existing access choices, one server operation, and one
client mutation. It does not need images, scheduling, fan activity, or a separate
generation path.

## Disposition of current unmerged branches

### Reference post-as branch — discard as one integration unit

`origin/noodl-split-7-post-as-character` bundles a large profile-page expansion, a
small per-profile guided-composer placement, private generated images, a public-profile
onboarding shortcut, cache/author-selection fixes, and removal of
`GuidedPostModal`.

Do not merge the branch as one integration unit. Rebuild the required Slice 7
behavior from fresh `origin/staging`, preserving the merged access and generation
contracts:

- Every managed stage profile needs a Noodle-parity creator profile page.
- Every stage-profile page needs an unobtrusive collapsed composer so any managed
  creator can be roleplayed directly from their page.
- Normal generation does not require direction text. **Guide** is an explicit button
  that uses the current composer draft. **Post** publishes the draft literally.
- Add an optional title to NoodleR posts end to end. A blank title is absent; unlocked
  posts display it above the body, while locked subscriber/PPV projections hide it
  with the body so it cannot leak protected content.
- Remove the main-timeline stage-profile picker. Its author is the stage profile
  linked to the currently selected Noodle persona; never silently fall back to the
  first managed stage profile.
- Add an unobtrusive create-stage-profile action to eligible public Noodle profiles
  when NoodleR is enabled. This may be a later Slice 7 follow-up, but is not optional.
- Reproduce and fix cache issues independently if they exist on staging.
- Keep image generation/selection, user attachments, polls, and modal deletion
  outside the required core. Product direction confirmed those media capabilities come
  later.

### Local fan-activity branch — park as prior art

Do not merge the current fan branch merely because it is implemented and validated.
It is a high-complexity automation tranche, not an MVP prerequisite, and its global
public-random-user actor model conflicts with the revised per-creator synthetic-fan
direction.

Retain it only as evidence for access rechecks, bounded model output, transactional
generated-audience commands, cadence/claim behavior, account locking, and shutdown.
Reassess or reimplement after fan identity and economics are approved.

## Slice 7 — Roleplay authoring and creator-profile parity

**Goal:** every managed creator has a real profile and can be roleplayed from that
profile through literal posting or optional AI guidance. Main-timeline authorship
follows the user's selected persona instead of a second local picker.

**Depends on:** merged Slices 4, 5, 6, and 6b plus the stabilization proof. The old fan
branch is unrelated prior art. The reference branch is behavior reference only.

**Implementation status: merged through PR #3969.** The section below is retained as the
shipped contract. It shipped the title/body-only Guided correction and the unified
creator-profile layout described below, with focused lint/type checks, the client
production build, `regression:noodle`, `regression:prompt`, and seeded desktop/mobile
Playwright verification of the unified layout and subscriber-list contract.

**Unified-profile proof receipt (2026-07-23):** a seeded Playwright Chromium pass
opened a managed profile as its linked persona and as a different viewer persona.
It confirmed one profile/feed surface; the decorative fallback banner; coexisting
Subscribe, Edit Profile, Access, and Delete controls; the collapsed per-profile
composer above Posts/Media/Subscribers; subscriber empty and populated states; and
desktop/mobile responsive bounds with no horizontal overflow. A subscribe action
updated the count and list immediately, survived a page reload through the new
subscriber endpoint, and was then undone so seeded state was restored. The Access
dialog opened without changing policy. The mobile empty-state spacing was tightened
after visual inspection so its primary message clears the fixed bottom navigation.
No temporary browser artifacts remain.

### Commit 1 — Private post contracts, operations, and deterministic author identity

- Put connection resolution, per-stage-profile operation locking, and
  `generateNoodlerPost()` behind one typed application operation used by every
  authoring entry point. Preserve Slice 6 access/interaction policy; authoring does
  not grant viewing or interaction access.
- Add a separate typed manual NoodleR-post command. **Post** stores the normalized
  optional title and body literally with `source: "manual"`; it never disguises user
  text as `noodlerPostGuide` or invokes the provider.
- Treat `noodlerPostGuide` as optional end to end. Omit it for unguided generation;
  do not send an empty-string pseudo-guide or create a parallel generation path.
- Add `title: string | null` as a first-class NoodleR-post field across storage,
  shared post/view DTOs, generated NoodleR-post output, NoodleR create/update
  validation, and post-card presentation. Keep public Noodle create/update inputs
  unchanged; public posts have no title.
- **Guide** submits the current title/body draft as one-shot guidance through the
  generated-post operation and persists the generated optional title/body result.
  Apply disclosure/identity protection to both generated title and body.
- If Guide is invoked with no title/body direction, omit `noodlerPostGuide` and perform
  ordinary unguided generation; never send an empty-string pseudo-guide.
- Normalize a whitespace-only title to `null` and use one shared bounded title limit.
  Legacy rows project `null`. Locked subscriber/PPV views return `title: null`.
- Remove the main-timeline stage-profile picker.
- Resolve main-timeline author identity as:
  selected Noodle persona -> its public Noodle account -> the stage profile whose
  `publicAccountId` links to that account.
- If the selected persona has no linked stage profile, never fall back to another
  creator. Show a disabled/empty authoring state with a route into stage-profile
  creation; preserve the selected viewer persona.
- In the shared sidebar persona picker, show an accessible NoodleR badge for personas
  that have a linked stage profile. The badge is a visibility affordance, not a
  second author picker or a fallback-author rule.

### Commit 2 — Noodle-parity stage-profile page and per-profile composer

- Add a navigable creator-profile view for every managed stage profile, including
  character-backed profiles. Reuse Noodle's real profile, post-card, composer-shell,
  and responsive primitives; do not build a parallel approximation.
- Show that creator's profile information and posts using private projections and
  existing access filtering.
- Add a collapsed, unobtrusive composer on the page. It always authors as the viewed
  managed stage profile and expands to the full NoodleR composer.
- Use one unified profile surface, not separate viewer and management modes. The
  selected viewer persona still determines subscribe, unlock, like, reply, repost,
  and access-filtered post presentation, while human-controller actions for the
  managed creator coexist visibly in the same header and post list.
- Show Subscribe/Subscribed for the selected viewer alongside Edit Profile, Access,
  and Delete for the human-controlled creator. Keep the axes distinct in behavior
  even though they share one page: creator controls must not grant the selected
  viewer access or interaction rights.
- Render one post list only. Accessible posts may expose both viewer interactions
  and creator edit/delete actions. Inaccessible posts remain locked for the selected
  viewer, while an explicit controller edit/delete action may reveal the owned
  content only inside that management action. Do not duplicate the feed or render an
  unexplained “Creator controls” accordion.
- Keep the selected persona's linked stage profile reachable through the shared
  Profile navigation even though self-interaction rules exclude that creator from
  the viewer feed. When the feed has no other visible creators, link its empty state
  directly to the owned profile instead of implying that the profile disappeared.
- Keep the collapsed “Post as this creator” composer directly below the profile
  header. The collapsed row is text-first without an avatar; the expanded composer
  retains the creator avatar, optional title, and body, with its collapse control in
  the top-left header and a clearly icon-labeled Post action. It always targets the
  viewed stage profile without changing the selected viewer persona.
- Use Posts, Media, and Subscribers tabs. Subscribers shows the current subscriber
  count and opens the subscriber list; no additional audience-privacy model is
  required for this slice.
- Give the profile header a plain solid-color fallback banner now. Persisted
  user-selected cover media is desired but belongs with later media/upload plumbing.
- Treat reference/mockup post authors and content as illustrative only; a creator
  profile lists that creator's posts, not unrelated mockup authors.
- Default to generation without forcing a separate guided mode. Guidance is an
  explicit button/action that uses the composer's current draft as input; it is not a
  required gate before every post. Existing access/PPV controls remain available.
- The composer exposes optional **Title** and body fields. **Post** publishes both
  literally; **Guide** transforms the current draft through the private generator.
  Labels, loading state, and failure copy must keep those outcomes unambiguous.
- Image generation/selection, user attachments, and polls belong to later slices.
  Their parity icons may remain visibly disabled before the capabilities land, but
  must not activate existing backend scaffolding or silently generate output.

### Commit 3 — Create from an eligible public Noodle profile

- When NoodleR is enabled and the public persona/character has no linked stage
  profile, show a small, unobtrusive create-stage-profile action on its Noodle profile.
- Route into the existing typed creation flow with the source account preselected.
- Hide or replace the action when a stage profile already exists; never create a
  second NoodleR account for the same `noodleAccountId`.
- This commit may land as a later Slice 7 follow-up, but the capability is required
  and remains tracked until merged.

### Slice 7 proof and non-scope

- Prove selected-persona author resolution, linked-profile badge state, no-profile
  behavior, every managed stage-profile page, literal Post and optional Guide,
  optional title create/edit/remove/display, access choices, failure draft retention,
  cache invalidation, reload persistence, mobile layout, and identity-leak protection.
- Prove locked subscriber/PPV posts hide both title and body, public Noodle APIs do
  not accept titles, and legacy/titleless posts remain valid.
- Confirm authoring as a profile does not bypass hidden/subscriber/PPV/self-action
  rules for the selected viewer persona.
- Do not add automatic posting, fan activity, image generation/selection, user
  attachments, or polls.
- **Provisional output contract pending maintainer confirmation:** title and body are
  the default core of every generated post. Poll and generated-image output are
  optional enrichments and must be explicitly enabled for that individual Guide
  request; absent an enabled request capability, both outputs must be `null` and
  must not be persisted. Do not introduce persistent defaults or infer whether these
  request-scoped toggles land in Slice 7 until the maintainer confirms their timing.
- **Reproduced blocker, fixed in #3969:** the inherited private-generation contract
  permitted a single Guided post to contain title, body, poll, and image prompt together
  without explicit selection. The shipped correction generates title/body only by default
  and suppresses poll/image output unless the request explicitly opts into those
  capabilities: it narrows both the prompt and the strict response format to title/body and
  writes `imagePrompt: null` with empty metadata even if a non-strict provider returns extra
  fields.

## Slice 8 — Text-only automatic creator posting

Implementation status: merged through PR #3984. The section below is retained as the
shipped contract.

**Amended by 8f-3.** Slice 8 shipped a per-creator cadence model (`intensity`, `nextRunAt`,
`noodle-autopost-cadence.ts`). 8f-3 replaces it with front-loaded generation into one
rolling private scheduled-post reserve; the per-account `enabled` flag survives. The
settings block and reserve/publication proof bullets below are therefore stated in their
**post-8f-3** form, marked where they differ from what shipped. Per-stage-profile
enable/disable is unchanged, so the release-candidate condition still holds.

**Goal:** make characters autonomously produce content while Marinara is running,
with per-character toggles and an accepted user control plane, using the same private-
generation pipeline as user-triggered posts.

**Depends on:** the merged Slice 7 creator-post application operation plus the
stabilization gate. It does not depend on the discarded reference-branch implementation
or on fan activity.

### Service boundary

The route ownership at Slice 8 kickoff included connection resolution and per-account
in-flight coordination around `generateNoodlerPost()`. Move that orchestration behind
capability-owned operations:

- HTTP guided generation uses an immediate-publish operation.
- Reserve preparation uses a prepare-for-later operation whose terminal write is the
  NoodleR-owned outbox rather than the ordinary post table.
- Both operations share `generateNoodlerPost()` as the capability-owned generation core
  and share policy, redaction, media, and typed-outcome logic; they do not duplicate the
  prompt pipeline.
- Schedulers never import routes or call `app.inject()`.
- Use one in-process operation lock per NoodleR account. Different creators remain
  independently runnable.
- Foreground and background model operations also share a narrow connection-scoped
  admission seam. Background work may start only after the configured connection has been
  foreground-idle for 30 seconds; an already-running call is never preempted.
- Revalidate mutable stage/disclosure policy after provider work before either immediate
  persistence or outbox persistence. Due publication revalidates again.

This is the extension seam later projects/chat commands may call; do not prebuild
those features.

### Settings and scheduling contract

Use one per-account model:

Slice 8 shipped a per-creator model (`intensity`, `nextRunAt`,
`noodle-autopost-cadence.ts`). Slice 8f replaces it with one NoodleR-wide reserve and
automatic attempt budget; the per-account enable flag survives:

```ts
interface NoodleAutoPostingSettings {
  enabled: boolean;
  imagesEnabled: boolean;
}

interface NoodleAccountSchedulerSettings {
  autoPosting?: NoodleAutoPostingSettings;
}

interface NoodlerCreatorPostScheduleSettings {
  enabled: boolean;
  postsPerDay: number; // integer, 1..24; default 4
}
```

- Default projection: disabled.
- `enableNoodler` remains the product kill switch. The separate automatic-schedule switch
  and `postsPerDay` are capability controls, not competing product enablement.
- The NoodleR Settings schedule toggle may disable automatic posting globally without
  disabling the NoodleR product. This is the schedule's enabled state, not a second
  “pause all” concept.
- `postsPerDay` is both the targeted maximum publication density and the automatic
  text-attempt ceiling across any rolling 24 hours. Failed potentially billable
  attempts count. Atomically persist an attempt claim before provider work; crashes and
  ambiguous outcomes keep the claim. A bounded rolling ledger and last-observed budget time
  prevent midnight, timezone, or backward-clock resets.
- Automatic image-provider attempts use the same claim mechanism with a separate kind and
  the same derived N ceiling, for at most 2N combined attempts; retries consume claims.
  With prompt review enabled, publication atomically closes pending or in-flight image work
  at `publishAt`, publishes text-only, and cleans any late result without attaching it.
- Maintain a NoodleR-owned 24-hour rolling reserve of validated prepared posts. Preparation is
  low priority and concurrency 1; active foreground provider work wins.
- Publication is a separate idempotent local transaction with no provider call. Startup
  materializes valid due items at their preassigned times and returns. Future preparation
  begins only through the normal post-start 30-second idle scheduler.
- Expected skips/provider failures leave reserve coverage incomplete and cannot hot-loop.
- Shutdown clears timers and awaits the active scheduler pass before storage closes.

Slice 8 first shipped text-only automatic posts with `subscriber` access. In the post-8f
state, automatic posts use `locked` by default and the already-merged Slice 8b generated-
image preference survives into prepared items. 8f-3 does not create a second image pipeline
or add a currency/access-default settings system.

### UI and proof

- Add a dedicated NoodleR section to application Settings for the global kill switch
  and approved global automation controls, including automatic schedule on/off and
  the confirmed Generate/Refresh-now scope.
- Put the per-profile automatic-posting toggle on that creator's Slice 7 profile page
  rather than hiding it only in the profile manager.
- Let the user inspect automatic attempts used in the last 24 hours and how far the NoodleR reserve
  currently reaches. The creator page may show its next prepared publication time.
  Individual recurring rescheduling is removed; the first reserve version is inspect-only.
- Define and prove automation precedence before adding a global default plus creator
  override. The global kill switch always wins; do not infer whether other automatic-
  posting fields are defaults, hard limits, or bulk actions.
- Make it plain which editable stage-profile fields guide every automatic post. Do
  not imply that Slice 7's one-shot guide controls future scheduled posts.
- Slice 7's per-creator composer already supplies single-creator generate-now. Slice
  8 adds a global **Refresh NoodleR now** over automation-enabled creators. Prioritize
  least-recently-active creators, then process the remaining enabled creators.
  Call the immediate-publish operation with bounded concurrency and per-creator typed
  outcomes; one creator's failure must not roll back successful creators.
- Each successful selected creator contributes one visible feed action/post so the
  manual refresh rewards the user immediately.
- Ad-hoc posting is not a second schedule. After a successful immediate post, discard any
  prepared item for that creator where
  `manualCreatedAt < publishAt <= manualCreatedAt + 60 minutes`; normal low-priority
  preparation may replace it later.
- Preserve mobile layout, themes, loading/disabled states, and actionable errors.
- Prove strict schema/default normalization and atomic config/timestamp updates.
- Use a temporary controlled-clock/provider proof for overlapping scheduler passes, same-account
  exclusion, different-account independence, provider failure, and shutdown.
- **8f-3 addition, not shipped in Slice 8:** controlled-clock/provider proof covers
  rolling-horizon preparation, atomic text/image attempt claims, connection-scoped
  foreground admission, due publication, startup-with-zero-provider-work, crash
  idempotence, pause/re-enable, source/policy/schedule/timezone invalidation, prompt-review
  expiry, the 60-minute manual boundary, private-media cleanup, and reserve exhaustion.
- Remove temporary proof artifacts before handoff.

**Explicit non-scope:** new image capabilities, user uploads, polls, fan actions, named
fans, support points/events, active/passive posting policy, automatic PPV, a separate
automatic-post creative brief, cross-mode publication, project implementation, and new
profile/navigation destinations. Existing Slice 8b private generated images must remain
safe through outbox ownership, publication, invalidation, and cleanup.

## Slice 8b — Access-protected generated creator images

**Goal:** add LLM-generated images to the established manual Guide and automatic-post
paths without mixing in user uploads or polls.

Follow public Noodle's proven orchestration shape rather than inventing another media
pipeline:

1. The private text generator proposes the existing optional `imagePrompt` alongside
   the post. Do not make a second text-model call just to decide whether to draw.
2. Apply NoodleR-owned enablement and a bounded per-run quota before image-provider
   work. Reuse the shared default image connection, image defaults, prompt compiler,
   retry helper, prompt-review setting, and reference-image mechanics; do not read
   public Noodle's enable flag or quota as NoodleR policy.
3. Compile the final image prompt from the private draft, stage-profile presentation,
   and permitted appearance references. Open/hinted/secret identity protection applies
   to image prompts and reference selection, not only post text.
4. Stage generated bytes before persistence. Revalidate creator/profile state, promote
   and commit media metadata with the post, and compensate staged files on failure.
5. If prompt review is enabled, persist a private pending prompt, claim it with the
   same renewable-lease pattern as public Noodle, and finalize it exactly once.
6. Image-provider failure leaves a valid text post with bounded failure metadata; it
   does not fail or retry the entire creator refresh indefinitely.

Private storage is the deliberate difference from public Noodle. Store generated files
in a NoodleR-owned private-media namespace and serve them through an access-checked
post-media endpoint. Never place secret/subscriber/PPV output in the public Noodle
gallery or a generally readable character gallery. Locked projections expose neither
the image URL nor prompt. Deleting a post/profile must clean up owned private media.

This slice enables the approved **image** output choice only when the full path above
exists. It does not add image upload, gallery attachment, polls, or a second posting
operation. Slice 10 still owns user-uploaded media and polls.

## Slice 8e — `private` → `noodler` rename

**Goal:** remove the last naming split between the internal `private` vocabulary and the
user-facing NoodleR product name, across code, stored data, and UI.

**Status:** merged through PR #4129 (2026-07-27), including
`packages/server/src/db/noodle-platform-migration.ts` and
`scripts/regressions/noodle-platform-migration.regression.ts`. The retired vocabulary is
recorded in "Terminology — `private` is retired" above; 8f-2's migration follows the
pattern this slice established.

Mechanical but wide. It renames services, storage helpers, operation locks, media paths,
shared types, and schemas, and migrates existing rows.

**Non-scope:** no behavior change whatsoever. Nothing about access, generation,
scheduling, or presentation may change under cover of the rename. Any behavior fix found
along the way belongs in its own change.

Sequence it before 8f: 8f edits many of the same files, and doing the mechanical rename
first avoids conflicts that teach nobody anything.

## Slice 8f — Access model, onboarding, and scheduling overhaul

**Goal:** collapse the Follow/Subscribe/PPV confusion into two profile levels and three
post states, give first-time users a working entry ramp instead of an empty NoodleR home,
and replace per-creator interval cadence with an inspectable reserve of posts generated
before their future publication times.

**Design detail:** [NoodleR Access Model and Onboarding Overhaul](./noodler-access-and-onboarding.md).
That document owns the design and its open questions; this section records only the slice
boundary.

In short: a profile has **Follow** (does this creator appear in my feed) and **Subscribe**
(may I read their locked posts); subscribing implies following. The feed's tabs become
Following and All creators. A post is **public**, **locked**, or **unlocked**, and carries
one **Unlock** button whose sheet offers "unlock this post" or "subscribe to unlock
everything", without prices. `access` collapses to `public | locked`; `ppvPrice` and
`subscriptionIncludesPpv` are removed. Onboarding gets one wizard at two densities —
Simple is the same wizard with defaults applied and collapsed, and each Simple line
expands its advanced control in place, so Advanced is a click rather than a separate mode
or a separate code path. Scheduling front-loads provider work into a private 24-hour
reserve, then publishes prepared items locally at their fixed times. The ordinary feed
shows ordinary chronological posts, with no absence recap or startup-generated history.

**Non-scope:** no *visible* prices or balance, no top-up/purchase path, no earning path, and
no fan activity; no new settings surface — the wizard is an on-ramp onto the existing
two-level control plane, not a third place where settings live. Coins themselves are in
scope: a balance field defaulting to 999999, charged 1 on unlock and 5 on subscribe, with
nothing rendered.

### 8f ships as six units, not one slice

Access collapse, scheduler rewrite, onboarding, the redaction fix, the watching surface,
and the source-drift notice share no code and no risk profile. Bundled, the watching work
is what gets cut when the slice runs long. Each unit below is independently shippable:

| Unit | Content | Depends on |
| --- | --- | --- |
| 8f-1 | Widen `PublicIdentity` to the union of stored **and** live source identifiers, fixing both `protectNoodlerGeneratedIdentity()` (the redactor) and `stageProfileContainsPublicIdentity()` (the validator, which is equally blind); regression covers rename-then-redraft for `hinted` and `secret`, and asserts `open` still shows the identity | nothing |
| 8f-2 | `access` → `public \| locked`, remove `ppvPrice`/`subscriptionIncludesPpv`, Unlock sheet, Following/All tabs, forward-only fail-closed migration, and a hidden coin balance (default 999999) charged 1 by `unlockPost` and 5 by `subscribe`. Also updates `noodle-prompt.regression.ts` and `noodle-settings.regression.ts`, which encode the deleted enum and break at compile time | 8e |
| 8f-3 | Front-loaded scheduled-post reserve: NoodleR-owned outbox, 24-hour rolling horizon, one rolling `postsPerDay` automatic-attempt ceiling, concurrency-1 low-priority preparation, idempotent due publication, policy invalidation, no startup generation or after-the-fact historical timestamps. Replaces the historical `noodle-autopost-scheduler.service.ts` poll loop (`MAX_CONCURRENT_AUTOPOSTS = 2`), deletes `noodle-autopost-cadence.ts`/`intensity`/`nextRunAt`, and repoints `app.ts:42` plus the `nextAutoPostRunAt` import at `noodle.storage.ts:56` | 8f-2 |
| 8f-4 | Four-step wizard at two densities, emulated Professor Mari teaching post in step 1, character pre-check threshold 8, recognition-test disclosure copy | 8f-2, 8f-3, 8c |
| 8f-5 | New-since-last-visit divider plus entry-point counter (one stored timestamp per viewer persona) | 8f-2 |
| 8f-6 | Creator-page operator area containing the composer, automation controls, and source-change handling: field snapshot and compare, adopt name/handle (`open` only), re-draft, dismiss, and the source-missing relink/delete variant | nothing beyond 8f-1 |

8f-1 is a disclosure-guarantee defect, not a design change. It must not wait on a
scheduling rewrite to ship. 8g needs only 8f-2's settled access model, so it sequences
ahead of 8f-3/4/5/6 rather than behind all of 8f.

### Implementation status — 8f-5 and 8f-6 remain

**As of 2026-07-31, four of the six units plus 8g are implemented on branch
`big-chungus-1` and unmerged: 8f-1, 8f-2, 8f-3, 8f-4, 8g.** `pnpm check`,
`pnpm regression:noodle`, `pnpm regression:localization`, and `pnpm version:check` pass on
that branch. Browser proof has not been run.

**Remaining: 8f-5** (new-since-last-visit divider and entry-point counter) and **8f-6**
(creator-page operator area, including source-changed / source-missing notices). Neither has
any code on the branch — no `lastVisit`-style field exists in
`packages/shared/src/types/noodle.ts`, and no source-snapshot compare exists.

The six units were specified to ship independently; in practice five landed on one branch.
That is recorded rather than reversed, but it makes the branch a large review unit — see
"Splitting `big-chungus-1` for review" below.

Two items remain recorded as non-blocking rather than dropped: a comprehension check on the
`hinted` disclosure wording, and real paid/local provider runs to tune `postsPerDay` away
from 4.

### Splitting `big-chungus-1` for review

The committed branch diff against `origin/staging` is 8,524 insertions and 4,799 deletions
across 97 files. Unrelated unstaged code changes are present in the worktree; they are not
part of this plan update or the committed branch count. 8f-1 is separable and worth
extracting as
its own PR: it is a live disclosure-guarantee fix with a standalone regression, and it should
not sit behind review of a scheduler rewrite. 8f-2/8f-3/8f-4/8g touch overlapping storage,
schema, and settings surfaces and are expensive to unpick after the fact, so they are
reviewable as one integrated PR.

Before implementation on any unit, per `CONTRIBUTING.md` and `CLAUDE.md`: confirm or open a
GitHub issue, check for an existing issue-linked branch or PR so two agents do not duplicate
the work, open a draft PR immediately so the board shows it in progress, and identify the
owner on the issue.

## Slice 8g — Creators reply to the viewer

**Goal:** let a creator respond, in their stage persona, to the interactions a real viewer
leaves on their posts.

Viewer interactions are already stored through `POST /noodler/posts/:id/interactions`, but
no generation path consumes them. The generation service has no notion of replies at all;
it produces posts and nothing else. So today the feed is a one-way street: you can comment
on your own character's post and she never answers.

For a product whose stated purpose is exposing sides of a character that ordinary
conversation does not, this is the missing centre. It is the one moment where the figure
addresses the user directly from a role the chat does not show. It ranks above synthetic
fan ambience: Slices 9a–9e invest heavily in making *invented* fans talk, while the
*real* user is never spoken to.

Sequenced after **8f-2** — the settled access and interaction model is all it needs — and
before 9a, because it reuses interaction plumbing that fan work would otherwise build first
with a different shape. It needs nothing from 8f-3/4/5/6, so it does not wait behind them.
Nothing in 8f depends on it either: 8f ships without a reply path.

**Cost requirement, to be designed with the slice, not after it.** The trigger is the user,
so the load is unbounded by construction: ten comments would mean ten provider calls. 8g
needs a stated daily reply ceiling in the same spirit as the posting plan's
refreshes × creators-per-refresh, rather than one call per interaction. This is the third
generation path in NoodleR after posts and images, and the only one whose rate a user can
drive directly.

**Non-scope:** synthetic fans, named fans, economics. Disclosure and access policy apply
to replies exactly as they do to posts.

## The 9 band — audience simulation, specified thin on purpose

**These may never be built.** They simulate an audience economy for a product that does not
yet have one: coins are charged as of 8f-2, but a 999999 starting balance and hidden prices
mean nothing is scarce and subscribing stays effectively free. Every one of them spends
provider budget on ambience. What carries the product is watching (the 8 band) and being addressed (8g). Kept
listed so the ideas are not lost, deliberately not specified in depth — a slice that may
never ship should not carry a design that must be maintained. Reassess after 8g is real.
If one is picked up, it gets its own detail document then.

**9a — quiet synthetic fan engagement.** Creator-scoped synthetic fans leave access-valid
likes/replies/reposts on posts they may actually view. One LLM call may propose engagement;
deterministic quotas, target validation, deduplication and anti-spam apply afterward.
Access is gated before target selection and again transactionally before persistence. A
fan-identity provider seam is introduced even if the first provider is synthetic-only. Fan
activity gets its own platform day plan and its own `scheduler.fanActivity` leaf; shared
scheduler construction never means shared schedule state. Fan controls extend the existing
two levels — NoodleR Settings and the creator page — with a configurable audience-archetype
mix rather than one generic fan mass.

**9c — named superfans and visible moments.** Persistent named synthetic superfans with
personality and relationship continuity, plus non-economic visible moments. Generate a fan
once and persist it; derive moments deterministically from persisted engagement; apply a
quota before any optional LLM work. Neither 9a nor 9c may scale provider calls linearly
with library size. Default eligibility is persona-backed creators; character-backed
creators may opt in explicitly, off by default. Recommended first moments: **Superfan
formed** and **Post taking off**, as compact feed and profile activity cards on
conservative deterministic thresholds.

**9d — opt-in real-character named fans.** Swap the named-fan provider to optionally borrow
approved character identity: opt-in per character, read-only name/avatar/persona flavor, no
writeback into chat, memory, relationship, or state. Creator eligibility (9c) and fan
identity sourcing (9d) are separate axes.

**9e — named-fan profiles and access-filtered history.** Durable faux profiles only for
identity-continuity actors (9c superfans, 9d borrowed fans, later promotions). Stable
name/handle, deterministic local avatar, short bio, creator-scoped "following since",
and activity filtered through the current viewer's post-access projection — a locked post's
title, body, image, prompt, or **existence** must never leak through profile history. The
anonymous fan mass gets no account row, route, or follower graph: aggregate counts and
ambient phrases, with an event-local display snapshot when an anonymous reply needs an
author. No image-provider call per fan avatar.

**9b — support points and visible economic events.** Low priority; defer if scope grows.
Points are a score, not currency: no spendable balance, ledger, reversals, tiers, or
cash-like claims. Two idempotent state-transition events: **Joined the inner circle**
(+10, first subscription) and **Unlocked a post** (+5, once per fan/post pair). Wording may
adapt to the creator's theme; stored event kinds and weights stay stable. Access-changing
actions commit before later interactions in the same generated batch, and all targets are
revalidated transactionally.

## Slice 10 — Composer media parity

Implementation status: merged through PR #3981. `pnpm check`, the Noodle regression
suite, the installer-artifact guard, and a focused upload/access/persistence/deletion
proof passed. The section below is retained as the shipped contract.

**Amended by 8f-2.** Slice 10 shipped before the access collapse, so its contract below
still says Post and Guide carry "PPV values". Under 8f-2 there is no `ppvPrice` and
`access` is `public | locked`: the composer's PPV price field and the PPV access option
are removed, and Guide preserves image, poll, and the two-state access as before. This is
the only place merged Slice 10 behavior changes; everything else in the section stands.

Add one user-uploaded image and one optional two-to-four-option poll through real
schema, private storage, mutation, projection, voting, and cleanup plumbing. Enable
the existing disabled composer controls only after those paths work. The title remains
optional; an image or poll may stand alone without a body. A user may deliberately add
either attachment or both to one post.

Literal **Post** publishes the user's title, body, image, poll, access, and PPV values.
**Guide** may change title/body text only and must preserve the selected image, poll,
access level, and PPV price. The private text model remains title/body-only; this slice
must not re-enable generated image prompts or generated polls.

Uploaded bytes use Slice 8b's post-owned NoodleR private-media namespace, never the
public Noodle/global gallery. A draft keeps its local file or source URL in the client;
the Post, Guide, or edit request promotes the bytes and persists the post's serving URL
and `metadata.privateMediaPath` together. Replacement promotes the new file before the
post update, removes the old file only after that update succeeds, and compensates the
new file on failure. This deliberately avoids a second unattached-asset table, claim
lifecycle, and stale-draft cleanup job. Locked projections expose neither image URLs
nor poll metadata. Media delivery repeats the viewer access check, and poll voting
uses the existing viewer-persona access and creator self-interaction gates.

User-uploaded media remains distinct from Slice 8b's LLM-generated private images at
the authoring boundary, while sharing its post-owned storage and serving contract.
Slice 10 does not reopen Slice 8b's generation, disclosure, or prompt-review contract.

## Slice 11 — Cross-mode integration

Global persona, slash commands, and roleplay/chat posting may create NoodleR posts
through the typed NoodleR-post operation. NoodleR posts never mirror, leak, or appear
on the public Noodle timeline. A NoodleR post with `access: "public"` means free to view
inside NoodleR; it does not become a public-Noodle post.

The controller can explicitly choose Free/Public for an individual manual, Guided, or
project-planned NoodleR post through the existing access input. Automatic posts remain
`locked` by default and must not silently widen access. If public-Noodle posting is
ever desired, it is a separate explicit action through Noodle's own posting operation,
with no shared post identity or automatic mirroring.

Before kickoff, approve the remaining cross-mode contract:

- source actor and mode;
- identity/disclosure/access behavior;
- manual versus command-triggered origin;
- idempotency and failure behavior;
- affected query keys and navigation surfaces.

Implement cross-mode behavior in an explicit bridge service that depends on typed
public/private operations. Do not hide it inside either generation service.

Character-backed stage profiles may later opt into context from their source character
through two independent settings in that creator's profile editor: **Use character
lorebook for post ideas** and **Use character schedule for post ideas**. Both are off
by default, only appear for linked character-backed creators, and read the enabled
source live when generation begins. Explain beside the toggles that NoodleR reads the
current source context without copying it or writing back to the character.

Keep this behind one context-provider/adapter boundary, not direct reads scattered
through generation. Lorebook and schedule context are supplementary; stage-profile
identity/personality and an explicit one-shot Guide are more specific instructions,
while safety and access policy always win. Do not add a global enable-all toggle.

Timing note, narrowed by Slice 8f: a source-character schedule primarily guides content,
what the character may be doing, and it additionally makes a sleeping or busy character
ineligible for a proposed future publication time. It never owns a clock and never
determines how often a creator posts. The reserve planner remains the sole publication
authority.

## Slice 12 — Creator projects and milestones

Keep last. A project is one creator's bounded, editable content arc—not another posting
scheduler. The first version supports one active project per creator plus drafts and
archives. It stores a name, user-editable brief/behavior guidance, target generated-post
count from 1–20 (default 5), remaining count, status (`draft`, `active`, `paused`,
`completed`, `archived`), and an optional editable list of planned post beats.

For example, activating **Bunnies and Books** for five posts makes the next five
successful generated posts for that creator follow the brief or consume the next
planned beat. The user can edit the brief/beats, change the remaining count, pause,
resume, or end the project. A failed/skipped generation does not consume a beat. A
literal manual post does not consume the project unless the controller explicitly
attaches it to the project.

The reserve planner remains the only publication clock. An active project supplies content
context through the shared NoodleR-post generation core when the prepare-for-later
operation or an explicit Guide runs; it owns no schedule state, polling loop, or route
self-call. When the
source-character schedule-context toggle is enabled, the current schedule may inform what
a project post depicts, but never when it is published. Because generation now precedes
publication, reserve a project beat with the outbox item and finalize it when that item
publishes; discarding the item releases the reservation.

The `noooooods` project implementation is reference-only and materially overstates
this contract: do not port its `startsAt`/`endsAt`, milestone `dueAt`/`notBefore`,
minimum-spacing scheduler, or scheduler-to-route `app.inject()` orchestration. Reuse
only useful project presentation ideas after mapping them to this bounded post sequence.

Projects may request only output capabilities already shipped and must call their
existing operations; they do not own another image, poll, or attachment pipeline.
The current product answer does not settle the project-level media preference/UI, so exact media
defaults and per-beat media controls remain open rather than inferred.

## Architecture rules for every later slice

- Noodle and NoodleR remain two capabilities on one social-data substrate.
- Share contracts, storage invariants, narrow pure helpers, provider mechanics,
  operation locks, scheduling infrastructure, and capability-based presentation.
- Keep public refresh, NoodleR generation, automatic posting, fan engagement,
  economics, projects, prompts, projections, and schedule state separate when their
  actors, access, output, or persistence policy differs.
- Routes are HTTP adapters. Schedulers/projects/commands call application services,
  never routes or internal HTTP.
- Provider/media work stays outside database transactions. Revalidate mutable policy
  before commit.
- Authoring identity and viewer/access identity are separate axes.
- Visibility and disclosure are enforced by server/storage policy, not prompts or
  hidden UI alone.
- Do not widen persona-facing commands for generated actors.
- No bulk module reorganization. Improve only seams touched by the active slice.

## Standing workflow and validation rules

- Branch fresh from freshly fetched `origin/staging`; `noooooods` and parked branches
  are reference-only.
- One logical change per PR. Separate pure moves/refactors from behavior changes.
- One writer per slice; use separate worktrees for independent concurrent slices.
- The ~500 LOC / 8 file guideline is a warning, not a cap. Never weaken correctness
  or types to stay under it.
- During implementation, use focused checks such as server/client lint,
  `pnpm regression:noodle`, `pnpm regression:prompt`, or the smallest matching proof.
- Before shipping or marking ready, run `pnpm check` with at least a 300-second
  timeout and `pnpm guard:installer-artifacts`; add `pnpm version:check` when version
  or release references change. Run relevant browser smoke/manual proof for UI work.
- Do not claim browser/manual checks that did not run. The human contributor performs the real pass
  when the environment cannot.
- Update code-coupled docs and changelog in the same PR as behavior.
- Confirm/open a GitHub issue before implementation.
- No AI/bot attribution. Stage files intentionally.
- PR descriptions open with the slice/capability, prior merged foundation, rationale,
  and explicit non-scope. Leave human validation boxes unchecked.

## Decision log

- This living plan supersedes the tracked repository v2 plan for future work.
- NoodleR's north star is a standalone 18+ adult creator-platform simulation for
  interacting with personas and characters through stage identities, analogous to
  Noodle's Twitter-like simulation.
- Slice 6b is the functional AI-guided foundation, not the release candidate.
- Slice 7 is required roleplay authoring/profile parity. The reference post-as branch is discarded only as an integration unit; its approved core behavior is rebuilt from
  fresh staging.
- The main-timeline stage-profile picker is removed. Authoring maps the selected
  Noodle persona to its linked stage profile and never falls back to another creator.
- Per-profile generation does not require direction text; **Guide** is a draft-aware
  button/action rather than a required mode.
- Public-profile stage creation is required but may be a later Slice 7 follow-up.
- The local fan branch is parked as prior art and is not a prerequisite.
- Automatic posting is the next autonomous capability and is text-only first.
- Fan work is roleplay-first: quiet synthetic engagement, named/moment behavior, then
  opt-in real-character identity sourcing. Support points/events are an optional
  low-priority later addition.
- Shared scheduler infrastructure does not mean shared schedule state.
- Release-candidate status requires Slice 7, toggleable Slice 8 auto-posting, and an
  explicitly accepted user guidance/control plane.
- NoodleR controls use two levels: a global NoodleR Settings section and per-creator
  controls on creator pages. Capability state remains independently typed.
- Slice 8 originally defaulted automatic/manual-refresh posts to `subscriber` and excluded
  automatic PPV and currency. Slice 8f-2 replaced that enum with `public | locked` and added
  hidden coin charging; automatic posts now default to `locked`.
- After Slice 8b the work deviated from the planned jump to fan simulation and ran
  8c → 8d instead, consolidating bulk creation, the control plane, and the NoodleR UI.
  The deviation is accepted and recorded. Slices 8e and 8f continue that consolidation.
- New work is numbered inside the 8 band (8e, 8f) rather than renumbering the 9 band.
  9a–9e are referenced throughout this file and in merged PR descriptions; reusing those
  labels would silently repoint existing references. The 8 band means platform
  coherence, the 9 band means audience simulation.
- Slice 8e is a pure rename of `private` to `noodler` across code, data, and UI, with no
  behavior change, sequenced before 8f because both touch the same files.
- Slice 8f collapses post access to `public | locked`, removes `ppvPrice` and Slice 6's
  `subscriptionIncludesPpv`, and gives every locked post one Unlock control offering
  either that post or a subscription.
- **Access migration fails closed.** The stored-post normalizer currently falls back to
  `public` for any unrecognized access value (`noodle.storage.ts:510`), so collapsing the
  type before migrating the rows would make every locked post world-readable — the failure
  Slice 9e prohibits, arriving through a default rather than a leak. The data step runs
  first, and the new normalizer maps unknown → `locked`. Settings removals need no data step:
  the settings normalizer rebuilds field by field, so a field it stops reading disappears.
- The collapse reveals content in exactly one case, accepted deliberately: a subscriber to a
  creator with `subscriptionIncludesPpv` off could not see that creator's `ppv` posts and now
  can. Nobody loses access, nothing was paid for, and the subscriber is the owner. Forward-only.
- **Coins exist and are charged; prices stay hidden in 8f** (decided 2026-07-29, replacing
  the earlier no-prices-ever rule). Unlock costs **1 coin**, Subscribe costs **5 coins**, and
  every user starts at **999999**. The balance is decremented for real, but no price or
  balance is rendered, so Unlock options still read as distinguished by reach rather than
  price. `unlockPost` and `subscribe` are the only two mutation points that touch a balance.
  With a 999999 start nothing is gated in practice — this buys the data model now so that
  revealing prices later is a UI and balance change, not a schema migration through the
  access path. The prior framing rested on Slice 9b, which sits in the may-never-ship band.
- **Coins and support points are different numbers.** Slice 9b's support points remain a
  non-spendable score and never become currency; coins are the spendable axis. Do not merge
  them.
- **The coin balance is a settings leaf on the viewer persona, not a table or a ledger.**
  It lives on the viewer's Noodle persona account settings, which the normalizer already
  rebuilds field by field, so it needs no data migration and existing users pick up 999999 on
  first read. An absent or corrupt value normalizes to the default, never to zero. `subscribe`
  and `unlockPost` are already single transactions that early-return on an existing row, so
  the debit goes on the insert path only and idempotency comes free — re-subscribing cannot
  double-charge. Insufficient balance reuses each function's existing `null` return rather
  than adding a failure channel. No ledger, history, or reversals until coins are scarce
  enough that a user needs to ask where theirs went.
- Slice 8f's onboarding is one wizard at two densities, not two wizards. Simple is the
  same flow with defaults applied and collapsed; each Simple line expands its advanced
  control in place. The wizard is an on-ramp onto the existing two-level control plane
  and never becomes a third home for settings.
- **The wizard pre-checks at most 8 characters** (decided 2026-07-29). One Continue click
  costs one provider call per checked character, so the threshold bounds a first run at 8
  text calls; "select all" above it is an explicit act. Eight still fills a feed, and matches
  the Simple-mode summary line's own example.
- **Disclosure uses recognition-test copy** (decided 2026-07-29): "A friend scrolling past
  would recognise them instantly" / "might do a double-take" / "would never guess", mapping
  to `open`/`hinted`/`secret`. The earlier draft described the mechanism, which has no
  referent for a user who has not yet seen a stage profile. `hinted` is the one most likely
  to be misread; a comprehension check on a real person before 8f-4 ships is still worth
  doing, but no longer blocks the unit.
- There is no tutorial overlay or coach-mark tour, and no separate tutorial screen before
  the wizard. The wizard opens immediately after the age gate, and its first step carries
  the tutorial content inline (why creators appear, why posts are locked, that characters
  post on their own). Those concepts are taught through an **emulated, hand-written post
  from Professor Mari** rendered inside that step with the real post card, showing a locked
  example so the padlock explains itself. **Decided 2026-07-29:** it is a mock, not a seeded
  feed post. Mari has no NoodleR account — `allowProfessorMari` is a public-Noodle flag — so
  a real post would have required minting one for her and answering whether she is
  followable, subscribable, and deletable; and with no auto-follow it would have landed in an
  empty Following tab, invisible exactly when it should be read. Hand-written rather than
  generated because the first impression cannot tolerate a wobbly provider response.
- The NoodleR feed stays strictly chronological. No interest ranking: an order the user
  cannot predict is an order in which they quietly miss things.
- Slice 8f-6 keeps the creator page as one surface per Slice 7, but gathers operator controls
  into one delimited area rather than interleaving them with the audience view, so Subscribe
  and Delete no longer sit side by side as if they were the same kind of act.
- Follow means feed curation and Subscribe means access; subscribing implies following.
  The NoodleR feed's tabs become Following and All creators, and the Subscribed tab is
  dropped because a post's own lock already shows subscription state. Bulk creation does
  not auto-follow the creators it makes. **Decided:** Following is the tab the UI opens to
  by default; onboarding's completion step is the one exception, selecting All creators
  once because Following starts empty right after setup.
- **Subscribe-implies-follow does not contradict no-auto-follow** (decided 2026-07-29).
  Someone who subscribes wants the service delivered; a subscription that left the creator
  out of the feed would be a subscription to nothing. The rule no-auto-follow protects is
  that the *system* never follows on the user's behalf — bulk-creating 40 creators must not
  mint 40 follows. The Unlock sheet's Subscribe row states the follow in its label.
- **`postsPerDay` defaults to 4**, validated 1..24 (decided 2026-07-29). Deliberately low:
  it caps automatic load at 4 text plus at most 4 image attempts per rolling 24 hours and is
  raised on purpose rather than discovered through a bill. Real paid and local-model runs
  remain worth doing to tune it, but no longer gate 8f-3.
- Automatic posts stay locked by default, but generation may produce public teaser posts,
  and those are visible to non-followers in the All-creators tab. Discovery is the
  teaser's job; without it a new creator is only a wall of padlocks.
- Slice 8f replaces NoodleR's per-creator interval cadence with **front-loaded
  generation into a private scheduled-post reserve**. Provider work happens before the
  assigned publication time. Due publication is a local idempotent transition with no
  provider call.
- The reserve covers a rolling 24-hour horizon. Windowed time placement may reuse the
  narrow planning principle from public Noodle, but NoodleR does not reuse public
  refresh-state semantics or put unpublished content in the ordinary post table.
- **NoodleR generation stays one provider call per post.** `generateAndApplyNoodlerPost()`
  remains per account because disclosure, identity redaction, media policy, and operation
  locking differ per creator.
- **Daily automatic load has one user-set number and two explicit ceilings.**
  `postsPerDay = N` is the targeted maximum publication density and rolling text-attempt
  ceiling; when automatic images are enabled, the derived rolling image-attempt ceiling is
  also N, for at most 2N combined automatic provider attempts. Failed potentially billable
  attempts count. Text and image attempts are atomically claimed before provider work in
  separate ledger kinds; image retries consume the image ceiling rather than exceeding it.
- Preparation is low priority and concurrency 1. A connection-scoped admission lease starts
  it only after 30 foreground-idle seconds; an already-running call is never preempted.
- The capability-owned NoodleR outbox stores validated payload, creator, generated and
  publication times, private-media ownership, policy/source/schedule fingerprint, and lifecycle
  state. Publication atomically creates the ordinary post and marks the item published;
  a unique link makes restart reconciliation idempotent.
- **Revision of Slice 8's scheduling contract.** Per-stage-profile enable/disable survives,
  so the release-candidate condition still holds. Removed: `intensity`,
  `noodle-autopost-cadence.ts`, `noodle-autopost-scheduler.service.ts`'s poll-and-claim loop,
  per-creator `nextRunAt`, recurring rescheduling, startup catch-up, and
  generated-after-the-fact historical timestamps.
- Ad-hoc "post now" is not a second schedule. After a successful immediate post, discard
  prepared items for that creator where
  `manualCreatedAt < publishAt <= manualCreatedAt + 60 minutes`; normal preparation may
  replace them later. Future-dated user-authored posts remain out of scope.
- Startup publishes only valid due items that were already prepared with fixed times,
  discards invalid items, and returns. Future preparation starts only through the normal
  post-start idle scheduler. If an absence exceeds the reserve horizon, NoodleR goes quiet
  rather than creating a burst or invented history.
- **Narrowing of the Slice 11 rule, not a reversal:** character schedules and night quiet
  constrain which creator is plausible at a proposed future publication time and may guide
  that post's content. They never own a clock or determine frequency. If nobody is eligible,
  that time remains uncovered rather than becoming debt.
- Creator selection uses a NoodleR-specific least-recently-active ordering that also
  considers already prepared future items. Public Noodle's participant selector carries
  invitation, follow, random-user, and priority semantics that do not port.
- Prepared automatic posts are standalone snapshots. They cannot answer a future viewer
  interaction or depend on another unpublished post; Slice 8g replies remain reactive work
  generated from the interaction path.
- Schedule, night-quiet, timezone, source, stage, disclosure, access, and media-policy
  changes invalidate affected prepared items. With image prompt review enabled, an
  unapproved or still-running image expires at `publishAt` and the post publishes
  text-only; late image results are cleaned up and cannot mutate it.
- Roughly two thirds of real NoodleR use is watching rather than directing. The feed is
  therefore an audience surface with no operator controls; authoring lives on the
  creator's own page, continuing Slice 7's removal of the main-timeline picker.
- NoodleR gets a "new since your last visit" divider in the feed plus a counter on the
  NoodleR entry point. The divider needs one stored timestamp **per viewer persona**, not
  one per user and not per-post read
  state.
- **8f is six units, not five.** The source-changed/orphaned-creator notice and the creator
  page's delimited operator area ship together in 8f-6. 8f-5 is limited to the feed divider
  and entry-point counter.
- **Merged slices are amended in place with an explicit banner**, never rewritten silently.
  Slice 10 carries "Amended by 8f-2" and Slice 8 carries "Amended by 8f-3"; without one, the
  shipped contract becomes unrecoverable from this document.
- **Slice 8g is added between 8f and 9a:** creators reply to real viewer interactions.
  Interactions are already persisted but no generation path consumes them, so the feed is
  currently one-way. This outranks synthetic fan ambience because it is the moment the
  character addresses the user directly.
- A stage profile is a curated snapshot, not a mirror of its source character. Editing
  the character never changes the creator automatically. Instead the creator page carries
  one **source-changed** notice covering renames, appearance edits, and personality edits,
  offering to adopt name/handle (for `open` profiles only), re-draft the stage profile, or
  dismiss. Drift is detected by snapshotting exactly the card fields that feed the draft
  and image prompts, and comparing when the creator page is read.
- Orphaned creators — deleted characters, and profile imports that mint fresh character
  IDs — surface through the same notice in a "source missing" variant, offering explicit
  relink or delete. Relinking is never guessed from a matching name; guessing wrong would
  bind the wrong character to an 18+ stage profile.
- **Identity-protection defect to fix in 8f:** `protectNoodlerGeneratedIdentity()` redacts
  the stored account name and handle, while the stage-profile draft feeds the live
  character card including its current name. After a rename, a `hinted` or `secret` draft
  can therefore emit the new real name unredacted. Redaction must protect the current
  source identity as well as the stored snapshot, with a regression covering
  rename-then-redraft.
- **8f-1 fixes the identity, not the call sites.** `stageProfileContainsPublicIdentity()` —
  the validator gating drafts at `noodle-stage-profile-draft.service.ts:190` and
  `noodle.routes.ts:725,781,826` — reads the same stored-only `PublicIdentity` and is
  therefore equally blind; fixing only the redactor leaves the gate open. Widen the type to
  the union of stored and live source identifiers and both are fixed at once, rather than
  guarding seven call sites. The redactor already dedupes and sorts longest-first, so extra
  identifiers preserve correct overlapping-name behaviour for free. Scope stays identity
  only: appearance and personality drift are 8f-6's notice, not a redaction bug.
- NoodleR has schedule enable/disable, `postsPerDay`, rolling automatic-attempt usage, and reserve
  reach; it does not add a separate pause-all field. The first reserve version is
  inspect-only rather than individually reschedulable.
- Global **Refresh NoodleR now** runs automation-enabled creators, prioritizing those
  least recently active and then the remaining enabled creators. Slice 7's composer owns the
  single-creator path.
- Global fan policy values are defaults with per-creator overrides. Fan policy may
  shape the audience archetype mix, including ordinary, eccentric, cross-fandom,
  raider, organic-discovery, and non-adult/free-resource audiences. Slice 9 defines
  exact labels, weights, validation, and persistence without sharing auto-post state.
- Slice 9c permits explicit per-creator opt-in for selected character-backed creators;
  it is off by default. Persona-backed creators remain eligible by default.
- Character-backed creator profiles may independently opt into live source-character
  lorebook and schedule context for post ideas. Both default off; source schedules
  guide content, never publication timing, and no global enable-all control exists.
- Initial support events are **Joined the inner circle** (+10 support points on first
  subscription) and **Unlocked a post** (+5 once per fan/post unlock). Points remain a
  non-spendable score and the event/score update is idempotent.
- Slice 8b adds generated creator images immediately after text-only auto-posting by
  adapting public Noodle's prompt/quota/review/staging mechanics to access-protected
  NoodleR media storage. User uploads, gallery attachment, and polls remain Slice 10.
- Durable fan profiles are limited to named identity-continuity actors. Anonymous fan
  mass stays aggregate; anonymous replies retain only an event-local display snapshot.
  All fan history is filtered through the current viewer's post-access projection.
- NoodleR posts never mirror into public Noodle. `access: "public"` means Free/Public
  inside NoodleR, selected explicitly per post; automatic posts stay `locked` by
  default and cannot silently widen access.
- A creator project is an editable bounded content arc over the next 1–20 successful
  generated posts (default 5), with at most one active project per creator. It reuses the
  Slice 8f reserve planner and prepare-for-later operation; source schedules may guide
  content but never own publication timing. A project beat is reserved with a prepared
  item and finalized on publication. Exact project-level media controls remain undecided.
- There is no permanent auto-post-only creative brief. Durable stage identity, one-post
  Guide, and bounded Projects are the complete instruction layers.
- Slice 7 guidance is a button/action over the current composer draft, not a required
  always-on mode. **Post** publishes the draft literally; **Guide** transforms it
  through the existing NoodleR generation pipeline.
- Literal non-LLM NoodleR posting is required product behavior, not merely a fallback
  or implementation convenience.
- Guided generation ultimately exposes four independent output choices: **enable
  title**, **enable text**, **enable image**, and **enable poll**. The image and poll
  choices land only with their later output capabilities; do not expose dead controls
  in the text-only Slice 7 surface. Defaults, minimum-enabled validation, persistence,
  and exact slice placement for the title/text switches still require implementation
  planning rather than product inference.
- NoodleR posts have an optional first-class title. Titles participate in private
  generation and disclosure protection and are hidden whenever the post body is
  access-locked. Public Noodle remains titleless.
- Image generation/selection, attachments, and polls are explicitly later scope.
- The sidebar persona picker shows which personas have linked NoodleR profiles without
  becoming a second author picker.
- Fun and roleplay payoff take priority over realism-only simulation scope. Sensible
  defaults ship first; advanced controls remain optional and explicitly layered.
- Slice 9e gives named continuity actors faux profiles and access-filtered history;
  anonymous audience ambience remains aggregate and non-clickable.

## Product decisions still open

- **Special fan-moment cards?** May 9c start with the recommended **Superfan formed**
  and **Post taking off** cards in both the feed and creator-profile activity, using
  conservative deterministic thresholds that we tune later? If not, specify the first
  moments, display surface, or triggering behavior product direction intends instead.
- Remaining cross-mode source/trigger and failure contracts; the destination is
  NoodleR and public-Noodle mirroring is prohibited.
- Project-level media defaults and per-beat output controls. Project sequencing and
  timing ownership are resolved.
