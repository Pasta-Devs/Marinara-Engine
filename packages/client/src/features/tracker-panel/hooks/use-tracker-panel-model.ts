import { useCallback, useMemo } from "react";
import type { PresentCharacter } from "@marinara-engine/shared";
import { useAgentConfigs, type AgentConfigRow } from "../../../hooks/use-agents";
import { usePersona } from "../../../hooks/use-characters";
import {
  mergeTrackerCardPortraitFields,
  parseTrackerCardColorConfig,
  useTrackerCardColorPreviews,
} from "../../../lib/tracker-card-colors";
import { useChat, useChatMessagePeek } from "../../../hooks/use-chats";
import type { TrackerDataPanelSection } from "../../../stores/ui.store";
import { TRACKER_FEATURED_CHARACTER_META_KEY, TRACKER_SECTION_AGENT_TYPES } from "../lib/tracker-panel.constants";
import { normalizeMaybeJsonStringArray, normalizeStringArray, parseRecord } from "../lib/tracker-metadata";
import { resolveSpriteExpressionState } from "../../../lib/sprite-expression-state";
import { isSpriteLookupCharacterId } from "../lib/sprite-expressions";
import { useTrackerSpriteLookup } from "./use-tracker-sprite-lookup";

interface UseTrackerPanelModelOptions {
  activeChatId: string | null;
  presentCharacters: PresentCharacter[];
  trackerPanelSectionOrder: TrackerDataPanelSection[];
  trackerPanelUseExpressionSprites: boolean;
}

export function useTrackerPanelModel({
  activeChatId,
  presentCharacters,
  trackerPanelSectionOrder,
  trackerPanelUseExpressionSprites,
}: UseTrackerPanelModelOptions) {
  const { data: chat } = useChat(activeChatId);
  const chatMeta = useMemo(() => {
    const raw = (chat as unknown as { metadata?: string | Record<string, unknown> } | undefined)?.metadata;
    return parseRecord(raw);
  }, [chat]);
  const chatCharacterIds = useMemo(
    () => normalizeMaybeJsonStringArray((chat as unknown as { characterIds?: unknown } | undefined)?.characterIds),
    [chat],
  );
  const chatPersonaId = chat?.personaId?.trim() || null;
  const enabledAgentTypes = useMemo(() => {
    const set = new Set<string>();
    if (!chatMeta.enableAgents) return set;
    const activeAgentIds = Array.isArray(chatMeta.activeAgentIds) ? chatMeta.activeAgentIds : [];
    for (const id of activeAgentIds) {
      if (typeof id === "string") set.add(id);
    }
    return set;
  }, [chatMeta]);
  const expressionAgentEnabled = enabledAgentTypes.has("expression");
  const isSectionEnabled = useCallback(
    (section: TrackerDataPanelSection) => {
      const agentType = TRACKER_SECTION_AGENT_TYPES[section];
      return !!agentType && enabledAgentTypes.has(agentType);
    },
    [enabledAgentTypes],
  );
  const personaTrackerEnabled = isSectionEnabled("persona");
  const characterTrackerEnabled = isSectionEnabled("characters");
  const orderedTrackerSections = useMemo(
    () => trackerPanelSectionOrder.filter(isSectionEnabled),
    [isSectionEnabled, trackerPanelSectionOrder],
  );
  const spriteExpressionLookupEnabled =
    !!activeChatId &&
    trackerPanelUseExpressionSprites &&
    expressionAgentEnabled &&
    (personaTrackerEnabled || characterTrackerEnabled);
  const characterTrackerLookupEnabled = !!activeChatId && characterTrackerEnabled;
  const personaDataLookupEnabled = !!activeChatId && personaTrackerEnabled;
  const { data: messageData } = useChatMessagePeek(activeChatId, 20, spriteExpressionLookupEnabled);
  const { data: agentConfigs } = useAgentConfigs(characterTrackerLookupEnabled);
  const { data: activePersonaData } = usePersona(personaDataLookupEnabled ? chatPersonaId : null);
  const previewValues = useTrackerCardColorPreviews();
  const { characterSpriteLookup, hasPendingCharacterLookups, hasFailedCharacterLookups, resolveSpriteCharacterId } =
    useTrackerSpriteLookup({
      enabled: characterTrackerLookupEnabled,
      chatCharacterIds,
      presentCharacters,
    });
  const characterTrackerConfig = useMemo(() => {
    if (!Array.isArray(agentConfigs)) return null;
    return (agentConfigs as AgentConfigRow[]).find((agent) => agent.type === "character-tracker") ?? null;
  }, [agentConfigs]);
  const characterTrackerSettings = useMemo(
    () => parseRecord(characterTrackerConfig?.settings),
    [characterTrackerConfig],
  );
  const spriteExpressions = useMemo(
    () =>
      resolveSpriteExpressionState(
        (messageData ?? []) as Array<{
          extra?: unknown;
        }>,
        chatMeta.spriteExpressions,
      ),
    [messageData, chatMeta.spriteExpressions],
  );
  const featuredCharacterCardKeys = useMemo(
    () => new Set(normalizeStringArray(chatMeta[TRACKER_FEATURED_CHARACTER_META_KEY])),
    [chatMeta],
  );
  const activePersona = useMemo(() => {
    if (!activePersonaData) return null;
    const preview = previewValues.get(`persona:${activePersonaData.id}`);
    return preview
      ? {
          ...activePersonaData,
          trackerCardColors: mergeTrackerCardPortraitFields(
            parseTrackerCardColorConfig(preview),
            parseTrackerCardColorConfig(activePersonaData.trackerCardColors),
          ),
        }
      : activePersonaData;
  }, [activePersonaData, previewValues]);
  const expressionSpritesEnabled = trackerPanelUseExpressionSprites && expressionAgentEnabled;
  const resolveCardCharacterStatus = useCallback(
    (
      character: PresentCharacter,
    ): { status: "card"; characterId: string } | { status: "npc" | "pending" | "error" } => {
      const rawId = typeof character.characterId === "string" ? character.characterId.trim() : "";
      if (rawId && characterSpriteLookup.knownIds.has(rawId)) return { status: "card", characterId: rawId };
      if (!isSpriteLookupCharacterId(rawId) || rawId.includes(":cast:")) return { status: "npc" };
      const matched = resolveSpriteCharacterId(character);
      if (matched && characterSpriteLookup.knownIds.has(matched)) return { status: "card", characterId: matched };
      if (hasPendingCharacterLookups) return { status: "pending" };
      if (hasFailedCharacterLookups) return { status: "error" };
      return { status: "npc" };
    },
    [characterSpriteLookup.knownIds, hasFailedCharacterLookups, hasPendingCharacterLookups, resolveSpriteCharacterId],
  );

  return {
    activePersona,
    trackerStatIconOverrides: chatMeta.trackerStatIconOverrides,
    characterSpriteLookup,
    characterTrackerConfig,
    characterTrackerSettings,
    enabledAgentTypes,
    expressionSpritesEnabled,
    featuredCharacterCardKeys,
    orderedTrackerSections,
    resolveCardCharacterStatus,
    resolveSpriteCharacterId,
    spriteExpressions,
  };
}
