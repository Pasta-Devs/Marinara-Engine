// ──────────────────────────────────────────────
// Avatar stage: the pure decisions behind AvatarStage and the setup preview (lane: base)
// ──────────────────────────────────────────────
// Kept free of React and the DOM so scripts/regressions/avatar-stage-logic.regression.ts can run them.
import {
  AVATAR_AGENT_IDS,
  AVATAR_KIND_AGENT,
  AVATAR_KINDS,
  createAvatarConfig,
  normalizeSpriteExpressionKey,
  avatarModelFileUrl,
  type AvatarAgentId,
  type AvatarConfig,
  type AvatarFeatureFlags,
  type AvatarFrameInput,
  type AvatarImageRef,
  type AvatarKind,
  type AvatarOwnerRef,
  type AvatarOwnerSummary,
  type PngtuberAvatarData,
} from "@marinara-engine/shared";
import { AVATAR_RENDER_BUDGET, type AvatarParticipant } from "../contract";

/** The kind to show in a chat: the active kind when its agent is on, otherwise the first set-up kind
 *  whose agent is on (pngtuber, then mesh-avatar, then vrm), or null when none can show. */
export function pickAvatarKind(
  owner: Pick<AvatarOwnerSummary, "activeKind" | "kinds">,
  enabledAgentIds: readonly AvatarAgentId[],
): AvatarKind | null {
  const shows = (kind: AvatarKind) => owner.kinds.includes(kind) && enabledAgentIds.includes(AVATAR_KIND_AGENT[kind]);
  if (owner.activeKind && shows(owner.activeKind)) return owner.activeKind;
  return AVATAR_KINDS.find(shows) ?? null;
}

export interface StageAvatar {
  participant: AvatarParticipant;
  kind: AvatarKind;
  /** Position among the shown avatars, for default placement. */
  index: number;
}

/** An avatar the stage shows, as Chat Settings' Avatars drawer lists it. */
export interface StageAvatarSummary {
  ownerId: string;
  name: string;
  kind: AvatarKind;
}

/** Whether two lists name the same avatars in the same order, so an unchanged list keeps its identity. */
export function sameStageAvatars(a: readonly StageAvatarSummary[], b: readonly StageAvatarSummary[]): boolean {
  return (
    a.length === b.length &&
    a.every((avatar, index) => {
      const other = b[index]!;
      return avatar.ownerId === other.ownerId && avatar.name === other.name && avatar.kind === other.kind;
    })
  );
}

/** Participants with a saved, enabled avatar their chat can show, in participant order. */
export function selectStageAvatars(
  participants: readonly AvatarParticipant[],
  summaries: readonly AvatarOwnerSummary[] | undefined,
  enabledAgentIds: readonly AvatarAgentId[],
): StageAvatar[] {
  if (!summaries || enabledAgentIds.length === 0) return [];
  const byOwner = new Map(summaries.map((summary) => [ownerKey(summary.owner), summary]));
  const seen = new Set<string>();
  const shown: StageAvatar[] = [];
  for (const participant of participants) {
    const key = ownerKey(participant.owner);
    const summary = byOwner.get(key);
    if (seen.has(key) || !summary?.enabled) continue;
    const kind = pickAvatarKind(summary, enabledAgentIds);
    if (!kind) continue;
    seen.add(key);
    shown.push({ participant, kind, index: shown.length });
  }
  return shown;
}

/** Fixed save time of an avatar built from sprites, so the renderer is not remounted on every render. */
const SPRITE_AVATAR_UPDATED_AT = "1970-01-01T00:00:00.000Z";

/** The owner's avatar with its expression sprites as the PNGTuber setup when it has none saved: the
 *  saved config (or a disabled preview) with `fromSprites` filled in. Null without either. */
export function withSpriteAvatar(
  owner: AvatarOwnerRef,
  config: AvatarConfig | null,
  fromSprites: PngtuberAvatarData | null,
): AvatarConfig | null {
  if (!fromSprites || config?.kinds.pngtuber) return config;
  const base = config ?? { ...createAvatarConfig(owner, SPRITE_AVATAR_UPDATED_AT), enabled: false };
  return { ...base, kinds: { ...base.kinds, pngtuber: fromSprites } };
}

export function ownerKey(owner: AvatarOwnerRef): string {
  return `${owner.ownerType}:${owner.ownerId}`;
}

/** "Phone" in the budget: a coarse pointer or a viewport below the md breakpoint. */
export const AVATAR_PHONE_QUERY = "(max-width: 767px), (pointer: coarse)";
/** Average time (ms) one draw of every avatar takes, above which a phone drops its idle frame rate. */
const PHONE_LOAD_THRESHOLD_MS = 12;

/** Frames per second the stage draws at. */
export function avatarTargetFps(options: { talking: boolean; phone: boolean; underLoad: boolean }): number {
  const { fps } = AVATAR_RENDER_BUDGET;
  if (options.talking) return fps.talking;
  if (!options.phone) return fps.idleDesktop;
  return options.underLoad ? fps.idlePhoneUnderLoad : fps.idlePhone;
}

