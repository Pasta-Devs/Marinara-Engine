import type { Chat } from "@marinara-engine/shared";
import type { TFunction } from "i18next";
import { type RankedOmnibarResult, getOmnibarResourceId, readNamedRow } from "./omnibar-result-view";
import { MARI_EDITABLE_CATEGORIES, CHAT_RESOURCE_KIND } from "./omnibar-dialog-rules";
import type { CommandResultPreviewAction } from "../../command-center/command-result-preview.types";
import type { useUIStore } from "../../../stores/ui.store";
import type { ProfessorMariNavigationTarget } from "../../../lib/professor-mari-navigation";
import { resolveOmnibarRowState } from "../../../lib/omnibar-row-state";
import { isLanguageGenerationConnection } from "../../../lib/connection-filters";
import { resolveChatResourceDropAction } from "../../../lib/chat-resource-drop-capabilities";
import {
  type ChatResourceDragKind,
  type ChatResourceDragPayload,
  requestChatResourceAssignment,
} from "../../../lib/chat-resource-drag";
import type { useConnections } from "../../../hooks/use-connections";
import type { useUpdateChat } from "../../../hooks/use-chats";
import { Sparkles, MessageCircle, Edit3, X, Play, UserMinus } from "lucide-react";

/**
 * The actions under an expanded row. The row already runs its Enter action, so the expansion offers
 * only the others (D3): an "Edit character" chip under a row whose Enter edits is the same door twice.
 */
export function buildOmnibarPreviewActions(
  previewResult: RankedOmnibarResult,
  {
    t,
    ui,
    activeChat,
    attachedResultIds,
    connections,
    mariEnabled,
    previewEnterHint,
    updateChat,
    askMariAbout,
    detachFromChat,
    navigate,
    recordUse,
    onClose,
  }: {
    t: TFunction;
    ui: typeof useUIStore.getState;
    activeChat: Chat | null;
    attachedResultIds: ReadonlySet<string>;
    connections: ReturnType<typeof useConnections>["data"];
    mariEnabled: boolean;
    previewEnterHint: string | null;
    updateChat: ReturnType<typeof useUpdateChat>;
    askMariAbout: (result: RankedOmnibarResult | null) => void;
    detachFromChat: (resource: ChatResourceDragKind, resourceId: string, label: string) => boolean;
    navigate: (target: ProfessorMariNavigationTarget) => boolean;
    recordUse: (id: string) => void;
    onClose: () => void;
  },
): CommandResultPreviewAction[] {
  if (previewResult.command.availability?.status === "requires-admin") return [];
  // Only for what she can change; a setting, a message or a doc has nothing to continue.
  const mariActions =
    mariEnabled && MARI_EDITABLE_CATEGORIES.has(previewResult.category) && !previewResult.action
      ? [
          {
            label: t("commandCenter.actions.continueWithMari", "Continue with Prof. Mari"),
            icon: Sparkles,
            onSelect: () => askMariAbout(previewResult),
          },
        ]
      : [];
  if (previewResult.control?.type === "choice") return mariActions;
  const resourceKind = CHAT_RESOURCE_KIND[previewResult.category];
  const resourceId = resourceKind ? getOmnibarResourceId(previewResult) : "";
  const connection =
    resourceKind === "connection"
      ? (connections ?? []).find((item) => readNamedRow(item)?.id === resourceId)
      : undefined;
  const payload: ChatResourceDragPayload | null = resourceKind
    ? {
        version: 1,
        kind: resourceKind,
        ids: [resourceId],
        label: previewResult.title,
        ...(connection && !isLanguageGenerationConnection(connection)
          ? { unsupported: "connection-kind" as const }
          : {}),
      }
    : null;
  const rowResource =
    resourceKind === "character" ||
    resourceKind === "persona" ||
    resourceKind === "preset" ||
    resourceKind === "connection"
      ? resourceKind
      : null;
  const rowState = rowResource
    ? resolveOmnibarRowState({
        resource: rowResource,
        id: resourceId,
        activeChat,
        globallyActive:
          previewResult.category === "persona"
            ? previewResult.control?.value === true
            : previewResult.category === "preset"
              ? previewResult.control?.value === true
              : undefined,
      })
    : null;
  const canAddToChat =
    payload &&
    activeChat &&
    (!rowState || rowState.canAddToChat) &&
    resolveChatResourceDropAction(payload, activeChat)?.type !== "blocked";
  const addToChatAction =
    payload && canAddToChat && previewEnterHint !== t("commandCenter.enter.add", "Add")
      ? {
          label: t("commandCenter.actions.addToThisChat", "Add to this chat"),
          icon: MessageCircle,
          onSelect: () => {
            requestChatResourceAssignment(payload);
            recordUse(previewResult.id);
            onClose();
          },
        }
      : null;
  // Enter on a persona or preset row flips its toggle, which is the global action.
  if (previewResult.category === "persona" || previewResult.category === "preset") {
    return [...mariActions, ...(addToChatAction ? [addToChatAction] : [])];
  }
  if (previewResult.category === "lorebook") {
    const inActiveChat = Boolean(activeChat && attachedResultIds.has(previewResult.id));
    // Enter on the row itself attaches (or is a no-op) rather than
    // editing (O4 item 1), so editing always stays a dedicated action here.
    const editAction = {
      label: t("commandCenter.actions.editLorebook", "Edit lorebook"),
      icon: Edit3,
      onSelect: () => {
        if (previewResult.target && navigate(previewResult.target)) {
          recordUse(previewResult.id);
          onClose();
        }
      },
    };
    const askMariAction = mariEnabled
      ? {
          label: t("commandCenter.mode.work", "Ask Prof. Mari"),
          icon: Sparkles,
          onSelect: () => askMariAbout(previewResult),
        }
      : null;
    const contextAction = inActiveChat
      ? {
          label: t("commandCenter.actions.removeFromThisChat", "Remove from this chat"),
          icon: X,
          danger: true,
          onSelect: () => detachFromChat("lorebook", resourceId, previewResult.title),
        }
      : addToChatAction;
    return [editAction, ...(askMariAction ? [askMariAction] : []), ...(contextAction ? [contextAction] : [])];
  }
  if (previewResult.category === "character") {
    const characterId = getOmnibarResourceId(previewResult);
    const startChatAction =
      previewEnterHint !== t("commandCenter.enter.start", "Start")
        ? {
            label: t("commandCenter.actions.startChat", "Start chat"),
            icon: Play,
            onSelect: () => {
              ui().openModal("start-character-chat", { characterId, characterName: previewResult.title });
              recordUse(previewResult.id);
              onClose();
            },
          }
        : null;
    // Symmetric to add-to-chat: when the character is already a participant,
    // the most useful scene action is removing it from the active chat.
    const removeFromChatAction =
      activeChat &&
      characterId &&
      rowState?.inActiveChat &&
      previewEnterHint !== t("commandCenter.enter.remove", "Remove")
        ? {
            label: t("commandCenter.actions.removeFromThisChat", "Remove from this chat"),
            icon: UserMinus,
            danger: true,
            onSelect: () => {
              void updateChat.mutateAsync({
                id: activeChat.id,
                characterIds: (activeChat.characterIds ?? []).filter((id) => id !== characterId),
              });
              recordUse(previewResult.id);
              onClose();
            },
          }
        : null;
    return [
      ...(removeFromChatAction ? [removeFromChatAction] : addToChatAction ? [addToChatAction] : []),
      ...(startChatAction ? [startChatAction] : []),
    ];
  }
  // Resume chat, Open documentation and Open were all Enter.
  return [...mariActions, ...(addToChatAction ? [addToChatAction] : [])];
}
