import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Message } from "@marinara-engine/shared";
import type { useAgentConfigs } from "../../../hooks/use-agents";
import type { usePersonas } from "../../../hooks/use-characters";
import { useChatMessageCount, chatKeys } from "../../../hooks/use-chats";
import { type useLorebooks, type ActiveLorebookScan, lorebookKeys } from "../../../hooks/use-lorebooks";
import type { usePresets } from "../../../hooks/use-presets";
import { parseChatMetadata } from "../../../lib/chat-display";
import {
  deriveActiveLorebookViews,
  getChatActiveLorebookIds,
  getChatExcludedLorebookIds,
} from "../../../lib/chat-lorebooks";
import { getChatCharacterIds } from "../../../lib/chat-macros";
import { buildMariArrival, isMariReplyFailure, mariThreadContextFor } from "../../../lib/mari-arrival";
import type { OmnibarNamedRow } from "../../../lib/omnibar-entity-rows";
import type { createOmnibarContext } from "../../../lib/omnibar-search";
import { getOmnibarSettingsDestinations } from "../../../lib/omnibar-settings";
import { useLocalizedUiText } from "../../../localization/use-localized-ui-text";
import type { useChatStore } from "../../../stores/chat.store";
import type { useUIStore } from "../../../stores/ui.store";
import { readNamedRow } from "./omnibar-result-view";

type OmnibarMariArrivalInput = {
  activeChat: ReturnType<typeof useChatStore.getState>["activeChat"];
  activeChatId: string | null;
  activeEditorField: ReturnType<typeof useUIStore.getState>["activeEditorField"];
  agents: ReturnType<typeof useAgentConfigs>["data"];
  characterNameById: ReadonlyMap<string, string>;
  connectionById: ReadonlyMap<string, OmnibarNamedRow>;
  gameSetupStep: string | null;
  lastAppError: ReturnType<typeof useUIStore.getState>["lastAppError"];
  lorebooks: ReturnType<typeof useLorebooks>["data"];
  mariEnabled: boolean;
  omnibarContext: ReturnType<typeof createOmnibarContext>;
  openAgentId: string | null;
  personas: ReturnType<typeof usePersonas>["data"];
  presets: ReturnType<typeof usePresets>["data"];
  settingsPanelVisible: boolean;
  settingsTab: ReturnType<typeof useUIStore.getState>["settingsTab"];
  settingsTargetControlId: string | null;
  /** Bumped after K5's Undo, so the arrival reads `undoLabel` again. */
  settingUndoVersion: number;
  /** K5's last setting flip, which the arrival offers to undo. */
  undoLabel: string | null;
};

