// ──────────────────────────────────────────────
// Game Mode rulesets: the items a game's inventory can hold
//
// A ruleset lists its items in catalogs that hold items. The inventory reads them through one book:
// which name is which item (a label, in any case), how many of one a stack holds, and what the
// screen and the Game Master are shown about it. The server builds the book from the catalogs it
// loads and the browser from the ones it fetches, so both read an item the same way.
// ──────────────────────────────────────────────
import {
  rulesetItemIssues,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetDefinition,
  type RulesetItemAttack,
  type RulesetItemEffect,
  type RulesetItemStat,
  type RulesetValueRef,
  type RulesetSheetBuild,
} from "../../schemas/ruleset.schema.js";
import { normalizeCharacterLookupName } from "../../utils/character-lookup-name.js";
import {
  gameInventoryBagKey,
  gameInventoryNameKey,
  type GameInventoryStack,
  type GameInventoryBearer,
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
import { catalogEntryHiddenByLayers, type RulesetLayerOptions } from "./layers.js";
import {
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  resolveRulesetValueRef,
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
  to: "checks" | "saves" | "ability" | "attacks" | "defense" | "speed" | "effect" | "harm" | "conditions";
  names: string[];
  change:
    | { mode: "advantage" | "disadvantage" }
    | { value: string }
    | { fails: true }
    | { atLeast: number }
    | { times: 0.5 | 2 }
    | { effect: string }
    | { hide: "resist" | "vulnerable" | "immune" };
}

/** A fight effect's own words, for the Game Master, by effect id. The ones about the holder's own
 *  checks, saves and attacks are said as leans on those instead. */
const FIGHT_EFFECT_TEXT: Record<string, string> = {
  "attacks-against-advantage": "attacks against them have advantage",
  "attacks-against-disadvantage": "attacks against them have disadvantage",
  "attacks-against-adjacent-advantage": "attacks against them from next to them have advantage",
  "attacks-against-far-disadvantage": "attacks against them from afar have disadvantage",
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
  ];
  const ids = reads.flatMap((value) =>
    value && typeof value === "object" && !Array.isArray(value) && "stat" in value ? [value.stat] : [],
  );
  return [...new Set(ids)];
}

/** A sum as the item facts write one: the first part as it is, then each with its sign. Nothing is
 *  0. */
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
  return {
    budget: labelOf(definition.combat?.economy.budgets ?? [], attack.budget),
    toHit: factSum([
      abilities(attack.toHit.abilities),
      typeof skill === "string" ? labelOf(definition.sheet.skills, skill) : "",
      number(attack.toHit.bonus),
    ]),
    ...(attack.toHit.proficiency ? { proficiency: true as const } : {}),
    ...(typeof target === "number" ? { target } : {}),
    damage: factSum([dice(attack.damage.dice), abilities(attack.damage.abilities), number(attack.damage.bonus)]),
    ...(type ? { type } : {}),
    ...(reach > 0 ? { reach } : {}),
    ...(normal > 0 ? { range: { normal, ...(long > normal ? { long } : {}) } } : {}),
    ...((reach > 0 || normal > 0) && unit ? { unit } : {}),
    ...(versatile ? { versatile } : {}),
  };
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
    return { what: `${find(list?.columns, ref.listSum.column)} (${list?.label ?? ref.listSum.list})` };
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
    const narrowed =
      to === "checks" || to === "saves"
        ? names(to, to === "checks" ? (modifier.skills ?? effect.skills) : (modifier.saves ?? effect.saves))
        : to === "defense" && defense
          ? [defense]
          : [];
    const dice = modifier.dice ? `${modifier.minus ? "-" : "+"}${modifier.dice}` : "";
    const flat = modifier.flat ? `${modifier.flat > 0 ? "+" : ""}${modifier.flat}` : "";
    if (dice || flat) facts.push({ to, names: narrowed, change: { value: `${dice}${flat}` } });
    if (modifier.times) facts.push({ to: "speed", names: [], change: { times: modifier.times } });
    if (modifier.mode) facts.push({ to, names: narrowed, change: { mode: modifier.mode } });
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
    if (effect[hide]?.length) facts.push({ to: "harm", names: [...effect[hide]!], change: { hide } });
  }
  if (effect.conditionImmunities?.length) {
    const label = (id: string) => definition.sheet.live.conditions.find((entry) => entry.id === id)?.label ?? id;
    facts.push({ to: "conditions", names: effect.conditionImmunities.map(label), change: { hide: "immune" } });
  }
  return facts;
}

/** One effect fact in plain words, as the Game Master reads it: "-1 on checks (Sneak)", "+1 Brawn". */
export function rulesetItemEffectText(fact: RulesetItemEffectFact): string {
  const change = fact.change;
  const list = fact.names.join(", ");
  if ("effect" in change) return FIGHT_EFFECT_TEXT[change.effect] ?? change.effect;
  if ("hide" in change) {
    return change.hide === "resist"
      ? `resists ${list}`
      : change.hide === "vulnerable"
        ? `vulnerable to ${list}`
        : `immune to ${list}`;
  }
  if ("times" in change) return change.times === 0.5 ? "half speed" : "double speed";
  if (fact.to === "defense" || fact.to === "speed") {
    return `${"value" in change ? change.value : ""} ${fact.to === "speed" ? "speed" : list || "defense"}`;
  }
  if (fact.to === "ability") {
    const ability = fact.names.join(", ");
    return "atLeast" in fact.change
      ? `${ability} at least ${fact.change.atLeast}`
      : `${"value" in fact.change ? fact.change.value : ""} ${ability}`;
  }
  const which = `${fact.to}${fact.names.length ? ` (${fact.names.join(", ")})` : ""}`;
  if ("fails" in change) return `fails ${which}`;
  return `${"mode" in change ? change.mode : "value" in change ? change.value : ""} on ${which}`;
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
  /** The game's invented items: the ones it was built with, and any `invent` has made since. */
  inventedItems(): RulesetInventedItem[];
  /** Whether `invent` has made an item since the book was built. */
  inventedChanged(): boolean;
}

