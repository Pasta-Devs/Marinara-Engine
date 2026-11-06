/**
 * Spotting fakes (Capability API 1.802): what a character can tell about an item a dishonest seller may
 * pass off. A fake's `tells` are the checks that can give it away, each with its difficulty and what a
 * success sees; a dishonest seller's `manner` is a check on the seller instead. Anyone may make any of
 * them, a tell's `needs` and `carries` aside (a tool check needs the kit). The Engine knows none of the
 * checks by name: the ruleset writes them.
 *
 * - Inspected, an item rolls the best of them for whoever looks: a fake met is suspect, and met by
 *   `items.namesItAt` or more it is named; a real item inspected rolls its fakes' tells, so asking gives
 *   nothing away, and a success says it looks genuine.
 * - About to be bought, a fake is weighed by every other member of the party, with no dice: 10 (or
 *   `items.passiveBase`) and their number, 5 more with advantage and 5 less with disadvantage. One who
 *   meets a difficulty has noticed, and the buy is held for them to warn the buyer. `warnBy: "roll"`
 *   rolls those checks instead.
 */
import type {
  RulesetCatalogItem,
  RulesetDefinition,
  RulesetSheetBuild,
  RulesetValueRef,
} from "../../schemas/ruleset.schema.js";
import type { GameInventoryStack } from "../../utils/game-inventory-stacks.js";
import { rulesetItemGateCheck } from "./check-effects.js";
import type { RulesetItemBook } from "./item-book.js";
import { rulesetSheetItems } from "./item-book.js";
import { rollRulesetCheckOutsideFight } from "./item-use.js";
import { evaluateRulesetSheetLive, rulesetItemNeedsMet } from "./live-state.js";
import type { RulesetMarketSeller } from "./market.js";

export type RulesetItemTell = NonNullable<RulesetCatalogItem["tells"]>[number];
export type RulesetSellerManner = NonNullable<RulesetMarketSeller["manner"]>;

/** The most tells one inspection weighs: a real item's are its fakes' together. */
const MOST_TELLS = 12;

/** Someone who may spot a fake: their sheet, their live state, and the stacks with their bag in it. */
export interface RulesetSpotter {
  name: string;
  build: RulesetSheetBuild;
  live: unknown;
  /** Their bag's holder: absent for the player's own. */
  holder: string | undefined;
}

/** One check a spotter can make about an item: a tell, or the seller's manner. */
interface Ask {
  label: string;
  says: string;
  dc: number;
  modifier: number;
  lean: "advantage" | "disadvantage" | undefined;
  /** A seller's manner, which says something is off but never what the item is. */
  manner: boolean;
  check: RulesetItemTell["check"];
}

/**
 * The tells an inspection of an item weighs: a fake's own (`truly`, what it truly is), else those of
 * every fake that passes for it, so a real item rolls the same dice a fake of it would.
 */
export function rulesetItemTells(
  book: Pick<RulesetItemBook, "entries" | "itemOf">,
  item: string,
  truly?: string,
): RulesetItemTell[] {
  if (truly) return book.itemOf(truly)?.entry.item?.tells ?? [];
  return book.entries
    .flatMap((entry) => (entry.entry.item?.passesFor === item ? (entry.entry.item.tells ?? []) : []))
    .slice(0, MOST_TELLS);
}

/** What a check is called: its skill's or ability's label, or the value's derived label. */
function checkLabel(definition: RulesetDefinition, check: RulesetItemTell["check"]): string {
  if ("skill" in check) return definition.sheet.skills.find((entry) => entry.id === check.skill)?.label ?? check.skill;
  if ("ability" in check)
    return definition.sheet.abilities.find((entry) => entry.id === check.ability)?.label ?? check.ability;
  const ref = check.value as RulesetValueRef & { derived?: string };
  const derived = typeof ref === "object" && ref && "derived" in ref ? ref.derived : undefined;
  return (derived && definition.sheet.derived?.find((entry) => entry.id === derived)?.label) || "check";
}

