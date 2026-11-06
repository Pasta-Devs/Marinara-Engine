import type { AgentContext, Lorebook, LorebookEntry } from "@marinara-engine/shared";
import { buildLorebookSemanticEmbeddingsById } from "../lorebook/embeddings.js";
import {
  lorebookEntryPassesContextFilters,
  scanForActivatedEntries,
  type GameStateForScanning,
} from "../lorebook/keyword-scanner.js";
import { applyTokenBudget } from "../lorebook/prompt-injector.js";
import type { MemoryRecallEmbeddingSource } from "../memory-recall.js";
import { logger } from "../../lib/logger.js";

type LorebookSource = "manual" | "chat_active" | "none";
type TriggeredEntriesByAgentId = NonNullable<AgentContext["triggeredLorebookEntriesByAgentId"]>;

/** Apply only this chat's attachment, leaving the saved agent configuration untouched. */
export function applyAgentLorebookChatSettings(
  agentType: string,
  settings: Record<string, unknown>,
  chatMetadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const attachments = chatMetadata?.agentLorebookAttachments;
  if (!attachments || typeof attachments !== "object" || Array.isArray(attachments)) return settings;
  const attachment = (attachments as Record<string, unknown>)[agentType];
  if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) return settings;
  const value = attachment as Record<string, unknown>;
  if (value.enabled !== true) return settings;
  const lorebookId = typeof value.lorebookId === "string" ? value.lorebookId.trim() : "";
  if (!lorebookId) return settings;
  return {
    ...settings,
    chatLorebookAttachmentEnabled: true,
    chatAttachedLorebookId: lorebookId,
  };
}

export interface AgentLorebookTriggerSource {
  id: string;
  contextSize: number;
  sourceLorebookIds: string[];
  source: LorebookSource;
  /** Chat attachments supplement the configured source using manual-selection policy. */
  additionalManualLorebookIds?: string[];
}

interface PreparedAgentLorebookSource {
  entries: LorebookEntry[];
  lorebooks: Lorebook[];
}

export interface AgentLorebookTriggerResolverOptions {
  agents: AgentLorebookTriggerSource[];
  activeCharacterIds: string[];
  activeCharacterTags: string[];
  embeddingSource?: MemoryRecallEmbeddingSource | null;
  entryStateOverrides: Record<string, { enabled?: boolean; ephemeral?: number | null }>;
  filterSourceLorebookIds: (sourceIds: string[], source: LorebookSource) => Promise<string[]>;
  gameState: GameStateForScanning | null;
  generationTriggers: string[];
  /** Current generation instructions supplement history without consuming its message-depth slots. */
  supplementalScanMessages?: AgentContext["recentMessages"];
  listEntriesByLorebookIds: (sourceIds: string[]) => Promise<LorebookEntry[]>;
  listLorebooks: () => Promise<Lorebook[]>;
  resolveContent: (value: string) => string;
  signal?: AbortSignal;
  tokenBudget: number;
  vectorizerAvailable: boolean;
}

/**
 * Build a request-scoped resolver for custom-agent lorebook triggers.
 *
 * Lorebooks, filtered source entries, and character filters are prepared once
 * and reused by both the initial and post-processing scans. Independent agents
 * resolve concurrently, including their semantic embedding work.
 */
