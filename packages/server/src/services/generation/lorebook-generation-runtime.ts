import { LIMITS, type LorebookEntryTimingState } from "@marinara-engine/shared";
import { isDeepStrictEqual } from "node:util";
import type { DB } from "../../db/connection.js";
import { inArray } from "../../db/file-query.js";
import { lorebookEntries } from "../../db/schema/index.js";
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
  db: DB;
  chats: ReturnType<typeof createChatsStorage>;
  chatId: string;
  fallbackMeta: Record<string, unknown>;
  entryStateOverrides?: Record<string, { ephemeral?: number | null; enabled?: boolean }>;
  entryTimingStates?: Record<string, LorebookEntryTimingState>;
}): Promise<Record<string, unknown>> {
  if (args.entryStateOverrides === undefined && args.entryTimingStates === undefined) return {};
  type Overrides = NonNullable<typeof args.entryStateOverrides>;
  type TimingStates = NonNullable<typeof args.entryTimingStates>;
  const beforeOverrides = (args.fallbackMeta.entryStateOverrides ??
    args.fallbackMeta.lorebookEntryStateOverrides ??
    {}) as Overrides;
  const beforeTiming = (args.fallbackMeta.entryTimingStates ??
    args.fallbackMeta.lorebookEntryTimingStates ??
    {}) as TimingStates;
  const updated = await args.chats.patchMetadata(args.chatId, async (current) => {
    const currentOverrides = (current.entryStateOverrides ?? current.lorebookEntryStateOverrides ?? {}) as Overrides;
    const currentTiming = (current.entryTimingStates ?? current.lorebookEntryTimingStates ?? {}) as TimingStates;
    const overrides = { ...currentOverrides };
    const timing = { ...currentTiming };
    const changedIds = new Set<string>();
    for (const [before, next] of [
      [beforeOverrides, args.entryStateOverrides],
      [beforeTiming, args.entryTimingStates],
    ] as const) {
      if (!next) continue;
      for (const id of new Set([...Object.keys(before), ...Object.keys(next)])) {
        if (!isDeepStrictEqual(before[id], next[id])) changedIds.add(id);
      }
    }
    // Deletion holds this same metadata queue. Check live IDs inside it, so a
    // late scan cannot recreate state that deletion or an explicit detach cleared.
    const detachedBooks = new Set(
      Array.isArray(args.fallbackMeta.activeLorebookIds)
        ? args.fallbackMeta.activeLorebookIds.filter(
            (id) => !Array.isArray(current.activeLorebookIds) || !current.activeLorebookIds.includes(id),
          )
        : [],
    );
    const entries = changedIds.size
      ? await args.db
          .select({ id: lorebookEntries.id, lorebookId: lorebookEntries.lorebookId, enabled: lorebookEntries.enabled })
          .from(lorebookEntries)
          .where(inArray(lorebookEntries.id, [...changedIds]))
      : [];
    for (const entry of entries) {
      const id = entry.id;
      if (entry.enabled !== "true" || detachedBooks.has(entry.lorebookId)) continue;
      // A user's newer toggle/reset wins over this scan's old snapshot.
      if (!isDeepStrictEqual(currentOverrides[id], beforeOverrides[id])) continue;
      const next = args.entryStateOverrides?.[id];
      if (next?.ephemeral !== undefined && next.ephemeral !== beforeOverrides[id]?.ephemeral) {
        overrides[id] = {
          ...currentOverrides[id],
          ephemeral: next.ephemeral,
          ...(next.ephemeral !== null && next.ephemeral <= 0 && next.enabled === false ? { enabled: false } : {}),
        };
      }
      if (args.entryTimingStates && isDeepStrictEqual(currentTiming[id], beforeTiming[id])) {
        const nextTiming = args.entryTimingStates[id];
        if (nextTiming) timing[id] = nextTiming;
        else delete timing[id];
      }
    }
    return {
      ...(args.entryStateOverrides !== undefined ? { entryStateOverrides: overrides } : {}),
      ...(args.entryTimingStates !== undefined ? { entryTimingStates: timing } : {}),
    };
  });
  if (!updated) return {};
  const metadata = parseExtra(updated.metadata);
  return {
    ...(args.entryStateOverrides !== undefined ? { entryStateOverrides: metadata.entryStateOverrides } : {}),
    ...(args.entryTimingStates !== undefined ? { entryTimingStates: metadata.entryTimingStates } : {}),
  };
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
