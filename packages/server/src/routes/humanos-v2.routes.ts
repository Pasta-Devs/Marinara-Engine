// ──────────────────────────────────────────────
// Routes: HumanOS v2 private architecture + committed Runtime
// ──────────────────────────────────────────────
import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { characters, messages, personas } from "../db/schema/index.js";
import {
  createHumanOSArchitectureStorage,
  type HumanOSSubjectType,
} from "../services/storage/humanos-architecture.storage.js";
import { createHumanOSRuntimeStorage } from "../services/storage/humanos-runtime.storage.js";

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

const runtimeSchema = z.object({
  messageId: z.string().min(1),
  swipeIndex: z.number().int().min(0),
  committed: z.literal(true),
  state: z.record(z.string(), z.unknown()),
});

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

  app.put("/runtime/:chatId", async (req, reply) => {
    const params = z.object({ chatId: z.string().min(1) }).safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid chat" });
    const parsed = runtimeSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid HumanOS Runtime", details: parsed.error.flatten() });
    const anchors = await app.db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        activeSwipeIndex: messages.activeSwipeIndex,
      })
      .from(messages)
      .where(and(eq(messages.id, parsed.data.messageId), eq(messages.chatId, params.data.chatId)))
      .limit(1);
    const anchor = anchors[0];
    if (!anchor) return reply.status(404).send({ error: "Anchor message not found in chat" });
    if (anchor.role !== "assistant") {
      return reply.status(409).send({ error: "Runtime anchor is not an assistant message" });
    }
    if (anchor.activeSwipeIndex !== parsed.data.swipeIndex) {
      return reply.status(409).send({
        error: "Runtime anchor is not the selected canonical swipe",
        activeSwipeIndex: anchor.activeSwipeIndex,
      });
    }
    const latest = await runtime.getLatestCommitted(params.data.chatId);
    const baseRevision = latest?.revision ?? 0;
    const state = JSON.stringify(parsed.data.state);
    const sourceContentHash = createHash("sha256").update(anchor.content).digest("hex");
    const turnId = `manual:${anchor.id}:${anchor.activeSwipeIndex}:${sourceContentHash}`;
    const idempotencyKey = createHash("sha256")
      .update(`${turnId}:humanos-runtime:${state}`)
      .digest("hex");
    const result = await runtime.commit({
      chatId: params.data.chatId,
      messageId: parsed.data.messageId,
      swipeIndex: parsed.data.swipeIndex,
      state,
      baseRevision,
      turnId,
      sourceContentHash,
      patchType: "humanos-runtime",
      idempotencyKey,
    });
    if (result.status === "revision_conflict") {
      return reply.status(409).send({
        error: "HUMANOS_V2_RUNTIME_REVISION_CONFLICT",
        expectedRevision: result.expectedRevision,
        currentRevision: result.currentRevision,
      });
    }
    if (result.status === "idempotency_conflict") {
      return reply.status(409).send({ error: "HUMANOS_V2_IDEMPOTENCY_CONFLICT" });
    }
    return { ...result.row, state: parsed.data.state, idempotentReplay: result.status === "replayed" };
  });
}
