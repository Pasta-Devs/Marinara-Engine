// ──────────────────────────────────────────────
// Game Mode rulesets: items the Game Master invents
//
// A story needs things no catalog lists: a named blade, a strange charm. The Game Master proposes one
// in its inventory tag, and the Engine makes it an item of the ruleset: every part read against the
// ruleset's own words, what it does not have left out, a rarity it does not have made its lowest,
// and every number stat held to the most `rarityCaps` allows at that rarity. Each change is said, so
// the Game Master reads it in its answer and the player in the item's details. The item is kept on
// the game, and every stack of it, the screen and the Game Master read that one item.
// ──────────────────────────────────────────────
import {
  rulesetCatalogItemSchema,
  rulesetItemIssues,
  rulesetItemStatsRead,
  type RulesetCatalogItem,
  type RulesetDefinition,
  type RulesetItemEffect,
  type RulesetItemStat,
} from "../../schemas/ruleset.schema.js";
import type { GameInventoryItemProposal } from "../../utils/game-inventory-stacks.js";

/** What a stack of an invented item has before the invented item's id. */
export const RULESET_INVENTED_ITEM_PREFIX = "invented:";
/** The most items one game keeps invented. */
export const RULESET_INVENTED_ITEMS_MAX = 200;
/** The most changes one invented item keeps said about it. */
const NOTES_MAX = 8;
const NOTE_MAX_LENGTH = 200;
const NAME_MAX_LENGTH = 120;
const SUMMARY_MAX_LENGTH = 300;
const ID_MAX_LENGTH = 60;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Dice as an invented item may give them: `1d8`, `2d6+1`. */
const DICE_PATTERN = /^\d{1,3}d\d{1,4}(?:[+-]\d{1,4})?$/i;

/** One item the Game Master invented in this game. */
export interface RulesetInventedItem {
  /** A stack of it has `item: "invented:<id>"`. */
  id: string;
  name: string;
  item: RulesetCatalogItem;
  summary?: string;
  /** What the Engine changed from the proposal. */
  notes?: string[];
}

/** The `item` a stack of an invented item has. */
export function rulesetInventedItemRef(id: string): string {
  return `${RULESET_INVENTED_ITEM_PREFIX}${id}`;
}

/** The invented items any of these lists of stacks still holds. The rest can never be read again: a
 *  game keeps an item only while a stack, or a remembered telling's stacks, name it. */
export function rulesetInventedItemsHeld<T extends { id: string }>(
  items: readonly T[],
  ...lists: ReadonlyArray<ReadonlyArray<{ item?: string }>>
): T[] {
  const held = new Set(lists.flatMap((stacks) => stacks.map((stack) => stack.item)));
  return items.filter((made) => held.has(rulesetInventedItemRef(made.id)));
}

