import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { flushSync } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
  Compass,
  Eye,
  EyeOff,
  ExternalLink,
  GripVertical,
  Heart,
  LibraryBig,
  MessageCircle,
  NotebookPen,
  PackagePlus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  APP_VERSION,
  HOME_CUSTOM_WIDGETS_SETTINGS_KEY,
  type AchievementEvent,
  type HomeCustomWidget,
  type HomeCustomWidgetCatalog,
} from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import { useAgentConfigs } from "../../hooks/use-agents";
import { useChats } from "../../hooks/use-chats";
import { useCharacters, usePersonas } from "../../hooks/use-characters";
import {
  selectHomeBrowserPackages,
  useCapabilityCatalog,
  useInstalledCapabilityPackages,
} from "../../hooks/use-capability-packages";
import { useLorebooks } from "../../hooks/use-lorebooks";
import { usePresets } from "../../hooks/use-presets";
import { useReducedAmbientEffects } from "../../hooks/use-reduced-ambient-effects";
import { achievementKeys, trackAchievementEvent } from "../../hooks/use-achievements";
import { api, ApiError } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { HOME_CHAT_MODE_ACCENTS } from "../../lib/home-chat-mode-style";
import { parseCharacterDisplayData } from "../../lib/character-display";
import { resolveCapabilityPackageDisplay } from "../../lib/capability-package-localization";
import {
  PROFESSOR_MARI_NAVIGATOR_POSITION_STORAGE_KEY,
  PROFESSOR_MARI_NAVIGATOR_RESET_EVENT,
  professorMariNavigatorRuntime,
  resolveProfessorMariNavigation,
  type ProfessorMariBrowserTab,
  type ProfessorMariNavigationResource,
  type ProfessorMariNavigationTarget,
} from "../../lib/professor-mari-navigation";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { CapabilityElement } from "../capabilities/CapabilityElement";
import { Modal } from "../ui/Modal";
import { HomeAchievements } from "./HomeAchievements";
import { ChatModeIcon } from "./ChatModeIcon";
import { HomeClockCalendar } from "./HomeClockCalendar";
import { HomeFaq } from "./HomeFaq";
import { HomeNewChatLauncher } from "./HomeNewChatLauncher";
import { HomeProfessorMariChat, ProfessorMariPixelScene } from "./HomeProfessorMariChat";
import { RecentChats } from "./RecentChats";

const MARI_ASSISTANT_ARRIVAL_SHEET = "/sprites/mari/generated/professor-mari-assistant-sheet.png";
const MARI_ASSISTANT_IDLE = "/sprites/mari/generated/professor-mari-assistant-idle.png";
const MARI_ASSISTANT_BLINK = "/sprites/mari/generated/professor-mari-assistant-blink-v3.png";
const MARI_ASSISTANT_MAP = "/sprites/mari/generated/professor-mari-assistant-map.png";
const MARI_ASSISTANT_SHRUG = "/sprites/mari/generated/professor-mari-assistant-shrug.png";
const MARI_ASSISTANT_DRAG_SHEET = "/sprites/mari/generated/professor-mari-assistant-drag-sheet-v3.png";
const HOME_BROWSER_PANEL_ID = "marinara-home-browser-panel";
const MARINARA_EFFECTS_PAUSED_EVENT = "marinara:effects-paused";

function readMarinaraEffectsPaused() {
  return typeof document !== "undefined" && document.documentElement.dataset.marinaraEffectsPaused === "true";
}

function useMarinaraEffectsPaused() {
  const [paused, setPaused] = useState(readMarinaraEffectsPaused);
  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ paused?: boolean }>).detail;
      setPaused(typeof detail?.paused === "boolean" ? detail.paused : readMarinaraEffectsPaused());
    };
    window.addEventListener(MARINARA_EFFECTS_PAUSED_EVENT, sync);
    return () => window.removeEventListener(MARINARA_EFFECTS_PAUSED_EVENT, sync);
  }, []);
  return paused;
}

function homeBrowserTabId(tabId: string) {
  return `marinara-home-tab-${tabId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
const HOME_CARD_ART_CLASS = "-right-5 -top-5 h-36 w-44 object-contain object-right-top opacity-30 sm:h-40 sm:w-48";
const NOODLE_REFRESH_SEEN_STORAGE_KEY = "marinara:home:noodle-refresh-seen:v1";
const PROFESSOR_ASSISTANT_EDGE_MARGIN = 16;
const PROFESSOR_ASSISTANT_HANDLE_CLEARANCE = 12;
const PROFESSOR_ASSISTANT_HOOD_GRAB_X = 0.45;
const PROFESSOR_ASSISTANT_HOOD_GRAB_Y = 0.09;
const HOME_WIDGET_ORDER_STORAGE_KEY = "marinara:home:widget-order:v1";
const HOME_WIDGET_LAYOUT_STORAGE_KEY = "marinara:home:widget-layout:v2";
const HOME_WIDGET_VISIBILITY_STORAGE_KEY = "marinara:home:widget-visibility:v2";
const LEGACY_HOME_WIDGET_VISIBILITY_STORAGE_KEY = "marinara:home:widget-visibility:v1";
const HOME_CUSTOM_WIDGET_KNOWN_STORAGE_KEY = "marinara:home:custom-widget-known:v1";
const HOME_WIDGET_IDS = [
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
type BuiltInHomeWidgetId = (typeof HOME_WIDGET_IDS)[number];
type HomeWidgetId = BuiltInHomeWidgetId | `custom:${string}`;

function isHomeWidgetId(value: unknown): value is HomeWidgetId {
  return (
    typeof value === "string" &&
    (HOME_WIDGET_IDS.includes(value as BuiltInHomeWidgetId) || /^custom:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
  );
}

type ProfessorAssistantPosition = { x: number; y: number };

type ProfessorAssistantDragLayout = {
  boundaryLeft: number;
  boundaryTop: number;
  boundaryRight: number;
  boundaryBottom: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  spriteWidth: number;
  spriteHeight: number;
  bubbleWidth: number;
  bubbleHeight: number;
};

function getProfessorAssistantBubblePlacement(
  layout: ProfessorAssistantDragLayout,
  position: ProfessorAssistantPosition,
) {
  const overlap = 12;
  const availableRight = layout.boundaryRight - (position.x + layout.spriteWidth);
  const preferBubbleOnLeft = availableRight < layout.bubbleWidth - overlap;
  const preferredLeft = preferBubbleOnLeft
    ? position.x - layout.bubbleWidth + overlap
    : position.x + layout.spriteWidth - overlap;
  const maxBubbleLeft = Math.max(layout.boundaryLeft, layout.boundaryRight - layout.bubbleWidth);
  const left = Math.max(layout.boundaryLeft, Math.min(maxBubbleLeft, preferredLeft));
  const preferredTop = position.y + layout.spriteHeight * 0.6 - layout.bubbleHeight / 2;
  const maxBubbleTop = Math.max(layout.boundaryTop, layout.boundaryBottom - layout.bubbleHeight);
  return {
    bubbleOnLeft: left + layout.bubbleWidth / 2 < position.x + layout.spriteWidth / 2,
    left,
    top: Math.max(layout.boundaryTop, Math.min(maxBubbleTop, preferredTop)),
  };
}

function clampProfessorAssistantPosition(value: number) {
  return Math.max(0, Math.min(1, value));
}

function readProfessorAssistantPosition(): ProfessorAssistantPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROFESSOR_MARI_NAVIGATOR_POSITION_STORAGE_KEY) ?? "null") as {
      x?: unknown;
      y?: unknown;
    } | null;
    if (
      !parsed ||
      typeof parsed.x !== "number" ||
      !Number.isFinite(parsed.x) ||
      typeof parsed.y !== "number" ||
      !Number.isFinite(parsed.y)
    )
      return null;
    return {
      x: clampProfessorAssistantPosition(parsed.x),
      y: clampProfessorAssistantPosition(parsed.y),
    };
  } catch {
    return null;
  }
}

function rememberProfessorAssistantPosition(position: ProfessorAssistantPosition) {
  try {
    window.localStorage.setItem(PROFESSOR_MARI_NAVIGATOR_POSITION_STORAGE_KEY, JSON.stringify(position));
  } catch {
    /* Local storage is optional; dragging still works for the current mount. */
  }
}

function readSeenNoodleRefreshMarker(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(NOODLE_REFRESH_SEEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberSeenNoodleRefreshMarker(marker: string) {
  try {
    window.localStorage.setItem(NOODLE_REFRESH_SEEN_STORAGE_KEY, marker);
  } catch {
    /* Local storage is optional; the badge still clears for the current mount. */
  }
}

function capabilityPackageAssetUrl(packageId: string, version: string, assetPath: string): string {
  const encodedPath = assetPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/capability-packages/${encodeURIComponent(packageId)}/assets/${encodedPath}?v=${encodeURIComponent(version)}`;
}

function BrowserPackageTabIcon({
  packageId,
  version,
  iconPaths,
}: {
  packageId: string;
  version: string;
  iconPaths: readonly string[] | undefined;
}) {
  if (!iconPaths?.length) return <Bot size="0.8rem" className="mari-chrome-accent-icon mari-accent-animated" />;
  if (iconPaths.length === 1) {
    return (
      <img
        src={capabilityPackageAssetUrl(packageId, version, iconPaths[0]!)}
        alt=""
        draggable={false}
        className="h-4 w-5 shrink-0 object-contain"
      />
    );
  }
  return (
    <span aria-hidden="true" className="relative h-4 w-5 shrink-0">
      {iconPaths.slice(0, 2).map((iconPath, index) => (
        <img
          key={iconPath}
          src={capabilityPackageAssetUrl(packageId, version, iconPath)}
          alt=""
          draggable={false}
          className={cn(
            "absolute h-2.5 w-4 object-contain drop-shadow-[0_1px_1px_oklch(0_0_0/0.18)]",
            index === 0 ? "left-0 top-0" : "bottom-0 right-0",
          )}
        />
      ))}
    </span>
  );
}
const DEFAULT_HOME_WIDGET_ORDER = [
  "recent",
  "professor",
  "learn",
  "whats-new",
  "community",
  "discovery",
  "character",
  "clock",
  "achievements",
] as const satisfies readonly BuiltInHomeWidgetId[];
const DEFAULT_VISIBLE_HOME_WIDGETS = [
  "professor",
  "whats-new",
  "recent",
  "learn",
  "community",
] as const satisfies readonly BuiltInHomeWidgetId[];
const NEW_DEFAULT_HOME_WIDGET_IDS: readonly BuiltInHomeWidgetId[] = ["community", "clock"];
type HomeGridColumns = 1 | 2 | 3 | 4;
type HomeWidgetSlot = HomeWidgetId | null;
type HomeWidgetLayouts = Record<HomeGridColumns, HomeWidgetSlot[]>;
const HOME_WIDGET_LABEL_KEYS: Record<BuiltInHomeWidgetId, string> = {
  professor: "home.widgets.professor",
  recent: "home.widgets.recent",
  "whats-new": "home.widgets.whatsNew",
  discovery: "home.widgets.discovery",
  character: "home.widgets.character",
  learn: "home.widgets.learn",
  community: "home.widgets.community",
  clock: "home.widgets.clock",
  achievements: "home.widgets.achievements",
};
const HOME_WIDGET_MANAGER_LABEL_KEYS: Record<BuiltInHomeWidgetId, { name: string; purpose: string }> = {
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
const HOME_WIDGET_MIN_ROW_HEIGHT = 208;
const HOME_WIDGET_MAX_ROW_HEIGHT = 640;
const ENGINE_RELEASE_URL = `https://github.com/Pasta-Devs/Marinara-Engine/releases/tag/v${encodeURIComponent(APP_VERSION)}`;
const HOME_MODULE_ACCENTS = {
  cyan: "oklch(0.79 0.16 205)",
  orange: "oklch(0.76 0.19 52)",
  pink: "oklch(0.73 0.21 345)",
  violet: "oklch(0.72 0.17 303)",
} as const;

const HOME_CUSTOM_WIDGET_ICONS = {
  sparkles: Sparkles,
  note: NotebookPen,
  heart: Heart,
  star: Star,
  book: BookOpen,
  compass: Compass,
} as const;

function customHomeWidgetId(id: string): HomeWidgetId {
  return `custom:${id}`;
}

const HOME_STARS = Array.from({ length: 42 }, (_, index) => ({
  x: (index * 37 + 7) % 100,
  y: (index * 53 + 11) % 100,
  size: 1 + ((index * 13) % 4),
  delay: -((index * 0.71) % 8),
  duration: 4.8 + ((index * 0.43) % 5),
  color: [HOME_MODULE_ACCENTS.cyan, HOME_MODULE_ACCENTS.orange, HOME_MODULE_ACCENTS.pink, "oklch(0.92 0.04 303)"][
    index % 4
  ],
}));

type CharacterRow = {
  id?: unknown;
  data?: unknown;
  comment?: unknown;
  avatarPath?: unknown;
};

type HomeBrowserHubProps = {
  pageActive: boolean;
  professorChatActive: boolean;
  professorChatOpen: boolean;
  onProfessorChatOpenChange: (open: boolean) => void;
  onProfessorChatExitComplete: () => void;
  onOpenCredits: () => void;
};

function MarinaraWordmark({ className }: { className?: string }) {
  const { t } = useTranslation();
  const brandName = t("app.documentTitle");
  return (
    <span
      className={cn(
        "mari-logo-gradient-text mari-logo-gradient-text--active inline-flex items-baseline font-black tracking-[-0.035em]",
        className,
      )}
    >
      {brandName}
    </span>
  );
}

function readHomeWidgetOrder(): HomeWidgetId[] {
  if (typeof window === "undefined") return [...DEFAULT_HOME_WIDGET_ORDER];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HOME_WIDGET_ORDER_STORAGE_KEY) ?? "null") as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_HOME_WIDGET_ORDER];
    const valid = parsed.filter(
      (value, index): value is HomeWidgetId => isHomeWidgetId(value) && parsed.indexOf(value) === index,
    );
    return valid.length > 0 ? valid : [...DEFAULT_HOME_WIDGET_ORDER];
  } catch {
    return [...DEFAULT_HOME_WIDGET_ORDER];
  }
}