/** Every check a spotter can make about an item, with their number for it: the tells whose `needs`
 *  they meet and whose `carries` they carry, and the seller's manner. */
function spotterAsks(
  definition: RulesetDefinition,
  book: Pick<RulesetItemBook, "itemOf">,
  stacks: readonly GameInventoryStack[],
  spotter: RulesetSpotter,
  tells: readonly RulesetItemTell[],
  manner: RulesetSellerManner | undefined,
): Ask[] {
  const held = rulesetSheetItems(book, stacks, spotter.holder);
  const evaluated = evaluateRulesetSheetLive(definition, spotter.build, spotter.live, held);
  const meets = (needs: RulesetItemTell["needs"] | undefined, any?: boolean) =>
    rulesetItemNeedsMet(definition, spotter.build, evaluated, needs, any);
  // Advantage where any one of its lines is met: a guild merchant's, or a fence's old trade.
  const leaning = (line: {
    advantageIf?: RulesetItemTell["advantageIf"];
    disadvantageIf?: RulesetItemTell["disadvantageIf"];
  }) => {
    const advantage = !!line.advantageIf && meets(line.advantageIf, true);
    const disadvantage = !!line.disadvantageIf && meets(line.disadvantageIf, true);
    return advantage === disadvantage ? undefined : advantage ? ("advantage" as const) : ("disadvantage" as const);
  };
  const carried = new Set(
    stacks
      .filter((stack) => (stack.holder ?? "") === (spotter.holder ?? ""))
      .flatMap((stack) => (stack.item ? [stack.item] : [])),
  );
  const asks: Ask[] = [];
  const add = (
    line: Pick<RulesetItemTell, "check" | "dc" | "says" | "advantageIf" | "disadvantageIf">,
    isManner: boolean,
  ) => {
    const ask = rulesetItemGateCheck(
      definition,
      spotter.build,
      evaluated,
      { check: line.check, difficulty: line.dc },
      line.dc,
    );
    if (!ask) return;
    asks.push({
      label: checkLabel(definition, line.check),
      says: line.says,
      dc: line.dc,
      modifier: ask.modifier,
      lean: leaning(line),
      manner: isManner,
      check: line.check,
    });
  };
  for (const tell of tells) {
    if (tell.needs && !meets(tell.needs, tell.needsAny)) continue;
    if (tell.carries && !tell.carries.anyOf.some((ref) => carried.has(ref))) continue;
    add(tell, false);
  }
  if (manner) add(manner, true);
  return asks;
}

/** A passive score for one check: the base and the number, 5 more with advantage, 5 less without. */
function passive(definition: RulesetDefinition, ask: Ask): number {
  const base = definition.items?.passiveBase ?? 10;
  return base + ask.modifier + (ask.lean === "advantage" ? 5 : ask.lean === "disadvantage" ? -5 : 0);
}

/** What an inspection found: `fake` (suspect: something is off), `named` (what it truly is too),
 *  `genuine` (it looks the real thing, which a fake that fools the check also reads as), or `unsure`. */
export type RulesetInspectFound = "fake" | "named" | "genuine" | "unsure";

export interface RulesetInspection {
  found: RulesetInspectFound;
  /** The check rolled, its total and its difficulty. */
  check: string;
  total: number;
  dc: number;
  rolls: number[];
  /** What a success saw, for a fake. */
  says?: string;
}

/**
 * One spotter's inspection of an item: the best check they can make about it rolled with `roll`.
 * `truly` is what the item truly is, when it is a fake; `manner` is the seller's, when a dishonest
 * seller shows it. Null when there is nothing to check it by.
 */
