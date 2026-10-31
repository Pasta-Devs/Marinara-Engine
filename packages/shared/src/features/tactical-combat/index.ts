// ──────────────────────────────────────────────
// Tactical Combat — public API
// ──────────────────────────────────────────────
// Curated surface consumed by the server endpoints (Phase B) and the client
// TacticalCombatUI (Phase C). Internal helpers used only by ai.ts stay in
// engine.ts and are intentionally not re-exported here.

export * from "./types.js";
export * from "./board-outline.js";
export { TACTICAL_ENVIRONMENTS, TACTICAL_TERRAINS } from "./environments.js";

export {
  createTacticalCombat,
  currentTacticalActor,
  rollTacticalInitiative,
  getUnit,
  getMovementRange,
  getTargetsInRange,
  forecastAttack,
  forecastFrom as forecastTacticalAttack,
  applyAction,
  isTerminal,
  buildTacticalSummary,
  validateTacticalUnitAction,
  normalizeEnvironment as normalizeTacticalEnvironment,
  normalizeFormation as normalizeTacticalFormation,
  performUnitAction as performTacticalUnitAction,
  tickRound as tickTacticalRound,
} from "./engine.js";
export { decideTacticalAction, runEnemyPhase, runInitiativeTurns, applyTacticalTurn } from "./ai.js";
export { decideProfileAction } from "./profile-ai.js";

export { summarizeTacticalBattlefield } from "./battlefield-summary.js";

export {
  climbCost,
  coverTier,
  deriveMovement,
  elevationAt,
  elementMultiplier,
  DIFFICULTY_DAMAGE_MULT,
  hasLineOfSight,
  inReach,
  reachFrom,
  type CoverTier,
} from "./math.js";
export { CLASS_PROFILES, deriveClass, normalizeClass, type ClassProfile } from "./classes.js";
export {
  TACTICAL_BATTLEFIELD_GENERATOR_VERSION,
  generateTacticalBattlefield,
  gridDimensions,
  madeTacticalBattlefield,
  foothillElevation,
  tacticalMadeBoardIssues,
  placeSpawns,
  defaultBattlefieldSize,
  tacticalArena,
  tacticalEngagement,
  validateTacticalBattlefieldBrief,
  salvageTacticalBattlefieldBrief,
  type GenerateTacticalBattlefieldResult,
  type TacticalBattlefieldBriefValidation,
  type TacticalPlaceable,
} from "./grid-gen.js";
export { deterministicRng } from "./rng.js";
export {
  creatureArtBox,
  creatureArtFrame,
  creatureArtVariant,
  creatureFacingToward,
  findCreatureArt,
  rulesetCombatantFlying,
  type CreatureArtFor,
} from "./creature-art.js";
