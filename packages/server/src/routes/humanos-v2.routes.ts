// ──────────────────────────────────────────────
// Routes: HumanOS v2 private architecture + committed Runtime
// ──────────────────────────────────────────────
import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { characters, messages, personas } from "../db/schema/index.js";
import {
  createHumanOSArchitectureStorage,
  type HumanOSSubjectType,
} from "../services/storage/humanos-architecture.storage.js";
import { createHumanOSRuntimeStorage } from "../services/storage/humanos-runtime.storage.js";
import { createRelationshipSavesStorage, relationshipSaveTargetKey } from "../services/storage/relationship-saves.storage.js";

const subjectTypeSchema = z.enum(["CHARACTER", "USER_PERSONA"]);
const architectureSchema = z
  .object({
    schemaVersion: z.literal(2),
    subjectType: subjectTypeSchema,
    subjectId: z.string().min(1),
    taskMode: z.enum(["CREATE", "REFINE", "MATCH", "COMPILE"]),
    layers: z.record(z.string(), z.unknown()),
    facts: z.record(z.string(), z.unknown()),
    provenanceByPath: z.record(z.string(), z.unknown()),
    retrievalPolicy: z.record(z.string(), z.unknown()),
    compiledArtifacts: z.record(z.string(), z.unknown()),
    audit: z.record(z.string(), z.unknown()),
  })
  .passthrough();

const relationshipSaveSchema = z
  .object({
    state: z.record(z.string(), z.unknown()),
    activeTruthCount: z.number().int().min(0).default(0),
    milestoneCount: z.number().int().min(0).default(0),
  })
  .strict();

async function subjectExists(app: FastifyInstance, subjectType: HumanOSSubjectType, subjectId: string) {
  if (subjectType === "CHARACTER") {
    const rows = await app.db.select({ id: characters.id }).from(characters).where(eq(characters.id, subjectId)).limit(1);
    return Boolean(rows[0]);
  }
  const rows = await app.db.select({ id: personas.id }).from(personas).where(eq(personas.id, subjectId)).limit(1);
  return Boolean(rows[0]);
}

