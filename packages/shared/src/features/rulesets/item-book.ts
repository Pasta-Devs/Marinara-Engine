// ──────────────────────────────────────────────
// Game Mode rulesets: the items a game's inventory can hold
//
// A ruleset lists its items in catalogs that hold items. The inventory reads them through one book:
// which name is which item (a label, in any case), how many of one a stack holds, and what the
// screen and the Game Master are shown about it. The server builds the book from the catalogs it
// loads and the browser from the ones it fetches, so both read an item the same way.
// ──────────────────────────────────────────────
import { parseRulesetCombatDice, rulesetChargesStart, rulesetFoundStored } from "../ruleset-combat/dice.js";
import {
  rulesetCoinAmount,
  RULESET_ITEM_CHARGES_MAX,
  rulesetItemIssues,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetDefinition,
  type RulesetItemAttack,
  type RulesetItemUse,
  type RulesetItemEffect,
  type RulesetItemStat,
  type RulesetValueRef,
  type RulesetSheetBuild,
} from "../../schemas/ruleset.schema.js";
import { normalizeCharacterLookupName } from "../../utils/character-lookup-name.js";
import {
  gameInventoryBagKey,
  gameInventoryFoldStandIn,
  gameInventoryCoinRef,
  gameInventoryLooseNameKey,
  gameInventoryNameKey,
  type GameInventoryStack,
  type GameInventoryBearer,
  type GameInventoryCoin,
  type GameInventoryItemRules,
  type GameInventoryRulesetItem,
} from "../../utils/game-inventory-stacks.js";
import {
  inventRulesetItem,
  rulesetInventedItemId,
  rulesetInventedItemRef,
  rulesetInventedItemText,
  rulesetDefenseLabel,
  rulesetProposalParts,
  RULESET_INVENTED_ITEMS_MAX,
  type RulesetInventedItem,
} from "./invented-items.js";
import { catalogEntryHiddenByLayers, rulesetLayeredCurrencies, type RulesetLayerOptions } from "./layers.js";
import {
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  resolveRulesetValueRef,
  rulesetFormedItem,
  type RulesetSheetItem,
} from "./sheet-math.js";

/** One stat an item gives, in the ruleset's words. `text` is absent for a yes-or-no stat that is
 *  yes, whose label says it all. */
export interface RulesetItemStatFact {
  id: string;
  label: string;
  text?: string;
  /** Whether the Game Master is shown it. */
  promptVisible: boolean;
}

/** One thing an item does while worn or carried: on checks or saves (the labels of the skills or
 *  saves it is narrowed to, none for all of them), a lean, a number (`value`, signed, dice and all), or
 *  saves it makes fail. */
export interface RulesetItemEffectFact {
  /** Checks, saves, or one ability (its label in `names`); in a fight, attacks, defense (the
   *  ruleset's own word for it in `names`), speed, one of the fight's effects, kinds of harm kept off
   *  (in `names`), or conditions kept off (their labels in `names`). */
  to:
    | "checks"
    | "saves"
    | "ability"
    | "attacks"
    | "attacks-taken"
    | "checks-taken"
    | "save-difficulty"
    | "defense"
    | "speed"
    | "health-max"
    | "damage"
    | "damage-taken"
    | "effect"
    | "harm"
    | "conditions";
  names: string[];
  /** Exception tags beside each damage name, kept structured for translation (Capability API 1.132). */
  except?: string[][];
  /** What narrows damage on a hit (Capability API 1.133), kept as facts for localized screens. */
  damage?: {
    attacks?: "weapon" | "spell" | "any";
    blow?: "melee" | "ranged";
    ability?: string;
    type?: string;
    fromSource?: true;
    /** Only on blows of these types (1.792). */
    onTypes?: string[];
    /** Spent the first time it adds (1.792). */
    spentOnUse?: true;
  };
  /** Conditions and damage labels, and magic, that narrow this save modifier (1.134). */
  against?: { names: string[]; magic?: true };
  /** What the ruleset says the modifier does, said in place of the rest (1.378). */
  label?: string;
  change:
    | { mode: "advantage" | "disadvantage" }
    | { value: string }
    | { fails: true }
    | { atLeast: number }
    /** Defense never below this (1.406): a number, or the label of what it reads off the sheet. */
    | { floor: string }
    | { times: 0.5 | 2 }
    | { effect: string }
    | { hide: "resist" | "vulnerable" | "immune" }
    /** More weapon dice on a critical hit (Brutal Critical), summed over the levels that give them. */
    | { criticalDice: number };
}

/** A fight effect's own words, for the Game Master, by effect id. The ones about the holder's own
 *  checks, saves and attacks are said as leans on those instead. */
const FIGHT_EFFECT_TEXT: Record<string, string> = {
  "attacks-against-advantage": "attacks against them have advantage",
  "attacks-against-disadvantage": "attacks against them have disadvantage",
  "attacks-against-adjacent-advantage": "attacks against them from next to them have advantage",
  "attacks-against-far-disadvantage": "attacks against them from afar have disadvantage",
  "attacks-against-no-advantage": "no attack against them has advantage",
  "attacks-from-adjacent-critical": "a hit on them from next to them is critical",
  "cannot-act": "cannot act",
  "cannot-react": "cannot react",
  "speed-zero": "cannot move",
  "resist-all": "takes half of every harm",
};

/** What an item asks of whoever wears it, in the ruleset's words: the value's label, the least it may
 *  be, and what applies while they fall short. `of` says the value is a modifier rather than a score,
 *  or a count of items (`what` then names the kind counted, or is empty for any item). */
export interface RulesetItemRequirementFact {
  what: string;
  of?: "modifier" | "items";
  atLeast: number;
  otherwise: RulesetItemEffectFact[];
}

/** What an item is, as labels: what the screen and the Game Master show. */
export interface RulesetItemFacts {
  category: string;
  rarity?: string;
  tags: string[];
  /** The stats the item gives, in the order the ruleset declares them. */
  stats: RulesetItemStatFact[];
  /** What it costs, in the unit's own label ("8", "shillings"). */
  cost?: { amount: number; unit: string };
  /** What it does while worn, and while only carried. */
  worn?: RulesetItemEffectFact[];
  carried?: RulesetItemEffectFact[];
  requires?: RulesetItemRequirementFact[];
  attack?: RulesetItemAttackFact;
  use?: RulesetItemUseFact;
  /** Its switch (1.170): what it is called and the budget's label a fight turns it with. */
  toggle?: { label: string; budget: string };
}

/** What using an item does, as labels and numbers: the budget it spends (none when free), what it
 *  heals or deals, what it adds to hit where it rolls, the save it asks, the conditions it applies,
 *  its temporary points, how far it reaches, and what using it spends of it. */
export interface RulesetItemUseFact {
  budget?: string;
  kind: "attack" | "heal" | "buff" | "debuff" | "utility";
  amount?: string;
  type?: string;
  toHit?: string;
  /** A pool fight's per-die target for its roll to hit, as a weapon's. */
  target?: number;
  save?: { save: string; difficulty?: number; onSuccess: "none" | "half" | "negates" };
  applies?: string[];
  temporary?: string;
  range?: number;
  area?: { shape: "burst" | "cone" | "line" | "box" | "wall"; size: number };
  /** The ruleset's own distance unit, beside a range or an area. */
  unit?: string;
  consumes?: true;
  /** It is held by its user's concentration (1.174), as a scroll's spell is. */
  concentration?: true;
  /** The area it leaves, and for how many rounds (1.174). */
  zone?: { rounds: number };
  /** What it cures (1.176): conditions it ends (by label, at most `count`), the dying it steadies,
   *  and the dead it brings back within so many rounds. */
  ends?: { conditions: string[]; count?: number };
  stabilizes?: true;
  /** Its chance in 100 to backfire on its user as it is used (1.630), what it deals them, and whether
   *  it is destroyed. */
  backfires?: { chance: number; amount: string; damageType?: string; destroys?: true };
  revives?: { withinRounds: number; health: string };
  /** What one use spends of the charges the item holds at most, the rests (by label) that bring them
   *  back and how many (`"max"` or a sum), and the die it rolls to break when emptied. */
  charges?: {
    cost: number;
    max: number;
    /** The dice a stack is found holding (1.573), rather than full. */
    rolled?: string;
    /** `after` (1.556): the days, and the hours (a sum, perhaps dice), it waits once run out. */
    recharge?: { rests: string[]; amount: "max" | string; after?: { days?: number; hours?: string } };
    /** `regains` (1.271): the faces at or over `atLeast` give back `amount` charges. */
    breaksOn?: { die: number; atMost?: number; regains?: { atLeast: number; amount: string }; becomes?: string };
    /** Used on with none left (1.624): its chance in 100 of tearing, cumulative or not. */
    overuse?: { chance: number; cumulative?: true };
  };
  /** A pool it gives back some of, by the pool's label. */
  restore?: { pool: string; amount: string };
  /** The check its user passes before it works, by label, and the value off their sheet that skips it
   *  when it is high enough. No difficulty when it names a stat the item does not give. */
  gate?: {
    check: string;
    difficulty?: number;
    unless?: { what: string; of?: "modifier" | "items"; atLeast: number };
  };
}

/** A weapon's attack as labels and numbers: the budget it spends, what it adds to hit and deals, and
 *  how far it reaches and carries. Each sum is written in labels, digits and signs only ("Brawn/Wits +
 *  Scrap + 1", the best of the abilities split by "/"), so the screen and the Game Master read it
 *  alike; `proficiency` says the holder's proficiency bonus is added where they are proficient. */
export interface RulesetItemAttackFact {
  budget: string;
  toHit: string;
  proficiency?: true;
  /** A pool fight's per-die target for it. */
  target?: number;
  damage: string;
  type?: string;
  reach?: number;
  range?: { normal: number; long?: number };
  /** The ruleset's own distance unit, beside a reach or a range. */
  unit?: string;
  /** What it deals instead with a hand free beside it. */
  versatile?: string;
  /** What it shoots, by the tag's label: how many an attack, and the share picked up after a won
   *  fight. */
  ammo?: { what: string; per: number; recover?: number };
  /** How many it holds loaded, and the budget a reload spends, by its label. */
  clip?: { max: number; reload: string };
  /** Its other ways to attack, each by its label with what it changes. */
  modes?: Array<{ label: string; ammo?: number; toHit?: number; target?: number; targets?: number }>;
  /** A weapon for the off hand, and the budget its second attack spends, by its label. */
  offHand?: { budget: string };
  /** The least a hit with it deals. */
  floor?: number;
  /** The conditions it puts on a target, by their labels, when a hit deals enough: with the save
   *  that keeps one off and the save that ends one, by the save's label (1.169). */
  onHit?: Array<{
    condition: string;
    atLeast: number;
    rounds?: number;
    save?: { save: string; difficulty: number };
    saveEnds?: { save: string; difficulty: number; at: "turn-start" | "turn-end" | "damaged" };
  }>;
  /** Charges its holder may spend once it hits (1.273): what each adds, a charge more's, and the
   *  conditions it puts on the one hit, by their labels. */
  spends?: Array<{
    label: string;
    /** Or its own uses (1.534), and its amount none where it only puts conditions on. */
    charges?: number;
    uses?: number;
    amount?: string;
    type?: string;
    more?: { max: number; amount: string };
    onHit?: Array<{ condition: string; rounds?: number; save?: { save: string; difficulty: number } }>;
  }>;
  /** More damage on each hit (1.169): its amount, type, whom it reaches by the labels of the types
   *  and tags it names, whether only a critical hit carries it, and its own save. */
  plus?: Array<{
    amount: string;
    type?: string;
    against?: string[];
    critical?: true;
    /** Dealt only while the item's switch is on (1.170): the switch's label. */
    toggled?: string;
    save?: { save: string; difficulty: number; onSuccess: "none" | "half" };
  }>;
}

