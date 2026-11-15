// ──────────────────────────────────────────────
// Avatar setup: the pure parts of the Agent editor setup (lane: base)
// ──────────────────────────────────────────────
// Kept free of React so scripts/regressions/avatars/avatar-stage-logic.regression.ts can run them. Building a
// PNGTuber from sprites is the 2D lane's (renderers/pngtuber/pngtuber-layers.ts), so there is one rule.
import { AVATAR_KIND_AGENT, AVATAR_KINDS, type AvatarAgentId, type AvatarKind } from "@marinara-engine/shared";

/** The kinds an avatar agent's page sets up. */
export function avatarAgentKinds(agentId: AvatarAgentId): AvatarKind[] {
  return AVATAR_KINDS.filter((kind) => AVATAR_KIND_AGENT[kind] === agentId);
}
