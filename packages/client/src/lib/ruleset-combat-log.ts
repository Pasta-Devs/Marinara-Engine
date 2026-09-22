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
  RulesetCombatRollMode,
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
  budget: (id: string) => string;
  save: (id: string) => string;
  /** The label of one of the two tracks the ruleset's dying rule counts on. */
  track: (id: string) => string;
  tier: (id: string) => string;
  /** What this ruleset calls the number an attack is rolled against: "AC", "Guard", whatever the
   *  file named it. Empty when the ruleset points at something with no label of its own. */
  defense: string;
  /** A count of cells in the ruleset's own distance: "20 ft", "8 paces". A fight with no board has
   *  no unit to say it in, so the count is printed as it stands. */
  distance: (cells: number) => string;
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
    combatant: (id) => (id ? (combatants.get(id) ?? "") : ""),
    condition: lookup(definition.sheet.live.conditions),
    budget: lookup(definition.combat?.economy.budgets),
    save: lookup(definition.sheet.saves),
    track: lookup(definition.sheet.live.tracks),
    tier: lookup(definition.combat?.threat?.tiers),
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
  roll: { rolls: number[]; kept: number; modifier: number; total: number; mode?: RulesetCombatRollMode },
  t: TFunction,
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
  if (roll.modifier === 0) return base;
  return t("game.combat.ruleset.roll.totalWithModifier", {
    roll: base,
    modifier: signed(roll.modifier),
    total: roll.total,
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

const STANDARD_ACTIONS = new Set(["dash", "disengage", "dodge", "help", "hide", "ready"]);

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
  switch (event.type) {
    case "initiative":
      return key("initiative", {
        order: event.entries.map((entry) => `${names.combatant(entry.actorId)} ${entry.total}`).join(", "),
      });
    case "round":
      return key("round", { round: event.round });
    case "turn":
      return key("turn", { actor: names.combatant(event.actorId) });
    case "attack":
      return key(
        event.outcome === "critical" ? "attackCritical" : event.outcome === "hit" ? "attackHit" : "attackMiss",
        {
          actor: names.combatant(event.actorId),
          target: names.combatant(event.targetId),
          label: event.label,
          roll: rulesetRollText(event, t),
          // The ruleset's own word for what it was rolled against, when the file gave it one.
          defense: names.defense ? `${names.defense} ${event.defense}` : String(event.defense),
        },
      );
    case "save":
      if (event.automatic) {
        return key("saveAutomatic", { actor: names.combatant(event.actorId), save: names.save(event.save) });
      }
      return key(event.success ? "saveSuccess" : "saveFailure", {
        actor: names.combatant(event.actorId),
        save: names.save(event.save),
        roll: rulesetRollText(event, t),
        difficulty: event.difficulty,
      });
    case "damage": {
      const lines = [
        key(event.damageType ? "damage" : "damageUntyped", {
          target: names.combatant(event.targetId),
          amount: event.dealt,
          type: event.damageType ?? "",
          health: event.health,
          maxHealth: event.maxHealth,
        }),
      ];
      if (event.critical) lines.push(key("damageCritical"));
      if (event.adjust !== "none") lines.push(key(`damage${event.adjust[0]!.toUpperCase()}${event.adjust.slice(1)}`));
      if (event.saved) lines.push(key("damageSaved"));
      if (event.toTemp > 0) lines.push(key("damageTemporary", { amount: event.toTemp }));
      return lines.join(" ");
    }
    case "heal":
      return key("heal", {
        target: names.combatant(event.targetId),
        amount: event.amount,
        health: event.health,
        maxHealth: event.maxHealth,
      });
    case "temporary":
      return key("temporary", { target: names.combatant(event.targetId), amount: event.amount });
    case "condition":
      return key(`condition${event.reason[0]!.toUpperCase()}${event.reason.slice(1)}`, {
        target: names.combatant(event.targetId),
        condition: names.condition(event.condition),
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
    case "recharge":
      return key(event.back ? "rechargeBack" : "rechargeNot", {
        label: event.label,
        roll: rulesetRollText({ ...event, modifier: 0, total: event.kept }, t),
        from: event.from,
      });
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
          event.reason === "damage"
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
    case "opportunity":
      return key("opportunity", {
        actor: names.combatant(event.actorId),
        target: names.combatant(event.targetId),
        label: event.label,
      });
    case "cover":
      return key("cover", { target: names.combatant(event.targetId), bonus: event.bonus, defense: event.defense });
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
    case "revived":
      return key("revived", { actor: names.combatant(event.actorId), health: event.health });
    case "outcome":
      if (event.outcome === "ongoing") return null;
      return key(event.outcome === "victory" ? "outcomeVictory" : "outcomeDefeat");
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
