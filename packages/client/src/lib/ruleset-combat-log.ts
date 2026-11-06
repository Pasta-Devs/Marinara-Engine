// What a ruleset fight's log says, in the ruleset's own words and the server's own numbers.
//
// One module, because the log, the recap and the refusal toasts must never spell the same fight two
// ways. Everything here is pure: it takes the definition the game pinned, the view the server sent
// and a translator, and gives back strings. No arithmetic of its own is done anywhere in it. Every
// number printed was computed by the resolver and carried in the event, which is the whole point of
// the events carrying their rolls: a screen that recomputed a total could disagree with the fight.
//
// Nothing here is shaped around one game system. Budget names, condition names, save names, track
// names and tier names all come out of the definition, so a fight on Ember Roads reads in Ember
// Roads' words and a fight on 5e reads in 5e's.
import type {
  DirectedRulesetEvent,
  DirectedRulesetReason,
  DirectedRulesetView,
  RulesetCombatPoolRoll,
  RulesetCombatDamagePool,
  RulesetCombatRollMode,
  RulesetConditionBonus,
  RulesetContestSide,
  RulesetSearchApart,
  RulesetDefinition,
  RulesetValueRef,
} from "@marinara-engine/shared";
import { readRulesetFightNote } from "@marinara-engine/shared";
import type { TFunction } from "i18next";
import { rulesetDistanceText } from "./ruleset-combat-board";

/** Everything a line needs to name something the ruleset named. Built once per render. */
export interface RulesetCombatNames {
  /** A combatant by id, or an empty string for an id the fight does not hold. */
  combatant: (id?: string) => string;
  condition: (id: string) => string;
  kind: (id: string) => string;
  budget: (id: string) => string;
  save: (id: string) => string;
  /** One of the checks a contest reads. */
  check: (id: string) => string;
  /** The label of a live track: one of the two the ruleset's dying rule counts on, or one a level reads. */
  track: (id: string) => string;
  /** The label of a derived value a level reads. */
  derived: (id: string) => string;
  tier: (id: string) => string;
  /** One of the ways an attack may be made where initiative is a number attacks move. */
  style: (id: string) => string;
  /** What this ruleset calls the number an attack is rolled against: "AC", "Guard", whatever the
   *  file named it. Empty when the ruleset points at something with no label of its own. */
  defense: string;
  /** A count of cells in the ruleset's own distance: "20 ft", "8 paces". A fight with no board has
   *  no unit to say it in, so the count is printed as it stands. */
  distance: (cells: number) => string;
  /** A drop of so many levels of the board in the ruleset's own distance (combat C6b): "10 ft". */
  height: (levels: number) => string;
  /** One of a symbol pool's symbols (1.382), by id. */
  symbol?: (id: string) => string;
  /** So many of a live pool, by what one of it is called (1.378): "1 1st-level slot", "2 1st-level
   *  slots". Undefined for a pool that names no unit. */
  poolUnits?: (id: string, count: number) => string | undefined;
}

function lookupLabel(entries: Array<{ id: string; label: string }> | undefined) {
  const byId = new Map((entries ?? []).map((entry) => [entry.id, entry.label]));
  // An id the ruleset does not declare prints as itself rather than as nothing: a fight is still
  // readable when a layer or an edit took a row away.
  return (id: string) => byId.get(id) ?? id;
}

/** The label of whatever a value reference points at, for the few places a screen has to NAME the
 *  number rather than print it. A reference to a plain constant has no name to give. */
export function rulesetValueLabel(definition: RulesetDefinition, ref: RulesetValueRef | undefined): string {
  if (!ref) return "";
  const sheet = definition.sheet;
  const find = (entries: Array<{ id: string; label: string }>, id: string | undefined) =>
    id ? (entries.find((entry) => entry.id === id)?.label ?? id) : "";
  if (ref.field) return find(sheet.fields, ref.field);
  if (ref.derived) return find(sheet.derived, ref.derived);
  if (ref.abilityScore ?? ref.abilityMod ?? ref.abilityModFromField) {
    return find(sheet.abilities, ref.abilityScore ?? ref.abilityMod ?? ref.abilityModFromField);
  }
  if (ref.skillMod) return find(sheet.skills, ref.skillMod);
  if (ref.saveMod) return find(sheet.saves, ref.saveMod);
  return "";
}

export function rulesetCombatNames(
  definition: RulesetDefinition,
  view: DirectedRulesetView,
  t: TFunction,
  /** The ruleset's own words in the player's language (1.811). */
  text: (english: string) => string = (english) => english,
): RulesetCombatNames {
  const combatants = new Map(view.combatants.map((combatant) => [combatant.id, combatant.name]));
  const distance = view.grid?.distance;
  const lookup = (entries: Array<{ id: string; label: string }> | undefined) => {
    const plain = lookupLabel(entries);
    return (id: string) => text(plain(id));
  };
  return {
    distance: (cells) => rulesetDistanceText(cells, distance, t),
    height: (levels) => {
      // The ruleset's own words for both, so a fall reads the same wherever the line is printed.
      const levelHeight = definition.combat?.elevation?.levelHeight;
      const unit = definition.combat?.distance?.label && text(definition.combat.distance.label);
      return levelHeight && unit
        ? (t("game.combat.ruleset.board.distance", { amount: levels * levelHeight, unit }) as string)
        : (t("game.combat.ruleset.board.levels", { count: levels }) as string);
    },
    combatant: (id) => (id ? (combatants.get(id) ?? "") : ""),
    condition: lookup(definition.sheet.live.conditions),
    kind: lookup(definition.sheet.live.tracks.flatMap((track) => track.kinds ?? [])),
    budget: lookup(definition.combat?.economy.budgets),
    save: lookup(definition.sheet.saves),
    check: lookup(definition.combat?.checks),
    track: lookup(definition.sheet.live.tracks),
    derived: lookup(definition.sheet.derived),
    tier: lookup(definition.combat?.threat?.tiers),
    style: lookup(definition.combat?.initiative.resource?.styles),
    defense: text(rulesetValueLabel(definition, definition.combat?.defense)),
    symbol: lookup(definition.resolution.kind === "symbol-pool" ? definition.resolution.symbols : []),
    poolUnits: (id, count) => {
      const pool = definition.sheet.live.pools.find((one) => one.id === id);
      const said = count === 1 ? pool?.unit : (pool?.units ?? pool?.unit);
      return said && text(said);
    },
  };
}

/** A modifier as it is written beside a roll. Signs and digits, never words, so it is the same in
 *  every language and cannot drift from the total the resolver already added up. */
/** A word of the Engine's own ("first-fall") as a localization key segment takes it: firstFall. */
function keySegment(word: string): string {
  return word.replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
}

function signed(modifier: number): string {
  return modifier < 0 ? `- ${Math.abs(modifier)}` : `+ ${modifier}`;
}

/**
 * One roll, spelled out: what was thrown, what was kept when more than one was thrown, the modifier
 * and the total the resolver reached. "17 + 5 = 22", or "7, 19 with advantage, keeping 19 + 5 = 24".
 *
 * A roll with nothing added to it is printed as the die alone: the total IS the die, and "5 = 5"
 * says nothing twice. A roll that kept one of several without saying which way it leaned says only
 * that, because guessing advantage from which face survived would be this file deciding something
 * the fight did not report.
 */
export function rulesetRollText(
  roll: {
    rolls: number[];
    kept: number;
    modifier: number;
    total: number;
    mode?: RulesetCombatRollMode;
    bonuses?: RulesetConditionBonus[];
  },
  t: TFunction,
  /** What a condition that added something is called. Its id when nothing better is at hand. */
  bonusName: (bonus: RulesetConditionBonus) => string = (bonus) => bonus.condition,
): string {
  const sum = roll.rolls.reduce((total, face) => total + face, 0);
  const base =
    roll.rolls.length < 2
      ? String(roll.kept)
      : roll.mode === "advantage" || roll.mode === "disadvantage"
        ? t(`game.combat.ruleset.roll.${roll.mode}`, { rolls: roll.rolls.join(", "), kept: roll.kept })
        : // Several dice that add up to what was kept are the ruleset's own handful; several that do
          // not are one of them being kept, and the line says only that.
          t(sum === roll.kept ? "game.combat.ruleset.roll.sum" : "game.combat.ruleset.roll.kept", {
            rolls: roll.rolls.join(sum === roll.kept ? " + " : ", "),
            kept: roll.kept,
          });
  // The roll's own modifier, then what each condition added, each named: "12 + 5 + 3 (Blessed) = 20".
  const added = [
    ...(roll.modifier === 0 ? [] : [signed(roll.modifier)]),
    ...(roll.bonuses ?? []).map((bonus) =>
      t("game.combat.ruleset.roll.bonus", { value: signed(bonus.value), name: bonusName(bonus) }),
    ),
  ];
  if (added.length === 0) return base;
  return t("game.combat.ruleset.roll.totalWithModifier", {
    roll: base,
    modifier: added.join(" "),
    total: roll.total,
  });
}

/** A pool as it was thrown, for a `dice-pool` fight: how many successes, from how many dice (and what
 *  made up that many, when anything besides the number itself did), at which target, the faces, and
 *  whether it was the better or worse of two throws or a botch. Every number is the event's own. */
export function rulesetPoolRollText(
  roll: {
    rolls: number[];
    modifier: number;
    total: number;
    mode?: RulesetCombatRollMode;
    bonuses?: RulesetConditionBonus[];
    pool: RulesetCombatPoolRoll;
  },
  t: TFunction,
  bonusName: (bonus: RulesetConditionBonus) => string = (bonus) => bonus.condition,
  symbolName: (id: string) => string = (id) => id,
): string {
  if (roll.pool.symbols) return rulesetSymbolRollText({ ...roll, pool: roll.pool }, t, bonusName, symbolName);
  const parts = [
    ...(roll.bonuses ?? []).map((bonus) =>
      t("game.combat.ruleset.roll.bonus", { value: signed(bonus.value), name: bonusName(bonus) }),
    ),
    ...(roll.pool.penalty ? [t("game.combat.ruleset.roll.penalty", { value: signed(roll.pool.penalty) })] : []),
  ];
  const dice = t("game.combat.ruleset.roll.dice", { count: roll.pool.dice });
  const built =
    parts.length > 0
      ? t("game.combat.ruleset.roll.poolFrom", { dice, parts: [String(roll.modifier), ...parts].join(" ") })
      : dice;
  let text = t("game.combat.ruleset.roll.pool", {
    count: roll.total,
    dice: built,
    target: roll.pool.target,
    rolls: roll.rolls.join(", "),
  }) as string;
  if (roll.mode === "advantage") text = t("game.combat.ruleset.roll.poolAdvantage", { roll: text });
  else if (roll.mode === "disadvantage") text = t("game.combat.ruleset.roll.poolDisadvantage", { roll: text });
  if (roll.pool.botch) text = t("game.combat.ruleset.roll.poolBotch", { roll: text });
  return text;
}

