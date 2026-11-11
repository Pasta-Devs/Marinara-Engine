// ──────────────────────────────────────────────
// Theme slots (theming round 4, hooks v1.2): parts the app only renders while the active theme asks
// for them, so the stock page carries no extra elements.
//
// Window titles: a theme that sets --mari-window-title (any value, e.g. `on`) gets a real title row
// at the top of each message bubble, Home widget and message box, and (round 5) the Game narration
// box, Ctrl+K, windows such as Chat settings, and dialogs:
//   [data-mari-part="window-title"]          the row (hidden from screen readers)
//     [data-mari-part="window-title-text"]   who wrote it / the widget's title / "Message"
//     [data-mari-part="window-buttons"]      empty, for the theme's _ [] X decorations
//
// Chat row previews: a theme that sets --mari-chat-row-preview (any value) gets the newest line of
// each chat under its name in the Chats list (when no live line such as "typing" is showing):
//   [data-mari-part="chat-row-preview"]       the line; data-role is user, assistant, narrator…
//     [data-mari-part="chat-row-preview-who"] "You:" or the speaker in a group chat
// ──────────────────────────────────────────────
import { createElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { create } from "zustand";

interface ThemeSlotsState {
  windowTitles: boolean;
  chatRowPreviews: boolean;
}

export const useThemeSlots = create<ThemeSlotsState>(() => ({ windowTitles: false, chatRowPreviews: false }));

export function useChatRowPreviewSlot() {
  return useThemeSlots((state) => state.chatRowPreviews);
}

export function useWindowTitles() {
  return useThemeSlots((state) => state.windowTitles);
}

/** The window-title row, or nothing when the theme doesn't ask for it. */
export function WindowTitle({
  title,
  where,
}: {
  title?: ReactNode;
  where: "message" | "home-widget" | "composer" | "narration" | "omnibar" | "window" | "dialog";
}) {
  const on = useWindowTitles();
  const { t } = useTranslation();
  if (!on) return null;
  return createElement(
    "div",
    { "data-mari-part": "window-title", "data-window": where, "aria-hidden": "true" },
    createElement("span", { "data-mari-part": "window-title-text" }, title ?? t("theming.slots.messageBox", "Message")),
    createElement("span", { "data-mari-part": "window-buttons" }),
  );
}
