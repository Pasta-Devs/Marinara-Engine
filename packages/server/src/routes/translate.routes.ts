import type { FastifyInstance } from "fastify";
import { translateText } from "../services/translation.service.js";
import { createReplyFallbackNotifier } from "./generate/fallback-notification.js";

export async function translateRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => translateText(app.db, req.body, createReplyFallbackNotifier(reply)));
}
