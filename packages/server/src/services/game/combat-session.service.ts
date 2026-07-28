import {
  applyAction as applyTacticalAction,
  buildTacticalSummary,
  isTerminal as isTacticalTerminal,
  runEnemyPhase as runTacticalEnemyPhase,
  type CombatAction,
  type CombatPlayerAction,
  type ClassicCombatState,
  type CombatBossPhase,
  type CombatEvent,
  type CombatMechanic,
  type CombatManeuverProposal,
  type CombatObjectiveState,
  type CombatRoundResult,
  type CombatSession,
  type CombatSessionStatus,
  type CombatState,
  type CombatSummary,
  type TacticalAction,
  type TacticalCombatState,
  type TacticalEvent,
} from "@marinara-engine/shared";
import { CombatResolutionError, createCombatRng, resolveCombatRound } from "./combat.service.js";
import { generateCombatLoot } from "./loot.service.js";

export class CombatActionValidationError extends Error {
  readonly code = "INVALID_ACTION" as const;
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "CombatActionValidationError";
  }
}

export class CombatManeuverValidationError extends Error {
  readonly code = "INVALID_MANEUVER" as const;
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "CombatManeuverValidationError";
  }
}

export interface CombatSessionActionResolution {
  canonicalState: CombatState;
  objectives?: CombatObjectiveState[];
  bossPhases?: CombatSession["bossPhases"];
  rngCursor: number;
  status?: CombatSessionStatus;
  events: CombatEvent[];
  result?: CombatSummary;
  classicRoundResult?: CombatRoundResult;
}

function eventEffects(event: TacticalEvent): CombatEvent["effects"] {
  if (event.kind === "move" && event.actorId && event.to) {
    return [{ type: "move", sourceId: event.actorId, targetId: event.targetId ?? event.actorId, to: event.to }];
  }
  if (event.kind === "damage" && event.actorId && event.targetId && event.amount !== undefined) {
    return [
      {
        type: "damage",
        sourceId: event.actorId,
        targetId: event.targetId,
        amount: event.amount,
        ...(event.element ? { element: event.element } : {}),
      },
    ];
  }
  if (event.kind === "heal" && event.actorId && event.targetId && event.amount !== undefined) {
    return [{ type: "heal", sourceId: event.actorId, targetId: event.targetId, amount: event.amount }];
  }
  if (event.kind === "objective" && event.objectiveId && event.objectiveProgress !== undefined) {
    return [
      {
        type: "objective",
        objectiveId: event.objectiveId,
        progress: event.objectiveProgress,
        reason: event.text,
      },
    ];
  }
  return [];
}

function toCombatEvents(actionId: string, events: TacticalEvent[]): CombatEvent[] {
  return events.map((event, index) => ({
    eventId: `${actionId}:${index}`,
    actionId,
    kind: event.kind,
    ...(event.actorId ? { actorId: event.actorId } : {}),
    ...(event.targetId ? { targetId: event.targetId } : {}),
    text: event.text,
    effects: eventEffects(event),
    ...(event.amount !== undefined ? { amount: event.amount } : {}),
    ...(event.to ? { to: event.to } : {}),
    ...(event.skillName ? { skillName: event.skillName } : {}),
    ...(event.element ? { element: event.element } : {}),
    ...(event.statusName ? { statusName: event.statusName } : {}),
    ...(event.roll ? { roll: event.roll } : {}),
  }));
}

export function combatBossPhasesFromMechanics(mechanics: CombatMechanic[]): CombatBossPhase[] {
  return mechanics.flatMap((mechanic, index) => {
    const hpThreshold = Number(mechanic.hpThreshold);
    const interval = Number(mechanic.interval);
    if (mechanic.trigger === "hp_threshold" && !(hpThreshold > 0)) return [];
    if (mechanic.trigger === "round_interval" && !(interval > 0)) return [];

    return [
      {
        id: `mechanic:${index}:${mechanic.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")}`,
        ...(mechanic.ownerName?.trim() ? { ownerName: mechanic.ownerName.trim() } : {}),
        trigger: mechanic.trigger,
        ...(mechanic.trigger === "hp_threshold"
          ? { threshold: Math.max(1, Math.min(99, hpThreshold)) }
          : mechanic.trigger === "round_interval"
            ? { round: Math.max(1, Math.floor(interval)) }
            : {}),
        telegraph: mechanic.counterplay?.trim() || mechanic.description,
        mechanics: mechanic.effectType === "summon_reinforcements" ? [] : [mechanic],
        ...(mechanic.reinforcements?.length ? { reinforcements: mechanic.reinforcements.slice(0, 8) } : {}),
        once: mechanic.trigger === "hp_threshold",
      },
    ];
  });
}

function resolveTacticalAction(
  session: CombatSession & { style: "tactical"; canonicalState: TacticalCombatState },
  actionId: string,
  action: TacticalAction,
  maneuverProposal?: CombatManeuverProposal,
): CombatSessionActionResolution {
  const terminalOptions = { allowNoEnemies: session.objectives.length > 0 };
  const applied = applyTacticalAction(session.canonicalState, action, maneuverProposal, terminalOptions);
  if (!applied.ok) throw new CombatActionValidationError(applied.error);

  let nextState = applied.state;
  const tacticalEvents = [...applied.events];
  if (nextState.phase === "enemy" && !isTacticalTerminal(nextState, terminalOptions)) {
    const enemyResult = runTacticalEnemyPhase(nextState, terminalOptions);
    nextState = enemyResult.state;
    tacticalEvents.push(...enemyResult.events);
  }

  const terminal = isTacticalTerminal(nextState, terminalOptions);
  return {
    canonicalState: nextState,
    rngCursor: nextState.actionCounter,
    status: terminal ? "completed" : "active",
    events: toCombatEvents(actionId, tacticalEvents),
    ...(terminal ? { result: buildTacticalSummary(nextState) } : {}),
  };
}

