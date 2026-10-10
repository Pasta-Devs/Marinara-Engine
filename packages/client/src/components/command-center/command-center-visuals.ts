import type { ChatMode } from "@marinara-engine/shared";

import type { OmnibarCategory } from "@/lib/omnibar-search";

export type CommandCenterVisualTone = "neutral" | "cool" | "warm" | "playful" | "natural";

export interface CommandCenterVisual {
  label: string;
  tone: CommandCenterVisualTone;
  groupClassName: string;
}

export type CommandCenterCategoryLabels = Record<OmnibarCategory, string>;
export type CommandCenterChatModeLabels = Record<ChatMode, string>;

// A row's type colour is the top bar's: the same `.mari-panel-gradient--<type>` class sets
// `--mari-panel-gradient-start`, which the row's icon tile and its type badge read. Chats take the colour
// of their mode from the Chats icon's logo gradient; navigation, settings pages and docs stay neutral.
const CATEGORY_VISUALS: Record<OmnibarCategory, Omit<CommandCenterVisual, "label">> = {
  navigation: { tone: "neutral", groupClassName: "" },
  chat: { tone: "playful", groupClassName: "[--mari-panel-gradient-start:var(--mari-logo-cyan)]" },
  character: { tone: "playful", groupClassName: "mari-panel-gradient--characters" },
  persona: { tone: "natural", groupClassName: "mari-panel-gradient--personas" },
  lorebook: { tone: "warm", groupClassName: "mari-panel-gradient--lorebooks" },
  preset: { tone: "playful", groupClassName: "mari-panel-gradient--presets" },
  connection: { tone: "cool", groupClassName: "mari-panel-gradient--connections" },
  agent: { tone: "playful", groupClassName: "mari-panel-gradient--agents" },
  settings: { tone: "neutral", groupClassName: "mari-panel-gradient--settings" },
  professor: { tone: "playful", groupClassName: "[--mari-panel-gradient-start:var(--primary)]" },
  docs: { tone: "neutral", groupClassName: "" },
};

const CHAT_MODE_VISUALS: Record<ChatMode, Omit<CommandCenterVisual, "label">> = {
  conversation: { tone: "cool", groupClassName: "[--mari-panel-gradient-start:var(--mari-logo-cyan)]" },
  roleplay: { tone: "warm", groupClassName: "[--mari-panel-gradient-start:var(--mari-logo-orange)]" },
  game: { tone: "playful", groupClassName: "[--mari-panel-gradient-start:var(--mari-logo-pink)]" },
};

/** A navigation row about one type ("Create lorebook", the Agents library) wears that type's colour. */
const NAVIGATION_TYPE_BY_ICON: Partial<Record<string, OmnibarCategory>> = {
  character: "character",
  persona: "persona",
  lorebook: "lorebook",
  preset: "preset",
  connection: "connection",
  agent: "agent",
  package: "agent",
};

export function getCommandCenterCategoryVisual(
  category: OmnibarCategory,
  labels: CommandCenterCategoryLabels,
  icon?: string,
): CommandCenterVisual {
  const colourOf = category === "navigation" && icon ? (NAVIGATION_TYPE_BY_ICON[icon] ?? category) : category;
  return {
    ...CATEGORY_VISUALS[category],
    groupClassName: CATEGORY_VISUALS[colourOf].groupClassName,
    label: labels[category],
  };
}

export function getCommandCenterChatModeVisual(
  mode: ChatMode,
  labels: CommandCenterChatModeLabels,
): CommandCenterVisual {
  return { ...CHAT_MODE_VISUALS[mode], label: labels[mode] };
}

export function getValidatedCommandCenterAccent(accent: string | null | undefined): string | undefined {
  const value = accent?.trim();
  if (!value || value.length > 64 || typeof CSS === "undefined" || !CSS.supports("color", value)) return undefined;
  return value;
}
