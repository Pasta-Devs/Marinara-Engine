// ──────────────────────────────────────────────
// Service: Skill Check Resolution (chat-scoped)
//
// The modifier lookup a check needs — the skill bonus
// from the game-state snapshot and the governing
// attribute from either playerStats or the player's
// character sheet — used to be 27 lines inlined in the
// POST /game/skill-check handler, so nothing else could
// roll a check the way the shipped endpoint rolls one.
// It lives here now: the endpoint is a thin caller, and
// generation post-processing rolls the GM's sparse tags
// through the same path.
// ──────────────────────────────────────────────

import {
  createSkillCheckTagRegex,
  isEngineRollableSkillCheckTag,
  parseSkillCheckTagBody,
  serializeResolvedSkillCheckTag,
  type RPGAttributes,
  type SkillCheckResult,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createGameStateStorage } from "../storage/game-state.storage.js";
import {
  attributeModifier,
  getGoverningAttribute,
  mapSheetAttributesToRPG,
  resolveSkillCheck,
} from "./skill-check.service.js";

/** Longest skill name a check may name — matches the POST /game/skill-check schema. */
export const SKILL_CHECK_MAX_SKILL_LENGTH = 100;
/** DC bounds — likewise the endpoint's, so both paths refuse the same tags. */
export const SKILL_CHECK_MIN_DC = 1;
export const SKILL_CHECK_MAX_DC = 40;

/**
 * Everything a chat contributes to a check's modifiers, read once.
 *
 * Resolving N checks in one narration must not mean N snapshot reads, and the
 * checks in one turn must all see the same sheet.
 */
export interface SkillCheckModifierContext {
  /** `playerStats.skills` from the latest game-state snapshot, when it parsed. */
  skills: Record<string, unknown> | null;
  /** `playerStats.attributes` — engine shape, never seeded today but preferred when present. */
  attributes: Record<string, unknown> | null;
  /** The player card's free-form `rpgStats.attributes`, mapped to the strict shape. */
  sheetAttributes: Partial<RPGAttributes>;
}

export interface SkillCheckRequest {
  skill: string;
  dc: number;
  advantage?: boolean;
  disadvantage?: boolean;
  preRolledD20?: number;
}

function parsePlayerStats(raw: unknown, chatId: string): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw !== "string") return typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch (err) {
    // Unparseable player stats cost the check its modifiers, never the turn.
    logger.warn(err, "[game/skill-check] Unparseable playerStats for chat %s; resolving without modifiers", chatId);
    return null;
  }
}

function parseChatMetadata(raw: unknown, chatId: string): Record<string, unknown> {
  if (typeof raw !== "string") return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch (err) {
    logger.warn(err, "[game/skill-check] Unparseable chat metadata for chat %s", chatId);
    return {};
  }
}

/**
 * Read the chat's modifier sources: the game-state snapshot's playerStats, and
 * the player character card's sheet attributes as the fallback the shipped
 * endpoint has always used (playerStats.attributes is never seeded today).
 */
export async function loadSkillCheckModifierContext(db: DB, chatId: string): Promise<SkillCheckModifierContext> {
  const stateStore = createGameStateStorage(db);
  const snapshot = await stateStore.getLatest(chatId);
  const playerStats = parsePlayerStats(snapshot?.playerStats, chatId);

  const skills =
    playerStats?.skills && typeof playerStats.skills === "object"
      ? (playerStats.skills as Record<string, unknown>)
      : null;
  const attributes =
    playerStats?.attributes && typeof playerStats.attributes === "object"
      ? (playerStats.attributes as Record<string, unknown>)
      : null;

  // The sheet fallback costs a chat read, so skip it when playerStats already
  // carries engine-shape attributes.
  if (attributes) return { skills, attributes, sheetAttributes: {} };

  const chats = createChatsStorage(db);
  const chat = await chats.getById(chatId);
  const meta = chat ? parseChatMetadata(chat.metadata, chatId) : {};
  const cards = Array.isArray(meta.gameCharacterCards)
    ? (meta.gameCharacterCards as Array<Record<string, unknown>>)
    : [];
  const playerCard = cards[0];
  const rpgStats = playerCard?.rpgStats as { attributes?: Array<{ name: string; value: number }> } | undefined;

  return { skills, attributes: null, sheetAttributes: mapSheetAttributesToRPG(rpgStats?.attributes) };
}

/** Roll one check against an already-loaded chat context. */
export function resolveSkillCheckWithContext(
  context: SkillCheckModifierContext,
  request: SkillCheckRequest,
  rollD20?: () => number,
): SkillCheckResult {
  const skills = context.skills;
  const rawSkillMod = skills ? (skills[request.skill] ?? skills[request.skill.toLowerCase()]) : undefined;
  const skillMod = Number.isFinite(Number(rawSkillMod)) ? Number(rawSkillMod) : 0;

  const attr = getGoverningAttribute(request.skill);
  let attrScore: number | null = null;
  if (context.attributes && Number.isFinite(Number(context.attributes[attr]))) {
    attrScore = Number(context.attributes[attr]);
  } else if (context.sheetAttributes[attr] != null) {
    attrScore = context.sheetAttributes[attr]!;
  }

  return resolveSkillCheck({
    skill: request.skill,
    dc: request.dc,
    skillModifier: skillMod,
    attributeModifier: attrScore != null ? attributeModifier(attrScore) : 0,
    advantage: request.advantage,
    disadvantage: request.disadvantage,
    preRolledD20: request.preRolledD20,
    rollD20,
  });
}