export function createAgentLorebookTriggerResolver(
  options: AgentLorebookTriggerResolverOptions,
): (contextMessages: AgentContext["recentMessages"]) => Promise<TriggeredEntriesByAgentId> {
  let enabledLorebooksByIdPromise: Promise<Map<string, Lorebook>> | null = null;
  const getEnabledLorebooksById = () => {
    enabledLorebooksByIdPromise ??= options
      .listLorebooks()
      .then(
        (lorebooks) =>
          new Map(
            lorebooks
              .filter((lorebook) => lorebook.enabled !== false)
              .map((lorebook) => [lorebook.id, lorebook] as const),
          ),
      );
    return enabledLorebooksByIdPromise;
  };
  const entriesBySourceKey = new Map<string, Promise<LorebookEntry[]>>();
  const preparedSourceByAgentId = new Map<string, Promise<PreparedAgentLorebookSource>>();

  const prepareAgentSource = (agent: AgentLorebookTriggerSource): Promise<PreparedAgentLorebookSource> => {
    const cached = preparedSourceByAgentId.get(agent.id);
    if (cached) return cached;

    const prepared = (async () => {
      const enabledLorebooksById = await getEnabledLorebooksById();
      const filteredSources = await Promise.all([
        options.filterSourceLorebookIds(agent.sourceLorebookIds, agent.source),
        agent.additionalManualLorebookIds?.length
          ? options.filterSourceLorebookIds(agent.additionalManualLorebookIds, "manual")
          : [],
      ]);
      const sourceIds = [...new Set(filteredSources.flat().filter((id) => enabledLorebooksById.has(id)))].sort();
      if (sourceIds.length === 0) return { entries: [], lorebooks: [] };

      const sourceKey = sourceIds.join("\u0000");
      let entriesPromise = entriesBySourceKey.get(sourceKey);
      if (!entriesPromise) {
        const sourceIdSet = new Set(sourceIds);
        entriesPromise = options
          .listEntriesByLorebookIds(sourceIds)
          .then((entries) => [
            ...new Map(
              entries.filter((entry) => sourceIdSet.has(entry.lorebookId)).map((entry) => [entry.id, entry]),
            ).values(),
          ]);
        entriesBySourceKey.set(sourceKey, entriesPromise);
      }

      const entries = (await entriesPromise)
        .filter((entry) => {
          const override = options.entryStateOverrides[entry.id];
          if ((override?.enabled ?? entry.enabled !== false) === false) return false;
          if ((override?.ephemeral ?? entry.ephemeral) === 0) return false;
          return lorebookEntryPassesContextFilters(entry, {
            activeCharacterIds: options.activeCharacterIds,
            activeCharacterTags: options.activeCharacterTags,
            generationTriggers: options.generationTriggers,
          });
        })
        .map((entry) => {
          const override = options.entryStateOverrides[entry.id];
          if (override?.enabled === undefined && override?.ephemeral === undefined) return entry;
          return {
            ...entry,
            ...(override.enabled !== undefined ? { enabled: override.enabled } : {}),
            ...(override.ephemeral !== undefined ? { ephemeral: override.ephemeral } : {}),
          };
        });
      const lorebooks = sourceIds.flatMap((id) => {
        const lorebook = enabledLorebooksById.get(id);
        return lorebook ? [lorebook] : [];
      });
      return { entries, lorebooks };
    })();

    preparedSourceByAgentId.set(agent.id, prepared);
    return prepared;
  };

  return async (contextMessages) => {
    const resolved = await Promise.all(
      options.agents.map(async (agent) => {
        const source = await prepareAgentSource(agent);
        if (source.entries.length === 0) return [agent.id, []] as const;

        const scanMessages = contextMessages.slice(-agent.contextSize).map((message) => ({
          role: message.role,
          content: message.content,
        }));
        const supplemental = options.supplementalScanMessages ?? [];
        // Embeddings retain the guide's user role; keyword depth still counts only historical messages.
        const semanticScanMessages = supplemental.length ? [...scanMessages, ...supplemental] : scanMessages;
        const supplementalText = supplemental.map((message) => message.content).join("\n");
        if (supplementalText) {
          const latest = scanMessages.at(-1);
          if (latest)
            scanMessages[scanMessages.length - 1] = { ...latest, content: `${latest.content}\n${supplementalText}` };
          else scanMessages.push({ role: "user", content: supplementalText });
        }
        let chatEmbedding: number[] | null = null;
        let semanticEmbeddingsByLorebookId: Map<string, number[] | number[][] | null> | undefined;
        let semanticSimilarityBaseline = 0;
        let semanticEmbeddingSpaceId: string | null = null;
        if (
          source.entries.some((entry) => Array.isArray(entry.embedding) && entry.embedding.length > 0) &&
          options.vectorizerAvailable
        ) {
          try {
            const semanticEmbeddings = await buildLorebookSemanticEmbeddingsById({
              lorebooks: source.lorebooks,
              entries: source.entries,
              scanMessages: semanticScanMessages,
              embeddingSource: options.embeddingSource,
              signal: options.signal,
            });
            chatEmbedding = semanticEmbeddings.defaultEmbedding;
            semanticEmbeddingsByLorebookId = semanticEmbeddings.embeddingsByLorebookId;
            semanticSimilarityBaseline = semanticEmbeddings.similarityBaseline;
            semanticEmbeddingSpaceId = semanticEmbeddings.embeddingSpaceId;
          } catch (err) {
            logger.warn(
              err,
              "Semantic lorebook retrieval failed for agent %s; falling back to keyword matching",
              agent.id,
            );
          }
        }

        const activated = scanForActivatedEntries(scanMessages, source.entries, {
          scanDepth: agent.contextSize,
          gameState: options.gameState,
          chatEmbedding,
          semanticEmbeddingsByLorebookId,
          semanticEmbeddingSpaceId,
          semanticSimilarityBaseline,
          activeCharacterIds: options.activeCharacterIds,
          activeCharacterTags: options.activeCharacterTags,
          generationTriggers: options.generationTriggers,
          ignoreTiming: true,
        });
        return [agent.id, applyTokenBudget(activated, options.tokenBudget)] as const;
      }),
    );

    return Object.fromEntries(
      resolved.map(([agentId, budgeted]) => [
        agentId,
        budgeted.map((match) => ({
          id: match.entry.id,
          name: match.entry.name,
          content: options.resolveContent(match.entry.content),
          matchedKeys: match.matchedKeys,
          activationSources: match.activationSources,
        })),
      ]),
    ) as TriggeredEntriesByAgentId;
  };
}
