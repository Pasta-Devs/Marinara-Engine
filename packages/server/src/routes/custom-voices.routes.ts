import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createCustomVoiceService, CustomVoiceError, type VoiceContext } from "../services/tts/custom-voice-service.js";

export function registerCustomVoiceRoutes(
  app: FastifyInstance,
  resolve: (id: string) => Promise<VoiceContext>,
  clear: (context: VoiceContext, id: string) => Promise<void>,
) {
  const query = z.object({ connectionId: z.string().max(200) });
  const revision = z.object({ snapshot: z.string().length(64) });
  const deletion = revision.extend({
    id: z.string().max(200),
    confirmedAssignments: z.array(z.string().max(500)).max(10000),
  });
  function service(q: unknown) {
    const { connectionId } = query.parse(q);
    return createCustomVoiceService(() => resolve(connectionId));
  }
  async function handled(operation: () => Promise<unknown>, reply: import("fastify").FastifyReply) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof CustomVoiceError) return reply.status(error.statusCode).send({ error: error.message });
      if (error instanceof z.ZodError) return reply.status(400).send({ error: "Invalid custom voice request." });
      // Never echo provider bodies, upload payloads, consent, paths or credentials.
      return reply
        .status(502)
        .send({ error: "Custom voice operation failed. Refresh the provider list before retrying a mutation." });
    }
  }
  app.get("/custom-voices", (req, reply) => handled(() => service(req.query).get(), reply));
  app.put("/custom-voices", (req, reply) =>
    handled(() => {
      const body = revision.extend({ profile: z.enum(["vllm-omni"]).nullable() }).parse(req.body);
      return service(req.query).profile(body.snapshot, body.profile);
    }, reply),
  );
  app.post("/custom-voices", { bodyLimit: 15 * 1024 * 1024 }, (req, reply) =>
    handled(() => {
      const body = revision
        .extend({
          displayName: z.string().min(1).max(100),
          consent: z.string().min(1).max(200),
          transcript: z.string().max(10000).optional(),
          audioBase64: z.string().min(1).max(13981016),
          acknowledged: z.literal(true),
        })
        .parse(req.body);
      return service(req.query).register(body);
    }, reply),
  );
  app.post("/custom-voices/delete", (req, reply) =>
    handled(() => service(req.query).remove(deletion.parse(req.body), clear), reply),
  );
}