/** Resolve a single check for a chat — the POST /game/skill-check body. */
export async function resolveChatSkillCheck(
  db: DB,
  chatId: string,
  request: SkillCheckRequest,
  rollD20?: () => number,
): Promise<SkillCheckResult> {
  const context = await loadSkillCheckModifierContext(db, chatId);
  return resolveSkillCheckWithContext(context, request, rollD20);
}

/**
 * Whether a tag names a check this engine will roll.
 *
 * The same bounds the endpoint's schema enforces, so a tag the client would
 * have been unable to POST is left in the prose rather than resolved by a path
 * with looser rules.
 */
function isResolvableRequest(request: SkillCheckRequest): boolean {
  if (!request.skill || request.skill.length > SKILL_CHECK_MAX_SKILL_LENGTH) return false;
  return Number.isInteger(request.dc) && request.dc >= SKILL_CHECK_MIN_DC && request.dc <= SKILL_CHECK_MAX_DC;
}

export interface SkillCheckTagResolutionOptions {
  /** Loaded at most once, and only when at least one tag actually needs rolling. */
  loadContext: () => Promise<SkillCheckModifierContext>;
  rollD20?: () => number;
  /** Chat id for logging only. */
  chatId?: string;
}

export interface SkillCheckTagResolution {
  content: string;
  /** How many tags this pass rewrote. */
  resolved: number;
  /** How many tags it left alone because the GM's own numbers held up. */
  trusted: number;
  /**
   * Every tag left standing, for any reason — the numbers held, the engine does
   * not implement the system the tag names, the DC or skill was out of bounds,
   * or the body was not readable as a check at all. `resolved + left` is every
   * `[skill_check:]` in the content, so a log line can say what happened to all
   * of them instead of accounting for two of the four cases.
   */
  left: number;
}

/**
 * Roll every `[skill_check:]` tag in a narration that still owes a real roll,
 * and rewrite it in place with the resolved form.
 *
 * Two shapes need rolling and both are handled the same way, because the shared
 * reader collapses them: a **sparse** tag (skill + DC, no numbers) and a **full**
 * tag whose plain-d20 arithmetic fails the audit. The second is the case this
 * function exists for — before it, a GM that invented `rolls="7" total="19"` had
 * its numbers corrected on the dice card and left standing in the saved text, so
 * the next turn read back the invention as fact.
 *
 * Idempotent: what it writes parses back as an audited result, so a second pass
 * over the same content rewrites nothing and rolls no dice. Pool systems
 * (`resolution="successes"`, non-d20 `dice=`) are never audited and never
 * rewritten — the engine does not implement those rules and will not pretend to.
 * That holds for a malformed pool tag as much as a tidy one: the shared reader
 * refusing to vouch for a pool's numbers is not permission to answer it with a
 * d20, so `isEngineRollableSkillCheckTag` is asked before anything is rolled.
 */
export async function resolveSkillCheckTagsInContent(
  content: string,
  options: SkillCheckTagResolutionOptions,
): Promise<SkillCheckTagResolution> {
  if (!content || !/\[skill_check\b/i.test(content)) return { content, resolved: 0, trusted: 0, left: 0 };

  const pending: Array<{ start: number; end: number; request: SkillCheckRequest }> = [];
  let trusted = 0;
  let left = 0;

  const regex = createSkillCheckTagRegex();
  for (let match = regex.exec(content); match; match = regex.exec(content)) {
    const tag = parseSkillCheckTagBody(match[1] ?? "");
    // Not a check at all (no skill or DC) — leave whatever the model wrote.
    if (!tag) {
      left += 1;
      continue;
    }
    if (tag.resolvedResult) {
      trusted += 1;
      left += 1;
      continue;
    }
    // A system this engine does not implement — a success pool, or a die that is
    // not the d20 the resolver throws. Its numbers did not survive the audit (or
    // it never wrote any), but rolling a d20 here would not repair the tag, it
    // would replace the GM's rules with ours in the text about to be saved.
    if (!isEngineRollableSkillCheckTag(tag)) {
      logger.debug(
        "[game/skill-check] Leaving a check the engine does not roll for chat %s (resolution=%s dice=%s)",
        options.chatId ?? "unknown",
        tag.declaredResolution ?? "none",
        tag.declaredDice ?? "none",
      );
      left += 1;
      continue;
    }
    const request: SkillCheckRequest = {
      skill: tag.skill,
      dc: tag.dc,
      advantage: tag.advantage,
      disadvantage: tag.disadvantage,
      preRolledD20: tag.preRolledD20,
    };
    if (!isResolvableRequest(request)) {
      logger.debug(
        "[game/skill-check] Leaving out-of-bounds check tag unresolved for chat %s (dc=%d)",
        options.chatId ?? "unknown",
        request.dc,
      );
      left += 1;
      continue;
    }
    pending.push({ start: match.index, end: match.index + match[0].length, request });
  }

  if (pending.length === 0) return { content, resolved: 0, trusted, left };

  const context = await options.loadContext();

  let out = "";
  let cursor = 0;
  for (const entry of pending) {
    const result = resolveSkillCheckWithContext(context, entry.request, options.rollD20);
    out += content.slice(cursor, entry.start) + serializeResolvedSkillCheckTag(result);
    cursor = entry.end;
  }
  out += content.slice(cursor);

  return { content: out, resolved: pending.length, trusted, left };
}
