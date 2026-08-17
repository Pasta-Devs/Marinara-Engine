// ──────────────────────────────────────────────
// Game Tutorial — spotlight tour of the game UI
// Auto-opens on the user's first game; re-openable via the (?) button
// in the top-right game controls. Users can permanently disable it.
// ──────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, CircleHelp, X } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  NEUTRAL_PANEL_HEADER,
  NEUTRAL_PANEL_SCROLL_AREA,
  NEUTRAL_PANEL_SHELL,
  NEUTRAL_PANEL_SUBTITLE,
  NEUTRAL_PANEL_TITLE,
} from "../ui/neutral-surface-styles";
import { useTranslation as useUiTranslation } from "react-i18next";

// ─── Step definitions ─────────────────────────

interface GameTutorialStep {
  target: "game-map" | "game-party" | "game-controls" | "game-dialogue";
  title: string;
  body: string;
  side: "top" | "bottom" | "left" | "right";
  sprite?: { src: string; flip?: boolean };
}

const STEPS: GameTutorialStep[] = [
  {
    target: "game-map",
    title: "Your Map",
    body: "This is the map of your current location. When it's your turn to act, you can click on one of the nodes to travel to the selected spot.",
    side: "right",
    sprite: { src: "/sprites/mari/Mari_point_middle_left.png" },
  },
  {
    target: "game-party",
    title: "Your Party",
    body: "This is your party. Click the portraits to inspect their character cards.",
    side: "bottom",
    sprite: { src: "/sprites/mari/Mari_point_up_left.png" },
  },
  {
    target: "game-controls",
    title: "Control Panel",
    body: "This is the control panel. Open the tutorial, view your history, end the session, view your journal, control the sound volume, open the gallery, re-try generations, and access settings here.",
    side: "left",
    sprite: { src: "/sprites/mari/Mari_point_up_left.png", flip: true },
  },
  {
    target: "game-dialogue",
    title: "Narration & Input",
    body: "This is where the narrative happens. Access old messages from logs, proceed by clicking the auto-play/next buttons. When it's your time to act, you will be presented with an input box. You may choose whether to address your party specifically or the GM in general. Have fun!",
    side: "top",
    sprite: { src: "/sprites/mari/Mari_explaining.png" },
  },
];

// ─── Spotlight helpers ────────────────────────

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;
const TOPBAR_SAFE_TOP = 64;
const TUTORIAL_ICON_BUTTON =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] text-[var(--marinara-chat-chrome-button-text)] transition-colors hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] hover:text-[var(--marinara-chat-chrome-highlight-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]";
const TUTORIAL_SECONDARY_BUTTON =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] px-3 text-xs font-medium text-[var(--marinara-chat-chrome-button-text)] transition-colors hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]";
const TUTORIAL_PRIMARY_BUTTON =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] px-3.5 text-xs font-semibold text-[var(--marinara-chat-chrome-button-text-active)] transition-colors hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]";

function getTargetRect(target: string): Rect | null {
  // Pick the first visible element matching the selector. This handles cases
  // where both a mobile and desktop variant of the target exist in the DOM
  // but only one is rendered via md: breakpoints.
  const els = document.querySelectorAll(`[data-tour="${target}"]`);
  for (const el of Array.from(els)) {
    const r = (el as HTMLElement).getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    }
  }
  return null;
}

