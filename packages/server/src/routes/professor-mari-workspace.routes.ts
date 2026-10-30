// ──────────────────────────────────────────────
// Routes: Professor Mari Workspace Agent
// ──────────────────────────────────────────────
import {
  chatIdForMariSession,
  MARI_PERMISSIONS_MODES,
  MARI_PERMISSIONS_MODE_SETTINGS_KEY,
  MARI_RUNTIMES,
  MARI_RUNTIME_SETTINGS_KEY,
  MARI_SKILL_GATE_SETTINGS_KEY,
  withMariReceiptOutcome,
  type MariPendingMessage,
} from "@marinara-engine/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { isSseReplyWritable, sendSseEvent, startSseKeepalive, startSseReply } from "./generate/sse.js";
import {
  readStoredMariPermissionsMode,
  readStoredMariRuntime,
  readStoredMariSkillGate,
} from "../services/professor-mari/workspace-agent.service.js";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { getProfessorMariWorkspaceService } from "../services/professor-mari/workspace-agent.service.js";
import {
  addPending,
  clearPending,
  drainPendingMessages,
  holdPending,
  isSafePendingChatId,
  type MariPromptOutcome,
  listPendingSummaries,
  MariPendingStoreError,
  removePending,
  restorePending,
  promotePendingToSteer,
  takeNextPending,
  takePending,
} from "../services/professor-mari/workspace-pending-store.js";
import { getProfessorMariWorkspaceSkillsService } from "../services/professor-mari/workspace-skills.service.js";
import { getMariDbService } from "../services/mari-db/mari-db.service.js";
import { renderMariEditPrompt } from "../services/professor-mari/workspace-edit-render.js";
import { listCanonicalDocumentation } from "../services/professor-mari/documentation-tools.js";
import { getMonorepoRoot } from "../config/runtime-config.js";
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

export const professorMariPromptSchema = z.object({
  chatId: z.string().min(1),
  message: z.string().min(1),
  connectionId: z.string().optional().nullable(),
  debugMode: z.boolean().optional().default(false),
  existingUserMessageId: z.string().min(1).optional(),
  // Send on a held queued message: the server takes it from the queue and uses ITS text, attachments, references
  // and context instead of the ones above.
  pendingMessageId: z.string().min(1).max(100).optional(),
  queuedSinceSendIds: z.array(z.string().min(1).max(100)).max(100).optional(),
  seasonalPackId: z.string().max(40).optional(),
  context: z
    .object({
      source: z.enum([
        "home",
        "floating-assistant",
        "command-center",
        "faq",
        "character-chat",
        "character-editor",
        "persona-editor",
        "lorebook-editor",
        "preset-editor",
        "connection-editor",
        "agent-editor",
        "settings",
        "game-setup",
        "chat-error",
      ]),
      capability: z.enum(["explain", "recommend", "create", "edit", "repair", "navigate"]),
      query: z.string().max(500).optional(),
      resource: z
        .object({
          kind: z.enum([
            "character",
            "persona",
            "lorebook",
            "preset",
            "connection",
            "agent",
            "setting",
            "chat",
            "game",
          ]),
          id: z.string().min(1).max(200),
          label: z.string().max(200).optional(),
        })
        .optional(),
      relatedResources: z
        .array(
          z.object({
            kind: z.enum(["character", "persona", "lorebook", "preset", "connection", "agent"]),
            id: z.string().min(1).max(200),
            label: z.string().max(200).optional(),
          }),
        )
        .max(4)
        .optional(),
      field: z.string().min(1).max(200).optional(),
      fieldId: z.string().min(1).max(200).optional(),
      fieldDraft: z.object({ value: z.string().max(20_000), selection: z.string().max(4_000).optional() }).optional(),
      error: z.object({ message: z.string().min(1).max(2_000), code: z.string().max(200).optional() }).optional(),
      action: z.string().max(500).optional(),
      commandCenterResultId: z.string().min(1).max(256).optional(),
      activeChat: z
        .object({
          id: z.string().min(1).max(256),
          label: z.string().max(200).optional(),
          mode: z.string().max(32).optional(),
        })
        .optional(),
      settingsLocation: z
        .object({ tab: z.string().max(64).optional(), controlId: z.string().max(128).optional() })
        .optional(),
      asideAnswer: z
        .object({
          query: z.string().max(500),
          answer: z.string().max(4_000),
          tier: z.enum(["local", "remote"]),
          sources: z
            .array(z.object({ path: z.string().max(300), heading: z.string().max(300) }))
            .max(3)
            .optional(),
        })
        .optional(),
    })
    .optional(),
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
  // `@` links from the composer: resolved once, beside this message (the ids are re-read server-side).
  references: z
    .array(
      z.object({
        kind: z.enum([
          "character",
          "persona",
          "lorebook",
          "lorebookEntry",
          "preset",
          "skill",
          "memory",
          "chat",
          "doc",
          "agent",
        ]),
        id: z.string().min(1).max(200),
        // A long record name or doc heading is cut, not a reason to refuse the whole message.
        label: z
          .string()
          .min(1)
          .transform((label) => label.slice(0, 200)),
        parentId: z.string().max(200).optional(),
      }),
    )
    .max(8)
    .optional()
    .default([]),
});

