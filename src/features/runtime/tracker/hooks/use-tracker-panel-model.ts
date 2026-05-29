import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Message } from "../../../../engine/contracts/types/chat";
import type { PresentCharacter } from "../../../../engine/contracts/types/game-state";
import type { Persona } from "../../../../engine/contracts/types/persona";
import { storageApi } from "../../../../shared/api/storage-api";
import { parseCharacterDisplayData } from "../../../../shared/lib/character-display";
import {
  addAliasLookups,
  addExactNameLookups,
  normalizeMaybeJsonStringArray,
} from "../../../../shared/lib/tracker-metadata";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { useUIStore } from "../../../../shared/stores/ui.store";
import type { TrackerPanelSizeProfile, TrackerPanelSide, TrackerTemperatureUnit, TrackerThoughtBubbleDisplay } from "../../../../shared/stores/ui.store";
import { chatKeys, preserveRecentMessageContentEdit, useChat } from "../../../catalog/chats/index";
import { useCharacters, usePersonas } from "../../../catalog/characters/index";
import { useTrackerStateController } from "../../world-state/index";
import {
  TRACKER_SECTION_AGENT_TYPES,
  type TrackerPanelSection,
} from "../../world-state/index";
import type { TrackerStateController } from "../../world-state/types";
import { useFeaturedCharacterCards } from "./use-featured-character-cards";
import { getCharacterProfileColors } from "../components/tracker-character-profile-style";
import type { TrackerProfileColors } from "../components/tracker-profile-colors";
import {
  getLatestSpriteExpressionsFromMessages,
  normalizeLookupText,
  normalizeSpriteExpressionMap,
  parseMetadataRecord,
} from "../components/tracker-metadata.helpers";
import { isSpriteLookupCharacterId } from "../components/tracker-sprite.helpers";

const TRACKER_SPRITE_MESSAGE_LIMIT = 20;

function useTrackerSpriteMessages(chatId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [
      ...chatKeys.messages(chatId ?? ""),
      "tracker-sprite-expressions",
      TRACKER_SPRITE_MESSAGE_LIMIT,
    ],
    queryFn: () =>
      storageApi
        .listChatMessages<Message>(chatId!, { limit: TRACKER_SPRITE_MESSAGE_LIMIT })
        .then((messages) =>
          chatId ? messages.map((message) => preserveRecentMessageContentEdit(chatId, message)) : messages,
        ),
    enabled: !!chatId && enabled,
  });
}

export interface TrackerSpriteLookup {
  knownIds: Set<string>;
  idByName: Map<string, string>;
  pictureById: Record<string, string>;
  profileColorsById: Record<string, TrackerProfileColors>;
}

export interface TrackerPanelModel extends TrackerStateController {
  activeChatId: string | null;
  activePersona: Persona | null;
  agentConfigLookupEnabled: boolean;
  characterSpriteLookup: TrackerSpriteLookup;
  enabledAgentTypes: Set<string>;
  expressionSpritesEnabled: boolean;
  featuredCharacterCards: Set<string>;
  hasFixedTrackerPanel: boolean;
  orderedTrackerSections: TrackerPanelSection[];
  removeFeaturedCharacterCard: (key: string) => void;
  resolveSpriteCharacterId: (character: PresentCharacter) => string | null;
  setTrackerPanelOpen: (open: boolean) => void;
  setTrackerPanelSide: (side: TrackerPanelSide) => void;
  setTrackerPanelSizeProfile: (profile: TrackerPanelSizeProfile) => void;
  showTrackerSections: boolean;
  spriteExpressions: Record<string, string>;
  toggleFeaturedCharacterCard: (key: string) => void;
  toggleTrackerPanelSectionCollapsed: (section: TrackerPanelSection) => void;
  trackerPanelCollapsedSections: Record<string, boolean | undefined>;
  trackerPanelDockedThoughtsAlwaysVisible: boolean;
  trackerPanelSide: TrackerPanelSide;
  trackerPanelSizeProfile: TrackerPanelSizeProfile;
  trackerPanelThoughtBubbleDisplay: TrackerThoughtBubbleDisplay;
  trackerTemperatureUnit: TrackerTemperatureUnit;
}

