import type { FastifyInstance, FastifyRequest } from "fastify";
import { createAgentConcurrencyLimiter } from "../agents/agent-concurrency.js";
import { createChatsStorage } from "../storage/chats.storage.js";

const queues = new Map<string, { run: ReturnType<typeof createAgentConcurrencyLimiter>; pending: number }>();
const backgroundTasks = new WeakMap<FastifyRequest, Promise<unknown>[]>();

/** Keep background model work in the same queue after its initial HTTP reply. */
export function retainSequentialGameTask(request: FastifyRequest, task: Promise<unknown>) {
  backgroundTasks.get(request)?.push(task);
}

/** Coordinate only model-producing routes; saves, status reads and cancellation remain available. */
export function registerSequentialGameTasks(
  app: FastifyInstance,
  paths: string[],
  resolveChatId?: (request: FastifyRequest) => Promise<string | null>,
) {
  const chats = createChatsStorage(app.db);
  app.addHook("onRoute", (route) => {
    if (route.method !== "POST" || !paths.includes(route.url.slice(app.prefix.length))) return;
    const handler = route.handler;
    route.handler = async function runSequentialRequest(request, reply): Promise<unknown> {
      const body = request.body as { chatId?: unknown } | null;
      const params = request.params as { chatId?: unknown };
      const chatId = resolveChatId ? await resolveChatId(request) : (params.chatId ?? body?.chatId);
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
      let ownerChanged = false;
      let result: unknown;
      try {
        result = await queue.run(async () => {
          if (reply.raw.destroyed) return;
          if (resolveChatId && (await resolveChatId(request)) !== chat.id) {
            ownerChanged = true;
            return;
          }
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
      // A newer session may have become the owner while this request waited.
      // Release the old slot before joining its queue, so neither chat blocks the other.
      return ownerChanged ? runSequentialRequest.call(this, request, reply) : result;
    };
  });
}
