import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { PROFESSOR_MARI_QUICK_RATE_LIMIT } from "../middleware/rate-limit.js";
import { getProfessorMariWorkspaceService } from "../services/professor-mari/workspace-agent.service.js";
import { isSseReplyWritable, sendSseEvent, startSseKeepalive, startSseReply } from "./generate/sse.js";
import { logger } from "../lib/logger.js";
import { QuickEditConflictError } from "../services/professor-mari/quick-edit-proposal.js";
import { classifyQuickAnswerError } from "../services/professor-mari/quick-answer-error.js";
import { MIN_GROUNDING_SCORE, searchCanonicalDocumentation } from "../services/professor-mari/documentation-tools.js";
import { getMonorepoRoot } from "../config/runtime-config.js";
import { isCapabilityAllowedFrom, type ProfessorMariQuickPromptEvent } from "@marinara-engine/shared";

const quickContextSchema = z
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
    capability: z.enum(["explain", "recommend", "create", "edit", "repair", "navigate"]).optional(),
    query: z.string().max(500).optional(),
    resource: z
      .object({
        kind: z.enum(["character", "persona", "lorebook", "preset", "connection", "agent", "setting", "chat", "game"]),
        id: z.string().min(1).max(200),
        label: z.string().max(200).optional(),
      })
      .optional(),
    field: z.string().min(1).max(200).optional(),
    fieldId: z.string().min(1).max(200).optional(),
    action: z.string().max(500).optional(),
  })
  .strict()
  .superRefine((context, issueContext) => {
    if (context.capability && !isCapabilityAllowedFrom(context.capability, context.source)) {
      issueContext.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["capability"],
        message: `Capability ${context.capability} is not available from ${context.source}`,
      });
    }
  });

export const professorMariQuickPromptSchema = z
  .object({
    message: z.string().trim().min(1).max(4_000),
    connectionId: z.string().min(1).max(256).optional().nullable(),
    context: quickContextSchema.optional(),
    debugMode: z.boolean().optional().default(false),
    unasked: z.boolean().optional().default(false),
    resourceLabel: z.string().trim().max(200).optional(),
  })
  .strict();

/**
 * The docs a quick answer is grounded on, named under the answer. The service searches the same corpus for
 * its own grounding.
 * ponytail: this second search costs one more docs read per quick answer; sharing one search needs the service
 * to return its results, which is left for when its prompt work is merged.
 */
async function sendDocsSources(message: string, send: (event: ProfessorMariQuickPromptEvent) => void) {
  const query = message.trim();
  if (query.length < 2) return;
  try {
    const docs = await searchCanonicalDocumentation(getMonorepoRoot(), query, 3);
    // Only the sections the answer is grounded on: a page that matched one stray word is no source.
    const sources = docs.results
      .filter((result) => result.score >= MIN_GROUNDING_SCORE)
      .map((result) => ({ path: result.path, heading: result.heading }));
    if (sources.length > 0) send({ type: "sources", data: sources });
  } catch {
    // Sources are a hint; a failed search must not stop the answer.
  }
}

export async function professorMariQuickRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    "/proposals/:id/apply",
    { config: { rateLimit: PROFESSOR_MARI_QUICK_RATE_LIMIT } },
    async (request, reply) => {
      if (!requirePrivilegedAccess(request, reply, { feature: "Professor Mari Quick" })) return;
      try {
        return await getProfessorMariWorkspaceService(app).applyQuickEditProposal(request.params.id);
      } catch (error) {
        if (error instanceof QuickEditConflictError) return reply.status(409).send({ error: error.message });
        logger.error(error, "Quick edit proposal apply failed");
        return reply.status(500).send({ error: "Quick edit could not be applied." });
      }
    },
  );

  app.post("/prompt", { config: { rateLimit: PROFESSOR_MARI_QUICK_RATE_LIMIT } }, async (request, reply) => {
    if (!requirePrivilegedAccess(request, reply, { feature: "Professor Mari Quick" })) return;
    const body = professorMariQuickPromptSchema.parse(request.body);
    const controller = new AbortController();
    const onClose = () => controller.abort();
    reply.raw.on("close", onClose);
    startSseReply(reply, { "X-Accel-Buffering": "no" });
    reply.raw.flushHeaders?.();
    const stopKeepalive = startSseKeepalive(reply);
    const send = (event: Parameters<typeof sendSseEvent>[1]) => {
      if (isSseReplyWritable(reply)) sendSseEvent(reply, event);
    };

    let words = 0;
    try {
      send({ type: "status", data: { phase: "starting" } });
      if (body.unasked) await sendDocsSources(body.message, send);
      await getProfessorMariWorkspaceService(app).quickPrompt({
        ...body,
        signal: controller.signal,
        onEvent: (event: ProfessorMariQuickPromptEvent) => {
          if (event.type === "token") words += 1;
          send(event);
        },
      });
      // A quick answer with no words is a failed answer, never a finished one.
      if (body.unasked && words === 0 && !controller.signal.aborted)
        throw new Error("Professor Mari sent no words for this quick answer.");
      send({ type: "complete", data: { ok: true } });
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : String(error);
        send({ type: "error", data: { kind: classifyQuickAnswerError(message), message } });
      }
    } finally {
      stopKeepalive();
      reply.raw.off("close", onClose);
      if (isSseReplyWritable(reply)) reply.raw.end();
    }
  });
}