function classicSummary(
  state: Extract<CombatSession, { style: "classic" }>["canonicalState"],
  outcome: "victory" | "defeat" | "flee",
  rounds: number,
): CombatSummary {
  return {
    outcome,
    rounds,
    party: state.party.map((unit) => ({
      id: unit.id,
      name: unit.name,
      hp: unit.hp,
      maxHp: unit.maxHp,
      mp: unit.mp,
      maxMp: unit.maxMp,
      ko: unit.hp <= 0,
      statusEffects: (unit.statusEffects ?? []).map((effect) => effect.name),
    })),
    enemies: state.enemies.map((unit) => ({
      id: unit.id,
      name: unit.name,
      defeated: unit.hp <= 0,
      hp: unit.hp,
      maxHp: unit.maxHp,
    })),
  };
}

function applyClassicManeuver(
  state: Extract<CombatSession, { style: "classic" }>["canonicalState"],
  actionId: string,
  instruction: string,
  targetId: string | undefined,
  random: () => number,
  rollCursor: number,
  proposal?: CombatManeuverProposal,
): CombatEvent[] {
  const actor = state.party.find((member) => member.hp > 0);
  if (!actor) throw new CombatActionValidationError("No party member can perform that maneuver.");
  const lower = instruction.trim().toLowerCase();
  const allTargets = [...state.party, ...state.enemies].filter((combatant) => combatant.hp > 0);
  const namedTarget = allTargets.find((combatant) => lower.includes(combatant.name.trim().toLowerCase()));
  const target = targetId ? allTargets.find((combatant) => combatant.id === targetId) : namedTarget;
  if (targetId && !target) throw new CombatActionValidationError("Invalid maneuver target.");
  const livingEnemies = allTargets.filter((combatant) => combatant.side === "enemy");
  const roll = random();
  const difficulty = Math.max(0.05, Math.min(0.95, proposal?.difficulty ?? 0.5));
  const success = roll >= difficulty;
  const partial = !success && roll >= difficulty - 0.2;
  const scale = success ? 1 : partial ? 0.5 : 0;
  const events: CombatEvent[] = [];

  /**
   * Deterministic reading of the player's own words. Runs when no GM proposal
   * exists, and when a proposal produced nothing the battle could accept.
   */
  const applyKeywordFallback = (): void => {
    if (scale <= 0) return;
    if (/heal|aid|rescue|restore|tend/.test(lower)) {
      // "Heal myself" names no combatant, so an unmatched heal lands on the actor.
      const healed = target && target.side === "player" ? target : actor;
      const amount = Math.max(1, Math.floor(healed.maxHp * 0.2 * scale));
      const before = healed.hp;
      healed.hp = Math.min(healed.maxHp, healed.hp + amount);
      const healedFor = healed.hp - before;
      if (healedFor <= 0) return;
      events.push({
        eventId: `${actionId}:maneuver-effect:${events.length}`,
        actionId,
        kind: "heal",
        actorId: actor.id,
        targetId: healed.id,
        text: `${actor.name}'s maneuver restores ${healedFor} HP to ${healed.name}.`,
        effects: [{ type: "heal", sourceId: actor.id, targetId: healed.id, amount: healedFor }],
        amount: healedFor,
      });
      return;
    }
    if (/guard|cover|protect|shield|brace/.test(lower)) {
      const guarded = target && target.side === "player" ? target : actor;
      const status = { name: "Maneuver Guard", modifier: 2, stat: "defense" as const, turnsLeft: success ? 2 : 1 };
      guarded.statusEffects = [
        ...(guarded.statusEffects ?? []).filter((effect) => effect.name !== status.name),
        status,
      ];
      events.push({
        eventId: `${actionId}:maneuver-effect:${events.length}`,
        actionId,
        kind: "status",
        actorId: actor.id,
        targetId: guarded.id,
        text: `${actor.name}'s maneuver protects ${guarded.name}.`,
        effects: [{ type: "status", sourceId: actor.id, targetId: guarded.id, status }],
        statusName: status.name,
      });
      return;
    }
    const foe = target && target.side === "enemy" ? target : livingEnemies[0];
    if (!foe) return;
    const damage = Math.max(1, Math.floor(Math.max(actor.attack, foe.maxHp) * 0.3 * scale));
    foe.hp = Math.max(0, foe.hp - damage);
    events.push({
      eventId: `${actionId}:maneuver-effect:${events.length}`,
      actionId,
      kind: "damage",
      actorId: actor.id,
      targetId: foe.id,
      text: `${actor.name}'s maneuver deals ${damage} damage to ${foe.name}.`,
      effects: [{ type: "damage", sourceId: actor.id, targetId: foe.id, amount: damage }],
      amount: damage,
    });
  };

  const pushSummary = (text: string): void => {
    events.push({
      eventId: `${actionId}:maneuver`,
      actionId,
      kind: "maneuver",
      actorId: actor.id,
      text,
      effects: [],
      roll: { kind: "maneuver", value: roll, cursor: rollCursor },
    });
  };

  if (proposal) {
    // Reasons the battle refused an effect, so a partly-applied maneuver can
    // explain itself instead of reading as a flat failure.
    const dropped: string[] = [];
    for (const effect of proposal.effects.slice(0, 6)) {
      if (scale <= 0) continue;
      const named = effect.targetId
        ? allTargets.find((combatant) => combatant.id === effect.targetId)
        : undefined;
      if (effect.targetId && !named) {
        dropped.push("one target was no longer in the fight");
        continue;
      }
      // A self-buff or self-heal routinely arrives with no target at all.
      const selfDefaulting = effect.type === "heal" || effect.type === "status" || effect.type === "cover";
      const effectTarget =
        named ?? target ?? (selfDefaulting ? actor : effect.type === "damage" ? livingEnemies[0] : undefined);
      if (effect.type === "objective" && effect.objectiveId) {
        events.push({
          eventId: `${actionId}:maneuver-effect:${events.length}`,
          actionId,
          kind: "objective",
          actorId: actor.id,
          text: `${actor.name}'s maneuver advances ${effect.objectiveId}.`,
          effects: [
            {
              type: "objective",
              objectiveId: effect.objectiveId,
              progress: scale,
              reason: proposal.rationale,
            },
          ],
        });
        continue;
      }
      // Classic has no grid, so a repositioning or terrain effect can only be
      // narrated. Saying so beats dropping it and leaving the player guessing.
      if (effect.type === "move" || effect.type === "terrain") {
        events.push({
          eventId: `${actionId}:maneuver-effect:${events.length}`,
          actionId,
          kind: "maneuver",
          actorId: actor.id,
          text: `${actor.name} shifts the ground of the fight, but position counts for little here.`,
          effects: [],
        });
        continue;
      }
      if (!effectTarget) {
        dropped.push(`a ${effect.type} effect had nobody to land on`);
        continue;
      }
      if (effect.type === "cover") {
        // The Classic equivalent of raising cover is a defensive buff.
        const status = { name: "Shielded", modifier: 2, stat: "defense" as const, turnsLeft: success ? 2 : 1 };
        effectTarget.statusEffects = [
          ...(effectTarget.statusEffects ?? []).filter((entry) => entry.name !== status.name),
          status,
        ];
        events.push({
          eventId: `${actionId}:maneuver-effect:${events.length}`,
          actionId,
          kind: "status",
          actorId: actor.id,
          targetId: effectTarget.id,
          text: `${actor.name}'s maneuver shields ${effectTarget.name}.`,
          effects: [{ type: "status", sourceId: actor.id, targetId: effectTarget.id, status }],
          statusName: status.name,
        });
        continue;
      }
      if (effect.type === "damage" && effectTarget.side === "enemy") {
        const cap = Math.max(1, Math.floor(Math.max(actor.attack, effectTarget.maxHp * 0.25)));
        const amount = Math.max(1, Math.floor(Math.max(1, Math.min(cap, effect.amount ?? cap * 0.5)) * scale));
        effectTarget.hp = Math.max(0, effectTarget.hp - amount);
        events.push({
          eventId: `${actionId}:maneuver-effect:${events.length}`,
          actionId,
          kind: "damage",
          actorId: actor.id,
          targetId: effectTarget.id,
          text: `${actor.name}'s maneuver deals ${amount} damage to ${effectTarget.name}.`,
          effects: [{ type: "damage", sourceId: actor.id, targetId: effectTarget.id, amount }],
          amount,
        });
      } else if (effect.type === "heal" && effectTarget.side === "player") {
        const cap = Math.max(1, Math.floor(Math.max(actor.attack, effectTarget.maxHp * 0.25)));
        const requested = Math.max(1, Math.floor(Math.max(1, Math.min(cap, effect.amount ?? cap * 0.5)) * scale));
        const before = effectTarget.hp;
        effectTarget.hp = Math.min(effectTarget.maxHp, effectTarget.hp + requested);
        const amount = effectTarget.hp - before;
        if (amount > 0) {
          events.push({
            eventId: `${actionId}:maneuver-effect:${events.length}`,
            actionId,
            kind: "heal",
            actorId: actor.id,
            targetId: effectTarget.id,
            text: `${actor.name}'s maneuver restores ${amount} HP to ${effectTarget.name}.`,
            effects: [{ type: "heal", sourceId: actor.id, targetId: effectTarget.id, amount }],
            amount,
          });
        }
      } else if (effect.type === "status" && effect.status) {
        const ally = effectTarget.side === "player";
        const modifier = Math.max(-5, Math.min(5, effect.status.modifier));
        const status = {
          ...effect.status,
          name: effect.status.name.trim().slice(0, 80) || "Maneuver Effect",
          modifier: ally ? Math.max(0, modifier) : Math.min(0, modifier),
          turnsLeft: Math.max(1, Math.min(3, Math.floor(effect.status.turnsLeft))),
        };
        effectTarget.statusEffects = [
          ...(effectTarget.statusEffects ?? []).filter((entry) => entry.name !== status.name),
          status,
        ];
        events.push({
          eventId: `${actionId}:maneuver-effect:${events.length}`,
          actionId,
          kind: "status",
          actorId: actor.id,
          targetId: effectTarget.id,
          text: `${actor.name}'s maneuver applies ${status.name} to ${effectTarget.name}.`,
          effects: [{ type: "status", sourceId: actor.id, targetId: effectTarget.id, status }],
          statusName: status.name,
        });
      } else {
        dropped.push(`a ${effect.type} effect did not fit this battle`);
      }
    }
    if (events.length === 0 && scale > 0) {
      // The roll landed but nothing the GM proposed could be applied. Resolve
      // the player's own words rather than reporting an unexplainable failure.
      applyKeywordFallback();
      pushSummary(
        events.length > 0
          ? `${actor.name}'s maneuver ${success ? "succeeds" : "partially succeeds"}: ${instruction}`
          : `${actor.name}'s maneuver plays out, but nothing changes: ${instruction}`,
      );
      return events;
    }
    const actualOutcome = events.length > 0 ? (success ? "succeeds" : "partially succeeds") : "fails";
    pushSummary(
      events.length > 0 && proposal.narration.trim()
        ? `${actor.name}'s maneuver ${actualOutcome}: ${proposal.narration.trim()}`
        : `${actor.name}'s maneuver ${actualOutcome}: ${instruction}`,
    );
    if (dropped.length > 0) {
      events.push({
        eventId: `${actionId}:maneuver-note`,
        actionId,
        kind: "maneuver",
        actorId: actor.id,
        text: `Part of the maneuver could not take effect: ${dropped[0]}.`,
        effects: [],
      });
    }
    return events;
  }

  applyKeywordFallback();
  pushSummary(
    scale > 0 && events.length === 0
      ? `${actor.name}'s maneuver plays out, but nothing changes: ${instruction}`
      : success
        ? `${actor.name}'s maneuver succeeds: ${instruction}`
        : partial
          ? `${actor.name}'s maneuver partially succeeds: ${instruction}`
          : `${actor.name}'s maneuver fails: ${instruction}`,
  );
  return events;
}

