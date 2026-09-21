import type { AdvancedMemorySettings, PreparedAdvancedMemory } from "@marinara-engine/shared";
import { z } from "zod";
import type {
  AdvancedMemoryMessage,
  AdvancedMemoryOperationOptions,
  createAdvancedMemoryService,
} from "../advanced-memory.js";
import {
  contextWindowForInputBudget,
  measureContextBudget,
  type ChatMessage,
  type LLMToolDefinition,
} from "../llm/base-provider.js";
import {
  resolveAdvancedMemoryPrompt,
  describeAdvancedMemoryPlacements,
  type AdvancedMemoryPlacement,
} from "../prompt/advanced-memory-prompt.js";
import { filterPromptHistoryByMessageIds, type GenerationPromptMessage } from "./prompt-message-scope.js";

// Swipe extras can also come from imports or edits. Validate their shape before reuse.
const memorySnapshotSchema = z.object({
  audienceCharacterIds: z.array(z.string()),
  audienceMode: z.literal("owner").optional(),
  prepared: z.object({
    messageIds: z.array(z.string()),
    chatSummary: z.string().nullable(),
    currentSceneSummary: z.string().nullable(),
    recalledScenes: z.string().nullable(),
    recalledMessages: z.string().nullable(),
    recalledRecordIds: z.array(z.string()),
    receipt: z.object({
      sourceEndMessageId: z.string().nullable().optional(),
      sourceFingerprint: z.string(),
      policyRevision: z.string(),
      recordRevisions: z.record(z.string()),
      estimatedTokensBefore: z.number().finite().nonnegative(),
      estimatedTokensAfter: z.number().finite().nonnegative(),
      budgetTokens: z.number().finite().positive(),
      boundaryMessageId: z.string().nullable(),
      checkpointId: z.string().nullable(),
      recalledSceneIds: z.array(z.string()),
      recalledMessageIds: z.array(z.string()),
      reasons: z.array(z.string()),
    }),
  }),
});
export type AdvancedMemorySnapshot = z.infer<typeof memorySnapshotSchema>;