export function useTrackerPanelModel(): TrackerPanelModel {
  const activeChatId = useChatStore((s) => s.activeChatId);
  const trackerPanelSide = useUIStore((s) => s.trackerPanelSide);
  const trackerPanelCollapsedSections = useUIStore((s) => s.trackerPanelCollapsedSections);
  const trackerPanelSectionOrder = useUIStore((s) => s.trackerPanelSectionOrder);
  const trackerPanelUseExpressionSprites = useUIStore((s) => s.trackerPanelUseExpressionSprites);
  const trackerPanelThoughtBubbleDisplay = useUIStore((s) => s.trackerPanelThoughtBubbleDisplay);
  const trackerPanelDockedThoughtsAlwaysVisible = useUIStore((s) => s.trackerPanelDockedThoughtsAlwaysVisible);
  const trackerPanelSizeProfile = useUIStore((s) => s.trackerPanelSizeProfile);
  const trackerTemperatureUnit = useUIStore((s) => s.trackerTemperatureUnit);
  const toggleTrackerPanelSectionCollapsed = useUIStore((s) => s.toggleTrackerPanelSectionCollapsed);
  const setTrackerPanelOpen = useUIStore((s) => s.setTrackerPanelOpen);
  const setTrackerPanelSide = useUIStore((s) => s.setTrackerPanelSide);
  const setTrackerPanelSizeProfile = useUIStore((s) => s.setTrackerPanelSizeProfile);
  const { data: chat } = useChat(activeChatId);

  const chatMeta = useMemo(() => {
    const raw = (chat as unknown as { metadata?: string | Record<string, unknown> } | undefined)?.metadata;
    return parseMetadataRecord(raw);
  }, [chat]);

  const chatCharacterIds = useMemo(
    () => normalizeMaybeJsonStringArray((chat as unknown as { characterIds?: unknown } | undefined)?.characterIds),
    [chat],
  );

  const enabledAgentTypes = useMemo(() => {
    const set = new Set<string>();
    if (!chatMeta.enableAgents) return set;
    const activeAgentIds = Array.isArray(chatMeta.activeAgentIds) ? chatMeta.activeAgentIds : [];
    for (const id of activeAgentIds) {
      if (typeof id === "string") set.add(id);
    }
    return set;
  }, [chatMeta]);

  const isSectionEnabled = useCallback(
    (section: TrackerPanelSection) => {
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
  const expressionAgentEnabled = enabledAgentTypes.has("expression");
  const spriteExpressionLookupEnabled =
    !!activeChatId &&
    trackerPanelUseExpressionSprites &&
    expressionAgentEnabled &&
    (personaTrackerEnabled || characterTrackerEnabled);
  const characterDataLookupEnabled = !!activeChatId && characterTrackerEnabled;
  const personaDataLookupEnabled = !!activeChatId && personaTrackerEnabled;
  const agentConfigLookupEnabled = !!activeChatId && characterTrackerEnabled;
  const { data: messageData } = useTrackerSpriteMessages(activeChatId, spriteExpressionLookupEnabled);
  const { data: charactersData } = useCharacters(characterDataLookupEnabled);
  const { data: personasData } = usePersonas(personaDataLookupEnabled);

  const characterSpriteLookup = useMemo(() => {
    const rows = (
      Array.isArray(charactersData)
        ? (charactersData as Array<{ id: string; data: unknown; comment?: string | null; avatarPath?: string | null }>)
        : []
    ).filter((character) => typeof character.id === "string" && character.id.length > 0);
    const chatIdSet = new Set(chatCharacterIds);
    const displayRows = rows.map((character) => ({
      character,
      display: parseCharacterDisplayData(character),
    }));
    const chatDisplayRows = displayRows.filter(({ character }) => chatIdSet.has(character.id));
    const fallbackDisplayRows = displayRows.filter(({ character }) => !chatIdSet.has(character.id));
    const knownIds = new Set(rows.map((character) => character.id));
    const idByName = new Map<string, string>();
    const pictureById: Record<string, string> = {};
    const profileColorsById: Record<string, TrackerProfileColors> = {};
    for (const { character } of displayRows) {
      if (character.avatarPath) pictureById[character.id] = character.avatarPath;
      const profileColors = getCharacterProfileColors(character.data);
      if (profileColors) profileColorsById[character.id] = profileColors;
    }
    addExactNameLookups(chatDisplayRows, idByName);
    addAliasLookups(chatDisplayRows, idByName);
    addExactNameLookups(fallbackDisplayRows, idByName);
    addAliasLookups(fallbackDisplayRows, idByName);
    return { knownIds, idByName, pictureById, profileColorsById };
  }, [charactersData, chatCharacterIds]);

  const resolveSpriteCharacterId = useCallback(
    (character: PresentCharacter) => {
      const rawId = character.characterId?.trim() ?? "";
      if (rawId && characterSpriteLookup.knownIds.has(rawId)) return rawId;
      const idNameMatch = characterSpriteLookup.idByName.get(normalizeLookupText(rawId));
      if (idNameMatch) return idNameMatch;
      const nameMatch = characterSpriteLookup.idByName.get(normalizeLookupText(character.name));
      if (nameMatch) return nameMatch;
      return isSpriteLookupCharacterId(rawId) ? rawId : null;
    },
    [characterSpriteLookup],
  );

  const cachedMessages = useMemo(() => messageData ?? [], [messageData]);
  const spriteExpressions = useMemo(
    () =>
      getLatestSpriteExpressionsFromMessages(cachedMessages as Array<{ role?: string; extra?: unknown }>) ??
      normalizeSpriteExpressionMap(chatMeta.spriteExpressions),
    [cachedMessages, chatMeta.spriteExpressions],
  );
  const personas = useMemo(() => (Array.isArray(personasData) ? (personasData as Persona[]) : []), [personasData]);
  const activePersona = useMemo(() => {
    const chatPersonaId = (chat as unknown as { personaId?: unknown } | undefined)?.personaId;
    const selectedPersonaId = typeof chatPersonaId === "string" ? chatPersonaId : null;
    return (
      (selectedPersonaId ? personas.find((persona) => persona.id === selectedPersonaId) : null) ??
      personas.find((persona) => persona.isActive) ??
      null
    );
  }, [chat, personas]);
  const { featuredCharacterCards, removeFeaturedCharacterCard, toggleFeaturedCharacterCard } =
    useFeaturedCharacterCards({
      activeChatId,
      chatMeta,
    });
  const hasFixedTrackerPanel = orderedTrackerSections.length > 0;
  const trackerState = useTrackerStateController(activeChatId, "tracker-data-sidebar", hasFixedTrackerPanel);
  const showTrackerSections =
    !!activeChatId && !trackerState.isLoadingGameState && !!trackerState.gameState && hasFixedTrackerPanel;

  return {
    ...trackerState,
    activeChatId,
    activePersona,
    agentConfigLookupEnabled,
    characterSpriteLookup,
    enabledAgentTypes,
    expressionSpritesEnabled: trackerPanelUseExpressionSprites && expressionAgentEnabled,
    featuredCharacterCards,
    hasFixedTrackerPanel,
    orderedTrackerSections,
    removeFeaturedCharacterCard,
    resolveSpriteCharacterId,
    setTrackerPanelOpen,
    setTrackerPanelSide,
    setTrackerPanelSizeProfile,
    showTrackerSections,
    spriteExpressions,
    toggleFeaturedCharacterCard,
    toggleTrackerPanelSectionCollapsed,
    trackerPanelCollapsedSections,
    trackerPanelDockedThoughtsAlwaysVisible,
    trackerPanelSide,
    trackerPanelSizeProfile,
    trackerPanelThoughtBubbleDisplay,
    trackerTemperatureUnit,
  };
}
