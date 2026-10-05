import type { ChatMode } from "../types/chat.js";

export const DRAWER_WINDOW_PREFIX = "drawer:";

export function getDrawerWindowId(hostId: string, drawerId: string): string {
  return `${DRAWER_WINDOW_PREFIX}${hostId}:${drawerId}`;
}

/** Keep an older chat's toolbar tools available as buttons, without copying screen coordinates. */
export function getLegacyChatWindowLayout(
  mode: ChatMode,
  metadata: Record<string, unknown>,
): { version: 1; windows: Record<string, never>; detached: string[] } | null {
  // An explicit layout, including null, is the user's choice. Multiplayer has separate controls.
  if (Object.hasOwn(metadata, "windowLayout") || metadata.multiplayer || metadata.multiplayerSetup === true)
    return null;
  if (mode !== "conversation" && mode !== "roleplay" && mode !== "game") return null;
  const sections = ["chat-branches", "active-context", "gallery"];
  if (mode !== "game") sections.push("message-search");
  if (mode === "roleplay") {
    sections.push("chat-summary", "author-notes");
    const memory = metadata.advancedMemory;
    if (metadata.enableAgents === true || (isPlainRecord(memory) && memory.enabled === true)) {
      sections.push("agent-activity");
    }
  }
  return {
    version: 1,
    windows: {},
    detached: sections.map((section) => getDrawerWindowId("chat-settings", `${mode}-${section}`)),
  };
}

export interface ChatWindowDefault {
  windowLayout: unknown | null;
  chatSettingsHintDismissed: boolean;
}

export function getChatWindowDefaultSettingsKey(mode: ChatMode): string {
  return `chat-window-default-${mode}`;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

/** Read only reusable presentation settings; the client sanitizes individual window coordinates. */
export function parseChatWindowDefault(value: string | null): ChatWindowDefault | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isPlainRecord(parsed) || typeof parsed.chatSettingsHintDismissed !== "boolean") return null;
    const layout = parsed.windowLayout;
    if (layout !== null) {
      if (!isPlainRecord(layout) || layout.version !== 1 || !isPlainRecord(layout.windows)) return null;
      if (
        "detached" in layout &&
        (!Array.isArray(layout.detached) || layout.detached.some((id) => typeof id !== "string"))
      ) {
        return null;
      }
      if ("bubbles" in layout && !isPlainRecord(layout.bubbles)) return null;
      if ("phoneBubbles" in layout && !isPlainRecord(layout.phoneBubbles)) return null;
    }
    return { windowLayout: layout, chatSettingsHintDismissed: parsed.chatSettingsHintDismissed };
  } catch {
    return null;
  }
}