function computeTooltipStyle(rect: Rect, side: "top" | "bottom" | "left" | "right"): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isMobile = vw < 640;
  const VIEWPORT_MARGIN = isMobile ? 12 : 16;
  const SAFE_TOP = Math.max(VIEWPORT_MARGIN, TOPBAR_SAFE_TOP);
  const TOOLTIP_W = isMobile ? Math.min(vw - VIEWPORT_MARGIN * 2, 340) : Math.min(340, vw - VIEWPORT_MARGIN * 2);
  const GAP = isMobile ? 12 : 16;
  const available = {
    right: vw - (rect.left + rect.width + GAP + PAD) - VIEWPORT_MARGIN,
    left: rect.left - GAP - PAD - VIEWPORT_MARGIN,
    bottom: vh - (rect.top + rect.height + GAP + PAD) - VIEWPORT_MARGIN,
    top: rect.top - GAP - PAD - SAFE_TOP,
  };

  if (isMobile) {
    // On mobile the game UI is cramped: pin the card to the top or bottom edge
    // of the viewport (whichever side is opposite the highlighted element) so
    // the spotlight stays visible and the tooltip never overlaps the target.
    const targetMid = rect.top + rect.height / 2;
    const placeAtBottom = targetMid < vh / 2; // target is in upper half → card goes to bottom
    const MARGIN = 12;
    if (placeAtBottom) {
      const top = rect.top + rect.height + GAP + PAD;
      const safeTop = Math.max(top, SAFE_TOP);
      const maxHeight = vh - safeTop - MARGIN;
      return {
        position: "fixed",
        top: safeTop,
        left: (vw - TOOLTIP_W) / 2,
        width: TOOLTIP_W,
        maxHeight: `${Math.max(200, maxHeight)}px`,
        overflowY: "auto",
        overflowX: "hidden",
        overscrollBehavior: "contain",
      };
    }
    // Target is in the lower half (e.g. the dialogue box) → anchor card at top
    const bottomLimit = rect.top - GAP - PAD;
    const maxHeight = Math.max(200, bottomLimit - SAFE_TOP);
    return {
      position: "fixed",
      top: SAFE_TOP,
      left: (vw - TOOLTIP_W) / 2,
      width: TOOLTIP_W,
      maxHeight: `${maxHeight}px`,
      overflowY: "auto",
      overflowX: "hidden",
      overscrollBehavior: "contain",
    };
  }

  const minScrollableHeight = 220;
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
    maxHeight = Math.max(minScrollableHeight, vh - SAFE_TOP - VIEWPORT_MARGIN);
    top = rect.top + rect.height / 2 - maxHeight / 2;
    left = rect.left + rect.width + GAP + PAD;
    if (left + TOOLTIP_W > vw - VIEWPORT_MARGIN) {
      left = rect.left - TOOLTIP_W - GAP - PAD;
    }
  } else if (placement === "left") {
    maxHeight = Math.max(minScrollableHeight, vh - SAFE_TOP - VIEWPORT_MARGIN);
    top = rect.top + rect.height / 2 - maxHeight / 2;
    left = rect.left - TOOLTIP_W - GAP - PAD;
    if (left < VIEWPORT_MARGIN) {
      left = rect.left + rect.width + GAP + PAD;
    }
  } else if (placement === "bottom") {
    maxHeight = Math.max(minScrollableHeight, Math.min(vh - SAFE_TOP - VIEWPORT_MARGIN, available.bottom));
    top = rect.top + rect.height + GAP + PAD;
    left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
  } else {
    maxHeight = Math.max(minScrollableHeight, Math.min(vh - SAFE_TOP - VIEWPORT_MARGIN, available.top));
    top = rect.top - GAP - PAD - maxHeight;
    left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    if (top < VIEWPORT_MARGIN) {
      top = rect.top + rect.height + GAP + PAD;
    }
  }

  left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - TOOLTIP_W - VIEWPORT_MARGIN));
  top = Math.max(SAFE_TOP, Math.min(top, vh - maxHeight - VIEWPORT_MARGIN));

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

// ─── Card content ─────────────────────────────

