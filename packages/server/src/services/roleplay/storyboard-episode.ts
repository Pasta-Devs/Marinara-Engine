import { createHash } from "node:crypto";

export const ROLEPLAY_STORYBOARD_MAX_SOURCE_MESSAGES = 20;
export const ROLEPLAY_STORYBOARD_MAX_SOURCE_CHARACTERS = 12_000;

export type RoleplayStoryboardMessage = {
  id: string;
  role: string;
  content: string;
  activeSwipeIndex?: number | null;
};

export type RoleplayStoryboardEpisodeSection = {
  index: number;
  kind: "user" | "assistant";
  speaker: "User" | "Assistant";
  messageId: string;
  content: string;
};

export type RoleplayStoryboardEpisodeSelection =
  | { status: "skip"; reason: "interval" | "missing_message" | "unsupported_message" | "empty_source" }
  | {
      status: "ready";
      messageId: string;
      swipeIndex: number;
      assistantMessageCount: number;
      sections: RoleplayStoryboardEpisodeSection[];
      sourceNarration: string;
      sourceNarrationHash: string;
    };

function normalizeRunInterval(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(1, Math.trunc(parsed))) : 1;
}

function normalizeMessageContent(value: unknown): string {
  return typeof value === "string"
    ? value
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    : "";
}

function isAssistantRole(role: string): boolean {
  return role === "assistant" || role === "narrator";
}

function episodeMessagesSinceAnchor(
  messages: RoleplayStoryboardMessage[],
  currentIndex: number,
  previousSuccessfulMessageId: string | null,
): { messages: RoleplayStoryboardMessage[]; anchorResolved: boolean } {
  if (previousSuccessfulMessageId) {
    const anchorIndex = messages.findIndex((message) => message.id === previousSuccessfulMessageId);
    if (anchorIndex >= 0 && anchorIndex < currentIndex) {
      return { messages: messages.slice(anchorIndex + 1, currentIndex + 1), anchorResolved: true };
    }
  }

  let startIndex = currentIndex;
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (isAssistantRole(messages[index]?.role ?? "")) break;
    startIndex = index;
  }
  return { messages: messages.slice(startIndex, currentIndex + 1), anchorResolved: false };
}

export function selectPreviousSuccessfulStoryboard<T extends { messageId: string; status: string; createdAt: string }>(
  storyboards: readonly T[],
  messages: readonly Pick<RoleplayStoryboardMessage, "id">[],
  currentMessageId: string,
): T | null {
  const messageOrder = new Map(messages.map((message, index) => [message.id, index]));
  const currentMessageIndex = messageOrder.get(currentMessageId);
  if (currentMessageIndex === undefined) return null;

  const candidates: Array<{ storyboard: T; messageIndex: number }> = [];
  for (const storyboard of storyboards) {
    if (storyboard.status !== "complete" && storyboard.status !== "partial") continue;
    const messageIndex = messageOrder.get(storyboard.messageId);
    if (messageIndex === undefined || messageIndex >= currentMessageIndex) continue;
    candidates.push({ storyboard, messageIndex });
  }
  candidates.sort(
    (left, right) =>
      right.messageIndex - left.messageIndex || right.storyboard.createdAt.localeCompare(left.storyboard.createdAt),
  );
  return candidates[0]?.storyboard ?? null;
}

function boundEpisodeMessages(messages: RoleplayStoryboardMessage[]): RoleplayStoryboardMessage[] {
  const newest = messages.slice(-ROLEPLAY_STORYBOARD_MAX_SOURCE_MESSAGES);
  const bounded: RoleplayStoryboardMessage[] = [];
  let remaining = ROLEPLAY_STORYBOARD_MAX_SOURCE_CHARACTERS;

  for (let index = newest.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const message = newest[index]!;
    const content = normalizeMessageContent(message.content);
    if (!content) continue;
    const prefixLength = message.role === "user" ? 6 : 11;
    const available = Math.max(0, remaining - prefixLength);
    if (available < 1) break;
    const boundedContent = content.length > available ? content.slice(0, available).trimEnd() : content;
    if (!boundedContent) continue;
    bounded.unshift({ ...message, content: boundedContent });
    remaining -= prefixLength + boundedContent.length;
  }

  return bounded;
}

export function selectRoleplayStoryboardEpisode(args: {
  messages: RoleplayStoryboardMessage[];
  currentMessageId: string;
  previousSuccessfulMessageId?: string | null;
  runInterval?: unknown;
  automatic?: boolean;
}): RoleplayStoryboardEpisodeSelection {
  const conversationMessages = args.messages.filter(
    (message) => message.role === "user" || isAssistantRole(message.role),
  );
  const currentIndex = conversationMessages.findIndex((message) => message.id === args.currentMessageId);
  if (currentIndex < 0) return { status: "skip", reason: "missing_message" };

  const currentMessage = conversationMessages[currentIndex]!;
  if (!isAssistantRole(currentMessage.role)) return { status: "skip", reason: "unsupported_message" };

  const episode = episodeMessagesSinceAnchor(
    conversationMessages,
    currentIndex,
    args.previousSuccessfulMessageId ?? null,
  );
  const sourceMessages = episode.messages;
  const assistantMessageCount = sourceMessages.filter((message) => isAssistantRole(message.role)).length;
  if (
    args.automatic === true &&
    args.previousSuccessfulMessageId &&
    episode.anchorResolved &&
    sourceMessages.length < normalizeRunInterval(args.runInterval)
  ) {
    return { status: "skip", reason: "interval" };
  }

  const boundedMessages = boundEpisodeMessages(sourceMessages);
  const sections = boundedMessages.map((message, index): RoleplayStoryboardEpisodeSection => {
    const user = message.role === "user";
    return {
      index,
      kind: user ? "user" : "assistant",
      speaker: user ? "User" : "Assistant",
      messageId: message.id,
      content: message.content,
    };
  });
  if (sections.length < 1) return { status: "skip", reason: "empty_source" };

  const sourceNarration = sections.map((section) => `${section.speaker}:\n${section.content}`).join("\n\n");
  return {
    status: "ready",
    messageId: currentMessage.id,
    swipeIndex: currentMessage.activeSwipeIndex ?? 0,
    assistantMessageCount,
    sections,
    sourceNarration,
    sourceNarrationHash: createHash("sha256").update(sourceNarration).digest("hex"),
  };
}