function readHomeWidgetVisibility(): HomeWidgetId[] {
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

function homeWidgetSpotCount(columns: HomeGridColumns, visibleWidgets: readonly HomeWidgetId[]) {
  return visibleWidgets.reduce((total, id) => total + (id === "recent" ? (columns === 1 ? 2 : 4) : 1), 0);
}

function homeEmptySlotCount(columns: HomeGridColumns, visibleWidgets: readonly HomeWidgetId[]) {
  const spotCount = homeWidgetSpotCount(columns, visibleWidgets);
  return spotCount === 0 ? 0 : (columns - (spotCount % columns)) % columns;
}

function normalizeHomeWidgetSlots(
  value: unknown,
  columns: HomeGridColumns,
  fallbackOrder: readonly HomeWidgetId[],
  visibleWidgets: readonly HomeWidgetId[],
): HomeWidgetSlot[] {
  const supplied = Array.isArray(value) ? value : [];
  const visible = new Set(visibleWidgets);
  const seen = new Set<HomeWidgetId>();
  const slots: HomeWidgetSlot[] = [];

  for (const item of supplied) {
    if (item === null) {
      slots.push(null);
      continue;
    }
    if (!isHomeWidgetId(item) || !visible.has(item as HomeWidgetId) || seen.has(item as HomeWidgetId)) continue;
    seen.add(item as HomeWidgetId);
    slots.push(item as HomeWidgetId);
  }

  for (const id of [...fallbackOrder, ...DEFAULT_HOME_WIDGET_ORDER, ...visibleWidgets] as HomeWidgetId[]) {
    if (!visible.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    slots.push(id);
  }

  const emptyCount = homeEmptySlotCount(columns, visibleWidgets);
  let keptEmpty = 0;
  const normalized = slots.filter((item) => {
    if (item !== null) return true;
    if (keptEmpty >= emptyCount) return false;
    keptEmpty += 1;
    return true;
  });
  while (keptEmpty < emptyCount) {
    normalized.push(null);
    keptEmpty += 1;
  }
  return normalized;
}

function widgetOrderFromSlots(slots: readonly HomeWidgetSlot[]) {
  return slots.filter((slot): slot is HomeWidgetId => slot !== null);
}

function readHomeWidgetLayouts(visibleWidgets = readHomeWidgetVisibility()): HomeWidgetLayouts {
  const legacyOrder = readHomeWidgetOrder();
  let parsed: Partial<Record<HomeGridColumns, unknown>> = {};
  if (typeof window !== "undefined") {
    try {
      const stored = JSON.parse(window.localStorage.getItem(HOME_WIDGET_LAYOUT_STORAGE_KEY) ?? "null") as unknown;
      if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        parsed = stored as Partial<Record<HomeGridColumns, unknown>>;
      }
    } catch {
      /* A malformed preference falls back to the stable legacy order. */
    }
  }
  return {
    1: normalizeHomeWidgetSlots(parsed[1], 1, legacyOrder, visibleWidgets),
    2: normalizeHomeWidgetSlots(parsed[2], 2, legacyOrder, visibleWidgets),
    3: normalizeHomeWidgetSlots(parsed[3], 3, legacyOrder, visibleWidgets),
    4: normalizeHomeWidgetSlots(parsed[4], 4, legacyOrder, visibleWidgets),
  };
}

function gridColumnsForWidth(width: number): HomeGridColumns {
  if (width >= 1792) return 4;
  if (width >= 1248) return 3;
  if (width >= 672) return 2;
  return 1;
}

function readHomeWidgetRects() {
  const feed = document.querySelector('[data-component="HomeBrowserHub.Feed"]');
  return new Map(
    Array.from(feed?.querySelectorAll<HTMLElement>("[data-home-widget-id]") ?? []).map((element) => [
      element.dataset.homeWidgetId,
      element.getBoundingClientRect(),
    ]),
  );
}

function animateHomeWidgetReflow(previousRects: Map<string | undefined, DOMRect> | null) {
  if (!previousRects) return;
  const feed = document.querySelector('[data-component="HomeBrowserHub.Feed"]');
  for (const element of Array.from(feed?.querySelectorAll<HTMLElement>("[data-home-widget-id]") ?? [])) {
    const previous = previousRects.get(element.dataset.homeWidgetId);
    if (!previous) continue;
    const next = element.getBoundingClientRect();
    const deltaX = previous.left - next.left;
    const deltaY = previous.top - next.top;
    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) continue;
    for (const animation of element.getAnimations()) animation.cancel();
    element.animate(
      [{ transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` }, { transform: "translate3d(0, 0, 0)" }],
      { duration: 280, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
  }
}

function HomeWidgetFrame({
  id,
  order,
  visible,
  dragging,
  onPointerDragStart,
  onPointerDragMove,
  onPointerDragEnd,
  onKeyboardMove,
  dragLabel,
  children,
}: {
  id: HomeWidgetId;
  order: number;
  visible: boolean;
  dragging: boolean;
  onPointerDragStart: (id: HomeWidgetId, event: ReactPointerEvent<HTMLSpanElement>) => void;
  onPointerDragMove: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  onPointerDragEnd: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  onKeyboardMove: (id: HomeWidgetId, direction: -1 | 1) => void;
  dragLabel: string;
  children: ReactNode;
}) {
  if (!visible) return null;
  return (
    <div
      data-home-widget-id={id}
      className={cn(
        "mari-home-widget group relative min-h-0",
        `mari-home-widget--${id}`,
        dragging && "mari-home-widget--dragging",
      )}
      style={{ order }}
    >
      <span
        role="button"
        tabIndex={0}
        data-home-drag-handle
        aria-grabbed={dragging}
        aria-label={dragLabel}
        title={dragLabel}
        className={cn(
          "mari-home-widget__drag-handle mari-chrome-accent-text-muted absolute right-2 top-2 z-20 flex h-7 w-5 cursor-grab touch-none select-none items-center justify-center opacity-100 transition-[opacity,color,transform] hover:text-[var(--foreground)] active:cursor-grabbing active:scale-95 focus-visible:outline-none focus-visible:text-[var(--marinara-app-accent-solid)] [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-focus-within:opacity-100 [@media(pointer:fine)]:group-hover:opacity-100",
          dragging && "!cursor-grabbing !text-[var(--marinara-app-accent-solid)]",
        )}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            onKeyboardMove(id, -1);
          } else if (["ArrowRight", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            onKeyboardMove(id, 1);
          }
        }}
        onPointerDown={(event) => onPointerDragStart(id, event)}
        onPointerMove={onPointerDragMove}
        onPointerUp={onPointerDragEnd}
        onPointerCancel={onPointerDragEnd}
        onLostPointerCapture={onPointerDragEnd}
      >
        <GripVertical size="0.86rem" />
      </span>
      {children}
    </div>
  );
}

function BrowserBookmark({
  href,
  onClick,
  icon,
  tone,
  tourTarget,
  children,
}: {
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  tone: string;
  tourTarget?: string;
  children: ReactNode;
}) {
  const style = { "--bookmark-tone": tone } as CSSProperties;
  const className =
    "group inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md px-2 text-[0.6875rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bookmark-tone)] sm:min-h-8";
  const content = (
    <>
      <span className="flex h-[1.15rem] w-[1.15rem] items-center justify-center rounded-[0.3rem] bg-[color-mix(in_srgb,var(--bookmark-tone)_18%,var(--card))] text-[var(--bookmark-tone)] ring-1 ring-[color-mix(in_srgb,var(--bookmark-tone)_30%,transparent)] transition-transform duration-200 group-hover:-translate-y-px motion-reduce:transform-none">
        {icon}
      </span>
      <span>{children}</span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
        onClick={onClick}
        data-tour={tourTarget}
      >
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style} data-tour={tourTarget}>
      {content}
    </button>
  );
}

function MobileBrowserBookmark({
  href,
  onClick,
  icon,
  tone,
  children,
}: {
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  tone: string;
  children: ReactNode;
}) {
  const style = { "--bookmark-tone": tone } as CSSProperties;
  const className =
    "group flex min-h-9 w-full items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--bookmark-tone)_24%,var(--border))] bg-[color-mix(in_srgb,var(--bookmark-tone)_7%,var(--card))] px-2.5 py-1 text-left text-xs font-semibold text-[var(--foreground)] transition-[background-color,border-color,transform] hover:border-[color-mix(in_srgb,var(--bookmark-tone)_46%,var(--border))] hover:bg-[color-mix(in_srgb,var(--bookmark-tone)_13%,var(--card))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bookmark-tone)] active:scale-[0.985]";
  const content = (
    <>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--bookmark-tone)_16%,var(--card))] ring-1 ring-[color-mix(in_srgb,var(--bookmark-tone)_30%,transparent)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className} style={style}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {content}
    </button>
  );
}

function HomeWidgetShortcut({
  href,
  onClick,
  icon,
  title,
  description,
}: {
  href?: string;
  onClick?: () => void;
  icon: string;
  title: string;
  description: string;
}) {
  const className =
    "mari-home-widget-shortcut flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--home-module-accent)_10%,var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-module-accent)]";
  const content = (
    <>
      <img src={icon} alt="" className="mari-home-widget-shortcut__icon h-7 w-7 shrink-0 object-contain" />
      <span className="min-w-0">
        <span className="mari-home-widget-shortcut__title block truncate text-xs font-bold">{title}</span>
        <span className="mari-home-widget-shortcut__description line-clamp-1 text-[0.65rem] text-[var(--muted-foreground)]">
          {description}
        </span>
      </span>
    </>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function FeedModule({
  eyebrow,
  title,
  description,
  accent = HOME_MODULE_ACCENTS.cyan,
  action,
  art,
  artClassName,
  className,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  accent?: string;
  action?: ReactNode;
  art?: string;
  artClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  const style = { "--home-module-accent": accent } as CSSProperties;
  return (
    <section
      style={style}
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--home-module-accent)_30%,var(--border))] bg-[color-mix(in_srgb,var(--home-module-accent)_6%,var(--card))] p-[clamp(0.8rem,0.9vw,1.1rem)] shadow-[0_20px_50px_-38px_color-mix(in_srgb,var(--home-module-accent)_70%,transparent)]",
        className,
      )}
    >
      <span
        className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--home-module-accent)_11%,transparent)] blur-3xl"
        aria-hidden="true"
      />
      {art ? (
        <img
          src={art}
          alt=""
          aria-hidden="true"
          className={cn("pointer-events-none absolute select-none object-contain", artClassName)}
        />
      ) : null}
      <header
        className={cn(
          "relative z-[1] flex min-w-0 items-end justify-between gap-3 pr-8",
          description ? "mb-1.5" : "mb-3",
        )}
      >
        <div className="min-w-0">
          <p className="text-[0.625rem] font-extrabold uppercase tracking-[0.16em] text-[var(--home-module-accent)]">
            {eyebrow}
          </p>
          <h2 className="mt-0.5 truncate text-base font-bold text-[var(--foreground)] xl:text-[1.05rem]">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">{description}</p>
          ) : null}
        </div>
        {action}
      </header>
      <div className="relative z-[1] min-h-0 flex-1">{children}</div>
    </section>
  );
}

function HomeStarfield() {
  return (
    <div className="mari-home-browser-starfield" aria-hidden="true">
      {HOME_STARS.map((star, index) => (
        <span
          key={index}
          className="mari-home-browser-star"
          style={
            {
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              color: star.color,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function FloatingProfessorMari({
  pageActive,
  enabled,
  boundaryRef,
  onResolve,
  onNavigate,
  onOpenProfessor,
  onOpenDocumentation,
  onMeaningfulDrag,
}: {
  pageActive: boolean;
  enabled: boolean;
  boundaryRef: RefObject<HTMLElement | null>;
  onResolve: (query: string) => ProfessorMariNavigationTarget | null;
  onNavigate: (target: ProfessorMariNavigationTarget) => void;
  onOpenProfessor: () => void;
  onOpenDocumentation: () => void;
  onMeaningfulDrag: () => void;
}) {
  const { t } = useTranslation();
  const reduceMotion = useReducedAmbientEffects();
  const effectsPaused = useMarinaraEffectsPaused();
  const [visible, setVisible] = useState(
    () =>
      pageActive && enabled && professorMariNavigatorRuntime.hasAppeared && !professorMariNavigatorRuntime.minimized,
  );
  const [minimized, setMinimized] = useState(professorMariNavigatorRuntime.minimized);
  const [phase, setPhase] = useState<"arriving" | "idle" | "map" | "shrug">(
    professorMariNavigatorRuntime.hasAppeared ? "idle" : "arriving",
  );
  const [mode, setMode] = useState<"prompt" | "input" | "success" | "failure">("prompt");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const appearanceTimerRef = useRef<number | null>(null);
  const arrivalCompleteTimerRef = useRef<number | null>(null);
  const navigationTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const pendingNavigationTargetRef = useRef<ProfessorMariNavigationTarget | null>(null);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const focusFrameRef = useRef<number | null>(null);
  const overlayRef = useRef<HTMLElement | null>(null);
  const spriteRef = useRef<HTMLDivElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const dragAnimationRef = useRef<HTMLSpanElement | null>(null);
  const dragMoveFrameRef = useRef<number | null>(null);
  const pendingDragPositionRef = useRef<ProfessorAssistantPosition | null>(null);
  const normalizedPositionRef = useRef<ProfessorAssistantPosition | null>(readProfessorAssistantPosition());
  const positionRef = useRef<ProfessorAssistantPosition | null>(null);
  const dragLayoutRef = useRef<ProfessorAssistantDragLayout | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    startClientX: number;
    startClientY: number;
    meaningful: boolean;
  } | null>(null);
  const [desktopDragEnabled, setDesktopDragEnabled] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 640px) and (pointer: fine)").matches,
  );
  const [dragSpriteReady, setDragSpriteReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<ProfessorAssistantPosition | null>(null);
  const [dragLayout, setDragLayout] = useState<ProfessorAssistantDragLayout | null>(null);

  const clearTimers = useCallback(() => {
    if (appearanceTimerRef.current !== null) window.clearTimeout(appearanceTimerRef.current);
    if (arrivalCompleteTimerRef.current !== null) window.clearTimeout(arrivalCompleteTimerRef.current);
    if (navigationTimerRef.current !== null) window.clearTimeout(navigationTimerRef.current);
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    appearanceTimerRef.current = null;
    arrivalCompleteTimerRef.current = null;
    navigationTimerRef.current = null;
    resetTimerRef.current = null;
  }, []);

  const returnToIdle = useCallback(() => {
    clearTimers();
    pendingNavigationTargetRef.current = null;
    setMode("prompt");
    setPhase("idle");
    setQuery("");
  }, [clearTimers]);

  useEffect(() => {
    const reset = () => {
      clearTimers();
      pendingNavigationTargetRef.current = null;
      normalizedPositionRef.current = null;
      positionRef.current = null;
      dragLayoutRef.current = null;
      setDragPosition(null);
      setDragLayout(null);
      setDragging(false);
      setMinimized(false);
      setMode("prompt");
      setPhase("idle");
      setQuery("");
      setVisible(pageActive);
    };
    window.addEventListener(PROFESSOR_MARI_NAVIGATOR_RESET_EVENT, reset);
    return () => window.removeEventListener(PROFESSOR_MARI_NAVIGATOR_RESET_EVENT, reset);
  }, [clearTimers, pageActive]);

  const queueInputFocus = useCallback(() => {
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      inputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 640px) and (pointer: fine)");
    const syncDesktopDrag = () => setDesktopDragEnabled(mediaQuery.matches);
    syncDesktopDrag();
    mediaQuery.addEventListener("change", syncDesktopDrag);
    return () => mediaQuery.removeEventListener("change", syncDesktopDrag);
  }, []);

  useEffect(() => {
    if (!pageActive || !enabled || minimized || !desktopDragEnabled || dragSpriteReady) return;
    let active = true;
    let settled = false;
    const image = new Image();
    const markReady = () => {
      if (settled) return;
      settled = true;
      if (active) setDragSpriteReady(true);
    };
    const decode = () => {
      if (typeof image.decode === "function") void image.decode().then(markReady, markReady);
      else markReady();
    };
    image.addEventListener("load", decode, { once: true });
    image.src = MARI_ASSISTANT_DRAG_SHEET;
    if (image.complete) decode();
    return () => {
      active = false;
      image.removeEventListener("load", decode);
    };
  }, [desktopDragEnabled, dragSpriteReady, enabled, minimized, pageActive]);

  const syncDragLayout = useCallback(() => {
    if (!desktopDragEnabled || dragRef.current) return;
    const overlay = overlayRef.current;
    const boundary = boundaryRef.current;
    const sprite = spriteRef.current;
    const bubble = bubbleRef.current;
    if (!overlay || !boundary || !sprite || !bubble) return;
    const overlayBounds = overlay.getBoundingClientRect();
    const boundaryBounds = boundary.getBoundingClientRect();
    const spriteBounds = sprite.getBoundingClientRect();
    const bubbleBounds = bubble.getBoundingClientRect();
    const boundaryLeft = boundaryBounds.left - overlayBounds.left + PROFESSOR_ASSISTANT_EDGE_MARGIN;
    const boundaryTop = boundaryBounds.top - overlayBounds.top + PROFESSOR_ASSISTANT_EDGE_MARGIN;
    const boundaryRight = boundaryBounds.right - overlayBounds.left - PROFESSOR_ASSISTANT_EDGE_MARGIN;
    const boundaryBottom = boundaryBounds.bottom - overlayBounds.top - PROFESSOR_ASSISTANT_EDGE_MARGIN;
    const minX = boundaryLeft;
    const minY = boundaryTop + PROFESSOR_ASSISTANT_HANDLE_CLEARANCE;
    const maxX = Math.max(minX, boundaryRight - spriteBounds.width);
    const maxY = Math.max(minY, boundaryBottom - spriteBounds.height);
    let normalized = normalizedPositionRef.current;
    if (!normalized) {
      normalized = {
        x: 0,
        y: 1,
      };
      normalizedPositionRef.current = normalized;
    }
    const nextLayout = {
      boundaryLeft,
      boundaryTop,
      boundaryRight,
      boundaryBottom,
      minX,
      minY,
      maxX,
      maxY,
      spriteWidth: spriteBounds.width,
      spriteHeight: spriteBounds.height,
      bubbleWidth: bubbleBounds.width,
      bubbleHeight: bubbleBounds.height,
    };
    const nextPosition = {
      x: minX + normalized.x * (maxX - minX),
      y: minY + normalized.y * (maxY - minY),
    };
    dragLayoutRef.current = nextLayout;
    positionRef.current = nextPosition;
    setDragLayout(nextLayout);
    setDragPosition(nextPosition);
  }, [boundaryRef, desktopDragEnabled]);

  useLayoutEffect(() => {
    if (!visible || minimized || !desktopDragEnabled) return;
    syncDragLayout();
    const observer = new ResizeObserver(syncDragLayout);
    if (overlayRef.current) observer.observe(overlayRef.current);
    if (boundaryRef.current) observer.observe(boundaryRef.current);
    if (spriteRef.current) observer.observe(spriteRef.current);
    if (bubbleRef.current) observer.observe(bubbleRef.current);
    return () => observer.disconnect();
  }, [boundaryRef, desktopDragEnabled, minimized, mode, syncDragLayout, visible]);

  useEffect(
    () => () => {
      clearTimers();
      if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
      if (dragMoveFrameRef.current !== null) window.cancelAnimationFrame(dragMoveFrameRef.current);
      focusFrameRef.current = null;
      dragMoveFrameRef.current = null;
      pendingDragPositionRef.current = null;
      dragRef.current = null;
      document.documentElement.classList.remove("mari-home-professor-drag-active");
    },
    [clearTimers],
  );

  useEffect(() => {
    if (effectsPaused) {
      clearTimers();
      if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
      if (dragMoveFrameRef.current !== null) window.cancelAnimationFrame(dragMoveFrameRef.current);
      const activeDrag = dragRef.current;
      if (activeDrag && spriteRef.current?.hasPointerCapture(activeDrag.pointerId)) {
        spriteRef.current.releasePointerCapture(activeDrag.pointerId);
      }
      focusFrameRef.current = null;
      dragMoveFrameRef.current = null;
      pendingDragPositionRef.current = null;
      dragRef.current = null;
      document.documentElement.classList.remove("mari-home-professor-drag-active");
      setDragging(false);
      if (reduceMotion && pageActive && enabled && !professorMariNavigatorRuntime.minimized) {
        professorMariNavigatorRuntime.hasAppeared = true;
        setMinimized(false);
        setPhase("idle");
        setVisible(true);
      }
      return;
    }
    if (!pageActive || !enabled) {
      clearTimers();
      if (dragMoveFrameRef.current !== null) window.cancelAnimationFrame(dragMoveFrameRef.current);
      dragMoveFrameRef.current = null;
      pendingDragPositionRef.current = null;
      dragRef.current = null;
      document.documentElement.classList.remove("mari-home-professor-drag-active");
      setDragging(false);
      setVisible(false);
      return;
    }
    if (professorMariNavigatorRuntime.minimized) {
      setMinimized(true);
      setVisible(false);
      return;
    }
    if (professorMariNavigatorRuntime.hasAppeared) {
      setMinimized(false);
      setVisible(true);
      if (phase === "arriving" && !reduceMotion) {
        arrivalCompleteTimerRef.current = window.setTimeout(() => {
          arrivalCompleteTimerRef.current = null;
          setPhase("idle");
        }, 1_600);
      }
      return;
    }
    appearanceTimerRef.current = window.setTimeout(
      () => {
        appearanceTimerRef.current = null;
        professorMariNavigatorRuntime.hasAppeared = true;
        setPhase(reduceMotion ? "idle" : "arriving");
        setVisible(true);
        if (!reduceMotion) {
          arrivalCompleteTimerRef.current = window.setTimeout(() => {
            arrivalCompleteTimerRef.current = null;
            setPhase("idle");
          }, 1_600);
        }
      },
      reduceMotion ? 0 : 1_150,
    );
    return clearTimers;
  }, [clearTimers, effectsPaused, enabled, pageActive, phase, reduceMotion]);

  useEffect(() => {
    if (effectsPaused || !pageActive || !enabled || mode !== "success" || phase !== "map") return;
    const target = pendingNavigationTargetRef.current;
    if (target) {
      navigationTimerRef.current = window.setTimeout(() => {
        navigationTimerRef.current = null;
        pendingNavigationTargetRef.current = null;
        onNavigateRef.current(target);
        resetTimerRef.current = window.setTimeout(returnToIdle, reduceMotion ? 1_250 : 1_400);
      }, 650);
    } else {
      resetTimerRef.current = window.setTimeout(returnToIdle, reduceMotion ? 1_250 : 1_400);
    }
    return () => {
      if (navigationTimerRef.current !== null) window.clearTimeout(navigationTimerRef.current);
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
      navigationTimerRef.current = null;
      resetTimerRef.current = null;
    };
  }, [effectsPaused, enabled, mode, pageActive, phase, reduceMotion, returnToIdle]);

  const applyProfessorDragPosition = useCallback((position: ProfessorAssistantPosition) => {
    const sprite = spriteRef.current;
    const bubble = bubbleRef.current;
    const layout = dragLayoutRef.current;
    if (!sprite || !bubble || !layout) return;
    const placement = getProfessorAssistantBubblePlacement(layout, position);
    sprite.style.left = `${position.x}px`;
    sprite.style.top = `${position.y}px`;
    bubble.style.left = `${placement.left}px`;
    bubble.style.top = `${placement.top}px`;
    bubble.dataset.tailSide = placement.bubbleOnLeft ? "right" : "left";
  }, []);

  const beginProfessorDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!desktopDragEnabled || !dragSpriteReady || !dragLayoutRef.current || !positionRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.target instanceof HTMLElement)
      event.target.closest<HTMLElement>("[role=button]")?.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const spriteBounds = spriteRef.current?.getBoundingClientRect();
    if (!spriteBounds) return;
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: spriteBounds.width * PROFESSOR_ASSISTANT_HOOD_GRAB_X,
      offsetY: spriteBounds.height * PROFESSOR_ASSISTANT_HOOD_GRAB_Y,
      startClientX: event.clientX,
      startClientY: event.clientY,
      meaningful: false,
    };
    if (dragMoveFrameRef.current !== null) window.cancelAnimationFrame(dragMoveFrameRef.current);
    dragMoveFrameRef.current = null;
    pendingDragPositionRef.current = null;
    for (const animation of dragAnimationRef.current?.getAnimations() ?? []) animation.currentTime = 0;
    document.documentElement.classList.add("mari-home-professor-drag-active");
    flushSync(() => setDragging(true));
  };

  const moveProfessorDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const layout = dragLayoutRef.current;
    const overlay = overlayRef.current;
    if (!drag || !layout || !overlay || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (!drag.meaningful && Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY) >= 8) {
      drag.meaningful = true;
    }
    const overlayBounds = overlay.getBoundingClientRect();
    const nextPosition = {
      x: Math.max(layout.minX, Math.min(layout.maxX, event.clientX - overlayBounds.left - drag.offsetX)),
      y: Math.max(layout.minY, Math.min(layout.maxY, event.clientY - overlayBounds.top - drag.offsetY)),
    };
    positionRef.current = nextPosition;
    pendingDragPositionRef.current = nextPosition;
    if (dragMoveFrameRef.current !== null) return;
    dragMoveFrameRef.current = window.requestAnimationFrame(() => {
      dragMoveFrameRef.current = null;
      const pendingPosition = pendingDragPositionRef.current;
      pendingDragPositionRef.current = null;
      if (pendingPosition) applyProfessorDragPosition(pendingPosition);
    });
  };

  const finishProfessorDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const layout = dragLayoutRef.current;
    const position = positionRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (dragMoveFrameRef.current !== null) window.cancelAnimationFrame(dragMoveFrameRef.current);
    dragMoveFrameRef.current = null;
    pendingDragPositionRef.current = null;
    if (position) applyProfessorDragPosition(position);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    document.documentElement.classList.remove("mari-home-professor-drag-active");
    setDragging(false);
    if (drag.meaningful) onMeaningfulDrag();
    if (!layout || !position) return;
    setDragPosition(position);
    const normalized = {
      x: layout.maxX === layout.minX ? 0 : (position.x - layout.minX) / (layout.maxX - layout.minX),
      y: layout.maxY === layout.minY ? 0 : (position.y - layout.minY) / (layout.maxY - layout.minY),
    };
    normalizedPositionRef.current = normalized;
    rememberProfessorAssistantPosition(normalized);
  };

  const nudgeProfessor = (event: ReactKeyboardEvent<HTMLSpanElement>) => {
    if (!desktopDragEnabled || !dragLayout || !dragPosition) return;
    const directions: Record<string, ProfessorAssistantPosition> = {
      ArrowLeft: { x: -16, y: 0 },
      ArrowRight: { x: 16, y: 0 },
      ArrowUp: { x: 0, y: -16 },
      ArrowDown: { x: 0, y: 16 },
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const nextPosition = {
      x: Math.max(dragLayout.minX, Math.min(dragLayout.maxX, dragPosition.x + direction.x)),
      y: Math.max(dragLayout.minY, Math.min(dragLayout.maxY, dragPosition.y + direction.y)),
    };
    const normalized = {
      x:
        dragLayout.maxX === dragLayout.minX
          ? 0
          : (nextPosition.x - dragLayout.minX) / (dragLayout.maxX - dragLayout.minX),
      y:
        dragLayout.maxY === dragLayout.minY
          ? 0
          : (nextPosition.y - dragLayout.minY) / (dragLayout.maxY - dragLayout.minY),
    };
    normalizedPositionRef.current = normalized;
    positionRef.current = nextPosition;
    setDragPosition(nextPosition);
    rememberProfessorAssistantPosition(normalized);
  };

  const renderedDragPosition = dragging ? positionRef.current : dragPosition;
  const desktopSpriteStyle = useMemo<CSSProperties | undefined>(() => {
    if (!desktopDragEnabled) return undefined;
    if (!renderedDragPosition) return { visibility: "hidden" };
    return { left: renderedDragPosition.x, top: renderedDragPosition.y };
  }, [desktopDragEnabled, renderedDragPosition]);

  const desktopBubblePlacement = useMemo(() => {
    if (!desktopDragEnabled || !dragLayout || !renderedDragPosition) return null;
    const placement = getProfessorAssistantBubblePlacement(dragLayout, renderedDragPosition);
    return {
      bubbleOnLeft: placement.bubbleOnLeft,
      style: {
        left: placement.left,
        top: placement.top,
      } satisfies CSSProperties,
    };
  }, [desktopDragEnabled, dragLayout, renderedDragPosition]);

  if (!pageActive || !enabled) return null;
  if (!visible) {
    if (!minimized) return null;
    return (
      <button
        type="button"
        data-tour="home-navigation"
        onClick={() => {
          clearTimers();
          professorMariNavigatorRuntime.minimized = false;
          setMinimized(false);
          setMode("input");
          setPhase("idle");
          setQuery("");
          setVisible(true);
          queueInputFocus();
        }}
        aria-label={t("home.assistant.navigate")}
        title={t("home.assistant.navigate")}
        className="mari-chrome-accent-frame mari-chrome-accent-panel mari-accent-animated mari-home-professor-recall absolute bottom-[max(0.65rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-[30] flex h-14 w-14 items-end justify-center overflow-hidden rounded-full border p-0.5 transition-[transform,box-shadow,background-color] hover:-translate-y-0.5 hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] active:scale-95 motion-reduce:transition-none sm:bottom-4 sm:right-4"
      >
        <img
          src={MARI_ASSISTANT_IDLE}
          alt=""
          aria-hidden="true"
          className="h-[92%] w-[92%] object-contain [image-rendering:pixelated]"
          style={{ objectPosition: "calc(50% + 1.5px) bottom" }}
        />
      </button>
    );
  }
  const minimize = () => {
    clearTimers();
    pendingNavigationTargetRef.current = null;
    professorMariNavigatorRuntime.minimized = true;
    setMinimized(true);
    setVisible(false);
  };
  const openInput = () => {
    clearTimers();
    pendingNavigationTargetRef.current = null;
    setMode("input");
    setPhase("idle");
    queueInputFocus();
  };
  const returnToSearch = () => {
    clearTimers();
    pendingNavigationTargetRef.current = null;
    setMode("input");
    setPhase("idle");
    setQuery("");
    queueInputFocus();
  };
  const submitNavigation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) return;
    clearTimers();
    const target = onResolve(query);
    if (target) {
      pendingNavigationTargetRef.current = target;
      setMode("success");
      setPhase("map");
      return;
    }
    setMode("failure");
    setPhase("shrug");
  };
  return (
    <aside
      ref={overlayRef}
      className={cn(
        "mari-home-professor-popup pointer-events-none absolute z-[30]",
        desktopDragEnabled
          ? "inset-0"
          : "bottom-[max(0rem,env(safe-area-inset-bottom))] left-2 right-2 flex items-end justify-end sm:left-5 sm:right-5",
      )}
      aria-label={t("home.assistant.landmark")}
      data-dragging={dragging ? "true" : "false"}
    >
      <div
        ref={spriteRef}
        className={cn(
          "mari-home-professor-popup__sprite group relative z-[2] h-[11.5rem] w-[7.65rem] shrink-0 sm:h-[14rem] sm:w-[9.3rem]",
          desktopDragEnabled &&
            "pointer-events-auto absolute cursor-grab touch-none select-none active:cursor-grabbing",
        )}
        style={desktopSpriteStyle}
        data-component="HomeBrowserHub.ProfessorAssistantSprite"
        onPointerDown={beginProfessorDrag}
        onPointerMove={moveProfessorDrag}
        onPointerUp={finishProfessorDrag}
        onPointerCancel={finishProfessorDrag}
        onLostPointerCapture={finishProfessorDrag}
      >
        {desktopDragEnabled && dragSpriteReady ? (
          <span
            role="button"
            tabIndex={0}
            aria-grabbed={dragging}
            aria-label={t("home.assistant.drag")}
            title={t("home.assistant.drag")}
            data-component="HomeBrowserHub.ProfessorDragHandle"
            className={cn(
              "pointer-events-auto absolute left-[45%] top-[-0.45rem] z-[8] flex h-7 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center text-[var(--muted-foreground)] opacity-0 drop-shadow-[0_2px_4px_var(--background)] transition-[opacity,color,transform] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:text-[var(--marinara-app-accent-solid)] focus-visible:opacity-100 [@media(pointer:fine)]:group-hover:opacity-100",
              dragging && "!cursor-grabbing !text-[var(--marinara-app-accent-solid)] !opacity-100",
            )}
            onKeyDown={nudgeProfessor}
          >
            <GripVertical size="0.9rem" />
          </span>
        ) : null}
        {desktopDragEnabled && dragSpriteReady ? (
          <span
            ref={dragAnimationRef}
            className="mari-home-professor-popup__drag-frame absolute z-[5] bg-no-repeat [background-size:400%_100%]"
            style={{ backgroundImage: `url(${MARI_ASSISTANT_DRAG_SHEET})` }}
            aria-hidden="true"
            data-component="HomeBrowserHub.ProfessorDragAnimation"
          />
        ) : null}
        <div className="mari-home-professor-popup__rest-frame absolute inset-0" aria-hidden="true">
          <span
            className={cn(
              "mari-home-professor-popup__arrival-frame absolute inset-0 z-[2] bg-no-repeat opacity-0 [background-size:400%_100%]",
              phase === "arriving" && "opacity-100",
            )}
            style={{ backgroundImage: `url(${MARI_ASSISTANT_ARRIVAL_SHEET})` }}
          />
          <span
            className={cn(
              "mari-home-professor-popup__idle-stage absolute inset-0 z-[1] opacity-0",
              phase === "idle" && "mari-home-professor-popup__idle-stage--active opacity-100",
            )}
          >
            <img
              src={MARI_ASSISTANT_IDLE}
              alt=""
              draggable={false}
              className="mari-home-professor-popup__idle absolute inset-0 h-full w-full object-contain object-bottom"
            />
            <img
              src={MARI_ASSISTANT_BLINK}
              alt=""
              draggable={false}
              className="mari-home-professor-popup__blink absolute inset-0 h-full w-full object-contain object-bottom"
            />
          </span>
          {phase === "map" || phase === "shrug" ? (
            <img
              src={phase === "map" ? MARI_ASSISTANT_MAP : MARI_ASSISTANT_SHRUG}
              alt=""
              draggable={false}
              className={cn(
                "mari-home-professor-popup__state-image absolute inset-0 z-[3] h-full w-full object-contain object-bottom",
                phase === "map"
                  ? "mari-home-professor-popup__state-image--map"
                  : "mari-home-professor-popup__state-image--shrug",
              )}
            />
          ) : null}
        </div>
      </div>
      <div
        ref={bubbleRef}
        className={cn(
          "mari-chrome-accent-frame mari-chrome-accent-panel mari-accent-animated mari-home-professor-popup__bubble pointer-events-auto z-[3] rounded-2xl border px-4 py-3.5 pr-10",
          desktopDragEnabled
            ? "absolute w-[min(22rem,calc(100%_-_2rem))]"
            : "relative mb-[5.5rem] -ml-2 w-[min(22rem,calc(100%_-_6.5rem))] sm:mb-[6.5rem] sm:-ml-3",
          desktopDragEnabled && !desktopBubblePlacement && "invisible",
          dragging && desktopDragEnabled && "pointer-events-none",
        )}
        style={desktopBubblePlacement?.style}
        data-component="HomeBrowserHub.ProfessorAssistantBubble"
        data-tour="home-navigation"
        data-tail-side={desktopBubblePlacement ? (desktopBubblePlacement.bubbleOnLeft ? "right" : "left") : undefined}
      >
        <span
          className="mari-home-professor-popup__bubble-tail"
          aria-hidden="true"
          data-component="HomeBrowserHub.ProfessorAssistantBubbleTail"
        />
        <button
          type="button"
          onClick={minimize}
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
          aria-label={t("home.assistant.dismiss")}
        >
          <X size="0.72rem" />
        </button>
        <p className="text-xs font-bold leading-relaxed text-[var(--foreground)] sm:text-sm">
          {dragging
            ? t("home.assistant.dragPrompt")
            : mode === "success"
              ? t("home.assistant.found")
              : mode === "failure"
                ? t("home.assistant.notFound")
                : t("home.assistant.prompt")}
        </p>
        {!dragging && mode === "prompt" ? (
          <button
            type="button"
            onClick={openInput}
            className="mari-chrome-control mari-chrome-control--compact mari-chrome-control--selected mari-accent-animated mt-2 h-8 px-3 text-[0.6875rem] font-extrabold"
          >
            {t("home.assistant.navigate")}
          </button>
        ) : !dragging && mode === "input" ? (
          <form onSubmit={submitNavigation} className="relative mt-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") returnToIdle();
              }}
              placeholder={t("home.assistant.searchPlaceholder")}
              className="mari-chrome-field h-9 w-full rounded-lg pl-3 pr-9 text-xs"
            />
            <button
              type="submit"
              disabled={!query.trim()}
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md text-[var(--marinara-app-accent-solid)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)] disabled:opacity-35"
              aria-label={t("home.assistant.searchAction")}
            >
              <Search size="0.8rem" />
            </button>
          </form>
        ) : !dragging && mode === "failure" ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={returnToSearch}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)]"
              aria-label={t("home.assistant.back")}
              title={t("home.assistant.back")}
            >
              <ArrowLeft size="0.78rem" />
            </button>
            <button
              type="button"
              onClick={() => {
                returnToIdle();
                onOpenDocumentation();
              }}
              className="inline-flex min-h-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 text-[0.6875rem] font-bold text-[var(--foreground)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)]"
            >
              {t("home.actions.documentation")}
            </button>
            <button
              type="button"
              onClick={onOpenProfessor}
              className="mari-chrome-control mari-chrome-control--compact mari-chrome-control--selected mari-accent-animated h-8 px-2.5 text-[0.6875rem] font-extrabold"
            >
              {t("home.assistant.askProfessor")}
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function ShortcutIcon({ tone, children }: { tone: string; children: ReactNode }) {
  const style = { "--shortcut-tone": tone } as CSSProperties;
  return (
    <span
      style={style}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--shortcut-tone)_42%,var(--border))] bg-[color-mix(in_srgb,var(--shortcut-tone)_16%,var(--card))] text-[var(--shortcut-tone)] shadow-[0_12px_24px_-20px_color-mix(in_srgb,var(--shortcut-tone)_82%,transparent)] transition-[transform,box-shadow,background-color] duration-200 group-hover:-translate-y-0.5 group-hover:bg-[color-mix(in_srgb,var(--shortcut-tone)_23%,var(--card))] group-hover:shadow-[0_16px_28px_-18px_color-mix(in_srgb,var(--shortcut-tone)_86%,transparent)] group-focus-visible:-translate-y-0.5 motion-reduce:transform-none"
    >
      {children}
    </span>
  );
}

export function HomeBrowserHub({
  pageActive,
  professorChatActive,
  professorChatOpen,
  onProfessorChatOpenChange,
  onProfessorChatExitComplete,
  onOpenCredits,
}: HomeBrowserHubProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const customWidgetsQuery = useQuery({
    queryKey: ["home-custom-widgets"],
    queryFn: () => api.get<HomeCustomWidgetCatalog>(`/app-settings/${HOME_CUSTOM_WIDGETS_SETTINGS_KEY}`),
  });
  const customWidgets = useMemo(() => customWidgetsQuery.data?.widgets ?? [], [customWidgetsQuery.data?.widgets]);
  const customWidgetIds = useMemo(() => customWidgets.map((widget) => customHomeWidgetId(widget.id)), [customWidgets]);
  const customWidgetsById = useMemo(
    () => new Map(customWidgets.map((widget) => [customHomeWidgetId(widget.id), widget])),
    [customWidgets],
  );
  const deleteCustomWidgetMutation = useMutation({
    mutationFn: async (widgetId: string) => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const catalog = await api.get<HomeCustomWidgetCatalog>(`/app-settings/${HOME_CUSTOM_WIDGETS_SETTINGS_KEY}`);
        if (!catalog.widgets.some((widget) => widget.id === widgetId)) return catalog;
        try {
          return await api.put<HomeCustomWidgetCatalog>(`/app-settings/${HOME_CUSTOM_WIDGETS_SETTINGS_KEY}`, {
            ...catalog,
            widgets: catalog.widgets.filter((widget) => widget.id !== widgetId),
          });
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 409 || attempt > 0) throw error;
        }
      }
      throw new Error("Home widget catalog changed repeatedly; try again.");
    },
    onSuccess: (catalog) => queryClient.setQueryData(["home-custom-widgets"], catalog),
    onError: () => queryClient.invalidateQueries({ queryKey: ["home-custom-widgets"] }),
  });
  const installed = useInstalledCapabilityPackages();
  const catalog = useCapabilityCatalog();
  const characters = useCharacters();
  const personas = usePersonas();
  const presets = usePresets();
  const lorebooks = useLorebooks(undefined, { includeHidden: true });
  const agents = useAgentConfigs();
  const chats = useChats();
  const reduceMotion = useReducedAmbientEffects();
  const debugMode = useUIStore((state) => state.debugMode);
  const reviewImagePromptsBeforeSend = useUIStore((state) => state.reviewImagePromptsBeforeSend);
  const conversationTimeZone = useUIStore((state) => state.conversationTimeZone);
  const achievementsEnabled = useUIStore((state) => state.achievementsEnabled);
  const professorMariNavigationEnabled = useUIStore((state) => state.professorMariNavigationEnabled);
  const hasCompletedOnboarding = useUIStore((state) => state.hasCompletedOnboarding);
  const browserPackages = useMemo(() => selectHomeBrowserPackages(installed.data), [installed.data]);
  const localizedBrowserPackages = useMemo(
    () =>
      browserPackages.map((item) => ({
        item,
        display: resolveCapabilityPackageDisplay(item.manifest, i18n.resolvedLanguage ?? i18n.language),
      })),
    [browserPackages, i18n.language, i18n.resolvedLanguage],
  );
  const noodleBrowserPackage = useMemo(
    () => browserPackages.find((item) => item.id === "noodle") ?? null,
    [browserPackages],
  );
  const [activeTab, setActiveTab] = useState("home");
  const [seenNoodleRefreshMarker, setSeenNoodleRefreshMarker] = useState(readSeenNoodleRefreshMarker);
  const [faqOpen, setFaqOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [widgetManagerOpen, setWidgetManagerOpen] = useState(false);
  const [mobileBookmarksOpen, setMobileBookmarksOpen] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState<HomeWidgetId[]>(readHomeWidgetVisibility);
  const [widgetLayouts, setWidgetLayouts] = useState<HomeWidgetLayouts>(() =>
    readHomeWidgetLayouts(readHomeWidgetVisibility()),
  );
  const [gridColumns, setGridColumns] = useState<HomeGridColumns>(1);
  const [gridRowHeight, setGridRowHeight] = useState(HOME_WIDGET_MIN_ROW_HEIGHT);
  const contentRef = useRef<HTMLElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const feedShellRef = useRef<HTMLDivElement | null>(null);
  const mobileBookmarksRef = useRef<HTMLElement | null>(null);
  const [draggedWidgetId, setDraggedWidgetId] = useState<HomeWidgetId | null>(null);
  const pendingProfessorExitTabRef = useRef<string | null>(null);
  const draggedWidgetIdRef = useRef<HomeWidgetId | null>(null);
  const lastDragTargetRef = useRef<string | null>(null);
  const dragPreviewRef = useRef<{
    element: HTMLElement;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const dragPreviewRemovalTimerRef = useRef<number | null>(null);
  const [discoveryIndex, setDiscoveryIndex] = useState(0);
  const noodleRefreshIndicator = useQuery({
    queryKey: ["home-browser", "noodle-refresh-indicator", noodleBrowserPackage?.version ?? "unavailable"],
    queryFn: () => api.get<{ marker: string | null }>("/noodle/refresh-indicator"),
    enabled: pageActive && Boolean(noodleBrowserPackage),
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
  const latestNoodleRefreshMarker = noodleRefreshIndicator.data?.marker ?? null;
  const noodleRefreshUnread = Boolean(
    latestNoodleRefreshMarker && latestNoodleRefreshMarker !== seenNoodleRefreshMarker && activeTab !== "noodle",
  );
  const activeWidgetSlots = widgetLayouts[gridColumns];
  const allWidgetIds = useMemo<HomeWidgetId[]>(() => [...HOME_WIDGET_IDS, ...customWidgetIds], [customWidgetIds]);
  const availableWidgetIds = useMemo<HomeWidgetId[]>(
    () => (achievementsEnabled ? allWidgetIds : allWidgetIds.filter((id) => id !== "achievements")),
    [achievementsEnabled, allWidgetIds],
  );

  useEffect(() => {
    if (!customWidgetsQuery.isSuccess) return;
    let knownIds: string[] = [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(HOME_CUSTOM_WIDGET_KNOWN_STORAGE_KEY) ?? "[]") as unknown;
      if (Array.isArray(parsed)) knownIds = parsed.filter((id): id is string => typeof id === "string");
    } catch {
      /* A malformed marker simply makes the current catalog visible once. */
    }
    const catalogIds = customWidgets.map((widget) => widget.id);
    const catalogWidgetIds = new Set(catalogIds.map(customHomeWidgetId));
    const newlyCreated = catalogIds.filter((id) => !knownIds.includes(id)).map(customHomeWidgetId);
    setVisibleWidgets((current) => [
      ...current.filter((id) => !id.startsWith("custom:") || catalogWidgetIds.has(id)),
      ...newlyCreated.filter((id) => !current.includes(id)),
    ]);
    try {
      window.localStorage.setItem(HOME_CUSTOM_WIDGET_KNOWN_STORAGE_KEY, JSON.stringify(catalogIds));
    } catch {
      /* Local storage is optional; the current session still updates. */
    }
  }, [customWidgets, customWidgetsQuery.isSuccess]);

  useEffect(() => {
    if (!achievementsEnabled) setAchievementsOpen(false);
    const availableVisibleWidgets = achievementsEnabled
      ? visibleWidgets
      : visibleWidgets.filter((id) => id !== "achievements");
    setWidgetLayouts((current) => {
      const next = {} as HomeWidgetLayouts;
      for (const columns of [1, 2, 3, 4] as const) {
        next[columns] = normalizeHomeWidgetSlots(
          current[columns],
          columns,
          widgetOrderFromSlots(current[columns]),
          availableVisibleWidgets,
        );
      }
      return next;
    });
  }, [achievementsEnabled, visibleWidgets]);

  useLayoutEffect(() => {
    const feedShell = feedShellRef.current;
    const content = contentRef.current;
    const hero = heroRef.current;
    if (!feedShell || !content || !hero) return;
    const measure = () => {
      const columns = gridColumnsForWidth(feedShell.getBoundingClientRect().width);
      const grid = feedShell.firstElementChild;
      const pagePadding = feedShell.parentElement ? getComputedStyle(feedShell.parentElement) : null;
      const rowGap = grid instanceof HTMLElement ? Number.parseFloat(getComputedStyle(grid).rowGap) || 0 : 0;
      const paddingBlock = pagePadding
        ? (Number.parseFloat(pagePadding.paddingTop) || 0) + (Number.parseFloat(pagePadding.paddingBottom) || 0)
        : 0;
      const pageHeight = content.clientHeight - hero.getBoundingClientRect().height - paddingBlock - 2;
      const referenceRowCount = Math.max(1, Math.ceil(homeWidgetSpotCount(columns, allWidgetIds) / columns));
      const referenceRowHeight = Math.min(
        HOME_WIDGET_MAX_ROW_HEIGHT,
        Math.max(HOME_WIDGET_MIN_ROW_HEIGHT, (pageHeight - rowGap * (referenceRowCount - 1)) / referenceRowCount),
      );
      setGridColumns(columns);
      setGridRowHeight(Math.floor(referenceRowHeight * 2) / 2);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(feedShell);
    observer?.observe(content);
    observer?.observe(hero);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [activeTab, allWidgetIds, visibleWidgets]);

  useEffect(
    () => () => {
      if (dragPreviewRemovalTimerRef.current !== null) {
        window.clearTimeout(dragPreviewRemovalTimerRef.current);
      }
      dragPreviewRef.current?.element.remove();
      document.documentElement.classList.remove("mari-home-widget-drag-active");
    },
    [],
  );

  useEffect(() => {
    if (!mobileBookmarksOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!mobileBookmarksRef.current?.contains(event.target as Node)) setMobileBookmarksOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileBookmarksOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileBookmarksOpen]);

  useEffect(() => {
    if (activeTab === "home" || activeTab === "professor") return;
    if (!browserPackages.some((item) => item.id === activeTab)) setActiveTab("home");
  }, [activeTab, browserPackages]);

  useEffect(() => {
    if (activeTab !== "noodle" || !latestNoodleRefreshMarker) return;
    setSeenNoodleRefreshMarker((current) => {
      if (current === latestNoodleRefreshMarker) return current;
      rememberSeenNoodleRefreshMarker(latestNoodleRefreshMarker);
      return latestNoodleRefreshMarker;
    });
  }, [activeTab, latestNoodleRefreshMarker]);

  useEffect(() => {
    try {
      window.localStorage.setItem(HOME_WIDGET_LAYOUT_STORAGE_KEY, JSON.stringify(widgetLayouts));
      window.localStorage.setItem(HOME_WIDGET_VISIBILITY_STORAGE_KEY, JSON.stringify(visibleWidgets));
      window.localStorage.setItem(
        HOME_WIDGET_ORDER_STORAGE_KEY,
        JSON.stringify(widgetOrderFromSlots(activeWidgetSlots)),
      );
    } catch {
      /* Local storage is optional; the current-session order still works. */
    }
  }, [activeWidgetSlots, visibleWidgets, widgetLayouts]);

  useEffect(() => {
    if (professorChatActive) setActiveTab("professor");
  }, [professorChatActive]);

  const installedIds = useMemo(() => new Set((installed.data ?? []).map((item) => item.id)), [installed.data]);
  const recommendations = useMemo(
    () => (catalog.data?.packages ?? []).filter((entry) => !installedIds.has(entry.manifest.id)),
    [catalog.data?.packages, installedIds],
  );
  const activeRecommendation =
    recommendations.length > 0 ? recommendations[discoveryIndex % recommendations.length] : null;
  const activeRecommendationDisplay = activeRecommendation
    ? resolveCapabilityPackageDisplay(activeRecommendation.manifest, i18n.resolvedLanguage ?? i18n.language)
    : null;

  const discoveryRotationActive =
    pageActive && activeTab === "home" && visibleWidgets.includes("discovery") && recommendations.length >= 2;

  useEffect(() => {
    if (!discoveryRotationActive || reduceMotion) return;
    const timer = window.setInterval(
      () => setDiscoveryIndex((current) => (current + 1) % recommendations.length),
      6_500,
    );
    return () => window.clearInterval(timer);
  }, [discoveryRotationActive, recommendations.length, reduceMotion]);

  const moveDiscovery = (direction: -1 | 1) => {
    if (recommendations.length < 2) return;
    setDiscoveryIndex((current) => (current + direction + recommendations.length) % recommendations.length);
  };
  const characterOfDay = useMemo(() => {
    const rows = (characters.data ?? []) as CharacterRow[];
    if (rows.length === 0) return null;
    const day = new Date().toISOString().slice(0, 10);
    const hash = Array.from(day).reduce((total, character) => total + character.charCodeAt(0), 0);
    const row = rows[hash % rows.length];
    if (!row || typeof row.id !== "string" || !("data" in row)) return null;
    return {
      id: row.id,
      avatarPath: typeof row.avatarPath === "string" ? row.avatarPath : null,
      ...parseCharacterDisplayData({
        data: row.data,
        comment: typeof row.comment === "string" ? row.comment : null,
      }),
    };
  }, [characters.data]);

  const address = `marinara/${activeTab}`;
  const selectTab = (tab: string) => {
    setMobileBookmarksOpen(false);
    const professorSelected = tab === "professor";
    if (professorSelected) {
      pendingProfessorExitTabRef.current = null;
      setActiveTab(tab);
      onProfessorChatOpenChange(true);
      return;
    }
    if (activeTab === "professor") {
      pendingProfessorExitTabRef.current = tab;
      onProfessorChatOpenChange(false);
      return;
    }
    setActiveTab(tab);
    onProfessorChatOpenChange(professorSelected);
  };
  const completeProfessorExit = () => {
    const target = pendingProfessorExitTabRef.current;
    pendingProfessorExitTabRef.current = null;
    onProfessorChatExitComplete();
    if (target) setActiveTab(target);
  };
  const openProfessor = () => selectTab("professor");
  const closeProfessor = () => selectTab("home");
  const moveDraggedWidget = useCallback(
    (target: { kind: "widget"; id: HomeWidgetId } | { kind: "empty"; index: number }) => {
      const source = draggedWidgetIdRef.current;
      const targetKey = target.kind === "widget" ? `widget:${target.id}` : `empty:${target.index}`;
      if (!source || (target.kind === "widget" && source === target.id) || lastDragTargetRef.current === targetKey)
        return;
      lastDragTargetRef.current = targetKey;
      const previousRects = reduceMotion ? null : readHomeWidgetRects();
      flushSync(() => {
        setWidgetLayouts((current) => {
          const slots = current[gridColumns];
          const next = [...slots];
          const from = next.indexOf(source);
          const to = target.kind === "widget" ? next.indexOf(target.id) : target.index;
          if (from < 0 || to < 0) return current;
          if (target.kind === "empty") {
            if (next[to] !== null) return current;
            next[from] = null;
            next[to] = source;
          } else {
            next.splice(from, 1);
            next.splice(to, 0, source);
          }
          return { ...current, [gridColumns]: next };
        });
      });
      animateHomeWidgetReflow(previousRects);
    },
    [gridColumns, reduceMotion],
  );
  const beginWidgetDrag = (id: HomeWidgetId) => {
    draggedWidgetIdRef.current = id;
    setDraggedWidgetId(id);
  };
  const nudgeWidget = useCallback(
    (id: HomeWidgetId, direction: -1 | 1) => {
      setWidgetLayouts((current) => {
        const next = [...current[gridColumns]];
        const from = next.indexOf(id);
        const to = Math.max(0, Math.min(next.length - 1, from + direction));
        if (from < 0 || from === to) return current;
        [next[from], next[to]] = [next[to], next[from]];
        return { ...current, [gridColumns]: next };
      });
    },
    [gridColumns],
  );
  const toggleWidgetVisibility = (id: HomeWidgetId) => {
    const enabling = !visibleWidgets.includes(id);
    const nextVisible = enabling ? [...visibleWidgets, id] : visibleWidgets.filter((widgetId) => widgetId !== id);
    const previousRects = reduceMotion ? null : readHomeWidgetRects();
    flushSync(() => {
      setVisibleWidgets(nextVisible);
      setWidgetLayouts((current) => {
        const next = {} as HomeWidgetLayouts;
        for (const columns of [1, 2, 3, 4] as const) {
          const slots = current[columns].filter((slot) => slot !== id);
          if (enabling) {
            if (id === "recent") slots.unshift(id);
            else {
              const firstAvailable = slots.indexOf(null);
              if (firstAvailable >= 0) slots[firstAvailable] = id;
              else slots.push(id);
            }
          }
          next[columns] = normalizeHomeWidgetSlots(slots, columns, widgetOrderFromSlots(slots), nextVisible);
        }
        return next;
      });
    });
    animateHomeWidgetReflow(previousRects);
  };
  const deleteCustomWidget = async (widget: HomeCustomWidget) => {
    const confirmed = await showConfirmDialog({
      title: t("home.widgets.deleteTitle", { widget: widget.title }),
      message: t("home.widgets.deleteDescription"),
      confirmLabel: t("home.widgets.delete"),
      cancelLabel: t("chat.delete.dialog.cancel"),
      tone: "destructive",
    });
    if (!confirmed) return;
    await deleteCustomWidgetMutation.mutateAsync(widget.id);
  };
  const beginPointerWidgetDrag = (id: HomeWidgetId, event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (dragPreviewRemovalTimerRef.current !== null) {
      window.clearTimeout(dragPreviewRemovalTimerRef.current);
      dragPreviewRemovalTimerRef.current = null;
    }
    dragPreviewRef.current?.element.remove();
    dragPreviewRef.current = null;
    const widget = event.currentTarget.closest<HTMLElement>("[data-home-widget-id]");
    if (widget) {
      const bounds = widget.getBoundingClientRect();
      const preview = widget.cloneNode(true) as HTMLElement;
      preview.removeAttribute("data-home-widget-id");
      preview.removeAttribute("style");
      preview.querySelector("[data-home-drag-handle]")?.remove();
      for (const element of preview.querySelectorAll<HTMLElement>("[id]")) element.removeAttribute("id");
      preview.setAttribute("aria-hidden", "true");
      preview.setAttribute("inert", "");
      preview.className = "mari-chrome-token-scope mari-home-widget-drag-preview";
      preview.style.width = `${bounds.width}px`;
      preview.style.height = `${bounds.height}px`;
      preview.style.transform = `translate3d(${bounds.left}px, ${bounds.top}px, 0) rotate(0deg) scale(1)`;
      document.body.append(preview);
      dragPreviewRef.current = {
        element: preview,
        offsetX: event.clientX - bounds.left,
        offsetY: event.clientY - bounds.top,
      };
    }
    lastDragTargetRef.current = null;
    document.documentElement.classList.add("mari-home-widget-drag-active");
    beginWidgetDrag(id);
  };
  const movePointerWidgetDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!draggedWidgetIdRef.current) return;
    const preview = dragPreviewRef.current;
    if (preview) {
      const left = event.clientX - preview.offsetX;
      const top = event.clientY - preview.offsetY;
      preview.element.style.transform = `translate3d(${left}px, ${top}px, 0) rotate(0.75deg) scale(1.015)`;
    }
    const scrollContainer = event.currentTarget.closest<HTMLElement>('[data-component="HomeBrowserHub.Content"]');
    if (scrollContainer) {
      const bounds = scrollContainer.getBoundingClientRect();
      if (event.clientY < bounds.top + 48) scrollContainer.scrollBy({ top: -18 });
      if (event.clientY > bounds.bottom - 48) scrollContainer.scrollBy({ top: 18 });
    }
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const widgetTarget = element?.closest<HTMLElement>("[data-home-widget-id]")?.dataset.homeWidgetId as
      | HomeWidgetId
      | undefined;
    if (widgetTarget) {
      moveDraggedWidget({ kind: "widget", id: widgetTarget });
      return;
    }
    const emptyIndex = Number(element?.closest<HTMLElement>("[data-home-empty-slot]")?.dataset.homeEmptySlot);
    if (Number.isInteger(emptyIndex)) moveDraggedWidget({ kind: "empty", index: emptyIndex });
  };
  const endPointerWidgetDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const draggedId = draggedWidgetIdRef.current;
    const preview = dragPreviewRef.current;
    if (!draggedId && !preview) return;
    draggedWidgetIdRef.current = null;
    setDraggedWidgetId(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (preview) {
      const target = draggedId ? document.querySelector<HTMLElement>(`[data-home-widget-id="${draggedId}"]`) : null;
      const bounds = target?.getBoundingClientRect();
      preview.element.style.transition = "transform 180ms cubic-bezier(0.16, 1, 0.3, 1), opacity 150ms ease";
      preview.element.style.opacity = "0";
      if (bounds)
        preview.element.style.transform = `translate3d(${bounds.left}px, ${bounds.top}px, 0) rotate(0deg) scale(1)`;
      dragPreviewRemovalTimerRef.current = window.setTimeout(() => {
        preview.element.remove();
        if (dragPreviewRef.current === preview) dragPreviewRef.current = null;
        dragPreviewRemovalTimerRef.current = null;
      }, 190);
    }
    lastDragTargetRef.current = null;
    document.documentElement.classList.remove("mari-home-widget-drag-active");
  };
  const widgetLabel = (id: HomeWidgetId) => {
    const customWidget = customWidgetsById.get(id);
    return customWidget?.title ?? t(HOME_WIDGET_LABEL_KEYS[id as BuiltInHomeWidgetId]);
  };
  const widgetManagerLabel = (id: HomeWidgetId) => {
    const customWidget = customWidgetsById.get(id);
    if (customWidget) {
      return t("home.widgets.managerLabel", {
        name: t("home.widgets.customEyebrow"),
        purpose: customWidget.title,
      });
    }
    const labelKeys = HOME_WIDGET_MANAGER_LABEL_KEYS[id as BuiltInHomeWidgetId];
    return t("home.widgets.managerLabel", {
      name: t(labelKeys.name),
      purpose: t(labelKeys.purpose),
    });
  };
  const widgetFrameProps = (id: HomeWidgetId) => ({
    id,
    order: activeWidgetSlots.indexOf(id),
    visible: availableWidgetIds.includes(id) && visibleWidgets.includes(id),
    dragging: draggedWidgetId === id,
    onPointerDragStart: beginPointerWidgetDrag,
    onPointerDragMove: movePointerWidgetDrag,
    onPointerDragEnd: endPointerWidgetDrag,
    onKeyboardMove: nudgeWidget,
    dragLabel: t("home.widgets.drag", { widget: widgetLabel(id) }),
  });
  const trackHomeAction = (event: AchievementEvent) => {
    void trackAchievementEvent(event, { keepalive: true })
      .catch(() => undefined)
      .finally(() => void queryClient.invalidateQueries({ queryKey: achievementKeys.all }));
  };
  const professorMariBrowserTabs = useMemo<ProfessorMariBrowserTab[]>(
    () =>
      localizedBrowserPackages.map(({ item, display }) => ({
        id: item.id,
        label: display.homeBrowserTab?.label ?? display.name,
        aliases: [item.manifest.name, display.name],
      })),
    [localizedBrowserPackages],
  );
  const professorMariResources = useMemo<ProfessorMariNavigationResource[]>(() => {
    const characterResources = ((characters.data ?? []) as CharacterRow[]).flatMap((row) => {
      if (typeof row.id !== "string") return [];
      const display = parseCharacterDisplayData({
        data: row.data,
        comment: typeof row.comment === "string" ? row.comment : null,
      });
      return display.name.trim() ? [{ kind: "character" as const, id: row.id, name: display.name }] : [];
    });
    return [
      ...characterResources,
      ...(personas.data ?? []).map((persona) => ({ kind: "persona" as const, id: persona.id, name: persona.name })),
      ...(presets.data ?? []).map((preset) => ({ kind: "preset" as const, id: preset.id, name: preset.name })),
      ...(lorebooks.data ?? []).map((lorebook) => ({
        kind: "lorebook" as const,
        id: lorebook.id,
        name: lorebook.name,
      })),
      ...(agents.data ?? []).map((agent) => ({
        kind: "agent" as const,
        id: agent.type,
        name: agent.name,
        aliases: [agent.type],
      })),
    ];
  }, [agents.data, characters.data, lorebooks.data, personas.data, presets.data]);
  const openProfessorMariTarget = (target: ProfessorMariNavigationTarget) => {
    const ui = useUIStore.getState();
    if (target.kind === "home") {
      selectTab("home");
      return;
    }
    if (target.kind === "professor") {
      openProfessor();
      return;
    }
    if (target.kind === "chats") {
      ui.closeRightPanel();
      ui.setSidebarOpen(true);
      return;
    }
    if (target.kind === "chat") {
      ui.closeRightPanel();
      ui.setSidebarOpen(true);
      useChatStore.getState().setActiveChatId(target.chatId);
      return;
    }
    if (target.kind === "panel") {
      ui.openRightPanel(target.panel);
      return;
    }
    if (target.kind === "settings") {
      ui.setSettingsTab(target.tab);
      ui.setSettingsTargetControlId(target.controlId ?? null);
      ui.openRightPanel("settings");
      return;
    }
    if (target.kind === "surface") {
      if (target.surface === "card-downloads") ui.openBotBrowser();
      else if (target.surface === "character-library") ui.openCharacterLibrary();
      else if (target.surface === "persona-library") ui.openPersonaLibrary();
      else if (target.surface === "agent-catalog") ui.openAgentCatalog();
      else ui.openGameAssetsBrowser();
      return;
    }
    if (target.kind === "resource") {
      if (target.resource === "character") ui.openCharacterDetail(target.id);
      else if (target.resource === "persona") ui.openPersonaDetail(target.id);
      else if (target.resource === "preset") ui.openPresetDetail(target.id);
      else if (target.resource === "lorebook") ui.openLorebookDetail(target.id);
      else ui.openAgentDetail(target.id);
      return;
    }
    if (target.kind === "window") {
      if (target.window === "discord") {
        trackHomeAction("discord_clicked");
        window.open("https://discord.com/invite/KdAkTg94ME", "_blank", "noopener,noreferrer");
      } else if (target.window === "support") {
        trackHomeAction("kofi_clicked");
        window.open("https://ko-fi.com/marinara_spaghetti", "_blank", "noopener,noreferrer");
      } else if (target.window === "documentation") ui.openModal("docs-viewer");
      else if (target.window === "faq") setFaqOpen(true);
      else if (target.window === "widgets") setWidgetManagerOpen(true);
      else if (target.window === "tutorial") ui.setHasCompletedOnboarding(false);
      else {
        trackHomeAction("credits_viewed");
        onOpenCredits();
      }
      return;
    }
    selectTab(target.packageId);
  };
  const resolveWithProfessorMari = (query: string) =>
    resolveProfessorMariNavigation(query, professorMariBrowserTabs, professorMariResources, chats.data ?? []);

  return (
    <div
      className="mari-chrome-token-scope relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--background)]"
      data-component="HomeBrowserHub"
    >
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden border border-[var(--border)]/75 bg-[var(--card)]/65 shadow-2xl shadow-black/25 sm:rounded-xl">
        <header className="mari-home-browser-chrome relative z-40 shrink-0 border-b border-[var(--marinara-topbar-border)] bg-[var(--marinara-topbar-surface)] shadow-[0_8px_28px_-26px_rgba(0,0,0,0.8)] backdrop-blur-sm">
          <div className="flex h-10 min-w-0 items-end gap-1 border-b border-[var(--border)]/45 px-2 sm:gap-2 sm:px-3">
            <div
              className="relative z-10 flex shrink-0 self-center items-center gap-2 pr-1 sm:pr-3"
              data-component="HomeBrowserHub.Brand"
            >
              <img
                src="/logo-splash.gif"
                alt=""
                data-component="HomeBrowserHub.AnimatedLogo"
                className="h-8 w-8 shrink-0 object-contain drop-shadow-[0_0_10px_color-mix(in_srgb,var(--marinara-app-accent-solid)_28%,transparent)]"
              />
              <div className="hidden min-w-0 sm:block">
                <MarinaraWordmark className="block text-xs leading-none" />
                <span className="mt-0.5 block text-[0.5rem] font-semibold tracking-[0.14em] text-[var(--muted-foreground)]">
                  {t("home.browser.version", { version: APP_VERSION })}
                </span>
              </div>
            </div>
            <div
              className="flex min-w-0 flex-1 items-end gap-0.5 overflow-hidden sm:gap-1 sm:overflow-x-auto"
              role="tablist"
              aria-label={t("home.browser.tabsLabel")}
              data-component="HomeBrowserHub.TabList"
            >
              <button
                id={homeBrowserTabId("home")}
                type="button"
                role="tab"
                aria-controls={HOME_BROWSER_PANEL_ID}
                aria-label={t("home.browser.homeTab")}
                aria-selected={activeTab === "home"}
                onClick={() => selectTab("home")}
                className={cn(
                  "flex min-h-9 min-w-0 items-center justify-center rounded-t-lg border border-b-0 text-[0.65rem] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[oklch(0.79_0.16_205)] sm:min-w-[6.5rem] sm:w-auto sm:flex-none sm:gap-1.5 sm:px-3 sm:text-xs",
                  activeTab === "home" ? "flex-1 gap-1 px-2" : "w-9 flex-none gap-0 px-0",
                  activeTab === "home"
                    ? "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                )}
              >
                <img src="/home/tab-icons/home.png" alt="" className="h-[1.125rem] w-[1.125rem] object-contain" />
                <span className={cn("min-w-0 truncate", activeTab === "home" ? "block" : "hidden sm:block")}>
                  {t("home.browser.homeTab")}
                </span>
              </button>
              <button
                id={homeBrowserTabId("professor")}
                type="button"
                role="tab"
                aria-controls={HOME_BROWSER_PANEL_ID}
                aria-label={t("home.browser.professorTab")}
                aria-selected={activeTab === "professor"}
                onClick={openProfessor}
                className={cn(
                  "flex min-h-9 min-w-0 items-center justify-center rounded-t-lg border border-b-0 text-[0.65rem] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] sm:min-w-[6.5rem] sm:w-auto sm:flex-none sm:gap-1.5 sm:px-3 sm:text-xs",
                  activeTab === "professor" ? "flex-1 gap-1 px-2" : "w-9 flex-none gap-0 px-0",
                  activeTab === "professor"
                    ? "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                )}
              >
                <img src="/sprites/mari/Mari_profile.png" alt="" className="h-4 w-4 rounded-sm object-cover" />
                <span className={cn("min-w-0 truncate", activeTab === "professor" ? "block" : "hidden sm:block")}>
                  {t("home.browser.professorTab")}
                </span>
              </button>
              {localizedBrowserPackages.map(({ item, display }) => {
                const tab = display.homeBrowserTab;
                const tabActive = activeTab === item.id;
                const hasUnreadRefresh = item.id === "noodle" && noodleRefreshUnread;
                const activityDescriptionId = `${homeBrowserTabId(item.id)}-activity`;
                return (
                  <button
                    key={item.id}
                    id={homeBrowserTabId(item.id)}
                    type="button"
                    role="tab"
                    aria-controls={HOME_BROWSER_PANEL_ID}
                    aria-label={tab?.ariaLabel ?? tab?.label ?? display.name}
                    aria-describedby={hasUnreadRefresh ? activityDescriptionId : undefined}
                    aria-selected={tabActive}
                    onClick={() => selectTab(item.id)}
                    className={cn(
                      "relative flex min-h-9 min-w-0 items-center justify-center rounded-t-lg border border-b-0 text-[0.65rem] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] sm:min-w-[6.5rem] sm:w-auto sm:flex-none sm:gap-1.5 sm:px-3 sm:text-xs",
                      tabActive ? "flex-1 gap-1 px-2" : "w-9 flex-none gap-0 px-0",
                      tabActive
                        ? "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                        : "border-transparent text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                    )}
                  >
                    <BrowserPackageTabIcon packageId={item.id} version={item.version} iconPaths={tab?.iconPaths} />
                    <span className={cn("min-w-0 truncate", tabActive ? "block" : "hidden sm:block")}>
                      {tab?.label ?? display.name}
                    </span>
                    {hasUnreadRefresh ? (
                      <span
                        id={activityDescriptionId}
                        aria-label={t("home.browser.newTimelineRefresh")}
                        data-component="HomeBrowserHub.NoodleRefreshBadge"
                        className="mari-chrome-accent-tile mari-accent-animated absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.58rem] font-black leading-none ring-1 ring-[var(--marinara-chat-chrome-button-border-active)]"
                      >
                        <span aria-hidden="true">1</span>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="mari-home-browser-address-row hidden h-8 shrink-0 items-center gap-1.5 px-2 py-0.5 sm:flex sm:h-10 sm:gap-2 sm:px-3"
            data-component="HomeBrowserHub.AddressRow"
          >
            <div className="hidden shrink-0 items-center gap-0.5 sm:flex">
              <button
                type="button"
                onClick={() => selectTab("home")}
                disabled={activeTab === "home"}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.79_0.16_205)] disabled:opacity-30"
                aria-label={t("home.browser.back")}
              >
                <ArrowLeft size="0.9rem" />
              </button>
              <button
                type="button"
                disabled
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted-foreground)] opacity-30"
                aria-label={t("home.browser.forward")}
              >
                <ArrowRight size="0.9rem" />
              </button>
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted-foreground)] opacity-70"
                data-component="HomeBrowserHub.DecorativeRefresh"
              >
                <RefreshCw size="0.88rem" />
              </span>
            </div>
            <div
              className="mari-home-browser-address flex h-7 min-w-0 flex-1 items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--marinara-app-accent-solid)_44%,var(--border))] px-2.5 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_8%,transparent),0_0_18px_-14px_var(--marinara-app-accent-solid)] sm:h-9 sm:px-3"
              role="status"
              aria-label={t("home.browser.addressLabel", { address })}
              data-component="HomeBrowserHub.Address"
            >
              <img
                src="/favicon.png"
                alt=""
                className="h-[0.9rem] w-[0.9rem] shrink-0 object-contain sm:h-[1.05rem] sm:w-[1.05rem]"
              />
              <span className="truncate font-mono text-[0.67rem] text-[var(--foreground)] sm:text-[0.72rem]">
                {address}
              </span>
              <Star
                size="0.72rem"
                className="ml-auto shrink-0 text-[var(--marinara-app-accent-solid)]"
                aria-hidden="true"
              />
            </div>
          </div>

          <nav
            ref={mobileBookmarksRef}
            className="relative flex min-h-8 items-center border-t border-[var(--border)]/45 px-2 sm:min-h-9 sm:px-3"
            aria-label={t("home.browser.bookmarksLabel")}
          >
            <div className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto sm:flex">
              <BrowserBookmark
                href="https://discord.com/invite/KdAkTg94ME"
                onClick={() => trackHomeAction("discord_clicked")}
                icon={<img src="/home/tab-icons/discord.svg" alt="" className="h-4 w-4 object-contain" />}
                tone="#5865F2"
              >
                {t("home.browser.bookmarks.discord")}
              </BrowserBookmark>
              <BrowserBookmark
                href="https://ko-fi.com/marinara_spaghetti"
                onClick={() => trackHomeAction("kofi_clicked")}
                icon={<img src="/home/tab-icons/kofi.png" alt="" className="h-4 w-4 object-contain" />}
                tone="#ff6433"
              >
                {t("home.actions.support")}
              </BrowserBookmark>
              <BrowserBookmark
                onClick={() => {
                  trackHomeAction("credits_viewed");
                  onOpenCredits();
                }}
                icon={<img src="/home/tab-icons/credits.png" alt="" className="h-4 w-4 object-contain" />}
                tone={HOME_MODULE_ACCENTS.orange}
              >
                {t("home.actions.credits")}
              </BrowserBookmark>
              <BrowserBookmark
                onClick={() => useUIStore.getState().openModal("docs-viewer")}
                icon={<img src="/home/tab-icons/documentation.png" alt="" className="h-4 w-4 object-contain" />}
                tone={HOME_MODULE_ACCENTS.cyan}
                tourTarget="home-documentation"
              >
                {t("home.actions.documentation")}
              </BrowserBookmark>
              <BrowserBookmark
                onClick={() => useUIStore.getState().setHasCompletedOnboarding(false)}
                icon={<img src="/home/tab-icons/tutorial.png" alt="" className="h-4 w-4 object-contain" />}
                tone={HOME_MODULE_ACCENTS.orange}
                tourTarget="home-tutorial"
              >
                {t("home.browser.bookmarks.tutorial")}
              </BrowserBookmark>
              <BrowserBookmark
                onClick={() => setFaqOpen(true)}
                icon={<img src="/home/tab-icons/faq.png" alt="" className="h-4 w-4 object-contain" />}
                tone={HOME_MODULE_ACCENTS.pink}
                tourTarget="home-faq"
              >
                {t("home.browser.faqTab")}
              </BrowserBookmark>
              {achievementsEnabled ? (
                <BrowserBookmark
                  onClick={() => setAchievementsOpen(true)}
                  icon={<img src="/home/tab-icons/achievements.png" alt="" className="h-4 w-4 object-contain" />}
                  tone={HOME_MODULE_ACCENTS.orange}
                >
                  {t("home.browser.achievements")}
                </BrowserBookmark>
              ) : null}
              <BrowserBookmark
                onClick={() => setWidgetManagerOpen(true)}
                icon={<img src="/home/tab-icons/widgets.svg" alt="" className="h-4 w-4 object-contain" />}
                tone={HOME_MODULE_ACCENTS.violet}
                tourTarget="home-widgets"
              >
                {t("home.browser.widgets")}
              </BrowserBookmark>
            </div>

            <button
              type="button"
              className="flex min-h-7 items-center gap-2 rounded-md px-2 text-[0.7rem] font-bold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)] sm:hidden"
              aria-expanded={mobileBookmarksOpen}
              aria-controls="marinara-mobile-bookmarks"
              onClick={() => setMobileBookmarksOpen((open) => !open)}
              data-component="HomeBrowserHub.MobileBookmarksTrigger"
            >
              <span className="flex items-center gap-1" aria-hidden="true">
                <i
                  className="h-1.5 w-1.5 rounded-full bg-[oklch(0.79_0.16_205)] shadow-[0_0_8px_oklch(0.79_0.16_205/0.65)]"
                  data-bookmark-dot="cyan"
                />
                <i
                  className="h-1.5 w-1.5 rounded-full bg-[oklch(0.76_0.19_52)] shadow-[0_0_8px_oklch(0.76_0.19_52/0.65)]"
                  data-bookmark-dot="orange"
                />
                <i
                  className="h-1.5 w-1.5 rounded-full bg-[oklch(0.73_0.21_345)] shadow-[0_0_8px_oklch(0.73_0.21_345/0.65)]"
                  data-bookmark-dot="pink"
                />
              </span>
              {t("home.browser.bookmarks")}
            </button>

            <AnimatePresence initial={false}>
              {mobileBookmarksOpen ? (
                <motion.div
                  id="marinara-mobile-bookmarks"
                  initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute left-2 right-2 top-[calc(100%+0.35rem)] grid max-h-[calc(100dvh-8rem)] gap-1 overflow-y-auto rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_96%,var(--background))] p-1.5 shadow-[0_22px_60px_-24px_rgba(0,0,0,0.72)] ring-1 ring-[color-mix(in_srgb,var(--foreground)_7%,transparent)] sm:hidden"
                  data-component="HomeBrowserHub.MobileBookmarksMenu"
                  data-bookmarks-motion="slide"
                >
                  <MobileBrowserBookmark
                    href="https://discord.com/invite/KdAkTg94ME"
                    onClick={() => {
                      setMobileBookmarksOpen(false);
                      trackHomeAction("discord_clicked");
                    }}
                    icon={<img src="/home/tab-icons/discord.svg" alt="" className="h-4 w-4 object-contain" />}
                    tone="#5865F2"
                  >
                    {t("home.browser.bookmarks.discord")}
                  </MobileBrowserBookmark>
                  <MobileBrowserBookmark
                    href="https://ko-fi.com/marinara_spaghetti"
                    onClick={() => {
                      setMobileBookmarksOpen(false);
                      trackHomeAction("kofi_clicked");
                    }}
                    icon={<img src="/home/tab-icons/kofi.png" alt="" className="h-4 w-4 object-contain" />}
                    tone="#ff6433"
                  >
                    {t("home.actions.support")}
                  </MobileBrowserBookmark>
                  <MobileBrowserBookmark
                    onClick={() => {
                      setMobileBookmarksOpen(false);
                      trackHomeAction("credits_viewed");
                      onOpenCredits();
                    }}
                    icon={<img src="/home/tab-icons/credits.png" alt="" className="h-4 w-4 object-contain" />}
                    tone={HOME_MODULE_ACCENTS.orange}
                  >
                    {t("home.actions.credits")}
                  </MobileBrowserBookmark>
                  <MobileBrowserBookmark
                    onClick={() => {
                      setMobileBookmarksOpen(false);
                      useUIStore.getState().openModal("docs-viewer");
                    }}
                    icon={<img src="/home/tab-icons/documentation.png" alt="" className="h-4 w-4 object-contain" />}
                    tone={HOME_MODULE_ACCENTS.cyan}
                  >
                    {t("home.actions.documentation")}
                  </MobileBrowserBookmark>
                  <MobileBrowserBookmark
                    onClick={() => {
                      setMobileBookmarksOpen(false);
                      useUIStore.getState().setHasCompletedOnboarding(false);
                    }}
                    icon={<img src="/home/tab-icons/tutorial.png" alt="" className="h-4 w-4 object-contain" />}
                    tone={HOME_MODULE_ACCENTS.orange}
                  >
                    {t("home.browser.bookmarks.tutorial")}
                  </MobileBrowserBookmark>
                  <MobileBrowserBookmark
                    onClick={() => {
                      setMobileBookmarksOpen(false);
                      setFaqOpen(true);
                    }}
                    icon={<img src="/home/tab-icons/faq.png" alt="" className="h-4 w-4 object-contain" />}
                    tone={HOME_MODULE_ACCENTS.pink}
                  >
                    {t("home.browser.faqTab")}
                  </MobileBrowserBookmark>
                  {achievementsEnabled ? (
                    <MobileBrowserBookmark
                      onClick={() => {
                        setMobileBookmarksOpen(false);
                        setAchievementsOpen(true);
                      }}
                      icon={<img src="/home/tab-icons/achievements.png" alt="" className="h-4 w-4 object-contain" />}
                      tone={HOME_MODULE_ACCENTS.orange}
                    >
                      {t("home.browser.achievements")}
                    </MobileBrowserBookmark>
                  ) : null}
                  <MobileBrowserBookmark
                    onClick={() => {
                      setMobileBookmarksOpen(false);
                      setWidgetManagerOpen(true);
                    }}
                    icon={<img src="/home/tab-icons/widgets.svg" alt="" className="h-4 w-4 object-contain" />}
                    tone={HOME_MODULE_ACCENTS.violet}
                  >
                    {t("home.browser.widgets")}
                  </MobileBrowserBookmark>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </nav>
        </header>

        <main
          id={HOME_BROWSER_PANEL_ID}
          ref={contentRef}
          role="tabpanel"
          aria-labelledby={homeBrowserTabId(activeTab)}
          tabIndex={0}
          className={cn("min-h-0 flex-1", activeTab === "professor" ? "overflow-hidden" : "overflow-y-auto")}
          data-component="HomeBrowserHub.Content"
        >
          {activeTab !== "home" && activeTab !== "professor" ? (
            <CapabilityElement
              key={activeTab}
              packageId={activeTab}
              view="browser"
              className="block h-full min-h-0 w-full"
              capabilityProps={{
                style: { display: "block", width: "100%", height: "100%" },
                conversationTimeZone,
                debugMode,
                onClose: () => selectTab("home"),
                reviewImagePromptsBeforeSend,
              }}
            />
          ) : activeTab === "professor" ? (
            <div className="relative h-full min-h-0 bg-[radial-gradient(circle_at_18%_14%,oklch(0.79_0.16_205/0.12),transparent_30%),radial-gradient(circle_at_82%_18%,oklch(0.73_0.21_345/0.15),transparent_32%),var(--background)] p-0 sm:p-3">
              <HomeStarfield />
              <div className="relative z-[1] h-full min-h-0">
                <HomeProfessorMariChat
                  pageActive={pageActive}
                  attachedFooter={false}
                  chatWindowOpen={professorChatOpen}
                  embeddedTab
                  launchHidden
                  onChatWindowOpenChange={(open) => (open ? onProfessorChatOpenChange(true) : closeProfessor())}
                  onChatWindowExitComplete={completeProfessorExit}
                />
              </div>
            </div>
          ) : (
            <div
              className="relative min-h-full overflow-hidden bg-[radial-gradient(circle_at_12%_8%,oklch(0.79_0.16_205/0.14),transparent_27%),radial-gradient(circle_at_87%_12%,oklch(0.73_0.21_345/0.14),transparent_29%),radial-gradient(circle_at_72%_76%,oklch(0.76_0.19_52/0.08),transparent_28%),var(--background)]"
              data-component="HomeBrowserHub.HomePage"
            >
              <HomeStarfield />
              <div className="relative z-[1] w-full p-[clamp(0.65rem,1vw,1.25rem)]">
                <section
                  ref={heroRef}
                  className="mari-home-hero flex min-w-0 flex-col items-center gap-2 px-[clamp(0.35rem,0.8vw,0.9rem)] pb-[clamp(0.7rem,1.1vw,1rem)] pt-[clamp(0.4rem,0.7vw,0.7rem)] text-center"
                  data-tour="home-hub"
                >
                  <div className="min-w-0 max-w-5xl">
                    <div className="flex min-w-0 flex-col items-center">
                      <img
                        src="/logo.png"
                        alt=""
                        aria-hidden="true"
                        className="mb-1 h-[clamp(1.8rem,2.4vw,2.35rem)] w-auto object-contain"
                      />
                      <MarinaraWordmark className="block truncate text-[clamp(1.35rem,1.9vw,2.15rem)] leading-none" />
                      <span className="mt-1 block text-[0.5625rem] font-semibold tracking-[0.14em] text-[var(--muted-foreground)]">
                        {t("home.browser.version", { version: APP_VERSION })}
                      </span>
                    </div>
                    <h1 className="mt-1.5 text-[clamp(1.15rem,1.6vw,1.7rem)] font-black tracking-tight text-[var(--foreground)]">
                      {t("home.hero.title")}
                    </h1>
                    <p className="mx-auto mt-1 text-[clamp(0.75rem,0.8vw,0.875rem)] leading-snug text-[var(--muted-foreground)]">
                      {t("home.hero.description")}
                    </p>
                  </div>
                  <div className="grid w-full max-w-md grid-cols-3 gap-2" aria-label={t("home.shortcuts.label")}>
                    <HomeNewChatLauncher
                      mode="conversation"
                      className="group !h-auto !min-h-11 !w-full !gap-1.5 !border-[color-mix(in_srgb,var(--home-chat-mode-accent)_35%,var(--border))] !bg-[color-mix(in_srgb,var(--home-chat-mode-accent)_7%,var(--card))] !px-2 !py-1 !text-center sm:!min-h-9"
                      ariaLabel={t("home.shortcuts.newConversation")}
                    >
                      <ShortcutIcon tone={HOME_CHAT_MODE_ACCENTS.conversation}>
                        <ChatModeIcon mode="conversation" size="1rem" className="mari-rgb-static-icon" />
                      </ShortcutIcon>
                      <span className="text-[0.65rem] font-bold text-[var(--foreground)] sm:text-xs">
                        {t("home.recentChats.mode.conversation")}
                      </span>
                    </HomeNewChatLauncher>
                    <HomeNewChatLauncher
                      mode="roleplay"
                      className="group !h-auto !min-h-11 !w-full !gap-1.5 !border-[color-mix(in_srgb,var(--home-chat-mode-accent)_35%,var(--border))] !bg-[color-mix(in_srgb,var(--home-chat-mode-accent)_7%,var(--card))] !px-2 !py-1 !text-center sm:!min-h-9"
                      ariaLabel={t("home.shortcuts.newRoleplay")}
                    >
                      <ShortcutIcon tone={HOME_CHAT_MODE_ACCENTS.roleplay}>
                        <ChatModeIcon mode="roleplay" size="1rem" className="mari-rgb-static-icon" />
                      </ShortcutIcon>
                      <span className="text-[0.65rem] font-bold text-[var(--foreground)] sm:text-xs">
                        {t("home.recentChats.mode.roleplay")}
                      </span>
                    </HomeNewChatLauncher>
                    <HomeNewChatLauncher
                      mode="game"
                      className="group !h-auto !min-h-11 !w-full !gap-1.5 !border-[color-mix(in_srgb,var(--home-chat-mode-accent)_35%,var(--border))] !bg-[color-mix(in_srgb,var(--home-chat-mode-accent)_7%,var(--card))] !px-2 !py-1 !text-center sm:!min-h-9"
                      ariaLabel={t("home.shortcuts.newGame")}
                    >
                      <ShortcutIcon tone={HOME_CHAT_MODE_ACCENTS.game}>
                        <ChatModeIcon mode="game" size="1rem" className="mari-rgb-static-icon" />
                      </ShortcutIcon>
                      <span className="text-[0.65rem] font-bold text-[var(--foreground)] sm:text-xs">
                        {t("home.recentChats.mode.game")}
                      </span>
                    </HomeNewChatLauncher>
                  </div>
                </section>
                <div ref={feedShellRef} className="mari-home-feed-shell">
                  <div
                    className="mari-home-feed-grid"
                    data-component="HomeBrowserHub.Feed"
                    data-home-grid-columns={gridColumns}
                    style={
                      {
                        gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
                        "--home-grid-row-height": `${gridRowHeight}px`,
                      } as CSSProperties
                    }
                  >
                    <HomeWidgetFrame {...widgetFrameProps("professor")}>
                      <section
                        className="mari-chrome-accent-frame mari-chrome-accent-panel mari-accent-animated mari-home-professor-widget relative grid h-full min-h-0 min-w-0 grid-cols-[minmax(0,1fr)_minmax(5.5rem,40%)] overflow-hidden rounded-2xl border p-3 sm:p-[clamp(0.85rem,1vw,1.2rem)]"
                        data-component="HomeBrowserHub.ProfessorWidget"
                      >
                        <div
                          className="relative z-[2] flex min-h-0 min-w-0 flex-col items-start justify-center"
                          data-home-professor-content
                        >
                          <p className="mari-chrome-accent-icon mari-accent-animated text-[0.625rem] font-extrabold uppercase tracking-[0.16em]">
                            {t("home.professorMari.eyebrow")}
                          </p>
                          <h2 className="mt-0.5 text-sm font-bold text-[var(--foreground)] sm:text-base">
                            {t("home.shortcuts.professorMari")}
                          </h2>
                          <p
                            className="mt-1 line-clamp-6 min-w-0 text-[clamp(0.56rem,2.4cqw,0.75rem)] leading-[1.3] text-[var(--muted-foreground)] sm:mt-1.5 sm:line-clamp-7"
                            data-home-professor-description
                          >
                            {t("home.professorMari.widgetDescription")}
                          </p>
                          <button
                            type="button"
                            onClick={openProfessor}
                            className="mari-chrome-control mari-chrome-control--compact mari-chrome-control--selected mari-accent-animated mt-2 h-8 max-w-full px-2 text-center text-[clamp(0.56rem,2.2cqw,0.75rem)] font-bold leading-tight sm:gap-1.5 sm:px-2.5"
                            data-home-professor-action
                          >
                            <MessageCircle size="0.8rem" className="mari-rgb-static-icon text-current" />{" "}
                            {t("home.professorMari.ask")}
                          </button>
                        </div>
                        <div
                          className="pointer-events-none relative z-[1] h-full min-h-0 w-full self-end overflow-hidden"
                          data-home-professor-art
                          aria-hidden="true"
                        >
                          <div className="absolute bottom-0 right-0 w-[clamp(7rem,38cqw,11rem)] max-w-full">
                            <ProfessorMariPixelScene active={false} />
                          </div>
                        </div>
                      </section>
                    </HomeWidgetFrame>

                    <HomeWidgetFrame {...widgetFrameProps("recent")}>
                      <FeedModule
                        eyebrow={t("home.recentChats.eyebrow")}
                        title={t("home.recentChats.title")}
                        accent={HOME_MODULE_ACCENTS.cyan}
                        art="/home/story-comet.png"
                        artClassName={HOME_CARD_ART_CLASS}
                        className="h-full"
                      >
                        <RecentChats />
                      </FeedModule>
                    </HomeWidgetFrame>

                    <HomeWidgetFrame {...widgetFrameProps("whats-new")}>
                      <FeedModule
                        eyebrow={t("home.whatsNew.eyebrow")}
                        title={t("home.whatsNew.title", { version: APP_VERSION })}
                        accent={HOME_MODULE_ACCENTS.orange}
                        art="/home/kitchen-orbit.png"
                        artClassName={HOME_CARD_ART_CLASS}
                        className="h-full"
                      >
                        <div className="max-w-[68%]">
                          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                            {t("home.whatsNew.description")}
                          </p>
                          <a
                            href={ENGINE_RELEASE_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex min-h-8 items-center gap-1.5 text-xs font-bold text-[var(--home-module-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-module-accent)]"
                          >
                            {t("home.whatsNew.releaseNotes")} <ExternalLink size="0.7rem" />
                          </a>
                        </div>
                      </FeedModule>
                    </HomeWidgetFrame>

                    <HomeWidgetFrame {...widgetFrameProps("discovery")}>
                      <FeedModule
                        eyebrow={t("home.discovery.eyebrow")}
                        title={t("home.discovery.title")}
                        accent={HOME_MODULE_ACCENTS.violet}
                        className="h-full"
                        action={
                          <button
                            type="button"
                            onClick={() => useUIStore.getState().openAgentCatalog()}
                            className="min-h-8 shrink-0 text-xs font-bold text-[var(--home-module-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-module-accent)]"
                          >
                            {t("home.discovery.browse")}
                          </button>
                        }
                      >
                        {activeRecommendation ? (
                          <div className="relative flex h-full min-h-24 items-center px-6">
                            {recommendations.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => moveDiscovery(-1)}
                                className="absolute -left-1 top-1/2 z-[2] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--home-module-accent)] transition-[background-color,transform] hover:bg-[color-mix(in_srgb,var(--home-module-accent)_12%,var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-module-accent)]"
                                aria-label={t("home.discovery.previous")}
                              >
                                <ChevronLeft size="1rem" />
                              </button>
                            ) : null}
                            <button
                              key={activeRecommendation.manifest.id}
                              type="button"
                              onClick={() => useUIStore.getState().openAgentCatalog(activeRecommendation.manifest.id)}
                              className="mari-home-discovery-card flex min-h-24 w-full items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--home-module-accent)_20%,var(--border))] bg-[color-mix(in_srgb,var(--home-module-accent)_5%,var(--secondary))] p-3 text-left transition-colors hover:border-[color-mix(in_srgb,var(--home-module-accent)_48%,var(--border))] hover:bg-[color-mix(in_srgb,var(--home-module-accent)_10%,var(--secondary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-module-accent)]"
                            >
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[color-mix(in_srgb,var(--home-module-accent)_14%,var(--accent))] text-[var(--home-module-accent)]">
                                {activeRecommendation.iconUrl ? (
                                  <img
                                    src={activeRecommendation.iconUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <PackagePlus size="1rem" />
                                )}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-bold text-[var(--foreground)]">
                                  {activeRecommendationDisplay?.name ?? activeRecommendation.manifest.name}
                                </span>
                                <span className="mt-0.5 line-clamp-2 text-[0.68rem] leading-relaxed text-[var(--muted-foreground)]">
                                  {activeRecommendationDisplay?.description ??
                                    activeRecommendation.manifest.description}
                                </span>
                                {recommendations.length > 1 ? (
                                  <span className="mt-1.5 block text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[var(--home-module-accent)]">
                                    {t("home.discovery.position", {
                                      current: (discoveryIndex % recommendations.length) + 1,
                                      total: recommendations.length,
                                    })}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                            {recommendations.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => moveDiscovery(1)}
                                className="absolute -right-1 top-1/2 z-[2] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--home-module-accent)] transition-[background-color,transform] hover:bg-[color-mix(in_srgb,var(--home-module-accent)_12%,var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-module-accent)]"
                                aria-label={t("home.discovery.next")}
                              >
                                <ChevronRight size="1rem" />
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex h-full min-h-20 items-center gap-3 rounded-xl border border-dashed border-[var(--border)]/70 p-3 text-xs text-[var(--muted-foreground)]">
                            <Compass size="1rem" className="text-[var(--home-module-accent)]" />{" "}
                            {t("home.discovery.empty")}
                          </div>
                        )}
                      </FeedModule>
                    </HomeWidgetFrame>

                    <HomeWidgetFrame {...widgetFrameProps("character")}>
                      <FeedModule
                        eyebrow={t("home.characterOfDay.eyebrow")}
                        title={t("home.characterOfDay.title")}
                        accent={HOME_MODULE_ACCENTS.pink}
                        className="h-full"
                      >
                        {characterOfDay ? (
                          <div
                            className="flex h-full min-h-0 items-center gap-3"
                            data-component="HomeBrowserHub.CharacterOfDayContent"
                          >
                            <div
                              className="relative h-24 w-24 shrink-0 sm:h-32 sm:w-32"
                              data-component="HomeBrowserHub.CharacterOfDayAvatar"
                            >
                              <span className="absolute inset-[15%] flex items-center justify-center overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--home-module-accent)_12%,var(--secondary))] text-2xl font-black text-[var(--home-module-accent)]">
                                {characterOfDay.avatarPath ? (
                                  <img
                                    src={characterOfDay.avatarPath}
                                    alt=""
                                    className="h-full w-full rounded-full object-cover"
                                    style={getAvatarCropStyle(characterOfDay.avatarCrop)}
                                    loading="lazy"
                                  />
                                ) : (
                                  characterOfDay.name.slice(0, 1)
                                )}
                              </span>
                              <img
                                src="/home/character-portal.png"
                                alt=""
                                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                                aria-hidden="true"
                              />
                            </div>
                            <div className="min-w-0 flex-1" data-component="HomeBrowserHub.CharacterOfDayDetails">
                              <h3 className="truncate text-base font-bold text-[var(--foreground)]">
                                {characterOfDay.name}
                              </h3>
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--muted-foreground)] sm:line-clamp-3">
                                {characterOfDay.comment ||
                                  characterOfDay.description ||
                                  t("home.characterOfDay.fallback")}
                              </p>
                              <button
                                type="button"
                                onClick={() => useUIStore.getState().openCharacterDetail(characterOfDay.id)}
                                className="mt-2 inline-flex min-h-8 items-center text-xs font-bold text-[var(--home-module-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-module-accent)]"
                              >
                                {t("home.characterOfDay.open")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex min-h-32 flex-col justify-end">
                            <LibraryBig className="mb-2 text-[var(--home-module-accent)]" size="1.1rem" />
                            <p className="text-sm font-bold text-[var(--foreground)]">
                              {t("home.characterOfDay.emptyTitle")}
                            </p>
                            <button
                              type="button"
                              onClick={() => useUIStore.getState().openCharacterLibrary()}
                              className="mt-2 self-start text-xs font-bold text-[var(--home-module-accent)] hover:underline"
                            >
                              {t("home.characterOfDay.emptyAction")}
                            </button>
                          </div>
                        )}
                      </FeedModule>
                    </HomeWidgetFrame>

                    <HomeWidgetFrame {...widgetFrameProps("learn")}>
                      <FeedModule
                        eyebrow={t("home.learn.eyebrow")}
                        title={t("home.learn.title")}
                        accent={HOME_MODULE_ACCENTS.cyan}
                        className="h-full"
                      >
                        <div className="mari-home-widget-shortcut-list grid content-center gap-1">
                          {[
                            {
                              icon: "/home/tab-icons/documentation.png",
                              title: t("home.learn.docsTitle"),
                              description: t("home.learn.docsDescription"),
                              action: () => useUIStore.getState().openModal("docs-viewer"),
                            },
                            {
                              icon: "/home/tab-icons/tutorial.png",
                              title: t("home.learn.tutorialTitle"),
                              description: t("home.learn.tutorialDescription"),
                              action: () => useUIStore.getState().setHasCompletedOnboarding(false),
                            },
                            {
                              icon: "/home/tab-icons/faq.png",
                              title: t("home.learn.faqTitle"),
                              description: t("home.learn.faqDescription"),
                              action: () => setFaqOpen(true),
                            },
                          ].map((item) => (
                            <HomeWidgetShortcut
                              key={item.title}
                              onClick={item.action}
                              icon={item.icon}
                              title={item.title}
                              description={item.description}
                            />
                          ))}
                        </div>
                      </FeedModule>
                    </HomeWidgetFrame>

                    <HomeWidgetFrame {...widgetFrameProps("community")}>
                      <FeedModule
                        eyebrow={t("home.community.eyebrow")}
                        title={t("home.community.title")}
                        accent={HOME_MODULE_ACCENTS.pink}
                        className="h-full"
                      >
                        <div className="mari-home-widget-shortcut-list grid content-center gap-1">
                          <HomeWidgetShortcut
                            href="https://discord.com/invite/KdAkTg94ME"
                            onClick={() => trackHomeAction("discord_clicked")}
                            icon="/home/tab-icons/discord.svg"
                            title={t("home.community.discordTitle")}
                            description={t("home.community.discordDescription")}
                          />
                          <HomeWidgetShortcut
                            href="https://ko-fi.com/marinara_spaghetti"
                            onClick={() => trackHomeAction("kofi_clicked")}
                            icon="/home/tab-icons/kofi.png"
                            title={t("home.community.supportTitle")}
                            description={t("home.community.supportDescription")}
                          />
                          <HomeWidgetShortcut
                            onClick={() => {
                              trackHomeAction("credits_viewed");
                              onOpenCredits();
                            }}
                            icon="/home/tab-icons/credits.png"
                            title={t("home.community.creditsTitle")}
                            description={t("home.community.creditsDescription")}
                          />
                        </div>
                      </FeedModule>
                    </HomeWidgetFrame>

                    <HomeWidgetFrame {...widgetFrameProps("clock")}>
                      <HomeClockCalendar />
                    </HomeWidgetFrame>

                    <HomeWidgetFrame {...widgetFrameProps("achievements")}>
                      <FeedModule
                        eyebrow={t("home.achievements.eyebrow")}
                        title={t("home.achievements.title")}
                        description={t("home.achievements.description")}
                        accent={HOME_MODULE_ACCENTS.orange}
                        art="/home/achievement-trophy.png"
                        artClassName={HOME_CARD_ART_CLASS}
                        className="h-full min-h-0"
                      >
                        <HomeAchievements
                          compact
                          open={achievementsOpen}
                          onOpenChange={setAchievementsOpen}
                          showModal={false}
                          className="!h-auto !w-full !border-0 !px-2"
                        />
                      </FeedModule>
                    </HomeWidgetFrame>
                    {customWidgets.map((widget) => {
                      const id = customHomeWidgetId(widget.id);
                      const Icon = HOME_CUSTOM_WIDGET_ICONS[widget.icon];
                      return (
                        <HomeWidgetFrame key={id} {...widgetFrameProps(id)}>
                          <FeedModule
                            eyebrow={t("home.widgets.customEyebrow")}
                            title={widget.title}
                            accent={HOME_MODULE_ACCENTS[widget.accent]}
                            className="h-full"
                          >
                            <div className="flex h-full min-h-0 items-center gap-3">
                              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--home-module-accent)_38%,var(--border))] bg-[color-mix(in_srgb,var(--home-module-accent)_12%,var(--card))] text-[var(--home-module-accent)]">
                                <Icon size="1.25rem" aria-hidden="true" />
                              </span>
                              <p className="line-clamp-6 min-w-0 text-xs leading-relaxed text-[var(--muted-foreground)]">
                                {widget.description}
                              </p>
                            </div>
                          </FeedModule>
                        </HomeWidgetFrame>
                      );
                    })}
                    {activeWidgetSlots.map((slot, index) =>
                      slot === null ? (
                        <div
                          key={`empty-${index}`}
                          data-home-empty-slot={index}
                          className="mari-home-empty-slot"
                          style={{ order: index }}
                          aria-hidden="true"
                        />
                      ) : null,
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      {!professorChatActive && activeTab === "home" ? (
        <FloatingProfessorMari
          pageActive={pageActive}
          enabled={professorMariNavigationEnabled || !hasCompletedOnboarding}
          boundaryRef={contentRef}
          onResolve={resolveWithProfessorMari}
          onNavigate={openProfessorMariTarget}
          onOpenProfessor={openProfessor}
          onOpenDocumentation={() => useUIStore.getState().openModal("docs-viewer")}
          onMeaningfulDrag={() => trackHomeAction("prof_mari_dragged")}
        />
      ) : null}
      {achievementsEnabled ? (
        <HomeAchievements open={achievementsOpen} onOpenChange={setAchievementsOpen} showLauncher={false} />
      ) : null}
      <Modal
        open={faqOpen}
        onClose={() => setFaqOpen(false)}
        title={t("home.browser.faqWindowTitle")}
        width="max-w-5xl"
      >
        <HomeFaq headerless faqOnly expanded className="max-w-none" />
      </Modal>
      <Modal
        open={widgetManagerOpen}
        onClose={() => setWidgetManagerOpen(false)}
        title={t("home.browser.widgetsWindowTitle")}
        width="max-w-lg"
      >
        <div className="space-y-3" data-component="HomeBrowserHub.WidgetManager">
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            {t("home.browser.widgetsWindowDescription")}
          </p>
          <div className="grid gap-2">
            {availableWidgetIds.map((id, index) => {
              const enabled = visibleWidgets.includes(id);
              const label = widgetManagerLabel(id);
              const customWidget = customWidgetsById.get(id);
              const tones = [
                HOME_MODULE_ACCENTS.pink,
                HOME_MODULE_ACCENTS.cyan,
                HOME_MODULE_ACCENTS.orange,
                HOME_MODULE_ACCENTS.violet,
              ] as const;
              const tone = tones[index % tones.length];
              return (
                <div
                  key={id}
                  className="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_90%,var(--accent))] px-3 py-2"
                >
                  <span
                    className="grid h-8 w-8 shrink-0 grid-cols-2 gap-0.5 rounded-lg border border-[color-mix(in_srgb,var(--widget-tone)_42%,var(--border))] bg-[color-mix(in_srgb,var(--widget-tone)_13%,var(--card))] p-1.5"
                    style={{ "--widget-tone": tone } as CSSProperties}
                    aria-hidden="true"
                  >
                    <i className="rounded-[0.12rem] bg-[oklch(0.79_0.16_205)]" />
                    <i className="rounded-[0.12rem] bg-[oklch(0.76_0.19_52)]" />
                    <i className="rounded-[0.12rem] bg-[oklch(0.73_0.21_345)]" />
                    <i className="rounded-[0.12rem] bg-[var(--widget-tone)]" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-[var(--foreground)]">
                    {label}
                  </span>
                  {customWidget ? (
                    <button
                      type="button"
                      onClick={() => void deleteCustomWidget(customWidget)}
                      disabled={deleteCustomWidgetMutation.isPending}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] transition-[background-color,color,border-color,transform] hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 active:scale-95 disabled:opacity-50"
                      aria-label={t("home.widgets.deleteLabel", { widget: label })}
                      title={t("home.widgets.deleteLabel", { widget: label })}
                    >
                      <Trash2 size="1rem" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={t(enabled ? "home.widgets.hide" : "home.widgets.show", { widget: label })}
                    onClick={() => toggleWidgetVisibility(id)}
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-[background-color,color,border-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)] active:scale-95",
                      enabled
                        ? "border-[color-mix(in_srgb,var(--marinara-app-accent-solid)_48%,var(--border))] bg-[color-mix(in_srgb,var(--marinara-app-accent-solid)_16%,var(--card))] text-[var(--marinara-app-accent-solid)]"
                        : "border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)]",
                    )}
                  >
                    {enabled ? <Eye size="1rem" /> : <EyeOff size="1rem" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