function resolveClassicAction(
  session: Extract<CombatSession, { style: "classic" }>,
  actionId: string,
  action: Extract<CombatAction, { style: "classic" }>,
  maneuverProposal?: CombatManeuverProposal,
): CombatSessionActionResolution {
  const state = JSON.parse(JSON.stringify(session.canonicalState)) as typeof session.canonicalState;
  if (state.outcome) {
    throw new CombatActionValidationError("The battle is already over.");
  }
  const playerAction = action;
  if (playerAction.type === "flee") {
    state.outcome = "flee";
    return {
      canonicalState: state,
      rngCursor: session.rngCursor,
      status: "completed",
      events: [
        { eventId: `${actionId}:0`, actionId, kind: "flee", text: "The party retreats from battle.", effects: [] },
      ],
      result: classicSummary(state, "flee", state.round ?? 1),
    };
  }
  const rng = createCombatRng(session.seed, session.rngCursor);
  const maneuverRollCursor = rng.cursor();
  const maneuverEvents =
    playerAction.type === "maneuver"
      ? applyClassicManeuver(
          state,
          actionId,
          playerAction.instruction,
          playerAction.targetId,
          rng.random,
          maneuverRollCursor,
          maneuverProposal,
        )
      : [];
  const combatants = [...state.party, ...state.enemies];
  const round = state.round ?? 1;
  const controlledActorId = state.party.find((member) => member.hp > 0)?.id;
  let roundAction: CombatPlayerAction = playerAction.type === "maneuver" ? { type: "defend" } : playerAction;
  let consumedItemName: string | null = null;
  if (playerAction.type === "item") {
    const itemName = playerAction.itemId.trim().toLowerCase();
    const inventoryItem = (state.inventory ?? []).find((item) => item.name.trim().toLowerCase() === itemName);
    if (!inventoryItem || inventoryItem.quantity <= 0) {
      throw new CombatActionValidationError("That item is not available in the combat inventory.");
    }
    const itemEffect = (state.itemEffects ?? []).find((effect) => effect.name.trim().toLowerCase() === itemName);
    if (!itemEffect) throw new CombatActionValidationError("That item has no combat effect in this encounter.");
    roundAction = { ...playerAction, itemId: inventoryItem.name, itemEffect };
    if (itemEffect.consumes !== false) consumedItemName = inventoryItem.name;
  }
  const phaseOwnedMechanics = new Set(
    session.bossPhases.flatMap((phase) =>
      phase.mechanics.map((mechanic) => `${mechanic.name.trim().toLowerCase()}\u0000${mechanic.trigger}`),
    ),
  );
  const legacyMechanics = (state.mechanics ?? []).filter(
    (mechanic) => !phaseOwnedMechanics.has(`${mechanic.name.trim().toLowerCase()}\u0000${mechanic.trigger}`),
  );
  let result: ReturnType<typeof resolveCombatRound>;
  try {
    result = resolveCombatRound(
      combatants,
      round,
      state.difficulty ?? "normal",
      state.elementPreset,
      roundAction,
      legacyMechanics,
      rng.random,
    );
  } catch (error) {
    if (error instanceof CombatResolutionError) throw new CombatActionValidationError(error.message);
    throw error;
  }
  state.party = combatants.filter((combatant) => combatant.side === "player");
  state.enemies = combatants.filter((combatant) => combatant.side === "enemy");
  const itemResolved =
    consumedItemName !== null &&
    result.actions.some(
      (entry) =>
        entry.attackerId === controlledActorId &&
        entry.skillName?.trim().toLowerCase() === consumedItemName.toLowerCase(),
    );
  if (consumedItemName && itemResolved) {
    const inventoryItem = (state.inventory ?? []).find(
      (item) => item.name.trim().toLowerCase() === consumedItemName.toLowerCase(),
    );
    if (inventoryItem) inventoryItem.quantity = Math.max(0, inventoryItem.quantity - 1);
  }
  state.round = round + 1;
  const outcome = state.enemies.every((enemy) => enemy.hp <= 0)
    ? "victory"
    : state.party.every((member) => member.hp <= 0)
      ? "defeat"
      : undefined;
  if (outcome) state.outcome = outcome;
  const events: CombatEvent[] = [
    ...maneuverEvents,
    ...result.actions.map<CombatEvent>((entry, index) => ({
      eventId: `${actionId}:${maneuverEvents.length + index}`,
      actionId,
      kind: entry.isHeal ? "heal" : entry.isMiss ? "miss" : entry.isCritical ? "crit" : "damage",
      actorId: entry.attackerId,
      targetId: entry.defenderId,
      text: entry.isHeal
        ? `${entry.attackerId} restores ${entry.finalDamage} HP.`
        : entry.isMiss
          ? `${entry.attackerId} misses.`
          : `${entry.attackerId} deals ${entry.finalDamage} damage.`,
      effects: entry.isHeal
        ? [{ type: "heal", sourceId: entry.attackerId, targetId: entry.defenderId, amount: entry.finalDamage }]
        : [{ type: "damage", sourceId: entry.attackerId, targetId: entry.defenderId, amount: entry.finalDamage }],
      amount: entry.finalDamage,
      ...(entry.skillName ? { skillName: entry.skillName } : {}),
      ...(entry.element ? { element: entry.element } : {}),
    })),
  ];
  return {
    canonicalState: state,
    rngCursor: rng.cursor(),
    status: outcome ? "completed" : "active",
    events,
    classicRoundResult: result,
    ...(outcome ? { result: classicSummary(state, outcome, round) } : {}),
  };
}

