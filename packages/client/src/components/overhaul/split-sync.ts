// ──────────────────────────────────────────────
// Split view: a save in one window refreshes only what it touched in the other
//
// Both windows read the same server, so a save in one (a renamed chat, an edited
// card) has to show in the other. That used to refresh every query the other
// window had, on every write, including bookkeeping like the "last opened" touch
// a chat sends when it opens: opening split view cost the main window ~117
// refetches (QC panel 3, speed H4). Now a broadcast carries what was written
// (the server path's family) and the receiver refreshes the queries of that
// family only. A family this file doesn't know refreshes everything, as before.
// ──────────────────────────────────────────────

/** "*" means: refresh every query. */
export type SyncFamily = string;
export const EVERYTHING: SyncFamily = "*";

/**
 * Server path family (the path's first segment) -> the query key roots (queryKey[0]) that show its data.
 * A family not listed here refreshes everything.
 */
const FAMILY_QUERY_ROOTS: Record<string, readonly string[]> = {
  chats: [
    "chats",
    "home-feed",
    "gallery",
    "generation-status",
    "chat-insights",
    "conversation-status",
    "conversation-calls",
    "chat-message-search",
    "spatial-context",
    "game",
  ],
  "chat-folders": ["chat-folders", "chats", "home-feed"],
  characters: ["characters", "personas", "home-feed", "character-videos", "sprites"],
  sprites: ["sprites", "characters"],
  lorebooks: ["lorebooks"],
  prompts: ["presets", "prompt-overrides"],
  "chat-presets": ["chat-presets"],
  connections: ["connections", "connection-accounts", "connection-folders"],
  "connection-folders": ["connection-folders", "connections"],
  agents: ["agents", "custom-agent-repositories"],
  "custom-tools": ["custom-tools"],
  "regex-scripts": ["regex-scripts"],
  themes: ["themes"],
  gallery: ["gallery", "global-gallery"],
  "game-assets": ["game-assets"],
  backgrounds: ["backgrounds"],
  "custom-emojis": ["custom-emojis"],
  "custom-stickers": ["custom-stickers"],
  "knowledge-sources": ["knowledge-sources"],
  "library-folders": ["library-folders"],
  "global-gallery": ["global-gallery", "gallery"],
  tts: ["tts"],
  "capability-packages": ["capability-packages"],
  // The look and layout settings (/app-settings/ui): no query reads them; each window follows the other through
  // this device's storage (lib/follow-saved-settings.ts). Other app settings refresh everything.
  "ui-settings": [],
};

/** The family of a server path such as "/chats/abc/messages" ("chats"), or EVERYTHING when unknown. */
export function familyOfPath(path: string): SyncFamily {
  if (/^\/?app-settings\/ui(?:[/?#]|$)/.test(path)) return "ui-settings";
  const segment = path.replace(/^\/+/, "").split(/[/?#]/, 1)[0] ?? "";
  return segment && segment in FAMILY_QUERY_ROOTS ? segment : EVERYTHING;
}

/** The query key roots a set of families covers, or null when one of them means everything. */
export function queryRootsFor(families: Iterable<SyncFamily>): Set<string> | null {
  const roots = new Set<string>();
  for (const family of families) {
    const known = FAMILY_QUERY_ROOTS[family];
    if (!known) return null;
    for (const root of known) roots.add(root);
  }
  return roots;
}

let warnedUnknown = false;
/** Dev builds say once when a write falls back to refreshing everything, so the map above can grow. */
export function noteUnknownFamily(path: string) {
  if (warnedUnknown || !import.meta.env?.DEV) return;
  warnedUnknown = true;
  console.info(`[split view] ${path} has no query family in split-sync.ts; the other side refreshes everything.`);
}
