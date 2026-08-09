// ──────────────────────────────────────────────
// Onboarding Tutorial — first-time guided tour
// ──────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUIStore, type ChatModeShortcut } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { useTrackAchievement } from "../../hooks/use-achievements";
import { docsLanguageKeys, useDocsLanguage, type DocsLanguageStatus } from "../../hooks/use-docs-language";
import { api } from "../../lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { useTranslation as useUiTranslation } from "react-i18next";

// ─── Step definitions ─────────────────────────

type TourPanel =
  | "characters"
  | "lorebooks"
  | "presets"
  | "connections"
  | "agents"
  | "personas"
  | "settings";

interface TourStep {
  /** data-tour attribute value of the element to highlight, or null for centered modal */
  target: string | null;
  /** Additional data-tour targets highlighted alongside the primary target */
  highlightTargets?: string[];
  title?: string;
  body?: string;
  /** Semantic localization keys for newly authored tutorial copy. */
  titleKey?: string;
  bodyKey?: string;
  /** Preferred side for the tooltip relative to the highlighted element */
  side?: "top" | "bottom" | "left" | "right";
  /** Right-side panel to open while this step is active */
  openPanel?: TourPanel;
  /** Chat sidebar mode tab to open while this step is active */
  chatMode?: ChatModeShortcut;
  /** Open the chat sidebar without changing its mode */
  openSidebar?: boolean;
  /** Return to the unobstructed Home hub while this step is active */
  openHome?: boolean;
  /** Keep the tutorial card centered while still spotlighting its target */
  centerCard?: boolean;
  /** Optional settings tab to show when the Settings panel is open */
  settingsTab?: string;
  /** Render the documentation-language picker inside this step's card */
  docsLanguagePicker?: boolean;
  /** Professor Mari sprite to display */
  sprite?: { src: string; flip?: boolean };
}

