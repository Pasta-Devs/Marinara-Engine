import type { FastifyInstance } from "fastify";
import { subscribeChatEvents } from "../services/chat-events.service.js";

const KEEPALIVE_INTERVAL_MS = 25_000;

export async function chatEventsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { chatId?: string } }>("/", async (req, reply) => {
    const chatId = typeof req.query.chatId === "string" && req.query.chatId.trim() ? req.query.chatId.trim() : null;

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    reply.raw.write(`data: ${JSON.stringify({ type: "server_ready", timestamp: new Date().toISOString() })}\n\n`);

    const unsubscribe = subscribeChatEvents((event) => {
      if (chatId && event.chatId !== chatId) return;
      try {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch {
        unsubscribe();
      }
    });

    const keepalive = setInterval(() => {
      try {
        reply.raw.write(": keepalive\n\n");
      } catch {
        clearInterval(keepalive);
        unsubscribe();
      }
    }, KEEPALIVE_INTERVAL_MS);

    req.raw.on("close", () => {
      clearInterval(keepalive);
      unsubscribe();
    });
  });
}
