// ──────────────────────────────────────────────
// Routes: Professor Mari Workspace Agent
// ──────────────────────────────────────────────
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { isSseReplyWritable, sendSseEvent, startSseKeepalive, startSseReply } from "./generate/sse.js";
import { getProfessorMariWorkspaceService } from "../services/professor-mari/workspace-agent.service.js";
import { getProfessorMariWorkspaceSkillsService } from "../services/professor-mari/workspace-skills.service.js";
import { getMariDbService } from "../services/mari-db/mari-db.service.js";
import { renderMariEditPrompt } from "../services/professor-mari/workspace-edit-render.js";
import { logger } from "../lib/logger.js";
import { personalServerExtensionRuntime } from "../services/extensions/personal-server-extension-runtime.js";
import {
  createMariInstructionsStorage,
  MAX_INSTRUCTION_CONTENT_LENGTH,
  MAX_INSTRUCTION_DESCRIPTION_LENGTH,
  MAX_INSTRUCTION_NAME_LENGTH,
} from "../services/storage/mari-instructions.storage.js";
import {
  createMariWorkspaceContextStorage,
  MAX_CONTEXT_ITEM_CONTENT_LENGTH,
  MAX_CONTEXT_LABEL_LENGTH,
} from "../services/storage/mari-workspace-context.storage.js";

