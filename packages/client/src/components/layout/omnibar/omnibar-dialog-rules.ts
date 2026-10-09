// The omnibar dialog's fixed rules: which rows edit, navigate or attach to the open chat.
import { type ChatResourceDragKind } from "../../../lib/chat-resource-drag";
import {
  parseOmnibarIntent,
  type OmnibarAction,
  type OmnibarCategory,
  type OmnibarResult,
} from "../../../lib/omnibar-search";

/** Categories whose result rows open an editor rather than the thing itself. */
export const EDITOR_CATEGORIES = new Set<OmnibarCategory>([
  "character",
  "persona",
  "lorebook",
  "preset",
  "connection",
  "agent",
]);
/** What Professor Mari can change, and so what a "Continue with Prof. Mari" action is offered on. */
/** Chats the empty omnibar offers to switch back to. */
export const IDLE_RECENT_CHATS = 4;
// F3 (O5): the idle frecent group only offers rows that *navigate* somewhere
// (open a chat/entity, or run a navigation command) - never a row that writes
// on Enter, like a settings toggle or a lorebook attach. An empty Ctrl+K must
// never let a reflexive Enter silently flip something just because it was used
// recently; "controls"/"chatControls" rows (settings toggles) all set `control`.
const NAVIGATION_OMNIBAR_ACTION_KINDS = new Set<OmnibarAction["kind"]>([
  "open-mari-chat",
  "goto-message",
  "open-docs",
  "open-faq",
  "open-global-search",
  "open-lorebook-entry",
  "start-character-chat",
  "start-chat",
]);
export const isNavigationOmnibarResult = (result: Pick<OmnibarResult, "control" | "action">) =>
  !result.control && (!result.action || NAVIGATION_OMNIBAR_ACTION_KINDS.has(result.action.kind));
export const MARI_EDITABLE_CATEGORIES = new Set<OmnibarCategory>([
  "chat",
  "character",
  "persona",
  "lorebook",
  "preset",
]);

/**
 * Categories that can be attached to (or detached from) the open chat, mapped to
 * the drag payload kind that carries them. One table: every attach path — a row,
 * a preview action, a drop — has to agree on what is attachable.
 */
export const CHAT_RESOURCE_KIND: Partial<Record<OmnibarCategory, ChatResourceDragKind>> = {
  character: "character",
  persona: "persona",
  lorebook: "lorebook",
  preset: "preset",
  connection: "connection",
  agent: "agent",
};
/**
 * Choosing one of these picks it for the active chat and is a complete
 * action, not a step in browsing, so it closes the omnibar like any other row
 * (O4 item 4) instead of leaving the user to press Esc.
 */
export const CHAT_SCOPED_CHOICE_CONTROL_IDS = new Set([
  "control:chat-connection",
  "control:chat-preset",
  "control:chat-persona",
]);

// Leading resource-kind words to strip from a "create <kind> <name>" query so the
// create modal opens with just the typed name pre-filled.
const CREATE_MODAL_KIND_WORDS: Record<string, readonly string[]> = {
  "create-character": ["character", "card"],
  "create-persona": ["persona", "profile"],
  "create-lorebook": ["lorebook", "world book", "world info", "worldbook"],
  "create-preset": ["preset", "prompt preset"],
};

export function createModalPrefillName(modal: string, query: string): string | undefined {
  const words = CREATE_MODAL_KIND_WORDS[modal];
  if (!words) return undefined;
  const intent = parseOmnibarIntent(query);
  if (intent?.kind !== "create") return undefined;
  let name = intent.targetQuery.trim();
  for (const word of words) {
    const stripped = name.replace(new RegExp(`^${word}\\b\\s*`, "i"), "").trim();
    if (stripped !== name) {
      name = stripped;
      break;
    }
  }
  return name || undefined;
}
