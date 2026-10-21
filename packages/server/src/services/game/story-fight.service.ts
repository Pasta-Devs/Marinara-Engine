// ──────────────────────────────────────────────
// A story's set-piece fight (Capability API 1.343): the fight the latest reply's story started, who is
// fought in it as the game's ruleset names them, and the board it is fought on.
// ──────────────────────────────────────────────
import {
  gameStoryFromMetadata,
  storyFightIn,
  storyFightRoster,
  storyIsRef,
  type RulesetDefinition,
  type StoryFight,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { gameRepliesBefore } from "./game-market.service.js";
import { loadGameWorld } from "./game-world.service.js";
import { loadRulesetCatalogEntries } from "./ruleset-catalog.service.js";

/** The fight the Game Master's latest reply started for the story, or null. */
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
    return storyFightIn(story, replies.all.filter((reply) => reply.trim()).at(-1));
  } catch (err) {
    logger.warn(err, "Story fight lookup failed for chat %s", chatId);
    return null;
  }
}

/**
 * The fight's opponents, each by the bestiary's own name for it when the ruleset has the id. An id it
 * doesn't have (or any id, in a game without a ruleset's combat) is refused and logged, never fought as a
 * made-up creature.
 */
export async function storyFightOpponents(
  fight: StoryFight,
  ruleset: { definition: RulesetDefinition; packageId: string | null } | null,
): Promise<{ opponents: Array<{ name: string; creature: string }>; refused: string[] }> {
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
  const roster = storyFightRoster(fight, (ref) => labels.get(ref));
  if (roster.refused.length) {
    logger.warn(
      "Story fight %s names creatures the game's ruleset doesn't have, left out of the fight: %s",
      fight.id,
      roster.refused.join(", "),
    );
  }
  return roster;
}

/** The prompt line that tells the blueprint writer who this fight is with; with no opponents (none named,
 *  or every one refused), the enemies are the writer's own to choose. */
export function storyFightPromptText(fight: StoryFight, opponents: ReadonlyArray<{ name: string; creature: string }>) {
  const header = `This fight is set by the story: "${fight.name}".${fight.note ? ` ${fight.note}` : ""}`;
  if (!opponents.length) return [header, "Choose its enemies yourself."].join("\n");
  return [
    header,
    `Its enemies are exactly these, in this order, with these names:`,
    ...opponents.map((each) => `- ${each.name} (creature: ${each.creature})`),
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