function statText(stat: RulesetItemStat, value: string | number | boolean): string | undefined {
  if (stat.type === "boolean") return undefined;
  if (stat.type === "enum") return stat.valueLabels?.[String(value)] ?? String(value);
  return String(value);
}

/** An item's labels and stats, read against the ruleset's `items` block. */
export function rulesetItemFacts(definition: RulesetDefinition, item: RulesetCatalogItem): RulesetItemFacts {
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
  const unit = item.cost
    ? block?.currencies?.flatMap((family) => family.units).find((each) => each.id === item.cost!.unit)
    : undefined;
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
    ...(item.cost ? { cost: { amount: item.cost.amount, unit: unit?.label ?? item.cost.unit } } : {}),
    ...(worn.length ? { worn } : {}),
    ...(carried.length ? { carried } : {}),
    ...(requires.length ? { requires } : {}),
    ...(item.attack ? { attack: rulesetItemAttackFacts(definition, item, item.attack) } : {}),
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
    return {
      item: ref,
      name: entry.label,
      ...(entry.item.stack !== undefined ? { stack: entry.item.stack } : {}),
      ...(typeof weight === "number" && weight > 0 ? { weight } : {}),
      ...(entry.item.slots && Object.keys(entry.item.slots).length > 0 ? { slots: entry.item.slots } : {}),
      ...(entry.item.binds ? { binds: { ...(entry.item.binds.cursed ? { cursed: true } : {}) } } : {}),
      catalogId,
      entry,
      ...(entry.summary ? { summary: entry.summary } : {}),
      facts: rulesetItemFacts(definition, entry.item),
    };
  };
  const all = new Map<string, RulesetItemBookEntry>();
  const visible: RulesetItemBookEntry[] = [];
  const offered = new Set<string>();
  const byName = new Map<string, RulesetItemBookEntry>();
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
    }
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
  const itemNamed = (name: string): RulesetItemBookEntry | undefined => {
    const key = gameInventoryNameKey(name);
    const made = inventedByName.get(key)?.at(-1);
    return byName.get(key) ?? (made ? all.get(rulesetInventedItemRef(made.id)) : undefined);
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
    const own = byName.get(key);
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
    itemOf: (item) => all.get(item),
    offers: (item) => offered.has(item),
    itemNamed,
    inventedItems: () => [...invented.values()],
    inventedChanged: () => madeHere.size > 0,
    ...(options.actor === "game-master" && definition.items ? { invent } : {}),
    plain: options.plain ?? "allow",
    ...(options.actor ? { actor: options.actor } : {}),
    ...(definition.items?.slots?.length
      ? { slots: definition.items.slots.map(({ id, label, count }) => ({ id, label, count })) }
      : {}),
    ...(definition.items?.carry || definition.items?.binding
      ? { bearer: rulesetItemBearers(definition, options.sheets) }
      : {}),
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
  return stacks.flatMap((stack) => {
    if (!stack.item || gameInventoryBagKey(stack.holder) !== bag) return [];
    const item = book.itemOf(stack.item)?.entry.item;
    if (!item) return [];
    const takesSlots = Object.values(item.slots ?? {}).some((count) => count > 0);
    const binds = !!item.binds;
    const worn = (takesSlots || binds) && (!takesSlots || stack.equipped === true) && (!binds || stack.bound === true);
    return [{ item, quantity: stack.quantity, worn, name: stack.name }];
  });
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
  const key = normalizeCharacterLookupName;
  const player = (playerName ? cardNames.find((name) => key(name) === key(playerName)) : undefined) ?? cardNames[0];
  return (cardName) =>
    rulesetSheetItems(book, stacks, player !== undefined && key(cardName) === key(player) ? undefined : cardName);
}

/** The item catalogs a ruleset declares: the ones the book is built from. */
export function rulesetItemCatalogIds(definition: RulesetDefinition): string[] {
  return (definition.catalogs ?? []).filter((catalog) => catalog.holds === "items").map((catalog) => catalog.id);
}

/** An item's facts as one line for the Game Master: category, rarity and tags, then the stats the
 *  ruleset shows it, such as "Weapon, Common, Thrown; Damage 1d6, Reach close". */
export function rulesetItemPromptFacts(facts: RulesetItemFacts): string {
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
  return [kind, stats, ...effects, ...needs, facts.attack ? rulesetItemAttackText(facts.attack) : ""]
    .filter(Boolean)
    .join("; ");
}

/** A weapon's attack in the Game Master's words: "attack (Act): Brawn + 1 to hit, 1d6 + Brawn cut,
 *  reach 2 paces, range 10 to 20 paces, 1d8 with a hand free". */
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
  ]
    .filter(Boolean)
    .join(", ")}`;
}
