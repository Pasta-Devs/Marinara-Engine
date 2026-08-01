import { isAgentAvailableInChatMode, type Chat } from "@marinara-engine/shared";
import { chatBackgroundMetadataToUrl, chatBackgroundUrlToMetadata } from "./backgrounds";
import { parseChatMetadata } from "./chat-display";
import type { ChatResourceDragPayload } from "./chat-resource-drag";

export type ChatResourceDropAction =
  | { type: "add-characters"; ids: string[]; label: string }
  | { type: "add-lorebooks"; ids: string[]; label: string }
  | { type: "add-agents"; ids: string[]; label: string; mustEnableAgents: boolean }
  | { type: "set-persona"; id: string; label: string; replacesId: string | null }
  | { type: "set-preset"; id: string; label: string; replacesId: string | null }
  | { type: "set-connection"; id: string; label: string; replacesId: string | null }
  | { type: "set-background"; id: string; label: string };

/** Why a drop cannot happen, so the surface can explain instead of silently ignoring it. */
export type ChatResourceDropBlock = {
  type: "blocked";
  reason: "already-active" | "preset-unsupported-mode" | "agent-unsupported-mode" | "connection-kind";
  label: string;
};

export type ChatResourceDropResult = ChatResourceDropAction | ChatResourceDropBlock;

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

export function resolveChatResourceDropAction(
  payload: ChatResourceDragPayload,
  chat: Pick<Chat, "characterIds" | "metadata" | "mode" | "personaId" | "promptPresetId" | "connectionId">,
  availableIds?: ReadonlySet<string>,
): ChatResourceDropResult | null {
  const metadata = parseChatMetadata(chat.metadata);
  if (payload.unsupported) {
    return { type: "blocked", reason: payload.unsupported, label: payload.label };
  }
  const payloadIds = availableIds ? payload.ids.filter((id) => availableIds.has(id)) : payload.ids;
  if (payloadIds.length === 0) return null;
  const alreadyActive: ChatResourceDropBlock = {
    type: "blocked",
    reason: "already-active",
    label: payload.label,
  };

  if (payload.kind === "character") {
    const currentIds = new Set(readStringArray(chat.characterIds));
    const ids = payloadIds.filter((id) => !currentIds.has(id));
    return ids.length > 0 ? { type: "add-characters", ids, label: payload.label } : alreadyActive;
  }

  if (payload.kind === "lorebook") {
    const currentIds = new Set(readStringArray(metadata.activeLorebookIds));
    const ids = payloadIds.filter((id) => !currentIds.has(id));
    return ids.length > 0 ? { type: "add-lorebooks", ids, label: payload.label } : alreadyActive;
  }

  if (payload.kind === "agent") {
    const currentIds = new Set(readStringArray(metadata.activeAgentIds));
    const supported = payloadIds.filter((id) => isAgentAvailableInChatMode(chat.mode, id));
    if (supported.length === 0) {
      return { type: "blocked", reason: "agent-unsupported-mode", label: payload.label };
    }
    const ids = supported.filter((id) => !currentIds.has(id));
    return ids.length > 0
      ? {
          type: "add-agents",
          ids,
          label: payload.label,
          mustEnableAgents: metadata.enableAgents !== true,
        }
      : alreadyActive;
  }

  const id = payloadIds[0];
  if (!id) return null;
  if (payload.kind === "persona") {
    return chat.personaId === id
      ? alreadyActive
      : { type: "set-persona", id, label: payload.label, replacesId: chat.personaId ?? null };
  }
  if (payload.kind === "preset") {
    if (chat.mode === "conversation") {
      return { type: "blocked", reason: "preset-unsupported-mode", label: payload.label };
    }
    if (chat.promptPresetId === id) return alreadyActive;
    return { type: "set-preset", id, label: payload.label, replacesId: chat.promptPresetId ?? null };
  }
  if (payload.kind === "background") {
    const currentBackground = chatBackgroundUrlToMetadata(chatBackgroundMetadataToUrl(metadata.background));
    return currentBackground === chatBackgroundUrlToMetadata(id)
      ? alreadyActive
      : { type: "set-background", id, label: payload.label };
  }
  return chat.connectionId === id
    ? alreadyActive
    : { type: "set-connection", id, label: payload.label, replacesId: chat.connectionId ?? null };
}
