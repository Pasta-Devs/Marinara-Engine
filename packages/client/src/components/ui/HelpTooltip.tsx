// ──────────────────────────────────────────────
// Reusable help tooltip — hover or click/tap ? icon to see explanation
// ──────────────────────────────────────────────
import { useState, useRef, useLayoutEffect, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import { localizeStringNode, useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { useTranslation as useUiTranslation } from "react-i18next";

// Only one tooltip is open at a time: opening one closes whichever was open, so
// hovering/opening a second tooltip dismisses the first instead of stacking.
let activeTooltipClose: (() => void) | null = null;

interface HelpTooltipProps {
  /** The help content to display */
  text: ReactNode;
  /** Optional visible label shown before the help icon */
  label?: string;
  /** Optional size of the icon (default "0.75rem") */
  size?: string | number;
  /** Preferred position */
  side?: "top" | "bottom" | "left" | "right";
  /** Extra class on the icon wrapper */
  className?: string;
  /** Extra class on the clickable help button */
  buttonClassName?: string;
  /** Use a wider tooltip panel (long explanations) */
  wide?: boolean;
  /** Increment to programmatically open the tooltip (e.g. on a mobile tap where there's
   *  no hover). Opens it pinned; changes are ignored while equal to the previous value. */
  openSignal?: number;
}

export function HelpTooltip({
  text,
  label,
  size = "0.75rem",
  side = "top",
  className,
  buttonClassName,
  wide,
  openSignal,
}: HelpTooltipProps) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const localizedText = localizeStringNode(text, localize);
  const localizedLabel = label ? localize(label) : undefined;
  const [show, setShow] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; ready: boolean }>({ top: 0, left: 0, ready: false });

  // Stable per-instance closer registered with the module-level "active tooltip".
  const closeSelfRef = useRef<(() => void) | null>(null);
  if (!closeSelfRef.current) {
    closeSelfRef.current = () => {
      setShow(false);
      setPinned(false);
      if (activeTooltipClose === closeSelfRef.current) activeTooltipClose = null;
    };
  }
  const closeSelf = closeSelfRef.current;
  const openSelf = () => {
    if (activeTooltipClose && activeTooltipClose !== closeSelf) activeTooltipClose();
    activeTooltipClose = closeSelf;
    setShow(true);
  };

  // On unmount, release the module singleton if we still hold it — otherwise a
  // pinned tooltip whose host unmounts leaves a defunct closer that the next
  // openSelf would call (setState on an unmounted instance).
  useEffect(() => {
    return () => {
      if (activeTooltipClose === closeSelfRef.current) activeTooltipClose = null;
    };
  }, []);

  // Programmatic open (e.g. a mobile tap with no hover): open pinned when the signal changes.
  const prevSignalRef = useRef(openSignal);
  useEffect(() => {
    if (openSignal === undefined || openSignal === prevSignalRef.current) return;
    prevSignalRef.current = openSignal;
    if (openSignal > 0) {
      if (activeTooltipClose && activeTooltipClose !== closeSelf) activeTooltipClose();
      activeTooltipClose = closeSelf;
      setShow(true);
      setPinned(true);
    }
    // closeSelf is stable (ref-backed); openSignal drives this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  // Compute position before paint so the tooltip never flickers
  useLayoutEffect(() => {
    if (!show || !wrapRef.current || !tipRef.current) {
      setPos({ top: 0, left: 0, ready: false });
      return;
    }
    const rect = wrapRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    const pad = 8;
    let top = 0;
    let left = 0;

    if (side === "top") {
      top = rect.top - 6 - tip.height;
      left = rect.left + rect.width / 2 - tip.width / 2;
    } else if (side === "bottom") {
      top = rect.bottom + 6;
      left = rect.left + rect.width / 2 - tip.width / 2;
    } else if (side === "left") {
      top = rect.top + rect.height / 2 - tip.height / 2;
      left = rect.left - 6 - tip.width;
    } else {
      top = rect.top + rect.height / 2 - tip.height / 2;
      left = rect.right + 6;
    }

    // Clamp to viewport
    left = Math.max(pad, Math.min(left, window.innerWidth - pad - tip.width));
    top = Math.max(pad, Math.min(top, window.innerHeight - pad - tip.height));

    setPos({ top, left, ready: true });
  }, [show, side]);

  useEffect(() => {
    if (!show) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!wrapRef.current?.contains(target) && !tipRef.current?.contains(target)) {
        closeSelf();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSelf();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [show, closeSelf]);

  return (
    <span
      ref={wrapRef}
      className={cn("relative inline-flex", className)}
      onMouseLeave={() => {
        if (!pinned) closeSelf();
      }}
    >
      <button
        type="button"
        aria-label={localizedLabel ?localizeUi("ui.ui.customemojitagbutton.value1Value2", { value1: localize("Show help"), value2: localizedLabel }) : localize("Show help")}
        aria-expanded={show}
        className={cn(
          "mari-chrome-accent-text-muted mari-accent-animated inline-flex cursor-help items-center gap-1 rounded-full opacity-70 transition-opacity hover:text-[var(--marinara-chat-chrome-button-text-hover)] hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]",
          buttonClassName,
        )}
        onMouseEnter={openSelf}
        onFocus={openSelf}
        onBlur={() => {
          if (!pinned) closeSelf();
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setPinned((current) => {
            const nextPinned = !current;
            if (nextPinned) openSelf();
            else closeSelf();
            return nextPinned;
          });
        }}
      >
        {localizedLabel && <span>{localizedLabel}</span>}
        <HelpCircle size={size} />
      </button>
      {show &&
        createPortal(
          <div
            ref={tipRef}
            className={cn(
              "pointer-events-none fixed z-[9999] rounded-lg bg-[var(--popover)] px-3 py-2 text-left text-[0.6875rem] leading-relaxed text-[var(--popover-foreground)] shadow-xl ring-1 ring-[var(--border)]",
              wide ? "w-[min(22rem,calc(100vw-1.5rem))] max-w-[22rem]" : "w-56",
            )}
            style={{ top: pos.top, left: pos.left, visibility: pos.ready ? "visible" : "hidden" }}
          >
            {localizedText}
          </div>,
          document.body,
        )}
    </span>
  );
}
