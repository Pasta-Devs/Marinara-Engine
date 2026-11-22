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
  /** The description in the new layout, when the binding does something else there. */
  overhaulLabelKey?: string;
  /**
   * Not taken while a text box has focus on Windows and Linux, where Ctrl+J belongs to Japanese IMEs (#9129)
   * and the browser (Downloads). The list says so there (QC Nov 21 A11Y18).
   */
  notWhileTypingOffApple?: boolean;
  /** The keys are pressed one after the other ("Esc, then Tab"), not as alternatives. */
  sequence?: boolean;
  /** Only works while this Settings switch is on; the list dims it and says where to turn it on. */
  requiresSetting?: "intuitiveSwipeNavigation";
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
      // GlobalOmnibarHost while the omnibar is shut, GlobalOmnibar's own listener while it is open.
      // New layout: openProfessorMariChatPage (her full chat page).
      {
        keys: [["Mod", "J"]],
        labelKey: "shortcuts.general.askMari",
        overhaulLabelKey: "shortcuts.general.openMariChat",
        notWhileTypingOffApple: true,
      },
      // GlobalOmnibar result list
      { keys: [["↑"], ["↓"], ["Enter"]], labelKey: "shortcuts.general.omnibarNavigate" },
      // GlobalOmnibar ghost completion
      { keys: [["Tab"]], labelKey: "shortcuts.general.omnibarComplete" },
      // QuickConnectionSwitcher (the composer's model chip; not while a dialog is open)
      { keys: [["Alt", "M"]], labelKey: "shortcuts.general.quickPicker" },
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
      // ChatInput / ConversationInput / GameInput / Professor Mari with "Send on Enter" off
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
      { keys: [["←"], ["→"]], labelKey: "shortcuts.messages.swipe", requiresSetting: "intuitiveSwipeNavigation" },
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
      // textarea-editing nextTabMode: Escape arms the next Tab to move on
      { keys: [["Esc"], ["Tab"]], labelKey: "shortcuts.editors.leaveBox", sequence: true },
      // useEditorSaveShortcut (every editor) and FileEditorModal
      { keys: [["Mod", "S"]], labelKey: "shortcuts.editors.save" },
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

/**
 * Alt+M (Option+M on a Mac). Read from the key's position, since Option+M types "µ". Free in the browsers: Ctrl+M
 * and Cmd+M minimize or mute, Ctrl+Shift+M opens Chrome's profile menu and Firefox's responsive view.
 */
export function isQuickPickerShortcut(event: HelpKeyEvent & { code?: string; shiftKey?: boolean }): boolean {
  return event.code === "KeyM" && event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.repeat;
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

/**
 * True when `target` takes the letter keys itself: a text field, or a Select (role="combobox") that jumps to the
 * option starting with the letter. Not for layout code, which asks isTypingTarget: a Select raises no software keyboard.
 */
export function takesLetterKeys(target: unknown): boolean {
  if (isTypingTarget(target)) return true;
  const element = target as TargetLike | null;
  return !!element?.closest?.('[role="combobox"]');
}

/**
 * #9129: a modifier letter that the page-level handler would steal must not reach a field that is being
 * typed in - a Japanese IME's Ctrl+J (SKK's on switch), not a request to open a panel. The path is read,
 * not the event's target, because a package's shadow root retargets the event to its host.
 */
/**
 * Ctrl+J / ⌘J (Professor Mari) from inside a text box. On a Mac it is ⌘J, which no IME uses, so the box
 * gives it up (A11Y18: in the message box it reached nobody). Elsewhere Ctrl+J stays the IME's (#9129).
 */
export function askMariKeyStaysInField(
  event: { composedPath?: () => ArrayLike<unknown>; isComposing?: boolean; keyCode?: number },
  apple = isApplePlatform(),
): boolean {
  if (!shortcutKeyTypesText(event)) return false;
  return !apple || event.isComposing === true || event.keyCode === 229;
}

export function shortcutKeyTypesText(event: { composedPath?: () => ArrayLike<unknown> }): boolean {
  const path = typeof event.composedPath === "function" ? Array.from(event.composedPath()) : [];
  return path.some(takesLetterKeys);
}

export function formatShortcutKey(key: string, apple = isApplePlatform()): string {
  if (key === "Mod") return apple ? "⌘" : "Ctrl";
  if (key === "Alt") return apple ? "⌥" : "Alt";
  return key;
}
