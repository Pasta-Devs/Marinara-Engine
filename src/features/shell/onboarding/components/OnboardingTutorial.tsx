// ──────────────────────────────────────────────
// Onboarding Tutorial — first-time guided tour
// ──────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ArrowRightLeft } from "lucide-react";

// ─── Step definitions ─────────────────────────

interface TourStep {
  /** data-tour attribute value of the element to highlight, or null for centered modal */
  target: string | null;
  title: string;
  body: string;
  /** Preferred side for the tooltip relative to the highlighted element */
  side?: "top" | "bottom" | "left" | "right";
  /** If set, show a special action button with this label */
  actionLabel?: string;
  /** Key used internally to trigger special step actions */
  actionKey?: string;
  /** Professor Mari sprite to display */
  sprite?: { src: string; flip?: boolean };
}

interface OnboardingTutorialProps {
  onShellInertResync: () => void;
}

const STEPS: TourStep[] = [
  {
    target: null,
    title: "Welcome to Marinara Engine!",
    body: "Howdy! Here's a quick tutorial to show you around. Confident in your skill? Feel free to skip it!\n\n**Warning:** skipping the tutorial will make me cry.",
    sprite: { src: "/sprites/mari/Mari_wave.png" },
  },
  {
    target: "sidebar-toggle",
    title: "Chats Sidebar",
    body: "This is where all your conversations live. Create new chats, search through them, and organize your history. You can have as many chats as you want!",
    side: "right",
    sprite: { src: "/sprites/mari/Mari_point_middle_left.png" },
  },
  {
    target: "panel-buttons",
    title: "Tab Buttons",
    body: "These buttons (from left to right) open panels for:\n- **Browser:** browse for downloadable cards and more,\n- **Characters:** view and manage all your character cards,\n- **Lorebooks:** lorebooks with all the information you want,\n- **Presets:** section for prompts,\n- **Connections:** Set up your API connection here,\n- **Agents:** Think of them as extensions to your chats, each agent does something atop your main conversation, e.g., tracks details, creates images, etc.,\n- **Persona:** personas you play as,\n- **Settings:** settings for the entire application.\n\nCheck them all out!",
    side: "bottom",
    sprite: { src: "/sprites/mari/Mari_point_up_left.png", flip: true },
  },
  {
    target: "chat-area",
    title: "Chat Area",
    body: "This is your main workspace, where you chat with AI characters, enjoy roleplay, and read generated stories. Messages appear here in real time.",
    side: "left",
    sprite: { src: "/sprites/mari/Mari_point_middle_left.png" },
  },
  {
    target: null,
    title: "Three Ways to Chat",
    body: "Marinara Engine has three chat modes:\n\n**Conversation:** Like Discord DMs. Casual texting, character schedules, statuses, and autonomous messaging. Great for slice-of-life and hanging out.\n\n**Roleplay:** Creative writing and storytelling. Rich narration, AI agents that handle tracking, narrative, and more. Perfect for adventures and immersive stories.\n\n**Game:** An RPG-flavored visual novel layer on top of your story, directed by an AI Game Master. Visual effects, tactical combat, party management, a developed plot line, and more. The most immersive experience out of all the available ones.\n\nUpon selecting any of these options, you will be presented with a setup wizard, so don't worry about anything, we'll guide you through the process step by step!",
    sprite: { src: "/sprites/mari/Mari_explaining.png" },
  },
  {
    target: null,
    title: "Meet Professor Mari!",
    body: "That's Professor Mari. She lives in her own screen now, separate from chats and modes. Use the Mari button in the title bar whenever you want to open that assistant space.",
    sprite: { src: "/sprites/mari/Mari_greet.png" },
  },
  {
    target: null,
    title: "Set Up a Connection",
    body: "Before you start chatting, you'll need to connect an AI provider. Click the chain-link icon (🔗) in the top-right tab buttons, then add your API key for OpenAI, Anthropic, or another provider.",
    sprite: { src: "/sprites/mari/Mari_explaining.png" },
  },
  {
    target: null,
    title: "Importing from SillyTavern?",
    body: "If you have characters, chats, or presets from SillyTavern, you can import them all in one go from the Settings panel.",
    actionLabel: "Take Me There",
    actionKey: "import",
    sprite: { src: "/sprites/mari/Mari_thinking.png" },
  },
  {
    target: null,
    title: "You're All Set!",
    body: "Look for the (?) icons throughout the app. Hover over them at any time to learn what each option does. Have fun exploring!\n\nAnd if you have any further questions, need help, or want to report a bug, feel free to join our Discord server! You can find the invite link on the home page.",
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
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.closest("[inert]")) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

function setInert(element: Element, inert: boolean) {
  element.toggleAttribute("inert", inert);
  (element as HTMLElement & { inert?: boolean }).inert = inert;
}

interface InertSnapshot {
  element: Element;
  hadInertAttribute: boolean;
  inertProperty: boolean;
}

function applyShellInertExceptTutorial(root: HTMLElement): () => void {
  const shell = root.closest('[data-component="AppShell"]');
  if (!shell) return () => {};

  const snapshots: InertSnapshot[] = [];
  const inertedElements = new Set<Element>();

  const apply = (element: Element) => {
    if (inertedElements.has(element)) return;
    inertedElements.add(element);
    snapshots.push({
      element,
      hadInertAttribute: element.hasAttribute("inert"),
      inertProperty: Boolean((element as HTMLElement & { inert?: boolean }).inert),
    });
    setInert(element, true);
  };

  const applyOutsideRoot = (element: Element) => {
    if (element === root || root.contains(element)) return;

    if (element.contains(root)) {
      for (const child of Array.from(element.children)) {
        applyOutsideRoot(child);
      }
      return;
    }

    apply(element);
  };

  for (const child of Array.from(shell.children)) {
    applyOutsideRoot(child);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof Element) applyOutsideRoot(node);
      }
    }
  });
  observer.observe(shell, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    for (const { element, hadInertAttribute, inertProperty } of snapshots) {
      if (hadInertAttribute) {
        element.setAttribute("inert", "");
      } else {
        element.removeAttribute("inert");
      }
      (element as HTMLElement & { inert?: boolean }).inert = inertProperty;
    }
  };
}