/** Any text as one plain line: no line breaks, control characters or square brackets. */
function plainLine(text: string, max: number): string {
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]+/g, " ")
    .replace(/[[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

/** A short, stable fingerprint, for a name with nothing to spell an id from (FNV-1a). */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/** A name as an invented item's id: its Latin letters and digits joined by dashes ("Mourning Edge"
 *  is `mourning-edge`), or a fingerprint for a name with none. `taken` ids get a number after them. */
export function rulesetInventedItemId(name: string, taken: (id: string) => boolean = () => false): string {
  const spelled = name
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, ID_MAX_LENGTH - 4)
    .replace(/-+$/, "");
  const base = spelled || `item-${fingerprint(name.toLowerCase())}`;
  if (!taken(base)) return base;
  for (let n = 2; ; n += 1) {
    const next = `${base}-${n}`;
    if (!taken(next)) return next;
  }
}

/** One of the ruleset's words (a category, rarity, tag, stat or slot) a proposal names by its id or
 *  its label, in any case, with spaces, dashes and underscores alike. */
function wordNamed<T extends { id: string; label: string }>(
  words: readonly T[] | undefined,
  text: string,
): T | undefined {
  const key = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "_");
  const wanted = key(text);
  return words?.find((word) => key(word.id) === wanted) ?? words?.find((word) => key(word.label) === wanted);
}

/** The most modifiers one worn or carried effect holds, as the format allows. */
const EFFECT_MODIFIERS_MAX = 6;
type EffectModifier = NonNullable<RulesetItemEffect["modifiers"]>[number];

/**
 * A worn or carried effect as the Game Master writes it: parts split by `;` or `,`, each a change (+N,
 * -N, +NdM, advantage, disadvantage or fails) and what it is on, by skill or save names (split by `/`
 * or "and"), or `checks` or `saves` for all of them: "+1 Sneak", "disadvantage on Sneak checks",
 * "+1 saves", "fails Steel saves". A number on an ability's name adds to that ability ("+1 Brawn"). A
 * name the ruleset does not have is left out, and so is a part with nothing left to be on. Undefined
 * when nothing is left, or when the text says `none`.
 */
/** What the ruleset calls the number an attack is rolled against, where it names one ("Guard"). */
export function rulesetDefenseLabel(definition: RulesetDefinition): string | undefined {
  const defense = definition.combat?.defense;
  if (!defense) return undefined;
  const find = (entries: ReadonlyArray<{ id: string; label: string }>, id: string | undefined) =>
    id === undefined ? undefined : entries.find((entry) => entry.id === id)?.label;
  return find(definition.sheet.derived, defense.derived) ?? find(definition.sheet.fields, defense.field);
}

/** Whether a worn or carried part is about a fight: its attacks, or its defense by that word or the
 *  ruleset's own. */
function fightTarget(target: string, defenseWord: string | undefined): "attacks" | "defense" | undefined {
  // "Bonus" after it is how a small model often says it: "+1 attack roll bonus".
  const key = target
    .trim()
    .toLowerCase()
    .replace(/\s+bonus(?:es)?$/, "");
  if (/^(?:attacks?|attack rolls?)$/.test(key)) return "attacks";
  if (/^(?:defen[cs]e)$/.test(key) || (defenseWord !== undefined && key === defenseWord.toLowerCase()))
    return "defense";
  return undefined;
}

function readEffect(
  definition: RulesetDefinition,
  text: string,
  say: (text: string) => void,
): RulesetItemEffect | undefined {
  if (/^\s*(?:none|no|nothing)\s*$/i.test(text)) return undefined;
  const modifiers: EffectModifier[] = [];
  const fails: string[] = [];
  const leans: Array<"own-attacks-advantage" | "own-attacks-disadvantage"> = [];
  const abilities: Record<string, { add: number }> = {};
  // In a fight: attacks, and defense by that word or the ruleset's own for it ("Guard").
  const defenseWord = definition.combat ? rulesetDefenseLabel(definition) : undefined;
  const add = (modifier: EffectModifier, part: string) => {
    if (modifiers.length >= EFFECT_MODIFIERS_MAX)
      say(`An item does at most ${EFFECT_MODIFIERS_MAX} things this way, so "${part}" was left out.`);
    else modifiers.push(modifier);
  };
  for (const raw of text
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 12)) {
    const part = plainLine(raw, 60);
    // The number may come after the name as well: "Brawn +1" is "+1 Brawn".
    const after = /^(.+?)\s+([+-]\s*\d{1,2}d\d{1,3}|[+-]\s*\d{1,3})$/.exec(part);
    const read =
      /^(advantage|disadvantage|fails?|[+-]\s*\d{1,2}d\d{1,3}|[+-]\s*\d{1,3})\s+(?:(?:on|to)\s+)?(.*)$/i.exec(
        after ? `${after[2]} ${after[1]}` : part,
      );
    if (!read) {
      say(`"${part}" is not a change such as +1, -1, advantage or fails, so it was left out.`);
      continue;
    }
    const change = read[1]!.replace(/\s+/g, "").toLowerCase();
    let target = read[2]!.trim();
    let kind: "checks" | "saves" | undefined;
    const suffix = /(?:^|\s)(checks?|saves?|saving throws?)$/i.exec(target);
    if (suffix) {
      kind = /^check/i.test(suffix[1]!) ? "checks" : "saves";
      target = target.slice(0, suffix.index).trim();
    }
    const fight = !kind && definition.combat ? fightTarget(target, defenseWord) : undefined;
    if (fight) {
      const how = change.includes("d")
        ? { dice: change.slice(1), ...(change.startsWith("-") ? { minus: true as const } : {}) }
        : /^[+-]\d{1,3}$/.test(change)
          ? { flat: Math.max(-100, Math.min(100, Number(change))) }
          : undefined;
      if (fight === "attacks" && (change === "advantage" || change === "disadvantage")) {
        leans.push(change === "advantage" ? "own-attacks-advantage" : "own-attacks-disadvantage");
      } else if (
        !how ||
        how.flat === 0 ||
        ("dice" in how && (fight === "defense" || definition.combat?.kind === "dice-pool"))
      ) {
        say(`${fight === "attacks" ? "Attacks take" : "Defense takes"} a number such as +1, so "${part}" left it out.`);
      } else add({ to: fight, ...how } as EffectModifier, part);
      continue;
    }
    const skills: string[] = [];
    const saves: string[] = [];
    const raised: string[] = [];
    for (const name of target.split(/\s*(?:\/|&|\band\b)\s*/i).filter(Boolean)) {
      const skill = kind !== "saves" ? wordNamed(definition.sheet.skills, name) : undefined;
      const save = !skill && kind !== "checks" ? wordNamed(definition.sheet.saves, name) : undefined;
      const ability = !skill && !save && !kind ? wordNamed(definition.sheet.abilities, name) : undefined;
      if (skill) skills.push(skill.id);
      else if (save) saves.push(save.id);
      else if (ability) raised.push(ability.id);
      else
        say(
          `No ${kind === "saves" ? "save" : kind === "checks" ? "skill" : "skill, save or ability"} "${plainLine(name, 40)}", so it was left out of "${part}".`,
        );
    }
    const named = target !== "";
    if (!named && !kind) {
      say(`"${part}" does not say what it is on, so it was left out.`);
      continue;
    }
    // An ability takes a number and nothing else.
    if (raised.length) {
      const by = /^[+-]\d{1,3}$/.test(change) ? Math.max(-100, Math.min(100, Number(change))) : 0;
      if (by === 0) say(`An ability takes a number such as +1, so "${part}" left it out.`);
      else for (const id of raised) abilities[id] = { add: (abilities[id]?.add ?? 0) + by };
    }
    if (named && skills.length === 0 && saves.length === 0) continue;
    const onChecks = !named ? kind === "checks" : skills.length > 0;
    const onSaves = !named ? kind === "saves" : saves.length > 0;
    if (change.startsWith("fail")) {
      if (onChecks) say(`A check cannot fail on its own, so "${part}" is only about saves.`);
      if (onSaves) fails.push(...(named ? saves : definition.sheet.saves.map((each) => each.id)));
      continue;
    }
    const how: Partial<EffectModifier> =
      change === "advantage" || change === "disadvantage"
        ? { mode: change }
        : change.includes("d")
          ? { dice: change.slice(1), ...(change.startsWith("-") ? { minus: true as const } : {}) }
          : { flat: Math.max(-100, Math.min(100, Number(change))) };
    if (how.flat === 0) {
      say(`"${part}" changes nothing, so it was left out.`);
      continue;
    }
    if (onChecks) add({ to: "checks", ...how, ...(named ? { skills } : {}) } as EffectModifier, part);
    if (onSaves) add({ to: "saves", ...how, ...(named ? { saves } : {}) } as EffectModifier, part);
  }
  const failsSaves = [...new Set(fails)].slice(0, 12);
  const changed = Object.entries(abilities).filter(([, change]) => change.add !== 0);
  const effects = [...new Set(leans)];
  if (!modifiers.length && !failsSaves.length && !changed.length && !effects.length) return undefined;
  return {
    ...(effects.length ? { effects } : {}),
    ...(modifiers.length ? { modifiers } : {}),
    ...(failsSaves.length ? { failsSaves } : {}),
    ...(changed.length ? { abilities: Object.fromEntries(changed) } : {}),
  };
}

