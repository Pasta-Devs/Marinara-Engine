import type { FastifyInstance, FastifyRequest } from "fastify";
import { createAgentConcurrencyLimiter } from "../agents/agent-concurrency.js";
import { createChatsStorage } from "../storage/chats.storage.js";

const queues = new Map<string, { run: ReturnType<typeof createAgentConcurrencyLimiter>; pending: number }>();
const backgroundTasks = new WeakMap<FastifyRequest, Promise<unknown>[]>();

/** Keep background storyboard rendering in the same queue after its initial HTTP reply. */
export function retainSequentialGameTask(request: FastifyRequest, task: Promise<unknown>) {
  backgroundTasks.get(request)?.push(task);
}

/** Coordinate only model-producing routes; saves, status reads and cancellation remain available. */
export function registerSequentialGameTasks(app: FastifyInstance, paths: string[]) {
  const chats = createChatsStorage(app.db);
  app.addHook("onRoute", (route) => {
    if (route.method !== "POST" || !paths.includes(route.url.slice(app.prefix.length))) return;
    const handler = route.handler;
    route.handler = async function (request, reply) {
      const body = request.body as { chatId?: unknown } | null;
      const params = request.params as { chatId?: unknown };
      const chatId = params.chatId ?? body?.chatId;
      const chat = typeof chatId === "string" ? await chats.getById(chatId) : null;
      if (chat?.mode !== "game") return handler.call(this, request, reply);
      let metadata: { gameSequentialAgents?: boolean } = {};
      try {
        metadata = JSON.parse(chat.metadata || "{}");
      } catch {
        /* legacy malformed metadata */
      }
      if (metadata?.gameSequentialAgents !== true) return handler.call(this, request, reply);

      let queue = queues.get(chat.id);
      if (!queue) {
        queue = { run: createAgentConcurrencyLimiter(1), pending: 0 };
        queues.set(chat.id, queue);
      }
      queue.pending++;
      try {
        return await queue.run(async () => {
          if (reply.raw.destroyed) return;
          const pending: Promise<unknown>[] = [];
          backgroundTasks.set(request, pending);
          try {
            const result = await handler.call(this, request, reply);
            if (pending.length && !reply.sent) reply.send(result);
            return result;
          } finally {
            await Promise.allSettled(pending);
            backgroundTasks.delete(request);
          }
        });
      } finally {
        queue.pending--;
        if (queue.pending === 0) queues.delete(chat.id);
      }
    };
  });
}