/** One avatar's clock in the stage's shared frame loop. */
export interface AvatarDrawClock {
  /** performance.now() of its last draw. */
  lastDrawMs: number;
  /** Its last frame was talking. */
  talking: boolean;
  /** Running average of its draw time (ms). */
  costMs: number;
}

/** Whether an avatar draws on this tick of the shared loop. Each avatar keeps its own rate: the speaking one
 *  draws at the talking rate and every other one at the idle rate. */
export function avatarDrawDue(
  clock: AvatarDrawClock,
  nowMs: number,
  options: { phone: boolean; underLoad: boolean },
): boolean {
  return nowMs - clock.lastDrawMs >= 1000 / avatarTargetFps({ ...options, talking: clock.talking }) - 1;
}

/** Adds one draw's time to the avatar's running average. */
export function recordAvatarDrawCost(clock: AvatarDrawClock, costMs: number): void {
  clock.costMs = clock.costMs * 0.9 + costMs * 0.1;
}

/** Whether a phone is under load: one draw of every avatar takes longer than the threshold on average. It adds
 *  up each avatar's own average, so it does not depend on which avatars happen to draw on the same tick. */
export function avatarsUnderLoad(clocks: Iterable<AvatarDrawClock>, phone: boolean): boolean {
  if (!phone) return false;
  let costMs = 0;
  for (const clock of clocks) costMs += clock.costMs;
  return costMs > PHONE_LOAD_THRESHOLD_MS;
}

/** The canvas device pixel ratio, capped by the budget. */
export function avatarDevicePixelRatio(devicePixelRatio: number, phone: boolean): number {
  const cap = phone ? AVATAR_RENDER_BUDGET.maxDevicePixelRatio.phone : AVATAR_RENDER_BUDGET.maxDevicePixelRatio.desktop;
  return Math.min(Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1, cap);
}

/** The director's frame with the owner's switches applied: no lip sync keeps the mouth shut, no blinking
 *  holds the eyes open, and no idle motion (or reduced motion) drops the thinking and listening poses. */
export function applyAvatarFeatures(
  frame: AvatarFrameInput,
  features: AvatarFeatureFlags,
  reducedMotion: boolean,
): AvatarFrameInput {
  const next: AvatarFrameInput = { ...frame };
  if (!features.lipSync) {
    next.viseme = null;
    next.mouthOpen = 0;
  }
  if (!features.blink) next.blink = 0;
  if ((!features.idleMotion || reducedMotion) && next.state !== "talking") next.state = "idle";
  return next;
}

export interface AvatarSpriteRef {
  expression: string;
  url: string;
}

/** URL of a PNGTuber image: a stored file (with the config's save time, so a replaced file reloads), or
 *  the owner's sprite with that label. Expression sprites win over full-body ones with the same label. */
export function resolveAvatarImage(
  owner: AvatarOwnerRef,
  config: Pick<AvatarConfig, "updatedAt">,
  sprites: readonly AvatarSpriteRef[] | undefined,
  ref: AvatarImageRef,
): string | null {
  if (ref.source === "file") {
    return `${avatarModelFileUrl(owner, ref.path)}?v=${encodeURIComponent(config.updatedAt)}`;
  }
  const label = normalizeSpriteExpressionKey(ref.label);
  if (!label || !sprites?.length) return null;
  const matches = sprites.filter((sprite) => normalizeSpriteExpressionKey(sprite.expression) === label);
  const expressionSprite = matches.find((sprite) => !/^full[_\s-]/iu.test(sprite.expression));
  return (expressionSprite ?? matches[0])?.url ?? null;
}

/** A chat's avatar participants: its characters in chat order, then the user's persona. A persona that is a
 *  character card ("play as a character") is that character. */
export function chatAvatarParticipants(
  characterIds: readonly string[],
  characterMap: ReadonlyMap<string, { name: string }>,
  persona?: { id?: string; source?: "persona" | "character"; name: string } | null,
): AvatarParticipant[] {
  const participants: AvatarParticipant[] = [];
  for (const id of characterIds) {
    const character = characterMap.get(id);
    if (character) participants.push({ owner: { ownerType: "character", ownerId: id }, name: character.name });
  }
  if (persona?.id) {
    participants.push({
      owner: { ownerType: persona.source === "character" ? "character" : "persona", ownerId: persona.id },
      name: persona.name,
    });
  }
  return participants;
}

/** Avatar agents a chat turned on: agents enabled and the agent added to the chat. */
export function chatAvatarAgentIds(chatMeta: { enableAgents?: unknown; activeAgentIds?: unknown }): AvatarAgentId[] {
  if (chatMeta.enableAgents !== true && chatMeta.enableAgents !== "true") return [];
  const active = Array.isArray(chatMeta.activeAgentIds) ? (chatMeta.activeAgentIds as unknown[]) : [];
  return AVATAR_AGENT_IDS.filter((id) => active.includes(id));
}