/** M9 + R7: what Mari says when she opens on this screen, and which of her threads it goes to. */
export function useOmnibarMariArrival({
  activeChat,
  activeChatId,
  activeEditorField,
  agents,
  characterNameById,
  connectionById,
  gameSetupStep,
  lastAppError,
  lorebooks,
  mariEnabled,
  omnibarContext,
  openAgentId,
  personas,
  presets,
  settingsPanelVisible,
  settingsTab,
  settingsTargetControlId,
  settingUndoVersion,
  undoLabel,
}: OmnibarMariArrivalInput) {
  const { t } = useTranslation();
  const localize = useLocalizedUiText();
  const queryClient = useQueryClient();
  // M9: what Mari says when she opens on this screen. Built here, where the omnibar context already is,
  // so every door (⌘J, the pull, Home, ⌘K) shows the same thing. Names, counts and times only (R22).
  const arrivalChat = activeChat && activeChat.id === activeChatId ? activeChat : null;
  const arrivalMessageCount = useChatMessageCount(
    mariEnabled && omnibarContext.surface === "chat" ? (arrivalChat?.id ?? null) : null,
  );
  const mariArrival = useMemo(() => {
    const metadata = arrivalChat ? parseChatMetadata(arrivalChat.metadata) : null;
    // ponytail: the newest reply and the active-entries count come from what is already cached; the
    // arrival never fetches messages or runs a scan of its own. A chat not loaded yet shows fewer facts.
    const newestPage = arrivalChat
      ? queryClient.getQueryData<{ pages: Message[][] }>(chatKeys.messages(arrivalChat.id))?.pages[0]
      : undefined;
    const lastReply = newestPage?.findLast((message) => message.role === "assistant" || message.role === "narrator");
    const count = arrivalMessageCount.data?.count ?? null;
    const summaryEnds = Array.isArray(metadata?.summaryEntries)
      ? (metadata.summaryEntries as { rangeEndIndex?: unknown }[]).flatMap((entry) =>
          typeof entry?.rangeEndIndex === "number" ? [entry.rangeEndIndex] : [],
        )
      : [];
    const agentRow = openAgentId
      ? agents?.find((agent) => agent.id === openAgentId || agent.type === openAgentId)
      : undefined;
    let agentSettingsCount = 0;
    try {
      agentSettingsCount = Object.keys(JSON.parse(agentRow?.settings || "{}") ?? {}).length;
    } catch {
      // A malformed settings blob only hides the "what do its settings do" card.
    }
    const activeAgentIds: unknown[] = Array.isArray(metadata?.activeAgentIds) ? metadata.activeAgentIds : [];
    const resource = omnibarContext.openResource;
    const listName = (list: readonly unknown[] | undefined, id: string) =>
      readNamedRow((list ?? []).find((item) => readNamedRow(item)?.id === id))?.name;
    const editorName = !resource
      ? undefined
      : resource.kind === "character"
        ? characterNameById.get(resource.id)
        : resource.kind === "persona"
          ? listName(personas, resource.id)
          : resource.kind === "lorebook"
            ? listName(lorebooks, resource.id)
            : resource.kind === "preset"
              ? listName(presets, resource.id)
              : resource.kind === "connection"
                ? connectionById.get(resource.id)?.name
                : undefined;
    const destinations = getOmnibarSettingsDestinations();
    const destinationTitle = (id: string) => {
      const title = destinations.find((destination) => destination.id === id)?.title;
      return title ? localize(title) : null;
    };
    return buildMariArrival(omnibarContext, {
      t,
      now: Date.now(),
      gameSetupStep,
      chat: arrivalChat
        ? {
            name: arrivalChat.name,
            mode: arrivalChat.mode,
            characters: getChatCharacterIds(arrivalChat).flatMap((id) => {
              const name = characterNameById.get(id);
              return name ? [{ id, name }] : [];
            }),
            lorebooks: deriveActiveLorebookViews({
              activeLorebookIds: getChatActiveLorebookIds(arrivalChat),
              excludedLorebookIds: getChatExcludedLorebookIds(arrivalChat),
              dropExcluded: true,
              chat: arrivalChat,
              lorebooks: lorebooks ?? [],
            }).map((lorebook) => ({ id: lorebook.id, name: lorebook.name })),
            messageCount: count,
            lastReply: lastReply
              ? { createdAt: lastReply.createdAt, finishReason: lastReply.extra?.generationInfo?.finishReason }
              : null,
            messagesSinceSummary:
              count != null && summaryEnds.length > 0 ? Math.max(0, count - 1 - Math.max(...summaryEnds)) : null,
            activeEntries:
              queryClient.getQueryData<ActiveLorebookScan>(lorebookKeys.active(arrivalChat.id))?.entries.length ?? null,
          }
        : null,
      replyFailed: isMariReplyFailure(lastAppError, arrivalChat?.id),
      agent: agentRow
        ? {
            type: agentRow.type,
            name: agentRow.name,
            enabled: String(agentRow.enabled) === "true",
            promptLength: agentRow.promptTemplate?.length ?? 0,
            settingsCount: agentSettingsCount,
            onForChat:
              arrivalChat &&
              metadata?.enableAgents === true &&
              (activeAgentIds.includes(agentRow.id) || activeAgentIds.includes(agentRow.type))
                ? arrivalChat.name
                : null,
            lastError:
              lastAppError?.retry?.kind === "open-agent" && lastAppError.retry.id === agentRow.type
                ? lastAppError.message
                : null,
          }
        : null,
      editor: editorName ? { name: editorName, field: activeEditorField?.label } : null,
      settings: settingsPanelVisible
        ? {
            section:
              (settingsTab ? destinationTitle(`settings-section:${settingsTab}`) : null) ??
              t("omnibar.categories.settings", "Settings"),
            control: settingsTargetControlId ? destinationTitle(`settings-control:${settingsTargetControlId}`) : null,
          }
        : null,
      undoLabel,
    });
    // settingUndoVersion: undoLabel comes from module state; the version re-reads it after an Undo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeEditorField?.label,
    agents,
    arrivalChat,
    arrivalMessageCount.data?.count,
    characterNameById,
    connectionById,
    gameSetupStep,
    lastAppError,
    localize,
    lorebooks,
    omnibarContext,
    openAgentId,
    personas,
    presets,
    queryClient,
    settingUndoVersion,
    settingsPanelVisible,
    settingsTab,
    settingsTargetControlId,
    t,
  ]);
  // R7: which Mari thread this screen's arrivals go to.
  const mariThreadContext = useMemo(
    () => mariThreadContextFor(omnibarContext, mariArrival),
    [mariArrival, omnibarContext],
  );
  return { mariArrival, mariThreadContext };
}