/** The symbols a throw left, as the ruleset names them: "2 Success, 1 Advantage". */
function symbolsText(symbols: Record<string, number>, t: TFunction, symbolName: (id: string) => string): string {
  const named = Object.entries(symbols)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => `${count} ${symbolName(id)}`);
  return named.length > 0 ? named.join(", ") : (t("game.combat.ruleset.roll.noSymbols") as string);
}

/** A symbol throw (1.382), for a `symbol-pool` fight: the symbols left after cancelling, from how
 *  many of the thrower's own dice (how many upgraded, the boost and setback dice, and what made them
 *  up). What it was thrown against is the line's to say. */
export function rulesetSymbolRollText(
  roll: { modifier: number; bonuses?: RulesetConditionBonus[]; pool: RulesetCombatPoolRoll },
  t: TFunction,
  bonusName: (bonus: RulesetConditionBonus) => string = (bonus) => bonus.condition,
  symbolName: (id: string) => string = (id) => id,
): string {
  const pool = roll.pool;
  const parts = [
    ...(pool.upgrades ? [t("game.combat.ruleset.roll.upgraded", { count: pool.upgrades })] : []),
    ...(pool.boost ? [t("game.combat.ruleset.roll.boost", { count: pool.boost })] : []),
    ...(pool.setback ? [t("game.combat.ruleset.roll.setback", { count: pool.setback })] : []),
    ...(roll.bonuses ?? []).map((bonus) =>
      t("game.combat.ruleset.roll.bonus", { value: signed(bonus.value), name: bonusName(bonus) }),
    ),
    ...(pool.penalty ? [t("game.combat.ruleset.roll.penalty", { value: signed(pool.penalty) })] : []),
  ];
  const dice = t("game.combat.ruleset.roll.dice", { count: pool.dice });
  return t("game.combat.ruleset.roll.symbols", {
    symbols: symbolsText(pool.symbols ?? {}, t, symbolName),
    dice: parts.length > 0 ? t("game.combat.ruleset.roll.poolFrom", { dice, parts: parts.join(", ") }) : dice,
  }) as string;
}

/** A defense in the ruleset's own word for it, when the file gave it one. */
function defenseText(names: RulesetCombatNames, defense: number): string {
  return names.defense ? `${names.defense} ${defense}` : String(defense);
}

/** A defense raised by what the target has on (Shield, a Parry): the number rolled against, the one it
 *  rose from, and what raised it, each value said once (#8273: "Armor Class 17 (Parrying
 *  (+2) + 2)"). A name that already carries its number is not given it again. */
function guardedText(
  t: TFunction,
  named: (bonus: RulesetConditionBonus) => string,
  defense: string,
  guards: readonly RulesetConditionBonus[],
  unguarded: number | undefined,
): string {
  // The base is said only where the event carries it: a pool's clamped need or a symbol throw's
  // difficulty is no defense plus its guards.
  return t(unguarded === undefined ? "game.combat.ruleset.roll.guarded" : "game.combat.ruleset.roll.guardedFrom", {
    defense,
    base: unguarded,
    guards: guards
      .map((guard) => {
        const name = named(guard);
        const own = new RegExp(`\\(\\s*${guard.value < 0 ? "-" : "\\+"}\\s*${Math.abs(guard.value)}\\s*\\)`);
        return own.test(name) ? name : t("game.combat.ruleset.roll.guard", { name, value: signed(guard.value) });
      })
      .join(", "),
  });
}

/** What a condition, or a level of a track or a derived value, that changed a number is called in the
 *  log. A level is named by what it reads. */
function bonusNamer(names: RulesetCombatNames, t: TFunction): (bonus: RulesetConditionBonus) => string {
  return (bonus) =>
    bonus.level === undefined
      ? bonus.item || bonus.entry
        ? bonus.condition
        : names.condition(bonus.condition)
      : t("game.combat.ruleset.roll.level", {
          track: (bonus.derived ? names.derived : names.track)(bonus.condition),
          level: bonus.level,
        });
}

/** The reason a step was refused, as a sentence. The server sends the same words back as the second
 *  half of a `ruleset_combat_<reason>` code, so one family of keys serves the log and the toast. */
export function rulesetRefusalKey(reason: string): string {
  const name = reason
    .split(/[-_]/u)
    .filter(Boolean)
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
  return `game.combat.ruleset.refusal.${name}`;
}

/** The sentence behind a 400 from the director's `ruleset` command. An unknown code keeps the
 *  server's own sentence rather than inventing one. */
export function rulesetRefusalText(code: string | undefined, serverText: string, t: TFunction): string {
  if (!code?.startsWith("ruleset_combat_")) return serverText;
  const key = rulesetRefusalKey(code.slice("ruleset_combat_".length));
  const translated = t(key, { defaultValue: "" });
  return translated || serverText;
}

/** A line of how the fight was built, in the reader's language (2026-10-26): read back into its
 *  template and shown as that template's translation, the values as they were (each through
 *  `named`, a ruleset's own words in the reader's language). A line that is no template, or one no
 *  translation is given for, is shown as written. */
export function rulesetFightNoteText(line: string, t: TFunction, named: (text: string) => string = (text) => text) {
  const note = readRulesetFightNote(line);
  if (!note) return line;
  const params = Object.fromEntries(Object.entries(note.params).map(([name, value]) => [name, named(value)]));
  const said = t(`game.combat.ruleset.note.${note.key}`, { ...params, defaultValue: "" });
  if (!said) return line;
  return note.of ? t("game.combat.ruleset.note.of", { name: named(note.of), line: said }) : said;
}

/** A check thrown on its own (1.287), as one side of a contest is written. */
function checkRollText(roll: RulesetContestSide, names: RulesetCombatNames, t: TFunction): string {
  return roll.pool
    ? rulesetPoolRollText({ ...roll, pool: roll.pool }, t, bonusNamer(names, t), names.symbol)
    : rulesetRollText(
        {
          ...roll,
          kept: roll.total - roll.modifier - (roll.bonuses ?? []).reduce((sum, bonus) => sum + bonus.value, 0),
        },
        t,
        bonusNamer(names, t),
      );
}

const STANDARD_ACTIONS = new Set(["dash", "disengage", "disarm", "dodge", "help", "hide", "ready", "search"]);

/** What each kind of held-open moment is called on screen. A window is not an interruption to
 *  apologise for: each of these says what is happening and who may answer it. */
const WINDOW_LINES = {
  between: "windowBetween",
  leaving: "windowLeaving",
  aimed: "windowAimed",
  hit: "windowHit",
  harmed: "windowHarmed",
  falls: "windowFalls",
  "turn-start": "windowTurnStart",
  used: "windowUsed",
  caught: "windowCaught",
  attacked: "windowAttacked",
  spend: "windowSpend",
} as const;

/**
 * One event as one line, or null for an event that says nothing a reader wants (a fight that is
 * still going, an id the fight no longer holds). Never throws: a saved fight read by a newer or an
 * older client has to keep printing.
 */
