import type { Chat } from "@marinara-engine/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { useOmnibarEntityRows } from "./use-omnibar-entity-rows";
import { useUIStore } from "../../../stores/ui.store";
import {
  getOmnibarActiveChatContextResultIds,
  resolveOmnibarScreen,
  createOmnibarContext,
} from "../../../lib/omnibar-search";
import type { CommandRankingState } from "../../../lib/command-center";
import { getChatCharacterIds } from "../../../lib/chat-macros";
import {
  deriveActiveLorebookViews,
  getChatActiveLorebookIds,
  getChatExcludedLorebookIds,
} from "../../../lib/chat-lorebooks";
import { parseChatMetadata } from "../../../lib/chat-display";
import type { usePresets } from "../../../hooks/use-presets";
import type { useLorebooks } from "../../../hooks/use-lorebooks";
import type { useDocsCommandSearchProvider } from "../../../hooks/use-docs-command-search";
import type { useConnections } from "../../../hooks/use-connections";
import type { useChats } from "../../../hooks/use-chats";
import type { useCharacters, usePersonas } from "../../../hooks/use-characters";
import type { useAgentConfigs } from "../../../hooks/use-agents";

type OmnibarScreenContextInput = {
  activeChat: Chat | null;
  activeChatId: string | null;
  agentCatalogOpen: boolean;
  openAgentId: string | null;
  openCharacterId: string | null;
  openConnectionId: string | null;
  openLorebookId: string | null;
  openPersonaId: string | null;
  openPresetId: string | null;
  settingsPanelVisible: boolean;
  settingsTab: ReturnType<typeof useUIStore.getState>["settingsTab"];
  settingsTargetControlId: string | null;
  ranking: CommandRankingState;
  commands: ReturnType<typeof useOmnibarEntityRows>["data"]["commands"];
  /** Every source the list reads, for their records and for "some results could not be loaded". */
  sources: {
    chats: ReturnType<typeof useChats>;
    characters: ReturnType<typeof useCharacters>;
    personas: ReturnType<typeof usePersonas>;
    lorebooks: ReturnType<typeof useLorebooks>;
    presets: ReturnType<typeof usePresets>;
    connections: ReturnType<typeof useConnections>;
    agents: ReturnType<typeof useAgentConfigs>;
    docs: ReturnType<typeof useDocsCommandSearchProvider>;
  };
};

