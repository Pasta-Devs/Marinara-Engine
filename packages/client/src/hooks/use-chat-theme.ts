// ──────────────────────────────────────────────
// Per-chat looks (theming panel, batch 5)
//
// A chat can pick its own custom theme in Chat settings, and a character can have a default one
// for its chats. The open chat's id and tags are also put on <html> (data-chat-id,
// data-chat-tags), so a theme can restyle one story without hard-coding anything else.
// ──────────────────────────────────────────────
import { useEffect } from "react";
import { create } from "zustand";
import { useChatStore } from "../stores/chat.store";
import { useUIStore } from "../stores/ui.store";
import { removeRootVar, setRootVar } from "../lib/root-vars";
import { isDefaultChatBackground } from "../lib/chat-background";

/** Turns a tag into something a [data-chat-tags~="…"] selector can match: lowercase, no spaces. */
export function chatTagToken(tag: string) {
  return tag
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/["'\\]/g, "");
}

function readChatThemeId(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const value = (metadata as { themeId?: unknown }).themeId;
  return typeof value === "string" ? value : undefined;
}

/**
 * Whether a full page (Settings, the Library, an editor, Docs…) covers the chat. AppShell keeps it
 * up to date. While one is open, the chat's own look steps aside and the app's theme shows.
 */
export const useCenterPageOpen = create<{ open: boolean }>(() => ({ open: false }));

export type ChatThemeSource = "chat" | "character" | "app";

/**
 * Where a chat's theme comes from: its own pick, its character's default (only in a chat with
 * exactly one character, so a group or game party never borrows one member's look), or the app.
 */
export function resolveChatTheme(
  chat: { metadata?: unknown; characterIds?: string[] | null } | null,
  defaults: Record<string, string>,
): { themeId: string | undefined; source: ChatThemeSource } {
  if (!chat) return { themeId: undefined, source: "app" };
  const own = readChatThemeId(chat.metadata);
  if (own !== undefined) return { themeId: own, source: "chat" };
  const ids = chat.characterIds ?? [];
  if (ids.length === 1) {
    const fallback = defaults[ids[0]!];
    if (fallback !== undefined) return { themeId: fallback, source: "character" };
  }
  return { themeId: undefined, source: "app" };
}

/**
 * The theme the open chat asks for: a theme id, "" for the default look, or undefined to follow
 * the app's theme. Nothing while a full page covers the chat.
 */
export function useActiveThemeOverride(): string | undefined {
  const chat = useChatStore((s) => s.activeChat);
  const defaults = useUIStore((s) => s.characterThemeDefaults);
  const pageOpen = useCenterPageOpen((s) => s.open);
  if (pageOpen) return undefined;
  return resolveChatTheme(chat, defaults).themeId;
}

/** Puts the open chat's id, mode and tags on <html> for theme authors. */
export function useChatRootHooks() {
  const activeChat = useChatStore((s) => s.activeChat);
  // A full page over the chat is not "in" that chat: tag and id rules don't follow you there.
  const pageOpen = useCenterPageOpen((s) => s.open);
  const chat = pageOpen ? null : activeChat;
  const id = chat?.id ?? null;
  const mode = chat?.mode ?? null;
  const rawTags =
    chat?.metadata && typeof chat.metadata === "object" ? (chat.metadata as { tags?: unknown }).tags : null;
  const tags = Array.isArray(rawTags)
    ? rawTags
        .filter((tag): tag is string => typeof tag === "string")
        .map(chatTagToken)
        .filter(Boolean)
        .join(" ")
    : "";
  useEffect(() => {
    const root = document.documentElement;
    if (id) root.dataset.chatId = id;
    else delete root.dataset.chatId;
    if (mode) root.dataset.chatOpenMode = mode;
    else delete root.dataset.chatOpenMode;
    if (tags) root.dataset.chatTags = tags;
    else delete root.dataset.chatTags;
  }, [id, mode, tags]);
}

/**
 * Which chat-surface hooks the active theme sets. The --mari-chat-* variables used to apply only
 * when the user also turned on the matching "Apply preset …" switches on every device; a theme
 * that sets them now turns that part on by itself.
 */
export const useThemeChatHooks = create<{ font: boolean; colors: boolean; shape: boolean }>(() => ({
  font: false,
  colors: false,
  shape: false,
}));

const FONT_HOOKS = ["--mari-chat-font-family"];
const COLOR_HOOKS = [
  "--mari-chat-bg",
  "--mari-chat-border",
  "--mari-chat-border-color",
  "--mari-chat-text",
  "--mari-chat-control-color",
];
const SHAPE_HOOKS = [
  "--mari-chat-radius",
  "--mari-chat-control-radius",
  "--mari-chat-frame-clip",
  "--mari-chat-control-clip",
];

export function detectThemeChatHooks(css: string | null, setsVariable: (css: string, name: string) => boolean) {
  const uses = (names: string[]) => !!css && names.some((name) => setsVariable(css, name));
  useThemeChatHooks.setState({ font: uses(FONT_HOOKS), colors: uses(COLOR_HOOKS), shape: uses(SHAPE_HOOKS) });
}

/** The background picture the open chat shows, for "Chat background behind the side panels". */
export const useChatArt = create<{ url: string | null }>(() => ({ url: null }));

/** Called by each chat surface with the picture it is showing; clears it when the surface goes away. */
export function useReportChatArt(url: string | null | undefined) {
  // The stock background (a plain black picture) isn't art worth spreading behind the panels.
  const value = url && url !== "black" && !isDefaultChatBackground(url) ? url : null;
  useEffect(() => {
    useChatArt.setState({ url: value });
    return () => {
      if (useChatArt.getState().url === value) useChatArt.setState({ url: null });
    };
  }, [value]);
}

/** "Chat background behind the side panels": the open chat's picture fills the whole window. */
export function useChatArtBehindPanels() {
  const enabled = useUIStore((s) => s.chatArtBehindPanels);
  const url = useChatArt((s) => s.url);
  useEffect(() => {
    const root = document.documentElement;
    if (!enabled || !url) {
      delete root.dataset.mariChatArtBehind;
      removeRootVar("--mari-chat-art");
      return;
    }
    root.dataset.mariChatArtBehind = "";
    setRootVar("--mari-chat-art", `url("${url.replace(/["\\\n\r]/g, "")}")`);
  }, [enabled, url]);
}
