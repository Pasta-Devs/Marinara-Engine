// ──────────────────────────────────────────────
// Exposure saves (Capability API 1.372): an exposure with a `save` bites each of the party only when they
// fail it. The story's turn says what bit and how often; the saves are rolled here, off each member's own
// sheet, with what the save is made against, so an item's modifier narrowed to it (a straw hat against
// `noon_light`) counts out of a fight as it does in one. What the failures cost goes onto the turn's own
// sheet commands, and what was rolled into its tells.
// ──────────────────────────────────────────────
import {
  normalizeCharacterLookupName,
  storyExposureSaveOutcome,
  type RulesetLiveStates,
  type StoryExposureSaveRoll,
  type StoryTurn,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import {
  loadSkillCheckModifierContext,
  resolveSkillCheckWithContext,
  type SkillCheckModifierContext,
} from "./skill-check-resolution.service.js";

/** Each member of the party with a sheet to roll on, by the name on their card, each name once. */
function partyMembers(meta: Record<string, unknown>, context: SkillCheckModifierContext): string[] {
  const sheets = context.ruleset?.sheets;
  if (!sheets) return [];
  const cards = Array.isArray(meta.gameCharacterCards) ? (meta.gameCharacterCards as Array<{ name?: unknown }>) : [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const card of cards) {
    const name = typeof card?.name === "string" ? card.name.trim() : "";
    const key = normalizeCharacterLookupName(name);
    if (!key || seen.has(key) || !sheets.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

/** Roll the saves a story turn owes and fold what they cost into it. A turn that owes none is returned
 *  as it is. A member's save the ruleset will not roll (untrained in it) counts as failed; a game with no
 *  sheets to roll on has nobody to mark, and its tell says so. */
export async function rollStoryExposureSaves(
  db: DB,
  chatId: string,
  meta: Record<string, unknown>,
  turn: StoryTurn,
  options: { live?: RulesetLiveStates | null; regenerateMessageId?: string | null; rollD20?: () => number } = {},
): Promise<StoryTurn> {
  if (!turn.saves.length) return turn;
  let context: SkillCheckModifierContext | null = null;
  try {
    context = await loadSkillCheckModifierContext(db, chatId, options.live, options.regenerateMessageId);
  } catch (error) {
    logger.warn(error, "[game/story] Exposure saves for chat %s could not read the party's sheets", chatId);
  }
  return rollStoryExposureSavesWith(context, meta, turn, options.rollD20);
}

/** The same, on sheets already read. */
export function rollStoryExposureSavesWith(
  context: SkillCheckModifierContext | null,
  meta: Record<string, unknown>,
  turn: StoryTurn,
  rollD20?: () => number,
): StoryTurn {
  if (!turn.saves.length) return turn;
  const members = context ? partyMembers(meta, context) : [];
  const sheet: string[] = [];
  const tells: string[] = [];
  for (const bite of turn.saves) {
    const rolls: StoryExposureSaveRoll[] = members.map((who) => {
      const totals: number[] = [];
      let failed = 0;
      for (let time = 0; time < bite.times; time += 1) {
        try {
          const result = resolveSkillCheckWithContext(
            context!,
            {
              skill: bite.save,
              dc: bite.difficulty,
              who,
              ...(bite.against ? { against: bite.against } : {}),
            },
            rollD20,
          );
          totals.push(result.total);
          if (!result.success) failed += 1;
        } catch {
          totals.push(0);
          failed += 1;
        }
      }
      return { who, failed, totals };
    });
    const outcome = storyExposureSaveOutcome(bite, rolls);
    sheet.push(...outcome.sheet);
    tells.push(outcome.tell);
  }
  return {
    ...turn,
    sheet: [turn.sheet, ...sheet].filter(Boolean).join(" "),
    tells: [...turn.tells, ...tells],
  };
}