/** The item stats a weapon's attack reads (`{ "stat": id }` anywhere in it). */
export function rulesetItemAttackStats(attack: RulesetItemAttack): string[] {
  const reads = [
    attack.toHit.abilities,
    attack.toHit.skill,
    attack.toHit.bonus,
    attack.toHit.target,
    attack.damage.dice,
    attack.damage.abilities,
    attack.damage.bonus,
    attack.damage.type,
    attack.reach,
    attack.range?.normal,
    attack.range?.long,
    attack.versatile?.dice,
    attack.clip?.max,
    attack.floor,
  ];
  const ids = reads.flatMap((value) =>
    value && typeof value === "object" && !Array.isArray(value) && "stat" in value ? [value.stat] : [],
  );
  return [...new Set(ids)];
}

/** A sum as the item facts write one: the first part as it is, then each with its sign. Nothing is
 *  0. */
/** What a sheet bonus is called in an item's facts: the value's name on the sheet ("Archery"). */
function sheetBonusWords(definition: RulesetDefinition, ref: RulesetValueRef): string {
  const label = rulesetValueRefLabel(definition, ref);
  return label.of ? `${label.what} ${label.of}` : label.what;
}

function factSum(parts: ReadonlyArray<string | number>): string {
  const kept = parts.filter((part) => part !== "" && part !== 0);
  if (kept.length === 0) return "0";
  return kept
    .map((part, index) => {
      if (typeof part === "string") return index === 0 ? part : `+ ${part}`;
      if (index === 0) return String(part);
      return part < 0 ? `- ${-part}` : `+ ${part}`;
    })
    .join(" ");
}