/** Where the user is (screen, open chat, open record, settings spot) and why rows matter there. */
export function useOmnibarScreenContext({
  activeChat,
  activeChatId,
  agentCatalogOpen,
  openAgentId,
  openCharacterId,
  openConnectionId,
  openLorebookId,
  openPersonaId,
  openPresetId,
  settingsPanelVisible,
  settingsTab,
  settingsTargetControlId,
  ranking,
  commands,
  sources: { chats, characters, personas, lorebooks, presets, connections, agents, docs },
}: OmnibarScreenContextInput) {
  const { t } = useTranslation();
  const rightPanelOpen = useUIStore((state) => state.rightPanelOpen);
  const rightPanel = useUIStore((state) => state.rightPanel);
  const botBrowserOpen = useUIStore((state) => state.botBrowserOpen);
  const gameAssetsBrowserOpen = useUIStore((state) => state.gameAssetsBrowserOpen);
  const characterLibraryOpen = useUIStore((state) => state.characterLibraryOpen);
  const cardLibraryKind = useUIStore((state) => state.cardLibraryKind);
  const editorDirty = useUIStore((state) => state.editorDirty);
  const omnibarContext = useMemo(() => {
    const chatMetadata = activeChat ? parseChatMetadata(activeChat.metadata) : null;
    const activeLorebookIds = activeChat
      ? deriveActiveLorebookViews({
          activeLorebookIds: getChatActiveLorebookIds(activeChat),
          excludedLorebookIds: getChatExcludedLorebookIds(activeChat),
          dropExcluded: true,
          chat: activeChat,
          lorebooks: lorebooks.data ?? [],
        }).map((lorebook) => lorebook.id)
      : [];
    const activeAgentIds = Array.isArray(chatMetadata?.activeAgentIds)
      ? chatMetadata.activeAgentIds.filter((id): id is string => typeof id === "string")
      : [];
    const activeAgentResultIds = activeAgentIds.map(
      (id) => agents.data?.find((agent) => agent.id === id || agent.type === id)?.type ?? id,
    );
    const activeChatResultIds = [
      ...getOmnibarActiveChatContextResultIds(
        activeChatId,
        activeChat
          ? {
              ...activeChat,
              characterIds: getChatCharacterIds(activeChat),
              lorebookIds: activeLorebookIds,
              enableAgents: chatMetadata?.enableAgents === true,
              activeAgentIds: activeAgentResultIds,
            }
          : null,
      ),
    ];
    const { surface, openResource } = resolveOmnibarScreen({
      characterDetailId: openCharacterId,
      personaDetailId: openPersonaId,
      lorebookDetailId: openLorebookId,
      presetDetailId: openPresetId,
      connectionDetailId: openConnectionId,
      agentDetailId: openAgentId,
      settingsPanelVisible,
      gameAssetsBrowserOpen,
      botBrowserOpen,
      characterLibraryOpen,
      agentCatalogOpen,
      activeChatId,
    });
    const settingsResultId = settingsPanelVisible
      ? settingsTargetControlId
        ? `settings-control:${settingsTargetControlId}`
        : settingsTab
          ? `settings-section:${settingsTab}`
          : "settings"
      : null;
    const surfaceResultIds = rightPanelOpen
      ? [rightPanel === "connections" ? "integrations" : rightPanel === "settings" ? "settings" : rightPanel]
      : botBrowserOpen
        ? ["card-browser"]
        : gameAssetsBrowserOpen
          ? ["game-assets"]
          : characterLibraryOpen
            ? [cardLibraryKind === "personas" ? "persona-library" : "character-library"]
            : agentCatalogOpen
              ? ["agent-library", "packages"]
              : activeChatId
                ? ["chats", `chat:${activeChatId}`]
                : ["home"];
    const setupResultIds = commands
      .filter(
        (command) =>
          "availability" in command &&
          command.availability?.status === "requires-capability" &&
          command.availability.setupTarget,
      )
      .map((command) => command.id);
    const failedSources = [chats, characters, personas, lorebooks, presets, connections, agents, docs].some(
      (source) => source.isError,
    );
    return createOmnibarContext({
      surface,
      surfaceResultIds,
      activeChat:
        activeChat && activeChat.id === activeChatId
          ? { id: activeChat.id, mode: activeChat.mode, resultIds: activeChatResultIds }
          : undefined,
      openResource,
      settingsTarget: settingsResultId
        ? { tab: settingsTab, controlId: settingsTargetControlId ?? undefined, resultId: settingsResultId }
        : undefined,
      editorDirty,
      recentResultIds: ranking.recent.map((entry) => entry.id),
      setupResultIds,
      error: failedSources ? { resultIds: ["diagnostics"], message: t("omnibar.error") } : undefined,
    });
  }, [
    activeChat,
    activeChatId,
    agentCatalogOpen,
    agents,
    botBrowserOpen,
    cardLibraryKind,
    characterLibraryOpen,
    characters,
    chats,
    connections,
    commands,
    docs,
    editorDirty,
    gameAssetsBrowserOpen,
    lorebooks,
    openAgentId,
    openCharacterId,
    openConnectionId,
    openLorebookId,
    openPersonaId,
    openPresetId,
    personas,
    presets,
    ranking.recent,
    rightPanel,
    rightPanelOpen,
    settingsTab,
    settingsTargetControlId,
    settingsPanelVisible,
    t,
  ]);
  return omnibarContext;
}
