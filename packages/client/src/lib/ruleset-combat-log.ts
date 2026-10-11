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
}

function lookup(entries: Array<{ id: string; label: string }> | undefined) {
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
): RulesetCombatNames {
  const combatants = new Map(view.combatants.map((combatant) => [combatant.id, combatant.name]));
  const distance = view.grid?.distance;
  return {
    distance: (cells) => rulesetDistanceText(cells, distance, t),
    height: (levels) => {
      // The ruleset's own words for both, so a fall reads the same wherever the line is printed.
      const levelHeight = definition.combat?.elevation?.levelHeight;
      const unit = definition.combat?.distance?.label;
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
    defense: rulesetValueLabel(definition, definition.combat?.defense),
  };
}

/** A modifier as it is written beside a roll. Signs and digits, never words, so it is the same in
 *  every language and cannot drift from the total the resolver already added up. */
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
): string {
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

/** A defense in the ruleset's own word for it, when the file gave it one. */
function defenseText(names: RulesetCombatNames, defense: number): string {
  return names.defense ? `${names.defense} ${defense}` : String(defense);
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

/** A check thrown on its own (1.287), as one side of a contest is written. */
function checkRollText(roll: RulesetContestSide, names: RulesetCombatNames, t: TFunction): string {
  return roll.pool
    ? rulesetPoolRollText({ ...roll, pool: roll.pool }, t, bonusNamer(names, t))
    : rulesetRollText(
        {
          ...roll,
          kept: roll.total - roll.modifier - (roll.bonuses ?? []).reduce((sum, bonus) => sum + bonus.value, 0),
        },
        t,
        bonusNamer(names, t),
      );
}

const STANDARD_ACTIONS = new Set(["dash", "disengage", "dodge", "help", "hide", "ready", "search"]);

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
      // The ruleset's own word for what it was rolled against, when the file gave it one, and what
      // the target's conditions added to it. A pool says how many successes it needed instead.
      const pool = event.pool;
      const defense = pool
        ? (t("game.combat.ruleset.roll.needed", { count: event.defense }) as string)
        : defenseText(names, event.defense);
      return key(
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
          defense: event.guards?.length
            ? t("game.combat.ruleset.roll.guarded", {
                defense,
                guards: event.guards
                  .map((guard) =>
                    t("game.combat.ruleset.roll.guard", { name: named(guard), value: signed(guard.value) }),
                  )
                  .join(", "),
              })
            : defense,
        },
      );
    }
    case "save":
      if (event.automatic) {
        return key(event.success ? "saveAutomaticSuccess" : "saveAutomatic", {
          actor: names.combatant(event.actorId),
          save: names.save(event.save),
        });
      }
      if (event.pool) {
        return key(event.success ? "savePoolSuccess" : "savePoolFailure", {
          actor: names.combatant(event.actorId),
          save: names.save(event.save),
          roll: rulesetPoolRollText({ ...event, pool: event.pool }, t, bonusNamer(names, t)),
          needed: t("game.combat.ruleset.roll.needed", { count: event.difficulty }),
        });
      }
      return key(event.success ? "saveSuccess" : "saveFailure", {
        actor: names.combatant(event.actorId),
        save: names.save(event.save),
        roll: rulesetRollText(event, t, bonusNamer(names, t)),
        difficulty: event.difficulty,
      });
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
      if (event.adjust !== "none") lines.push(key(`damage${event.adjust[0]!.toUpperCase()}${event.adjust.slice(1)}`));
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
      return key("skipDazed", { actor: names.combatant(event.actorId) });
    case "heal":
      if (event.blocked) return key("healBlocked", { target: names.combatant(event.targetId) });
      return key("heal", {
        target: names.combatant(event.targetId),
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
    case "returned":
      return key(event.gone ? "returnedGone" : "returned", { target: names.combatant(event.targetId) });
    // A check made to end a condition (1.313): Maze's way out.
    case "checkEnded":
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
    case "letFall":
      return key("letFall", {
        actor: names.combatant(event.actorId),
        condition: names.condition(event.condition),
        items: event.labels.join(", "),
      });
    case "pickedUp":
      return key("pickedUp", { actor: names.combatant(event.actorId), item: event.label });
    case "averted":
      return key(event.back ? "lookedBack" : "averted", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.holderId),
      });
    case "resized":
      return key("resized", { target: names.combatant(event.targetId), size: event.label });
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
    // Creatures called into the fight (1.325): Jars Burst.
    case "called":
      return key(event.ids.length ? "called" : "calledNone", {
        actor: names.combatant(event.actorId),
        label: event.label,
        names: event.ids.map((id) => names.combatant(id)).join(", "),
      });
    // Hanging on at 1 (1.320): the Hourglass.
    case "hangsOn":
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
    case "pushed":
      return key("pushed", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        distance: names.distance(event.path.length),
        x: event.to.x,
        y: event.to.y,
      });
    case "teleported":
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
    case "spend":
      return key("spend", { actor: names.combatant(event.actorId), amount: event.amount, pool: event.label });
    case "budget":
      return key("budget", {
        actor: names.combatant(event.actorId),
        budget: names.budget(event.budget),
        left: event.left,
      });
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
                  ? "zoneStruckEnter"
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
      return key("signature", {
        actor: names.combatant(event.actorId),
        label: event.label,
        cost: event.cost,
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
          event.reason === "damage" || event.reason === "zone"
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
      return key(event.stopped ? "moveStopped" : "move", {
        actor: names.combatant(event.actorId),
        x: event.to.x,
        y: event.to.y,
        cost: names.distance(event.cost),
        left: names.distance(event.left),
      });
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
          : WINDOW_LINES[event.moment ?? (event.kind === "signature" ? "between" : "leaving")],
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
        defense: event.guards?.length
          ? t("game.combat.ruleset.roll.guarded", {
              defense,
              guards: event.guards
                .map((guard) => t("game.combat.ruleset.roll.guard", { name: named(guard), value: signed(guard.value) }))
                .join(", "),
            })
          : defense,
      });
    }
    case "pass":
      return key("pass", { actor: names.combatant(event.actorId) });
    case "cancelled":
      return key("cancelled", {
        actor: names.combatant(event.actorId),
        label: event.label,
        by: names.combatant(event.byId),
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
    case "recovered":
      return key("recovered", { actor: names.combatant(event.actorId), label: event.label, count: event.count });
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
      if (event.result === "dead") return key("dyingDead", { actor: names.combatant(event.actorId) });
      if (event.result === "revived") return key("dyingRevived", { actor: names.combatant(event.actorId) });
      return key(event.result === "success" ? "dyingSuccess" : "dyingFailure", {
        actor: names.combatant(event.actorId),
        roll: rulesetRollText({ ...event, modifier: 0, total: event.kept }, t),
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
        event.outcome === "victory" ? "outcomeVictory" : event.outcome === "fled" ? "outcomeFled" : "outcomeDefeat",
      );
    case "refused":
      return key("refused", {
        actor: names.combatant(event.actorId),
        reason: t(rulesetRefusalKey(event.reason), { defaultValue: event.reason }),
      });
    case "director":
      return key("unavailable", { reason: event.text });
    default:
      return null;
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
export function rulesetCombatLogLines(
  events: DirectedRulesetView["events"],
  names: RulesetCombatNames,
  t: TFunction,
  afterSeq = -1,
): Array<{ seq: number; text: string }> {
  const lines: Array<{ seq: number; text: string }> = [];
  for (const entry of events) {
    if (entry.seq <= afterSeq) continue;
    // What is left of a budget is a number the status panel already shows, and the resolver reports
    // it BEFORE the action it paid for, so in a log it read as "0 Action left" and then the blow.
    if (entry.event.type === "budget") continue;
    const text = rulesetCombatEventLine(entry.event, names, t);
    if (text) lines.push({ seq: entry.seq, text });
  }
  return lines;
}