const promptSchema = z.object({
  chatId: z.string().min(1),
  message: z.string().min(1),
  connectionId: z.string().optional().nullable(),
  debugMode: z.boolean().optional().default(false),
  existingUserMessageId: z.string().min(1).optional(),
  attachments: z
    .array(
      z.object({
        type: z.string().min(1),
        data: z.string().min(1),
        name: z.string().optional(),
        filename: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
});

const resetSchema = z.object({
  clearHistory: z.boolean().optional(),
});

// #5073: attached workspace context (chat-history slices). content is the already-serialized JSON;
// the client builds it from the chat-history picker and estimates the token cost.
const contextCreateSchema = z.object({
  chatId: z.string().min(1),
  kind: z.literal("chat_history").optional(),
  label: z.string().min(1).max(MAX_CONTEXT_LABEL_LENGTH),
  sourceChatId: z.string().optional().nullable(),
  content: z.string().min(1).max(MAX_CONTEXT_ITEM_CONTENT_LENGTH),
  tokenEstimate: z.number().int().nonnegative().optional(),
});

const cliSchema = z.object({
  argv: z.array(z.string()).default([]),
  command: z.string().optional(),
  cwd: z.string().optional(),
  sessionId: z.string().optional(),
});

const skillCreateSchema = z.object({
  name: z.string().max(64).optional().nullable(),
  description: z.string().max(1024).optional().nullable(),
  fileName: z.string().max(240).optional().nullable(),
  content: z.string().min(1).max(200_000),
  enabled: z.boolean().optional(),
});

const skillUpdateSchema = z.object({
  name: z.string().max(64).optional().nullable(),
  description: z.string().max(1024).optional().nullable(),
  content: z.string().max(200_000).optional().nullable(),
  enabled: z.boolean().optional(),
});

// #4851: memories are edited directly by the user in the Memories panel (the user is
// the reviewer of their own memory), so these routes deliberately do NOT call
// workspaceService.reset(); a reset aborts Mari's in-flight turn, and the memory
// injection is re-read live per turn, so no agent rebuild is needed.
const instructionCreateSchema = z.object({
  name: z.string().min(1).max(MAX_INSTRUCTION_NAME_LENGTH),
  description: z.string().max(MAX_INSTRUCTION_DESCRIPTION_LENGTH).optional().default(""),
  content: z.string().min(1).max(MAX_INSTRUCTION_CONTENT_LENGTH),
  persistent: z.boolean().optional().default(false),
  enabled: z.boolean().optional().default(false),
});

const instructionUpdateSchema = z.object({
  name: z.string().min(1).max(MAX_INSTRUCTION_NAME_LENGTH).optional(),
  description: z.string().max(MAX_INSTRUCTION_DESCRIPTION_LENGTH).optional(),
  content: z.string().min(1).max(MAX_INSTRUCTION_CONTENT_LENGTH).optional(),
  persistent: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

const approveSchema = z.object({
  enable: z.boolean().optional(),
});

// #4931: per-row reject. Each row is the diffPreview index plus a {table,id,action} consistency
// tuple the server re-checks against plan.changes[index] before reverting.
const rejectRowRowSchema = z.object({
  index: z.number().int().nonnegative(),
  table: z.string().min(1),
  id: z.string().min(1),
  action: z.enum(["insert", "update", "replace", "delete"]),
});

const rejectRowsSchema = z.object({
  rows: z.array(rejectRowRowSchema).min(1),
});

// #4931: synthetic Peek-Prompt render of one reviewed character/preset row (same identity tuple).
const renderPromptSchema = rejectRowRowSchema;

function privileged(request: FastifyRequest, reply: FastifyReply, loopbackOnly = false) {
  return requirePrivilegedAccess(request, reply, {
    loopbackOnly,
    feature: "Professor Mari workspace",
  });
}

export async function professorMariWorkspaceRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { connectionId?: string } }>("/status", async (req, reply) => {
    if (!privileged(req, reply)) return;
    return getProfessorMariWorkspaceService(app).status(req.query.connectionId ?? null);
  });

  app.post("/abort", async (req, reply) => {
    if (!privileged(req, reply)) return;
    await getProfessorMariWorkspaceService(app).abort();
    return { ok: true };
  });

  app.post("/reset", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const input = resetSchema.parse(req.body ?? {});
    await getProfessorMariWorkspaceService(app).reset({ clearHistory: input.clearHistory === true });
    return { ok: true };
  });

  app.get("/skills", async (req, reply) => {
    if (!privileged(req, reply)) return;
    return getProfessorMariWorkspaceSkillsService().list();
  });

  app.post("/skills", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const input = skillCreateSchema.parse(req.body);
    const skill = await getProfessorMariWorkspaceSkillsService().create(input);
    await getProfessorMariWorkspaceService(app).reset();
    return { ok: true, skill };
  });

  app.put<{ Params: { id: string } }>("/skills/:id", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const input = skillUpdateSchema.parse(req.body);
    const skill = await getProfessorMariWorkspaceSkillsService().update(req.params.id, input);
    await getProfessorMariWorkspaceService(app).reset();
    return { ok: true, skill };
  });

  app.delete<{ Params: { id: string } }>("/skills/:id", async (req, reply) => {
    if (!privileged(req, reply)) return;
    await getProfessorMariWorkspaceSkillsService().delete(req.params.id);
    await getProfessorMariWorkspaceService(app).reset();
    return { ok: true };
  });

  // #4851: Memories management panel. Direct, reset-free writes (see instructionCreateSchema note).
  app.get("/instructions", async (req, reply) => {
    if (!privileged(req, reply)) return;
    return { instructions: await createMariInstructionsStorage(app.db).list() };
  });

  app.post("/instructions", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const input = instructionCreateSchema.parse(req.body);
    const instruction = await createMariInstructionsStorage(app.db).create(input);
    return { ok: true, instruction };
  });

  app.put<{ Params: { id: string } }>("/instructions/:id", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const input = instructionUpdateSchema.parse(req.body);
    const instruction = await createMariInstructionsStorage(app.db).update(req.params.id, input);
    if (!instruction) return reply.status(404).send({ error: "Memory not found" });
    return { ok: true, instruction };
  });

  app.delete<{ Params: { id: string } }>("/instructions/:id", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const removed = await createMariInstructionsStorage(app.db).remove(req.params.id);
    if (!removed) return reply.status(404).send({ error: "Memory not found" });
    return { ok: true };
  });

  // #5073: attached workspace context (chat-history slices). Direct user-managed writes (the user is
  // the reviewer of their own attached context) — the Context Viewer + chat-history picker back these.
  app.get<{ Querystring: { chatId?: string } }>("/context", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const chatId = (req.query.chatId ?? "").trim();
    if (!chatId) return reply.status(400).send({ error: "chatId is required" });
    return { context: await createMariWorkspaceContextStorage(app.db).listForChat(chatId) };
  });

  app.post("/context", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const input = contextCreateSchema.parse(req.body);
    const item = await createMariWorkspaceContextStorage(app.db).create(input);
    return { ok: true, item };
  });

  app.delete<{ Params: { id: string }; Querystring: { chatId?: string } }>("/context/:id", async (req, reply) => {
    if (!privileged(req, reply)) return;
    // Optional chatId (same convention as GET /context) keeps the lazy store from
    // loading the whole table for a bare-id delete. The typeof guard also covers a
    // repeated query param, which Fastify hands over as an array.
    const chatIdRaw = req.query.chatId;
    const chatId = typeof chatIdRaw === "string" ? chatIdRaw.trim() : "";
    const removed = await createMariWorkspaceContextStorage(app.db).remove(req.params.id, chatId || undefined);
    if (!removed) return reply.status(404).send({ error: "Attached context not found" });
    return { ok: true };
  });

  app.post("/prompt", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const body = promptSchema.parse(req.body);
    const service = getProfessorMariWorkspaceService(app);
    startSseReply(reply, { "X-Accel-Buffering": "no" });
    reply.raw.flushHeaders?.();
    const stopSseKeepalive = startSseKeepalive(reply);

    let complete = false;
    let clientDisconnected = false;
    const onClose = () => {
      if (complete) return;
      // Passive disconnect (backgrounded tab, switched view): let the run finish
      // and persist so the user sees the result and any pending approvals when
      // they return. Intentional stops go through POST /abort, not this path.
      clientDisconnected = true;
    };
    reply.raw.on("close", onClose);

    const send = (event: Parameters<typeof sendSseEvent>[1]) => {
      if (!clientDisconnected && isSseReplyWritable(reply)) sendSseEvent(reply, event);
    };

    try {
      send({ type: "metadata", data: { phase: "starting" } });
      await service.prompt({
        chatId: body.chatId,
        text: body.message,
        connectionId: body.connectionId ?? null,
        debugMode: body.debugMode,
        attachments: body.attachments,
        existingUserMessageId: body.existingUserMessageId,
        onEvent: send,
      });
      send({ type: "done", data: { ok: true } });
    } catch (err) {
      send({ type: "error", data: err instanceof Error ? err.message : String(err) });
    } finally {
      complete = true;
      stopSseKeepalive();
      reply.raw.off("close", onClose);
      if (!clientDisconnected && isSseReplyWritable(reply)) reply.raw.end();
    }
  });

  app.get("/approvals", async (req, reply) => {
    if (!privileged(req, reply)) return;
    return [
      ...getMariDbService(app.db).getPendingApprovals(),
      ...getProfessorMariWorkspaceService(app).getSecurityReviews(),
    ];
  });

  app.post<{ Params: { id: string } }>("/approvals/:id/approve", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const securityResult = await getProfessorMariWorkspaceService(app).approveSecurityReview(req.params.id);
    if (securityResult) {
      if (!securityResult.ok) return reply.status(409).send(securityResult);
      return securityResult;
    }
    // #4851: "Keep & Enable" for a memory insert passes { enable: true } so the kept row
    // is switched on in the same action (memories land disabled by default).
    const { enable } = approveSchema.parse(req.body ?? {});
    const result = await getMariDbService(app.db).keepAppliedReviewAndWait(req.params.id, { enable });
    if (!result) return reply.status(404).send({ error: "Applied change review not found" });
    if (result.approval.affectedTables.installed_extensions) await personalServerExtensionRuntime.reloadAll();
    return { ok: true, ...result };
  });

  app.post<{ Params: { id: string } }>("/approvals/:id/reject", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const securityResult = getProfessorMariWorkspaceService(app).rejectSecurityReview(req.params.id);
    if (securityResult) {
      if (!securityResult.ok) return reply.status(409).send(securityResult);
      return securityResult;
    }
    const result = await getMariDbService(app.db).restoreAppliedReview(req.params.id);
    if (!result) return reply.status(404).send({ error: "Applied change review not found" });
    if ("outcome" in result && result.outcome === "state_changed") {
      // #4852 F2: the row changed after Mari staged this review, so the restore was a no-op that
      // left the newer data intact. Return 200 with ok:false (a non-2xx would land in the client's
      // generic "could not restore" catch instead of rendering the state_changed notice), and skip
      // the extension reload below since nothing was reverted.
      return { ok: false, completed: true, ...result };
    }
    if (result.approval.affectedTables.installed_extensions) await personalServerExtensionRuntime.reloadAll();
    return { ok: true, ...result, completed: true };
  });

  app.post<{ Params: { id: string } }>("/approvals/:id/reject-rows", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const { rows } = rejectRowsSchema.parse(req.body ?? {});
    const result = await getMariDbService(app.db).rejectRows(req.params.id, rows);
    if (!result) return reply.status(404).send({ error: "Applied change review not found" });
    if ("outcome" in result) {
      // state_changed (#4852 F2) or invalid_selection: nothing was reverted. Return 200 with
      // ok:false so the client shows result.error inline instead of a generic catch, mirroring the
      // whole-batch reject's convention.
      return { ok: false, ...result };
    }
    return { ok: true, ...result };
  });

  app.post<{ Params: { id: string } }>("/approvals/:id/render-prompt", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const body = renderPromptSchema.parse(req.body ?? {});
    const change = getMariDbService(app.db).getPendingChangeRaw(req.params.id, body.index);
    if (!change) return reply.status(404).send({ error: "Applied change review not found" });
    if (change.table !== body.table || change.id !== body.id || change.action !== body.action) {
      return reply.status(409).send({ error: "This review changed since it was shown. Reopen it and try again." });
    }
    // The preview is best-effort: it loads preset rows and assembles two prompts, so it can throw.
    // Convert any failure into the same unavailable-preview response instead of a 500.
    const render = await renderMariEditPrompt(app.db, change).catch((err) => {
      logger.warn(err, "[professor-mari] prompt preview render failed for review %s", req.params.id);
      return null;
    });
    if (!render) return reply.status(422).send({ error: "This change can't be shown as a prompt preview." });
    return { ok: true, ...render };
  });

  app.get("/history", async (req, reply) => {
    if (!privileged(req, reply)) return;
    return getMariDbService(app.db).getHistory();
  });

  app.post("/db/command", async (req, reply) => {
    if (!privileged(req, reply, true)) return;
    const body = cliSchema.parse(req.body);
    return getMariDbService(app.db).executeCli(body);
  });
}