const STEPS: TourStep[] = [
  {
    target: null,
    title: "Welcome to Marinara Engine!",
    body: "Hi! I'm Professor Mari, your assistant and guide! First time around? Allow me to show you around. This is a quick orientation tour, so you can skip it if you already know your way around, but skipping will make me sad a little.",
    sprite: { src: "/sprites/mari/Mari_wave.png" },
  },
  {
    target: "panel-characters",
    title: "Characters",
    body: "Characters are who your AI is going to play or speak as. Create them, edit their descriptions, dialogue examples, organize them into folders, or make them pretty (I can also create those for you).",
    side: "bottom",
    openPanel: "characters",
    sprite: { src: "/sprites/mari/Mari_point_up_left.png", flip: true },
  },
  {
    target: "panel-personas",
    title: "Personas",
    body: "Personas define who you are in a chat. Give yourself a name, avatar, description, scenario details, and pretty colors, so characters know who they are speaking to.",
    side: "bottom",
    openPanel: "personas",
    sprite: { src: "/sprites/mari/Mari_point_up_left.png", flip: true },
  },
  {
    target: "panel-lorebooks",
    title: "Lorebooks",
    body: "Lorebooks hold compendiums about worlds, memories, rules, locations, and extra character details. Entries trigger when their keys appear, giving the model extra context only when it matters (and saving your wallet from sending 200k tokens each turn).",
    side: "bottom",
    openPanel: "lorebooks",
    sprite: { src: "/sprites/mari/Mari_point_up_left.png", flip: true },
  },
  {
    target: "panel-presets",
    title: "Presets",
    body: "Presets control prompt structure. They're templates that build what the model receives and in what order. If you're new to prompt engineering, you can leave this alone for now and use the default preset (or download one from the community).",
    side: "bottom",
    openPanel: "presets",
    sprite: { src: "/sprites/mari/Mari_point_up_left.png", flip: true },
  },
  {
    target: "panel-connections",
    title: "Connections",
    body: "Connections are the first thing to set up before chatting. Add your provider, model, endpoint, and API key here, so you can chat with your AI.",
    side: "bottom",
    openPanel: "connections",
    sprite: { src: "/sprites/mari/Mari_point_up_left.png", flip: true },
  },
  {
    target: "panel-agents",
    title: "Agents",
    body: "Agents add optional features without making the base app heavy. Open Download Agents here to browse and install image and video generation, trackers, writers, maps, audio and video calls, and various chat games, then enable the ones you want for each chat. You can update or uninstall them from the same catalog.",
    side: "bottom",
    openPanel: "agents",
    sprite: { src: "/sprites/mari/Mari_point_up_left.png", flip: true },
  },
  {
    target: "panel-settings",
    title: "Settings",
    body: "Settings control the whole app: appearance, behavior, imports, themes, image defaults, notifications, data tools, and other global preferences.",
    side: "bottom",
    openPanel: "settings",
    settingsTab: "general",
    sprite: { src: "/sprites/mari/Mari_point_up_left.png", flip: true },
  },
  {
    target: "sidebar-toggle",
    title: "Chats",
    body: "Now let's open the Chats tab. This is where your Conversations, Roleplays, and Games live. You can create new chats, switch between them, and manage them here.",
    side: "right",
    openSidebar: true,
    sprite: { src: "/sprites/mari/Mari_point_middle_left.png" },
  },
  {
    target: "chat-mode-conversation",
    title: "Conversation Mode",
    body: "Conversation mode is like chatting via DMs or groups on Discord. Use it for general texting with your characters. Mind that they have their lives, can trade selfies with you and even message you on their own!",
    side: "right",
    chatMode: "conversation",
    sprite: { src: "/sprites/mari/Mari_point_middle_left.png" },
  },
  {
    target: "chat-mode-roleplay",
    title: "Roleplay Mode",
    body: "Roleplay mode is for roleplaying scenes and immersive stories. It supports richer narration, lorebooks, agents, long-time memory systems, author's notes, trackers, and co-writing controls.",
    side: "right",
    chatMode: "roleplay",
    sprite: { src: "/sprites/mari/Mari_point_middle_left.png" },
  },
  {
    target: "chat-mode-game",
    title: "Game Mode",
    body: "Game mode turns the chat into a cinematic RPG-style adventure with an AI Game Master. Sit back and enjoy the game, having party members, goals, maps, dice rolls, session history, journals, combat, and custom HUD widgets.",
    side: "right",
    chatMode: "game",
    sprite: { src: "/sprites/mari/Mari_point_middle_left.png" },
  },
  {
    target: "home-hub",
    titleKey: "onboarding.homeHub.title",
    bodyKey: "onboarding.homeHub.body",
    side: "bottom",
    openHome: true,
    sprite: { src: "/sprites/mari/Mari_explaining.png" },
  },
  {
    target: "home-navigation",
    titleKey: "onboarding.homeNavigation.title",
    bodyKey: "onboarding.homeNavigation.body",
    openHome: true,
    centerCard: true,
    sprite: { src: "/sprites/mari/Mari_point_middle_left.png" },
  },
  {
    target: "home-documentation",
    highlightTargets: ["home-tutorial", "home-faq", "home-widgets"],
    titleKey: "onboarding.homeTools.title",
    bodyKey: "onboarding.homeTools.body",
    side: "bottom",
    openHome: true,
    sprite: { src: "/sprites/mari/Mari_point_up_left.png", flip: true },
  },
  {
    target: "panel-settings",
    title: "Migrating from SillyTavern?",
    body: "If you have characters, chats, or presets from SillyTavern, open Settings and use the Import tab. I can bring those files in so you do not have to rebuild your library by hand.",
    side: "bottom",
    openPanel: "settings",
    settingsTab: "import",
    sprite: { src: "/sprites/mari/Mari_thinking.png" },
  },
  {
    target: "panel-connections",
    title: "You're All Set!",
    body: "I'm available from the Home page whenever you need help, and my starter chips can guide you through common first steps without making you type everything. For your first real step, set up a Connection. After that, try creating a new chat. Don't worry, I will be there to guide you. Thank you for trying Marinara Engine. Have fun, and please report bugs or rough edges through our Discord or GitHub so we can keep improving it.",
    side: "bottom",
    openPanel: "connections",
    sprite: { src: "/sprites/mari/Mari_greet.png" },
  },
  {
    target: "home-documentation",
    title: "One Last Thing: Guide Language",
    body: "The highlighted Documentation button on Home opens Marinara's built-in guides. Pick a language below, and I'll use it whenever you open them. You can change this anytime in Settings under General. Guides that are not translated yet will show in English.",
    side: "top",
    openHome: true,
    docsLanguagePicker: true,
    sprite: { src: "/sprites/mari/Mari_explaining.png" },
  },
];

// ─── Spotlight overlay helpers ────────────────

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface SpotlightRect extends Rect {
  target: string;
}

