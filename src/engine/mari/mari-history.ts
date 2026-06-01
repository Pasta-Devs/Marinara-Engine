import type { LlmGateway } from "../capabilities/llm";
import type { MariMessage } from "./mari-entry";

export const PROFESSOR_MARI_CHAT_ID = "professor-mari";
const MARI_COMPACTION_THRESHOLD = 0.8;
const DEFAULT_MAX_CONTEXT = 128_000;
const COMPACTION_TAIL_CONTEXT_SHARE = 0.25;
const COMPACTION_TAIL_MIN_MESSAGES = 16;
const COMPACTION_TAIL_MAX_MESSAGES = 48;
const COMPACTION_RESPONSE_TOKENS = 2048;

export type MariCompactionState = {
  compactedSummary: string | null;
  compactedAt: string | null;
  compactedThroughMessageId: string | null;
};

export type MariCompactionConnection = {
  id?: string | null;
  model?: string | null;
  maxContext?: unknown;
};

export const EMPTY_MARI_COMPACTION: MariCompactionState = {
  compactedSummary: null,
  compactedAt: null,
  compactedThroughMessageId: null,
};

export function isMariResetCommand(value: string): boolean {
  return value.trim().toLowerCase() === "/reset";
}

function estimateMariTextTokens(text: string): number {
  const trimmed = text.trim();
  return trimmed ? Math.max(1, Math.ceil(trimmed.length / 4)) : 0;
}

function messageTokens(message: MariMessage): number {
  return estimateMariTextTokens(message.content) + 8;
}

function readPositiveInteger(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function mariConnectionMaxContext(connection: MariCompactionConnection | null | undefined): number {
  return readPositiveInteger(connection?.maxContext) ?? DEFAULT_MAX_CONTEXT;
}

function compactedThroughIndex(messages: MariMessage[], compaction: MariCompactionState): number {
  const id = compaction.compactedThroughMessageId;
  if (!id) return -1;
  return messages.findIndex((message) => message.id === id);
}

export function mariContextMessages(messages: MariMessage[], compaction: MariCompactionState): MariMessage[] {
  const index = compactedThroughIndex(messages, compaction);
  return index >= 0 ? messages.slice(index + 1) : messages;
}

function estimateMariContextTokens(messages: MariMessage[], compaction: MariCompactionState): number {
  const summaryTokens = estimateMariTextTokens(compaction.compactedSummary ?? "");
  return (
    summaryTokens +
    mariContextMessages(messages, compaction).reduce((total, message) => total + messageTokens(message), 0) +
    512
  );
}

function shouldCompactMariHistory(
  messages: MariMessage[],
  compaction: MariCompactionState,
  connection: MariCompactionConnection | null | undefined,
): boolean {
  const maxContext = mariConnectionMaxContext(connection);
  const threshold = Math.floor(maxContext * MARI_COMPACTION_THRESHOLD);
  if (estimateMariContextTokens(messages, compaction) < threshold) return false;
  return messages.length - compactedThroughIndex(messages, compaction) > COMPACTION_TAIL_MIN_MESSAGES + 2;
}

function selectRecentTail(messages: MariMessage[], maxContext: number): MariMessage[] {
  const tokenBudget = Math.max(1024, Math.floor(maxContext * COMPACTION_TAIL_CONTEXT_SHARE));
  const tail: MariMessage[] = [];
  let tokens = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    const nextTokens = tokens + messageTokens(message);
    if (
      tail.length >= COMPACTION_TAIL_MIN_MESSAGES &&
      (nextTokens > tokenBudget || tail.length >= COMPACTION_TAIL_MAX_MESSAGES)
    ) {
      break;
    }
    tail.unshift(message);
    tokens = nextTokens;
  }

  return tail;
}

function fitCompactionTranscript(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  const headChars = Math.floor(maxChars * 0.35);
  const tailChars = Math.floor(maxChars * 0.6);
  return `${value.slice(0, headChars)}\n\n[Transcript middle omitted during compaction input trimming.]\n\n${value.slice(-tailChars)}`;
}

function formatCompactionTranscript(messages: MariMessage[], maxContext: number): string {
  const transcript = messages
    .map((message) => `${message.role === "assistant" ? "Professor Mari" : "User"}: ${message.content.trim()}`)
    .filter((line) => line.trim().length > 0)
    .join("\n\n");
  const maxChars = Math.max(12_000, Math.min(96_000, Math.floor(maxContext * 2.4)));
  return fitCompactionTranscript(transcript, maxChars);
}

function normalizeCompactionSummary(value: string): string {
  return value
    .trim()
    .replace(/^```(?:markdown|md|text)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

export async function compactProfessorMariHistory({
  messages,
  compaction,
  connection,
  llm,
}: {
  messages: MariMessage[];
  compaction: MariCompactionState;
  connection: MariCompactionConnection;
  llm: LlmGateway;
}): Promise<{ compacted: boolean; compaction: MariCompactionState }> {
  if (!shouldCompactMariHistory(messages, compaction, connection)) {
    return { compacted: false, compaction };
  }

  const maxContext = mariConnectionMaxContext(connection);
  const recentTail = selectRecentTail(messages, maxContext);
  const tailStartId = recentTail[0]?.id;
  const tailStartIndex = tailStartId ? messages.findIndex((message) => message.id === tailStartId) : messages.length;
  const firstUncompactedIndex = compactedThroughIndex(messages, compaction) + 1;
  const messagesToCompact = messages.slice(firstUncompactedIndex, Math.max(firstUncompactedIndex, tailStartIndex));
  const compactedThroughMessageId = messagesToCompact.at(-1)?.id ?? compaction.compactedThroughMessageId;

  if (!messagesToCompact.length || !compactedThroughMessageId) {
    return { compacted: false, compaction };
  }

  const previousSummary = compaction.compactedSummary?.trim()
    ? `Existing compact summary:\n${compaction.compactedSummary.trim()}`
    : "Existing compact summary: none";
  const transcript = formatCompactionTranscript(messagesToCompact, maxContext);
  const summary = normalizeCompactionSummary(
    await llm.complete({
      connectionId: connection.id ?? null,
      model: connection.model ?? undefined,
      messages: [
        {
          role: "system",
          content: [
            "You compact Professor Mari's conversation history for future turns.",
            "Preserve durable user preferences, implementation decisions, unresolved tasks, important discoveries, and the latest project state.",
            "Discard greetings, filler, repeated status updates, and details superseded by later messages.",
            "Write concise but specific notes that Professor Mari can rely on as memory. Do not answer the user.",
          ].join("\n"),
        },
        {
          role: "user",
          content: `${previousSummary}\n\nTranscript to merge into the compact summary:\n${transcript}`,
        },
      ],
      parameters: {
        temperature: 0.2,
        maxTokens: COMPACTION_RESPONSE_TOKENS,
      },
    }),
  );

  return {
    compacted: true,
    compaction: {
      compactedSummary: summary,
      compactedAt: new Date().toISOString(),
      compactedThroughMessageId,
    },
  };
}
