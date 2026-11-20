// ──────────────────────────────────────────────
// UI overhaul: which buttons sit on a message (Settings > Chatting > Message buttons)
//
// The person picks which actions sit on the message: buttons that send a
// request to the AI (and can cost money) go on the bar under the message;
// everything else goes on the bar at the top of the message. The ⋯ menu (and
// the long-press menu on phones and tablets) lists only what is not already a
// button there, so nothing shows twice (2026-11-20).
// ──────────────────────────────────────────────
import { useOverhaulStore } from "../../stores/overhaul.store";

export type MessageButtonMode = "roleplay" | "conversation";

export type MessageButtonId =
  | "edit"
  | "copy"
  | "branch"
  | "marks"
  | "hide"
  | "delete"
  | "react"
  | "reply"
  | "regenerate"
  | "swipes"
  | "speak"
  | "translate"
  | "thinking";

export type MessageButtonInfo = {
  id: MessageButtonId;
  /** i18n key of the button's name in Settings. */
  labelKey: string;
  /** "bottom": sends a request to the AI or a voice/translation service, so it can cost money. */
  bar: "top" | "bottom";
  modes: MessageButtonMode[];
};

export const MESSAGE_BUTTONS: MessageButtonInfo[] = [
  { id: "react", labelKey: "ui.overhaul.messagebuttons.button.react", bar: "top", modes: ["conversation"] },
  { id: "reply", labelKey: "ui.overhaul.messagebuttons.button.reply", bar: "top", modes: ["conversation"] },
  { id: "edit", labelKey: "ui.overhaul.messagebuttons.button.edit", bar: "top", modes: ["roleplay", "conversation"] },
  { id: "copy", labelKey: "ui.overhaul.messagebuttons.button.copy", bar: "top", modes: ["roleplay", "conversation"] },
  {
    id: "branch",
    labelKey: "ui.overhaul.messagebuttons.button.branch",
    bar: "top",
    modes: ["roleplay", "conversation"],
  },
  { id: "marks", labelKey: "ui.overhaul.messagebuttons.button.marks", bar: "top", modes: ["roleplay", "conversation"] },
  {
    id: "thinking",
    labelKey: "ui.overhaul.messagebuttons.button.thinking",
    bar: "top",
    modes: ["roleplay", "conversation"],
  },
  { id: "hide", labelKey: "ui.overhaul.messagebuttons.button.hide", bar: "top", modes: ["roleplay", "conversation"] },
  {
    id: "delete",
    labelKey: "ui.overhaul.messagebuttons.button.delete",
    bar: "top",
    modes: ["roleplay", "conversation"],
  },
  {
    id: "speak",
    labelKey: "ui.overhaul.messagebuttons.button.speak",
    bar: "bottom",
    modes: ["roleplay", "conversation"],
  },
  {
    id: "translate",
    labelKey: "ui.overhaul.messagebuttons.button.translate",
    bar: "bottom",
    modes: ["roleplay", "conversation"],
  },
  {
    id: "regenerate",
    labelKey: "ui.overhaul.messagebuttons.button.regenerate",
    bar: "bottom",
    modes: ["roleplay", "conversation"],
  },
  { id: "swipes", labelKey: "ui.overhaul.messagebuttons.button.swipes", bar: "bottom", modes: ["roleplay"] },
];

/** The layout before this setting existed: Roleplay's hover bars, and Conversation's Discord-style bar. */
export const DEFAULT_MESSAGE_BUTTONS: Record<MessageButtonMode, MessageButtonId[]> = {
  roleplay: ["edit", "copy", "branch", "speak", "regenerate", "swipes"],
  conversation: ["react", "reply", "speak", "regenerate"],
};

export function messageButtonsFor(mode: MessageButtonMode) {
  return MESSAGE_BUTTONS.filter((button) => button.modes.includes(mode));
}

const EMPTY: MessageButtonId[] = [];

/** The buttons shown on messages in this chat mode (a stable array, so it is safe as a selector result). */
export function useMessageButtons(mode: MessageButtonMode): readonly MessageButtonId[] {
  return useOverhaulStore((state) => state.messageButtons?.[mode] ?? DEFAULT_MESSAGE_BUTTONS[mode] ?? EMPTY);
}
