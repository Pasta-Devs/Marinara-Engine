// ──────────────────────────────────────────────
// Onboarding Tutorial — first-time guided tour
// ──────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";
import { useUIStore, type ChatModeShortcut } from "../../stores/ui.store";
import { useTrackAchievement } from "../../hooks/use-achievements";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";

// ─── Step definitions ─────────────────────────

type TourPanel =
  | "bot-browser"
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
  title: string;
  body: string;
  /** Preferred side for the tooltip relative to the highlighted element */
  side?: "top" | "bottom" | "left" | "right";
  /** Right-side panel to open while this step is active */
  openPanel?: TourPanel;
  /** Chat sidebar mode tab to open while this step is active */
  chatMode?: ChatModeShortcut;
  /** Open the chat sidebar without changing its mode */
  openSidebar?: boolean;
  /** Optional settings tab to show when the Settings panel is open */
  settingsTab?: string;
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
    target: "panel-bot-browser",
    title: "Browser",
    body: "The Browser allows you to browse and import downloadable character cards and resources. Start here when you want new characters or ready-made material to bring into your library.",
    side: "bottom",
    openPanel: "bot-browser",
    sprite: { src: "/sprites/mari/Mari_point_up_left.png", flip: true },
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
    body: "Agents work alongside the main model to provide additional functionality on top of chats. They can track state, retrieve knowledge, process messages, trigger images, guide story events, and more depending on what you enable.",
    side: "bottom",
    openPanel: "agents",
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
    target: "panel-settings",
    title: "Settings",
    body: "Settings control the whole app: appearance, behavior, imports, themes, image defaults, notifications, extensions, data tools, and other global preferences.",
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
    body: "Game mode turns the chat into a visual novel RPG-style adventure with an AI Game Master. Sit back and enjoy the game, having party members, goals, maps, dice rolls, session history, journals, combat, and custom HUD widgets.",
    side: "right",
    chatMode: "game",
    sprite: { src: "/sprites/mari/Mari_point_middle_left.png" },
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
    body: "I'm available from the Home page whenever you need help. For your first real step, set up a Connection. After that, try creating a new chat. Don't worry, I will be there to guide you. Thank you for trying Marinara Engine. Have fun, and please report bugs or rough edges through our Discord or GitHub so we can keep improving it.",
    side: "bottom",
    openPanel: "connections",
    sprite: { src: "/sprites/mari/Mari_greet.png" },
  },
];

// ─── Spotlight overlay helpers ────────────────

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8; // px padding around the spotlight cutout
const MOBILE_BREAKPOINT = 640;
const TOPBAR_FALLBACK_HEIGHT = 48;
const TUTORIAL_TOP_GAP = 12;
const TUTORIAL_DESKTOP_WIDTH = 340;