export function rulesetCombatEventLine(
  event: DirectedRulesetEvent,
  names: RulesetCombatNames,
  t: TFunction,
): string | null {
  const key = (name: string, params: Record<string, unknown> = {}) =>
    t(`game.combat.ruleset.event.${name}`, params) as string;
  // Those a search looked for with a throw of their own (1.290): a Cloak of Elvenkind's wearer.
  const searchApart = (apart: RulesetSearchApart[] | undefined) =>
    (apart ?? [])
      .map(
        (one) =>
          ` ${key("searchApart", {
            names: one.ids.map((id) => names.combatant(id)).join(", "),
            roll: checkRollText(one.check, names, t),
          })}`,
      )
      .join("");
  switch (event.type) {
    case "initiative":
      return key("initiative", {
        order: event.entries.map((entry) => `${names.combatant(entry.actorId)} ${entry.total}`).join(", "),
      });
    case "round":
      return key("round", { round: event.round });
    case "surprised":
      return key("surprised", { names: event.actorIds.map((id) => names.combatant(id)).join(", ") });
    case "extraTurn":
      return key("extraTurn", {
        actor: names.combatant(event.actorId),
        initiative: event.initiative,
        label: event.label,
      });
    case "added":
      return key("added", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        label: event.label,
        to: event.to,
      });
    case "surpriseOver":
      return key(event.label ? "surpriseShaken" : "surpriseOver", {
        actor: names.combatant(event.actorId),
        ...(event.label ? { label: event.label } : {}),
      });
    case "turn":
      return key("turn", { actor: names.combatant(event.actorId) });
    case "attack": {
      const named = bonusNamer(names, t);
      // A symbol throw carries its difficulty dice with it (1.382).
      if (event.pool?.symbols) {
        return key(event.outcome === "miss" ? "attackSymbolMiss" : "attackSymbolHit", {
          actor: names.combatant(event.actorId),
          target: names.combatant(event.targetId),
          label: event.label,
          roll: rulesetSymbolRollText({ ...event, pool: event.pool }, t, named, names.symbol),
          difficulty: t("game.combat.ruleset.roll.difficultyDice", { count: event.pool.difficulty ?? event.defense }),
        });
      }
      // The ruleset's own word for what it was rolled against, when the file gave it one, and what
      // the target's conditions added to it. A pool says how many successes it needed instead.
      const pool = event.pool;
      const defense = pool
        ? (t("game.combat.ruleset.roll.needed", { count: event.defense }) as string)
        : defenseText(names, event.defense);
      // Why it was rolled twice, or why the two cancelled: "Advantage: Hidden. Disadvantage: Dodging."
      const reason = (list: string[] | undefined) =>
        (list ?? [])
          .map((one) => (one.startsWith("@") ? t(`game.combat.ruleset.roll.why.${one.slice(1)}`) : one))
          .join(", ");
      const why = [
        event.why?.up?.length ? key("attackWhyUp", { list: reason(event.why.up) }) : "",
        event.why?.down?.length ? key("attackWhyDown", { list: reason(event.why.down) }) : "",
      ]
        .filter(Boolean)
        .join(" ");
      const line = key(
        pool
          ? event.outcome === "miss"
            ? "attackPoolMiss"
            : "attackPoolHit"
          : event.outcome === "critical"
            ? "attackCritical"
            : event.outcome === "hit"
              ? "attackHit"
              : "attackMiss",
        {
          actor: names.combatant(event.actorId),
          target: names.combatant(event.targetId),
          label: event.style
            ? t("game.combat.ruleset.event.attackStyle", { label: event.label, style: names.style(event.style) })
            : event.label,
          roll: pool ? rulesetPoolRollText({ ...event, pool }, t, named) : rulesetRollText(event, t, named),
          defense: event.guards?.length ? guardedText(t, named, defense, event.guards, event.unguarded) : defense,
        },
      );
      return why ? `${line} ${why}` : line;
    }
    case "save": {
      // Against the action that forced it, by name: Sacred Flame has no attack line to say so.
      const saveName =
        event.label && event.sourceId
          ? t("game.combat.ruleset.event.saveAgainst", {
              save: names.save(event.save),
              actor: names.combatant(event.sourceId),
              label: event.label,
            })
          : names.save(event.save);
      if (event.automatic) {
        return key(event.success ? "saveAutomaticSuccess" : "saveAutomatic", {
          actor: names.combatant(event.actorId),
          save: saveName,
        });
      }
      if (event.pool?.symbols) {
        return key(event.success ? "saveSymbolSuccess" : "saveSymbolFailure", {
          actor: names.combatant(event.actorId),
          save: names.save(event.save),
          roll: rulesetSymbolRollText({ ...event, pool: event.pool }, t, bonusNamer(names, t), names.symbol),
          difficulty: t("game.combat.ruleset.roll.difficultyDice", {
            count: event.pool.difficulty ?? event.difficulty,
          }),
        });
      }
      if (event.pool) {
        return key(event.success ? "savePoolSuccess" : "savePoolFailure", {
          actor: names.combatant(event.actorId),
          save: saveName,
          roll: rulesetPoolRollText({ ...event, pool: event.pool }, t, bonusNamer(names, t)),
          needed: t("game.combat.ruleset.roll.needed", { count: event.difficulty }),
        });
      }
      return key(event.success ? "saveSuccess" : "saveFailure", {
        actor: names.combatant(event.actorId),
        save: saveName,
        roll: rulesetRollText(event, t, bonusNamer(names, t)),
        difficulty: event.difficulty,
      });
    }
    case "damage": {
      // A pool fight's damage is its own throw: what the dice counted (and the automatic successes
      // beside them), then what soak took off, thrown or off the dice, before the harm lands.
      const lines = event.pool ? poolHarmLines({ ...event, pool: event.pool }, event.targetId, names, key, t) : [];
      lines.push(
        key(event.damageType ? "damage" : "damageUntyped", {
          target: names.combatant(event.targetId),
          amount: event.dealt,
          type: event.damageType ?? "",
          health: event.health,
          maxHealth: event.maxHealth,
        }),
      );
      if (event.critical) lines.push(key("damageCritical"));
      if (event.floor !== undefined) lines.push(key("damageFloor", { floor: event.floor }));
      if (event.resistedBy) lines.push(key("damageResistBy", { condition: names.condition(event.resistedBy) }));
      else if (event.adjust !== "none")
        lines.push(key(`damage${event.adjust[0]!.toUpperCase()}${event.adjust.slice(1)}`));
      if (event.saved) lines.push(key("damageSaved"));
      if (event.toTemp > 0) lines.push(key("damageTemporary", { amount: event.toTemp }));
      return lines.join(" ");
    }
    case "shift": {
      // A number attacks move. What a taking blow took is its damage throw, spelled out as damage is,
      // before what it did to the number.
      const actor = names.combatant(event.actorId);
      const source = names.combatant(event.sourceId);
      if (event.reason === "taken") {
        const lines = event.pool
          ? poolHarmLines(
              { rolls: event.rolls ?? [], flat: event.flat ?? 0, pool: event.pool },
              event.actorId,
              names,
              key,
              t,
            )
          : [];
        lines.push(key("shiftTaken", { actor, amount: -event.amount, total: event.total }));
        return lines.join(" ");
      }
      if (event.reason === "gained") return key("shiftGained", { actor, amount: event.amount, total: event.total });
      if (event.reason === "crash") {
        return key("shiftCrash", { actor, source, amount: event.amount, total: event.total });
      }
      if (event.reason === "missed") return key("shiftMissed", { actor, amount: -event.amount, total: event.total });
      return key(event.reason === "spent" ? "shiftSpent" : "shiftRecovered", { actor, total: event.total });
    }
    case "daze":
      return [
        key("daze", { target: names.combatant(event.targetId), damage: event.damage, over: event.over }),
        event.text,
      ]
        .filter(Boolean)
        .join(" ");
    case "skip":
      // Not commanded by its caller (1.558).
      if (event.reason === "uncommanded") return key("skipUncommanded", { actor: names.combatant(event.actorId) });
      // Under nobody's control (1.615): it only walks toward its caller.
      if (event.reason === "wild") return key("skipWild", { actor: names.combatant(event.actorId) });
      return key("skipDazed", { actor: names.combatant(event.actorId) });
    case "heal":
      if (event.blocked) return key("healBlocked", { target: names.combatant(event.targetId) });
      return key(event.label && event.sourceId ? "healBy" : "heal", {
        target: names.combatant(event.targetId),
        ...(event.label && event.sourceId ? { actor: names.combatant(event.sourceId), label: event.label } : {}),
        amount: event.amount,
        health: event.health,
        maxHealth: event.maxHealth,
      });
    case "temporary":
      // Lost with the condition that gave them (1.274): Heroism's.
      if (event.lost) return key("temporaryLost", { target: names.combatant(event.targetId), amount: event.amount });
      return key("temporary", { target: names.combatant(event.targetId), amount: event.amount });
    case "restored":
      return key("restored", {
        target: names.combatant(event.targetId),
        amount: event.amount,
        pool: event.pool,
        value: event.value,
        max: event.max,
      });
    case "condition":
      return key(`condition${event.reason[0]!.toUpperCase()}${event.reason.slice(1)}`, {
        target: names.combatant(event.targetId),
        condition: names.condition(event.condition),
        ...(event.stacks !== undefined ? { stacks: event.stacks } : {}),
      });
    // Readying (1.288).
    case "ready":
      return key(
        event.outcome === "readied"
          ? event.on === "comes"
            ? "readyComes"
            : "readyActs"
          : event.outcome === "released"
            ? "readyReleased"
            : event.outcome === "expired"
              ? "readyExpired"
              : "readyLost",
        { actor: names.combatant(event.actorId), label: event.label },
      );
    // A legendary search (1.287).
    case "search": {
      const roll = checkRollText(event.check, names, t);
      const line =
        event.found.length > 0
          ? key("searchFound", {
              actor: names.combatant(event.actorId),
              label: event.label,
              roll,
              names: event.found.map((id) => names.combatant(id)).join(", "),
            })
          : key("searchNone", { actor: names.combatant(event.actorId), label: event.label, roll });
      return `${line}${searchApart(event.apart)}`;
    }
    // Hiding given away (1.287).
    case "revealed":
      // Given away by a chime (1.319).
      if (event.reason === "alerted") {
        return key("revealedAlerted", {
          actor: names.combatant(event.actorId),
          holder: names.combatant(event.alertedBy ?? ""),
        });
      }
      return key(
        event.reason === "attack"
          ? "revealedAttack"
          : event.reason === "noise"
            ? "revealedNoise"
            : event.reason === "moved"
              ? "revealedMoved"
              : "revealedSeen",
        {
          actor: names.combatant(event.actorId),
          names: event.byIds.map((id) => names.combatant(id)).join(", "),
        },
      );
    case "contest": {
      // Both sides as a roll, with the check each one added, so the line reads the way the table
      // would say it without adding anything up itself.
      // What was kept is what is left of the total once the check and the conditions are taken off
      // it: the whole handful, or the better or worse of two.
      const side = (roll: (typeof event)["attacker"]) => ({
        check: names.check(roll.check),
        roll: checkRollText(roll, names, t),
      });
      const attacker = side(event.attacker);
      // Breaking free of a hold that names its escape DC: a roll against that number, nobody else's.
      if (event.escapeDc !== undefined) {
        return key(event.winner === "actor" ? "contestEscapeWon" : "contestEscapeLost", {
          actor: names.combatant(event.actorId),
          target: names.combatant(event.targetId),
          label: event.label,
          roll: attacker.roll,
          check: attacker.check,
          dc: event.escapeDc,
        });
      }
      // A treatment against its own number (1.193): nobody else rolled.
      if (event.difficulty !== undefined) {
        return key(event.winner === "actor" ? "contestDifficultyWon" : "contestDifficultyLost", {
          actor: names.combatant(event.actorId),
          target: names.combatant(event.targetId),
          label: event.label,
          roll: attacker.roll,
          check: attacker.check,
          dc: event.difficulty,
        });
      }
      const defender = side(event.defender);
      return key(event.winner === "actor" ? "contestWon" : "contestLost", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        label: event.label,
        roll: attacker.roll,
        check: attacker.check,
        against: defender.roll,
        targetCheck: defender.check,
      });
    }
    case "fell":
      return key("fell", { target: names.combatant(event.targetId), distance: names.height(event.levels) });
    case "slain":
      return key("slain", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        label: event.label,
      });
    case "dropped":
      return key("dropped", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        label: event.label,
      });
    case "altered":
      return key("altered", {
        actor: names.combatant(event.actorId),
        label: event.label,
        alters: event.alters.join(", "),
      });
    case "lowered":
      // Off a check or a damage roll (1.257), or else an attack roll.
      return key(event.roll === "checks" ? "loweredCheck" : event.roll === "damage" ? "loweredDamage" : "lowered", {
        actor: names.combatant(event.actorId),
        label: event.label,
        by: event.by,
        target: names.combatant(event.targetId),
        to: event.to,
        total: event.total,
      });
    case "evaded":
      return key("evaded", { target: names.combatant(event.targetId), label: event.label });
    case "refilled":
      return key("refilled", {
        actor: names.combatant(event.actorId),
        label: event.label,
        pool: event.pool,
        now: event.now,
      });
    case "rerolled":
      return key("rerolled", {
        actor: names.combatant(event.actorId),
        label: event.label,
        face: event.face,
        to: event.to,
      });
    case "rescued":
      return key(`rescued${event.by[0]!.toUpperCase()}${event.by.slice(1)}`, {
        actor: names.combatant(event.actorId),
        label: event.label,
      });
    case "dismissed":
      return key(event.while ? "dismissedWhile" : "dismissed", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        label: event.label,
        ...(event.while ? { condition: names.condition(event.while) } : {}),
      });
    case "left":
      return event.by
        ? key("leftAlong", {
            actor: names.combatant(event.actorId),
            by: names.combatant(event.by),
            label: event.label,
          })
        : key("left", { actor: names.combatant(event.actorId), label: event.label });
    // How a teleport out of the fight went (1.670).
    case "teleportRoll":
      return key(
        event.outcome === "mishap"
          ? "teleportRollMishap"
          : event.outcome === "similar"
            ? "teleportRollSimilar"
            : event.outcome === "off-target"
              ? "teleportRollOffTarget"
              : "teleportRollOnTarget",
        { actor: names.combatant(event.actorId), label: event.label, row: event.row, roll: event.roll },
      );
    case "returned":
      return key(event.gone ? "returnedGone" : "returned", { target: names.combatant(event.targetId) });
    // Called creatures come after their caller's turns (1.614): Children of the Night's.
    case "arrived":
      return key("arrived", {
        actor: names.combatant(event.actorId),
        names: event.ids.map((id) => names.combatant(id)).join(", "),
      });
    // What a creature does as it dies (1.540): a mephit's Death Burst.
    case "turnRoll":
      return key(event.roll >= event.atLeast ? "turnRollMet" : "turnRollMissed", {
        actor: names.combatant(event.actorId),
        roll: event.roll,
        conditions: event.conditions.map((one) => names.condition(one)).join(", "),
      });
    // A weapon corroded on what it hit (1.551).
    case "corroded":
      return key(event.ammunition ? "corrodedAmmo" : event.destroyed ? "corrodedDestroyed" : "corroded", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        label: event.label,
        penalty: event.penalty,
      });
    // A hydra's heads (1.550).
    case "headLost":
      return key("headLost", { actor: names.combatant(event.actorId), left: event.left });
    case "headsGrow":
      return event.burned
        ? key("headsBurned", { actor: names.combatant(event.actorId) })
        : key("headsGrow", { actor: names.combatant(event.actorId), grown: event.grown, heads: event.heads });
    case "rampage":
      return key("rampage", { actor: names.combatant(event.actorId), label: event.label });
    case "goesAt":
      return key("goesAt", {
        actor: names.combatant(event.actorId),
        condition: names.condition(event.condition),
        target: names.combatant(event.targetId),
      });
    case "deathBurst":
      return key("deathBurst", { actor: names.combatant(event.actorId), label: event.label });
    // Another use's effect beside the one used (1.535): Thunderclap with Lightning Strike.
    case "alongside":
      return key("alongside", { actor: names.combatant(event.actorId), label: event.label, to: event.to });
    // A sequence's rolled strikes (1.643): a violet fungus's 1d4 touches.
    case "strikesRolled":
      return key("strikesRolled", {
        actor: names.combatant(event.actorId),
        label: event.label,
        dice: event.dice,
        count: event.count,
      });
    // A table rolled as something was used (1.559): a Wand of Wonder's d100.
    case "rolledTable":
      return key("rolledTable", {
        actor: names.combatant(event.actorId),
        label: event.label,
        roll: event.roll,
        of: event.of,
        result: event.result,
      });
    // Set aside by a zone (1.533): Antimagic Field's summons.
    case "setAside":
      return key("setAside", { target: names.combatant(event.targetId), label: event.label });
    // Stored to be cast later (1.524): a Ring of Spell Storing's.
    case "stored":
      return key("stored", {
        actor: names.combatant(event.actorId),
        label: event.label,
        by: event.by,
        level: event.level,
      });
    // Turned back at its user (1.523): a Ring of Spell Turning's.
    case "turnedBack":
      return key("turnedBack", {
        target: names.combatant(event.targetId),
        source: names.combatant(event.sourceId),
        label: event.label,
        by: event.by,
      });
    // A foe's entry taken in by its only target (1.522): a Rod of Absorption's.
    case "absorbed":
      return key(event.charges ? "absorbedCharges" : "absorbed", {
        target: names.combatant(event.targetId),
        label: event.label,
        by: event.by,
        now: event.charges?.now ?? 0,
        max: event.charges?.max ?? 0,
      });
    // A check made to end a condition (1.313): Maze's way out.
    case "checkEnded":
      // For somebody else (1.518): a creature on fire doused by a friend.
      if (event.holderId)
        return key(event.success ? "checkEndedFor" : "checkEndedForFailed", {
          actor: names.combatant(event.actorId),
          target: names.combatant(event.holderId),
          condition: names.condition(event.condition),
          total: event.total ?? 0,
          difficulty: event.difficulty,
        });
      return key(event.automatic ? "checkEndedAutomatic" : event.success ? "checkEnded" : "checkEndedFailed", {
        actor: names.combatant(event.actorId),
        condition: names.condition(event.condition),
        total: event.total ?? 0,
        difficulty: event.difficulty,
      });
    case "sphere":
      return event.how === "rolled"
        ? key("sphereRolled", { actor: names.combatant(event.actorId), cells: event.cells ?? 0 })
        : key(event.how === "lifted" ? "sphereLifted" : "spherePutDown", {
            actor: names.combatant(event.actorId),
            target: names.combatant(event.targetId ?? ""),
          });
    case "charged":
      return key("charged", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        label: event.label,
      });
    case "healthPool":
      return event.affected.length
        ? key("healthPool", {
            actor: names.combatant(event.actorId),
            label: event.label,
            total: event.total,
            names: event.affected.map((id) => names.combatant(id)).join(", "),
          })
        : key("healthPoolNone", { actor: names.combatant(event.actorId), label: event.label, total: event.total });
    case "compelled": {
      const values = {
        actor: names.combatant(event.actorId),
        condition: names.condition(event.condition),
        roll: event.roll,
      };
      if (event.does === "strike")
        return key("compelledStrike", { ...values, target: names.combatant(event.targetId ?? "") });
      return key(`compelled${event.does[0]!.toUpperCase()}${event.does.slice(1)}`, values);
    }
    case "split":
      // A creature split in two (1.475): a Black Pudding.
      return key("split", {
        actor: names.combatant(event.actorId),
        names: event.ids.map((id) => names.combatant(id)).join(", "),
        health: event.health,
      });
    case "raisedMax":
      // A health maximum raised (1.473): Aid.
      return key("raisedMax", {
        target: names.combatant(event.targetId),
        condition: names.condition(event.condition),
        amount: event.amount,
      });
    case "ray":
      // A ray rolled for one target (1.468): Prismatic Spray.
      return key("ray", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        label: event.label,
        ray: event.ray,
        roll: event.roll,
      });
    case "steered":
      // Holders of a condition steered (1.464): Compulsion.
      return key("steered", {
        actor: names.combatant(event.actorId),
        label: event.label,
        targets: event.targetIds.map((id) => names.combatant(id)).join(", "),
      });
    case "wasted":
      // A turn's budget lost to a condition (1.463): Bestow Curse.
      return key("wasted", {
        actor: names.combatant(event.actorId),
        condition: names.condition(event.condition),
        budget: event.label,
      });
    // What a contest won took away (1.668): Telekinesis on a held object.
    case "takenAway":
      return key("takenAway", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        label: event.label,
        items: event.labels.join(", "),
      });
    case "massiveDeath":
      return key("massiveDeath", { actor: names.combatant(event.actorId) });
    case "letFall":
      return key("letFall", {
        actor: names.combatant(event.actorId),
        condition: names.condition(event.condition),
        items: event.labels.join(", "),
      });
    case "lent":
      return key("lent", {
        actor: names.combatant(event.actorId),
        called: names.combatant(event.calledId),
        label: event.label,
      });
    case "pickedUp":
      return key("pickedUp", { actor: names.combatant(event.actorId), item: event.label });
    case "drew":
      return key(event.stowed.length ? "drewStowing" : "drew", {
        actor: names.combatant(event.actorId),
        item: event.label,
        ...(event.stowed.length ? { stowed: event.stowed.join(", ") } : {}),
      });
    case "sanctuary":
      return key(event.to ? "sanctuary" : "sanctuaryLost", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.holderId),
        label: event.label,
        ...(event.to ? { instead: names.combatant(event.to) } : {}),
      });
    case "averted":
      return key(event.back ? "lookedBack" : "averted", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.holderId),
      });
    case "resized":
      return key("resized", { target: names.combatant(event.targetId), size: event.label });
    // Struck at to cut it away (1.531): a net.
    case "cut":
      return key(event.outcome === "miss" ? "cutMiss" : event.freed ? "cutFreed" : "cut", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.holderId),
        label: event.label,
        condition: event.condition,
        dealt: event.dealt,
        left: event.left,
      });
    case "section":
      return key(event.outcome === "miss" ? "sectionMiss" : event.broken ? "sectionBroken" : "section", {
        actor: names.combatant(event.actorId),
        label: event.label,
        wall: event.wall,
        dealt: event.dealt,
        health: event.health,
      });
    // A prop lit again (1.332).
    case "relit":
      return key("relit", { actor: names.combatant(event.actorId), label: event.label });
    // Held Ground let go mid-fight (1.330), and the marks coming due.
    case "heldGroundReleased": {
      const line = key(event.label ? "heldGroundReleasedNamed" : "heldGroundReleased", { label: event.label ?? "" });
      const died = event.died.map((id) => names.combatant(id)).join(", ");
      const down = (event.down ?? []).map((id) => names.combatant(id)).join(", ");
      return [
        line,
        died ? key("heldGroundDied", { names: died }) : "",
        down ? key("heldGroundDown", { names: down }) : "",
      ]
        .filter(Boolean)
        .join(" ");
    }
    case "owing":
      return key(event.result === "dead" ? "owingDead" : "owingSafe", {
        actor: names.combatant(event.actorId),
        count: event.rolls.length,
        rolls: event.rolls.map((roll) => roll + event.bonus).join(", "),
      });
    // Felled on Held Ground, and reaped (1.323).
    case "felled":
      return key(event.label ? "felledNamed" : "felled", {
        actor: names.combatant(event.actorId),
        label: event.label ?? "",
      });
    case "reaped":
      return key("reaped", {
        actor: names.combatant(event.actorId),
        source: event.sourceId ? names.combatant(event.sourceId) : "",
      });
    // Drawn toward whoever spoke to them (1.326): Whisper a Name.
    case "drawn":
      return key("drawn", { actor: names.combatant(event.actorId), target: names.combatant(event.targetId) });
    // What was stored cast by itself at its moment (1.569): Contingency.
    case "storedCast":
      return key("storedCast", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        label: event.label,
      });
    // An image passed through (1.568): Mislead's double.
    case "seenThrough":
      return key("seenThrough", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        label: event.label,
      });
    // Lifted by a condition they now hold (1.566): Reverse Gravity.
    case "lifted":
      return key("lifted", { target: names.combatant(event.targetId), levels: event.to });
    // Moved where whoever won them over picked (1.565): Telekinesis.
    case "carried":
      return key(event.rises ? "carriedUp" : "carried", {
        label: event.label,
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        levels: event.rises ?? 0,
      });
    // Creatures called into the fight (1.325): Jars Burst.
    case "called": {
      const said = key(event.ids.length ? (event.disobeys ? "calledDisobeys" : "called") : "calledNone", {
        actor: names.combatant(event.actorId),
        label: event.label,
        names: event.ids.map((id) => names.combatant(id)).join(", "),
      });
      // Those that did not come, and why (cloud summons check 2026-10-25).
      if (!event.short) return said;
      const why =
        event.short.why === "seen" && event.short.cells !== undefined
          ? key("calledShortSeen", {
              count: event.short.count,
              actor: names.combatant(event.actorId),
              distance: names.distance(event.short.cells),
            })
          : key(event.short.why === "full" ? "calledShortFull" : "calledShortRoom", { count: event.short.count });
      return `${said} ${why}`;
    }
    // Health regained as a turn starts (1.396): Regeneration, Survivor.
    // Taken inside somebody, or let out beside them (1.403).
    case "inside":
      return key(event.out ? "letOut" : "inside", {
        target: names.combatant(event.targetId),
        holder: names.combatant(event.holderId),
      });
    // Holding their breath under water (1.498), or out of it.
    case "breath":
      return key(event.held > 0 ? "breathHeld" : event.lasts > 0 ? "breathGone" : "breathOut", {
        actor: names.combatant(event.actorId),
        count: event.held > 0 ? event.held : event.lasts,
      });
    // Up on a mount, down off it, or thrown (1.496).
    case "mount":
      return key(event.off ? (event.fell ? "thrown" : "dismounted") : "mounted", {
        rider: names.combatant(event.riderId),
        mount: names.combatant(event.mountId),
      });
    case "regenerates":
      return key(event.stopped ? "regenerationStopped" : "regenerates", {
        actor: names.combatant(event.actorId),
        amount: event.amount,
      });
    // Called creatures sent away (1.394): Conjure Animals' minute up, or its concentration broken.
    case "sentAway":
      return key("sentAway", {
        actor: names.combatant(event.actorId),
        names: event.ids.map((id) => names.combatant(id)).join(", "),
      });
    // Called creatures turning on their caller's side (1.538): Conjure Elemental's, concentration broken.
    // An item spent for good as what it called dies (1.612): a Ring of Djinni Summoning.
    case "itemSpent":
      return key("itemSpent", { actor: names.combatant(event.actorId), label: event.label });
    // A missile caught and kept (1.626): Gloves of Missile Snaring.
    case "missileKept":
      return key("missileKept", { actor: names.combatant(event.actorId), label: event.label });
    // An item backfiring on its user (1.630): a Horn of Blasting exploding.
    case "backfired":
      return key(event.destroyed ? "backfiredDestroyed" : "backfired", {
        actor: names.combatant(event.actorId),
        label: event.label,
        roll: event.roll,
      });
    case "turnedOn":
      return key("turnedOn", {
        actor: names.combatant(event.actorId),
        names: event.ids.map((id) => names.combatant(id)).join(", "),
      });
    // A shape taken, given up or refused (1.392): Wild Shape, Polymorph.
    case "shaped":
      return key(event.refused ? "shapeRefused" : event.gone ? "shapeGone" : "shaped", {
        actor: names.combatant(event.targetId),
        form: event.form,
      });
    // Hanging on at 1 (1.320): the Hourglass; with no count of uses (1.400), Undead Fortitude.
    case "hangsOn":
      // Spared being slain outright (1.596): Death Ward.
      if (event.outright)
        return key(event.label ? "hangsOnOutrightNamed" : "hangsOnOutright", {
          actor: names.combatant(event.actorId),
          label: event.label ?? "",
        });
      if (event.left === undefined)
        return key(event.label ? "hangsOnAgainNamed" : "hangsOnAgain", {
          actor: names.combatant(event.actorId),
          label: event.label ?? "",
        });
      return key(event.label ? "hangsOnNamed" : "hangsOn", {
        actor: names.combatant(event.actorId),
        label: event.label ?? "",
        left: event.left,
      });
    // An aura grown (1.320).
    case "auraGrows":
      return key("auraGrows", {
        actor: names.combatant(event.actorId),
        condition: names.condition(event.condition),
        distance: event.distance,
      });
    // A board's light rule catching somebody (1.319).
    case "lightRule": {
      // With its save (1.321), whether it was made.
      const named = !!event.label;
      const name = !event.save
        ? named
          ? "lightRuleNamed"
          : "lightRule"
        : event.save.saved
          ? named
            ? "lightRuleSavedNamed"
            : "lightRuleSaved"
          : named
            ? "lightRuleFailedNamed"
            : "lightRuleFailed";
      return key(name, {
        actor: names.combatant(event.actorId),
        label: event.label ?? "",
        rounds: event.rounds,
        total: event.save?.total ?? 0,
      });
    }
    // The board doing something on its own (1.318), and growth taken off it.
    case "boardEvent": {
      const line = event.tell
        ? key("boardEventTell", { tell: event.tell })
        : key("boardEvent", { label: event.label ?? event.id, cells: event.cells });
      // Who it carried (1.329).
      if (!event.pushed?.length) return line;
      const carried = event.pushed.map((one) => names.combatant(one.id)).join(", ");
      return `${line} ${key("boardEventCarried", { names: carried })}`;
    }
    case "growth":
      return key(event.by === "cut" ? "growthCut" : event.by === "burnt" ? "growthBurnt" : "growthCleared", {
        actor: event.actorId ? names.combatant(event.actorId) : "",
        label: event.label ?? "",
        count: event.cells,
      });
    // A prop struck or caught in an area (1.316).
    case "prop":
      return key(
        event.outcome === "miss"
          ? "propMiss"
          : event.broken
            ? event.outcome === "area"
              ? "propAreaBroken"
              : "propBroken"
            : event.outcome === "area"
              ? "propArea"
              : "prop",
        {
          actor: names.combatant(event.actorId),
          label: event.label,
          prop: event.prop,
          dealt: event.dealt,
          health: event.health,
        },
      );
    // Taken by a carapace (1.723).
    case "reflected":
      return key(event.back ? "reflectedBack" : "reflected", {
        target: names.combatant(event.targetId),
        source: names.combatant(event.sourceId),
        label: event.label,
        by: event.by,
        roll: event.roll,
      });
    // Items made by a cast (1.721).
    case "itemsMade":
      return key("itemsMade", { actor: names.combatant(event.actorId), label: event.label, count: event.count });
    // What was made vanishing as its time runs out (1.760).
    case "itemsVanished":
      return key("itemsVanished", { actor: names.combatant(event.actorId), label: event.label, count: event.count });
    // Losing heart (1.762), and getting away once broken: what set it off first (re-test 14).
    case "moraleCheck":
      return key(`moraleCheck.${keySegment(event.trigger)}`, { actor: names.combatant(event.actorId) });
    // A temperament turning (combat AI T7), and a territorial one keeping its ground (T4).
    case "temperamentShift":
      return key("temperamentShift", {
        actor: names.combatant(event.actorId),
        to: t(`game.combat.ai.adjective.${event.to}`, { defaultValue: event.to }).toLowerCase(),
        on: key(`temperamentShiftOn.${keySegment(event.on)}`),
      });
    case "holdsGround":
      return key("holdsGround", { actor: names.combatant(event.actorId) });
    case "morale":
      return key(
        event.outcome === "held" ? "moraleHeld" : event.outcome === "flee" ? "moraleFlee" : "moraleSurrender",
        { actor: names.combatant(event.actorId) },
      );
    case "fled":
      return key("fled", { actor: names.combatant(event.actorId) });
    // Knocked out by a pulled blow (1.720).
    case "knockedOut":
      return key("knockedOut", { actor: names.combatant(event.actorId), source: names.combatant(event.sourceId) });
    case "pushBraced":
      return key("pushBraced", {
        actor: names.combatant(event.actorId),
        label: event.label,
        distance: names.distance(event.cells),
      });
    case "pushed":
      // And moved with them (1.598): the Forceful Hand.
      // Or pulled in (1.675): a balor's whip.
      return key(event.pulled ? "pulled" : event.followed ? "pushedFollowed" : "pushed", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        distance: names.distance(event.path.length),
        x: event.to.x,
        y: event.to.y,
      });
    case "teleported":
      // Kept in by a zone, its save failed (1.603).
      if (event.heldIn)
        return key("teleportHeld", { actor: names.combatant(event.actorId), label: event.label, zone: event.heldIn });
      return event.by
        ? key("teleportedAlong", {
            actor: names.combatant(event.actorId),
            by: names.combatant(event.by),
            label: event.label,
            x: event.to.x,
            y: event.to.y,
          })
        : key("teleported", {
            actor: names.combatant(event.actorId),
            label: event.label,
            x: event.to.x,
            y: event.to.y,
          });
    case "spend": {
      // "1 1st-level slot", not "1 1st-level slots" (laptop level-4 pass 2026-10-26).
      const pool = names.poolUnits?.(event.pool, event.amount) ?? event.label;
      return event.on
        ? key("spendOn", { actor: names.combatant(event.actorId), amount: event.amount, pool, on: event.on })
        : key("spend", { actor: names.combatant(event.actorId), amount: event.amount, pool });
    }
    case "budget":
      return key("budget", {
        actor: names.combatant(event.actorId),
        budget: names.budget(event.budget),
        left: event.left,
      });
    case "prayed":
      return key("prayed", { actor: names.combatant(event.actorId), label: event.label });
    case "uses":
      return key("uses", { label: event.label, left: event.left, of: event.of });
    case "broke":
      return event.becomes
        ? key("brokeBecomes", { label: event.label, roll: event.roll, becomes: event.becomes })
        : key("broke", { label: event.label, roll: event.roll });
    case "recharged":
      return key("recharged", { label: event.label, roll: event.roll, amount: event.amount });
    case "conjured":
      return event.gone
        ? key("conjuredGone", { actor: names.combatant(event.actorId), item: event.item })
        : key("conjured", { actor: names.combatant(event.actorId), label: event.label, item: event.item });
    case "fake":
      return key(event.dud ? "fakeDud" : "fake", { label: event.label, truly: event.truly });
    case "gate":
      if (event.pool?.symbols) {
        return key(event.success ? "gateSymbolSuccess" : "gateSymbolFailure", {
          actor: names.combatant(event.actorId),
          check: event.check,
          label: event.label,
          roll: rulesetSymbolRollText({ ...event, pool: event.pool }, t, bonusNamer(names, t), names.symbol),
          difficulty: t("game.combat.ruleset.roll.difficultyDice", {
            count: event.pool.difficulty ?? event.difficulty,
          }),
        });
      }
      if (event.pool) {
        return key(event.success ? "gatePoolSuccess" : "gatePoolFailure", {
          actor: names.combatant(event.actorId),
          check: event.check,
          label: event.label,
          roll: rulesetPoolRollText({ ...event, pool: event.pool }, t, bonusNamer(names, t)),
          needed: t("game.combat.ruleset.roll.needed", { count: event.difficulty }),
        });
      }
      return key(event.success ? "gateSuccess" : "gateFailure", {
        actor: names.combatant(event.actorId),
        check: event.check,
        label: event.label,
        roll: rulesetRollText(event, t, bonusNamer(names, t)),
        difficulty: event.difficulty,
      });
    case "summon":
      return key(
        event.outcome === "appeared" ? "summonAppeared" : event.outcome === "struck" ? "summonStruck" : "summonEnded",
        { actor: names.combatant(event.actorId), label: event.label },
      );
    case "zone":
      // A lasting area (1.172): where it stands, what ends it, and whom it catches and how. Moved
      // by its caster or drifting, and hurting whoever crosses its ground (1.173).
      if (event.outcome === "shoved") {
        return key("zoneShoved", {
          actor: names.combatant(event.actorId),
          label: event.label,
          target: names.combatant(event.targetId ?? ""),
        });
      }
      // Going off, and catching fire (1.183).
      if (event.outcome === "detonated" || event.outcome === "burning") {
        return key(event.outcome === "detonated" ? "zoneDetonated" : "zoneBurning", {
          actor: names.combatant(event.actorId),
          label: event.label,
        });
      }
      // A hidden one found (1.455).
      if (event.outcome === "found") {
        return key("zoneFound", {
          actor: names.combatant(event.actorId),
          label: event.label,
          target: names.combatant(event.targetId ?? ""),
        });
      }
      // A layered wall's layer destroyed, or holding (1.490), and each layer crossed.
      if (event.outcome === "layer-gone" || event.outcome === "layer-held") {
        return key(event.outcome === "layer-gone" ? "zoneLayerGone" : "zoneLayerHeld", {
          actor: names.combatant(event.actorId),
          label: event.label,
          layer: event.layer ?? "",
        });
      }
      if (event.outcome === "struck" && event.layer) {
        return key("zoneLayerStruck", {
          actor: names.combatant(event.actorId),
          label: event.label,
          layer: event.layer,
          target: names.combatant(event.targetId ?? ""),
        });
      }
      // Blown away by a strong wind (1.286).
      if (event.outcome === "dispersed") {
        return key("zoneDispersed", { actor: names.combatant(event.actorId), label: event.label });
      }
      // Magical darkness a light met (1.297).
      if (event.outcome === "dispelled") {
        return key("zoneDispelled", { actor: names.combatant(event.actorId), label: event.label });
      }
      if (event.outcome === "turned") {
        return key("zoneTurned", { actor: names.combatant(event.actorId), label: event.label });
      }
      // A trap disarmed, or not (1.669), and the check it was tried with.
      if (event.outcome === "disarmed" || event.outcome === "disarm-failed") {
        return key(event.outcome === "disarmed" ? "zoneDisarmed" : "zoneDisarmFailed", {
          actor: names.combatant(event.actorId),
          label: event.label,
          target: names.combatant(event.targetId ?? ""),
          roll: event.check ? checkRollText(event.check, names, t) : "",
        });
      }
      // Closed by its caster, and widened (1.637): an Eversmoking Bottle.
      if (event.outcome === "closed" || event.outcome === "spread") {
        return key(event.outcome === "closed" ? "zoneClosed" : "zoneSpread", {
          actor: names.combatant(event.actorId),
          label: event.label,
        });
      }
      // On to its next stage (1.557).
      if (event.outcome === "stage") {
        return key("zoneStage", {
          actor: names.combatant(event.actorId),
          label: event.label,
          layer: event.layer ?? "",
        });
      }
      if (event.outcome === "moved" || event.outcome === "drifted") {
        return key(event.outcome === "moved" ? "zoneMoved" : "zoneDrifted", {
          actor: names.combatant(event.actorId),
          label: event.label,
        });
      }
      return event.outcome === "struck"
        ? key(
            event.trigger === "moving"
              ? "zoneStruckMoving"
              : event.trigger === "ram"
                ? "zoneStruckRam"
                : event.trigger === "enter"
                  ? event.reached
                    ? "zoneStruckReached"
                    : "zoneStruckEnter"
                  : event.trigger === "turn-end"
                    ? "zoneStruckEnd"
                    : "zoneStruckStart",
            {
              actor: names.combatant(event.actorId),
              label: event.label,
              target: names.combatant(event.targetId ?? ""),
            },
          )
        : key(event.outcome === "appeared" ? "zoneAppeared" : "zoneEnded", {
            actor: names.combatant(event.actorId),
            label: event.label,
          });
    case "casting": {
      // A cast taking rounds (1.461).
      const said = { actor: names.combatant(event.actorId), label: event.label, left: event.left ?? 0 };
      if (event.outcome === "started") return key("castingStarted", said);
      if (event.outcome === "continued") return key("castingContinued", said);
      if (event.outcome === "completed") return key("castingCompleted", said);
      return key("castingLost", said);
    }
    case "delay": {
      // What a slowing condition holds over to its maker's next turn (1.120).
      const said = { actor: names.combatant(event.actorId), label: event.label };
      if (event.outcome === "completed") return key("delayCompleted", said);
      if (event.outcome === "lost") return key("delayLost", said);
      return key(event.outcome === "held" ? "delayHeld" : "delayNow", {
        ...said,
        roll: event.roll,
        needed: event.needed,
      });
    }
    case "counter":
      // An answer that reaches only so high (1.116): past it, a check, or nothing at all.
      if (event.total === undefined || event.rolls === undefined) {
        return key("counterOutOfReach", {
          actor: names.combatant(event.actorId),
          target: names.combatant(event.targetId),
          label: event.label,
          level: event.level,
        });
      }
      return key(event.success ? "counterSuccess" : "counterFailure", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        label: event.label,
        level: event.level,
        roll: rulesetRollText(
          {
            rolls: event.rolls,
            kept: event.kept ?? event.total,
            modifier: event.modifier ?? 0,
            total: event.total,
            mode: event.mode,
            bonuses: event.bonuses,
          },
          t,
          bonusNamer(names, t),
        ),
        difficulty: event.difficulty,
      });
    case "recharge":
      return key(event.back ? "rechargeBack" : "rechargeNot", {
        label: event.label,
        roll: rulesetRollText({ ...event, modifier: 0, total: event.kept }, t),
        from: event.from,
      });
    // A failed save turned into a success (1.317).
    case "legendaryResistance":
      return key("legendaryResistance", {
        actor: names.combatant(event.actorId),
        save: names.save(event.save),
        left: event.left,
      });
    case "lair":
      return key("lair", { actor: names.combatant(event.actorId), label: event.label });
    case "signature":
      // Named for what it is (Alyssa 2026-10-26: "is it clear that what they are doing is a legendary
      // action?").
      return key("signature", {
        actor: names.combatant(event.actorId),
        label: event.label,
        count: event.cost,
        left: event.left,
      });
    case "strikes":
      // The count is what says "1 strike" rather than "1 strikes": the last swing has its own line.
      return key(event.left > 0 ? "strikes" : "strikesLast", {
        actor: names.combatant(event.actorId),
        label: event.label,
        count: event.left,
        left: event.left,
      });
    case "presence":
      return key(event.kinds.length ? "presence" : "presenceNone", {
        actor: names.combatant(event.actorId),
        kinds: event.kinds.join(", "),
        within: event.within,
      });
    case "timeStop":
      return key(event.ended === "affected" ? "timeStopEnded" : event.ended ? "timeStopOver" : "timeStopped", {
        actor: names.combatant(event.actorId),
        label: event.label,
        turns: event.turns ?? 0,
      });
    case "tookAim":
      return key("tookAim", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        source: names.combatant(event.sourceId),
        label: event.label,
      });
    case "blink":
      return key(event.vanished ? "blinkVanished" : "blinkStayed", {
        actor: names.combatant(event.actorId),
        label: event.label,
        roll: event.roll,
        needed: event.needed,
      });
    case "duplicate":
      return key(event.lost ? "duplicateLost" : event.diverted ? "duplicateDrew" : "duplicateMissed", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        roll: event.roll,
        needed: event.needed,
        left: event.left ?? 0,
      });
    case "chance":
      return key(
        event.outcome === "sure" ? "chanceSure" : event.outcome === "answered" ? "chanceAnswered" : "chanceFailed",
        {
          actor: names.combatant(event.actorId),
          label: event.label,
          roll: event.roll ?? 0,
          sides: event.sides,
          needed: event.needed,
        },
      );
    case "ashore":
      return key("ashore", { actor: names.combatant(event.actorId), x: event.to.x, y: event.to.y });
    case "sustained":
      return key("sustained", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        condition: names.condition(event.condition),
        label: event.label,
      });
    case "gives":
      return key("gives", {
        actor: names.combatant(event.actorId),
        label: event.label,
        budget: names.budget(event.budget),
        left: event.left,
      });
    case "rider":
      return key("rider", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        label: event.label,
      });
    case "concentration":
      if (event.state === "ended") {
        return key(
          event.reason === "damage" || event.reason === "zone" || event.reason === "dispelled"
            ? "concentrationLost"
            : event.reason === "replaced"
              ? "concentrationReplaced"
              : event.reason === "down"
                ? "concentrationDown"
                : "concentrationEnded",
          { actor: names.combatant(event.actorId), label: event.label },
        );
      }
      return key(event.state === "started" ? "concentrationStarted" : "concentrationKept", {
        actor: names.combatant(event.actorId),
        label: event.label,
      });
    case "move":
      // Movement spent and nowhere gone is getting back up, which the condition's own line already
      // says: this one only has to say what it cost.
      // What a walk cost and what is left of the allowance are said in the ruleset's own distance,
      // because "3" is a count of cells and nobody at the table measures in those.
      if (event.path.length === 0) {
        return key("moveStood", { actor: names.combatant(event.actorId), cost: names.distance(event.cost) });
      }
      return [
        key(event.stopped ? "moveStopped" : event.jumped ? "jumped" : "move", {
          actor: names.combatant(event.actorId),
          x: event.to.x,
          y: event.to.y,
          cost: names.distance(event.cost),
          left: names.distance(event.left),
        }),
        // Whoever came along (re-test 14): a crocodile's prey, so their token does not jump unsaid.
        ...(event.dragged?.length
          ? [key("moveDragged", { names: event.dragged.map((id) => names.combatant(id)).join(", ") })]
          : []),
      ].join(" ");
    case "lift":
      return key(event.up ? "tookOff" : "landed", { actor: names.combatant(event.actorId) });
    case "flew":
      return key(event.to > event.from ? "flewUp" : "flewDown", {
        actor: names.combatant(event.actorId),
        distance: names.height(Math.abs(event.to - event.from)),
        cost: names.distance(event.cost),
        left: names.distance(event.left),
      });
    case "window":
      // Who the fight stopped for. The window between two turns is nobody's interruption, so it is
      // said as a pause rather than as somebody being caught out.
      // What somebody readied, set off (1.288).
      if (event.readied) {
        return key(event.readied === "comes" ? "windowReadiedComes" : "windowReadiedActs", {
          actor: names.combatant(event.waiting[0] ?? ""),
          mover: names.combatant(event.sourceId ?? ""),
        });
      }
      return key(
        event.targetIds?.some((id) => id !== event.waiting[0]) && (event.moment === "aimed" || event.moment === "hit")
          ? "windowBystander"
          : event.kind === "signature" && event.moment === "turn-start"
            ? "windowTurnStartLegendary"
            : WINDOW_LINES[
                event.moment ?? (event.kind === "signature" ? "between" : event.kind === "spend" ? "spend" : "leaving")
              ],
        {
          actor: names.combatant(event.waiting[0] ?? ""),
          others: Math.max(0, event.waiting.length - 1),
          target: event.targetIds?.map(names.combatant).join(", ") ?? "",
          mover: names.combatant(event.sourceId ?? event.moverId ?? ""),
          label: event.label ?? "",
          total: event.total ?? "",
          defense: event.defense === undefined ? "" : defenseText(names, event.defense),
        },
      );
    case "recheck": {
      // The held roll against the defense the answer left: said whichever way it went, since the
      // reader saw it called a hit a moment ago.
      const named = bonusNamer(names, t);
      const defense = defenseText(names, event.defense);
      return key(event.outcome === "miss" ? "recheckMiss" : "recheckHit", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        label: event.label,
        total: event.total,
        defense: event.guards?.length ? guardedText(t, named, defense, event.guards, event.unguarded) : defense,
      });
    }
    case "pass":
      return key("pass", { actor: names.combatant(event.actorId) });
    case "cancelled":
      // Said with what stopped it: "Mage stops Elara with Counterspell".
      return key(event.with ? "cancelledWith" : "cancelled", {
        actor: names.combatant(event.actorId),
        label: event.label,
        by: names.combatant(event.byId),
        ...(event.with ? { with: event.with } : {}),
      });
    case "opportunity":
      return key("opportunity", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        label: event.label,
      });
    case "cover":
      return event.save
        ? key("coverSave", {
            target: names.combatant(event.targetId),
            bonus: event.bonus,
            save: names.save(event.save),
          })
        : key("cover", { target: names.combatant(event.targetId), bonus: event.bonus, defense: event.defense });
    case "shot":
      return event.of !== undefined
        ? key("shotLoaded", { label: event.label, left: event.left, of: event.of })
        : key("shot", { label: event.label, left: event.left });
    case "reload":
      return event.drew !== undefined
        ? key("reloadDrew", {
            actor: names.combatant(event.actorId),
            label: event.label,
            loaded: event.loaded,
            of: event.of,
            drew: event.drew,
          })
        : key("reload", {
            actor: names.combatant(event.actorId),
            label: event.label,
            loaded: event.loaded,
            of: event.of,
          });
    case "switch":
      return key(event.on ? "switchOn" : "switchOff", { actor: names.combatant(event.actorId), label: event.label });
    // Taken over, or let go (1.577).
    case "controlled":
      return key(event.active ? "controlled" : "controlReleased", {
        source: names.combatant(event.sourceId),
        target: names.combatant(event.targetId),
      });
    // An item turned into another of its forms (1.575).
    case "reformed":
      return key("reformed", { actor: names.combatant(event.actorId), label: event.label, form: event.form });
    case "recovered":
      return key("recovered", { actor: names.combatant(event.actorId), label: event.label, count: event.count });
    case "symbol-spend": {
      const symbol = names.symbol?.(event.symbol) ?? event.symbol;
      const line = key(event.times > 1 ? "symbolSpendTimes" : "symbolSpend", {
        actor: names.combatant(event.actorId),
        symbols: `${event.cost * event.times} ${symbol}`,
        label: event.label,
        times: event.times,
      });
      const dice = event.boost ?? event.setback;
      if (!dice || !event.onId) return line;
      return key(event.boost ? "symbolSpendBoost" : "symbolSpendSetback", {
        line,
        target: names.combatant(event.onId),
        dice: t("game.combat.ruleset.roll.dice", { count: dice }),
      });
    }
    case "hardness":
      return key("hardness", {
        actor: names.combatant(event.sourceId),
        target: names.combatant(event.targetId),
        label: event.label,
        dice: event.dice,
        hardness: event.hardness,
      });
    case "area":
      return key("area", {
        actor: names.combatant(event.actorId),
        label: event.label,
        x: event.at.x,
        y: event.at.y,
        cells: event.cells.length,
      });
    case "standard":
      // The kind implements a closed list, so an action outside it is a save from another Engine
      // and prints its own id rather than nothing.
      if (!STANDARD_ACTIONS.has(event.action)) {
        return key("standardOther", { actor: names.combatant(event.actorId), action: event.action });
      }
      // A real Hide or Search (1.287): the check, and whom it hid from or found.
      if (event.check) {
        const roll = checkRollText(event.check, names, t);
        const list = (ids: string[] | undefined) => (ids ?? []).map((id) => names.combatant(id)).join(", ");
        if (event.action === "hide") {
          return event.from?.length
            ? key("standardHideFrom", { actor: names.combatant(event.actorId), roll, names: list(event.from) })
            : key("standardHideSeen", { actor: names.combatant(event.actorId), roll });
        }
        const line = event.found?.length
          ? key("standardSearchFound", { actor: names.combatant(event.actorId), roll, names: list(event.found) })
          : key("standardSearchNone", { actor: names.combatant(event.actorId), roll });
        return `${line}${searchApart(event.apart)}`;
      }
      return key(`standard${event.action[0]!.toUpperCase()}${event.action.slice(1)}`, {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
      });
    case "dying": {
      if (event.result === "stable") return key("dyingStable", { actor: names.combatant(event.actorId) });
      if (event.harmed)
        return key(event.result === "dead" ? "dyingHarmedDead" : "dyingHarmed", {
          actor: names.combatant(event.actorId),
          count: event.harmed,
          successes: event.successes,
          failures: event.failures,
        });
      if (event.result === "dead" && event.rolls.length > 0)
        return key("dyingDeadRoll", {
          actor: names.combatant(event.actorId),
          roll: rulesetRollText({ ...event, modifier: 0, total: event.total ?? event.kept }, t, bonusNamer(names, t)),
          difficulty: event.difficulty,
        });
      if (event.result === "dead") return key("dyingDead", { actor: names.combatant(event.actorId) });
      if (event.result === "revived")
        return key("dyingRevived", {
          actor: names.combatant(event.actorId),
          roll: rulesetRollText({ ...event, modifier: 0, total: event.total ?? event.kept }, t, bonusNamer(names, t)),
        });
      return key(event.result === "success" ? "dyingSuccess" : "dyingFailure", {
        actor: names.combatant(event.actorId),
        roll: rulesetRollText({ ...event, modifier: 0, total: event.total ?? event.kept }, t, bonusNamer(names, t)),
        difficulty: event.difficulty,
        successes: event.successes,
        failures: event.failures,
      });
    }
    case "down":
      return key(event.dying ? "downDying" : "down", { actor: names.combatant(event.actorId) });
    case "defeated":
      return key("defeated", { target: names.combatant(event.actorId) });
    case "stabilized":
      return key("stabilized", { actor: names.combatant(event.sourceId), target: names.combatant(event.targetId) });
    case "track":
      return key(event.to < event.from ? "trackDown" : "trackUp", {
        actor: names.combatant(event.sourceId),
        target: names.combatant(event.targetId),
        track: event.label,
        from: event.from,
        to: event.to,
      });
    case "unsealed":
      return key("unsealed", {
        actor: names.combatant(event.sourceId),
        target: names.combatant(event.targetId),
        amount: event.amount,
        max: event.maxHealth,
      });
    case "revived":
      return key("revived", { actor: names.combatant(event.actorId), health: event.health });
    case "outcome":
      if (event.outcome === "ongoing") return null;
      return key(
        event.yielded
          ? "outcomeYielded"
          : event.stalled
            ? "outcomeStalled"
            : event.outcome === "victory"
              ? "outcomeVictory"
              : event.outcome === "fled"
                ? "outcomeFled"
                : "outcomeDefeat",
      );
    case "refused":
      return key("refused", {
        actor: names.combatant(event.actorId),
        reason: t(rulesetRefusalKey(event.reason), { defaultValue: event.reason }),
      });
    case "director":
      return key("unavailable", { reason: event.text });
    case "callout":
      return key(`callout.${event.way}`, {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
      });
    case "reasoning":
      return event.reasons.length
        ? key("reasoning", {
            actor: names.combatant(event.actorId),
            reasons: event.reasons.map((reason) => rulesetReasonText(reason, names, t, event.actorId)).join("; "),
          })
        : null;
    default:
      return null;
  }
}

