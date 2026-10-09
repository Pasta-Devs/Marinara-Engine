import type { Dispatch, RefObject, SetStateAction } from "react";
import type { TFunction } from "i18next";
import type { Chat } from "@marinara-engine/shared";
import { toast } from "sonner";
import type { useAgentConfigs } from "../../../hooks/use-agents";
import type { useUpdateChat, useUpdateChatMetadata } from "../../../hooks/use-chats";
import type { useStartNewChatMode } from "../../../hooks/use-start-new-chat-mode";
import { dispatchCardAssetInsert } from "../../../lib/card-asset-links";
import { parseChatMetadata } from "../../../lib/chat-display";
import {
  requestChatSettingsSectionOpen,
  requestChatSummaryOpen,
  requestChatLorebookEntriesOpen,
  requestChatSearchOpen,
  requestChatReplyCheckup,
  requestChatRegenerate,
} from "../../../lib/chat-floating-ui-events";
import { openGlobalSearch } from "../../../lib/chat-insights";
import { getChatActiveLorebookIds, getChatExcludedLorebookIds } from "../../../lib/chat-lorebooks";
import { getChatCharacterIds } from "../../../lib/chat-macros";
import {
  type ChatResourceDragKind,
  type ChatResourceDragPayload,
  requestChatResourceAssignment,
  requestChatResourceAssignmentFor,
} from "../../../lib/chat-resource-drag";
import { resolveChatResourceDropAction } from "../../../lib/chat-resource-drop-capabilities";
import { type OmnibarResult, isDirectActiveChatAction, type OmnibarAction } from "../../../lib/omnibar-search";
import { activatePersonalExtensionCommand } from "../../../lib/personal-extension-contributions";
import type { ProfessorMariNavigationTarget } from "../../../lib/professor-mari-navigation";
import { useChatStore } from "../../../stores/chat.store";
import type { useUIStore } from "../../../stores/ui.store";
import { chatResourceBlockedKey } from "../../chat/ChatResourceDropOverlay";
import { CHAT_RESOURCE_KIND } from "./omnibar-dialog-rules";
import { getOmnibarResourceId } from "./omnibar-result-view";

type OmnibarResultActionInput = {
  t: TFunction;
  ui: typeof useUIStore.getState;
  activeChat: Chat | null;
  activeChatId: string | null;
  agents: ReturnType<typeof useAgentConfigs>["data"];
  query: string;
  searchResults: OmnibarResult[];
  inputRef: RefObject<HTMLInputElement | null>;
  patchChat: ReturnType<typeof useUpdateChat>["mutateAsync"];
  patchChatMetadata: ReturnType<typeof useUpdateChatMetadata>["mutateAsync"];
  startNewChatMode: ReturnType<typeof useStartNewChatMode>;
  setQuery: (query: string) => void;
  setActiveResultId: (id: string | null) => void;
  setMariOpenChatId: Dispatch<SetStateAction<string | null>>;
  confirmLeaveEditor: () => boolean;
  navigate: (target: ProfessorMariNavigationTarget) => boolean;
  recordUse: (id: string) => void;
  openProfessorMari: () => void;
  onClose: () => void;
};

