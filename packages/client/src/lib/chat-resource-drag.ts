import type { Panel } from "../stores/ui.store";

export const CHAT_RESOURCE_DRAG_MIME = "application/x-marinara-chat-resource";
export const CHAT_RESOURCE_ASSIGN_EVENT = "marinara:assign-chat-resource";
export const CHAT_RESOURCE_AGENT_SETUP_EVENT = "marinara:setup-chat-agent";

export type ChatResourceDragKind =
  | "character"
  | "lorebook"
  | "agent"
  | "persona"
  | "preset"
  | "connection"
  | "background";

export type ChatResourceDragPayload = {
  version: 1;
  kind: ChatResourceDragKind;
  ids: string[];
  label: string;
  /** Set by a source that knows the resource can never be used in a chat, so the surface can say why. */
  unsupported?: "connection-kind";
};

let activeChatResourceDrag: ChatResourceDragPayload | null = null;
let pendingChatAgentSetup: { chatId: string; ids: string[] } | null = null;

/**
 * Touch drags have no `dataTransfer`, so the payload lives here for the duration of the gesture and
 * the mobile drop dock subscribes to it (the dock has to render while the finger is still down).
 */
let activeChatResourceTouchDrag: ChatResourceDragPayload | null = null;
const touchDragListeners = new Set<() => void>();

export function subscribeChatResourceTouchDrag(listener: () => void) {
  touchDragListeners.add(listener);
  return () => {
    touchDragListeners.delete(listener);
  };
}

/**
 * The mobile dock closes the library panel so the drop result is visible. Remember which panel that
 * was, so the flow can put the user back where they were once the follow-up modal is gone.
 */
let pendingChatResourcePanelRestore: Panel | null = null;

export function setPendingChatResourcePanelRestore(panel: Panel | null) {
  pendingChatResourcePanelRestore = panel;
}

export function takePendingChatResourcePanelRestore() {
  const panel = pendingChatResourcePanelRestore;
  pendingChatResourcePanelRestore = null;
  return panel;
}

export function getActiveChatResourceTouchDrag() {
  return activeChatResourceTouchDrag;
}

export function beginChatResourceTouchDrag(payload: ChatResourceDragPayload) {
  activeChatResourceDrag = payload;
  activeChatResourceTouchDrag = payload;
  touchDragListeners.forEach((listener) => listener());
}

export function parseChatResourceDragPayload(value: unknown): ChatResourceDragPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (payload.version !== 1) return null;
  if (
    payload.kind !== "character" &&
    payload.kind !== "lorebook" &&
    payload.kind !== "agent" &&
    payload.kind !== "persona" &&
    payload.kind !== "preset" &&
    payload.kind !== "connection" &&
    payload.kind !== "background"
  ) {
    return null;
  }
  if (!Array.isArray(payload.ids) || payload.ids.length === 0 || payload.ids.length > 100) return null;
  const ids = Array.from(
    new Set(payload.ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)),
  );
  if (ids.length === 0) return null;
  if (typeof payload.label !== "string" || !payload.label.trim()) return null;
  return {
    version: 1,
    kind: payload.kind,
    ids,
    label: payload.label.trim(),
    ...(payload.unsupported === "connection-kind" ? { unsupported: "connection-kind" as const } : {}),
  };
}

export function readChatResourceDragPayload(dataTransfer: DataTransfer): ChatResourceDragPayload | null {
  const raw = dataTransfer.getData(CHAT_RESOURCE_DRAG_MIME);
  if (!raw) return activeChatResourceDrag;
  try {
    return parseChatResourceDragPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeChatResourceDragPayload(dataTransfer: DataTransfer, payload: ChatResourceDragPayload) {
  activeChatResourceDrag = payload;
  dataTransfer.setData(CHAT_RESOURCE_DRAG_MIME, JSON.stringify(payload));
}

export function getActiveChatResourceDrag() {
  return activeChatResourceDrag;
}

export function clearActiveChatResourceDrag() {
  activeChatResourceDrag = null;
  if (activeChatResourceTouchDrag) {
    activeChatResourceTouchDrag = null;
    touchDragListeners.forEach((listener) => listener());
  }
}

export function isChatResourceDrag(dataTransfer: DataTransfer) {
  return dataTransfer.types.includes(CHAT_RESOURCE_DRAG_MIME) || activeChatResourceDrag !== null;
}

export function isFileDrag(dataTransfer: DataTransfer) {
  return dataTransfer.types.includes("Files") || Array.from(dataTransfer.items).some((item) => item.kind === "file");
}

export function requestChatResourceAssignment(payload: ChatResourceDragPayload) {
  window.dispatchEvent(new CustomEvent<ChatResourceDragPayload>(CHAT_RESOURCE_ASSIGN_EVENT, { detail: payload }));
}

export function requestChatAgentSetup(chatId: string, ids: string[]) {
  const pendingIds = pendingChatAgentSetup?.chatId === chatId ? pendingChatAgentSetup.ids : [];
  pendingChatAgentSetup = { chatId, ids: Array.from(new Set([...pendingIds, ...ids.filter(Boolean)])) };
  window.dispatchEvent(new CustomEvent<{ chatId: string }>(CHAT_RESOURCE_AGENT_SETUP_EVENT, { detail: { chatId } }));
}

export function takePendingChatAgentSetupIds(chatId: string) {
  const pending = pendingChatAgentSetup;
  if (pending?.chatId !== chatId) return [];
  pendingChatAgentSetup = null;
  return pending.ids;
}