/** Reuse the prepared prompt: budgeting must not run lorebooks or agents a second time. */
export async function prepareAdvancedMemoryContext(
  input: AdvancedMemoryOperationOptions & {
    service: ReturnType<typeof createAdvancedMemoryService>;
    chatId: string;
    settings: AdvancedMemorySettings;
    sourceMessages: readonly AdvancedMemoryMessage[];
    messages: GenerationPromptMessage[];
    placements: AdvancedMemoryPlacement[];
    audienceCharacterIds: string[];
    audienceMode?: "owner";
    maxContext?: number;
    maxTokens?: number;
    tools?: LLMToolDefinition[];
    query?: string;
    readOnly?: boolean;
    /** Oldest swipe first; legacy replies acquire a snapshot on their next generation. */
    cachedSnapshots?: readonly unknown[];
    toProviderMessages: (messages: GenerationPromptMessage[]) => ChatMessage[];
  },
) {
  input.signal?.throwIfAborted();
  // Unknown-model connections may omit max_tokens. Still reserve room for an answer.
  const maxTokens = input.maxTokens ?? 4096;
  const maxContext = Math.min(
    contextWindowForInputBudget(input.settings.maxContextTokens, maxTokens),
    input.maxContext ?? Infinity,
  );
  const sourceIds = new Set(input.sourceMessages.map((message) => message.id));
  const fixed = input.toProviderMessages(
    resolveAdvancedMemoryPrompt(
      filterPromptHistoryByMessageIds(input.messages, new Set(), sourceIds),
      input.placements,
      {},
    ),
  );
  const fixedBudget = measureContextBudget(fixed, { maxContext, maxTokens, tools: input.tools });
  let budgetTokens = fixedBudget.inputBudget - fixedBudget.estimatedTokens;
  if (budgetTokens <= 0) {
    throw new Error(
      "Advanced Memory: fixed instructions, tools, attachments and reply space already fill the context cap. Reduce those inputs or increase the cap.",
    );
  }
  let prepared: PreparedAdvancedMemory | undefined;
  const audienceCharacterIds = [...new Set(input.audienceCharacterIds)].sort();
  const rejectedReceipts = new Set<string>();
  for (const value of input.cachedSnapshots ?? []) {
    const cached = memorySnapshotSchema.safeParse(value);
    if (
      !cached.success ||
      cached.data.audienceMode !== input.audienceMode ||
      JSON.stringify(cached.data.audienceCharacterIds) !== JSON.stringify(audienceCharacterIds)
    )
      continue;
    const receiptKey = JSON.stringify(cached.data.prepared.receipt);
    if (rejectedReceipts.has(receiptKey)) continue;
    try {
      await input.service.validatePrepared(input.chatId, input.sourceMessages, cached.data.prepared.receipt);
      input.signal?.throwIfAborted();
      prepared = cached.data.prepared;
      break;
    } catch {
      // Changed history, access, memory edits or a reset invalidate the old snapshot.
      input.signal?.throwIfAborted();
      rejectedReceipts.add(receiptKey);
    }
  }
  // Usually one pass. The extra passes account for formatted history, macros and media estimates.
  for (let attempt = 0; attempt < 6 && budgetTokens > 0; attempt++) {
    const reusedSnapshot = !!prepared;
    prepared ??= await input.service.prepare({
      chatId: input.chatId,
      messages: input.sourceMessages,
      audienceCharacterIds: input.audienceCharacterIds,
      audienceMode: input.audienceMode,
      budgetTokens,
      query: input.query,
      readOnly: input.readOnly,
      signal: input.signal,
      debugMode: input.debugMode,
      onProgress: input.onProgress,
      blocking: input.blocking,
    });
    const selectedIds = new Set(prepared.messageIds);
    const selected = filterPromptHistoryByMessageIds(input.messages, selectedIds, sourceIds);
    const parts = prepared;
    let messages = resolveAdvancedMemoryPrompt(selected, input.placements, parts);
    let providerMessages = input.toProviderMessages(messages);
    let budget = measureContextBudget(providerMessages, { maxContext, maxTokens, tools: input.tools });
    if (!budget.fits && (parts.recalledMessages || parts.recalledScenes)) {
      messages = resolveAdvancedMemoryPrompt(selected, input.placements, {
        ...parts,
        recalledMessages: null,
        recalledScenes: null,
      });
      providerMessages = input.toProviderMessages(messages);
      budget = measureContextBudget(providerMessages, { maxContext, maxTokens, tools: input.tools });
      for (const recordId of prepared.recalledRecordIds) {
        delete prepared.receipt.recordRevisions[recordId];
      }
      prepared.receipt.recalledMessageIds = [];
      prepared.receipt.recalledSceneIds = [];
      prepared.recalledMessages = null;
      prepared.recalledScenes = null;
      prepared.recalledRecordIds = [];
      prepared.receipt.reasons.push("Optional recall omitted to fit the complete formatted request.");
    }
    if (budget.fits) {
      prepared.receipt.estimatedTokensBefore = measureContextBudget(
        input.toProviderMessages(resolveAdvancedMemoryPrompt(input.messages, input.placements, {})),
        { maxContext, maxTokens, tools: input.tools },
      ).estimatedTokens;
      prepared.receipt.estimatedTokensAfter = budget.estimatedTokens;
      prepared.receipt.budgetTokens = budget.inputBudget;
      if (reusedSnapshot && !prepared.receipt.reasons.includes("reused-swipe-memory"))
        prepared.receipt.reasons.push("reused-swipe-memory");
      return {
        messages,
        providerMessages,
        receipt: prepared.receipt,
        maxContext,
        maxTokens,
        snapshot: { audienceCharacterIds, audienceMode: input.audienceMode, prepared } satisfies AdvancedMemorySnapshot,
        placements: describeAdvancedMemoryPlacements(selected, input.placements),
      };
    }
    // A saved selection may come from a larger cap. Refit against today's full
    // allowance before using overflow to refine a newly prepared selection.
    if (!reusedSnapshot) budgetTokens -= budget.estimatedTokens - budget.inputBudget + 64;
    prepared = undefined;
  }
  throw new Error(
    "Advanced Memory: the remaining scene or required input cannot fit the context cap. Increase the cap or reduce attachments, fixed instructions or reply space.",
  );
}