/** What a row does when it is more than "open this": attach to or detach from the open chat, and every typed action. */
export function createOmnibarResultActions({
  t,
  ui,
  activeChat,
  activeChatId,
  agents,
  query,
  searchResults,
  inputRef,
  patchChat,
  patchChatMetadata,
  startNewChatMode,
  setQuery,
  setActiveResultId,
  setMariOpenChatId,
  confirmLeaveEditor,
  navigate,
  recordUse,
  openProfessorMari,
  onClose,
}: OmnibarResultActionInput) {
  /**
   * Detaches one resource from the open chat. Each kind lives in a different
   * field, so the mapping is explicit; a lorebook is also added to the excluded
   * list, because dropping it from the active list alone lets a character
   * re-activate it immediately.
   */
  const detachFromChat = (resource: ChatResourceDragKind, resourceId: string, label: string) => {
    if (!activeChat || !resourceId) return false;
    const chatId = activeChat.id;
    // Each patch is paired with the patch that puts the old value back, so the
    // toast can offer Undo instead of a modal confirm blocking the keyboard flow.
    const metadata = parseChatMetadata(activeChat.metadata);
    const activeAgentIds = Array.isArray(metadata.activeAgentIds) ? metadata.activeAgentIds : [];
    const characterIds = getChatCharacterIds(activeChat);
    const activeLorebookIds = getChatActiveLorebookIds(activeChat);
    const excludedLorebookIds = getChatExcludedLorebookIds(activeChat);
    const chatPatch = (next: Parameters<typeof patchChat>[0], undo: Parameters<typeof patchChat>[0]) => ({
      apply: () => void patchChat(next),
      undo: () => void patchChat(undo),
    });
    const metadataPatch = (
      next: Parameters<typeof patchChatMetadata>[0],
      undo: Parameters<typeof patchChatMetadata>[0],
    ) => ({ apply: () => void patchChatMetadata(next), undo: () => void patchChatMetadata(undo) });
    const change =
      resource === "character"
        ? chatPatch(
            { id: chatId, characterIds: characterIds.filter((id) => id !== resourceId) },
            { id: chatId, characterIds },
          )
        : resource === "persona"
          ? chatPatch({ id: chatId, personaId: null }, { id: chatId, personaId: activeChat.personaId ?? null })
          : resource === "preset"
            ? chatPatch(
                { id: chatId, promptPresetId: null },
                { id: chatId, promptPresetId: activeChat.promptPresetId ?? null },
              )
            : resource === "connection"
              ? chatPatch(
                  { id: chatId, connectionId: null },
                  { id: chatId, connectionId: activeChat.connectionId ?? null },
                )
              : resource === "lorebook"
                ? metadataPatch(
                    {
                      id: chatId,
                      activeLorebookIds: activeLorebookIds.filter((id) => id !== resourceId),
                      excludedLorebookIds: [...new Set([...excludedLorebookIds, resourceId])],
                    },
                    { id: chatId, activeLorebookIds, excludedLorebookIds },
                  )
                : resource === "agent"
                  ? metadataPatch(
                      {
                        id: chatId,
                        // A chat stores either the agent's id or its type, while the row id
                        // is always the type. Comparing raw values would detach nothing.
                        activeAgentIds: activeAgentIds.filter(
                          (id) =>
                            (agents?.find((agent) => agent.id === id || agent.type === id)?.type ?? id) !== resourceId,
                        ),
                      },
                      { id: chatId, activeAgentIds },
                    )
                  : null;
    if (!change) return false;
    change.apply();
    toast.success(t("commandCenter.actions.removedFromChat", "Removed {{name}} from this chat.", { name: label }), {
      action: { label: t("ui.chat.chatresourcedropoverlay.undo", "Undo"), onClick: change.undo },
    });
    onClose();
    return true;
  };
  /** Attaches one resource to the open chat and closes, unless the drop rules block it. */
  const attachToChat = (kind: ChatResourceDragKind, id: string, label: string, resultId: string) => {
    if (!activeChat || !id) return false;
    const payload: ChatResourceDragPayload = { version: 1, kind, ids: [id], label };
    const blocked = resolveChatResourceDropAction(payload, activeChat);
    if (blocked?.type === "blocked") {
      // Silently returning false left the row looking live but doing nothing.
      toast.info(t(chatResourceBlockedKey(blocked), { name: label }));
      return false;
    }
    requestChatResourceAssignment(payload);
    recordUse(resultId);
    // A character or lorebook attaches quietly with an Undo toast, so the omnibar
    // stays open for the next one. The others can ask to replace the current
    // persona, preset or connection, or open agent setup, which must not open
    // behind this dialog.
    if (kind !== "character" && kind !== "lorebook") onClose();
    return true;
  };
  /**
   * Attaches a lorebook to the open chat unless it is already active there, in
   * which case there is nothing to attach (O4 item 1).
   */
  const attachLorebookIfNotActive = (result: OmnibarResult): boolean => {
    if (!activeChat) return false;
    const id = getOmnibarResourceId(result);
    if (!id) return false;
    const payload: ChatResourceDragPayload = { version: 1, kind: "lorebook", ids: [id], label: result.title };
    if (resolveChatResourceDropAction(payload, activeChat)?.type === "blocked") return false;
    return attachToChat("lorebook", id, result.title, result.id);
  };
  const runDirectChatAction = (result: OmnibarResult) => {
    if (!activeChat || !isDirectActiveChatAction(query, result, searchResults)) return false;
    const kind = CHAT_RESOURCE_KIND[result.category];
    if (!kind) return false;
    return attachToChat(kind, getOmnibarResourceId(result), result.title, result.id);
  };
  // Typed dispatch for the results that do something other than open an entity.
  // Results without an `action` fall through to the generic entity-open path in
  // `choose` below.
  const runResultAction = (result: OmnibarResult, action: OmnibarAction) => {
    switch (action.kind) {
      case "open-mari-chat":
        setMariOpenChatId(action.chatId);
        openProfessorMari();
        return;
      case "slash": {
        const chatId = activeChatId;
        const command = `/${action.command} `;
        recordUse(result.id);
        onClose();
        // After the dialog unmounts, so the chat input keeps the focus it takes.
        if (chatId) requestAnimationFrame(() => dispatchCardAssetInsert(command, chatId));
        return;
      }
      case "goto-message":
        // The request is keyed by chat id and survives the switch, so a hit in
        // another chat opens that chat and the jump is picked up on arrival.
        if (action.chatId !== activeChatId && !navigate({ kind: "chat", chatId: action.chatId })) return;
        useChatStore.getState().requestGotoMessage(action.chatId, action.messageNumber);
        onClose();
        return;
      case "refine-query":
        setQuery(action.query);
        setActiveResultId(null);
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      case "add-to-chat":
        // Named a different (or no open) chat: queue the attach for when that
        // chat mounts, then navigate there — the same handoff the "goto-message"
        // action above uses to land on a chat that is not open yet.
        if (action.chatId && action.chatId !== activeChatId) {
          if (!navigate({ kind: "chat", chatId: action.chatId })) return;
          requestChatResourceAssignmentFor(action.chatId, {
            version: 1,
            kind: action.resource,
            ids: [action.resourceId],
            label: action.label,
          });
          recordUse(result.id);
          onClose();
          return;
        }
        attachToChat(action.resource, action.resourceId, action.label, result.id);
        return;
      case "detach-from-chat":
        if (detachFromChat(action.resource, action.resourceId, action.label)) recordUse(result.id);
        return;
      case "personal-extension":
        if (activatePersonalExtensionCommand(action.commandId)) {
          recordUse(result.id);
          onClose();
        }
        return;
      case "open-docs":
        ui().openModal("docs-viewer", {
          initialDoc: action.path,
          initialSearchTerm: query.trim().slice(0, 200),
        });
        recordUse(result.id);
        onClose();
        return;
      case "open-faq":
        ui().openModal("faq-viewer", { initialItemId: action.itemId });
        recordUse(result.id);
        onClose();
        return;
      case "open-global-search":
        openGlobalSearch(action.query);
        onClose();
        return;
      case "create-named":
        ui().openModal(action.modal, { defaultName: action.name });
        recordUse(result.id);
        onClose();
        return;
      case "start-character-chat":
        ui().openModal("start-character-chat", {
          characterId: action.characterId,
          characterName: action.characterName,
        });
        recordUse(result.id);
        onClose();
        return;
      case "start-chat":
        if (!confirmLeaveEditor()) return;
        recordUse(result.id);
        // Closing unmounts this dialog (and the mutation hook inside
        // `startNewChatMode`), so wait for it to settle first — otherwise the
        // chat gets created but the unmount drops its success callback.
        void startNewChatMode(action.mode)
          .catch(() => {
            /* The create mutation's own onError already surfaces a toast. */
          })
          .finally(() => onClose());
        return;
      case "open-lorebook-entry":
        if (!confirmLeaveEditor()) return;
        ui().openLorebookDetail(action.lorebookId, { initialTab: "entries", entryId: action.entryId });
        recordUse(result.id);
        onClose();
        return;
      case "open-chat-tool":
        recordUse(result.id);
        onClose();
        // After the dialog unmounts, so the panel it opens can anchor to a button
        // that is actually visible on screen again.
        requestAnimationFrame(() => {
          switch (action.tool) {
            case "summary":
              requestChatSummaryOpen(action.chatId);
              return;
            case "lorebook":
              requestChatLorebookEntriesOpen(action.chatId);
              return;
            case "search":
              requestChatSearchOpen(action.chatId);
              return;
            case "reply-checkup":
              requestChatReplyCheckup(action.chatId);
              return;
            case "regenerate":
              requestChatRegenerate(action.chatId);
              return;
            case "advanced-parameters":
            case "memory-recall":
              requestChatSettingsSectionOpen(action.chatId, action.tool);
              return;
          }
        });
        return;
    }
  };
  return { detachFromChat, attachLorebookIfNotActive, runDirectChatAction, runResultAction };
}
