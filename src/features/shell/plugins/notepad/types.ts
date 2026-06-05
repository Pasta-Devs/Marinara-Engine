import type { Chat } from "../../../catalog/chats";

export const LAYOUT_STORAGE_KEY = "marinara-notepad-layout-v1";
export const NOTEPAD_MEMORY_KEY = "state";
export const MIN_PANEL_WIDTH = 240;
export const MIN_PANEL_HEIGHT = 360;
export const PANEL_MARGIN = 12;
export const COLLAPSED_WIDTH = 96;
export const COLLAPSED_HEIGHT = 36;
export const COLLAPSED_OPEN_SUPPRESS_MS = 500;

export type NoteScope = "global" | "character" | "chat";
export type BranchMode = "branch" | "family";
export type StatusTone = "muted" | "ok" | "error";

export interface NotepadLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NotepadTab {
  id: string;
  title: string;
  scope: NoteScope;
  branchMode: BranchMode;
  characterId: string | null;
  chatId: string | null;
  groupId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotepadMemoryState {
  version: 1;
  activeTabId: string | null;
  tabs: NotepadTab[];
  notes: Record<string, string>;
}

export interface NotepadLayoutState {
  open: boolean;
  viewMode: "edit" | "preview";
  tabsCollapsed: boolean;
  layout: NotepadLayout;
  collapsedLayout: NotepadLayout;
}

export interface NotepadState extends NotepadMemoryState, NotepadLayoutState {}

export interface NotepadContext {
  chatId: string | null;
  chat: Chat | null;
  characterLabels: Map<string, string>;
}

export interface ScopeResolution {
  key: string;
  label: string;
  placeholder: string;
}

export interface PendingSelection {
  start: number;
  end: number;
}

export interface DropTarget {
  id: string;
  position: "before" | "after";
}

export interface NotepadStatus {
  message: string;
  tone: StatusTone;
}

export const DEFAULT_TAB: NotepadTab = {
  id: "tab-notes",
  title: "Notes",
  scope: "chat",
  branchMode: "branch",
  characterId: null,
  chatId: null,
  groupId: null,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};
