import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  combatBossPhasesFromMechanics,
  resolveCombatSessionAction,
  CombatActionValidationError,
} from "../../packages/server/src/services/game/combat-session.service.ts";
import type {
  ClassicCombatState,
  CombatAction,
  CombatBossPhase,
  CombatManeuverProposal,
  CombatSession,
  CombatStatusEffect,
  TacticalCombatState,
  TacticalUnit,
} from "../../packages/shared/src/index.ts";

function unit(id: string, side: "player" | "enemy", hp = 30) {
  return {
    id,
    name: id,
    hp,
    maxHp: hp,
    mp: 10,
    maxMp: 10,
    attack: side === "player" ? 40 : 1,
    defense: 0,
    speed: 10,
    level: 1,
    side,
    skills: [],
    statusEffects: [] as CombatStatusEffect[],
  };
}

function classic(overrides: Partial<ClassicCombatState> = {}, phases: CombatBossPhase[] = []): CombatSession {
  return {
    sessionId: "session-1",
    chatId: "chat-1",
    style: "classic",
    schemaVersion: 1,
    revision: 0,
    status: "active",
    seed: 42,
    rngCursor: 0,
    lastActionId: null,
    canonicalState: {
      party: [unit("hero", "player")],
      enemies: [unit("goblin", "enemy")],
      itemEffects: [{ name: "Potion", target: "self", type: "heal", description: "Restore HP", power: 10 }],
      inventory: [{ name: "Potion", quantity: 1 }],
      mechanics: [],
      dialogueCues: [],
      startMessageId: null,
      round: 1,
      difficulty: "normal",
      ...overrides,
    },
    objectives: [],
    bossPhases: phases,
    actionHistory: [],
    createdAt: "now",
    updatedAt: "now",
  };
}

function tacticalUnit(id: string, side: "party" | "enemy", hp = 30): TacticalUnit {
  return {
    id,
    name: id,
    side,
    hp,
    maxHp: Math.max(30, hp),
    mp: 10,
    maxMp: 10,
    attack: side === "party" ? 40 : 1,
    defense: 0,
    speed: 10,
    level: 1,
    skills: [],
    statusEffects: [],
    x: side === "party" ? 0 : 2,
    y: 0,
    movement: 3,
    attackRange: { min: 1, max: 1 },
    hasMoved: false,
    hasActed: false,
    defending: false,
    skillCooldowns: {},
  };
}

function tactical(overrides: Partial<TacticalCombatState> = {}): CombatSession {
  return {
    sessionId: "tactical-session-1",
    chatId: "chat-1",
    style: "tactical",
    schemaVersion: 1,
    revision: 0,
    status: "active",
    seed: 42,
    rngCursor: 0,
    lastActionId: null,
    canonicalState: {
      schemaVersion: 1,
      grid: { width: 3, height: 1, tiles: [["plains", "plains", "plains"]] },
      units: [tacticalUnit("hero", "party"), tacticalUnit("enemy", "enemy")],
      phase: "player",
      round: 1,
      seed: 42,
      actionCounter: 0,
      log: [],
      difficulty: "normal",
      inventory: [],
      itemEffects: [],
      hazards: [],
      ...overrides,
    },
    objectives: [],
    bossPhases: [],
    actionHistory: [],
    createdAt: "now",
    updatedAt: "now",
  };
}

function advanceClassic(
  session: CombatSession,
  resolution: ReturnType<typeof resolveCombatSessionAction>,
): CombatSession {
  if (session.style !== "classic" || !("party" in resolution.canonicalState)) {
    throw new Error("Expected Classic combat state");
  }
  return {
    ...session,
    revision: session.revision + 1,
    status: resolution.status ?? session.status,
    canonicalState: resolution.canonicalState,
    objectives: resolution.objectives ?? session.objectives,
    bossPhases: resolution.bossPhases ?? session.bossPhases,
  };
}

