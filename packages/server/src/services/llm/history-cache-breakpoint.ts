import type { ChatMessage } from "@marinara-engine/shared";

/**
 * A preset split by Recent History marks the end of its older history part. When the connection caches, that is where
 * the history cache breakpoint goes: everything before it is the same text next turn.
 */

/**
 * Anthropic: the marked end of the older part plus the end of the leading system block become the request's cache
 * breakpoints, with one more before Past Events when it is its own system message (see `summaryCacheSegmentIndex`).
 * Requests that already carry their own breakpoints, or a connection that does not cache, are left as they are.
 */
export function withHistoryCacheBreakpoint(messages: ChatMessage[], enableCaching: boolean | undefined): ChatMessage[] {
  if (!enableCaching || messages.some((message) => message.cacheBreakpoint === true)) return messages;
  const anchor = historyCacheAnchorIndex(messages);
  if (anchor < 0) return messages;
  const firstTurn = messages.findIndex((message) => message.role !== "system");
  const lastSystem = (firstTurn < 0 ? messages.length : firstTurn) - 1;
  const beforeSummary = summaryCacheSegmentIndex(messages) - 1;
  return messages.map((message, index) =>
    index === anchor || index === lastSystem || (beforeSummary >= 0 && index === beforeSummary)
      ? { ...message, cacheBreakpoint: true }
      : message,
  );
}

/**
 * Where Past Events starts in the leading system messages, or -1. A new summary changes the prompt from there on, so a
 * breakpoint right before it keeps the fixed system prompt cached on the turn a summary is saved.
 */
export function summaryCacheSegmentIndex(messages: readonly ChatMessage[]): number {
  for (let index = 1; index < messages.length; index++) {
    const message = messages[index]!;
    if (message.role !== "system") return -1;
    if (message.summaryCacheSegment === true) return index;
  }
  return -1;
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