/** One worn or carried effect held to its rarity's `bonus`: a flat bonus past it pulled back to it, and
 *  a bonus in dice left out, since dice cannot be held to a number. A penalty is never capped. */
function capEffect(
  effect: RulesetItemEffect | undefined,
  most: number,
  rarityLabel: string,
  when: "worn" | "carried",
  say: (text: string) => void,
): RulesetItemEffect | undefined {
  if (effect?.abilities) {
    // An ability raised is a bonus like any other, and one set is held to a raise of the same size.
    const abilities: NonNullable<RulesetItemEffect["abilities"]> = {};
    for (const [id, change] of Object.entries(effect.abilities)) {
      if ("add" in change && change.add > most) {
        say(`A bonus while ${when} is +${most} instead of +${change.add}, the most at ${rarityLabel}.`);
        if (most > 0) abilities[id] = { add: most };
      } else if ("set" in change) {
        say(`An ability set by an invented item cannot be held to ${rarityLabel}'s most, so it was left out.`);
      } else abilities[id] = change;
    }
    const kept: RulesetItemEffect = { ...effect };
    if (Object.keys(abilities).length) kept.abilities = abilities;
    else delete kept.abilities;
    effect = doesSomething(kept) ? kept : undefined;
  }
  if (!effect?.modifiers) return effect;
  const modifiers = effect.modifiers.flatMap((modifier): EffectModifier[] => {
    // Speed is measured in the ruleset's distance, not in bonuses, so the cap is not about it.
    if (modifier.to === "speed") return [modifier];
    const next: EffectModifier = { ...modifier };
    if (next.dice !== undefined && !next.minus) {
      say(`A bonus in dice cannot be held to ${rarityLabel}'s most, so +${next.dice} while ${when} was left out.`);
      delete next.dice;
    }
    if (next.flat !== undefined && next.flat > most) {
      say(`A bonus while ${when} is +${most} instead of +${next.flat}, the most at ${rarityLabel}.`);
      if (most > 0) next.flat = most;
      else delete next.flat;
    }
    return next.flat !== undefined || next.dice !== undefined || next.mode !== undefined ? [next] : [];
  });
  const capped: RulesetItemEffect = { ...effect };
  if (modifiers.length) capped.modifiers = modifiers;
  else delete capped.modifiers;
  return doesSomething(capped) ? capped : undefined;
}

