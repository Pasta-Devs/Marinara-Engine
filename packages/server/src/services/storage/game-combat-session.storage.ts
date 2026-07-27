import type {
  CombatActionRequest,
  CombatActionResponse,
  CombatActionRecord,
  CombatBossPhase,
  ClassicCombatState,
  CombatEvent,
  CombatObjectiveState,
  CombatRoundResult,
  CombatSession,
  CombatSessionStartInput,
  CombatSessionStatus,
  CombatState,
  CombatStateView,
  CombatSummary,
  TacticalCombatState,
} from "@marinara-engine/shared";
import { randomInt } from "crypto";
import { and, desc, eq } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { gameCombatSessions } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

const MAX_ACTION_HISTORY = 200;

type CombatSessionRow = typeof gameCombatSessions.$inferSelect;

export class CombatSessionStorageError extends Error {
  constructor(
    message: string,
    readonly code:
      | "COMBAT_NOT_FOUND"
      | "COMBAT_WRONG_CHAT"
      | "COMBAT_COMPLETED"
      | "STALE_REVISION"
      | "INVALID_ACTION"
      | "COMBAT_SNAPSHOT_INVALID",
    readonly statusCode: number,
    readonly currentRevision?: number,
    readonly currentState?: CombatStateView,
  ) {
    super(message);
    this.name = "CombatSessionStorageError";
  }
}

