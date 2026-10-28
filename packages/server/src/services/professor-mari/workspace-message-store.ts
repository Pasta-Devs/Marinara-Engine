// How Professor Mari's turns are stored in a chat: the user message's run-start extra and the assistant
// message with its extra (timeline, deferral marker, continuity, usage). Runtime-agnostic, so any
// runtime that drives her stores an identical record.
import type { LLMUsage } from "../llm/base-provider.js";
import { MARI_AUTHORIZATION_ACCEPT_CHIP, mergeMariActionResults, PROFESSOR_MARI_ID } from "@marinara-engine/shared";
import type {
  MariHeldChange,
  MariSuggestionChip,
  MariWorkspaceActionResult,
  MariWorkspaceTraceItem,
  ProfessorMariAskContext,
} from "@marinara-engine/shared";
import type { createChatsStorage } from "../storage/chats.storage.js";
import { handbookTurnFromResults } from "./sticky-handbooks.js";
import {
  buildWorkspaceContinuitySnapshot,
  sanitizeTraceForStorage,
  type WorkspaceCommandCall,
  type WorkspaceCommandResult,
} from "./workspace-agent.service.js";

type ChatStorage = ReturnType<typeof createChatsStorage>;

/** Marks the user message as the start of a run (a retry reuses it, so the earlier failure is cleared). */
export async function saveRunStart(
  chatStorage: ChatStorage,
  userMessageId: string,
  run: { attachments: unknown[]; context: ProfessorMariAskContext | undefined; runStartedAt: number },
) {
  const userMessageExtra = {
    ...(run.attachments.length > 0 ? { attachments: run.attachments } : {}),
    professorMariContext: run.context ?? null,
    // A retry reuses this message: its earlier failure is answered now.
    mariRunError: null,
    // The run's clock, on the server, so a reload mid-run resumes from the true start.
    mariRunStartedAt: run.runStartedAt,
  };
  await chatStorage.updateMessageExtra(userMessageId, userMessageExtra);
  await chatStorage.updateSwipeExtra(userMessageId, 0, userMessageExtra);
}

export function createAssistantMessage(chatStorage: ChatStorage, chatId: string, content: string) {
  return chatStorage.createMessage({
    chatId,
    role: "assistant",
    characterId: PROFESSOR_MARI_ID,
    content,
  });
}

export type AssistantRunRecord = {
  context: ProfessorMariAskContext | undefined;
  promptText: string;
  /** The saved (trimmed) visible answer. */
  assistantText: string;
  thinkingText: string;
  trace: MariWorkspaceTraceItem[];
  actionResults: MariWorkspaceActionResult[];
  commandResults: WorkspaceCommandResult[];
  /** #5725 Manual mode: the run ended by deferring mutating commands behind the Accept action. */
  endedWithDeferral: boolean;
  heldChanges: MariHeldChange[];
  /** The raw held commands the Accept action applies server-side. */
  heldCalls: WorkspaceCommandCall[];
  runError: { message: string } | null;
  runStartedAt: number;
  suggestions: MariSuggestionChip[];
  connection: { provider: string; model: string };
  latestUsage: LLMUsage | undefined;
  latestFinishReason: string | null;
  totalUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
};

export function buildAssistantMessageExtra(run: AssistantRunRecord): Record<string, unknown> {
  const extraUpdate: Record<string, unknown> = {};
  if (run.endedWithDeferral) extraUpdate.mariDeferredMutations = true;
  if (run.endedWithDeferral && run.heldChanges.length > 0) extraUpdate.mariHeldChanges = run.heldChanges;
  if (run.endedWithDeferral && run.heldCalls.length > 0) extraUpdate.mariHeldCalls = run.heldCalls;
  const storedTrace = sanitizeTraceForStorage(run.trace);
  if (run.thinkingText.trim()) extraUpdate.thinking = run.thinkingText;
  if (storedTrace.length > 0) extraUpdate.mariWorkspaceTimeline = storedTrace;
  if (run.actionResults.length > 0) {
    extraUpdate.mariWorkspaceActionResults = mergeMariActionResults(run.actionResults);
  }
  if (run.runError) extraUpdate.mariRunError = run.runError;
  extraUpdate.mariRunStartedAt = run.runStartedAt;
  extraUpdate.mariRunFinishedAt = Date.now();
  const savedChips = run.suggestions.filter((chip) => chip.id !== MARI_AUTHORIZATION_ACCEPT_CHIP.id);
  if (savedChips.length > 0) extraUpdate.mariSuggestions = savedChips;
  extraUpdate.professorMariContext = run.context ?? null;
  const continuity = buildWorkspaceContinuitySnapshot({
    userText: run.promptText,
    assistantText: run.assistantText,
    commandResults: run.commandResults,
  });
  if (continuity) extraUpdate.mariWorkspaceContinuity = continuity;
  // #8391: what this turn did with handbooks, so the next turn knows which ones to keep in context.
  extraUpdate.mariHandbooks = handbookTurnFromResults(run.commandResults, run.endedWithDeferral ? run.heldCalls : []);
  extraUpdate.generationInfo = {
    provider: run.connection.provider,
    model: run.connection.model,
    temperature: null,
    tokensPrompt: run.latestUsage?.promptTokens ?? null,
    tokensCompletion: run.latestUsage?.completionTokens ?? null,
    durationMs: null,
    finishReason: run.latestFinishReason,
    // A run with no model request (Accept) reports no usage, so the context meter keeps the last real reading.
    ...(run.latestUsage ? { usage: run.totalUsage } : {}),
  };
  return extraUpdate;
}

/** Writes the assistant message's extra and its first swipe's extra. */
export async function saveAssistantMessageExtra(chatStorage: ChatStorage, messageId: string, run: AssistantRunRecord) {
  const extraUpdate = buildAssistantMessageExtra(run);
  await chatStorage.updateMessageExtra(messageId, extraUpdate);
  await chatStorage.updateSwipeExtra(messageId, 0, extraUpdate);
}