/** A worn effect less its changes to defense, which a stat the defense counts already makes. */
function withoutDefense(
  effect: RulesetItemEffect | undefined,
  counted: readonly string[],
  block: NonNullable<RulesetDefinition["items"]>,
  defense: string | undefined,
  say: (text: string) => void,
): RulesetItemEffect | undefined {
  if (!effect?.modifiers?.some((modifier) => modifier.to === "defense")) return effect;
  const stat = block.stats?.find((entry) => entry.id === counted[0])?.label ?? counted[0];
  say(`${defense ?? "Defense"} already counts an item's ${stat} stat, so a change to it while worn was left out.`);
  const modifiers = effect.modifiers.filter((modifier) => modifier.to !== "defense");
  const kept: RulesetItemEffect = { ...effect };
  if (modifiers.length) kept.modifiers = modifiers;
  else delete kept.modifiers;
  return doesSomething(kept) ? kept : undefined;
}

/** Whether an effect still does anything, once parts of it were left out. */
function doesSomething(effect: RulesetItemEffect): boolean {
  return !!(
    effect.effects ||
    effect.modifiers ||
    effect.failsSaves ||
    effect.abilities ||
    effect.resist ||
    effect.vulnerable ||
    effect.immune ||
    effect.conditionImmunities
  );
}