function applyCombatObjectivesAndPhases(
  session: CombatSession,
  resolution: CombatSessionActionResolution,
  nextRevision: number,
): CombatSessionActionResolution {
  const objectives = (session.objectives ?? []).map((objective) => ({ ...objective }));
  const phases = (session.bossPhases ?? []).map((phase) => ({
    ...phase,
    mechanics: phase.mechanics.map((mechanic) => ({ ...mechanic })),
    reinforcements: phase.reinforcements?.map((reinforcement) => ({ ...reinforcement })),
  }));
  const tacticalState = session.style === "tactical" ? (resolution.canonicalState as TacticalCombatState) : null;
  const classicState = session.style === "classic" ? (resolution.canonicalState as ClassicCombatState) : null;
  const units: Array<{
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    side: string;
    isBoss?: boolean;
    statusEffects?: Array<{
      name: string;
      modifier: number;
      stat: "attack" | "defense" | "speed" | "hp";
      turnsLeft: number;
    }>;
  }> = tacticalState ? tacticalState.units : [...(classicState?.party ?? []), ...(classicState?.enemies ?? [])];
  const enemies = units.filter((unit) => unit.side === "enemy");
  const currentRound = tacticalState?.round ?? classicState?.round ?? 1;
  const completedRounds = Math.max(0, currentRound - 1);
  const currentOutcome = tacticalState?.outcome ?? classicState?.outcome;
  const targetIdsFor = (objective: (typeof objectives)[number]) =>
    objective.targetIds !== undefined
      ? objective.targetIds
      : objective.kind === "eliminate" || objective.kind === "conditional_eliminate"
        ? enemies.map((enemy) => enemy.id)
        : [];
  const objectiveEffects = resolution.events
    .flatMap((event) => event.effects)
    .filter((effect) => effect.type === "objective");

  for (const objective of objectives) {
    if (objective.status !== "active") continue;
    const targets = targetIdsFor(objective);
    objective.progress += objectiveEffects
      .filter((effect) => effect.objectiveId === objective.id)
      .reduce((total, effect) => total + Math.max(0, effect.progress), 0);
    if (objective.kind === "eliminate") {
      const targetUnits = targets
        .map((id) => units.find((unit) => unit.id === id))
        .filter((unit) => unit !== undefined);
      const defeated = targetUnits.filter((unit) => unit.hp <= 0).length;
      objective.progress = Math.max(objective.progress, defeated);
      if (targetUnits.length === targets.length && defeated >= targets.length && targets.length > 0) {
        objective.status = "complete";
      }
    } else if (objective.kind === "conditional_eliminate") {
      const targetUnits = targets
        .map((id) => units.find((unit) => unit.id === id))
        .filter((unit) => unit !== undefined);
      const defeated = targetUnits.filter((unit) => unit.hp <= 0).length;
      const conditionSatisfied = !objective.condition || objective.progress >= (objective.requiredProgress ?? 1);
      if (
        targetUnits.length === targets.length &&
        defeated >= targets.length &&
        targets.length > 0 &&
        conditionSatisfied
      ) {
        objective.status = "complete";
      }
    } else if (objective.kind === "survive_rounds") {
      objective.progress = Math.max(objective.progress, completedRounds);
      if (completedRounds >= (objective.requiredProgress ?? 1)) objective.status = "complete";
    } else if (objective.kind === "escape") {
      const exitReached =
        tacticalState && objective.tileIds?.length
          ? objective.tileIds.some((tileId) => {
              const match = /^\s*(-?\d+)\s*[,x:]\s*(-?\d+)\s*$/.exec(tileId);
              if (!match) return false;
              const x = Number(match[1]);
              const y = Number(match[2]);
              return tacticalState.units.some(
                (unit) => unit.side === "party" && unit.hp > 0 && unit.x === x && unit.y === y,
              );
            })
          : false;
      if (exitReached || objective.progress >= (objective.requiredProgress ?? 1)) objective.status = "complete";
    } else if (objective.kind === "defend" || objective.kind === "escort") {
      const targetUnits = targets
        .map((id) => units.find((unit) => unit.id === id))
        .filter((unit) => unit !== undefined);
      if (targetUnits.some((unit) => unit.hp <= 0)) objective.status = "failed";
      else if (targetUnits.length === targets.length && objective.progress >= (objective.requiredProgress ?? 1)) {
        objective.status = "complete";
      }
    } else if (objective.progress >= (objective.requiredProgress ?? 1)) {
      objective.status = "complete";
    }
    if (
      objective.status === "active" &&
      objective.failAtRound !== undefined &&
      completedRounds >= objective.failAtRound
    ) {
      objective.status = "failed";
    }
  }

  for (const phase of phases) {
    const ownerName = phase.ownerName?.trim().toLocaleLowerCase();
    const boss =
      (ownerName ? enemies.find((enemy) => enemy.name.trim().toLocaleLowerCase() === ownerName) : undefined) ??
      enemies.find((enemy) => enemy.isBoss) ??
      enemies[0];
    if (!boss) continue;
    const pendingTelegraph =
      phase.telegraphedAtRevision !== undefined &&
      (phase.triggeredAtRevision === undefined || phase.triggeredAtRevision < phase.telegraphedAtRevision);
    if (!pendingTelegraph) {
      if (phase.once !== false && phase.triggeredAtRevision !== undefined) continue;
      const hpPercent = boss.maxHp > 0 ? (boss.hp / boss.maxHp) * 100 : 0;
      const thresholdReached =
        phase.triggeredAtRevision === undefined && phase.threshold !== undefined && hpPercent <= phase.threshold;
      const interval = phase.round !== undefined ? Math.max(1, Math.floor(phase.round)) : undefined;
      const roundReached =
        interval !== undefined &&
        (phase.once === false
          ? completedRounds > 0 && completedRounds % interval === 0 && phase.lastTriggeredRound !== completedRounds
          : completedRounds >= interval);
      const bossWasHit = resolution.events.some(
        (event) =>
          event.targetId === boss.id &&
          (event.amount ?? 0) > 0 &&
          event.effects.some((effect) => effect.type === "damage" && effect.targetId === boss.id && effect.amount > 0),
      );
      const bossAttacked = resolution.events.some(
        (event) =>
          event.actorId === boss.id &&
          (event.kind === "damage" ||
            event.kind === "crit" ||
            event.kind === "miss" ||
            event.kind === "counter" ||
            event.kind === "skill" ||
            event.kind === "status"),
      );
      const eventReached =
        phase.lastTriggeredRound !== completedRounds &&
        ((phase.trigger === "on_hit" && bossWasHit) || (phase.trigger === "on_attack" && bossAttacked));
      const passiveReached =
        phase.trigger === "passive" && completedRounds > 0 && phase.lastTriggeredRound !== completedRounds;
      if (!thresholdReached && !roundReached && !eventReached && !passiveReached) continue;
      phase.telegraphedAtRevision = nextRevision;
      if (roundReached || eventReached || passiveReached) phase.lastTriggeredRound = completedRounds;
      resolution.events.push({
        eventId: `phase:${phase.id}:telegraph:${nextRevision}`,
        actionId: resolution.events[0]?.actionId ?? `phase:${nextRevision}`,
        kind: "phase",
        text: phase.telegraph ?? `Boss phase ${phase.id} is about to begin.`,
        effects: [{ type: "phase", phaseId: phase.id }],
      });
      continue;
    }

    phase.triggeredAtRevision = nextRevision;
    if (boss.hp <= 0) {
      resolution.events.push({
        eventId: `phase:${phase.id}:interrupted:${nextRevision}`,
        actionId: resolution.events[0]?.actionId ?? `phase:${nextRevision}`,
        kind: "phase-interrupted",
        actorId: boss.id,
        text: `${phase.telegraph ?? `Boss phase ${phase.id}`} is interrupted.`,
        effects: [],
      });
      continue;
    }
    for (const [index, reinforcement] of (phase.reinforcements ?? []).entries()) {
      const side = reinforcement.side ?? "enemy";
      const reinforcementId = reinforcement.id?.trim() || `reinforcement:${phase.id}:${nextRevision}:${index}`;
      if (units.some((unit) => unit.id === reinforcementId)) continue;
      if (tacticalState) {
        let spawn: { x: number; y: number } | null = null;
        const xOrder = Array.from({ length: tacticalState.grid.width }, (_, x) => x);
        if (side !== "player") xOrder.reverse();
        for (const x of xOrder) {
          for (let y = 0; y < tacticalState.grid.height; y++) {
            const occupied = tacticalState.units.some((unit) => unit.hp > 0 && unit.x === x && unit.y === y);
            const terrain = tacticalState.grid.tiles[y]?.[x];
            if (!occupied && terrain && terrain !== "wall" && terrain !== "water" && terrain !== "mountain") {
              spawn = { x, y };
              break;
            }
          }
          if (spawn) break;
        }
        if (!spawn) continue;
        tacticalState.units.push({
          id: reinforcementId,
          name: reinforcement.name,
          side: side === "player" ? "party" : "enemy",
          hp: Math.max(1, reinforcement.hp),
          maxHp: Math.max(1, reinforcement.maxHp),
          mp: Math.max(0, reinforcement.mp ?? 0),
          maxMp: Math.max(0, reinforcement.maxMp ?? reinforcement.mp ?? 0),
          attack: Math.max(1, reinforcement.attack),
          defense: Math.max(0, reinforcement.defense),
          speed: Math.max(0, reinforcement.speed),
          level: Math.max(1, reinforcement.level ?? 1),
          skills: [],
          statusEffects: [],
          ...(reinforcement.element ? { element: reinforcement.element } : {}),
          ...(reinforcement.isBoss ? { isBoss: true } : {}),
          x: spawn.x,
          y: spawn.y,
          movement: Math.max(2, Math.min(7, Math.floor(reinforcement.speed / 3) + 2)),
          attackRange: { min: 1, max: 1 },
          hasMoved: true,
          hasActed: true,
          defending: false,
          skillCooldowns: {},
        });
      } else if (classicState) {
        const combatant = {
          id: reinforcementId,
          name: reinforcement.name,
          hp: Math.max(1, reinforcement.hp),
          maxHp: Math.max(1, reinforcement.maxHp),
          mp: Math.max(0, reinforcement.mp ?? 0),
          maxMp: Math.max(0, reinforcement.maxMp ?? reinforcement.mp ?? 0),
          attack: Math.max(1, reinforcement.attack),
          defense: Math.max(0, reinforcement.defense),
          speed: Math.max(0, reinforcement.speed),
          level: Math.max(1, reinforcement.level ?? 1),
          side,
          skills: [],
          statusEffects: [],
          ...(reinforcement.element ? { element: reinforcement.element } : {}),
        };
        if (side === "player") classicState.party.push(combatant);
        else classicState.enemies.push(combatant);
      }
      resolution.events.push({
        eventId: `phase:${phase.id}:reinforcement:${reinforcementId}:${nextRevision}`,
        actionId: resolution.events[0]?.actionId ?? `phase:${nextRevision}`,
        kind: "reinforcement",
        targetId: reinforcementId,
        text: `${reinforcement.name} joins the battle.`,
        effects: [],
      });
      if (side !== "player") {
        for (const objective of objectives) {
          if (
            objective.includeReinforcements &&
            (objective.kind === "eliminate" || objective.kind === "conditional_eliminate")
          ) {
            objective.targetIds = Array.from(new Set([...(objective.targetIds ?? []), reinforcementId]));
            objective.status = "active";
          }
        }
      }
    }
    for (const mechanic of phase.mechanics) {
      const opponents = units.filter((unit) => unit.side !== boss.side && unit.hp > 0);
      const targets =
        mechanic.effectType === "buff_self"
          ? [boss]
          : mechanic.effectType === "damage_one"
            ? opponents.slice(0, 1)
            : opponents;
      for (const target of targets) {
        const shouldDamage = mechanic.effectType === "damage_all" || mechanic.effectType === "damage_one";
        const damage = shouldDamage
          ? Math.max(
              1,
              Math.floor(Math.max(boss.attack, target.maxHp) * Math.max(0.05, Math.min(2, mechanic.power ?? 0.25))),
            )
          : 0;
        if (damage > 0) target.hp = Math.max(0, target.hp - damage);
        if (
          mechanic.status ||
          mechanic.effectType === "buff_self" ||
          mechanic.effectType?.startsWith("status") ||
          mechanic.effectType?.startsWith("debuff")
        ) {
          const status: NonNullable<typeof target.statusEffects>[number] = {
            name: mechanic.status?.name ?? mechanic.name,
            modifier: mechanic.status?.modifier ?? (mechanic.effectType === "buff_self" ? 2 : -2),
            stat: mechanic.status?.stat ?? "defense",
            turnsLeft: Math.max(1, mechanic.status?.duration ?? 2),
          };
          target.statusEffects = [
            ...(target.statusEffects ?? []).filter((effect) => effect.name !== status.name),
            status,
          ];
        }
        resolution.events.push({
          eventId: `phase:${phase.id}:${mechanic.name}:${target.id}:${nextRevision}`,
          actionId: resolution.events[0]?.actionId ?? `phase:${nextRevision}`,
          kind: damage > 0 ? "damage" : "status",
          actorId: boss.id,
          targetId: target.id,
          text: `${mechanic.name} affects ${target.name}${damage > 0 ? ` for ${damage} damage` : ""}.`,
          effects:
            damage > 0
              ? [
                  {
                    type: "damage",
                    sourceId: boss.id,
                    targetId: target.id,
                    amount: damage,
                    ...(mechanic.element ? { element: mechanic.element } : {}),
                  },
                ]
              : [],
          ...(damage > 0 ? { amount: damage } : {}),
          ...(mechanic.element ? { element: mechanic.element } : {}),
        });
      }
    }
  }

  // Phase damage resolves after objective progress, so protected targets must
  // be checked again before the terminal outcome is derived.
  for (const objective of objectives) {
    if (objective.kind !== "defend" && objective.kind !== "escort") continue;
    const targetUnits = targetIdsFor(objective)
      .map((id) => units.find((unit) => unit.id === id))
      .filter((unit) => unit !== undefined);
    if (targetUnits.some((unit) => unit.hp <= 0)) objective.status = "failed";
  }

  const failed = objectives.some((objective) => objective.status === "failed");
  const completed = objectives.length > 0 && objectives.every((objective) => objective.status === "complete");
  const finalUnits = tacticalState
    ? tacticalState.units
    : [...(classicState?.party ?? []), ...(classicState?.enemies ?? [])];
  const partyAlive = finalUnits.some((unit) => unit.side !== "enemy" && unit.hp > 0);
  const enemiesAlive = finalUnits.some((unit) => unit.side === "enemy" && unit.hp > 0);
  const fled = currentOutcome === "fled" || currentOutcome === "flee";
  const escapeObjectives = objectives.filter((objective) => objective.kind === "escape");
  const escapedSuccessfully =
    escapeObjectives.length > 0 && escapeObjectives.every((objective) => objective.status === "complete");
  const normalizedOutcome = fled
    ? escapeObjectives.length > 0
      ? escapedSuccessfully
        ? "victory"
        : undefined
      : currentOutcome
    : !partyAlive || failed
      ? "defeat"
      : completed || (objectives.length === 0 && !enemiesAlive)
        ? "victory"
        : undefined;
  if (tacticalState) {
    if (normalizedOutcome === "flee") tacticalState.outcome = "fled";
    else if (normalizedOutcome) tacticalState.outcome = normalizedOutcome;
    else delete tacticalState.outcome;
  }
  if (classicState) {
    if (normalizedOutcome === "fled") classicState.outcome = "flee";
    else if (normalizedOutcome) classicState.outcome = normalizedOutcome;
    else delete classicState.outcome;
  }
  const terminalOutcome = tacticalState?.outcome ?? classicState?.outcome;
  const terminal = terminalOutcome !== undefined;
  let result: CombatSummary | undefined;
  if (terminal && tacticalState) {
    result = { ...buildTacticalSummary(tacticalState), objectives: objectives.map((objective) => ({ ...objective })) };
  } else if (terminal && classicState?.outcome) {
    result = {
      ...classicSummary(classicState, classicState.outcome, Math.max(1, completedRounds)),
      objectives: objectives.map((objective) => ({ ...objective })),
    };
  }
  if (result?.outcome === "victory") {
    const defeatedCount = result.enemies.filter((enemy) => enemy.defeated).length;
    if (defeatedCount > 0) {
      const lootRng = createCombatRng(session.seed, resolution.rngCursor);
      const difficulty = classicState?.difficulty ?? tacticalState?.difficulty ?? "normal";
      const loot = generateCombatLoot(defeatedCount, difficulty, lootRng.random).map((drop) => ({
        name: drop.item.name,
        quantity: drop.quantity,
      }));
      result.loot = loot;
      resolution.rngCursor = lootRng.cursor();
      const inventory = tacticalState?.inventory ?? classicState?.inventory;
      if (inventory) {
        for (const drop of loot) {
          const existing = inventory.find((item) => item.name.trim().toLowerCase() === drop.name.trim().toLowerCase());
          if (existing) existing.quantity += drop.quantity;
          else inventory.push({ name: drop.name, quantity: drop.quantity });
        }
      }
    }
  }
  if (result) {
    result.sessionId = session.sessionId;
    const inventory = tacticalState?.inventory ?? classicState?.inventory;
    result.inventory = inventory?.map((item) => ({ ...item })) ?? [];
  }
  const { result: _preObjectiveResult, ...baseResolution } = resolution;
  return {
    ...baseResolution,
    objectives,
    bossPhases: phases,
    status: "active",
    ...(result ? { result } : {}),
  };
}