const PAD = 8; // px padding around the spotlight cutout
const MOBILE_BREAKPOINT = 640;
const TOPBAR_FALLBACK_HEIGHT = 48;
const TUTORIAL_TOP_GAP = 12;
const TUTORIAL_DESKTOP_WIDTH = 340;
const TUTORIAL_CARD_CLASS =
  "mari-chrome-token-scope pointer-events-auto overflow-x-hidden overflow-y-auto rounded-2xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-5 shadow-2xl ring-1 ring-[var(--marinara-chat-chrome-focus-ring)]";
const TUTORIAL_SECONDARY_BUTTON_CLASS =
  "rounded-lg px-3 py-1.5 text-xs text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--marinara-chat-chrome-panel-text)]";
const TUTORIAL_PRIMARY_BUTTON_CLASS =
  "flex items-center gap-1.5 rounded-lg border border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] px-4 py-1.5 text-xs font-medium text-[var(--marinara-chat-chrome-button-text-active)] shadow-sm transition-all hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] active:scale-95";
const TUTORIAL_DOCUMENTATION_BUTTON_CLASS =
  "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] px-4 py-2.5 text-sm font-semibold text-[var(--marinara-chat-chrome-button-text-active)] shadow-sm transition-all hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] active:scale-[0.98]";

function getTargetRect(target: string): SpotlightRect | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { target, top: r.top, left: r.left, width: r.width, height: r.height };
}

function spotlightRectsMatch(previous: readonly SpotlightRect[], next: readonly SpotlightRect[]): boolean {
  return (
    previous.length === next.length &&
    previous.every((rect, index) => {
      const candidate = next[index];
      return (
        candidate?.target === rect.target &&
        candidate.top === rect.top &&
        candidate.left === rect.left &&
        candidate.width === rect.width &&
        candidate.height === rect.height
      );
    })
  );
}

function getViewportWidth(): number {
  return typeof window === "undefined" ? 1024 : window.innerWidth;
}

function getViewportHeight(): number {
  return typeof window === "undefined" ? 768 : window.innerHeight;
}

function getTopbarBottom(): number {
  if (typeof document === "undefined") return TOPBAR_FALLBACK_HEIGHT;
  const topbar = document.querySelector<HTMLElement>('[data-component="TopBar"]');
  return Math.max(TOPBAR_FALLBACK_HEIGHT, topbar?.getBoundingClientRect().bottom ?? TOPBAR_FALLBACK_HEIGHT);
}

