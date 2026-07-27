import type { CombatItemEffect, CombatMechanic, CombatReinforcement } from "./combat-encounter.js";
import type {
  CombatPlayerAction,
  CombatRoundResult,
  CombatStatusEffect,
  CombatSummary,
  GameCombatStateSnapshot,
  GameCombatStyle,
} from "./game.js";
import type {
  TacticalAction,
  TacticalCombatState,
  TacticalCoord,
  TacticalTerrain,
} from "../features/tactical-combat/types.js";

export type CombatStyle = GameCombatStyle;
export type CombatSessionStatus = "active" | "completed" | "abandoned";

export type ClassicCombatState = GameCombatStateSnapshot;
export type CombatState = ClassicCombatState | TacticalCombatState;

export type ClassicAction = CombatPlayerAction & { style: "classic" };
export type TacticalCombatAction = TacticalAction & { style: "tactical" };

export interface ManeuverAction {
  type: "maneuver";
  maneuver: CombatManeuverInput;
}

export interface EndTurnAction {
  type: "endTurn";
}

export interface FleeAction {
  type: "flee";
}

export type CombatAction = ClassicAction | TacticalCombatAction | ManeuverAction | EndTurnAction | FleeAction;

export interface CombatSessionBase<Style extends CombatStyle, State extends CombatState> {
  sessionId: string;
  chatId: string;
  style: Style;
  schemaVersion: number;
  revision: number;
  status: CombatSessionStatus;
  seed: number;
  rngCursor: number;
  lastActionId: string | null;
  canonicalState: State;
  objectives: CombatObjectiveState[];
  bossPhases: CombatBossPhase[];
  actionHistory?: CombatActionRecord[];
  createdAt: string;
  updatedAt: string;
}

export type ClassicCombatSession = CombatSessionBase<"classic", ClassicCombatState>;
export type TacticalCombatSession = CombatSessionBase<"tactical", TacticalCombatState>;
export type CombatSession = ClassicCombatSession | TacticalCombatSession;

export interface CombatActionRequest {
  sessionId: string;
  expectedRevision: number;
  actionId: string;
  action: CombatAction;
}

export interface CombatStateViewBase<Style extends CombatStyle, State extends CombatState> {
  sessionId: string;
  chatId: string;
  style: Style;
  schemaVersion: number;
  revision: number;
  status: CombatSessionStatus;
  canonicalState: State;
  objectives: CombatObjectiveState[];
  bossPhases: CombatBossPhase[];
  /** Latest terminal result, retained for refresh-safe aftermath recovery. */
  result?: CombatSummary;
}

export type ClassicCombatStateView = CombatStateViewBase<"classic", ClassicCombatState>;
export type TacticalCombatStateView = CombatStateViewBase<"tactical", TacticalCombatState>;
export type CombatStateView = ClassicCombatStateView | TacticalCombatStateView;

export interface CombatActionRecord {
  actionId: string;
  revision: number;
  action: CombatAction;
  response: CombatActionResponse;
  createdAt: string;
}

export interface CombatActionResponse {
  sessionId: string;
  revision: number;
  actionId: string;
  state: CombatStateView;
  events: CombatEvent[];
  result?: CombatSummary;
  classicRoundResult?: CombatRoundResult;
}

export type CombatEffect =
  | { type: "damage"; sourceId: string; targetId: string; amount: number; element?: string }
  | { type: "heal"; sourceId: string; targetId: string; amount: number }
  | { type: "status"; sourceId: string; targetId: string; status: CombatStatusEffect }
  | { type: "move"; sourceId: string; targetId: string; to: TacticalCoord }
  | { type: "cover"; tile: TacticalCoord; amount: number; duration: number }
  | { type: "terrain"; tile: TacticalCoord; terrain: TacticalTerrain; duration?: number }
  | { type: "objective"; objectiveId: string; progress: number; reason: string }
  | { type: "phase"; phaseId: string };

export interface CombatEvent {
  eventId: string;
  actionId: string;
  kind: string;
  actorId?: string;
  targetId?: string;
  text: string;
  effects: CombatEffect[];
  amount?: number;
  to?: TacticalCoord;
  skillName?: string;
  element?: string;
  statusName?: string;
  roll?: { kind: string; value: number; cursor: number };
}

export type CombatObjectiveKind =
  | "eliminate"
  | "survive_rounds"
  | "escape"
  | "defend"
  | "escort"
  | "capture"
  | "interrupt"
  | "conditional_eliminate";

export interface CombatObjectiveDefinition {
  id: string;
  kind: CombatObjectiveKind;
  label: string;
  targetIds?: string[];
  tileIds?: string[];
  includeReinforcements?: boolean;
  requiredProgress?: number;
  failAtRound?: number;
  condition?: string;
}

export interface CombatObjectiveState extends CombatObjectiveDefinition {
  progress: number;
  status: "active" | "complete" | "failed";
}

export interface CombatBossPhase {
  id: string;
  ownerName?: string;
  /** Original mechanic trigger when this phase is derived from an encounter mechanic. */
  trigger?: CombatMechanic["trigger"];
  threshold?: number;
  round?: number;
  telegraph?: string;
  mechanics: CombatMechanic[];
  reinforcements?: CombatReinforcement[];
  dialogueCueIds?: string[];
  once?: boolean;
  /** Revision where the latest warning was emitted. Effects resolve on a later action. */
  telegraphedAtRevision?: number;
  /** Completed round that most recently armed a recurring round phase. */
  lastTriggeredRound?: number;
  triggeredAtRevision?: number;
}

export interface CombatManeuverInput {
  actorId: string;
  instruction: string;
  targetId?: string;
  tile?: TacticalCoord;
  terrainObjectId?: string;
  objectiveId?: string;
}

export type CombatManeuverOutcome = "success" | "partial" | "failure";

export interface CombatManeuverProposalEffect {
  type: Exclude<CombatEffect["type"], "phase">;
  targetId?: string;
  tile?: TacticalCoord;
  amount?: number;
  status?: CombatStatusEffect;
  objectiveId?: string;
  terrain?: TacticalTerrain;
}

export interface CombatManeuverProposal {
  outcome: CombatManeuverOutcome;
  rationale: string;
  difficulty: number;
  effects: CombatManeuverProposalEffect[];
  narration: string;
}

export interface CombatError {
  error: string;
  code:
    | "COMBAT_NOT_FOUND"
    | "COMBAT_WRONG_CHAT"
    | "COMBAT_WRONG_STYLE"
    | "COMBAT_COMPLETED"
    | "STALE_REVISION"
    | "DUPLICATE_ACTION"
    | "INVALID_ACTION"
    | "INVALID_MANEUVER"
    | "COMBAT_SNAPSHOT_INVALID";
  currentRevision?: number;
  sessionId?: string;
}

export interface CombatSessionStartInputBase<Style extends CombatStyle, State extends CombatState> {
  chatId: string;
  style: Style;
  state: State;
  objectives?: CombatObjectiveState[];
  seed?: number;
  bossPhases?: CombatBossPhase[];
  itemEffects?: CombatItemEffect[];
}

export type CombatSessionStartInput =
  | CombatSessionStartInputBase<"classic", ClassicCombatState>
  | CombatSessionStartInputBase<"tactical", TacticalCombatState>;
