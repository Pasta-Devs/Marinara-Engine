// ──────────────────────────────────────────────
// Routes: Generation jobs (feature switch `generationJobTracking`, off by default)
//
// While the switch is off every route falls through to the normal 404
// handler, exactly as if it were not registered, and nothing is created.
//   GET  /                     recent jobs from the store (?chatId=)
//   GET  /records              tracked job records (?chatId=&limit=)
//   POST /records/seen         the client accounted for finished jobs
//   GET  /records/:id          one record with its log trail
//   GET  /:id                  one job's metadata
//   GET  /:id/result           a completed job's saved result
//   POST /:id/cancel           stop a running job
// ──────────────────────────────────────────────
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  closeGenerationJobTracker,
  generationJobsEnabled,
  getGenerationJobTracker,
} from "../services/generation/generation-job-tracker.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SEEN_IDS = 100;

export async function generationJobsRoutes(app: FastifyInstance) {
  app.addHook("onClose", async () => closeGenerationJobTracker(app));

  const disabled = (reply: FastifyReply) => {
    if (generationJobsEnabled()) return false;
    reply.callNotFound();
    return true;
  };

  app.get<{ Querystring: { chatId?: string | string[] } }>("/", async (request, reply) => {
    if (disabled(reply)) return reply;
    if (Array.isArray(request.query.chatId)) return reply.code(400).send({ error: "chatId must be a single value" });
    return (await getGenerationJobTracker(app)).store.list(request.query.chatId);
  });

  app.get<{ Querystring: { chatId?: string | string[]; limit?: string } }>("/records", async (request, reply) => {
    if (disabled(reply)) return reply;
    if (Array.isArray(request.query.chatId)) return reply.code(400).send({ error: "chatId must be a single value" });
    const limit = Number.parseInt(request.query.limit ?? "", 10);
    const tracker = await getGenerationJobTracker(app);
    return {
      records: await tracker.list({
        chatId: request.query.chatId || undefined,
        limit: Number.isFinite(limit) ? limit : undefined,
      }),
    };
  });

  /** The client accounted for these finished jobs; recovered=false means the user watched them finish. */
  app.post<{ Body: { ids?: unknown; recovered?: unknown } }>("/records/seen", async (request, reply) => {
    if (disabled(reply)) return reply;
    const ids = request.body?.ids;
    if (
      !Array.isArray(ids) ||
      ids.length > MAX_SEEN_IDS ||
      !ids.every((id) => typeof id === "string" && UUID_RE.test(id))
    )
      return reply.code(400).send({ error: `ids must be up to ${MAX_SEEN_IDS} job ids` });
    const tracker = await getGenerationJobTracker(app);
    return { updated: await tracker.markSeen(ids as string[], request.body?.recovered !== false) };
  });

  /** One record with its structured log trail: the same events the server logged, for support lookups. */
  app.get<{ Params: { id: string } }>("/records/:id", async (request, reply) => {
    if (disabled(reply)) return reply;
    if (!UUID_RE.test(request.params.id)) return reply.code(400).send({ error: "Invalid generation job id" });
    const record = await (await getGenerationJobTracker(app)).get(request.params.id);
    if (!record) return reply.code(404).send({ error: "Generation job record not found" });
    return record;
  });

  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    if (disabled(reply)) return reply;
    if (!UUID_RE.test(request.params.id)) return reply.code(400).send({ error: "Invalid generation job id" });
    const item = await (await getGenerationJobTracker(app)).store.get(request.params.id);
    if (!item) return reply.code(404).send({ error: "Generation job not found" });
    return item;
  });

  app.get<{ Params: { id: string } }>("/:id/result", async (request, reply) => {
    if (disabled(reply)) return reply;
    if (!UUID_RE.test(request.params.id)) return reply.code(400).send({ error: "Invalid generation job id" });
    try {
      return await (await getGenerationJobTracker(app)).store.result(request.params.id);
    } catch (error: any) {
      if (error?.code === "ENOENT") return reply.code(404).send({ error: "Generation result not found" });
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>("/:id/cancel", async (request, reply) => {
    if (disabled(reply)) return reply;
    if (!UUID_RE.test(request.params.id)) return reply.code(400).send({ error: "Invalid generation job id" });
    const { store } = await getGenerationJobTracker(app);
    await store.cancel(request.params.id);
    const item = await store.get(request.params.id);
    if (!item) return reply.code(404).send({ error: "Generation job not found" });
    return item;
  });
}