/** One reason the Engine gives for an AI combatant's step, in no ruleset's own words. */
function rulesetReasonText(
  reason: DirectedRulesetReason,
  names: RulesetCombatNames,
  t: TFunction,
  actorId?: string,
): string {
  const say = (name: string, params: Record<string, unknown> = {}) =>
    t(`game.combat.ruleset.event.reason.${name}`, params) as string;
  const target = (id?: string) => (id ? names.combatant(id) : "") || say("itsTarget");
  switch (reason.why) {
    case "damage":
      return reason.edge
        ? say("damageEdge", {
            damage: say(`damage_${reason.strength}`, { target: target(reason.targetId) }),
            edge: say(`edge_${reason.edge.way}`, { target: target(reason.targetId), type: reason.edge.damageType }),
          })
        : say(`damage_${reason.strength}`, { target: target(reason.targetId) });
    case "healing":
    case "support":
      // Untargeted, it is its own (healing) or its side's (support): never "its target". On itself it
      // is said as its own, not as helping itself by name (laptop playtest 2026-10-25: a Rage read
      // "helps Ulfgar").
      if (reason.targetId && reason.targetId === actorId)
        return say(reason.why === "healing" ? "healingSelf" : "supportSelf");
      return reason.targetId
        ? say(reason.why, { target: target(reason.targetId) })
        : say(reason.why === "healing" ? "healingSelf" : "supportSide");
    case "finish":
    case "setup":
    case "coordination":
    case "focus":
    case "mostInNeed":
    case "guarding":
    case "pressCaster":
    case "stops":
    case "takesTurn":
      return say(reason.why, { target: target(reason.targetId) });
    case "walked":
      return say("walked", { distance: names.distance(reason.cells) });
    case "keptBack":
      return say(reason.targetId ? "keptBackFor" : "keptBack", {
        label: reason.label,
        target: target(reason.targetId),
      });
    case "approach":
      return say(reason.sprinted ? "approachSprint" : "approach", { target: target(reason.targetId) });
    case "couldNotAnswer":
      return say(`couldNotAnswer_${reason.because.replace("-", "_")}`, { label: reason.label });
    case "gmPick":
      if (reason.rank === 1) return say("gmPickTop");
      if (reason.over?.ends) return say("gmPickOverEnd");
      return reason.over
        ? say(reason.over.targetId ? "gmPickOverOn" : "gmPickOver", {
            label: reason.over.label,
            target: target(reason.over.targetId),
          })
        : say("gmPick");
    default:
      return say(reason.why);
  }
}