function getTargetRect(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
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

function _buildClipPath(rect: Rect): string {
  const t = Math.max(0, rect.top - PAD);
  const l = Math.max(0, rect.left - PAD);
  const b = rect.top + rect.height + PAD;
  const r = rect.left + rect.width + PAD;
  const rad = 12; // border-radius in px for the cutout
  // Use inset with round for a nice cutout
  return `polygon(
    0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
    ${l}px ${t + rad}px,
    ${l + rad}px ${t}px,
    ${r - rad}px ${t}px,
    ${r}px ${t + rad}px,
    ${r}px ${b - rad}px,
    ${r - rad}px ${b}px,
    ${l + rad}px ${b}px,
    ${l}px ${b - rad}px,
    ${l}px ${t + rad}px
  )`;
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
}: {
  step: number;
  currentStep: TourStep;
  isLast: boolean;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      {/* Professor Mari sprite */}
      {currentStep.sprite && (
        <div className="mb-2 flex justify-center">
          <img
            src={currentStep.sprite.src}
            alt="Professor Mari"
            className="h-32 max-h-[15vh] w-auto object-contain drop-shadow-lg"
            style={currentStep.sprite.flip ? { transform: "scaleX(-1)" } : undefined}
            draggable={false}
          />
        </div>
      )}

      {/* Header */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{currentStep.title}</h3>
      </div>

      {/* Body */}
      <p className="mb-4 break-words text-xs leading-relaxed text-[var(--muted-foreground)]">
        {currentStep.body.split("\n").map((line, i, arr) => (
          <span key={i}>
            {line.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j} className="font-semibold text-[var(--foreground)]">
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

      {/* Progress dots */}
      <div className="mb-3 flex items-center justify-center gap-1.5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step
                ? "w-4 bg-[var(--primary)]"
                : i < step
                  ? "w-1.5 bg-[var(--primary)]/40"
                  : "w-1.5 bg-[var(--muted-foreground)]/20"
            }`}
          />
        ))}
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={onSkip}
          className="rounded-lg px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
        >
          {step === 0 ? "Skip Tutorial" : "Skip"}
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-1.5 text-xs font-medium text-[var(--primary-foreground)] shadow-sm transition-all hover:opacity-90 active:scale-95"
        >
          {isLast ? "Get Started" : "Next"}
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
  const setSettingsTab = useUIStore((s) => s.setSettingsTab);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const requestChatModeShortcut = useUIStore((s) => s.requestChatModeShortcut);
  const trackAchievement = useTrackAchievement();

  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(() => getViewportWidth() < MOBILE_BREAKPOINT);
  const rafRef = useRef<number>(0);

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  useEffect(() => {
    const updateViewportMode = () => setIsMobileViewport(getViewportWidth() < MOBILE_BREAKPOINT);
    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);
    return () => window.removeEventListener("resize", updateViewportMode);
  }, []);

  // ── Side-effects when step changes ──
  useEffect(() => {
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
  }, [closeRightPanel, currentStep, openRightPanel, requestChatModeShortcut, setSettingsTab, setSidebarOpen]);

  // Track the target element position (handles resize/scroll)
  const lastRectRef = useRef<Rect | null>(null);
  const updateRect = useCallback(() => {
    if (isMobileViewport || !currentStep?.target) {
      if (lastRectRef.current !== null) {
        lastRectRef.current = null;
        setTargetRect(null);
      }
      return;
    }
    const r = getTargetRect(currentStep.target);
    // Only update state if the rect actually changed
    const prev = lastRectRef.current;
    if (!r && prev) {
      lastRectRef.current = null;
      setTargetRect(null);
    } else if (
      r &&
      (!prev || r.top !== prev.top || r.left !== prev.left || r.width !== prev.width || r.height !== prev.height)
    ) {
      lastRectRef.current = r;
      setTargetRect(r);
    }
    rafRef.current = requestAnimationFrame(updateRect);
  }, [currentStep?.target, isMobileViewport]);

  useEffect(() => {
    updateRect();
    return () => cancelAnimationFrame(rafRef.current);
  }, [updateRect]);

  const finish = useCallback(() => {
    setCompleted(true);
    trackAchievement.mutate("tutorial_completed");
  }, [setCompleted, trackAchievement]);

  const next = useCallback(() => {
    if (isLast) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  }, [isLast, finish]);

  const isCentered = isMobileViewport || !currentStep.target || !targetRect;
  const centeredTopOffset = getTutorialTopOffset();
  const centeredCardMaxHeight = Math.max(220, getViewportHeight() - centeredTopOffset - 16);

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      {/* Pulsing highlight ring around the target element */}
      {!isMobileViewport && targetRect && (
        <div
          className="pointer-events-none fixed rounded-xl ring-2 ring-[var(--primary)] animate-pulse"
          style={{
            top: targetRect.top - PAD,
            left: targetRect.left - PAD,
            width: targetRect.width + PAD * 2,
            height: targetRect.height + PAD * 2,
            boxShadow: "0 0 16px 4px color-mix(in srgb, var(--primary) 40%, transparent)",
          }}
        />
      )}

      {/* Centered steps use a flex wrapper so Framer Motion transforms don't override CSS centering */}
      {isCentered ? (
        <div
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
              className="pointer-events-auto overflow-x-hidden overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--popover)] p-5 shadow-2xl ring-1 ring-[var(--primary)]/20"
              style={{ width: Math.min(380, getViewportWidth() - 32), maxHeight: centeredCardMaxHeight }}
            >
              <TourCardContent step={step} currentStep={currentStep} isLast={isLast} onNext={next} onSkip={finish} />
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
            className="pointer-events-auto rounded-2xl border border-[var(--border)] bg-[var(--popover)] p-5 shadow-2xl ring-1 ring-[var(--primary)]/20"
            style={computeTooltipStyle(targetRect!, currentStep)}
          >
            <TourCardContent step={step} currentStep={currentStep} isLast={isLast} onNext={next} onSkip={finish} />
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
