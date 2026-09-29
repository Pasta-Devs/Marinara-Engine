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