/** A pool's harm, thrown: what its dice counted with the automatic successes beside them, and what
 *  the target's soak took off, thrown or off the dice. */
function poolHarmLines(
  harm: {
    rolls: number[];
    flat: number;
    pool: RulesetCombatDamagePool;
  },
  targetId: string,
  names: RulesetCombatNames,
  key: (name: string, params?: Record<string, unknown>) => string,
  t: TFunction,
): string[] {
  const lines = [
    key(harm.flat > 0 ? "damagePoolAuto" : "damagePool", {
      roll: t("game.combat.ruleset.roll.pool", {
        count: harm.pool.successes - harm.flat,
        dice: t("game.combat.ruleset.roll.dice", { count: harm.rolls.length }),
        target: harm.pool.target,
        rolls: harm.rolls.join(", "),
      }),
      count: harm.flat,
    }),
  ];
  if (harm.pool.minimum !== undefined) lines.push(key("damageMinimum", { minimum: harm.pool.minimum }));
  if (harm.pool.remappedFrom !== undefined && harm.pool.kind) {
    lines.push(
      key("damageRemapped", {
        target: names.combatant(targetId),
        from: names.kind(harm.pool.remappedFrom),
        to: names.kind(harm.pool.kind),
      }),
    );
  }
  const soak = harm.pool.soak;
  if (soak?.rolls) {
    lines.push(
      key("soakRolled", {
        target: names.combatant(targetId),
        taken: soak.taken,
        roll: t("game.combat.ruleset.roll.pool", {
          count: soak.rolls.filter((face) => face >= harm.pool.target).length,
          dice: t("game.combat.ruleset.roll.dice", { count: soak.rolls.length }),
          target: harm.pool.target,
          rolls: soak.rolls.join(", "),
        }),
      }),
    );
  } else if (soak) {
    lines.push(key("soakDice", { target: names.combatant(targetId), count: soak.taken }));
  }
  return lines;
}

