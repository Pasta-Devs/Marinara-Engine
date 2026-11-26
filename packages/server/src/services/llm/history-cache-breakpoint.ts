import type { ChatMessage } from "@marinara-engine/shared";

/**
 * A preset split by Recent History marks the end of its older history part. When the connection caches, that is where
 * the history cache breakpoint goes: everything before it is the same text next turn.
 */

/**
 * Anthropic: the marked end of the older part plus the end of the leading system block become the request's two
 * cache breakpoints. Requests that already carry their own breakpoints, or a connection that does not cache, are
 * left as they are.
 */
export function withHistoryCacheBreakpoint(messages: ChatMessage[], enableCaching: boolean | undefined): ChatMessage[] {
  if (!enableCaching || messages.some((message) => message.cacheBreakpoint === true)) return messages;
  const anchor = historyCacheAnchorIndex(messages);
  if (anchor < 0) return messages;
  const firstTurn = messages.findIndex((message) => message.role !== "system");
  const lastSystem = (firstTurn < 0 ? messages.length : firstTurn) - 1;
  return messages.map((message, index) =>
    index === anchor || index === lastSystem ? { ...message, cacheBreakpoint: true } : message,
  );
}

/**
 * OpenRouter and other providers that place the history breakpoint by depth: how many sent messages come after the
 * marked end of the older part, or undefined when nothing is marked.
 */
export function historyCacheBreakpointDepth(messages: ChatMessage[]): number | undefined {
  const anchor = historyCacheAnchorIndex(messages);
  if (anchor < 0) return undefined;
  return messages
    .slice(anchor + 1)
    .filter(
      (message) =>
        message.role === "tool" ||
        message.tool_calls?.length ||
        message.content?.trim() ||
        message.images?.length ||
        message.files?.length ||
        message.media?.length,
    ).length;
}

function historyCacheAnchorIndex(messages: ChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]!.historyCacheBreakpoint === true) return index;
  }
  return -1;
}
