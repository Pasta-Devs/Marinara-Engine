// ──────────────────────────────────────────────
// Routes: Professor Mari Workspace Agent
// ──────────────────────────────────────────────
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { startSseReply, trySendSseEvent } from "./generate/sse.js";
import { getProfessorMariWorkspaceService } from "../services/professor-mari/workspace-agent.service.js";
import { getProfessorMariWorkspaceSkillsService } from "../services/professor-mari/workspace-skills.service.js";
import { getMariDbService } from "../services/mari-db/mari-db.service.js";

const promptSchema = z.object({
  chatId: z.string().min(1),
  message: z.string().min(1),
  connectionId: z.string().optional().nullable(),
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
    await getProfessorMariWorkspaceService(app).reset();
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

  app.post("/prompt", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const body = promptSchema.parse(req.body);
    const service = getProfessorMariWorkspaceService(app);
    startSseReply(reply, { "X-Accel-Buffering": "no" });
    reply.raw.flushHeaders?.();

    let complete = false;
    let clientDisconnected = false;
    const onClose = () => {
      if (complete) return;
      clientDisconnected = true;
      void service.abort();
    };
    reply.raw.on("close", onClose);

    const send = (event: Parameters<typeof trySendSseEvent>[1]) => {
      if (!clientDisconnected && !reply.raw.destroyed) trySendSseEvent(reply, event);
    };

    try {
      send({ type: "metadata", data: { phase: "starting" } });
      await service.prompt({
        chatId: body.chatId,
        text: body.message,
        connectionId: body.connectionId ?? null,
        onEvent: send,
      });
      send({ type: "done", data: { ok: true } });
    } catch (err) {
      send({ type: "error", data: err instanceof Error ? err.message : String(err) });
    } finally {
      complete = true;
      reply.raw.off("close", onClose);
      if (!clientDisconnected && !reply.raw.destroyed && !reply.raw.writableEnded) reply.raw.end();
    }
  });

  app.get("/approvals", async (req, reply) => {
    if (!privileged(req, reply)) return;
    return getMariDbService(app.db).getPendingApprovals();
  });

  app.post<{ Params: { id: string } }>("/approvals/:id/approve", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const result = await getMariDbService(app.db).approveAndWait(req.params.id);
    if (!result) return reply.status(404).send({ error: "Approval not found" });
    return { ok: true, ...result };
  });

  app.post<{ Params: { id: string } }>("/approvals/:id/reject", async (req, reply) => {
    if (!privileged(req, reply)) return;
    const ok = getMariDbService(app.db).reject(req.params.id);
    if (!ok) return reply.status(404).send({ error: "Approval not found" });
    return { ok: true };
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