// A message queued while she works: the prompt's own shapes for what it carries.
const pendingCreateSchema = professorMariPromptSchema
  .pick({
    chatId: true,
    message: true,
    attachments: true,
    references: true,
    context: true,
  })
  .extend({ steer: z.boolean().optional() });

const abortSchema = z.object({
  // Stop from the composer names its chat: that chat's queue comes back to the user instead of staying held.
  chatId: z.string().min(1).optional(),
});

const resetSchema = z.object({
  clearHistory: z.boolean().optional(),
  // F12: Dismiss only needs the last-error flag cleared; a stale client error (poll lag, another
  // tab) must not abort a run that is genuinely in flight.
  keepRun: z.boolean().optional(),
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

// #5725 Permissions Mode. A dedicated validated route owns the setting (the
// docs-language pattern) - it is deliberately NOT in app-settings ALLOWED_KEYS,
// so nothing can write junk the per-run reader would have to distrust.
const permissionsModeSchema = z.object({
  // mode null + chatId clears that chat's override back to the default.
  mode: z.enum(MARI_PERMISSIONS_MODES).nullable(),
  chatId: z.string().min(1).optional(),
});

// Professor Mari's runtime ("classic" or "pi"): the same validated-route pattern, global only.
const runtimeSchema = z.object({ runtime: z.enum(MARI_RUNTIMES) });
const skillGateSchema = z.object({ enabled: z.boolean() });

/**
 * What the user reads when Keep or Restore fails (#6842), instead of a bare "Internal Server
 * Error". Keep and Restore first move the review's saved file under the data folder, and a
 * folder Marinara cannot write to is the usual cause.
 */
export function reviewActionFailure(err: unknown, action: "keep" | "restore"): string {
  const code = (err as NodeJS.ErrnoException | null)?.code;
  const cause = (err as { cause?: NodeJS.ErrnoException } | null)?.cause?.code;
  const fileCode = code ?? cause;
  if (fileCode === "EACCES" || fileCode === "EPERM" || fileCode === "EROFS") {
    return `Marinara could not update this review's saved file (${fileCode}), so the card stays. Check that Marinara can write to its data folder.`;
  }
  if (fileCode === "EBUSY") {
    return `Marinara could not update this review's saved file (EBUSY): another program has it open. Try again in a moment.`;
  }
  const detail = err instanceof Error && err.message ? ` ${err.message}` : "";
  return `The ${action === "keep" ? "Keep" : "Restore"} did not finish, so the card stays.${detail}`;
}

/**
 * Slice 74: Keep / Undo writes its outcome onto the receipt of the Mari message that made the change, so
 * the card says "Kept" / "Undone" after a reload. Newest message first; never fails the answer.
 */
export async function recordMariReceiptOutcome(
  app: FastifyInstance,
  sessionId: string,
  reviewId: string,
  outcome: "kept" | "undone",
) {
  const chatId = chatIdForMariSession(sessionId);
  if (!chatId) return;
  try {
    const chats = createChatsStorage(app.db);
    for (const message of (await chats.listMessages(chatId)).reverse()) {
      if (message.role !== "assistant") continue;
      let extra: { mariWorkspaceActionResults?: unknown } | null;
      try {
        extra = typeof message.extra === "string" ? JSON.parse(message.extra || "{}") : (message.extra ?? null);
      } catch {
        continue;
      }
      const next = withMariReceiptOutcome(extra?.mariWorkspaceActionResults, reviewId, outcome);
      if (!next) continue;
      await chats.updateMessageExtra(message.id, { mariWorkspaceActionResults: next });
      return;
    }
  } catch (err) {
    logger.warn(err, "[professor-mari] could not record the receipt outcome for review %s", reviewId);
  }
}

function privileged(request: FastifyRequest, reply: FastifyReply, loopbackOnly = false) {
  return requirePrivilegedAccess(request, reply, {
    loopbackOnly,
    feature: "Professor Mari workspace",
  });
}

/** A full or unusable queue is the user's to fix, so it is a plain 4xx with words, not a 500. */
function sendPendingError(reply: FastifyReply, err: unknown) {
  if (err instanceof MariPendingStoreError) {
    return reply.status(err.code === "limit" ? 409 : 400).send({ error: err.message });
  }
  throw err;
}

export async function professorMariWorkspaceRoutes(app: FastifyInstance) {
  // Counts Stops, so a drain between two messages can tell one came in while no run was there to abort.
  let stopCount = 0;
  app.get<{ Querystring: { connectionId?: string; chatId?: string } }>("/status", async (req, reply) => {
    if (!privileged(req, reply)) return;
    return getProfessorMariWorkspaceService(app).status(req.query.connectionId ?? null, req.query.chatId ?? null);
  });

  app.post("/abort", async (req, reply) => {
    if (!privileged(req, reply)) return;
    stopCount += 1;
    const input = abortSchema.parse(req.body ?? {});
    // Cleared BEFORE the abort, so the drain that wakes up when the run stops finds nothing left to send. Without
    // a chatId the queue stays held, as before.
    let returned: MariPendingMessage[] = [];
    if (input.chatId) {
      try {
        returned = await clearPending(input.chatId);
      } catch (err) {
        // Stop must still stop; an unusable queue file leaves its messages held.
        logger.warn(err, "[professor-mari] Could not return the queued messages for chat %s", input.chatId);
      }
    }
    await getProfessorMariWorkspaceService(app).abort();
    return { ok: true, returned };
  });

  // Messages typed while she works. Summaries only on the way out: attachments can be 20 MB each.
  app.post("/pending", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const input = pendingCreateSchema.parse(req.body);
    const chat = await createChatsStorage(app.db).getById(input.chatId);
    let metadata: Record<string, unknown> = {};
    try {
      metadata = chat?.metadata ? (JSON.parse(chat.metadata) as Record<string, unknown>) : {};
    } catch {
      // Unreadable metadata counts as no marker below.
    }
    if (!chat || metadata.internalAssistant !== "professor-mari") {
      return reply.status(404).send({ error: "Professor Mari chat not found" });
    }
    let added: { id: string };
    try {
      added = await addPending(input.chatId, {
        text: input.message,
        attachments: input.attachments,
        references: input.references,
        context: input.context,
        steer: input.steer && (await getProfessorMariWorkspaceService(app).canSteerNow(input.chatId, input.context)),
      });
    } catch (err) {
      return sendPendingError(reply, err);
    }
    return { addedId: added.id, pending: await listPendingSummaries(input.chatId) };
  });

  // Send now on a row that is already waiting.
  app.post<{ Params: { chatId: string; id: string } }>("/pending/:chatId/:id/steer", async (req, reply) => {
    if (!privileged(req, reply)) return;
    try {
      const row = (await listPendingSummaries(req.params.chatId)).find((message) => message.id === req.params.id);
      const promoted =
        !!row &&
        (await getProfessorMariWorkspaceService(app).canSteerNow(req.params.chatId, row.context)) &&
        (await promotePendingToSteer(req.params.chatId, req.params.id));
      if (!promoted) return reply.status(409).send({ error: "That message can't go now. Send it from the queue." });
      return { pending: await listPendingSummaries(req.params.chatId) };
    } catch (err) {
      return sendPendingError(reply, err);
    }
  });

  app.delete<{ Params: { chatId: string; id: string } }>("/pending/:chatId/:id", async (req, reply) => {
    if (!privileged(req, reply)) return;
    try {
      await removePending(req.params.chatId, req.params.id);
      return { pending: await listPendingSummaries(req.params.chatId) };
    } catch (err) {
      return sendPendingError(reply, err);
    }
  });

  app.post("/reset", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const input = resetSchema.parse(req.body ?? {});
    await getProfessorMariWorkspaceService(app).reset({
      clearHistory: input.clearHistory === true,
      keepRun: input.keepRun === true,
    });
    return { ok: true };
  });

  // The canonical docs the composer's `@` picker offers (the same set `docs_read` can open).
  app.get("/docs", async (req, reply) => {
    if (!privileged(req, reply)) return;
    return listCanonicalDocumentation(getMonorepoRoot());
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
    // Shipped procedure: the app's own copy is the only source of truth, so neither
    // editing nor toggling one is a server operation. Copy it into a user skill to change it.
    if (await getProfessorMariWorkspaceSkillsService().isReadOnly(req.params.id)) {
      return reply.code(403).send({ error: "Built-in skills are read-only. Copy it into a new skill to change it." });
    }
    const input = skillUpdateSchema.parse(req.body);
    const skill = await getProfessorMariWorkspaceSkillsService().update(req.params.id, input);
    await getProfessorMariWorkspaceService(app).reset();
    return { ok: true, skill };
  });

  app.delete<{ Params: { id: string } }>("/skills/:id", async (req, reply) => {
    if (!privileged(req, reply)) return;
    if (await getProfessorMariWorkspaceSkillsService().isReadOnly(req.params.id)) {
      return reply.code(403).send({ error: "Built-in skills are read-only." });
    }
    await getProfessorMariWorkspaceSkillsService().delete(req.params.id);
    await getProfessorMariWorkspaceService(app).reset();
    return { ok: true };
  });

  // #4851: Memories management panel. Direct, reset-free writes (see instructionCreateSchema note).
  // #5725: Permissions Mode. Reads never reset() the agent (the memories
  // convention) - a mode switch must not abort an in-flight turn; the next
  // run reads the new mode.
  app.get("/permissions-mode", async (req, reply) => {
    if (!privileged(req, reply)) return;
    return { mode: await readStoredMariPermissionsMode(createAppSettingsStorage(app.db)) };
  });

  app.put("/permissions-mode", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const input = permissionsModeSchema.parse(req.body);
    if (input.chatId) {
      // Per-chat override (#5725 maintainer call): stored in chat metadata via
      // the queued patch (#5076), null clears it. isMariPermissionsMode treats
      // a null/absent value as "no override" on every read path.
      const patched = await createChatsStorage(app.db).patchMetadata(input.chatId, {
        mariPermissionsMode: input.mode,
      });
      if (!patched) return reply.status(404).send({ error: "Chat not found" });
      return { ok: true, mode: input.mode, chatId: input.chatId };
    }
    if (input.mode === null) {
      return reply.status(400).send({ error: "The global default mode cannot be cleared - pick a mode." });
    }
    await createAppSettingsStorage(app.db).set(MARI_PERMISSIONS_MODE_SETTINGS_KEY, input.mode);
    return { ok: true, mode: input.mode };
  });

  // The runtime applies to the next run, so a switch never aborts an in-flight turn.
  app.get("/runtime", async (req, reply) => {
    if (!privileged(req, reply)) return;
    return { runtime: await readStoredMariRuntime(createAppSettingsStorage(app.db)) };
  });

  app.put("/runtime", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const input = runtimeSchema.parse(req.body);
    await createAppSettingsStorage(app.db).set(MARI_RUNTIME_SETTINGS_KEY, input.runtime);
    getProfessorMariWorkspaceService(app).resetRuntimeFailures();
    return { ok: true, runtime: input.runtime };
  });

  app.get("/skill-gate", async (req, reply) => {
    if (!privileged(req, reply)) return;
    return { enabled: await readStoredMariSkillGate(createAppSettingsStorage(app.db)) };
  });

  app.put("/skill-gate", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const input = skillGateSchema.parse(req.body);
    await createAppSettingsStorage(app.db).set(MARI_SKILL_GATE_SETTINGS_KEY, input.enabled ? "true" : "false");
    return { ok: true, enabled: input.enabled };
  });

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
    const body = professorMariPromptSchema.parse(req.body);
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
      const runPrompt = (
        message: Pick<MariPendingMessage, "text" | "attachments" | "references" | "context">,
        existingUserMessageId?: string,
        onUserMessageSaved?: () => void,
      ) =>
        service.prompt({
          chatId: body.chatId,
          text: message.text,
          connectionId: body.connectionId ?? null,
          debugMode: body.debugMode,
          attachments: message.attachments,
          references: message.references,
          existingUserMessageId,
          context: message.context,
          seasonalPackId: body.seasonalPackId,
          onUserMessageSaved,
          onEvent: send,
        });
      // A queued message left the file before it reached the thread. If the run is refused in that gap (no
      // connection, a failed save), it goes back to the front of the queue instead of vanishing.
      const runQueued = async (message: MariPendingMessage) => {
        let saved = false;
        try {
          return await runPrompt(message, undefined, () => {
            saved = true;
          });
        } catch (err) {
          if (!saved) await restorePending(body.chatId, message);
          throw err;
        }
      };
      const stopCountAtStart = stopCount;
      if (isSafePendingChatId(body.chatId)) {
        // Best effort: an unusable file only means the drain below finds nothing it can read either.
        await holdPending(body.chatId, body.queuedSinceSendIds).catch((err) => {
          logger.warn(err, "[professor-mari] Could not hold the queued messages for chat %s", body.chatId);
        });
      }
      let outcome: MariPromptOutcome;
      if (body.pendingMessageId) {
        // Send on a held message: it leaves the queue and runs as if typed now.
        const taken = await takePending(body.chatId, body.pendingMessageId);
        if (!taken) throw new Error("That queued message is gone. It may have been sent or removed already.");
        outcome = await runQueued(taken);
      } else {
        outcome = await runPrompt(
          { text: body.message, attachments: body.attachments, references: body.references, context: body.context },
          body.existingUserMessageId,
        );
      }
      // The queue runs on this same reply, so the client's stream spans the whole drain and "done" waits for it.
      if (isSafePendingChatId(body.chatId)) {
        await drainPendingMessages({
          chatId: body.chatId,
          outcome,
          isBusy: () => service.isRunActive() || stopCount !== stopCountAtStart,
          // Her answer is already saved, so an unreadable file leaves the messages held rather than failing it.
          takeNext: () =>
            takeNextPending(body.chatId).catch((err) => {
              logger.warn(err, "[professor-mari] Could not read the queued messages for chat %s", body.chatId);
              return null;
            }),
          runPrompt: runQueued,
          onNext: (message) => send({ type: "queue_next", data: { id: message.id, text: message.text } }),
          putBack: (message) => restorePending(body.chatId, message),
        });
      }
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
    let result: Awaited<ReturnType<ReturnType<typeof getMariDbService>["keepAppliedReviewAndWait"]>>;
    try {
      result = await getMariDbService(app.db).keepAppliedReviewAndWait(req.params.id, { enable });
    } catch (err) {
      req.log.error(err, "[professor-mari] Keep failed");
      return reply.status(500).send({ error: reviewActionFailure(err, "keep") });
    }
    if (!result) return reply.status(404).send({ error: "Applied change review not found" });
    if (result.approval.affectedTables.installed_extensions) await personalServerExtensionRuntime.reloadAll();
    await recordMariReceiptOutcome(app, result.approval.sessionId, result.approval.id, "kept");
    return { ok: true, ...result };
  });

  app.post<{ Params: { id: string } }>("/approvals/:id/reject", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const securityResult = getProfessorMariWorkspaceService(app).rejectSecurityReview(req.params.id);
    if (securityResult) {
      if (!securityResult.ok) return reply.status(409).send(securityResult);
      return securityResult;
    }
    let result: Awaited<ReturnType<ReturnType<typeof getMariDbService>["restoreAppliedReview"]>>;
    try {
      result = await getMariDbService(app.db).restoreAppliedReview(req.params.id);
    } catch (err) {
      req.log.error(err, "[professor-mari] Restore failed");
      return reply.status(500).send({ error: reviewActionFailure(err, "restore") });
    }
    if (!result) return reply.status(404).send({ error: "Applied change review not found" });
    if ("outcome" in result && result.outcome === "state_changed") {
      // #4852 F2: the row changed after Mari staged this review, so the restore was a no-op that
      // left the newer data intact. Return 200 with ok:false (a non-2xx would land in the client's
      // generic "could not restore" catch instead of rendering the state_changed notice), and skip
      // the extension reload below since nothing was reverted.
      return { ok: false, completed: true, ...result };
    }
    if (result.approval.affectedTables.installed_extensions) await personalServerExtensionRuntime.reloadAll();
    await recordMariReceiptOutcome(app, result.approval.sessionId, result.approval.id, "undone");
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