export function resolveCombatSessionAction(
  session: CombatSession,
  actionId: string,
  action: CombatAction,
  maneuverProposal?: CombatManeuverProposal,
): CombatSessionActionResolution {
  const resolveAndHook = (resolution: CombatSessionActionResolution) =>
    applyCombatObjectivesAndPhases(session, resolution, session.revision + 1);
  if ("style" in action && action.style !== session.style) {
    throw new CombatActionValidationError("Combat action style does not match session");
  }
  if ("type" in action && action.type === "flee") {
    if ("style" in action && action.style === "classic" && session.style === "classic") {
      return resolveAndHook(
        resolveClassicAction(
          session,
          actionId,
          action as Extract<CombatAction, { style: "classic" }>,
          maneuverProposal,
        ),
      );
    }
    if (session.style !== "tactical") throw new CombatActionValidationError("Classic flee requires a classic action");
    return resolveAndHook(resolveTacticalAction(session, actionId, { type: "flee" }));
  }
  if ("type" in action && action.type === "endTurn") {
    if (session.style !== "tactical") throw new CombatActionValidationError("Classic combat does not support end turn");
    return resolveAndHook(resolveTacticalAction(session, actionId, { type: "endTurn" }));
  }
  if ("type" in action && action.type === "maneuver") {
    if ("style" in action && action.style === "classic" && session.style === "classic") {
      return resolveAndHook(
        resolveClassicAction(
          session,
          actionId,
          action as Extract<CombatAction, { style: "classic" }>,
          maneuverProposal,
        ),
      );
    }
    if (session.style !== "tactical") {
      throw new CombatActionValidationError("Classic maneuver resolution requires the classic resolver");
    }
    if ("maneuver" in action) {
      return resolveAndHook(
        resolveTacticalAction(
          session,
          actionId,
          {
            type: "maneuver",
            unitId: action.maneuver.actorId,
            instruction: action.maneuver.instruction,
            targetId: action.maneuver.targetId,
            tile: action.maneuver.tile,
            objectiveId: action.maneuver.objectiveId,
          },
          maneuverProposal,
        ),
      );
    }
    return resolveAndHook(resolveTacticalAction(session, actionId, action as TacticalAction, maneuverProposal));
  }
  if (action.style !== session.style)
    throw new CombatActionValidationError("Combat action style does not match session");
  if (action.style === "tactical" && session.style === "tactical") {
    return resolveAndHook(resolveTacticalAction(session, actionId, action as TacticalAction, maneuverProposal));
  }
  if (action.style === "classic" && session.style === "classic") {
    return resolveAndHook(
      resolveClassicAction(session, actionId, action as Extract<CombatAction, { style: "classic" }>, maneuverProposal),
    );
  }
  throw new CombatActionValidationError("Classic session actions must use the classic resolver");
}