function getTutorialTopOffset(): number {
  return getTopbarBottom() + TUTORIAL_TOP_GAP;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function isPanelTourTarget(target: string | null): boolean {
  return target?.startsWith("panel-") ?? false;
}

function isTopbarTourTarget(target: string | null): boolean {
  return target === "sidebar-toggle" || isPanelTourTarget(target);
}

function isChatModeTourTarget(target: string | null): boolean {
  return target?.startsWith("chat-mode-") ?? false;
}

// ─── Tooltip position ─────────────────────────

function computeTooltipStyle(rect: Rect, step: TourStep): React.CSSProperties {
  const vw = getViewportWidth();
  const vh = getViewportHeight();
  const isMobile = vw < MOBILE_BREAKPOINT;
  const VIEWPORT_MARGIN = isMobile ? 12 : 16;
  const TOOLTIP_W = isMobile
    ? Math.min(vw - VIEWPORT_MARGIN * 2, 320)
    : Math.min(TUTORIAL_DESKTOP_WIDTH, vw - VIEWPORT_MARGIN * 2);
  const GAP = isMobile ? 8 : 16;
  const topOffset = getTutorialTopOffset();
  const availableViewportHeight = Math.max(200, vh - topOffset - VIEWPORT_MARGIN);
  const side = step.side ?? "right";
  const available = {
    right: vw - (rect.left + rect.width + GAP + PAD) - VIEWPORT_MARGIN,
    left: rect.left - GAP - PAD - VIEWPORT_MARGIN,
    bottom: vh - (rect.top + rect.height + GAP + PAD) - VIEWPORT_MARGIN,
    top: rect.top - GAP - PAD - topOffset,
  };

  // On small screens, always center below the topbar.
  if (isMobile) {
    return {
      position: "fixed",
      top: topOffset,
      left: (vw - TOOLTIP_W) / 2,
      width: TOOLTIP_W,
      maxHeight: `${availableViewportHeight}px`,
      overflowY: "auto" as const,
      overflowX: "hidden" as const,
      overscrollBehavior: "contain" as const,
    };
  }

  if (isPanelTourTarget(step.target)) {
    const top = Math.max(topOffset, rect.top + rect.height + GAP);
    const left = clampNumber(rect.left + rect.width - TOOLTIP_W, VIEWPORT_MARGIN, vw - TOOLTIP_W - VIEWPORT_MARGIN);
    return {
      position: "fixed",
      top,
      left,
      width: TOOLTIP_W,
      maxHeight: `${Math.max(200, vh - top - VIEWPORT_MARGIN)}px`,
      overflowY: "auto",
      overflowX: "hidden",
      overscrollBehavior: "contain",
    };
  }

  if (isTopbarTourTarget(step.target)) {
    const top = topOffset;
    const left = clampNumber(rect.left + rect.width + GAP, VIEWPORT_MARGIN, vw - TOOLTIP_W - VIEWPORT_MARGIN);
    return {
      position: "fixed",
      top,
      left,
      width: TOOLTIP_W,
      maxHeight: `${availableViewportHeight}px`,
      overflowY: "auto",
      overflowX: "hidden",
      overscrollBehavior: "contain",
    };
  }

  if (isChatModeTourTarget(step.target)) {
    const top = Math.max(topOffset, rect.top);
    const left = clampNumber(rect.left + rect.width + GAP, VIEWPORT_MARGIN, vw - TOOLTIP_W - VIEWPORT_MARGIN);
    return {
      position: "fixed",
      top,
      left,
      width: TOOLTIP_W,
      maxHeight: `${Math.max(200, vh - top - VIEWPORT_MARGIN)}px`,
      overflowY: "auto",
      overflowX: "hidden",
      overscrollBehavior: "contain",
    };
  }

  const minScrollableHeight = isMobile ? 220 : 340;
  const preferredVerticalSide = available.bottom >= available.top ? "bottom" : "top";
  let placement = side;

  if (side === "right" && available.right < TOOLTIP_W && available.left >= TOOLTIP_W) {
    placement = "left";
  } else if (side === "left" && available.left < TOOLTIP_W && available.right >= TOOLTIP_W) {
    placement = "right";
  } else if (side === "bottom" && available.bottom < minScrollableHeight && available.top >= minScrollableHeight) {
    placement = "top";
  } else if (side === "top" && available.top < minScrollableHeight && available.bottom >= minScrollableHeight) {
    placement = "bottom";
  } else if ((side === "right" || side === "left") && available.right < TOOLTIP_W && available.left < TOOLTIP_W) {
    placement = preferredVerticalSide;
  } else if (
    (side === "top" || side === "bottom") &&
    available.top < minScrollableHeight &&
    available.bottom < minScrollableHeight
  ) {
    placement = available.right >= available.left ? "right" : "left";
  }

  let maxHeight = vh - VIEWPORT_MARGIN * 2;

  let top = 0;
  let left = 0;

  if (placement === "right") {
    maxHeight = Math.min(Math.max(minScrollableHeight, availableViewportHeight), availableViewportHeight);
    top = rect.top + rect.height / 2 - maxHeight / 2;
    left = rect.left + rect.width + GAP + PAD;
    if (left + TOOLTIP_W > vw - VIEWPORT_MARGIN) {
      left = rect.left - TOOLTIP_W - GAP - PAD;
    }
  } else if (placement === "left") {
    maxHeight = Math.min(Math.max(minScrollableHeight, availableViewportHeight), availableViewportHeight);
    top = rect.top + rect.height / 2 - maxHeight / 2;
    left = rect.left - TOOLTIP_W - GAP - PAD;
    if (left < VIEWPORT_MARGIN) {
      left = rect.left + rect.width + GAP + PAD;
    }
  } else if (placement === "bottom") {
    maxHeight = Math.max(minScrollableHeight, Math.min(availableViewportHeight, available.bottom));
    top = rect.top + rect.height + GAP + PAD;
    left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
  } else {
    maxHeight = Math.max(minScrollableHeight, Math.min(availableViewportHeight, available.top));
    top = rect.top - GAP - PAD - maxHeight;
    left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
  }

  // Clamp within the viewport area below the topbar.
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - TOOLTIP_W - VIEWPORT_MARGIN));
  top = Math.max(topOffset, Math.min(top, Math.max(topOffset, vh - maxHeight - VIEWPORT_MARGIN)));

  return {
    position: "fixed",
    top,
    left,
    width: TOOLTIP_W,
    maxHeight: `${maxHeight}px`,
    overflowY: "auto",
    overflowX: "hidden",
    overscrollBehavior: "contain",
  };
}