export interface CombatActionResolution {
  canonicalState: CombatState;
  objectives?: CombatObjectiveState[];
  bossPhases?: CombatBossPhase[];
  rngCursor: number;
  status?: CombatSessionStatus;
  events: CombatEvent[];
  result?: CombatSummary;
  classicRoundResult?: CombatRoundResult;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function initialObjectives(input: CombatSessionStartInput): CombatObjectiveState[] {
  if (input.objectives?.length) return input.objectives.map((objective) => ({ ...objective }));
  const targetIds =
    input.style === "tactical"
      ? input.state.units.filter((unit) => unit.side === "enemy").map((unit) => unit.id)
      : input.state.enemies.map((enemy) => enemy.id);
  return [
    {
      id: "eliminate-enemies",
      kind: "eliminate",
      label: "Defeat all enemies",
      targetIds,
      includeReinforcements: true,
      progress: 0,
      status: "active",
    },
  ];
}

function stateView(session: CombatSession): CombatStateView {
  const result = session.actionHistory?.at(-1)?.response.result;
  if (session.style === "tactical") {
    return {
      sessionId: session.sessionId,
      chatId: session.chatId,
      style: "tactical",
      schemaVersion: session.schemaVersion,
      revision: session.revision,
      status: session.status,
      canonicalState: session.canonicalState,
      objectives: session.objectives,
      bossPhases: session.bossPhases,
      ...(result ? { result } : {}),
    };
  }
  return {
    sessionId: session.sessionId,
    chatId: session.chatId,
    style: "classic",
    schemaVersion: session.schemaVersion,
    revision: session.revision,
    status: session.status,
    canonicalState: session.canonicalState,
    objectives: session.objectives,
    bossPhases: session.bossPhases,
    ...(result ? { result } : {}),
  };
}

function rowToSession(row: CombatSessionRow): CombatSession {
  const base = {
    sessionId: row.sessionId,
    chatId: row.chatId,
    schemaVersion: row.schemaVersion,
    revision: row.revision,
    status: row.status,
    seed: row.seed >>> 0,
    rngCursor: row.rngCursor,
    lastActionId: row.lastActionId,
    objectives: parseJson<CombatObjectiveState[]>(row.objectives, []),
    bossPhases: parseJson<CombatBossPhase[]>(row.bossPhases, []),
    actionHistory: parseJson<CombatActionRecord[]>(row.actionHistory, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  if (row.style === "tactical") {
    return {
      ...base,
      style: "tactical",
      canonicalState: parseJson<TacticalCombatState>(row.state, {} as TacticalCombatState),
    };
  }
  return {
    ...base,
    style: "classic",
    canonicalState: parseJson<ClassicCombatState>(row.state, {} as ClassicCombatState),
  };
}

async function selectById(db: DB, sessionId: string) {
  const rows = await db.select().from(gameCombatSessions).where(eq(gameCombatSessions.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

export function createGameCombatSessionStorage(db: DB) {
  return {
    async create(input: CombatSessionStartInput) {
      const unitIds = new Set(
        ("units" in input.state ? input.state.units : [...input.state.party, ...input.state.enemies]).map(
          (unit) => unit.id,
        ),
      );
      const unknownTarget = input.objectives
        ?.flatMap((objective) => objective.targetIds ?? [])
        .find((targetId) => !unitIds.has(targetId));
      if (unknownTarget) {
        throw new CombatSessionStorageError(
          `Combat objective target ${unknownTarget} is not present in the encounter`,
          "COMBAT_SNAPSHOT_INVALID",
          400,
        );
      }
      const timestamp = now();
      const abandonedTimestamp = new Date(Date.parse(timestamp) - 1).toISOString();
      const sessionId = newId();
      const seed = (input.seed ?? randomInt(0, 0x1_0000_0000)) >>> 0;
      const objectives = initialObjectives(input);
      await db.transaction(async (tx) => {
        await tx
          .update(gameCombatSessions)
          .set({ status: "abandoned", updatedAt: abandonedTimestamp })
          .where(and(eq(gameCombatSessions.chatId, input.chatId), eq(gameCombatSessions.status, "active")));
        await tx.insert(gameCombatSessions).values({
          sessionId,
          chatId: input.chatId,
          style: input.style,
          schemaVersion: 1,
          state: JSON.stringify(input.state),
          objectives: JSON.stringify(objectives),
          bossPhases: JSON.stringify(input.bossPhases ?? []),
          seed,
          rngCursor: "actionCounter" in input.state ? input.state.actionCounter : 0,
          revision: 0,
          lastActionId: null,
          status: "active",
          actionHistory: "[]",
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      });
      const row = await selectById(db, sessionId);
      if (!row) throw new CombatSessionStorageError("Combat session was not created", "COMBAT_NOT_FOUND", 500);
      return rowToSession(row);
    },

    async get(sessionId: string) {
      const row = await selectById(db, sessionId);
      return row ? rowToSession(row) : null;
    },

    async getActiveForChat(chatId: string) {
      const rows = await db
        .select()
        .from(gameCombatSessions)
        .where(and(eq(gameCombatSessions.chatId, chatId), eq(gameCombatSessions.status, "active")))
        .orderBy(desc(gameCombatSessions.updatedAt))
        .limit(1);
      return rows[0] ? rowToSession(rows[0]) : null;
    },

    async getLatestForChat(chatId: string) {
      const rows = await db
        .select()
        .from(gameCombatSessions)
        .where(eq(gameCombatSessions.chatId, chatId))
        .orderBy(desc(gameCombatSessions.updatedAt))
        .limit(1);
      return rows[0] ? rowToSession(rows[0]) : null;
    },

    async importLegacySnapshot(input: CombatSessionStartInput) {
      const existing = await this.getActiveForChat(input.chatId);
      if (existing) return existing;
      return this.create(input);
    },

    async applyAction(
      chatId: string,
      request: CombatActionRequest,
      resolve: (session: CombatSession) => CombatActionResolution | Promise<CombatActionResolution>,
    ): Promise<{ response: CombatActionResponse; duplicate: boolean }> {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(gameCombatSessions)
          .where(eq(gameCombatSessions.sessionId, request.sessionId))
          .limit(1);
        const row = rows[0];
        if (!row) throw new CombatSessionStorageError("Combat session not found", "COMBAT_NOT_FOUND", 404);
        const session = rowToSession(row);
        if (session.chatId !== chatId) {
          throw new CombatSessionStorageError("Combat session does not belong to this chat", "COMBAT_WRONG_CHAT", 403);
        }
        const duplicate = session.actionHistory?.find((record) => record.actionId === request.actionId);
        if (duplicate) return { response: duplicate.response, duplicate: true };
        if (session.status !== "active") {
          throw new CombatSessionStorageError(
            "Combat session is no longer active",
            "COMBAT_COMPLETED",
            409,
            session.revision,
            stateView(session),
          );
        }
        if (session.revision !== request.expectedRevision) {
          throw new CombatSessionStorageError(
            "Combat state changed; refresh before acting again",
            "STALE_REVISION",
            409,
            session.revision,
            stateView(session),
          );
        }

        const resolved = await resolve(session);
        const revision = session.revision + 1;
        const updatedAt = now();
        const nextSession = {
          ...session,
          revision,
          status: resolved.status ?? session.status,
          rngCursor: resolved.rngCursor,
          lastActionId: request.actionId,
          canonicalState: resolved.canonicalState,
          objectives: resolved.objectives ?? session.objectives,
          bossPhases: resolved.bossPhases ?? session.bossPhases,
          updatedAt,
        } as CombatSession;
        const response: CombatActionResponse = {
          sessionId: session.sessionId,
          revision,
          actionId: request.actionId,
          state: stateView(nextSession),
          events: resolved.events,
          ...(resolved.result ? { result: resolved.result } : {}),
          ...(resolved.classicRoundResult ? { classicRoundResult: resolved.classicRoundResult } : {}),
        };
        const actionHistory = [
          ...(session.actionHistory ?? []),
          { actionId: request.actionId, revision, action: request.action, response, createdAt: updatedAt },
        ].slice(-MAX_ACTION_HISTORY);

        await tx
          .update(gameCombatSessions)
          .set({
            state: JSON.stringify(resolved.canonicalState),
            objectives: JSON.stringify(resolved.objectives ?? session.objectives),
            bossPhases: JSON.stringify(resolved.bossPhases ?? session.bossPhases),
            rngCursor: resolved.rngCursor,
            revision,
            lastActionId: request.actionId,
            status: resolved.status ?? session.status,
            actionHistory: JSON.stringify(actionHistory),
            updatedAt,
          })
          .where(eq(gameCombatSessions.sessionId, request.sessionId));

        return { response, duplicate: false };
      });
    },

    async complete(sessionId: string) {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(gameCombatSessions)
          .where(eq(gameCombatSessions.sessionId, sessionId))
          .limit(1);
        const row = rows[0];
        if (!row) return null;
        const session = rowToSession(row);
        if (session.status !== "active") return session;
        if (!session.canonicalState.outcome) {
          throw new CombatSessionStorageError(
            "Combat session cannot be completed before it reaches an outcome",
            "INVALID_ACTION",
            409,
            session.revision,
            stateView(session),
          );
        }

        await tx
          .update(gameCombatSessions)
          .set({ status: "completed", updatedAt: now() })
          .where(and(eq(gameCombatSessions.sessionId, sessionId), eq(gameCombatSessions.status, "active")));
        const completedRows = await tx
          .select()
          .from(gameCombatSessions)
          .where(eq(gameCombatSessions.sessionId, sessionId))
          .limit(1);
        return completedRows[0] ? rowToSession(completedRows[0]) : null;
      });
    },

    async abandonForChat(chatId: string) {
      await db
        .update(gameCombatSessions)
        .set({ status: "abandoned", updatedAt: now() })
        .where(and(eq(gameCombatSessions.chatId, chatId), eq(gameCombatSessions.status, "active")));
    },

    async deleteForChat(chatId: string) {
      await db.delete(gameCombatSessions).where(eq(gameCombatSessions.chatId, chatId));
    },
  };
}
