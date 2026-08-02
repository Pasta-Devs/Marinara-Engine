import { isAgentAvailableInChatMode, type Chat, type Lorebook } from "@marinara-engine/shared";
import { chatBackgroundMetadataToUrl, chatBackgroundUrlToMetadata } from "./backgrounds";
import { parseChatMetadata } from "./chat-display";
import { deriveActiveLorebookViews, getChatExcludedLorebookIds, type LorebookActiveReason } from "./chat-lorebooks";
import type { ChatResourceDragPayload } from "./chat-resource-drag";

export type ChatResourceDropAction =
  | { type: "add-characters"; ids: string[]; label: string }
  /**
   * `inheritedFrom` lists the non-pin sources that already pull the dropped book into context:
   * character, persona, global, or `Chat` for a book scoped or owned by this chat without being
   * pinned. Pinning it is still a real change — the pin survives swapping that source out — so this
   * is a note on the drop, not a reason to block it.
   */
  | { type: "add-lorebooks"; ids: string[]; label: string; inheritedFrom: LorebookActiveReason[] }
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

/** Sources other than a chat pin that already make these books active, deduped and stably ordered. */
function inheritedReasons(
  ids: string[],
  chat: Pick<Chat, "characterIds" | "id" | "metadata" | "personaId">,
  lorebooks: Lorebook[] | undefined,
): LorebookActiveReason[] {
  if (!lorebooks?.length) return [];
  const dropped = new Set(ids);
  const reasons = new Set(
    deriveActiveLorebookViews({
      activeLorebookIds: [],
      chat,
      dropExcluded: true,
      excludedLorebookIds: getChatExcludedLorebookIds(chat),
      lorebooks: lorebooks.filter((lorebook) => dropped.has(lorebook.id)),
    }).flatMap((view) => view.activeReasons),
  );
  return (["Character", "Persona", "Global", "Chat"] as const).filter((reason) => reasons.has(reason));
}

export function resolveChatResourceDropAction(
  payload: ChatResourceDragPayload,
  chat: Pick<Chat, "characterIds" | "id" | "metadata" | "mode" | "personaId" | "promptPresetId" | "connectionId">,
  availableIds?: ReadonlySet<string>,
  lorebooks?: Lorebook[],
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
    if (ids.length === 0) return alreadyActive;
    return { type: "add-lorebooks", ids, label: payload.label, inheritedFrom: inheritedReasons(ids, chat, lorebooks) };
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
