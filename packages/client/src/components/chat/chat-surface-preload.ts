// ──────────────────────────────────────────────
// Chat surfaces, fetched before the click
//
// ChatArea lazy-loads one surface per chat mode, and the roleplay surface then
// lazy-loads its HUD, tracker window, weather and Echo Chamber. Opened cold, a
// chat waits for both rounds of downloads before its messages are even
// requested. Warming them while the app is idle, or when the pointer reaches a
// chat in the list, removes those waits from opening a chat.
// ──────────────────────────────────────────────
import type { Chat } from "@marinara-engine/shared";

type ChatMode = Chat["mode"];

const loaders: Record<ChatMode, () => Promise<unknown>> = {
  roleplay: () => import("./ChatRoleplaySurface").then((module) => module.preloadRoleplaySurfaceParts()),
  conversation: () => import("./ChatConversationSurface"),
  game: () => import("../game/GameSurface"),
};

const started = new Map<ChatMode, Promise<unknown>>();

/** Starts downloading the code a chat of this mode needs to open. Safe to call often. */
export function preloadChatSurface(mode: ChatMode | null | undefined): void {
  if (!mode || !(mode in loaders) || started.has(mode)) return;
  started.set(
    mode,
    loaders[mode]().catch(() => {
      // A failed warm-up is retried by the real open; let a later hover try again too.
      started.delete(mode);
    }),
  );
}