function TutorialCard({
  step,
  stepData,
  isLast,
  onNext,
  onSkip,
}: {
  step: number;
  stepData: GameTutorialStep;
  isLast: boolean;
  onNext: () => void;
  onSkip: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="flex min-h-0 flex-col">
      <div className={cn(NEUTRAL_PANEL_HEADER, "flex items-center justify-between gap-3 px-3 py-2.5")}>
        <div className="min-w-0">
          <div className={NEUTRAL_PANEL_TITLE}>
            <CircleHelp size="0.8rem" className="shrink-0 text-[var(--marinara-chat-chrome-button-text-active)]" />
            <span className="truncate">{localizeUi("ui.game.tutorialcard.gameTutorial")}</span>
          </div>
          <div className={NEUTRAL_PANEL_SUBTITLE}>
            {localizeUi("ui.game.tutorialcard.step")} {step + 1} {localizeUi("ui.noodle.noodlehome.of")} {STEPS.length}
          </div>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className={TUTORIAL_ICON_BUTTON}
          title={localizeUi("ui.game.tutorialcard.closeTutorial")}
        >
          <X size={14} />
        </button>
      </div>

      <div className={cn(NEUTRAL_PANEL_SCROLL_AREA, "min-h-0 overflow-y-auto p-3")}>
        {stepData.sprite && (
          <div className="mb-3 flex justify-center">
            <img
              src={stepData.sprite.src}
              alt={localizeUi("ui.game.tutorialcard.professorMari")}
              className={cn(
                "h-20 max-h-[12vh] w-auto object-contain drop-shadow-lg sm:h-28 sm:max-h-[14vh]",
                stepData.sprite.flip && "-scale-x-100",
              )}
              draggable={false}
            />
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold leading-tight text-[var(--marinara-chat-chrome-panel-title)]">
            {stepData.title}
          </h3>
          <p className="break-words text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
            {stepData.body.split("\n").map((line, i, arr) => (
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
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                i === step
                  ? "w-4 bg-[var(--marinara-chat-chrome-button-text-active)]"
                  : i < step
                    ? "w-2 bg-[var(--marinara-chat-chrome-button-text-active)]/45"
                    : "w-2 bg-[var(--marinara-chat-chrome-panel-muted)]/25",
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--marinara-chat-chrome-panel-divider)] px-3 py-2.5">
        <button type="button" onClick={onSkip} className={TUTORIAL_SECONDARY_BUTTON}>
          {localizeUi("onboarding.actions.skip")}
        </button>
        <button type="button" onClick={onNext} className={TUTORIAL_PRIMARY_BUTTON}>
          {isLast ? localizeUi("ui.game.tutorialcard.gotIt") : localizeUi("onboarding.actions.next")}
          {!isLast && <ChevronRight size="0.75rem" />}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────

interface GameTutorialProps {
  open: boolean;
  onClose: () => void;
}

export function GameTutorial({ open, onClose }: GameTutorialProps) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const rafRef = useRef<number>(0);
  const lastRectRef = useRef<Rect | null>(null);

  const stepData = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Reset to step 0 each time the tutorial opens
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const updateRect = useCallback(() => {
    if (!open || !stepData) {
      return;
    }
    const r = getTargetRect(stepData.target);
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
  }, [open, stepData]);

  useEffect(() => {
    if (!open) return;
    updateRect();
    return () => cancelAnimationFrame(rafRef.current);
  }, [open, updateRect]);

  const next = useCallback(() => {
    if (isLast) {
      onClose();
    } else {
      setStep((s) => s + 1);
    }
  }, [isLast, onClose]);

  if (!open || !stepData) return null;

  if (typeof document === "undefined") return null;

  const overlay = (
    <div className="mari-chrome-token-scope pointer-events-none fixed inset-0 z-[9999]">
      {/* Pulsing highlight around target */}
      {targetRect && (
        <div
          className="pointer-events-none fixed animate-pulse rounded-xl ring-2 ring-[var(--marinara-chat-chrome-focus-ring)]"
          style={{
            top: targetRect.top - PAD,
            left: targetRect.left - PAD,
            width: targetRect.width + PAD * 2,
            height: targetRect.height + PAD * 2,
            boxShadow: "0 0 16px 4px color-mix(in srgb, var(--marinara-chat-chrome-focus-ring) 40%, transparent)",
          }}
        />
      )}

      {targetRect ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className={cn(NEUTRAL_PANEL_SHELL, "pointer-events-auto flex min-h-0 flex-col overflow-hidden")}
            style={computeTooltipStyle(targetRect, stepData.side)}
          >
            <TutorialCard step={step} stepData={stepData} isLast={isLast} onNext={next} onSkip={onClose} />
          </motion.div>
        </AnimatePresence>
      ) : (
        // Fallback: target not yet measurable — show a centered card so the tour
        // still works even if a region is momentarily hidden.
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 flex items-center justify-center"
          style={{ top: TOPBAR_SAFE_TOP }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                NEUTRAL_PANEL_SHELL,
                "pointer-events-auto flex max-h-[90vh] min-h-0 flex-col overflow-hidden",
              )}
              style={{ width: Math.min(380, window.innerWidth - 32) }}
            >
              <TutorialCard step={step} stepData={stepData} isLast={isLast} onNext={next} onSkip={onClose} />
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