/** A stat's value as its type reads it, or why it cannot be. */
function readStat(stat: RulesetItemStat, text: string): { value: string | number | boolean } | { wrong: string } {
  const raw = text.trim();
  switch (stat.type) {
    case "number": {
      const value = Number(raw.replace(/^\+/, ""));
      return raw !== "" && Number.isFinite(value) ? { value } : { wrong: "a number" };
    }
    case "boolean": {
      const word = raw.toLowerCase();
      if (["yes", "true", "1", "on"].includes(word)) return { value: true };
      if (["no", "false", "0", "off"].includes(word)) return { value: false };
      return { wrong: "yes or no" };
    }
    case "enum": {
      const key = raw.toLowerCase();
      const value =
        stat.values.find((each) => each.toLowerCase() === key) ??
        stat.values.find((each) => stat.valueLabels?.[each]?.toLowerCase() === key);
      return value !== undefined ? { value } : { wrong: `one of ${stat.values.join(", ")}` };
    }
    case "dice":
      return DICE_PATTERN.test(raw) ? { value: raw.toLowerCase() } : { wrong: "dice such as 1d8" };
    case "text":
      return raw ? { value: plainLine(raw, stat.maxLength) } : { wrong: "text" };
  }
}

/**
 * An item made from the Game Master's proposal, read against the ruleset's `items` block. `like` is
 * the catalog item it starts from, already found by the caller: anything the proposal gives replaces
 * that part. Null when the ruleset has no items block to write an item in. `notes` are every change,
 * for the item's details; `promptNotes` leave out the ones about a stat the Game Master is not shown.
 */