export function inspectRulesetItem(input: {
  definition: RulesetDefinition;
  book: Pick<RulesetItemBook, "entries" | "itemOf">;
  stacks: readonly GameInventoryStack[];
  spotter: RulesetSpotter;
  item: string;
  truly?: string;
  manner?: RulesetSellerManner;
  roll: (sides: number) => number;
}): RulesetInspection | null {
  const { definition, book, stacks, spotter } = input;
  const tells = rulesetItemTells(book, input.item, input.truly);
  const asks = spotterAsks(definition, book, stacks, spotter, tells, input.manner);
  if (asks.length === 0) return null;
  // The best chance: their number against the difficulty, a lean counted as five.
  const best = asks.reduce((a, b) => (passive(definition, b) - b.dc > passive(definition, a) - a.dc ? b : a));
  const held = rulesetSheetItems(book, stacks, spotter.holder);
  const rolled = rollRulesetCheckOutsideFight(
    definition,
    { build: spotter.build, live: spotter.live },
    held,
    { target: null, modifier: best.modifier, difficulty: best.dc },
    input.roll,
    best.lean,
  );
  const said = { check: best.label, total: rolled.total, dc: rolled.difficulty, rolls: rolled.rolls };
  if (!rolled.success) return { found: "unsure", ...said };
  if (!input.truly) return { found: "genuine", ...said };
  const names = definition.items?.namesItAt;
  const named = !best.manner && names !== undefined && rolled.total - rolled.difficulty >= names;
  return { found: named ? "named" : "fake", ...said, says: best.says };
}

/**
 * Who in the party notices a fake about to be bought, and what they noticed: every spotter but the
 * buyer, each check they can make about it read as a passive score with no dice (or rolled, where the
 * ruleset's `items.warnBy` says "roll"). The first who meets a difficulty, in party order.
 */
export function noticeRulesetFake(input: {
  definition: RulesetDefinition;
  book: Pick<RulesetItemBook, "entries" | "itemOf">;
  stacks: readonly GameInventoryStack[];
  spotters: readonly RulesetSpotter[];
  truly: string;
  manner?: RulesetSellerManner;
  roll: (sides: number) => number;
}): { who: string; says: string } | undefined {
  const { definition, book, stacks } = input;
  const tells = rulesetItemTells(book, "", input.truly);
  for (const spotter of input.spotters) {
    const asks = spotterAsks(definition, book, stacks, spotter, tells, input.manner);
    if (definition.items?.warnBy === "roll") {
      const held = rulesetSheetItems(book, stacks, spotter.holder);
      for (const ask of asks) {
        const rolled = rollRulesetCheckOutsideFight(
          definition,
          { build: spotter.build, live: spotter.live },
          held,
          { target: null, modifier: ask.modifier, difficulty: ask.dc },
          input.roll,
          ask.lean,
        );
        if (rolled.success) return { who: spotter.name, says: ask.says };
      }
      continue;
    }
    const met = asks.find((ask) => passive(definition, ask) >= ask.dc);
    if (met) return { who: spotter.name, says: met.says };
  }
  return undefined;
}

/**
 * What a way of seeing through fakes shows of an item (1.802), one of `items.revealsFakes` cast on it:
 * a fake it reads (any fake when it names no `tags` or `items`, else one carrying one of the tags or
 * being one of the items) is named, unless the fake's `foolsReveal` lists it, when it shows as what it
 * passes for. A real item, or a fake it cannot read, shows nothing of the kind: genuine for a way that
 * reads any fake, else unsure.
 */
export function revealRulesetFake(
  book: Pick<RulesetItemBook, "itemOf">,
  way: { id: string; tags?: readonly string[]; items?: readonly string[] },
  truly: string | undefined,
): RulesetInspectFound {
  const fake = truly ? book.itemOf(truly)?.entry.item : undefined;
  const narrow = !!way.tags?.length || !!way.items?.length;
  if (fake?.foolsReveal?.includes(way.id)) return "genuine";
  const reads =
    !narrow ||
    way.tags?.some((tag) => fake?.tags?.includes(tag)) ||
    (truly !== undefined && way.items?.includes(truly));
  if (fake && reads) return "named";
  return narrow ? "unsure" : "genuine";
}
