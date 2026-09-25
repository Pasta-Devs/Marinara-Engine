// ──────────────────────────────────────────────
// Keyboard shortcuts catalog (shown by the "?" overlay)
// ──────────────────────────────────────────────
// Every entry mirrors a binding that exists in the code; the comment above it
// names where. Keep this list in sync when adding or removing a shortcut.
// "Mod" renders as Ctrl, or as the Command key on Apple devices.
import { isApplePlatform } from "./command-center";

export interface KeyboardShortcut {
  /** Key combos; alternatives are separate arrays, keys within one are pressed together. */
  keys: string[][];
  /** Localization key of the description. */
  labelKey: string;
}

export interface KeyboardShortcutGroup {
  id: string;
  titleKey: string;
  shortcuts: KeyboardShortcut[];
}

export const KEYBOARD_SHORTCUT_GROUPS: readonly KeyboardShortcutGroup[] = [
  {
    id: "general",
    titleKey: "shortcuts.groups.general",
    shortcuts: [
      // GlobalOmnibarHost (not while another dialog is open)
      { keys: [["Mod", "K"]], labelKey: "shortcuts.general.omnibar" },
      // GlobalOmnibar result list
      { keys: [["↑"], ["↓"], ["Enter"]], labelKey: "shortcuts.general.omnibarNavigate" },
      // GlobalOmnibar ghost completion
      { keys: [["Tab"]], labelKey: "shortcuts.general.omnibarComplete" },
      // GlobalOmnibar pin toggle
      { keys: [["Mod", "P"]], labelKey: "shortcuts.general.omnibarPin" },
      // GlobalOmnibarHost (ignored while typing or while a dialog is open)
      { keys: [["?"]], labelKey: "shortcuts.general.help" },
      // Modal.tsx and every popover's Escape listener
      { keys: [["Esc"]], labelKey: "shortcuts.general.close" },
    ],
  },
  {
    id: "composer",
    titleKey: "shortcuts.groups.composer",
    shortcuts: [
      // ChatInput / ConversationInput / GameInput with "Send on Enter" on
      { keys: [["Enter"]], labelKey: "shortcuts.composer.send" },
      { keys: [["Shift", "Enter"]], labelKey: "shortcuts.composer.newline" },
      // ConversationInput / GameInput / Professor Mari with "Send on Enter" off
      { keys: [["Mod", "Enter"]], labelKey: "shortcuts.composer.sendModifier" },
      // ChatArea handleArrowUp ("Up arrow edits last message")
      { keys: [["↑"]], labelKey: "shortcuts.composer.editLast" },
      // slash, @mention and :emoji: completion lists in ChatInput / ConversationInput
      { keys: [["↑"], ["↓"]], labelKey: "shortcuts.composer.completionMove" },
      { keys: [["Tab"], ["Enter"]], labelKey: "shortcuts.composer.completionAccept" },
    ],
  },
  {
    id: "messages",
    titleKey: "shortcuts.groups.messages",
    shortcuts: [
      // ChatArea intuitive swipe navigation
      { keys: [["←"], ["→"]], labelKey: "shortcuts.messages.swipe" },
      // ChatMessage edit textarea
      { keys: [["Mod", "Enter"]], labelKey: "shortcuts.messages.saveEdit" },
      { keys: [["Esc"]], labelKey: "shortcuts.messages.cancelEdit" },
      // ChatMessageSearch
      { keys: [["Enter"]], labelKey: "shortcuts.messages.searchJump" },
    ],
  },
  {
    id: "game",
    titleKey: "shortcuts.groups.game",
    shortcuts: [
      // GameCombatUI action menu
      { keys: [["↑"], ["↓"], ["W"], ["S"]], labelKey: "shortcuts.game.combatMove" },
      { keys: [["Enter"], ["Space"]], labelKey: "shortcuts.game.combatChoose" },
    ],
  },
  {
    id: "editors",
    titleKey: "shortcuts.groups.editors",
    shortcuts: [
      // textarea-editing handleTextareaTab (prompt, macro and file editors)
      { keys: [["Tab"], ["Shift", "Tab"]], labelKey: "shortcuts.editors.indent" },
      // FileEditorModal
      { keys: [["Mod", "S"]], labelKey: "shortcuts.editors.saveFile" },
      // GameAssetsBrowserView
      { keys: [["Mod", "A"]], labelKey: "shortcuts.editors.selectAllAssets" },
      { keys: [["Esc"]], labelKey: "shortcuts.editors.clearAssetSelection" },
      // AppShell sidebar resize handles
      { keys: [["←"], ["→"], ["Home"], ["End"]], labelKey: "shortcuts.editors.resizeSidebar" },
    ],
  },
];

interface HelpKeyEvent {
  key: string;
  repeat?: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

/** "?" alone. Shift is not checked: layouts put "?" on different shifted or unshifted keys. */
export function isShortcutsHelpKey(event: HelpKeyEvent): boolean {
  return event.key === "?" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat;
}

interface TargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
  closest?: (selector: string) => unknown;
}

/** True when a keypress on `target` types text, so "?" must reach the field. */
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const element = target as TargetLike;
  const tag = element.tagName?.toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (element.getAttribute?.("type") ?? "text").toLowerCase();
    return !["button", "checkbox", "radio", "range", "reset", "submit", "color", "file", "image"].includes(type);
  }
  if (element.isContentEditable) return true;
  return !!element.closest?.('[contenteditable=""], [contenteditable="true"], [role="textbox"]');
}

export function formatShortcutKey(key: string, apple = isApplePlatform()): string {
  if (key === "Mod") return apple ? "⌘" : "Ctrl";
  return key;
}
