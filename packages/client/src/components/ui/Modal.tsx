// ──────────────────────────────────────────────
// Reusable animated modal shell
// Uses CSS animations instead of framer-motion to
// avoid double-animation under React.StrictMode.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  NEUTRAL_PANEL_HEADER,
  NEUTRAL_PANEL_SCROLL_AREA,
  NEUTRAL_PANEL_SHELL,
  NEUTRAL_PANEL_TITLE,
} from "./neutral-surface-styles";
import { useDialogFocusScope } from "../../hooks/use-dialog-focus-scope";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Width class, e.g. "max-w-md", "max-w-lg" */
  width?: string;
  contentRef?: Ref<HTMLDivElement>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  focusScopePortalSelector?: string;
  chatFloatingPanel?: boolean;
  /** Below the sm breakpoint, fill the viewport edge-to-edge like a window instead of floating as a padded bubble. */
  mobileFullscreen?: boolean;
  /** Optional feature-local classes applied to the full panel, including its header. */
  panelClassName?: string;
  /** Optional feature-local style variables applied to the full panel. */
  panelStyle?: CSSProperties;
  closeDisabled?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-md",
  contentRef,
  initialFocusRef,
  restoreFocusRef,
  focusScopePortalSelector,
  chatFloatingPanel = false,
  mobileFullscreen = false,
  panelClassName,
  panelStyle,
  closeDisabled = false,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Track mounted state separately so we can play the exit animation
  // before actually removing the DOM nodes.
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState<"enter" | "exit" | null>(null);
  const enterRafRef = useRef<number | null>(null);
  useDialogFocusScope(open, panelRef, initialFocusRef, restoreFocusRef, focusScopePortalSelector);

  useEffect(() => {
    if (enterRafRef.current !== null) {
      cancelAnimationFrame(enterRafRef.current);
      enterRafRef.current = null;
    }

    if (open) {
      setMounted(true);
      // Start enter animation on next frame so the DOM is present
      enterRafRef.current = requestAnimationFrame(() => {
        setAnimating("enter");
      });
    } else if (mounted) {
      setAnimating("exit");
    }

    return () => {
      if (enterRafRef.current !== null) {
        cancelAnimationFrame(enterRafRef.current);
        enterRafRef.current = null;
      }
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !closeDisabled) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose, closeDisabled]);

  // Remove from DOM after exit animation completes
  const handleAnimationEnd = () => {
    if (animating === "exit") {
      setMounted(false);
      setAnimating(null);
    }
  };

  // Fallback: browsers skip CSS transitions in hidden tabs, so transitionend
  // may never fire when a modal is closed programmatically while the tab is
  // backgrounded (e.g. a game starting auto-closes its setup). Without this
  // the overlay stays mounted forever and blocks clicks.
  useEffect(() => {
    if (animating !== "exit") return;
    const timer = setTimeout(() => {
      setMounted(false);
      setAnimating(null);
    }, 400);
    return () => clearTimeout(timer);
  }, [animating]);

  if (!mounted) return null;

  const isEntering = animating === "enter";

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-chat-floating-panel={chatFloatingPanel ? "true" : undefined}
      data-component="Modal"
      className={`mari-modal fixed inset-0 z-[10000] flex items-center justify-center ${
        mobileFullscreen
          ? "p-0 sm:p-4"
          : "p-3 max-md:pt-[max(0.75rem,env(safe-area-inset-top))] max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
      }`}
      style={{
        opacity: isEntering ? 1 : 0,
        transition: "opacity 150ms ease-out",
      }}
      onTransitionEnd={handleAnimationEnd}
      onClick={(e) => {
        if (e.target === overlayRef.current && !closeDisabled) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        className="mari-modal-backdrop absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        style={{
          opacity: isEntering ? 1 : 0,
          transition: "opacity 150ms ease-out",
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`mari-modal-panel ${NEUTRAL_PANEL_SHELL} relative flex w-full flex-col ${width} max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(90dvh,52rem)]${
          mobileFullscreen
            ? " max-sm:h-full max-sm:max-h-none max-sm:max-w-none max-sm:rounded-none max-sm:border-0 max-sm:pt-[env(safe-area-inset-top)] max-sm:pb-[env(safe-area-inset-bottom)]"
            : ""
        } ${panelClassName ?? ""}`}
        style={{
          ...panelStyle,
          opacity: isEntering ? 1 : 0,
          transform: isEntering ? "scale(1) translateY(0)" : "scale(0.97) translateY(6px)",
          transition: "opacity 150ms ease-out, transform 150ms ease-out",
        }}
      >
        {/* Header */}
        <div className={`shrink-0 flex items-center justify-between ${NEUTRAL_PANEL_HEADER}`}>
          <h2 className={NEUTRAL_PANEL_TITLE}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label={`Close ${title}`}
            className="rounded-lg p-1.5 text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] hover:text-[var(--marinara-chat-chrome-highlight-text)] disabled:cursor-wait disabled:opacity-40"
          >
            <X size="1rem" />
          </button>
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 ${NEUTRAL_PANEL_SCROLL_AREA}`}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