function isVisibleTourTarget(element: Element) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function getTargetRect(target: string): Rect | null {
  const matches = Array.from(document.querySelectorAll(`[data-tour="${target}"]`));
  const el = matches.find(isVisibleTourTarget) ?? matches[0];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

// ─── Tooltip position ─────────────────────────

function computeTooltipStyle(rect: Rect, side: "top" | "bottom" | "left" | "right" = "right"): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isMobile = vw < 640;
  const VIEWPORT_MARGIN = isMobile ? 12 : 16;
  const TOOLTIP_W = isMobile ? Math.min(vw - VIEWPORT_MARGIN * 2, 320) : Math.min(320, vw - VIEWPORT_MARGIN * 2);
  const GAP = isMobile ? 8 : 16;
  const available = {
    right: vw - (rect.left + rect.width + GAP + PAD) - VIEWPORT_MARGIN,
    left: rect.left - GAP - PAD - VIEWPORT_MARGIN,
    bottom: vh - (rect.top + rect.height + GAP + PAD) - VIEWPORT_MARGIN,
    top: rect.top - GAP - PAD - VIEWPORT_MARGIN,
  };

  // On small screens, always center horizontally and position below target
  if (isMobile) {
    const top = Math.min(rect.top + rect.height + GAP + PAD, vh * 0.55);
    return {
      position: "fixed",
      top,
      left: (vw - TOOLTIP_W) / 2,
      width: TOOLTIP_W,
      maxHeight: `${Math.max(200, vh - top - VIEWPORT_MARGIN)}px`,
      overflowY: "auto" as const,
      overflowX: "hidden" as const,
      overscrollBehavior: "contain" as const,
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
    maxHeight = Math.max(minScrollableHeight, vh - VIEWPORT_MARGIN * 2);
    top = rect.top + rect.height / 2 - maxHeight / 2;
    left = rect.left + rect.width + GAP + PAD;
    if (left + TOOLTIP_W > vw - VIEWPORT_MARGIN) {
      left = rect.left - TOOLTIP_W - GAP - PAD;
    }
  } else if (placement === "left") {
    maxHeight = Math.max(minScrollableHeight, vh - VIEWPORT_MARGIN * 2);
    top = rect.top + rect.height / 2 - maxHeight / 2;
    left = rect.left - TOOLTIP_W - GAP - PAD;
    if (left < VIEWPORT_MARGIN) {
      left = rect.left + rect.width + GAP + PAD;
    }
  } else if (placement === "bottom") {
    maxHeight = Math.max(minScrollableHeight, Math.min(vh - VIEWPORT_MARGIN * 2, available.bottom));
    top = rect.top + rect.height + GAP + PAD;
    left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
  } else {
    maxHeight = Math.max(minScrollableHeight, Math.min(vh - VIEWPORT_MARGIN * 2, available.top));
    top = rect.top - GAP - PAD - maxHeight;
    left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
  }

  // Clamp within viewport
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - TOOLTIP_W - VIEWPORT_MARGIN));
  top = Math.max(VIEWPORT_MARGIN, Math.min(top, vh - maxHeight - VIEWPORT_MARGIN));

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
  onAction,
}: {
  step: number;
  currentStep: TourStep;
  isLast: boolean;
  onNext: () => void;
  onSkip: () => void;
  onAction?: (key: string) => void;
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

      {/* Action button */}
      {currentStep.actionLabel && currentStep.actionKey && onAction && (
        <button
          onClick={() => onAction(currentStep.actionKey!)}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-4 py-2 text-xs font-medium text-[var(--primary)] transition-all hover:bg-[var(--primary)]/20 active:scale-[0.98]"
        >
          <ArrowRightLeft size="0.8125rem" />
          {currentStep.actionLabel}
        </button>
      )}

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

export function OnboardingTutorial({ onShellInertResync }: OnboardingTutorialProps) {
  const hasCompleted = useUIStore((s) => s.hasCompletedOnboarding);
  if (hasCompleted) return null;
  return <OnboardingTutorialInner onShellInertResync={onShellInertResync} />;
}

function OnboardingTutorialInner({ onShellInertResync }: OnboardingTutorialProps) {
  const setCompleted = useUIStore((s) => s.setHasCompletedOnboarding);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const setSettingsTab = useUIStore((s) => s.setSettingsTab);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const rafRef = useRef<number>(0);
  const prevStepRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onShellInertResyncRef = useRef(onShellInertResync);
  onShellInertResyncRef.current = onShellInertResync;

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Set activeChatId without persisting to localStorage (demo-only)
  const setDemoChatActive = useCallback((id: string | null) => {
    useChatStore.setState({
      activeChatId: id,
      swipeIndex: new Map(),
      ...(!id && { activeChat: null }),
    });
  }, []);

  // ── Side-effects when step changes ──
  useEffect(() => {
    const prev = prevStepRef.current;
    prevStepRef.current = step;

    // Step 1 (sidebar): open sidebar on enter
    if (step === 1) {
      setSidebarOpen(true);
    }
    // Leaving step 1: close sidebar
    if (prev === 1 && step !== 1) {
      setSidebarOpen(false);
    }

    // Leaving step 3: deselect any demo chat.
    if (prev === 3 && step !== 3) {
      setDemoChatActive(null);
    }
  }, [step, setSidebarOpen, setDemoChatActive]);

  // Cleanup on unmount: deselect any demo chat.
  useEffect(() => {
    return () => {
      useChatStore.setState({ activeChatId: null, activeChat: null, swipeIndex: new Map() });
    };
  }, []);

  // Track the target element position (handles resize/scroll)
  const lastRectRef = useRef<Rect | null>(null);
  const updateRect = useCallback(() => {
    if (!currentStep?.target) {
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
  }, [currentStep?.target]);

  useEffect(() => {
    updateRect();
    return () => cancelAnimationFrame(rafRef.current);
  }, [updateRect]);

  const finish = useCallback(() => setCompleted(true), [setCompleted]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const restoreShellInert = applyShellInertExceptTutorial(root);

    const focusFirstControl = () => {
      if (!root.contains(document.activeElement)) {
        const [firstFocusable] = getFocusableElements(root);
        (firstFocusable ?? root).focus();
      }
    };

    const frame = window.requestAnimationFrame(focusFirstControl);

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(root);
      if (focusable.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (!root.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && root.contains(event.target)) return;
      const [firstFocusable] = getFocusableElements(root);
      (firstFocusable ?? root).focus();
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", handleFocusIn, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      restoreShellInert();
      onShellInertResyncRef.current();
      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const handleAction = useCallback(
    (key: string) => {
      if (key === "import") {
        openRightPanel("settings");
        setSettingsTab("import");
        // Jump to last step instead of finishing
        setStep(STEPS.length - 1);
        return;
      }

    },
    [openRightPanel, setSettingsTab],
  );

  const next = useCallback(() => {
    if (isLast) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  }, [isLast, finish]);

  const isCentered = !currentStep.target || !targetRect;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Onboarding tutorial"
      aria-modal="true"
      tabIndex={-1}
      className="pointer-events-none fixed inset-0 z-[9999]"
    >
      {/* Pulsing highlight ring around the target element */}
      {targetRect && (
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
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto rounded-2xl border border-[var(--border)] bg-[var(--popover)] p-5 shadow-2xl ring-1 ring-[var(--primary)]/20 max-h-[90vh] overflow-x-hidden overflow-y-auto"
              style={{ width: Math.min(380, window.innerWidth - 32) }}
            >
              <TourCardContent
                step={step}
                currentStep={currentStep}
                isLast={isLast}
                onNext={next}
                onSkip={finish}
                onAction={handleAction}
              />
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
            style={computeTooltipStyle(targetRect!, currentStep.side)}
          >
            <TourCardContent
              step={step}
              currentStep={currentStep}
              isLast={isLast}
              onNext={next}
              onSkip={finish}
              onAction={handleAction}
            />
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