const attack = { style: "classic" as const, type: "attack" as const, targetId: "goblin" };
const first = resolveCombatSessionAction(classic(), "attack-1", attack);
const second = resolveCombatSessionAction(classic(), "attack-1", attack);
assert.deepEqual(first.canonicalState, second.canonicalState, "seeded Classic action must be deterministic");
assert.deepEqual(first.events, second.events, "seeded Classic events must be deterministic");
assert.equal(first.result?.outcome, "victory", "the deterministic fixture must reach victory");
assert.ok(first.result.loot?.length, "victory must generate authoritative loot");
assert.deepEqual(first.result?.loot, second.result?.loot, "victory loot must use the session RNG");
if (first.result.loot?.length) {
  for (const drop of first.result.loot) {
    assert.equal(
      first.canonicalState.inventory?.some((item) => item.name === drop.name && item.quantity >= (drop.quantity ?? 1)),
      true,
      "authoritative loot must be added to canonical inventory",
    );
  }
}
assert.throws(
  () => resolveCombatSessionAction(advanceClassic(classic(), first), "post-victory-action", attack),
  (error: unknown) => error instanceof CombatActionValidationError && /already over/i.test(error.message),
  "Classic terminal sessions must reject fresh actions instead of awarding victory loot again",
);

const routesSource = readFileSync(new URL("../../packages/server/src/routes/game.routes.ts", import.meta.url), "utf8");
const sessionStorageSource = readFileSync(
  new URL("../../packages/server/src/services/storage/game-combat-session.storage.ts", import.meta.url),
  "utf8",
);
const gameSurfaceSource = readFileSync(
  new URL("../../packages/client/src/components/game/GameSurface.tsx", import.meta.url),
  "utf8",
);
const tacticalCombatUiSource = readFileSync(
  new URL("../../packages/client/src/components/game/TacticalCombatUI.tsx", import.meta.url),
  "utf8",
);
assert.equal(
  (routesSource.match(/await syncCombatInventory\(/g) ?? []).length,
  2,
  "Classic and Tactical duplicate responses must retry durable inventory synchronization",
);
assert.match(
  routesSource,
  /bossPhases: z\.array\(combatBossPhaseSchema\)\.max\(20\)\.optional\(\)/,
  "generic combat session starts must validate boss phases with a concrete schema",
);
assert.match(
  routesSource,
  /if \(session && session\.style !== "tactical"\) \{\s*return reply\s*\.status\(409\)/,
  "every Tactical request must preserve an active Classic session",
);
assert.equal(
  (routesSource.match(/code: "COMBAT_WRONG_STYLE"/g) ?? []).length,
  3,
  "Classic, Tactical, and generic action routes must preserve an active opposite-style session",
);
assert.doesNotMatch(
  routesSource,
  /if \(session && session\.style !== "tactical"\)[\s\S]{0,400}abandonForChat/,
  "a Tactical compatibility snapshot must not abandon an active Classic session",
);
assert.match(
  routesSource,
  /mechanics: z\.array\(combatMechanicDefinitionSchema\)\.max\(20\)\.optional\(\)/,
  "Tactical starts must validate generated boss mechanics before phase conversion",
);
assert.match(
  sessionStorageSource,
  /where\(and\(eq\(gameCombatSessions\.sessionId, sessionId\), eq\(gameCombatSessions\.status, "active"\)\)\)/,
  "delayed completion acknowledgements must not revive abandoned or completed sessions",
);
assert.match(
  sessionStorageSource,
  /if \(!session\.canonicalState\.outcome\) \{[\s\S]{0,300}"INVALID_ACTION"/,
  "completion acknowledgements must reject active sessions that have not reached an outcome",
);
assert.ok(
  routesSource.indexOf("if (existing && existing.chatId !== body.chatId)") <
    routesSource.indexOf("if (!actionMatchesStyle)"),
  "generic action preflight must preserve wrong-chat precedence before exposing session style",
);
assert.ok(
  routesSource.indexOf("if (!actionMatchesStyle)") <
    routesSource.indexOf("await adjudicateCombatManeuver", routesSource.indexOf("if (!actionMatchesStyle)")),
  "generic wrong-style actions must be rejected before maneuver adjudication invokes the GM",
);
assert.match(
  routesSource,
  /trigger: z\.enum\(\["round_interval", "hp_threshold", "on_hit", "on_attack", "passive"\]\)\.optional\(\)/,
  "generic boss phases must preserve event and passive trigger metadata",
);
assert.match(
  routesSource,
  /detailedInventory\.push\(\{\s*name: item\.name,\s*description: "",\s*quantity: item\.quantity,\s*location: "on_person"/,
  "canonical combat loot missing from detailed player inventory must be persisted",
);
assert.match(
  gameSurfaceSource,
  /fallbackToAllEnemies = elimination && \(!targetIds \|\| targetIds\.length === 0\)/,
  "unresolved generated elimination targets must safely fall back to all enemies",
);
assert.match(
  tacticalCombatUiSource,
  /hydratedSessionRevisionRef\.current === hydrationKey/,
  "restored Tactical sessions must hydrate only once per authoritative revision",
);
assert.match(
  tacticalCombatUiSource,
  /const movedUnitId = ev\.targetId \?\? ev\.actorId/,
  "Tactical movement playback must animate the unit moved by a maneuver",
);
assert.doesNotMatch(
  tacticalCombatUiSource,
  /\[chatId, updateMeta\]/,
  "Tactical snapshot persistence must not depend on the unstable mutation result object",
);

assert.throws(
  () =>
    resolveCombatSessionAction(classic(), "bad-item", {
      style: "classic",
      type: "item",
      itemId: "Invented Bomb",
      targetId: "goblin",
      itemEffect: { name: "Invented Bomb", target: "enemy", type: "damage", description: "bad", power: 1000 },
    }),
  (error: unknown) => error instanceof CombatActionValidationError,
);

const fastHero = { ...unit("hero", "player", 20), hp: 10, speed: 100 };
const usedItem = resolveCombatSessionAction(classic({ party: [fastHero] }), "potion-1", {
  style: "classic",
  type: "item",
  itemId: "Potion",
  targetId: "hero",
  itemEffect: { name: "Client Lies", target: "enemy", type: "damage", description: "ignored", power: 999 },
});
assert.equal(usedItem.canonicalState.inventory?.[0]?.quantity, 0, "canonical item quantity must be consumed");
assert.equal(
  usedItem.events.some((event) => event.kind === "heal" && event.skillName === "Potion"),
  true,
  "canonical item effect must come from the session",
);

const preciseHeal = classic({
  party: [{ ...unit("hero", "player", 10), maxHp: 100, speed: 100 }],
  inventory: [{ name: "Measured Tonic", quantity: 1 }],
  itemEffects: [
    { name: "Measured Tonic", target: "self", type: "heal", description: "Restore exactly ten percent.", power: 0.1 },
  ],
});
const preciseHealResult = resolveCombatSessionAction(preciseHeal, "precise-heal", {
  style: "classic",
  type: "item",
  itemId: "Measured Tonic",
  targetId: "hero",
});
assert.equal(
  preciseHealResult.classicRoundResult?.actions.find((entry) => entry.skillName === "Measured Tonic")?.finalDamage,
  10,
  "Classic healing items must honor generated power instead of name-based potency",
);

const utilitySession = classic({
  party: [{ ...unit("hero", "player", 30), speed: 100 }],
  inventory: [{ name: "Signal Flare", quantity: 1 }],
  itemEffects: [{ name: "Signal Flare", target: "self", type: "utility", description: "Reveal the area." }],
});
const utilityResult = resolveCombatSessionAction(utilitySession, "utility-item", {
  style: "classic",
  type: "item",
  itemId: "Signal Flare",
  targetId: "hero",
});
const utilityAction = utilityResult.classicRoundResult?.actions.find((entry) => entry.skillName === "Signal Flare");
assert.equal(utilityAction?.finalDamage, 0, "utility items must remain mechanically neutral");
assert.equal(utilityAction?.isHeal, undefined, "utility items must not masquerade as healing");

assert.throws(
  () =>
    resolveCombatSessionAction(utilitySession, "bad-self-target", {
      style: "classic",
      type: "item",
      itemId: "Signal Flare",
      targetId: "goblin",
    }),
  (error: unknown) => error instanceof CombatActionValidationError,
  "self-only items must reject non-self targets",
);

const phaseMechanic = {
  name: "War Cry",
  description: "The boss wounds the hero.",
  trigger: "hp_threshold" as const,
  hpThreshold: 100,
  effectType: "damage_one" as const,
  power: 0.25,
};
const phase = {
  id: "phase-1",
  threshold: 100,
  mechanics: [phaseMechanic],
  once: true,
} satisfies CombatBossPhase;
const phaseSession = classic(
  { enemies: [{ ...unit("goblin", "enemy", 100), isBoss: true }], mechanics: [phaseMechanic] },
  [phase],
);
const phaseTelegraph = resolveCombatSessionAction(phaseSession, "phase-telegraph", {
  style: "classic",
  type: "defend",
});
assert.equal(
  phaseTelegraph.events.some((event) => event.kind === "phase"),
  true,
  "boss mechanics must telegraph before resolving",
);
assert.equal(
  phaseTelegraph.events.filter((event) => event.eventId.startsWith("phase:") && event.kind === "damage").length,
  0,
  "telegraphed mechanics must not damage the party immediately",
);
const phaseResult = resolveCombatSessionAction(advanceClassic(phaseSession, phaseTelegraph), "phase-resolve", {
  style: "classic",
  type: "defend",
});
assert.equal(
  phaseResult.events.filter((event) => event.eventId.startsWith("phase:") && event.kind === "damage").length,
  1,
  "phase-owned Classic mechanics must resolve on the following action",
);

const ownedPhase = {
  ...phase,
  id: "owned-phase",
  ownerName: "True Boss",
} satisfies CombatBossPhase;
const ownedPhaseSession = classic(
  {
    party: [unit("hero", "player", 1_000)],
    enemies: [
      { ...unit("decoy", "enemy", 1_000), isBoss: true },
      { ...unit("true-boss", "enemy", 1_000), name: "True Boss", isBoss: true },
    ],
    mechanics: [phaseMechanic],
  },
  [ownedPhase],
);
const ownedWarning = resolveCombatSessionAction(ownedPhaseSession, "owned-warning", {
  style: "classic",
  type: "defend",
});
const ownedResolution = resolveCombatSessionAction(
  advanceClassic(ownedPhaseSession, ownedWarning),
  "owned-resolution",
  { style: "classic", type: "defend" },
);
assert.equal(
  ownedResolution.events.some(
    (event) => event.eventId.startsWith("phase:owned-phase:") && event.actorId === "true-boss",
  ),
  true,
  "boss phases must resolve from the enemy named by ownerName",
);

const recurringPhase = { ...phase, id: "recurring-phase", threshold: undefined, round: 1, once: false };
let recurringSession = classic(
  {
    party: [unit("hero", "player", 1_000)],
    enemies: [{ ...unit("goblin", "enemy", 1_000), isBoss: true }],
    mechanics: [phaseMechanic],
  },
  [recurringPhase],
);
const recurringWarning1 = resolveCombatSessionAction(recurringSession, "recurring-warning-1", {
  style: "classic",
  type: "defend",
});
recurringSession = advanceClassic(recurringSession, recurringWarning1);
const recurringHit1 = resolveCombatSessionAction(recurringSession, "recurring-hit-1", {
  style: "classic",
  type: "defend",
});
recurringSession = advanceClassic(recurringSession, recurringHit1);
const recurringWarning2 = resolveCombatSessionAction(recurringSession, "recurring-warning-2", {
  style: "classic",
  type: "defend",
});
recurringSession = advanceClassic(recurringSession, recurringWarning2);
const recurringHit2 = resolveCombatSessionAction(recurringSession, "recurring-hit-2", {
  style: "classic",
  type: "defend",
});
assert.equal(
  recurringWarning1.events.some((event) => event.kind === "phase"),
  true,
);
assert.equal(
  recurringWarning2.events.some((event) => event.kind === "phase"),
  true,
);
assert.equal(
  [recurringHit1, recurringHit2].every(
    (result) =>
      result.events.filter((event) => event.eventId.startsWith("phase:") && event.kind === "damage").length === 1,
  ),
  true,
  "recurring round phases must re-arm after each resolved telegraph",
);

const reinforcement = {
  id: "reinforcement-1",
  name: "Reinforcement",
  hp: 10,
  maxHp: 10,
  attack: 1,
  defense: 0,
  speed: 1,
};
const reinforcementPhase = {
  id: "reinforce",
  threshold: 100,
  mechanics: [],
  reinforcements: [reinforcement],
  once: true,
} satisfies CombatBossPhase;
const reinforcementSession = classic({ enemies: [{ ...unit("goblin", "enemy", 100), isBoss: true }] }, [
  reinforcementPhase,
]);
reinforcementSession.objectives = [
  {
    id: "clear-field",
    kind: "eliminate",
    label: "Clear the field",
    targetIds: ["goblin"],
    includeReinforcements: true,
    progress: 0,
    status: "active",
  },
];
const reinforcementTelegraph = resolveCombatSessionAction(reinforcementSession, "reinforce-warning", {
  style: "classic",
  type: "defend",
});
const reinforcementResult = resolveCombatSessionAction(
  advanceClassic(reinforcementSession, reinforcementTelegraph),
  "reinforce-resolve",
  { style: "classic", type: "defend" },
);
assert.equal(reinforcementResult.status, "active", "a spawned hostile keeps the session active");
assert.equal(
  reinforcementResult.canonicalState.enemies.some((enemy) => enemy.id === "reinforcement-1"),
  true,
);
assert.deepEqual(
  reinforcementResult.objectives?.[0]?.targetIds,
  ["goblin", "reinforcement-1"],
  "all-enemy objectives must include hostile reinforcements",
);

const objectiveProposal: CombatManeuverProposal = {
  outcome: "success",
  rationale: "The hero reaches the objective.",
  difficulty: 0.05,
  effects: [{ type: "objective", objectiveId: "capture", amount: 1 }],
  narration: "The route opens.",
};
const objectiveSession = classic({ enemies: [{ ...unit("guard", "enemy", 100) }] });
objectiveSession.objectives = [
  { id: "capture", kind: "capture", label: "Capture", requiredProgress: 1, progress: 0, status: "active" },
];
const objectiveResult = resolveCombatSessionAction(
  objectiveSession,
  "escape-1",
  { style: "classic", type: "maneuver", instruction: "Reach the exit" },
  objectiveProposal,
);
assert.equal(
  objectiveResult.status,
  "active",
  "terminal combat sessions must remain active until the client acknowledges the aftermath",
);
assert.equal(objectiveResult.result?.outcome, "victory");

const protectedTargetSession = classic({
  party: [unit("hero", "player", 100), { ...unit("ward", "player", 10), hp: 0 }],
  enemies: [unit("guard", "enemy", 100)],
});
protectedTargetSession.objectives = [
  {
    id: "defend-ward",
    kind: "defend",
    label: "Protect the ward",
    targetIds: ["ward"],
    requiredProgress: 1,
    progress: 1,
    status: "active",
  },
];
const protectedTargetResult = resolveCombatSessionAction(protectedTargetSession, "ward-fallen", {
  style: "classic",
  type: "defend",
});
assert.equal(
  protectedTargetResult.objectives?.[0]?.status,
  "failed",
  "a dead defend target must stay failed even when progress had reached its completion threshold",
);
assert.equal(protectedTargetResult.result?.outcome, "defeat");

const phaseKilledTargetSession = classic(
  {
    party: [unit("hero", "player", 1_000), unit("ward", "player", 1)],
    enemies: [{ ...unit("boss", "enemy", 1_000), isBoss: true }],
  },
  [
    {
      id: "kill-protected-target",
      threshold: 100,
      telegraphedAtRevision: 0,
      mechanics: [{ ...phaseMechanic, name: "Cataclysm", effectType: "damage_all", power: 2 }],
      once: true,
    },
  ],
);
phaseKilledTargetSession.objectives = [
  {
    id: "defend-phase-target",
    kind: "defend",
    label: "Protect the ward from Cataclysm",
    targetIds: ["ward"],
    requiredProgress: 1,
    progress: 1,
    status: "active",
  },
];
const phaseKilledTarget = resolveCombatSessionAction(phaseKilledTargetSession, "phase-kills-ward", {
  style: "classic",
  type: "defend",
});
assert.equal(phaseKilledTarget.canonicalState.party.find((member) => member.id === "ward")?.hp, 0);
assert.equal(
  phaseKilledTarget.objectives?.[0]?.status,
  "failed",
  "boss-phase damage must override same-action defend completion when the protected target dies",
);
assert.equal(phaseKilledTarget.result?.outcome, "defeat");

for (const mismatchedAction of [
  { style: "classic", type: "flee" },
  { style: "classic", type: "endTurn" },
  { style: "classic", type: "maneuver", instruction: "Wrong resolver" },
] as unknown as CombatAction[]) {
  assert.throws(
    () => resolveCombatSessionAction(tactical(), `wrong-style-${mismatchedAction.type}`, mismatchedAction),
    (error: unknown) => error instanceof CombatActionValidationError && /style does not match/i.test(error.message),
    `Tactical sessions must reject explicitly Classic ${mismatchedAction.type} actions`,
  );
}

const unresolvedTargetSession = classic({ enemies: [unit("guard", "enemy", 100)] });
unresolvedTargetSession.objectives = [
  {
    id: "bad-target",
    kind: "eliminate",
    label: "Defeat an unresolved target",
    targetIds: ["missing-enemy"],
    progress: 0,
    status: "active",
  },
];
const unresolvedTargetResult = resolveCombatSessionAction(unresolvedTargetSession, "unknown-target", {
  style: "classic",
  type: "defend",
});
assert.equal(
  unresolvedTargetResult.objectives?.[0]?.status,
  "active",
  "unknown objective targets must not be treated as already defeated",
);
assert.equal(unresolvedTargetResult.result, undefined);

const noEnemyObjectiveSession = tactical({
  units: [tacticalUnit("hero", "party"), tacticalUnit("enemy", "enemy", 0)],
});
noEnemyObjectiveSession.objectives = [
  { id: "capture", kind: "capture", label: "Raise the banner", requiredProgress: 1, progress: 0, status: "active" },
];
const noEnemyObjective = resolveCombatSessionAction(
  noEnemyObjectiveSession,
  "capture-after-clear",
  {
    style: "tactical",
    type: "maneuver",
    unitId: "hero",
    instruction: "Raise the banner",
    objectiveId: "capture",
  },
  objectiveProposal,
);
assert.equal(noEnemyObjective.objectives?.[0]?.status, "complete");
assert.equal(noEnemyObjective.result?.outcome, "victory");
assert.equal(
  noEnemyObjective.status,
  "active",
  "non-elimination Tactical objectives must remain actionable after the final enemy falls",
);

const conditionalSession = classic({ enemies: [{ ...unit("marked", "enemy", 1) }] });
conditionalSession.objectives = [
  {
    id: "marked-condition",
    kind: "conditional_eliminate",
    label: "Defeat the marked enemy under the stated condition",
    targetIds: ["marked"],
    condition: "Break the ward first",
    requiredProgress: 1,
    progress: 0,
    status: "active",
  },
];
const unmetCondition = resolveCombatSessionAction(conditionalSession, "conditional-kill", {
  ...attack,
  targetId: "marked",
});
assert.equal(unmetCondition.status, "active", "conditional elimination must not complete from HP alone");
assert.equal(unmetCondition.objectives?.[0]?.status, "active");

const escapeSession = classic({ enemies: [{ ...unit("guard", "enemy", 100) }] });
escapeSession.objectives = [
  { id: "escape", kind: "escape", label: "Reach the exit", requiredProgress: 1, progress: 0, status: "active" },
];
const prematureEscape = resolveCombatSessionAction(escapeSession, "escape-too-early", {
  style: "classic",
  type: "flee",
});
assert.equal(prematureEscape.status, "active", "escape objectives must reject fleeing before the exit is reached");
assert.equal(prematureEscape.canonicalState.outcome, undefined);

const deadlineSession = classic({
  party: [unit("hero", "player", 1_000)],
  enemies: [unit("guard", "enemy", 1_000)],
  round: 3,
});
deadlineSession.objectives = [
  {
    id: "interrupt-before-round-three",
    kind: "interrupt",
    label: "Interrupt the ritual",
    requiredProgress: 1,
    failAtRound: 3,
    progress: 0,
    status: "active",
  },
];
const missedDeadline = resolveCombatSessionAction(deadlineSession, "missed-deadline", {
  style: "classic",
  type: "defend",
});
assert.equal(missedDeadline.objectives?.[0]?.status, "failed", "objective deadlines must fail unmet goals");
assert.equal(missedDeadline.result?.outcome, "defeat");

const surviveDeadlineSession = classic({
  party: [unit("hero", "player", 1_000)],
  enemies: [unit("guard", "enemy", 1_000)],
  round: 3,
});
surviveDeadlineSession.objectives = [
  {
    id: "survive-three",
    kind: "survive_rounds",
    label: "Survive three rounds",
    requiredProgress: 3,
    failAtRound: 3,
    progress: 0,
    status: "active",
  },
];
const survivedAtDeadline = resolveCombatSessionAction(surviveDeadlineSession, "met-deadline", {
  style: "classic",
  type: "defend",
});
assert.equal(
  survivedAtDeadline.objectives?.[0]?.status,
  "complete",
  "an objective completed on its deadline must win before the deadline failure is applied",
);

const convertedTriggers = combatBossPhasesFromMechanics([
  { name: "Retaliate", description: "Counter after being hit", trigger: "on_hit", effectType: "damage_one" },
  { name: "Pressure", description: "Escalate after attacking", trigger: "on_attack", effectType: "damage_one" },
  { name: "Aura", description: "A persistent aura", trigger: "passive", effectType: "debuff_party" },
]);
assert.deepEqual(
  convertedTriggers.map((entry) => entry.trigger),
  ["on_hit", "on_attack", "passive"],
  "accepted event and passive mechanics must survive boss-phase conversion",
);

const onHitSession = classic(
  {
    party: [unit("hero", "player", 1_000)],
    enemies: [{ ...unit("boss", "enemy", 1_000), isBoss: true }],
  },
  [convertedTriggers[0]!],
);
const onHitTelegraph = resolveCombatSessionAction(onHitSession, "hit-boss", {
  style: "classic",
  type: "attack",
  targetId: "boss",
});
assert.equal(
  onHitTelegraph.events.some((event) => event.kind === "phase"),
  true,
  "on-hit boss mechanics must telegraph after their owner takes damage",
);

const onAttackSession = classic(
  {
    party: [unit("hero", "player", 1_000)],
    enemies: [{ ...unit("boss", "enemy", 1_000), isBoss: true }],
  },
  [convertedTriggers[1]!],
);
const onAttackTelegraph = resolveCombatSessionAction(onAttackSession, "boss-attacks", {
  style: "classic",
  type: "defend",
});
assert.equal(
  onAttackTelegraph.events.some((event) => event.kind === "phase"),
  true,
  "on-attack boss mechanics must telegraph after their owner attacks",
);

const passiveSession = classic(
  {
    party: [unit("hero", "player", 1_000)],
    enemies: [{ ...unit("boss", "enemy", 1_000), isBoss: true }],
  },
  [convertedTriggers[2]!],
);
const passiveTelegraph = resolveCombatSessionAction(passiveSession, "passive-round", {
  style: "classic",
  type: "defend",
});
assert.equal(
  passiveTelegraph.events.some((event) => event.kind === "phase"),
  true,
  "passive boss mechanics must telegraph once their first round is complete",
);

const movementSession = tactical({
  grid: { width: 4, height: 1, tiles: [["plains", "plains", "plains", "plains"]] },
  units: [
    tacticalUnit("hero", "party"),
    { ...tacticalUnit("ally", "party"), x: 1 },
    { ...tacticalUnit("enemy", "enemy"), x: 3 },
  ],
});
const movementProposal: CombatManeuverProposal = {
  outcome: "success",
  rationale: "The ally is pulled into cover.",
  difficulty: 0.05,
  effects: [{ type: "move", targetId: "ally", tile: { x: 2, y: 0 } }],
  narration: "The ally reaches the new position.",
};
const movementResult = resolveCombatSessionAction(
  movementSession,
  "move-ally",
  {
    style: "tactical",
    type: "maneuver",
    unitId: "hero",
    instruction: "Pull the ally forward",
    targetId: "ally",
    tile: { x: 2, y: 0 },
  },
  movementProposal,
);
const movementEffect = movementResult.events
  .flatMap((event) => event.effects)
  .find((effect) => effect.type === "move");
assert.equal(movementEffect?.sourceId, "hero");
assert.equal(movementEffect?.targetId, "ally", "movement history must identify the unit that actually moved");

console.log("Combat session regression passed.");