/** The lines a screen prints, newest last, for every event it has not printed yet. */
/**
 * What no log says. A moment everybody let go by is no moment at all: neither the offer nor the
 * passing is said, so a fight with a dozen unanswered openings does not read as a dozen of each. A
 * pass on its own is said nowhere, since what somebody did not do is the absence of a line, and nor is
 * why a moment was let go (laptop playtest 2026-10-25: "let the moment go by" over and over).
 */
export function rulesetQuietEvents(
  events: DirectedRulesetView["events"],
): (entry: DirectedRulesetView["events"][number]) => boolean {
  const passed = new Map<string, Set<string>>();
  for (const { event } of events)
    if (event.type === "pass") passed.set(event.window, (passed.get(event.window) ?? new Set()).add(event.actorId));
  return ({ event }) => {
    if (event.type === "pass") return true;
    if (event.type === "window" && !event.readied && event.waiting.every((id) => passed.get(event.window)?.has(id)))
      return true;
    return (
      event.type === "reasoning" && event.reasons.length > 0 && event.reasons.every((reason) => reason.why === "letGo")
    );
  };
}

export function rulesetCombatLogLines(
  events: DirectedRulesetView["events"],
  names: RulesetCombatNames,
  t: TFunction,
  afterSeq = -1,
  /** With Debug on: the Engine's reasons for its AI's steps, after each one. */
  reasons = false,
): Array<{ seq: number; text: string }> {
  const lines: Array<{ seq: number; text: string }> = [];
  const quiet = rulesetQuietEvents(events);
  for (const entry of events) {
    if (entry.seq <= afterSeq) continue;
    if (quiet(entry)) continue;
    // What is left of a budget is a number the status panel already shows, and the resolver reports
    // it BEFORE the action it paid for, so in a log it read as "0 Action left" and then the blow.
    if (entry.event.type === "budget") continue;
    if (entry.event.type === "reasoning" && !reasons) continue;
    const text = rulesetCombatEventLine(entry.event, names, t);
    if (text) lines.push({ seq: entry.seq, text });
  }
  return lines;
}