// ─── Card content (shared between centered & positioned variants) ──

function TourCardContent({
  step,
  currentStep,
  isLast,
  onNext,
  onSkip,
  pickerSlot,
}: {
  step: number;
  currentStep: TourStep;
  isLast: boolean;
  onNext: () => void;
  onSkip: () => void;
  /** Extra interactive content rendered between the body and the progress dots */
  pickerSlot?: React.ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const localizedBody = currentStep.bodyKey
    ? localizeUi(currentStep.bodyKey)
    : localize(currentStep.body ?? "");
  const localizedTitle = currentStep.titleKey
    ? localizeUi(currentStep.titleKey)
    : localize(currentStep.title ?? "");
  return (
    <>
      {/* Professor Mari sprite */}
      {currentStep.sprite && (
        <div className="mb-2 flex justify-center">
          <img
            src={currentStep.sprite.src}
            alt={localizeUi("ui.onboarding.tourcardcontent.professorMari")}
            className="h-32 max-h-[15vh] w-auto object-contain drop-shadow-lg"
            style={currentStep.sprite.flip ? { transform: "scaleX(-1)" } : undefined}
            draggable={false}
          />
        </div>
      )}

      {/* Header */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
          {localizedTitle}
        </h3>
      </div>

      {/* Body */}
      <p className="mb-4 break-words text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
        {localizedBody.split("\n").map((line, i, arr) => (
          <span key={i}>
            {line.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j} className="font-semibold text-[var(--marinara-chat-chrome-panel-text)]">
                  {part.slice(2, -2)}
                </strong>
              ) : (
                <span key={j}>{part}</span>
              ),
            )}
            {i < arr.length - 1 && <br />}
          </span>
        ))}
      </p>

      {pickerSlot}

      {/* Progress dots */}
      <div className="mb-3 flex items-center justify-center gap-1.5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step
                ? "w-4 bg-[var(--marinara-chat-chrome-button-text-active)]"
                : i < step
                  ? "w-1.5 bg-[var(--marinara-chat-chrome-button-text-active)]/40"
                  : "w-1.5 bg-[var(--marinara-chat-chrome-panel-muted)]/25"
            }`}
          />
        ))}
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-between">
        <button onClick={onSkip} className={TUTORIAL_SECONDARY_BUTTON_CLASS}>
          {localize(step === 0 ? "Skip Tutorial" : "Skip")}
        </button>
        <button onClick={onNext} className={TUTORIAL_PRIMARY_BUTTON_CLASS}>
          {localize(isLast ? "Get Started" : "Next")}
          {!isLast && <ChevronRight size="0.75rem" />}
        </button>
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────

export function OnboardingTutorial() {
  const hasCompleted = useUIStore((s) => s.hasCompletedOnboarding);
  if (hasCompleted) return null;
  return <OnboardingTutorialInner />;
}

function OnboardingTutorialInner() {
  const setCompleted = useUIStore((s) => s.setHasCompletedOnboarding);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);
  const setSettingsTab = useUIStore((s) => s.setSettingsTab);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const requestChatModeShortcut = useUIStore((s) => s.requestChatModeShortcut);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const uiLanguage = useUIStore((s) => s.language);
  const trackAchievement = useTrackAchievement();
  const { t: localizeUi } = useUiTranslation();

  const [step, setStep] = useState(0);
  const [spotlightRects, setSpotlightRects] = useState<SpotlightRect[]>([]);
  const [isMobileViewport, setIsMobileViewport] = useState(() => getViewportWidth() < MOBILE_BREAKPOINT);
  const rafRef = useRef<number>(0);

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const targetRect = spotlightRects.find((rect) => rect.target === currentStep.target) ?? null;

  // ── Documentation-language picker (final step) ──
  const { data: docsLanguageStatus } = useDocsLanguage();
  const queryClient = useQueryClient();
  const [docsLanguagePick, setDocsLanguagePick] = useState<string | null>(null);
  const docsLanguageOptions = useMemo(() => docsLanguageStatus?.available ?? [], [docsLanguageStatus?.available]);
  const activeDocsLanguage = docsLanguageStatus?.active ?? "en";
  // Pre-select the user's existing choice whenever one has been made, so an
  // untouched picker is a guaranteed no-op on tutorial replays. Only on a
  // genuinely fresh install (nothing configured yet) suggest the UI language.
  // Match the full lowercased UI locale first (pt-BR → the "pt-br" pack), then
  // fall back to a base-language match ("pt" would still find "pt-br").
  const uiLanguageLower = uiLanguage?.toLowerCase() ?? "en";
  const uiLanguageBase = uiLanguageLower.split("-")[0];
  const uiMatchedDocsLanguage =
    docsLanguageOptions.find((option) => option.code === uiLanguageLower)?.code ??
    docsLanguageOptions.find((option) => option.code.split("-")[0] === uiLanguageBase)?.code;
  const suggestedDocsLanguage =
    docsLanguageStatus?.configured || !uiMatchedDocsLanguage ? activeDocsLanguage : uiMatchedDocsLanguage;
  const effectiveDocsLanguagePick = docsLanguagePick ?? suggestedDocsLanguage;

  /**
   * Commit the picked docs language when the tour completes via "Get Started".
   * Fire-and-forget: finishing onboarding must never block on the server, and a
   * failure only means the user stays on English (fixable later in Settings).
   */
  const commitDocsLanguage = useCallback(() => {
    if (effectiveDocsLanguagePick === activeDocsLanguage) return;
    const info = docsLanguageOptions.find((option) => option.code === effectiveDocsLanguagePick);
    const label = info?.label ?? effectiveDocsLanguagePick;
    // A not-yet-downloaded pack keeps downloading after the tutorial closes;
    // tell the user so the eventual success/failure toast has context.
    if (effectiveDocsLanguagePick !== "en" && !(info?.installed ?? false)) {
      toast.info(localizeUi("settings.application.docsLanguage.downloadingLanguage", { language: label }));
    }
    // Plain promise, not a React Query mutation: the tutorial unmounts right
    // after "Get Started", and v5 drops mutate() callbacks on unmount — these
    // handlers (and the global sonner toasts) must outlive the component.
    api
      .put<DocsLanguageStatus>("/docs/language", { language: effectiveDocsLanguagePick })
      .then((status) => {
        queryClient.setQueryData(docsLanguageKeys.status(), status);
        // "docs" mirrors docsKeys.all in use-docs.ts — every docs query refetches.
        void queryClient.invalidateQueries({ queryKey: ["docs"] });
        toast.success(localizeUi("settings.application.docsLanguage.switched", { language: label }));
      })
      .catch((err: unknown) => {
        toast.error(
          localizeUi("settings.application.docsLanguage.switchFailed", {
            reason: err instanceof Error ? err.message : String(err),
          }),
        );
      });
  }, [activeDocsLanguage, docsLanguageOptions, effectiveDocsLanguagePick, localizeUi, queryClient]);

  useEffect(() => {
    const updateViewportMode = () => setIsMobileViewport(getViewportWidth() < MOBILE_BREAKPOINT);
    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);
    return () => window.removeEventListener("resize", updateViewportMode);
  }, []);

  // ── Side-effects when step changes ──
  useEffect(() => {
    if (currentStep.openHome) {
      closeAllDetails();
      setActiveChatId(null);
      closeRightPanel();
      setSidebarOpen(false);
      return;
    }

    if (currentStep.chatMode) {
      closeRightPanel();
      requestChatModeShortcut(currentStep.chatMode);
      return;
    }

    if (currentStep.openSidebar) {
      closeRightPanel();
      setSidebarOpen(true);
      return;
    }

    if (currentStep.openPanel) {
      setSidebarOpen(false);
      openRightPanel(currentStep.openPanel);
      if (currentStep.settingsTab) {
        setSettingsTab(currentStep.settingsTab);
      }
    }
  }, [
    closeAllDetails,
    closeRightPanel,
    currentStep,
    openRightPanel,
    requestChatModeShortcut,
    setActiveChatId,
    setSettingsTab,
    setSidebarOpen,
  ]);

  // Track the target element position (handles resize/scroll)
  const lastSpotlightRectsRef = useRef<SpotlightRect[]>([]);
  const updateRect = useCallback(() => {
    if (isMobileViewport || !currentStep?.target) {
      if (lastSpotlightRectsRef.current.length > 0) {
        lastSpotlightRectsRef.current = [];
        setSpotlightRects([]);
      }
      return;
    }
    const nextRects = [currentStep.target, ...(currentStep.highlightTargets ?? [])]
      .map(getTargetRect)
      .filter((rect): rect is SpotlightRect => rect !== null);
    if (!spotlightRectsMatch(lastSpotlightRectsRef.current, nextRects)) {
      lastSpotlightRectsRef.current = nextRects;
      setSpotlightRects(nextRects);
    }
    rafRef.current = requestAnimationFrame(updateRect);
  }, [currentStep?.highlightTargets, currentStep?.target, isMobileViewport]);

  useEffect(() => {
    updateRect();
    return () => cancelAnimationFrame(rafRef.current);
  }, [updateRect]);

  const finish = useCallback(() => {
    setCompleted(true);
    trackAchievement.mutate("tutorial_completed");
  }, [setCompleted, trackAchievement]);

  // "Get Started" on the final step commits the docs-language pick; Skip never does.
  const next = useCallback(() => {
    if (isLast) {
      commitDocsLanguage();
      finish();
    } else {
      setStep((s) => s + 1);
    }
  }, [isLast, commitDocsLanguage, finish]);

  const isCentered = isMobileViewport || currentStep.centerCard || !currentStep.target || !targetRect;
  const centeredTopOffset = getTutorialTopOffset();
  const centeredCardMaxHeight = Math.max(220, getViewportHeight() - centeredTopOffset - 16);

  const pickerSlot = currentStep.docsLanguagePicker ? (
    <div className="mb-4 flex flex-col gap-3 text-left">
      <button
        type="button"
        onClick={() => useUIStore.getState().openModal("docs-viewer")}
        className={TUTORIAL_DOCUMENTATION_BUTTON_CLASS}
        title={localizeUi("home.actions.documentationHelp")}
      >
        <BookOpen size="1rem" />
        {localizeUi("home.actions.documentation")}
      </button>
      <label
        htmlFor="onboarding-docs-language"
        className="text-[0.6875rem] font-medium text-[var(--marinara-chat-chrome-panel-text)]"
      >
        {localizeUi("settings.application.docsLanguage.label")}
      </label>
      <select
        id="onboarding-docs-language"
        value={effectiveDocsLanguagePick}
        onChange={(event) => setDocsLanguagePick(event.target.value)}
        className="w-full rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-3 py-2 text-xs text-[var(--marinara-chat-chrome-panel-text)] outline-none focus:ring-1 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
      >
        {(docsLanguageOptions.length > 0 ? docsLanguageOptions : [{ code: "en", label: "English" }]).map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  ) : undefined;

  return (
    <div className="mari-chrome-token-scope pointer-events-none fixed inset-0 z-[9999]">
      {/* Pulsing highlight rings around the current target elements */}
      {!isMobileViewport &&
        spotlightRects.map((rect) => (
          <div
            key={rect.target}
            data-component="OnboardingTutorial.Spotlight"
            data-tour-target={rect.target}
            className="pointer-events-none fixed animate-pulse rounded-xl ring-2 ring-[var(--marinara-chat-chrome-focus-ring)]"
            style={{
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              boxShadow:
                "0 0 16px 4px color-mix(in srgb, var(--marinara-chat-chrome-focus-ring) 40%, transparent)",
            }}
          />
        ))}

      {/* Centered steps use a flex wrapper so Framer Motion transforms don't override CSS centering */}
      {isCentered ? (
        <div
          data-component="OnboardingTutorial.CenteredStage"
          className="pointer-events-none fixed inset-x-0 bottom-3 flex items-center justify-center px-3"
          style={{ top: centeredTopOffset }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={TUTORIAL_CARD_CLASS}
              data-component="OnboardingTutorial.Card"
              style={{ width: Math.min(380, getViewportWidth() - 32), maxHeight: centeredCardMaxHeight }}
            >
              <TourCardContent step={step} currentStep={currentStep} isLast={isLast} onNext={next} onSkip={finish} pickerSlot={pickerSlot} />
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className={TUTORIAL_CARD_CLASS}
            data-component="OnboardingTutorial.Card"
            style={computeTooltipStyle(targetRect!, currentStep)}
          >
            <TourCardContent step={step} currentStep={currentStep} isLast={isLast} onNext={next} onSkip={finish} pickerSlot={pickerSlot} />
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
