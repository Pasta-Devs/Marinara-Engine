import { LIMITS, type LorebookEntryTimingState } from "@marinara-engine/shared";
import type { createChatsStorage } from "../storage/chats.storage.js";
import { parseExtra } from "../../routes/generate/generate-route-utils.js";

type LorebookScanMessage = { role: "user" | "assistant" | "system"; content: string };

export function resolveLorebookGenerationTriggers(
  input: {
    impersonate?: boolean;
    regenerateMessageId?: string | null;
    userMessage?: string | null;
    generationGuide?: string | null;
    generationGuideSource?: "narrator" | "guide" | "game_start" | null;
  },
  chatMode: string,
): string[] {
  const triggers = new Set<string>();
  triggers.add(chatMode === "game" ? "game" : chatMode);

  if (input.impersonate) {
    triggers.add("impersonate");
  } else if (input.regenerateMessageId) {
    triggers.add("swipe");
    triggers.add("regenerate");
  } else if (
    input.generationGuide?.trim() &&
    (input.generationGuideSource === "narrator" || input.generationGuideSource === "guide")
  ) {
    triggers.add("chat");
  } else if (!input.userMessage?.trim()) {
    triggers.add("continue");
    triggers.add("autonomous");
  } else {
    triggers.add("chat");
  }

  return Array.from(triggers);
}

export function buildLorebookScanMessagesWithGenerationGuide(
  messages: LorebookScanMessage[],
  input: {
    generationGuide?: string | null;
    generationGuideSource?: "narrator" | "guide" | "game_start" | null;
  },
  resolveContent: (value: string) => string = (value) => value,
): LorebookScanMessage[] {
  const guide = input.generationGuide?.trim();
  if (!guide || (input.generationGuideSource !== "narrator" && input.generationGuideSource !== "guide")) {
    return messages;
  }
  const resolvedGuide = resolveContent(guide).trim();
  return resolvedGuide ? [...messages, { role: "user", content: resolvedGuide }] : messages;
}

export function resolveLorebookTokenBudget(meta: Record<string, unknown>): number {
  const raw = meta.lorebookTokenBudget ?? meta.generationLorebookTokenBudget;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
    return LIMITS.DEFAULT_LOREBOOK_TOKEN_BUDGET;
  }
  return Math.floor(raw);
}

export async function persistLorebookRuntimeState(args: {
  chats: ReturnType<typeof createChatsStorage>;
  chatId: string;
  fallbackMeta: Record<string, unknown>;
  entryStateOverrides?: Record<string, { ephemeral?: number | null; enabled?: boolean }>;
  entryTimingStates?: Record<string, LorebookEntryTimingState>;
}): Promise<void> {
  if (args.entryStateOverrides === undefined && args.entryTimingStates === undefined) return;
  const freshChat = await args.chats.getById(args.chatId);
  const freshMeta = freshChat ? (parseExtra(freshChat.metadata) as Record<string, unknown>) : args.fallbackMeta;
  await args.chats.updateMetadata(args.chatId, {
    ...freshMeta,
    ...(args.entryStateOverrides !== undefined ? { entryStateOverrides: args.entryStateOverrides } : {}),
    ...(args.entryTimingStates !== undefined ? { entryTimingStates: args.entryTimingStates } : {}),
  });
}

export function rememberKnowledgeRouterActivatedLorebookIds(
  targetActivated: Set<string>,
  targetExcludedFromKeywordScan: Set<string>,
  result: {
    activatedEntries: Array<{ id: string; matchedKeys: string[] }>;
    budgetSkippedEntries: Array<{ id: string; matchedKeys: string[] }>;
  },
): void {
  for (const entry of result.activatedEntries) {
    if (!entry.matchedKeys.some((key) => !key.startsWith("[semantic:"))) continue;
    targetActivated.add(entry.id);
  }
  for (const entry of result.budgetSkippedEntries) {
    targetExcludedFromKeywordScan.add(entry.id);
  }
}