/** An item's use as facts, each number read off the item's stat where it says so. */
function rulesetItemUseFacts(
  definition: RulesetDefinition,
  item: RulesetCatalogItem,
  use: RulesetItemUse,
): RulesetItemUseFact {
  const labelOf = (words: ReadonlyArray<{ id: string; label: string }>, id: string) =>
    words.find((word) => word.id === id)?.label ?? id;
  const read = (value: unknown): unknown => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
    const stat = (value as { stat?: unknown }).stat;
    return typeof stat === "string" ? item.stats?.[stat] : undefined;
  };
  const number = (value: unknown) => {
    const found = read(value);
    return typeof found === "number" && Number.isFinite(found) ? found : undefined;
  };
  const amount = (value: { dice?: string; flat?: number } | undefined) =>
    value ? factSum([value.dice ?? "", value.flat ?? 0]) : "";
  const attackFact = use.toHit
    ? rulesetItemAttackFacts(definition, item, { budget: "", toHit: use.toHit, damage: {} })
    : undefined;
  const difficulty = number(use.saveDifficulty);
  const gateDifficulty = use.gate ? rulesetItemGateDifficulty(item, use.gate) : undefined;
  const held = item.charges ? number(item.charges.max) : undefined;
  // As a fight reads it: a stat's number held to the most a written count may be.
  const max = held === undefined ? undefined : Math.min(RULESET_ITEM_CHARGES_MAX, Math.trunc(held));
  const dealt = amount(use.amount);
  const temporary = amount(use.temporary);
  return {
    ...(!use.free && use.budget ? { budget: labelOf(definition.combat?.economy.budgets ?? [], use.budget) } : {}),
    kind: use.kind,
    ...(dealt ? { amount: dealt } : {}),
    ...(use.damageType ? { type: use.damageType } : {}),
    ...(use.attackRoll && attackFact
      ? {
          toHit: attackFact.toHit + (attackFact.proficiency ? " + proficiency" : ""),
          ...(attackFact.target !== undefined ? { target: attackFact.target } : {}),
        }
      : {}),
    ...(use.save
      ? {
          save: {
            save: labelOf(definition.sheet.saves, use.save.save),
            ...(difficulty !== undefined ? { difficulty } : {}),
            onSuccess: use.save.onSuccess,
          },
        }
      : {}),
    ...(use.applies?.length
      ? { applies: use.applies.map((entry) => labelOf(definition.sheet.live.conditions, entry.condition)) }
      : {}),
    ...(temporary ? { temporary } : {}),
    ...(use.range !== undefined ? { range: use.range } : {}),
    ...(use.area ? { area: { shape: use.area.shape, size: use.area.size } } : {}),
    ...((use.range !== undefined || use.area) && definition.combat?.distance?.label
      ? { unit: definition.combat.distance.label }
      : {}),
    ...(use.consumes ? { consumes: true as const } : {}),
    ...(use.concentration ? { concentration: true as const } : {}),
    ...(use.zone ? { zone: { rounds: use.zone.rounds } } : {}),
    ...(use.ends
      ? {
          ends: {
            conditions: use.ends.conditions.map((id) => labelOf(definition.sheet.live.conditions, id)),
            ...(use.ends.count !== undefined ? { count: use.ends.count } : {}),
          },
        }
      : {}),
    ...(use.stabilizes ? { stabilizes: true as const } : {}),
    ...(use.backfires
      ? {
          backfires: {
            chance: use.backfires.chance,
            amount: amount(use.backfires.amount),
            ...(use.backfires.damageType ? { damageType: use.backfires.damageType } : {}),
            ...(use.backfires.destroys ? { destroys: true as const } : {}),
          },
        }
      : {}),
    ...(use.revives ? { revives: { withinRounds: use.revives.withinRounds, health: amount(use.revives.health) } } : {}),
    ...(use.charges !== undefined && max !== undefined
      ? {
          charges: {
            cost: use.charges,
            max,
            ...(item.charges?.rolled ? { rolled: item.charges.rolled } : {}),
            ...(item.charges?.recharge
              ? {
                  recharge: {
                    rests: item.charges.recharge.rests.map((rest) => labelOf(definition.rests, rest)),
                    amount:
                      item.charges.recharge.amount === "max" ? ("max" as const) : amount(item.charges.recharge.amount),
                    ...(item.charges.recharge.after
                      ? {
                          after: {
                            ...(item.charges.recharge.after.days ? { days: item.charges.recharge.after.days } : {}),
                            ...(item.charges.recharge.after.hours
                              ? { hours: amount(item.charges.recharge.after.hours) }
                              : {}),
                          },
                        }
                      : {}),
                  },
                }
              : {}),
            ...(item.charges?.overuse ? { overuse: { ...item.charges.overuse } } : {}),
            ...(item.charges?.breaksOn
              ? {
                  breaksOn: {
                    die: item.charges.breaksOn.die,
                    ...(item.charges.breaksOn.atMost !== undefined ? { atMost: item.charges.breaksOn.atMost } : {}),
                    // What it becomes, by its name where the ruleset's own catalogs hold it (1.272).
                    ...(item.charges.breaksOn.becomes !== undefined
                      ? { becomes: itemLabelOf(definition, item.charges.breaksOn.becomes) }
                      : {}),
                    ...(item.charges.breaksOn.regains
                      ? {
                          regains: {
                            atLeast: item.charges.breaksOn.regains.atLeast,
                            amount: amount(item.charges.breaksOn.regains.amount),
                          },
                        }
                      : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(use.restore
      ? {
          restore: {
            pool: labelOf(definition.sheet.live.pools, use.restore.pool),
            amount: amount(use.restore.amount),
          },
        }
      : {}),
    ...(use.gate
      ? {
          gate: {
            check: rulesetItemGateLabel(definition, use.gate),
            ...(gateDifficulty !== undefined ? { difficulty: gateDifficulty } : {}),
            ...(use.gate.unless
              ? {
                  unless: {
                    ...rulesetValueRefLabel(definition, use.gate.unless.value),
                    atLeast: use.gate.unless.atLeast,
                  },
                }
              : {}),
          },
        }
      : {}),
  };
}

/** A weapon's attack as facts, each value read off the item's stat where it says so. */
function rulesetItemAttackFacts(
  definition: RulesetDefinition,
  item: RulesetCatalogItem,
  attack: RulesetItemAttack,
): RulesetItemAttackFact {
  const stats = new Map((definition.items?.stats ?? []).map((stat) => [stat.id, stat]));
  const labelOf = (words: ReadonlyArray<{ id: string; label: string }>, id: string) =>
    words.find((word) => word.id === id)?.label ?? id;
  const read = (value: unknown): unknown => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
    const stat = (value as { stat?: unknown }).stat;
    return typeof stat === "string" ? item.stats?.[stat] : undefined;
  };
  const statLabel = (value: unknown): string | undefined => {
    const stat =
      value && typeof value === "object" && !Array.isArray(value) ? (value as { stat?: string }).stat : undefined;
    const read = stat !== undefined ? item.stats?.[stat] : value;
    if (typeof read !== "string" || !read) return undefined;
    const declared = stat !== undefined ? stats.get(stat) : undefined;
    return declared ? (statText(declared, read) ?? read) : read;
  };
  const abilities = (value: unknown) => {
    const ids = Array.isArray(value) ? value : typeof read(value) === "string" ? [read(value) as string] : [];
    return ids.map((id) => labelOf(definition.sheet.abilities, id)).join("/");
  };
  const number = (value: unknown) => {
    const found = read(value);
    return typeof found === "number" && Number.isFinite(found) ? found : 0;
  };
  const dice = (value: unknown) => {
    const found = read(value);
    return typeof found === "string" ? found : "";
  };
  const skill = read(attack.toHit.skill);
  const target = read(attack.toHit.target);
  const type = statLabel(attack.damage.type);
  const reach = number(attack.reach);
  const normal = attack.range ? number(attack.range.normal) : 0;
  const long = attack.range?.long !== undefined ? number(attack.range.long) : 0;
  const versatile = attack.versatile ? dice(attack.versatile.dice) : "";
  const unit = definition.combat?.distance?.label;
  const budgets = definition.combat?.economy.budgets ?? [];
  const clipMax = attack.clip ? number(attack.clip.max) : 0;
  const floor = attack.floor !== undefined ? number(attack.floor) : 0;
  return {
    budget: labelOf(budgets, attack.budget),
    toHit: factSum([
      abilities(attack.toHit.abilities),
      typeof skill === "string" ? labelOf(definition.sheet.skills, skill) : "",
      number(attack.toHit.bonus),
      // What the holder brings off their own sheet (1.95), by its name there.
      attack.toHit.sheetBonus ? sheetBonusWords(definition, attack.toHit.sheetBonus) : "",
    ]),
    ...(attack.toHit.proficiency ? { proficiency: true as const } : {}),
    ...(typeof target === "number" ? { target } : {}),
    damage: factSum([
      dice(attack.damage.dice),
      abilities(attack.damage.abilities),
      number(attack.damage.bonus),
      // What the holder brings off their own sheet (1.97), by its name there.
      attack.damage.sheetBonus ? sheetBonusWords(definition, attack.damage.sheetBonus) : "",
    ]),
    ...(type ? { type } : {}),
    ...(reach > 0 ? { reach } : {}),
    ...(normal > 0 ? { range: { normal, ...(long > normal ? { long } : {}) } } : {}),
    ...((reach > 0 || normal > 0) && unit ? { unit } : {}),
    ...(versatile ? { versatile } : {}),
    ...(attack.ammo
      ? {
          ammo: {
            what: labelOf(definition.items?.tags ?? [], attack.ammo.tag),
            per: attack.ammo.perAttack ?? 1,
            ...(attack.ammo.recover ? { recover: attack.ammo.recover } : {}),
          },
        }
      : {}),
    ...(attack.clip && clipMax >= 1 ? { clip: { max: clipMax, reload: labelOf(budgets, attack.clip.reload) } } : {}),
    ...(attack.modes?.length
      ? {
          modes: attack.modes.map((mode) => ({
            label: mode.label,
            ...(mode.ammo !== undefined ? { ammo: mode.ammo } : {}),
            ...(mode.toHit !== undefined ? { toHit: mode.toHit } : {}),
            ...(mode.target !== undefined ? { target: mode.target } : {}),
            ...(mode.targets !== undefined ? { targets: mode.targets } : {}),
          })),
        }
      : {}),
    ...(attack.offHand && definition.combat?.offHand
      ? { offHand: { budget: labelOf(budgets, definition.combat.offHand.budget) } }
      : {}),
    ...(floor >= 1 ? { floor } : {}),
    ...(attack.onHit?.length
      ? {
          onHit: attack.onHit.map((entry) => ({
            condition: labelOf(definition.sheet.live.conditions, entry.condition),
            atLeast: entry.atLeast,
            ...(entry.rounds !== undefined ? { rounds: entry.rounds } : {}),
            ...(entry.save
              ? { save: { save: labelOf(definition.sheet.saves, entry.save.save), difficulty: entry.save.difficulty } }
              : {}),
            ...(entry.saveEnds
              ? {
                  saveEnds: {
                    save: labelOf(definition.sheet.saves, entry.saveEnds.save),
                    difficulty: entry.saveEnds.difficulty,
                    at: entry.saveEnds.at,
                  },
                }
              : {}),
          })),
        }
      : {}),
    ...(attack.plus?.length
      ? {
          plus: attack.plus.map((clause) => {
            const kinds = definition.combat?.creatureTypes;
            const against = [
              ...(clause.targetIs?.types ?? []).map((id) => labelOf(kinds?.types ?? [], id)),
              ...(clause.targetIs?.tags ?? []).map((id) => labelOf(kinds?.tags ?? [], id)),
            ];
            const flat = clause.flat ?? 0;
            return {
              amount: clause.dice
                ? `${clause.dice}${flat > 0 ? `+${flat}` : flat < 0 ? String(flat) : ""}`
                : String(flat),
              ...(clause.type ? { type: clause.type } : {}),
              ...(against.length ? { against } : {}),
              ...(clause.when === "critical" ? { critical: true as const } : {}),
              ...(clause.when === "toggled" && item.toggle ? { toggled: item.toggle.label } : {}),
              ...(clause.save
                ? { save: { ...clause.save, save: labelOf(definition.sheet.saves, clause.save.save) } }
                : {}),
            };
          }),
        }
      : {}),
    ...(attack.spends?.length
      ? {
          spends: attack.spends.map((spend) => ({
            label: spend.label,
            ...(spend.charges !== undefined ? { charges: spend.charges } : {}),
            ...(spend.uses ? { uses: spend.uses.max } : {}),
            ...(spend.amount ? { amount: amountWords(spend.amount) } : {}),
            ...(spend.type ? { type: spend.type } : {}),
            ...(spend.chargeStep
              ? { more: { max: spend.chargeStep.max, amount: amountWords(spend.chargeStep.amount) } }
              : {}),
            ...(spend.onHit?.length
              ? {
                  onHit: spend.onHit.map((entry) => ({
                    condition: labelOf(definition.sheet.live.conditions, entry.condition),
                    ...(entry.rounds !== undefined ? { rounds: entry.rounds } : {}),
                    ...(entry.save
                      ? {
                          save: {
                            save: labelOf(definition.sheet.saves, entry.save.save),
                            difficulty: entry.save.difficulty,
                          },
                        }
                      : {}),
                  })),
                }
              : {}),
          })),
        }
      : {}),
  };
}

/** Dice and a flat part as words: "1d6", "2d10+2", "3". */
function amountWords(amount: { dice?: string; flat?: number }): string {
  const flat = amount.flat ?? 0;
  return amount.dice ? `${amount.dice}${flat > 0 ? `+${flat}` : flat < 0 ? String(flat) : ""}` : String(flat);
}

/** A gate's difficulty as a fight and the Use button read it: written, or the item's own stat, a
 *  whole number from 1 to 100. Undefined when it names a stat the item does not give. */
export function rulesetItemGateDifficulty(
  item: RulesetCatalogItem,
  gate: NonNullable<RulesetItemUse["gate"]>,
): number | undefined {
  const written = gate.difficulty;
  const found = typeof written === "number" ? written : item.stats?.[written.stat];
  return typeof found === "number" && Number.isFinite(found)
    ? Math.min(100, Math.max(1, Math.trunc(found)))
    : undefined;
}

/** What one bag's coins are worth, family by family, in each family's smallest coin, for the Game
 *  Master: "Coin worth 432 bits", or "no coins" when the bag holds none (a Game Master never told a purse
 *  is empty narrates a buy the Engine then refuses). Empty only when the game has no coins at all. */
export function rulesetPurseText(
  book: Pick<RulesetItemBook, "coins">,
  stacks: readonly GameInventoryStack[],
  holder: string | undefined,
): string {
  const bag = gameInventoryBagKey(holder);
  const families = new Map<string, { label: string; worth: number; smallest: { label: string; one?: string } }>();
  for (const coin of book.coins) {
    const family = coin.coin!.family;
    const known = families.get(family) ?? {
      label: coin.facts.category,
      worth: 0,
      smallest: { label: coin.name, one: coin.coin!.one },
    };
    if (coin.coin!.value === 1) known.smallest = { label: coin.name, one: coin.coin!.one };
    known.worth +=
      coin.coin!.value *
      stacks
        .filter((stack) => stack.item === coin.item && gameInventoryBagKey(stack.holder) === bag)
        .reduce((sum, stack) => sum + stack.quantity, 0);
    families.set(family, known);
  }
  const worth = [...families.values()]
    .filter((family) => family.worth > 0)
    .map((family) => `${family.label} worth ${rulesetCoinAmount(family.smallest, family.worth)}`)
    .join(", ");
  return worth || (families.size ? "no coins" : "");
}

/** What a use's gate rolls, in the ruleset's own words: a skill's or an ability's label, or the value
 *  off the sheet it reads ("Wits modifier"). */
export function rulesetItemGateLabel(definition: RulesetDefinition, gate: NonNullable<RulesetItemUse["gate"]>): string {
  const { check } = gate;
  if ("skill" in check) return definition.sheet.skills.find((entry) => entry.id === check.skill)?.label ?? check.skill;
  if ("ability" in check) {
    return definition.sheet.abilities.find((entry) => entry.id === check.ability)?.label ?? check.ability;
  }
  const { what, of } = rulesetValueRefLabel(definition, check.value);
  return of === "modifier" ? `${what} modifier` : what;
}

/** A value off the sheet by the ruleset's own label: an ability, a skill, a derived value. An ability's
 *  modifier (named directly or by a field) says so with `of`, a list's column is named with its list
 *  ("Weight (Gear)"), and a count of items names what it counts. An id stands in for a missing label. */
export function rulesetValueRefLabel(
  definition: RulesetDefinition,
  ref: RulesetValueRef,
): Pick<RulesetItemRequirementFact, "what" | "of"> {
  const sheet = definition.sheet;
  const find = (entries: ReadonlyArray<{ id: string; label: string }> | undefined, id: string) =>
    entries?.find((entry) => entry.id === id)?.label ?? id;
  if (ref.const !== undefined) return { what: String(ref.const) };
  if (ref.abilityScore !== undefined) return { what: find(sheet.abilities, ref.abilityScore) };
  if (ref.abilityMod !== undefined) return { what: find(sheet.abilities, ref.abilityMod), of: "modifier" };
  if (ref.abilityModFromField !== undefined)
    return { what: find(sheet.fields, ref.abilityModFromField), of: "modifier" };
  if (ref.derived !== undefined) return { what: find(sheet.derived, ref.derived) };
  if (ref.field !== undefined) return { what: find(sheet.fields, ref.field) };
  if (ref.skillMod !== undefined) return { what: find(sheet.skills, ref.skillMod) };
  if (ref.saveMod !== undefined) return { what: find(sheet.saves, ref.saveMod) };
  if (ref.liveTrack !== undefined) return { what: find(sheet.live.tracks, ref.liveTrack) };
  if (ref.livePool !== undefined) return { what: find(sheet.live.pools, ref.livePool) };
  if (ref.listSum) {
    const list = sheet.lists.find((entry) => entry.id === ref.listSum!.list);
    return {
      what: ref.listSum.count
        ? `rows (${list?.label ?? ref.listSum.list})`
        : `${find(list?.columns, ref.listSum.column!)} (${list?.label ?? ref.listSum.list})`,
    };
  }
  const items = definition.items;
  const stat = ref.itemStat!;
  if (stat.stat !== undefined) return { what: find(items?.stats, stat.stat) };
  const kinds = [
    stat.tag !== undefined ? find(items?.tags, stat.tag) : undefined,
    stat.category !== undefined ? find(items?.categories, stat.category) : undefined,
    stat.slot !== undefined ? find(items?.slots, stat.slot) : undefined,
  ];
  return { what: kinds.filter(Boolean).join(" "), of: "items" };
}

/** A requirement's value as the Game Master reads it: "Sinew", "Sinew modifier", "Heavy items". */
function requirementValueText(need: Pick<RulesetItemRequirementFact, "what" | "of">): string {
  if (need.of === "modifier") return `${need.what} modifier`;
  if (need.of === "items") return need.what ? `${need.what} items` : "items";
  return need.what;
}

/** One worn or carried effect as facts: each lean, each number and each set of saves it fails. */
export function rulesetItemEffectFacts(
  definition: RulesetDefinition,
  effect: RulesetItemEffect,
): RulesetItemEffectFact[] {
  const skillLabel = (id: string) => definition.sheet.skills.find((skill) => skill.id === id)?.label ?? id;
  const saveLabel = (id: string) => definition.sheet.saves.find((save) => save.id === id)?.label ?? id;
  const names = (to: "checks" | "saves", ids: readonly string[] | undefined) =>
    (ids ?? []).map(to === "checks" ? skillLabel : saveLabel);
  const facts: RulesetItemEffectFact[] = [];
  // The ruleset's own word for defense where it names one ("Guard"); a defense written as a number
  // has no name, and reads as "defense".
  const defense = rulesetDefenseLabel(definition) ?? "";
  for (const one of effect.effects ?? []) {
    const own = /^own-(checks|saves|attacks)-(advantage|disadvantage)$/.exec(one);
    if (!own) {
      facts.push({ to: "effect", names: [], change: { effect: one } });
      continue;
    }
    const to = own[1] as "checks" | "saves" | "attacks";
    const mode = own[2] as "advantage" | "disadvantage";
    const narrowed = to === "attacks" ? [] : names(to, to === "checks" ? effect.skills : effect.saves);
    facts.push({ to, names: narrowed, change: { mode } });
  }
  for (const modifier of effect.modifiers ?? []) {
    const to = modifier.to;
    // In the ruleset's own words where it gives them (1.378): "advantage on saves against being charmed".
    if (modifier.label) {
      facts.push({ to, names: [], label: modifier.label, change: { effect: modifier.label } });
      continue;
    }
    const damage =
      to === "damage" || to === "damage-taken"
        ? {
            damage: {
              ...(modifier.attacks ? { attacks: modifier.attacks } : {}),
              ...(modifier.blow ? { blow: modifier.blow } : {}),
              ...(modifier.ability
                ? {
                    ability:
                      definition.sheet.abilities.find((one) => one.id === modifier.ability)?.label ?? modifier.ability,
                  }
                : {}),
              ...(modifier.damageType ? { type: modifier.damageType } : {}),
              ...(modifier.fromSource ? { fromSource: modifier.fromSource } : {}),
              ...(modifier.onTypes ? { onTypes: modifier.onTypes } : {}),
              ...(modifier.spentOnUse ? { spentOnUse: modifier.spentOnUse } : {}),
            },
          }
        : {};
    const narrowed =
      to === "checks" || to === "saves" || to === "checks-taken"
        ? names(
            to === "saves" ? "saves" : "checks",
            to === "saves" ? (modifier.saves ?? effect.saves) : (modifier.skills ?? effect.skills),
          )
        : to === "defense" && defense
          ? [defense]
          : [];
    const against = modifier.against
      ? {
          against: {
            names: [
              ...(modifier.against.conditions ?? []).map(
                (id) => definition.sheet.live.conditions.find((one) => one.id === id)?.label ?? id,
              ),
              ...(modifier.against.damage ?? []),
            ],
            ...(modifier.against.magic ? { magic: true as const } : {}),
          },
        }
      : {};
    const dice = modifier.dice ? `${modifier.minus ? "-" : "+"}${modifier.dice}` : "";
    const flat = modifier.flat ? `${modifier.flat > 0 ? "+" : ""}${modifier.flat}` : "";
    if (dice || flat) facts.push({ to, names: narrowed, ...damage, ...against, change: { value: `${dice}${flat}` } });
    if (modifier.times) {
      facts.push({
        to,
        names: [],
        ...damage,
        change: { times: modifier.times },
      });
    }
    if (modifier.mode) facts.push({ to, names: narrowed, ...against, change: { mode: modifier.mode } });
    if (modifier.criticalDice)
      facts.push({ to, names: [], ...damage, change: { criticalDice: modifier.criticalDice } });
    if (modifier.atLeast !== undefined)
      facts.push({ to, names: [], change: { floor: floorLabel(definition, modifier.atLeast) } });
  }
  if (effect.failsSaves?.length) {
    facts.push({ to: "saves", names: names("saves", effect.failsSaves), change: { fails: true } });
  }
  for (const [id, change] of Object.entries(effect.abilities ?? {})) {
    const label = definition.sheet.abilities.find((ability) => ability.id === id)?.label ?? id;
    facts.push({
      to: "ability",
      names: [label],
      change: "set" in change ? { atLeast: change.set } : { value: `${change.add > 0 ? "+" : ""}${change.add}` },
    });
  }
  for (const hide of ["resist", "vulnerable", "immune"] as const) {
    if (effect[hide]?.length)
      facts.push({
        to: "harm",
        names: effect[hide]!.map((entry) => (typeof entry === "string" ? entry : entry.type)),
        ...(effect[hide]!.some((entry) => typeof entry !== "string")
          ? { except: effect[hide]!.map((entry) => (typeof entry === "string" ? [] : [...entry.except])) }
          : {}),
        change: { hide },
      });
  }
  if (effect.conditionImmunities?.length) {
    const label = (id: string) => definition.sheet.live.conditions.find((entry) => entry.id === id)?.label ?? id;
    facts.push({ to: "conditions", names: effect.conditionImmunities.map(label), change: { hide: "immune" } });
  }
  return facts;
}

/** What a floor under defense reads (1.406), as a reader would say it: its number, or the sheet value
 *  it reads in the sheet's own words. */
function floorLabel(definition: RulesetDefinition, atLeast: number | RulesetValueRef): string {
  return typeof atLeast === "number" ? String(atLeast) : sheetBonusWords(definition, atLeast);
}

/** One effect fact in plain words, as the Game Master reads it: "-1 on checks (Sneak)", "+1 Brawn". */
export function rulesetItemEffectText(fact: RulesetItemEffectFact): string {
  if (fact.label) return fact.label;
  const change = fact.change;
  const list = fact.names
    .map((name, index) => (fact.except?.[index]?.length ? `${name} except ${fact.except[index]!.join(" ")}` : name))
    .join(", ");
  if ("effect" in change) return FIGHT_EFFECT_TEXT[change.effect] ?? change.effect;
  if ("hide" in change) {
    return change.hide === "resist"
      ? `resists ${list}`
      : change.hide === "vulnerable"
        ? `vulnerable to ${list}`
        : `immune to ${list}`;
  }
  if (fact.damage) {
    const scope = [
      fact.damage.attacks && fact.damage.attacks !== "any" ? fact.damage.attacks : "",
      fact.damage.blow,
      fact.damage.ability ? `using ${fact.damage.ability}` : "",
      fact.damage.type,
      fact.damage.fromSource ? "from the condition's source only" : "",
      fact.damage.onTypes ? `only on ${fact.damage.onTypes.join(" or ")} damage` : "",
      fact.damage.spentOnUse ? "once" : "",
    ]
      .filter(Boolean)
      .join(", ");
    const amount =
      "times" in change ? (change.times === 0.5 ? "half" : "double") : "value" in change ? change.value : "";
    return `${amount} damage ${fact.to === "damage-taken" ? "taken" : "dealt"} on attack hits${scope ? ` (${scope})` : ""}`;
  }
  // The health maximum is only ever halved (the schema refuses anything else).
  if (fact.to === "health-max") return "half health maximum";
  if ("times" in change) return change.times === 0.5 ? "half speed" : "double speed";
  if ("floor" in change) return `defense at least ${change.floor}`;
  if (fact.to === "defense" || fact.to === "speed") {
    return `${"value" in change ? change.value : ""} ${fact.to === "speed" ? "speed" : list || "defense"}`;
  }
  if (fact.to === "ability") {
    const ability = fact.names.join(", ");
    return "atLeast" in fact.change
      ? `${ability} at least ${fact.change.atLeast}`
      : `${"value" in fact.change ? fact.change.value : ""} ${ability}`;
  }
  const against = fact.against
    ? ` against ${[...fact.against.names, ...(fact.against.magic ? ["magic"] : [])].join(" or ")}`
    : "";
  const to =
    fact.to === "attacks-taken"
      ? "attacks against them"
      : fact.to === "checks-taken"
        ? "checks to find them"
        : fact.to === "save-difficulty"
          ? "the difficulty of their saves"
          : fact.to;
  const which = `${to}${fact.names.length ? ` (${fact.names.join(", ")})` : ""}${against}`;
  if ("fails" in change) return `fails ${which}`;
  return `${"mode" in change ? change.mode : "value" in change ? change.value : ""} on ${which}`;
}

/** Whether an item is drawn as it is used (Capability API 1.808): it takes slots, and its category
 *  or one of its tags is one the ruleset's `items.drawOnUse` names. Weapons, in 5e: a sword is used
 *  out of its sheath and a bow off the back, and either goes in hand as a free swap. */
export function rulesetItemDrawsOnUse(
  definition: RulesetDefinition,
  item: { category?: string; tags?: readonly string[]; slots?: Readonly<Record<string, number>> },
): boolean {
  const draws = definition.items?.drawOnUse;
  if (!draws || !Object.values(item.slots ?? {}).some((count) => count > 0)) return false;
  return (
    (item.category !== undefined && (draws.categories ?? []).includes(item.category)) ||
    (item.tags ?? []).some((tag) => (draws.tags ?? []).includes(tag))
  );
}

export interface RulesetItemBookEntry extends GameInventoryRulesetItem {
  /** The catalog it is listed in; empty for an item the Game Master invented. */
  catalogId: string;
  /** The catalog entry, for a picker's search and filters. An invented item's is made from it. */
  entry: RulesetCatalogEntry;
  summary?: string;
  facts: RulesetItemFacts;
  /** Set on an item the Game Master invented, with what the Engine changed from its proposal. */
  invented?: { notes: string[] };
  /** Set on one of the ruleset's coins: its family, and what it is worth in the family's smallest. */
  coin?: { family: string; value: number; /** Its name for exactly one (1.89). */ one?: string };
}

/** The sheets a book reads what each character carries and binds off: the player's own, and every
 *  other party member's by the name their card and their bag have. One without a sheet reads a blank
 *  one, as the rest of the game does. */
export interface RulesetItemBookSheets {
  player?: RulesetSheetBuild;
  members?: ReadonlyArray<{ name: string; build: RulesetSheetBuild }>;
}

export interface RulesetItemBook extends GameInventoryItemRules {
  /** Every item a layer leaves in, catalog by catalog, in the order the ruleset lists them. Items the
   *  Game Master invented are not among them: nobody picks those off a list. */
  entries: readonly RulesetItemBookEntry[];
  /** Also an item a layer has taken out, so one already held still reads as itself, and an item the
   *  Game Master invented. */
  itemOf(item: string): RulesetItemBookEntry | undefined;
  itemNamed(name: string): RulesetItemBookEntry | undefined;
  /** The ruleset's coins, a book entry each, family by family. */
  coins: readonly RulesetItemBookEntry[];
  /** The game's invented items: the ones it was built with, and any `invent` has made since. */
  inventedItems(): RulesetInventedItem[];
  /** Whether `invent` has made an item since the book was built. */
  inventedChanged(): boolean;
}

function itemPrice(
  definition: RulesetDefinition,
  cost: { amount: number; unit: string },
  layerOptions: RulesetLayerOptions | null | undefined,
): { amount: number; unit: string } | undefined {
  const family = definition.items?.currencies?.find((each) => each.units.some((unit) => unit.id === cost.unit));
  const named = family?.units.find((unit) => unit.id === cost.unit);
  if (!family || !named) return cost;
  const left = rulesetLayeredCurrencies(definition, layerOptions).find((each) => each.id === family.id);
  if (!left) return undefined;
  if (left.units.some((unit) => unit.id === named.id)) {
    return { amount: cost.amount, unit: cost.amount === 1 && named.one ? named.one : named.label };
  }
  // The family's smallest coin, worth 1, is always left, so some coin pays the worth exactly.
  const worth = cost.amount * named.value;
  const unit = [...left.units].sort((a, b) => b.value - a.value).find((each) => worth % each.value === 0)!;
  const amount = worth / unit.value;
  return { amount, unit: amount === 1 && unit.one ? unit.one : unit.label };
}

function statText(stat: RulesetItemStat, value: string | number | boolean): string | undefined {
  if (stat.type === "boolean") return undefined;
  if (stat.type === "enum") return stat.valueLabels?.[String(value)] ?? String(value);
  return String(value);
}

/** An item's labels and stats, read against the ruleset's `items` block. A price named in a coin the
 *  game's layers took out is said at the same worth in the largest coin left that pays it exactly, and
 *  an item whose whole family of coins is gone has no price. */
export function rulesetItemFacts(
  definition: RulesetDefinition,
  item: RulesetCatalogItem,
  layerOptions?: RulesetLayerOptions | null,
): RulesetItemFacts {
  const block = definition.items;
  const labelOf = (words: ReadonlyArray<{ id: string; label: string }> | undefined, id: string) =>
    words?.find((word) => word.id === id)?.label ?? id;
  const stats = (block?.stats ?? []).flatMap((stat): RulesetItemStatFact[] => {
    const value = item.stats?.[stat.id];
    if (value === undefined || value === false || value === "") return [];
    const text = statText(stat, value);
    return [
      { id: stat.id, label: stat.label, ...(text !== undefined ? { text } : {}), promptVisible: stat.promptVisible },
    ];
  });
  const cost = item.cost ? itemPrice(definition, item.cost, layerOptions) : undefined;
  const worn = item.worn ? rulesetItemEffectFacts(definition, item.worn) : [];
  const carried = item.carried ? rulesetItemEffectFacts(definition, item.carried) : [];
  const requires = (item.requires ?? []).map((requirement) => ({
    ...rulesetValueRefLabel(definition, requirement.value),
    atLeast: requirement.atLeast,
    otherwise: rulesetItemEffectFacts(definition, requirement.otherwise),
  }));
  return {
    category: labelOf(block?.categories, item.category),
    ...(item.rarity ? { rarity: labelOf(block?.rarities, item.rarity) } : {}),
    tags: (item.tags ?? []).map((tag) => labelOf(block?.tags, tag)),
    stats,
    ...(cost ? { cost } : {}),
    ...(worn.length ? { worn } : {}),
    ...(carried.length ? { carried } : {}),
    ...(requires.length ? { requires } : {}),
    ...(item.attack ? { attack: rulesetItemAttackFacts(definition, item, item.attack) } : {}),
    ...(item.use ? { use: rulesetItemUseFacts(definition, item, item.use) } : {}),
    ...(item.toggle
      ? {
          toggle: {
            label: item.toggle.label,
            budget: labelOf(definition.combat?.economy.budgets ?? [], item.toggle.budget),
          },
        }
      : {}),
  };
}

/** An item's name by "<catalog>/<entry>", where the ruleset's own catalogs hold it; else the ref. */
function itemLabelOf(definition: RulesetDefinition, ref: string): string {
  const at = ref.indexOf("/");
  const catalog = definition.catalogs?.find((one) => one.id === ref.slice(0, at));
  return catalog?.entries?.find((entry) => entry.id === ref.slice(at + 1))?.label ?? ref;
}

/** An item's last-charge die as an inventory spends it (1.271): its `regains` dice read once. */
function bookBreaksOn(
  breaks: NonNullable<NonNullable<RulesetCatalogItem["charges"]>["breaksOn"]>,
): NonNullable<NonNullable<RulesetItemBookEntry["charges"]>["breaksOn"]> {
  const dice = breaks.regains?.amount.dice ? parseRulesetCombatDice(breaks.regains.amount.dice) : null;
  return {
    die: breaks.die,
    ...(breaks.atMost !== undefined ? { atMost: breaks.atMost } : {}),
    ...(breaks.becomes !== undefined ? { becomes: breaks.becomes } : {}),
    ...(breaks.regains
      ? {
          regains: {
            atLeast: breaks.regains.atLeast,
            count: dice?.count ?? 0,
            sides: dice?.sides ?? 0,
            flat: (dice?.flat ?? 0) + (breaks.regains.amount.flat ?? 0),
          },
        }
      : {}),
  };
}

/**
 * The book for a game: its ruleset's item catalogs, with the entries each has (`entries` by catalog
 * id; a catalog that could not be read is simply absent). `layerOptions` are the game's pinned layer
 * choices, which may take entries out. `plain` is whether something that is not one of these items
 * may be added: the ruleset's `freeform` for the player, and its `native` for the Game Master.
 * `invented` are the items the Game Master has invented in this game (read with
 * `readRulesetInventedItems`); the Game Master's book (`actor: "game-master"`) can invent more.
 */
export function rulesetItemBook(
  definition: RulesetDefinition,
  entries: Readonly<Record<string, readonly RulesetCatalogEntry[]>>,
  options: {
    layerOptions?: RulesetLayerOptions | null;
    plain?: "allow" | "refuse";
    actor?: "player" | "game-master";
    sheets?: RulesetItemBookSheets;
    invented?: readonly RulesetInventedItem[];
  } = {},
): RulesetItemBook {
  const carryStat = definition.items?.carry?.stat;
  const bookEntry = (
    ref: string,
    catalogId: string,
    entry: RulesetCatalogEntry & { item: RulesetCatalogItem },
  ): RulesetItemBookEntry => {
    const weight = carryStat ? entry.item.stats?.[carryStat] : undefined;
    const facts = rulesetItemFacts(definition, entry.item, options.layerOptions);
    const charges = facts.use?.charges;
    return {
      item: ref,
      name: entry.label,
      ...(entry.item.stack !== undefined ? { stack: entry.item.stack } : {}),
      ...(typeof weight === "number" && weight > 0 ? { weight } : {}),
      ...(entry.item.slots && Object.keys(entry.item.slots).length > 0 ? { slots: entry.item.slots } : {}),
      ...(rulesetItemDrawsOnUse(definition, entry.item) ? { drawOnUse: true as const } : {}),
      ...(entry.item.binds
        ? {
            binds: {
              ...(entry.item.binds.cursed ? { cursed: true } : {}),
              ...(entry.item.binds.needsWorn ? { needsWorn: entry.item.binds.needsWorn } : {}),
            },
          }
        : {}),
      ...(entry.item.service ? { service: true as const } : {}),
      ...(entry.item.toggle
        ? {
            toggle: {
              label: entry.item.toggle.label,
              ...(entry.item.toggle.freesSlots ? { freesSlots: true as const } : {}),
            },
          }
        : {}),
      ...(entry.item.forms
        ? { forms: [entry.item.forms.label, ...entry.item.forms.into.map((form) => form.label)] }
        : {}),
      ...(charges
        ? {
            charges: {
              cost: charges.cost,
              max: charges.max,
              ...(charges.breaksOn ? { breaksOn: bookBreaksOn(entry.item.charges!.breaksOn!) } : {}),
            },
          }
        : {}),
      catalogId,
      entry,
      ...(entry.summary ? { summary: entry.summary } : {}),
      facts,
    };
  };
  const all = new Map<string, RulesetItemBookEntry>();
  const visible: RulesetItemBookEntry[] = [];
  const offered = new Set<string>();
  const byName = new Map<string, RulesetItemBookEntry>();
  /** The names (own or other) two of the ruleset's items have. */
  const sharedNames = new Set<string>();
  const aliased: Array<{ read: RulesetItemBookEntry; aliases: readonly string[] }> = [];
  for (const catalog of definition.catalogs ?? []) {
    if (catalog.holds !== "items") continue;
    for (const entry of entries[catalog.id] ?? []) {
      if (!entry.item) continue;
      const read = bookEntry(`${catalog.id}/${entry.id}`, catalog.id, { ...entry, item: entry.item });
      all.set(read.item, read);
      if (catalogEntryHiddenByLayers(definition, options.layerOptions, catalog.id, entry)) continue;
      visible.push(read);
      offered.add(read.item);
      // Two items of one name: the first the ruleset lists is the one the name finds.
      const key = gameInventoryNameKey(entry.label);
      if (!byName.has(key)) byName.set(key, read);
      else if (byName.get(key)!.item !== read.item) sharedNames.add(key);
      if (entry.aliases) aliased.push({ read, aliases: entry.aliases });
    }
  }
  // Other names (1.788) find an item after every item's own name: "Plate" for Plate Armor.
  const aliasOnly = new Set<string>();
  for (const { read, aliases } of aliased)
    for (const alias of aliases) {
      const key = gameInventoryNameKey(alias);
      if (!byName.has(key)) {
        byName.set(key, read);
        aliasOnly.add(key);
      } else if (byName.get(key)!.item !== read.item) sharedNames.add(key);
    }
  // And last, any of those names with its words in another order or counted many ("Heavy Crossbow",
  // "Crossbows, heavy" for Crossbow, heavy: laptop playtest 2026-10-25). A loose name two items share
  // finds neither.
  const byLoose = new Map<string, RulesetItemBookEntry | null>();
  // And after that, without what a name says in brackets ("Arrows" for 5e's "Arrow (bow)": cloud
  // re-test 2026-10-25), the same way.
  const byBare = new Map<string, RulesetItemBookEntry | null>();
  // A bracket that is only a number is a count ("Poultices (2)"), which its reader takes off itself.
  const bare = (name: string) => gameInventoryLooseNameKey(name.replace(/\((?!\s*\d+\s*\))[^)]*\)/g, " "));
  // Of those a bare name finds, the plainest: "Arrow (bow)" for "Arrows", not "Arrow (+1)" (cloud
  // re-test 2026-10-26). The one of the ruleset's first rarity, or of none, is it, where only one is.
  const rarities = (definition.items?.rarities ?? []).map((one) => one.label);
  const rank = (read: RulesetItemBookEntry) => (read.facts.rarity ? rarities.indexOf(read.facts.rarity) : -1);
  const bareAll = new Map<string, RulesetItemBookEntry[]>();
  for (const [key, read] of byName) {
    const loose = gameInventoryLooseNameKey(key);
    if (loose) {
      const had = byLoose.get(loose);
      byLoose.set(loose, had === undefined || had?.item === read.item ? read : null);
    }
    const stripped = bare(key);
    if (!stripped) continue;
    const found = bareAll.get(stripped) ?? [];
    if (!found.some((one) => one.item === read.item)) found.push(read);
    bareAll.set(stripped, found);
  }
  for (const [key, found] of bareAll) {
    const least = Math.min(...found.map(rank));
    const plain = found.filter((one) => rank(one) === least);
    byBare.set(key, plain.length === 1 ? plain[0]! : null);
  }
  // The items the Game Master invented, found by name after the ruleset's own. One name may have
  // several: each telling of a turn that proposed it made its own, and a switch back to an older
  // telling must still find the one it holds. A name finds the newest.
  const invented = new Map<string, RulesetInventedItem>();
  const inventedByName = new Map<string, RulesetInventedItem[]>();
  // What this book made, by id, with what the Game Master was told: the same reply read again (its
  // answers before the save, then its change after) finds the same item.
  const madeHere = new Map<string, string[]>();
  const keep = (made: RulesetInventedItem) => {
    invented.set(made.id, made);
    const key = gameInventoryNameKey(made.name);
    inventedByName.set(key, [...(inventedByName.get(key) ?? []), made]);
    const ref = rulesetInventedItemRef(made.id);
    all.set(ref, {
      ...bookEntry(ref, "", {
        id: made.id,
        label: made.name,
        ...(made.summary ? { summary: made.summary } : {}),
        item: made.item,
      }),
      invented: { notes: made.notes ?? [] },
    });
    offered.add(ref);
  };
  for (const made of options.invented ?? []) {
    if (invented.size >= RULESET_INVENTED_ITEMS_MAX) break;
    if (!invented.has(made.id)) keep(made);
  }
  // The ruleset's coins, a book entry each, so a stack of them weighs what its family says (one of
  // the carry stat for every `perWeight` of them), is placed by the carrying rule, and reads as itself.
  // They are no catalog's, so no picker list and no loot filter ever finds one among the items. A coin
  // a layer took out still reads as itself where it is held, and is otherwise never offered, paid,
  // earned or dropped.
  const coins: RulesetItemBookEntry[] = [];
  const families = new Map<string, GameInventoryCoin[]>();
  const left = new Set(
    rulesetLayeredCurrencies(definition, options.layerOptions).flatMap((family) => family.units.map((unit) => unit.id)),
  );
  for (const family of definition.items?.currencies ?? []) {
    const members = family.units
      .filter((unit) => left.has(unit.id))
      .map((unit) => ({ item: gameInventoryCoinRef(unit.id), name: unit.label, value: unit.value }))
      .sort((a, b) => b.value - a.value);
    for (const unit of family.units) {
      const read: RulesetItemBookEntry = {
        item: gameInventoryCoinRef(unit.id),
        name: unit.label,
        ...(family.perWeight ? { weight: 1 / family.perWeight } : {}),
        catalogId: "",
        entry: { id: unit.id, label: unit.label },
        facts: { category: family.label, tags: [], stats: [] },
        coin: { family: family.id, value: unit.value, ...(unit.one ? { one: unit.one } : {}) },
      };
      all.set(read.item, read);
      if (!left.has(unit.id)) continue;
      offered.add(read.item);
      coins.push(read);
      families.set(read.item, members);
    }
  }
  /** The coins some price of the book is written in, which change is given in where they make it. */
  let pricedIn: Set<string> | undefined;
  const usualOf = (family: readonly GameInventoryCoin[]) => {
    pricedIn ??= new Set(
      visible.flatMap((one) => (one.entry.item?.cost?.unit ? [gameInventoryCoinRef(one.entry.item.cost.unit)] : [])),
    );
    const usual = family.filter((coin) => pricedIn!.has(coin.item)).map((coin) => coin.item);
    return usual.length > 0 && usual.length < family.length ? { usual } : {};
  };
  /** The coin a name is: its id or label, one of it or many ("penny", "pennies"), any case. */
  const coinNamed = (name: string) => {
    const one = (text: string) => gameInventoryNameKey(text).replace(/ies$/, "y").replace(/s$/, "");
    const wanted = one(name);
    const found = coins.find((coin) => one(coin.entry.id) === wanted || one(coin.name) === wanted);
    return found
      ? {
          coin: { item: found.item, name: found.name, value: found.coin!.value },
          family: families.get(found.item)!,
          ...usualOf(families.get(found.item)!),
        }
      : undefined;
  };
  /** The ruleset's item a name's last words are, after a word or more in front of them that only say
   *  what it is like: "Wooden Shield" is 5e's Shield (laptop 2026-10-26: the Game Master gave a
   *  "Wooden Shield", which was no item, so it stayed a plain one nobody could equip). The longest
   *  such run that is exactly one item's own or other name finds it; a name two items have finds
   *  neither. Only a name of plain words: one with a comma is a list, and a bracket or a "+1" says more
   *  than a word in front does; and a number in front is a count ("2 Javelin"), not a word. */
  const byLastWords = (name: string): RulesetItemBookEntry | undefined => {
    const words = name.trim().split(/\s+/u);
    if (words.length < 2 || !/^[\p{L}\p{N}' -]+$/u.test(name.trim())) return undefined;
    for (let from = 1; from < words.length; from++) {
      if (!/\p{L}/u.test(words[from - 1]!)) return undefined;
      const key = gameInventoryNameKey(words.slice(from).join(" "));
      if (sharedNames.has(key)) return undefined;
      // Past one word in front, only an item's own name: "Raw deer hide" is no Hide Armor, whose
      // other name is "Hide" (laptop room playtest 2026-10-30).
      if (from > 1 && aliasOnly.has(key)) continue;
      const found = byName.get(key);
      if (found) return found;
    }
    return undefined;
  };
  const itemNamed = (name: string): RulesetItemBookEntry | undefined => {
    const key = gameInventoryNameKey(name);
    const made = inventedByName.get(key)?.at(-1);
    const coin = coinNamed(name);
    // Or by its ref, catalog and id, which no name looks like (#8271: a buy of
    // "equipment/rope-hempen-50-feet" refused as an unknown item). A bare id is still no name.
    const ref = name.trim();
    return (
      byName.get(key) ??
      (made ? all.get(rulesetInventedItemRef(made.id)) : coin ? all.get(coin.coin.item) : undefined) ??
      (offered.has(ref) ? all.get(ref) : undefined) ??
      byLoose.get(gameInventoryLooseNameKey(name)) ??
      byBare.get(bare(name)) ??
      byLastWords(name)
    );
  };
  /** The ruleset's own weapon of this category whose name shares the most words with `name` (a word
   *  counts where either holds the other, "crossbow" and "bow"), or the first of them. */
  const weaponLike = (category: string, name: string): RulesetItemBookEntry | undefined => {
    const words = (text: string) =>
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length >= 3);
    const wanted = words(name);
    let best: RulesetItemBookEntry | undefined;
    let most = -1;
    for (const entry of visible) {
      if (entry.entry.item?.category !== category || !entry.entry.item.attack) continue;
      const shared = words(entry.name).filter((word) =>
        wanted.some((each) => each.includes(word) || word.includes(each)),
      ).length;
      if (shared > most) {
        best = entry;
        most = shared;
      }
    }
    return best;
  };
  /** The proposal made again as a weapon like `weapon`: its attack, and the stats that attack reads
   *  which the proposal left out. Undefined when the item could not be worn with it. */
  const armedLike = (
    proposal: Parameters<typeof inventRulesetItem>[1],
    plain: NonNullable<ReturnType<typeof inventRulesetItem>>,
    weapon: RulesetItemBookEntry,
  ) => {
    const attack = weapon.entry.item!.attack!;
    const own = plain.item.stats ?? {};
    const theirs = weapon.entry.item!.stats ?? {};
    const read = rulesetItemAttackStats(attack).filter((id) => own[id] === undefined && theirs[id] !== undefined);
    const stats = { ...Object.fromEntries(read.map((id) => [id, String(theirs[id])])), ...(proposal.stats ?? {}) };
    const made = read.length > 0 ? (inventRulesetItem(definition, { ...proposal, stats }, undefined) ?? plain) : plain;
    const item = { ...made.item, attack };
    return rulesetItemIssues(definition, item).length === 0 ? { ...made, item } : undefined;
  };
  const invent: GameInventoryItemRules["invent"] = (written, stacks) => {
    const proposal = rulesetProposalParts(definition, written);
    const text = rulesetInventedItemText(proposal);
    if (!text.name) return { refused: "unreadable" };
    const key = gameInventoryNameKey(text.name);
    // Or by its words in another order or written another way (laptop playtest 2026-10-30: an
    // invented "Arrow +1" with "+1 attacks" carried added 1 to every attack, the Rapier's too, where
    // the ruleset's own Arrow (+1) rides only its own shots).
    const own = byName.get(key) ?? byLoose.get(gameInventoryLooseNameKey(text.name)) ?? undefined;
    if (own) return { item: own.item, notes: [`${own.name} is one of this ruleset's own items, so it is that item.`] };
    if (definition.items?.propose === false) return { refused: "no-invention" };
    // One of that name the game holds is that item: a proposal never changes it. So is one this
    // book made. Otherwise the proposal is an item of its own, even when an older one has the name
    // (another telling of the turn may still hold that one), and saving keeps only what is held.
    const named = inventedByName.get(key) ?? [];
    const held = named.find((made) => stacks.some((stack) => stack.item === rulesetInventedItemRef(made.id)));
    if (held) return { item: rulesetInventedItemRef(held.id), notes: [] };
    const again = named.find((made) => madeHere.has(made.id));
    if (again) return { item: rulesetInventedItemRef(again.id), notes: madeHere.get(again.id)! };
    if (invented.size >= RULESET_INVENTED_ITEMS_MAX) return { refused: "too-many" };
    const likeText = proposal.like?.trim();
    const like = likeText ? (offered.has(likeText) ? all.get(likeText) : itemNamed(likeText)) : undefined;
    const plain = inventRulesetItem(definition, proposal, like?.entry.item);
    if (!plain || rulesetItemIssues(definition, plain.item).length > 0) return { refused: "unreadable" };
    const missed = likeText && !like ? [`No item "${likeText.slice(0, 60)}" to start from.`] : [];
    // A weapon proposed with nothing to start from fights as the ruleset's own weapon of its category
    // it is most like by name, or else the first: a small model describes the weapon and leaves
    // `like` out, and a weapon with no attack is never offered in a fight. The stats its attack reads
    // that the proposal left out come from that weapon, as `like` would bring them, and are held to
    // the rarity's caps with the rest. None of it applies to an item that could never be worn.
    const weapon = like || plain.item.attack ? undefined : weaponLike(plain.item.category, text.name);
    const armed = weapon ? armedLike(proposal, plain, weapon) : undefined;
    const made = armed ?? plain;
    const fights = armed ? [`It fights as ${weapon!.name} does.`] : [];
    const notes = [...missed, ...made.notes, ...fights];
    const id = rulesetInventedItemId(text.name, (taken) => invented.has(taken));
    keep({ id, ...text, item: made.item, ...(notes.length ? { notes } : {}) });
    madeHere.set(id, [...missed, ...made.promptNotes, ...fights]);
    return { item: rulesetInventedItemRef(id), notes: madeHere.get(id)! };
  };
  return {
    entries: visible,
    coins,
    ...(coins.length > 0 ? { coinNamed } : {}),
    itemOf: (item) => all.get(item),
    offers: (item) => offered.has(item),
    itemNamed,
    inventedItems: () => [...invented.values()],
    inventedChanged: () => madeHere.size > 0,
    ...(options.actor === "game-master" && definition.items ? { invent } : {}),
    plain: options.plain ?? "allow",
    ...(options.actor ? { actor: options.actor } : {}),
    ...(options.actor === "game-master" && (definition.items?.market || definition.items?.lootTables?.length)
      ? { sourcedOnly: (item: string) => all.get(item)?.entry.item?.use?.consumes === true }
      : {}),
    ...(definition.items?.slots?.length
      ? { slots: definition.items.slots.map(({ id, label, count }) => ({ id, label, count })) }
      : {}),
    ...(definition.items?.carry || definition.items?.binding
      ? { bearer: rulesetItemBearers(definition, options.sheets) }
      : {}),
    ...(definition.items?.carry?.unit ? { weightUnit: definition.items.carry.unit } : {}),
  };
}

/**
 * What each character carries and binds, read off their sheet: the ruleset's `carry` values and its
 * binding maximum, worked out once per character. These are read without live state (the ruleset is
 * checked for that at import), so a sheet's build is all they need.
 */
export function rulesetItemBearers(
  definition: RulesetDefinition,
  sheets: RulesetItemBookSheets = {},
): (holder: string | undefined) => GameInventoryBearer {
  const block = definition.items;
  const read = new Map<string, GameInventoryBearer>();
  const buildOf = (holder: string | undefined): RulesetSheetBuild => {
    if (!holder) return sheets.player ?? defaultRulesetSheetBuild(definition);
    const key = normalizeCharacterLookupName(holder);
    return (
      sheets.members?.find((member) => normalizeCharacterLookupName(member.name) === key)?.build ??
      defaultRulesetSheetBuild(definition)
    );
  };
  return (holder) => {
    const key = holder ? normalizeCharacterLookupName(holder) : "";
    const known = read.get(key);
    if (known) return known;
    const build = buildOf(holder);
    const evaluated = evaluateRulesetSheet(definition, build);
    const value = (ref: Parameters<typeof resolveRulesetValueRef>[2] | undefined) =>
      ref ? resolveRulesetValueRef(definition, build, ref, evaluated) : undefined;
    const encumberedAbove = value(block?.carry?.encumberedAbove);
    const limit = value(block?.carry?.limit);
    const bindingMax = value(block?.binding?.max);
    const bearer: GameInventoryBearer = {
      ...(encumberedAbove !== undefined ? { encumberedAbove } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(bindingMax !== undefined ? { bindingMax: Math.max(0, Math.floor(bindingMax)) } : {}),
    };
    read.set(key, bearer);
    return bearer;
  };
}

/** What a stack of an item with rolled charges holds before anything spent or gained them (1.573),
 *  against its written most or its stat's. */
function foundCharges(item: RulesetCatalogItem, stackId: string): number {
  const most = item.charges?.max;
  const read = typeof most === "number" ? most : most ? item.stats?.[most.stat] : undefined;
  const max = typeof read === "number" && Number.isFinite(read) ? Math.max(0, Math.trunc(read)) : 0;
  return rulesetChargesStart(item.charges ?? {}, Math.min(RULESET_ITEM_CHARGES_MAX, max), stackId);
}

/**
 * The items one bag holds, as a sheet reads them (`itemStat`): each stack of one of the ruleset's
 * items in it, with whether it is worn. An item that takes slots is worn while equipped, one that
 * binds while bound, one that does both while both, and one that does neither never. A plain item is
 * none of the ruleset's and is left out. `holder` is as a stack has it, absent for the player.
 */
export function rulesetSheetItems(
  book: Pick<RulesetItemBook, "itemOf">,
  stacks: readonly GameInventoryStack[],
  holder: string | undefined,
): RulesetSheetItem[] {
  const bag = gameInventoryBagKey(holder);
  const held = stacks.flatMap((stack) => {
    if (!stack.item || gameInventoryBagKey(stack.holder) !== bag) return [];
    const made = book.itemOf(stack.item)?.entry.item;
    if (!made) return [];
    // In another form (1.575): that form's item's attack, worn effect and switch.
    const formRef = stack.form ? made.forms?.into[stack.form - 1]?.item : undefined;
    const formItem = formRef ? book.itemOf(formRef)?.entry.item : undefined;
    const item = formItem ? rulesetFormedItem(made, formItem) : made;
    const known = stack.truly ? book.itemOf(stack.truly) : undefined;
    const truly = known?.entry.item ? { item: known.entry.item, name: known.name } : undefined;
    const takesSlots = Object.values(item.slots ?? {}).some((count) => count > 0);
    const binds = !!item.binds;
    const worn = (takesSlots || binds) && (!takesSlots || stack.equipped === true) && (!binds || stack.bound === true);
    // Drawn as it is used (1.808): a fight offers it while it is only carried, and draws it as it is used.
    const drawOnUse = book.itemOf(stack.item)?.drawOnUse === true;
    return [
      {
        item,
        quantity: stack.quantity,
        worn,
        ...(drawOnUse ? { drawOnUse: true as const } : {}),
        ...(drawOnUse && stack.bound ? { bound: true as const } : {}),
        name: stack.name,
        stack: { id: stack.id, ref: stack.item, ...(stack.holder !== undefined ? { holder: stack.holder } : {}) },
        ...(stack.loaded !== undefined ? { loaded: stack.loaded } : {}),
        ...(stack.on ? { on: true as const } : {}),
        ...(formItem ? { form: stack.form } : {}),
        ...(stack.charges !== undefined
          ? { charges: stack.charges }
          : item.charges?.rolled
            ? { charges: foundCharges(item, stack.id) }
            : {}),
        ...(stack.corroded ? { corroded: stack.corroded } : {}),
        ...(stack.absorbedEver ? { absorbedEver: stack.absorbedEver } : {}),
        ...(stack.callRoll ? { callRoll: stack.callRoll } : {}),
        ...(stack.usesLeft ? { usesLeft: stack.usesLeft } : {}),
        // Found holding some (1.576) until a fight stores or casts out of it.
        ...(stack.storedEntries
          ? { storedEntries: stack.storedEntries }
          : item.stores?.found
            ? { storedEntries: rulesetFoundStored(item.stores, stack.id) }
            : {}),
        ...(truly ? { truly } : {}),
      },
    ];
  });
  // A binding that needs other items worn holds only while they are (1.313): a stack left bound
  // after its belt came off by some other road is still not worn.
  for (;;) {
    const unmet = held.find(
      (one) =>
        one.worn &&
        one.item.binds?.needsWorn?.some(
          (group) => !held.some((other) => other !== one && other.worn && group.anyOf.includes(other.stack!.ref)),
        ),
    );
    if (!unmet) return held;
    unmet.worn = false;
  }
}

/** Each party card's items, as its sheet reads them: the card read for the player (the one named
 *  for who the chat plays as, else the first) reads the player's bag, and every other card its own,
 *  by its name, as the inventory keeps them. */
export function rulesetCardItems(
  book: Pick<RulesetItemBook, "itemOf">,
  stacks: readonly GameInventoryStack[],
  cardNames: readonly string[],
  playerName?: string | null,
): (cardName: string) => RulesetSheetItem[] {
  const holderOf = rulesetCardHolder(cardNames, playerName);
  const key = normalizeCharacterLookupName;
  // No card is the player's own (a game with no persona): the first card stands in for the player
  // and reads the player's bag, but what the Game Master puts in its own name is its too.
  const standIn = !playerName || !cardNames.some((name) => key(name) === key(playerName));
  return (cardName) => {
    const holder = holderOf(cardName);
    if (holder !== null || !standIn || !stacks.some((stack) => stack.holder && key(stack.holder) === key(cardName)))
      return rulesetSheetItems(book, stacks, holder ?? undefined);
    // One list, so a binding that needs another item worn sees both bags.
    const own = gameInventoryBagKey(cardName);
    const moved = new Map(
      stacks.flatMap((stack) =>
        stack.holder && gameInventoryBagKey(stack.holder) === own ? [[stack.id, stack.holder] as const] : [],
      ),
    );
    const read = rulesetSheetItems(book, gameInventoryFoldStandIn(stacks, cardName), undefined);
    // Each still says whose bag it is in, for whatever changes it.
    return read.map((held) => {
      const holder = held.stack ? moved.get(held.stack.id) : undefined;
      return holder && held.stack ? { ...held, stack: { ...held.stack, holder } } : held;
    });
  };
}

/** Whose bag a party card's items are in (1.721): the card read for the player (the one named for
 *  who the chat plays as, else the first) carries the player's own, null; every other card its own,
 *  by its name. */
export function rulesetCardHolder(
  cardNames: readonly string[],
  playerName?: string | null,
): (cardName: string) => string | null {
  const key = normalizeCharacterLookupName;
  const player = (playerName ? cardNames.find((name) => key(name) === key(playerName)) : undefined) ?? cardNames[0];
  return (cardName) => (player !== undefined && key(cardName) === key(player) ? null : cardName);
}

/** The item catalogs a ruleset declares: the ones the book is built from. */
export function rulesetItemCatalogIds(definition: RulesetDefinition): string[] {
  return (definition.catalogs ?? []).filter((catalog) => catalog.holds === "items").map((catalog) => catalog.id);
}

/** Most of an item's description the Game Master reads, cut at a sentence where one ends in time. */
const PROMPT_SUMMARY_LIMIT = 320;

/** An item's description for the Game Master, short: whole sentences up to the limit. */
function promptSummary(summary: string): string {
  const text = summary.replace(/\s+/g, " ").trim();
  if (text.length <= PROMPT_SUMMARY_LIMIT) return text;
  const cut = text.slice(0, PROMPT_SUMMARY_LIMIT);
  const end = cut.lastIndexOf(". ");
  return end > PROMPT_SUMMARY_LIMIT / 4 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}

/** An item's facts as one line for the Game Master: category, rarity and tags, then the stats the
 *  ruleset shows it, such as "Weapon, Common, Thrown; Damage 1d6, Reach close". An item with no rules
 *  of its own (no attack, use, toggle or effects) also carries its description, so the Game Master
 *  reads what it is instead of making it up (playtest 2026-10-31: a family-named Arrow of Slaying
 *  became one for "wyverns"). */
export function rulesetItemPromptFacts(facts: RulesetItemFacts, summary?: string): string {
  const kind = [facts.category, facts.rarity, ...facts.tags].filter(Boolean).join(", ");
  const stats = facts.stats
    .filter((stat) => stat.promptVisible)
    .map((stat) => (stat.text !== undefined ? `${stat.label} ${stat.text}` : stat.label))
    .join(", ");
  const effects = (["worn", "carried"] as const).flatMap((when) =>
    facts[when]?.length ? [`${when}: ${facts[when]!.map(rulesetItemEffectText).join(", ")}`] : [],
  );
  const needs = (facts.requires ?? []).map(
    (need) =>
      `needs ${requirementValueText(need)} ${need.atLeast}, otherwise ${need.otherwise.map(rulesetItemEffectText).join(", ")}`,
  );
  return [
    kind,
    stats,
    facts.cost ? `costs ${facts.cost.amount} ${facts.cost.unit}` : "",
    ...effects,
    ...needs,
    facts.attack ? rulesetItemAttackText(facts.attack) : "",
    facts.use ? rulesetItemUseText(facts.use) : "",
    facts.toggle ? `${facts.toggle.label} turned on or off (${facts.toggle.budget})` : "",
    summary?.trim() && !facts.attack && !facts.use && !facts.toggle && !effects.length && !needs.length
      ? promptSummary(summary)
      : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/** A weapon's attack in the Game Master's words: "attack (Act): Brawn + 1 to hit, 1d6 + Brawn cut,
 *  reach 2 paces, range 10 to 20 paces, 1d8 with a hand free". */
/** One of a weapon's modes for the Game Master: its label, and what it changes. */
function rulesetItemModeText(mode: NonNullable<RulesetItemAttackFact["modes"]>[number]): string {
  const signed = (value: number) => (value > 0 ? `+${value}` : String(value));
  const parts = [
    mode.ammo !== undefined ? `${mode.ammo} shots` : "",
    mode.toHit !== undefined ? `${signed(mode.toHit)} to hit` : "",
    mode.target !== undefined ? `target ${signed(mode.target)}` : "",
    mode.targets !== undefined ? `up to ${mode.targets} targets` : "",
  ].filter(Boolean);
  return parts.length ? `${mode.label} (${parts.join(", ")})` : mode.label;
}

/** An item's use for the Game Master: what it spends, what it does, and what using it costs of it. */
export function rulesetItemUseText(use: RulesetItemUseFact): string {
  return `use (${use.budget ?? "free"}): ${[
    ...rulesetItemUseDoes(use),
    use.consumes ? "used up" : "",
    use.concentration ? "concentration" : "",
    use.zone ? `the area stays ${use.zone.rounds} round${use.zone.rounds === 1 ? "" : "s"}` : "",
    use.ends
      ? `ends ${use.ends.count !== undefined && use.ends.count < use.ends.conditions.length ? `${use.ends.count} of ` : ""}${use.ends.conditions.join(", ")}`
      : "",
    use.stabilizes ? "stabilizes the dying" : "",
    use.backfires
      ? `${use.backfires.chance}% each use to backfire for ${use.backfires.amount}${use.backfires.damageType ? ` ${use.backfires.damageType}` : ""} to its user${use.backfires.destroys ? " and be destroyed" : ""}`
      : "",
    use.revives
      ? `revives one dead no longer than ${use.revives.withinRounds} round${use.revives.withinRounds === 1 ? "" : "s"} at ${use.revives.health}`
      : "",
    use.charges ? `spends ${use.charges.cost} of ${use.charges.max} charges` : "",
    use.charges?.recharge
      ? `regains ${use.charges.recharge.amount === "max" ? "all" : use.charges.recharge.amount}${use.charges.recharge.rests.length ? ` on ${use.charges.recharge.rests.join(" or ")}` : ""}${use.charges.recharge.after ? `${use.charges.recharge.rests.length ? " or" : ""} once ${[use.charges.recharge.after.days ? `${use.charges.recharge.after.days} days` : "", use.charges.recharge.after.hours ? `${use.charges.recharge.after.hours} hours` : ""].filter(Boolean).join(" and ")} of game time have passed since it ran out` : ""}`
      : "",
    use.charges?.breaksOn?.atMost !== undefined
      ? `${use.charges.breaksOn.becomes ? `becomes ${use.charges.breaksOn.becomes}` : "breaks"} on ${rulesetBreakFaces({ atMost: use.charges.breaksOn.atMost })} on a d${use.charges.breaksOn.die} when emptied`
      : "",
    use.charges?.overuse
      ? `may be used with none left, ${use.charges.overuse.chance}% ${use.charges.overuse.cumulative ? "more each time " : ""}to tear apart for nothing`
      : "",
    use.charges?.breaksOn?.regains
      ? `regains ${use.charges.breaksOn.regains.amount} on ${rulesetRegainFaces(use.charges.breaksOn.die, use.charges.breaksOn.regains.atLeast)} on a d${use.charges.breaksOn.die} when emptied`
      : "",
    use.gate ? rulesetItemGateText(use.gate) : "",
  ]
    .filter(Boolean)
    .join(", ")}`;
}

/** A gate for the Game Master: "needs a Lore check against 13 first, unless Caster level is 3 or more;
 *  failed, it is used up for nothing". */
export function rulesetItemGateText(gate: NonNullable<RulesetItemUseFact["gate"]>): string {
  const against = gate.difficulty !== undefined ? ` against ${gate.difficulty}` : "";
  const unless = gate.unless
    ? `, unless ${gate.unless.what}${gate.unless.of === "modifier" ? " modifier" : ""} is ${gate.unless.atLeast} or more`
    : "";
  return `needs a ${gate.check} check${against} first${unless}; failed, it is used up for nothing`;
}

/** What using an item does, as the Game Master's parts of it, leaving out what it spends. */
export function rulesetItemUseDoes(use: RulesetItemUseFact): string[] {
  const does =
    use.kind === "heal"
      ? use.amount
        ? `heals ${use.amount}`
        : "heals"
      : use.amount
        ? [use.amount, use.type].filter(Boolean).join(" ")
        : "";
  return [
    does,
    use.toHit ? `${use.toHit} to hit${use.target !== undefined ? ` at ${use.target}` : ""}` : "",
    use.save
      ? `${use.save.save}${use.save.difficulty !== undefined ? ` ${use.save.difficulty}` : ""} save${
          use.save.onSuccess === "half" ? " for half" : use.save.onSuccess === "negates" ? " negates it" : ""
        }`
      : "",
    ...(use.applies ?? []),
    use.temporary ? `${use.temporary} temporary` : "",
    use.restore ? `restores ${use.restore.amount} ${use.restore.pool}` : "",
    use.range !== undefined ? `range ${use.range}${use.unit ? ` ${use.unit}` : ""}` : "",
    use.area ? `${use.area.shape} ${use.area.size}${use.unit ? ` ${use.unit}` : ""}` : "",
  ].filter(Boolean);
}

export function rulesetItemAttackText(attack: RulesetItemAttackFact): string {
  const unit = attack.unit ? ` ${attack.unit}` : "";
  const toHit = `${attack.toHit}${attack.proficiency ? " + proficiency" : ""} to hit${
    attack.target !== undefined ? ` at ${attack.target}` : ""
  }`;
  const range = attack.range
    ? `range ${attack.range.normal}${attack.range.long !== undefined ? ` to ${attack.range.long}` : ""}${unit}`
    : "";
  return `attack (${attack.budget}): ${[
    toHit,
    [attack.damage, attack.type].filter(Boolean).join(" "),
    attack.reach !== undefined ? `reach ${attack.reach}${unit}` : "",
    range,
    attack.versatile ? `${attack.versatile} with a hand free` : "",
    attack.ammo
      ? `ammunition ${attack.ammo.what} (${attack.ammo.per} an attack${
          attack.ammo.recover ? `, ${Math.round(attack.ammo.recover * 100)}% picked up after a won fight` : ""
        })`
      : "",
    attack.clip ? `holds ${attack.clip.max}, reload (${attack.clip.reload})` : "",
    attack.modes?.length ? `modes ${attack.modes.map(rulesetItemModeText).join(", ")}` : "",
    attack.offHand ? `off hand (${attack.offHand.budget})` : "",
    attack.floor !== undefined ? `at least ${attack.floor} on a hit before resistance` : "",
    ...(attack.plus ?? []).map(
      (clause) =>
        `+${clause.amount}${clause.type ? ` ${clause.type}` : ""}${
          clause.against ? ` against ${clause.against.join(" or ")}` : ""
        }${clause.critical ? " on a critical hit" : ""}${clause.toggled ? ` while ${clause.toggled} is on` : ""}${
          clause.save
            ? ` (${clause.save.save} ${clause.save.difficulty} ${clause.save.onSuccess === "half" ? "for half" : "negates"})`
            : ""
        }`,
    ),
    ...(attack.spends ?? []).map(
      (spend) =>
        `${spend.label}: on a hit, ${
          spend.uses !== undefined
            ? `one of its ${spend.uses} ${spend.uses === 1 ? "use" : "uses"}`
            : `${spend.charges} ${spend.charges === 1 ? "charge" : "charges"}`
        }${spend.amount ? ` for +${spend.amount}${spend.type ? ` ${spend.type}` : ""}` : ""}${spend.more ? `, up to ${spend.more.max} more for +${spend.more.amount} each` : ""}${(
          spend.onHit ?? []
        )
          .map(
            (entry) =>
              `, ${entry.condition}${entry.rounds !== undefined ? ` for ${entry.rounds} rounds` : ""}${
                entry.save ? ` (${entry.save.save} ${entry.save.difficulty} resists)` : ""
              }`,
          )
          .join("")}`,
    ),
    ...(attack.onHit ?? []).map(
      (entry) =>
        `${entry.condition}${entry.rounds !== undefined ? ` for ${entry.rounds} rounds` : ""} when a hit deals ${entry.atLeast} or more${
          entry.save ? `, ${entry.save.save} ${entry.save.difficulty} resists` : ""
        }${
          entry.saveEnds
            ? `, until a ${entry.saveEnds.save} ${entry.saveEnds.difficulty} save${
                entry.saveEnds.at === "damaged"
                  ? " each time it takes damage"
                  : ` at the ${entry.saveEnds.at === "turn-start" ? "start" : "end"} of each turn`
              }`
            : ""
        }`,
    ),
  ]
    .filter(Boolean)
    .join(", ")}`;
}

/** The faces an item breaks on when its last charge is spent: "a 1", or "1 to 3". */
export function rulesetBreakFaces(breaks: { atMost: number }): string {
  return breaks.atMost === 1 ? "a 1" : `1 to ${breaks.atMost}`;
}

/** The faces a last charge's die gives charges back on (1.271): "a 20", "19 to 20". */
export function rulesetRegainFaces(die: number, atLeast: number): string {
  return atLeast === die ? `a ${die}` : `${atLeast} to ${die}`;
}
