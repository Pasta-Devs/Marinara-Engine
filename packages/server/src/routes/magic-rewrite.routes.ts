// ──────────────────────────────────────────────
// Routes: Magic Rewrite
//
// Generates AI-assisted rewrites of editor text
// using the user's instruction. Falls back through
// the existing default chat/agent connections.
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { logger } from "../lib/logger.js";
import {
  generateMagicRewrite,
  MagicRewriteConfigError,
  magicRewriteSchema,
} from "../services/magic-rewrite/magic-rewrite.service.js";

export async function magicRewriteRoutes(app: FastifyInstance) {
  app.post("/generate", async (req, reply) => {
    const parsed = magicRewriteSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", details: parsed.error.issues });
    }
    const input = parsed.data;

    try {
      return await generateMagicRewrite(app.db, input);
    } catch (error) {
      if (error instanceof MagicRewriteConfigError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      logger.error(error, "Magic Rewrite generation failed");
      return reply.status(500).send({ error: "Magic Rewrite generation failed" });
    }
  });
}
