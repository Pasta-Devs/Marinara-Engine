import type { AdvancedMemorySettings, PreparedAdvancedMemory } from "@marinara-engine/shared";
import type {
  AdvancedMemoryMessage,
  AdvancedMemoryOperationOptions,
  createAdvancedMemoryService,
} from "../advanced-memory.js";
import { measureContextBudget, type ChatMessage, type LLMToolDefinition } from "../llm/base-provider.js";
import {
  resolveAdvancedMemoryPrompt,
  describeAdvancedMemoryPlacements,
  type AdvancedMemoryPlacement,
} from "../prompt/advanced-memory-prompt.js";
import { filterPromptHistoryByMessageIds, type GenerationPromptMessage } from "./prompt-message-scope.js";

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
    toProviderMessages: (messages: GenerationPromptMessage[]) => ChatMessage[];
  },
) {
  const maxContext = Math.min(input.settings.maxContextTokens, input.maxContext ?? Infinity);
  // Unknown-model connections may omit max_tokens. Still reserve room for an answer.
  const maxTokens = input.maxTokens ?? 4096;
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
  // Usually one pass. The extra passes account for formatted history, macros and media estimates.
  for (let attempt = 0; attempt < 6 && budgetTokens > 0; attempt++) {
    prepared = await input.service.prepare({
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
      prepared.receipt.reasons.push("Optional recall omitted to fit the complete formatted request.");
    }
    if (budget.fits) {
      prepared.receipt.estimatedTokensBefore = measureContextBudget(
        input.toProviderMessages(resolveAdvancedMemoryPrompt(input.messages, input.placements, {})),
        { maxContext, maxTokens, tools: input.tools },
      ).estimatedTokens;
      prepared.receipt.estimatedTokensAfter = budget.estimatedTokens;
      prepared.receipt.budgetTokens = budget.inputBudget;
      return {
        messages,
        providerMessages,
        receipt: prepared.receipt,
        maxContext,
        maxTokens,
        placements: describeAdvancedMemoryPlacements(selected, input.placements),
      };
    }
    budgetTokens -= budget.estimatedTokens - budget.inputBudget + 64;
  }
  throw new Error(
    "Advanced Memory: the remaining scene or required input cannot fit the context cap. Increase the cap or reduce attachments, fixed instructions or reply space.",
  );
}
