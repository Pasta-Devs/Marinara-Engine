import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import type { preHandlerHookHandler } from "fastify";
import { APP_VERSION } from "@marinara-engine/shared";

const sessionContext = new AsyncLocalStorage<string>();

/** Keep nested helpers and retries on the originating chat's session. */
export const openCodeSessionHook: preHandlerHookHandler = (request, _reply, done) => {
  const body = request.body as { chatId?: unknown; sceneChatId?: unknown } | undefined;
  const params = request.params as { chatId?: unknown; id?: unknown } | undefined;
  const chatId =
    params?.chatId ??
    (request.routeOptions.url?.startsWith("/api/chats/") ? params?.id : undefined) ??
    body?.chatId ??
    body?.sceneChatId;
  // Hashing supports imported IDs without exposing them or allowing header control characters.
  const sessionId =
    typeof chatId === "string" && chatId.length > 0
      ? `marinara-chat-${createHash("sha256").update(chatId).digest("hex")}`
      : `marinara-request-${randomUUID()}`;
  sessionContext.run(sessionId, done);
};

/** Standalone provider operations without a chat still receive their own session. */
export function getOpenCodeSessionId(): string {
  return sessionContext.getStore() ?? `marinara-request-${randomUUID()}`;
}

export function isOpenCodeApiUrl(url: URL): boolean {
  return (
    url.protocol === "https:" &&
    (url.hostname === "opencode.ai" || url.hostname === "api.opencode.ai") &&
    /^\/zen\/(?:go\/)?v1(?:\/|$)/u.test(url.pathname)
  );
}

/** Apply at each outbound hop so automatically added headers never follow an external redirect. */
export function requestHeadersWithOpenCodeSession(
  url: URL,
  headersInit: RequestInit["headers"] | undefined,
  sessionId: string,
): Headers | undefined {
  if (!isOpenCodeApiUrl(url)) return headersInit ? new Headers(headersInit) : undefined;

  const headers = new Headers(headersInit);
  headers.set("x-opencode-session", sessionId);
  headers.set("User-Agent", `Marinara-Engine/${APP_VERSION}`);
  return headers;
}
