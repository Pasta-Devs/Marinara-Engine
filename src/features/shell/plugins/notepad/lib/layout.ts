import {
  COLLAPSED_HEIGHT,
  COLLAPSED_WIDTH,
  LAYOUT_STORAGE_KEY,
  MIN_PANEL_HEIGHT,
  MIN_PANEL_WIDTH,
  PANEL_MARGIN,
  type NotepadLayout,
  type NotepadLayoutState,
} from "../types";
import { asRecord, clamp, hasWindow } from "./utils";

function viewportSize() {
  if (!hasWindow()) return { width: 1280, height: 800 };
  return {
    width: Math.max(document.documentElement.clientWidth || window.innerWidth || 1280, MIN_PANEL_WIDTH),
    height: Math.max(document.documentElement.clientHeight || window.innerHeight || 800, MIN_PANEL_HEIGHT),
  };
}

export function defaultLayout(): NotepadLayout {
  const viewport = viewportSize();
  const width = Math.min(384, viewport.width - PANEL_MARGIN * 2);
  const height = Math.min(560, viewport.height - PANEL_MARGIN * 4);
  return {
    width,
    height,
    x: Math.max(PANEL_MARGIN, viewport.width - width - 16),
    y: Math.max(PANEL_MARGIN, viewport.height - height - 84),
  };
}

export function constrainLayout(layout: Partial<NotepadLayout> | null | undefined): NotepadLayout {
  const fallback = defaultLayout();
  const viewport = viewportSize();
  const maxWidth = Math.max(MIN_PANEL_WIDTH, viewport.width - PANEL_MARGIN * 2);
  const maxHeight = Math.max(300, viewport.height - PANEL_MARGIN * 2);
  const width = clamp(
    Number.isFinite(layout?.width) ? Number(layout?.width) : fallback.width,
    MIN_PANEL_WIDTH,
    maxWidth,
  );
  const height = clamp(
    Number.isFinite(layout?.height) ? Number(layout?.height) : fallback.height,
    Math.min(MIN_PANEL_HEIGHT, maxHeight),
    maxHeight,
  );
  return {
    width,
    height,
    x: clamp(
      Number.isFinite(layout?.x) ? Number(layout?.x) : fallback.x,
      PANEL_MARGIN,
      viewport.width - width - PANEL_MARGIN,
    ),
    y: clamp(
      Number.isFinite(layout?.y) ? Number(layout?.y) : fallback.y,
      PANEL_MARGIN,
      viewport.height - height - PANEL_MARGIN,
    ),
  };
}

export function constrainCollapsedLayout(layout: Partial<NotepadLayout> | null | undefined): NotepadLayout {
  const fallback = defaultLayout();
  const viewport = viewportSize();
  return {
    width: Number.isFinite(layout?.width) ? Number(layout?.width) : fallback.width,
    height: Number.isFinite(layout?.height) ? Number(layout?.height) : fallback.height,
    x: clamp(
      Number.isFinite(layout?.x) ? Number(layout?.x) : fallback.x,
      PANEL_MARGIN,
      Math.max(PANEL_MARGIN, viewport.width - COLLAPSED_WIDTH - PANEL_MARGIN),
    ),
    y: clamp(
      Number.isFinite(layout?.y) ? Number(layout?.y) : fallback.y,
      PANEL_MARGIN,
      Math.max(PANEL_MARGIN, viewport.height - COLLAPSED_HEIGHT - PANEL_MARGIN),
    ),
  };
}

function normalizeLayoutState(value: unknown): NotepadLayoutState {
  const raw = asRecord(value) ?? {};
  const layout = constrainLayout(asRecord(raw.layout) as Partial<NotepadLayout> | null);
  return {
    open: Boolean(raw.open),
    viewMode: raw.viewMode === "preview" ? "preview" : "edit",
    tabsCollapsed: Boolean(raw.tabsCollapsed),
    layout,
    collapsedLayout: constrainCollapsedLayout(
      (asRecord(raw.collapsedLayout) as Partial<NotepadLayout> | null) ?? layout,
    ),
  };
}

export function loadLayoutState(): NotepadLayoutState {
  if (!hasWindow()) return normalizeLayoutState(null);
  try {
    return normalizeLayoutState(JSON.parse(window.localStorage.getItem(LAYOUT_STORAGE_KEY) || "{}"));
  } catch {
    return normalizeLayoutState(null);
  }
}

export function saveLayoutState(state: NotepadLayoutState): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Layout persistence is best-effort; notes are stored through plugin memory.
  }
}