export function inventRulesetItem(
  definition: RulesetDefinition,
  proposal: Omit<GameInventoryItemProposal, "name">,
  like?: RulesetCatalogItem,
): { item: RulesetCatalogItem; notes: string[]; promptNotes: string[] } | null {
  const block = definition.items;
  if (!block) return null;
  const said: Array<{ text: string; hidden: boolean }> = [];
  // Every change as it is said, and whether it is about a stat the Game Master is not shown.
  const say = (text: string) => said.push({ text, hidden: false });
  const sayOf = (stat: RulesetItemStat | undefined, text: string) =>
    said.push({ text, hidden: stat?.promptVisible === false });

  const named = proposal.category !== undefined ? wordNamed(block.categories, proposal.category) : undefined;
  let category = named?.id ?? like?.category;
  if (!category) {
    const first = block.categories[0]!;
    category = first.id;
    say(
      proposal.category !== undefined
        ? `No category "${plainLine(proposal.category, 40)}", so it is in ${first.label}.`
        : `No category was given, so it is in ${first.label}.`,
    );
  } else if (proposal.category !== undefined && !named) {
    say(
      `No category "${plainLine(proposal.category, 40)}", so it stays in ${wordNamed(block.categories, category)?.label ?? category}.`,
    );
  }

  let rarity: string | undefined;
  if (block.rarities?.length) {
    const lowest = block.rarities[0]!;
    const namedRarity = proposal.rarity !== undefined ? wordNamed(block.rarities, proposal.rarity) : undefined;
    rarity = namedRarity?.id ?? (proposal.rarity === undefined ? like?.rarity : undefined);
    if (!rarity) {
      rarity = lowest.id;
      say(
        proposal.rarity !== undefined
          ? `No rarity "${plainLine(proposal.rarity, 40)}", so it is ${lowest.label}.`
          : `No rarity was given, so it is ${lowest.label}.`,
      );
    }
  }

  let tags = like?.tags ? [...like.tags] : [];
  if (proposal.tags) {
    tags = [];
    for (const given of proposal.tags) {
      const tag = wordNamed(block.tags, given);
      if (!tag) say(`No tag "${plainLine(given, 40)}", so it was left out.`);
      else if (!tags.includes(tag.id)) tags.push(tag.id);
    }
  }

  const stats: Record<string, string | number | boolean> = { ...(like?.stats ?? {}) };
  for (const [given, text] of Object.entries(proposal.stats ?? {})) {
    const stat = wordNamed(block.stats, given);
    if (!stat) {
      say(`No stat "${plainLine(given, 40)}", so it was left out.`);
      continue;
    }
    const read = readStat(stat, text);
    if ("wrong" in read) {
      sayOf(stat, `${stat.label} takes ${read.wrong}, so "${plainLine(text, 40)}" was left out.`);
      continue;
    }
    let value = read.value;
    if (stat.type === "number" && typeof value === "number") {
      const whole = stat.integer ? Math.round(value) : value;
      if (whole !== value) sayOf(stat, `${stat.label} takes whole numbers, so it is ${whole}.`);
      const held = Math.min(stat.max, Math.max(stat.min, whole));
      if (held !== whole) sayOf(stat, `${stat.label} runs from ${stat.min} to ${stat.max}, so it is ${held}.`);
      value = held;
    }
    stats[stat.id] = value;
  }
  // Every number stat, the ones it started from included, is held to the most its rarity allows.
  const caps = block.rarityCaps?.find((cap) => cap.rarity === rarity)?.stats ?? {};
  const rarityLabel = block.rarities?.find((each) => each.id === rarity)?.label ?? rarity;
  for (const [id, most] of Object.entries(caps)) {
    const value = stats[id];
    if (typeof value !== "number" || value <= most) continue;
    const stat = block.stats?.find((each) => each.id === id);
    sayOf(stat, `${stat?.label ?? id} is ${most} instead of ${value}, the most at ${rarityLabel}.`);
    stats[id] = most;
  }

  let slots: Record<string, number> = { ...(like?.slots ?? {}) };
  if (proposal.slots) {
    slots = {};
    for (const [given, text] of Object.entries(proposal.slots)) {
      const slot = wordNamed(block.slots, given);
      if (!slot) {
        say(`No slot "${plainLine(given, 40)}", so it was left out.`);
        continue;
      }
      const count = Number.parseInt(text.trim() || "1", 10);
      const counted = Number.isFinite(count) && count >= 1;
      const taken = counted ? Math.min(count, slot.count) : 1;
      if (!counted) say(`${slot.label} takes a count of 1 or more, so it takes 1.`);
      else if (taken !== count) say(`A character has ${slot.count} ${slot.label}, so it takes ${taken}.`);
      slots[slot.id] = taken;
    }
  }

  // What it does while worn and while only carried: what the proposal says, else what it started from,
  // and either way held to its rarity's bonus.
  const bonus = block.rarityCaps?.find((cap) => cap.rarity === rarity)?.bonus;
  const effectOf = (when: "worn" | "carried") => {
    const given = proposal[when];
    const read = given !== undefined ? readEffect(definition, given, say) : like?.[when];
    return bonus === undefined ? read : capEffect(read, bonus, rarityLabel ?? "", when, say);
  };
  const carried = effectOf("carried");
  // A stat the ruleset's defense already adds up is how this item raises it, so a worn change to
  // defense beside it would count twice: a small model writes "guard=1" and "+1 Guard" for one +1.
  const counted = definition.combat
    ? rulesetItemStatsRead(definition, definition.combat.defense).filter((id) => {
        const value = stats[id];
        return value !== undefined && value !== 0 && value !== false && value !== "";
      })
    : [];
  const worn = counted.length
    ? withoutDefense(effectOf("worn"), counted, block, rulesetDefenseLabel(definition), say)
    : effectOf("worn");

  let binds = like?.binds;
  if (proposal.binds !== undefined) {
    const word = proposal.binds.trim().toLowerCase();
    const wanted = ["no", "false", "0", "none"].includes(word) ? undefined : word === "cursed" ? { cursed: true } : {};
    if (wanted && !block.binding) say("This ruleset binds nothing, so it does not bind.");
    binds = wanted && block.binding ? wanted : undefined;
  }

  // A weapon's attack comes with the item it started from, while the item can still be worn.
  const wearable = Object.values(slots).some((count) => count > 0) || !!binds;
  if (like?.attack && !wearable) {
    say("It takes no slot and does not bind, so it is never worn, and the attack it started from was left out.");
  }

  const item: RulesetCatalogItem = {
    category,
    ...(rarity ? { rarity } : {}),
    ...(tags.length ? { tags } : {}),
    ...(Object.keys(stats).length ? { stats } : {}),
    ...(Object.keys(slots).length ? { slots } : {}),
    ...(like?.stack !== undefined ? { stack: like.stack } : {}),
    ...(binds
      ? { binds: { ...(like?.binds?.restriction ? { restriction: like.binds.restriction } : {}), ...binds } }
      : {}),
    ...(worn ? { worn } : {}),
    ...(carried ? { carried } : {}),
    // What it asks of its wearer comes with the item it started from.
    ...(like?.requires ? { requires: like.requires } : {}),
    ...(like?.attack && wearable ? { attack: like.attack } : {}),
    // What using it does, and the charges that use spends, come with the item it started from.
    ...(like?.use ? { use: like.use } : {}),
    ...(like?.charges ? { charges: like.charges } : {}),
  };
  const kept = said.slice(0, NOTES_MAX).map((note) => ({ ...note, text: plainLine(note.text, NOTE_MAX_LENGTH) }));
  return {
    item,
    notes: kept.map((note) => note.text),
    promptNotes: kept.filter((note) => !note.hidden).map((note) => note.text),
  };
}