export async function humanosV2Routes(app: FastifyInstance) {
  const architectures = createHumanOSArchitectureStorage(app.db);
  const runtime = createHumanOSRuntimeStorage(app.db);
  const relationshipSaves = createRelationshipSavesStorage(app.db);

  app.get("/architecture/:subjectType/:subjectId", async (req, reply) => {
    const params = z
      .object({ subjectType: subjectTypeSchema, subjectId: z.string().min(1) })
      .safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid subject" });
    const row = await architectures.get(params.data.subjectType, params.data.subjectId);
    if (!row) return reply.status(404).send({ error: "HumanOS architecture not found" });
    return { ...row, architecture: JSON.parse(row.architecture) as unknown };
  });

  app.put("/architecture/:subjectType/:subjectId", async (req, reply) => {
    const params = z
      .object({ subjectType: subjectTypeSchema, subjectId: z.string().min(1) })
      .safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid subject" });
    const parsed = architectureSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid HumanOS architecture", details: parsed.error.flatten() });
    if (parsed.data.subjectType !== params.data.subjectType || parsed.data.subjectId !== params.data.subjectId) {
      return reply.status(409).send({ error: "Architecture subject does not match route subject" });
    }
    if (!(await subjectExists(app, params.data.subjectType, params.data.subjectId))) {
      return reply.status(404).send({ error: "Subject not found" });
    }
    const conflicted = Object.values(parsed.data.provenanceByPath).some(
      (value) => typeof value === "object" && value !== null && (value as { status?: unknown }).status === "CONFLICTED",
    );
    const row = await architectures.upsert({
      subjectType: params.data.subjectType,
      subjectId: params.data.subjectId,
      schemaVersion: 2,
      architecture: JSON.stringify(parsed.data),
    });
    return { ...row, architecture: parsed.data, compilationBlocked: conflicted };
  });

  app.delete("/architecture/:subjectType/:subjectId", async (req, reply) => {
    const params = z
      .object({ subjectType: subjectTypeSchema, subjectId: z.string().min(1) })
      .safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid subject" });
    await architectures.remove(params.data.subjectType, params.data.subjectId);
    return reply.status(204).send();
  });

  app.get("/runtime/:chatId", async (req, reply) => {
    const params = z.object({ chatId: z.string().min(1) }).safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid chat" });
    const row = await runtime.getLatestCommitted(params.data.chatId);
    if (!row) return reply.status(404).send({ error: "HumanOS Runtime not found" });
    return { ...row, state: JSON.parse(row.state) as unknown };
  });

  // Runtime commits are agent-authored, post-canonical writes. The public HTTP
  // surface cannot supply their canonical coordinates or canonical-tool
  // authority. Keep reads public, but fail closed until a distinct manual-write
  // flow has explicit server-owned authority records.
  app.put("/runtime/:chatId", async (_req, reply) => {
    return reply.status(403).send({
      error: "HUMANOS_RUNTIME_SERVER_AUTHORITY_REQUIRED",
    });
  });

  app.get("/relationship-save/:chatId/:characterId/:personaId", async (req, reply) => {
    const params = z
      .object({ chatId: z.string().min(1), characterId: z.string().min(1), personaId: z.string().min(1) })
      .safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid relationship save identity" });
    const row = await relationshipSaves.get(params.data.chatId, params.data.characterId, params.data.personaId);
    if (!row) return reply.status(404).send({ error: "Relationship Save not found" });
    return { ...row, state: JSON.parse(row.state) as unknown };
  });

  app.put("/relationship-save/:chatId/:characterId/:personaId", async (req, reply) => {
    const params = z
      .object({ chatId: z.string().min(1), characterId: z.string().min(1), personaId: z.string().min(1) })
      .safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid relationship save identity" });
    const parsed = relationshipSaveSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid Relationship Save payload", details: parsed.error.flatten() });
    const anchors = await app.db
      .select({ id: messages.id, content: messages.content, activeSwipeIndex: messages.activeSwipeIndex })
      .from(messages)
      .where(
        and(
          eq(messages.chatId, params.data.chatId),
          eq(messages.role, "assistant"),
          eq(messages.publicationStatus, "canonical"),
        ),
      )
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(1);
    const anchor = anchors[0];
    if (!anchor) return reply.status(409).send({ error: "RELATIONSHIP_SAVE_CANONICAL_EVIDENCE_UNAVAILABLE" });

    const current = await relationshipSaves.get(params.data.chatId, params.data.characterId, params.data.personaId);
    const state = JSON.stringify(parsed.data.state);
    const evidenceContentHash = createHash("sha256").update(anchor.content).digest("hex");
    const idempotencyKey = createHash("sha256")
      .update(
        JSON.stringify({
          schemaVersion: 1,
          target: [params.data.chatId, params.data.characterId, params.data.personaId],
          logicalPatchSlot: "relationship-save:manual",
          state: parsed.data.state,
          activeTruthCount: parsed.data.activeTruthCount,
          milestoneCount: parsed.data.milestoneCount,
          evidenceMessageId: anchor.id,
          evidenceSwipeIndex: anchor.activeSwipeIndex,
          evidenceContentHash,
          actorType: "user",
          actorId: "local-user",
          authorityPath: "manual_edit",
        }),
      )
      .digest("hex");
    const targetKey = relationshipSaveTargetKey(params.data.chatId, params.data.characterId, params.data.personaId);
    const committedBaseRevision = await relationshipSaves.getCommittedBaseRevision(idempotencyKey);
    const result = await relationshipSaves.commit({
      chatId: params.data.chatId,
      characterId: params.data.characterId,
      personaId: params.data.personaId,
      state,
      activeTruthCount: parsed.data.activeTruthCount,
      milestoneCount: parsed.data.milestoneCount,
      baseRevision: committedBaseRevision ?? current?.revision ?? 0,
      evidenceMessageId: anchor.id,
      evidenceSwipeIndex: anchor.activeSwipeIndex,
      evidenceContentHash,
      actorType: "user",
      actorId: "local-user",
      authorityPath: "manual_edit",
      explicitAuthority: {
        actorType: "user",
        actorId: "local-user",
        authorityPath: "manual_edit",
        targetKey,
        reason: "Manual Relationship Save update",
        issuedBy: "humanos-v2-http",
        authorizationKey: idempotencyKey,
      },
      idempotencyKey,
    });
    if (result.status === "revision_conflict") {
      return reply.status(409).send({
        error: "RELATIONSHIP_SAVE_REVISION_CONFLICT",
        expectedRevision: result.expectedRevision,
        currentRevision: result.currentRevision,
      });
    }
    if (result.status === "idempotency_conflict") return reply.status(409).send({ error: "RELATIONSHIP_SAVE_IDEMPOTENCY_CONFLICT" });
    const persisted = await relationshipSaves.get(params.data.chatId, params.data.characterId, params.data.personaId);
    if (!persisted) {
      throw new Error("Relationship Save projection missing after successful commit");
    }
    return {
      ...persisted,
      state: JSON.parse(persisted.state) as unknown,
      idempotentReplay: result.status === "replayed",
    };
  });

  app.get("/relationship-save/:chatId/:characterId/:personaId/checkpoints", async (req, reply) => {
    const params = z
      .object({ chatId: z.string().min(1), characterId: z.string().min(1), personaId: z.string().min(1) })
      .safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid relationship save identity" });
    const rows = await relationshipSaves.listCheckpoints(params.data.chatId, params.data.characterId, params.data.personaId);
    return rows.map((row) => ({
      ...row,
      activeState: JSON.parse(row.activeState) as unknown,
      classifications: JSON.parse(row.classifications) as unknown,
      sourceCommitIds: JSON.parse(row.sourceCommitIds) as unknown,
      messageHashes: JSON.parse(row.messageHashes) as unknown,
    }));
  });

  app.post("/relationship-save/:chatId/:characterId/:personaId/checkpoint", async (_req, reply) => {
    return reply.status(403).send({
      error: "RELATIONSHIP_CHECKPOINT_SERVER_AUTHORITY_REQUIRED",
    });
  });
}