/** Each foe's one fate when a fight ends, which the end card's count and its names both read: gave
 *  itself up (a prisoner, beaten alive), gone from the fight (fled, sent away), felled (down when it
 *  ended counts, since the fight is over for it), or still on its feet. `beaten` is exactly the felled
 *  and surrendered lists, so the tally names nobody the lines file elsewhere (laptop level-4 pass
 *  2026-10-26: a Big Grakka that surrendered was listed as having left the fight). */
export type RulesetFoeFate = "endDefeated" | "endSurrendered" | "endGone" | "endStanding";
export function rulesetFoeFates(view: DirectedRulesetView): {
  fates: Array<[RulesetFoeFate, DirectedRulesetView["combatants"]]>;
  beaten: number;
  total: number;
} {
  const foes = view.combatants.filter((combatant) => combatant.side !== "party");
  const fateOf = (one: (typeof foes)[number]): RulesetFoeFate =>
    one.surrendered
      ? "endSurrendered"
      : one.away || one.left
        ? "endGone"
        : one.defeated || one.down
          ? "endDefeated"
          : "endStanding";
  const by: Record<RulesetFoeFate, DirectedRulesetView["combatants"]> = {
    endDefeated: [],
    endSurrendered: [],
    endGone: [],
    endStanding: [],
  };
  for (const one of foes) by[fateOf(one)].push(one);
  const order: RulesetFoeFate[] = ["endDefeated", "endSurrendered", "endGone", "endStanding"];
  return {
    fates: order.filter((key) => by[key].length > 0).map((key) => [key, by[key]]),
    beaten: by.endDefeated.length + by.endSurrendered.length,
    total: foes.length,
  };
}
