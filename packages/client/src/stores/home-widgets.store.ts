// ──────────────────────────────────────────────
// Home widgets: which ones show, shared by Home and Settings › General › Home.
//
// The list lives in the same local-storage key Home always used, so nobody loses their layout. Home and the
// Settings page both read this store, so a widget switched off in Settings is gone from Home at once.
// ──────────────────────────────────────────────
import { create } from "zustand";

export const HOME_WIDGET_VISIBILITY_STORAGE_KEY = "marinara:home:widget-visibility:v2";
export const LEGACY_HOME_WIDGET_VISIBILITY_STORAGE_KEY = "marinara:home:widget-visibility:v1";

export const HOME_WIDGET_IDS = [
  "character-library",
  "professor",
  "whats-new",
  "recent",
  "learn",
  "community",
  "discovery",
  "character",
  "clock",
  "achievements",
] as const;
export type BuiltInHomeWidgetId = (typeof HOME_WIDGET_IDS)[number];

export type HomeWidgetId = BuiltInHomeWidgetId | `custom:${string}` | `agent:${string}`;
export type AgentHomeWidget = {
  id: HomeWidgetId;
  kind: "package" | "custom";
  packageId?: string;
  agentId?: string;
  widgetId: string;
  ownerName: string;
  label: string;
  description: string;
  size: "compact" | "large";
  icon?: string;
  iconPath?: string;
  accent?: "cyan" | "green" | "amber" | "orange" | "rose" | "violet";
  surface?: "soft" | "solid" | "quiet";
  header?: "standard" | "compact" | "banner";
};

export function packageHomeWidgetId(packageId: string, widgetId: string): HomeWidgetId {
  return `agent:package:${packageId}:${widgetId}`;
}

export function isHomeWidgetId(value: unknown): value is HomeWidgetId {
  return (
    typeof value === "string" &&
    (HOME_WIDGET_IDS.includes(value as BuiltInHomeWidgetId) ||
      /^custom:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ||
      /^agent:(?:package|custom):[A-Za-z0-9_-]+:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
  );
}

export const DEFAULT_VISIBLE_HOME_WIDGETS = [
  "professor",
  "whats-new",
  "recent",
  "learn",
  "community",
] as const satisfies readonly BuiltInHomeWidgetId[];

export const NEW_DEFAULT_HOME_WIDGET_IDS: readonly BuiltInHomeWidgetId[] = ["community", "clock"];

export const HOME_WIDGET_MANAGER_LABEL_KEYS: Record<BuiltInHomeWidgetId, { name: string; purpose: string }> = {
  "character-library": { name: "home.widgets.characterLibrary", purpose: "home.characterLibrary.description" },
  professor: { name: "home.professorMari.eyebrow", purpose: "home.widgets.professor" },
  recent: { name: "home.recentChats.eyebrow", purpose: "home.recentChats.title" },
  "whats-new": { name: "home.whatsNew.eyebrow", purpose: "home.widgets.whatsNew" },
  discovery: { name: "home.discovery.eyebrow", purpose: "home.discovery.title" },
  character: { name: "home.characterOfDay.eyebrow", purpose: "home.characterOfDay.title" },
  learn: { name: "home.learn.eyebrow", purpose: "home.learn.title" },
  community: { name: "home.community.eyebrow", purpose: "home.community.title" },
  clock: { name: "home.clock.eyebrow", purpose: "home.clock.title" },
  achievements: { name: "home.achievements.eyebrow", purpose: "home.achievements.title" },
};

export function customHomeWidgetId(id: string): HomeWidgetId {
  return `custom:${id}`;
}

export function readHomeWidgetVisibility(): HomeWidgetId[] {
  if (typeof window === "undefined") return [...DEFAULT_VISIBLE_HOME_WIDGETS];
  try {
    const current = window.localStorage.getItem(HOME_WIDGET_VISIBILITY_STORAGE_KEY);
    if (current !== null) {
      const parsed = JSON.parse(current) as unknown;
      if (!Array.isArray(parsed)) return [...DEFAULT_VISIBLE_HOME_WIDGETS];
      return parsed.filter((id, index): id is HomeWidgetId => isHomeWidgetId(id) && parsed.indexOf(id) === index);
    }
    const legacy = JSON.parse(
      window.localStorage.getItem(LEGACY_HOME_WIDGET_VISIBILITY_STORAGE_KEY) ?? "null",
    ) as unknown;
    if (!Array.isArray(legacy)) return [...DEFAULT_VISIBLE_HOME_WIDGETS];
    return HOME_WIDGET_IDS.filter((id) => legacy.includes(id) || NEW_DEFAULT_HOME_WIDGET_IDS.includes(id));
  } catch {
    return [...DEFAULT_VISIBLE_HOME_WIDGETS];
  }
}

interface HomeWidgetsState {
  visible: HomeWidgetId[];
  setVisible: (next: HomeWidgetId[] | ((current: HomeWidgetId[]) => HomeWidgetId[])) => void;
}

export const useHomeWidgetsStore = create<HomeWidgetsState>()((set, get) => ({
  visible: readHomeWidgetVisibility(),
  setVisible: (next) => {
    const current = get().visible;
    const value = typeof next === "function" ? next(current) : next;
    if (value === current) return;
    set({ visible: value });
    try {
      window.localStorage.setItem(HOME_WIDGET_VISIBILITY_STORAGE_KEY, JSON.stringify(value));
    } catch {
      /* Local storage is optional; the current session still updates. */
    }
  },
}));

// Another window or tab of the Engine changed the list: follow it here too.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== HOME_WIDGET_VISIBILITY_STORAGE_KEY) return;
    useHomeWidgetsStore.setState({ visible: readHomeWidgetVisibility() });
  });
}