/** The parts a proposal can have that a small model sometimes writes inside `stats=` instead of beside
 *  it ("stats="worn=+1 Brawn""). Lifted out when the ruleset has no stat of that name and the part was
 *  not given on its own. */
const PARTS_WRITTEN_AS_STATS = ["worn", "carried", "summary"] as const;

/** A proposal with any of those parts it wrote inside `stats=` put where they belong. */
export function rulesetProposalParts<T extends Omit<GameInventoryItemProposal, "name">>(
  definition: RulesetDefinition,
  proposal: T,
): T {
  if (!proposal.stats) return proposal;
  const lifted: Partial<Record<(typeof PARTS_WRITTEN_AS_STATS)[number], string>> = {};
  const stats: Record<string, string> = {};
  for (const [given, text] of Object.entries(proposal.stats)) {
    const part = PARTS_WRITTEN_AS_STATS.find((each) => each === given.trim().toLowerCase());
    if (part && proposal[part] === undefined && !wordNamed(definition.items?.stats, given)) lifted[part] = text;
    else stats[given] = text;
  }
  if (Object.keys(lifted).length === 0) return proposal;
  const next: T = { ...proposal, ...lifted };
  if (Object.keys(stats).length) next.stats = stats;
  else delete next.stats;
  return next;
}

/** A proposal's name and summary as the invented item keeps them. */
export function rulesetInventedItemText(proposal: { name: string; summary?: string }): {
  name: string;
  summary?: string;
} {
  const name = plainLine(proposal.name, NAME_MAX_LENGTH);
  const summary = proposal.summary !== undefined ? plainLine(proposal.summary, SUMMARY_MAX_LENGTH) : "";
  return { name, ...(summary ? { summary } : {}) };
}

/**
 * The game's invented items as saved (chat metadata `gameInventedItems`), each one the ruleset can
 * still read: a well-formed id and name, and an item every part of which is still one of the ruleset's
 * words. One the ruleset has since changed under is left out, and its stacks read as plain names.
 */
export function readRulesetInventedItems(definition: RulesetDefinition, raw: unknown): RulesetInventedItem[] {
  if (!Array.isArray(raw)) return [];
  const read: RulesetInventedItem[] = [];
  const ids = new Set<string>();
  for (const entry of raw) {
    if (read.length >= RULESET_INVENTED_ITEMS_MAX) break;
    if (!entry || typeof entry !== "object") continue;
    const { id, name, item, summary, notes } = entry as Record<string, unknown>;
    if (typeof id !== "string" || id.length > ID_MAX_LENGTH || !ID_PATTERN.test(id) || ids.has(id)) continue;
    if (typeof name !== "string") continue;
    const text = rulesetInventedItemText({ name, ...(typeof summary === "string" ? { summary } : {}) });
    if (!text.name) continue;
    const parsed = rulesetCatalogItemSchema.safeParse(item);
    if (!parsed.success || rulesetItemIssues(definition, parsed.data).length > 0) continue;
    const said = Array.isArray(notes)
      ? notes
          .filter((note): note is string => typeof note === "string")
          .map((note) => plainLine(note, NOTE_MAX_LENGTH))
          .filter(Boolean)
          .slice(0, NOTES_MAX)
      : [];
    ids.add(id);
    read.push({ id, ...text, item: parsed.data, ...(said.length ? { notes: said } : {}) });
  }
  return read;
}
