// ──────────────────────────────────────────────
// A story's set-piece fight (Capability API 1.343): the fight the latest reply's story started, who is
// fought in it as the game's ruleset names them, and the board it is fought on.
// ──────────────────────────────────────────────
import {
  gameStoryFromMetadata,
  readStoryLedger,
  storyHeldGroundNow,
  storyState,
  storyFightForParty,
  storyFightIn,
  storyFightRoster,
  storyIsRef,
  storyFightAdjustAt,
  storyFightAdjustText,
  type StoryFightAdjustAt,
  type RulesetDefinition,
  type RulesetHeldGround,
  type StoryFight,
  type StoryFightOpponent,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { gameRepliesBefore } from "./game-market.service.js";
import { loadGameWorld } from "./game-world.service.js";
import { loadRulesetCatalogEntries } from "./ruleset-catalog.service.js";
import { gameNoncombatants, gamePartySize } from "./experience-companions.service.js";

/** The fight the Game Master's latest reply started for the story, or null: in its variant for the
 *  party's size (1.356). */
export async function latestStoryFight(
  db: DB,
  chatId: string,
  meta: Record<string, unknown> | null | undefined,
): Promise<StoryFight | null> {
  try {
    const world = await loadGameWorld(db, chatId, meta);
    const story = gameStoryFromMetadata(meta, world);
    if (!story?.fights.length) return null;
    const replies = await gameRepliesBefore(db, chatId);
    const fight = storyFightIn(story, replies.all.filter((reply) => reply.trim()).at(-1));
    if (!fight) return null;
    return storyFightForParty(fight, gamePartySize(meta ?? {}, await gameNoncombatants(db, chatId, meta ?? {})));
  } catch (err) {
    logger.warn(err, "Story fight lookup failed for chat %s", chatId);
    return null;
  }
}

/** Whether death is held where the party is (1.366), as the story last recorded it: the Held Ground
 *  (1.323) a ruleset fight started now is fought on. Null when it is not, or the game has no story. */
export async function latestStoryHeldGround(
  db: DB,
  chatId: string,
  meta: Record<string, unknown> | null | undefined,
): Promise<RulesetHeldGround | null> {
  try {
    const world = await loadGameWorld(db, chatId, meta);
    const story = gameStoryFromMetadata(meta, world);
    if (!story?.heldGround.length) return null;
    const replies = await gameRepliesBefore(db, chatId);
    return storyHeldGroundNow(story, storyState(story, readStoryLedger(replies.all)));
  } catch (err) {
    logger.warn(err, "Story held ground lookup failed for chat %s", chatId);
    return null;
  }
}

/** How the story fight the latest reply started adjusts its opponents (1.363), by their names in the fight
 *  (case aside), as a party this high meets them (1.371): what a ruleset fight builds each of them with.
 *  Empty when there is none. */
export async function latestStoryFightAdjusts(
  db: DB,
  chatId: string,
  meta: Record<string, unknown> | null | undefined,
  partyLevel?: number | null,
): Promise<Map<string, StoryFightAdjustAt>> {
  const fight = await latestStoryFight(db, chatId, meta);
  const adjusts = new Map<string, StoryFightAdjustAt>();
  for (const each of fight ? storyFightRoster(fight) : []) {
    if (each.adjust) adjusts.set(each.name.trim().toLowerCase(), storyFightAdjustAt(each.adjust, partyLevel));
  }
  return adjusts;
}

/** The fight's opponents, each by the bestiary's own name for it when the ruleset has the id. */
export async function storyFightOpponents(
  fight: StoryFight,
  ruleset: { definition: RulesetDefinition; packageId: string | null } | null,
): Promise<StoryFightOpponent[]> {
  const labels = new Map<string, string>();
  if (ruleset) {
    const refs = new Set(fight.creatures.map((each) => each.creature).filter(storyIsRef));
    for (const ref of refs) {
      const [catalogId, entryId] = ref.split("/");
      const catalog = ruleset.definition.catalogs?.find((each) => each.id === catalogId);
      if (!catalog) continue;
      const read = await loadRulesetCatalogEntries(ruleset.packageId, ruleset.definition, catalog).catch(() => null);
      const entry = read?.ok ? read.entries.find((each) => each.id === entryId) : undefined;
      if (entry) labels.set(ref, entry.label);
    }
  }
  return storyFightRoster(fight, (ref) => labels.get(ref));
}

/** The prompt line that tells the blueprint writer who this fight is with. */
export function storyFightPromptText(fight: StoryFight, opponents: ReadonlyArray<StoryFightOpponent>) {
  return [
    `This fight is set by the story: "${fight.name}"${fight.forParty ? `, as set for a party of ${fight.forParty}` : ""}.${fight.note ? ` ${fight.note}` : ""}`,
    `Its enemies are exactly these, in this order, with these names${opponents.length ? "" : " (none)"}:`,
    ...opponents.map(
      (each) =>
        `- ${each.name} (creature: ${each.creature}${each.adjust ? `; in this fight: ${storyFightAdjustText(each.adjust)}` : ""})`,
    ),
    "Write no other enemies.",
  ].join("\n");
}

/**
 * The blueprint's enemies as the story sets them: one per opponent, in order. Each is the model's own
 * enemy of that name or creature when it wrote one, else a copy of the first one it wrote, renamed; with
 * a ruleset, the bestiary creature is named and any stat block the model proposed instead is dropped.
 */
export function storyFightBlueprintEnemies(
  opponents: ReadonlyArray<{ name: string; creature: string }>,
  written: ReadonlyArray<Record<string, unknown>>,
  withRuleset: boolean,
): Array<Record<string, unknown>> {
  const used = new Set<number>();
  const key = (text: unknown) =>
    String(text ?? "")
      .trim()
      .toLowerCase();
  return opponents.map((opponent) => {
    let at = written.findIndex((each, index) => !used.has(index) && key(each.name) === key(opponent.name));
    if (at < 0)
      at = written.findIndex((each, index) => !used.has(index) && key(each.creature) === key(opponent.creature));
    if (at >= 0) used.add(at);
    const template = written[at] ?? written[0] ?? {};
    const { proposed: _proposed, tier: _tier, ...rest } = template;
    return {
      ...(withRuleset ? rest : template),
      name: opponent.name,
      ...(withRuleset ? { creature: opponent.creature } : {}),
    };
  });
}
