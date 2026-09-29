# Optional multiplayer

Implementation tracking: [#6790](https://github.com/Pasta-Devs/Marinara-Engine/issues/6790).
This document records the implementation boundary and proof requirements. It is
not a claim that multiplayer is available or that a platform has passed testing.

## Smallest architecture

One host owns a fresh shared chat, the saved game state and its AI connections.
At most four people participate. Conversation, Roleplay and Game retain their
existing modes. No old private transcript becomes shared through an invitation.

The selected transport is a dedicated HTTPS listener with small JSON actions and
bounded long polling. Fastify, Node HTTPS and Zod are already installed. WebRTC
would add signaling, ICE/TURN configuration and mobile host-tab lifetime concerns;
WebSocket would require another server dependency and streaming parser. A maximum
of four players does not need either. Only this transport will be implemented.
The listener registers room operations only, never the normal Engine API.

The guest's own trusted Engine connects to the host. TLS must pass certificate
chain and hostname validation; the invitation additionally pins the host's
certificate fingerprint. Verify that binding before sending a password or persona.
Do not follow redirects, fall back to HTTP, disable certificate validation, or
automatically configure router forwarding. The host configures an HTTPS address
and certificate using the existing TLS facilities.

The guest view is trusted bundled code in an opaque-origin sandbox, with no
network, downloads, navigation, storage, native bridge or administrative hooks.
An authenticated MessageChannel carries only validated room projections and a
small explicit action union. The parent supplies local presentation preferences;
peers cannot supply styles, assets, code, URLs to fetch or arbitrary API calls.
Peer text is rendered as text. Existing rich chat renderers are outside this
boundary. The Android wrapper injects a native bridge into every frame and must
remain unavailable as a guest until a bridge-free context is implemented and
verified on a physical device.

## Trust boundaries

| Boundary                               | Enforcement                                                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Local administrator to room controller | Existing Basic Auth, CSRF, host validation and native local-auth checks remain intact.                                           |
| Guest Engine to peer listener          | HTTPS, fingerprint binding, separate room password, approval, expiring random sessions, bounded requests.                        |
| Peer to trusted guest                  | Strict versioned schemas on both receiving sides, text-only projection, opaque sandbox and restrictive CSP.                      |
| Participant to chat/game state         | Derive identity and ownership from the authenticated session; never accept a peer-selected role, route or generation request.    |
| Room to generation and tools           | Host-owned operation mapping, existing generation lock, explicit room command/tool policies and Game readiness barrier.          |
| Shared state to transcript             | Allowlist visible fields; exclude credentials, debug prompts, reasoning, private notes, unrelated libraries and hidden GM state. |

An authenticated peer remains untrusted. Prompt text stays verbatim; authorization
is enforced in code rather than by escaping prompts or asking a model to be safe.
The host and its configured AI providers can read shared content. This design
does not promise protection against every browser or operating-system flaw.

## Activation and lifetime

`MULTIPLAYER_ENABLED=true` is a restart-only prerequisite. Missing, false and
invalid values disable multiplayer. A separate Settings activation is required;
neither setting starts networking. Hosting and joining each require an explicit
action. Restart never restores a live room. Stop, Kick and Leave revoke the
appropriate credentials and prevent subsequent actions or late delivery.

## Proof before enabling the feature

- Prove malicious peer text cannot execute, fetch assets, navigate, download,
  reach local APIs or invoke a native bridge in the supported guest context.
- Prove disabled gates, unauthenticated admission, ownership, private-state
  projection, bounded traffic and revocation fail closed.
- Reuse generation, commands and autonomy through one host coordinator. Publish
  the per-command compatibility matrix with explicit restrictions.
- Prove two Game players produce one round only after both submit or explicitly
  pass; retries, disconnects, cancellation and restart cannot double-apply state.
- Exercise the existing setup, drawer, sidebar and composer on desktop and mobile,
  including clear Leave/Stop and recovery controls. Record physical-device gaps.

Incomplete increments remain disabled. All three modes and their security
boundaries are required before calling #6790 complete.

## Command and feature compatibility

Room actions go through the authenticated host coordinator. This table describes
that boundary, not permission to run arbitrary commands on a peer. A rejected
command is explained in the composer; it is never executed by the guest.

| Feature | Caller and execution | Shared result and round rule |
| --- | --- | --- |
| Human messages, `/send` | Admitted participant; host creates an attributed user message. `/send` suppresses an automatic reply. | Public text. Conversation/Roleplay serialize accepted posts with generation; a busy sender keeps their draft. Game posts only through the round collector. |
| `/roll`, `/r`, `/dice` | Admitted participant; existing bounded Engine dice parser and roller run on the host. | Attributed text result. A Game roll remains that player's submitted action until the round closes. |
| Generate, `/trigger` | Admitted participant; one persisted host generation claim and the existing generation lock. | Filtered committed AI narration. Game rejects independent triggers; readiness is the only turn-resolution trigger. |
| Other slash commands | Not available unless their room authorization has been audited and added explicitly. | No system-role insertion, impersonation, private-chat navigation/editing, gallery work, device action or arbitrary local command execution. |
| Group responses | Host-selected approved AI roster and existing sequential/smart/manual generation behavior. | AI identity stays distinct from human persona snapshots. `{{user}}` uses the reviewed host persona, never the last guest to speak. |
| Conversation schedules and autonomy | Existing server scheduler, candidate/intent logic, cooldown and busy delays; dispatch through the same room claim. | No guest scheduler. Stop/paused rooms and Game cannot generate from timers. With no human view or admitted peer seen for 45 seconds, room autonomy pauses. |
| Conversation `schedule_update`, `memory`, `react` | Existing Engine handlers under the room policy. | Schedule/memory changes remain room-local; reactions must target this chat and carry no custom image asset. No global character-memory or presence updates. |
| Roleplay notes, reminders, rolls and whispers | Existing command parsing and host handler; approved participant IDs resolve recipients. | Private notes stay private. A whisper appears only in the recipient's filtered snapshot; the host still owns the stored data. |
| Cross-chat scenes and browser reminders | Restricted because their ordinary flow creates/navigates linked private chats or uses a browser-local timer. | Describe a scene in the shared transcript; use host-coordinated Conversation schedules for autonomous messages. No received command creates a private chat or local reminder. |
| Lorebooks and memories | Host-reviewed attached/room-owned books and room-local conversation memories. | Prompt context only, not library exports. Implicit global books, linked private chats and global card memories are excluded. |
| Engine trackers, dice, state, summaries and variables | Explicit allowlists at the real tool/agent executor, not only in model prompts. | Safe public fields may be projected; raw agent output, hidden reasoning, debug prompts and private GM fields are withheld. Game effects stay behind the round claim. |
| Game actions, choices, checks, inventory and sheets | Host Game setup/start and existing generation mechanics; deterministic post-turn effects commit once. | Human action ownership comes from the authenticated participant. Choices fill a draft; they never bypass submission readiness. |
| Media, custom/package tools, Game Experiences and device integrations | Unavailable to room generation. | No peer files, images, audio, video, remote styles, downloads, native commands or package-provided guest UI. These require a separate security increment. |

The initial shared Game is the synchronized narrated/action flow. Client-only
tactical/minigame surfaces, custom Game Experiences and scene/media presentation
are not advertised as guest capabilities. The standard Game setup is reused with
those options explicitly restricted. No host-provided renderer is loaded to fill
a compatibility gap.

## Recovery and limits

Each authenticated participant has a persisted monotonic action sequence and
bounded operation receipts. A retry returns its prior result; a replay remains
stale after its receipt leaves the 128-entry cache. Persona snapshots on messages
never change when a player later changes persona. Human and AI persona names must
be unambiguous for targeted whispers/checks.

Game persona changes apply at the next round boundary. Existing sheets, live
stats, inventory ownership and tracker privacy keys follow the stable participant
identity; historical messages keep their original attribution. If an NPC takes a
requested name before that boundary, the old persona stays active and the player
sees a name-conflict message. Host passes, removals, pauses and resumes leave
localized events in the same transcript.

Game saves required participants, each submission revision, and a unique
resolution claim in existing chat metadata. Submission collection and attributed
message commits use the existing metadata queue followed by the storage
transaction. Provider work runs outside that transaction. Stop cancels the trusted
operation signal; delayed room writes must still match its live claim. Interrupted
turns are not automatically retried. Explicit resume moves to the next collection
boundary without replaying already committed effects. Failed setup stays in the
lobby for explicit inspection/restart.

Protocol version 1 limits rooms to four humans/eight AI cards, each action to
16 KiB, snapshots to 256 KiB and 100 recent messages, and text messages to 8,000
characters. Approval queues, listener sockets, requests, long polls, sessions,
password derivations and generation work are bounded. One peer poll is active per
session and one connector poll per guest Engine. No compression or redirects are
accepted. Passwords/tokens are never placed in URLs or shared snapshots.

## Verification record

Automated proof uses disposable storage, a local test CA and mock model providers.
It does not alter a user's certificates, data or configured AI connections.

- `multiplayer-peer-security.regression.ts`: TLS chain/hostname/fingerprint checks before HTTP disclosure, malformed/oversized/redirect responses and cancellation.
- `multiplayer-peer-server-security.regression.ts`: room-only routes, body/header/output/rate/concurrency limits and immediate listener shutdown.
- `multiplayer-room.regression.ts`: two Engines, admission, ownership, filtered history, revocation/replay, generation serialization and two-player Game rounds/recovery.
- `multiplayer-session-flows.regression.ts`: two Engines over HTTPS with the actual generation and Game runtimes, a mock provider, and complete Conversation, Roleplay and Game rounds.
- `multiplayer-generation-policy.regression.ts` and `generation-output.regression.ts`: executor restrictions, private library exclusion, prompt-local identities, shared generation lock and completion semantics.
- `multiplayer-autonomy-security.regression.ts`: existing scheduler reuse, room activity clock, single authority and Stop races.
- `multiplayer-game-runtime.regression.ts`: Game setup/start/intro, deterministic turn effects, stale writes and interrupted setup.
- `multiplayer-game-persona.regression.ts` and `multiplayer-game-projection.regression.ts`: persona ownership migration, collision recovery, audience filtering and bounded public trackers.
- `e2e/multiplayer-guest-isolation.e2e.ts`: the production guest bundle under hostile text and attempted local/network/native access on desktop Chromium, mobile Chromium and mobile WebKit.
- Focused setup and controls browser cases cover admission warnings, Players, Game lobby, touch layouts, light/dark and draft/retry behavior.

Before merging, rerun `pnpm check`, relevant Node regressions,
`pnpm regression:prompt`, `pnpm smoke:ui` and the focused browser matrix against
the final candidate. Record actual command results/revision in the PR, complete
CodeRabbit and a focused security review, and verify supported physical devices.
Browser emulation is not physical iPhone/iPad Home Screen or Android proof. The
native Android wrapper remains disabled as a guest. Physical-device results are
pending until recorded; do not infer support from a viewport preset.

The guest is built as a classic IIFE because opaque-origin ES-module loading would
otherwise require relaxing CORS. Production and development startup build the
fixed local guest assets; after editing guest source in an already running dev
server, run `node packages/client/scripts/build-multiplayer-guest.mjs` and reload
the guest view. The launcher completeness check includes both isolated assets.

Translated documentation follow-up: [#6854](https://github.com/Pasta-Devs/Marinara-Engine/issues/6854).
