// ──────────────────────────────────────────────
// Reusable animated modal shell
// Uses CSS animations instead of framer-motion to
// avoid double-animation under React.StrictMode.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Width class, e.g. "max-w-md", "max-w-lg" */
  width?: string;
  onExited?: () => void;
}

export function Modal({ open, onClose, title, children, width = "max-w-md", onExited }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  // Track mounted state separately so we can play the exit animation
  // before actually removing the DOM nodes.
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState<"enter" | "exit" | null>(null);
  const enterRafRef = useRef<number | null>(null);
  const exitHandledRef = useRef(false);

  useEffect(() => {
    if (enterRafRef.current !== null) {
      cancelAnimationFrame(enterRafRef.current);
      enterRafRef.current = null;
    }

    if (open) {
      setMounted(true);
      exitHandledRef.current = false;
      // Start enter animation on next frame so the DOM is present
      enterRafRef.current = requestAnimationFrame(() => {
        setAnimating("enter");
      });
    } else if (mounted) {
      exitHandledRef.current = false;
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
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Remove from DOM after exit animation completes
  const handleAnimationEnd = () => {
    if (animating === "exit" && !exitHandledRef.current) {
      exitHandledRef.current = true;
      setMounted(false);
      setAnimating(null);
      onExited?.();
    }
  };

  if (!mounted) return null;

  const isEntering = animating === "enter";

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-component="Modal"
      className="mari-modal fixed inset-0 z-50 flex items-center justify-center p-3 max-md:pt-[max(0.75rem,env(safe-area-inset-top))] max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
      style={{
        opacity: isEntering ? 1 : 0,
        transition: "opacity 150ms ease-out",
      }}
      onTransitionEnd={handleAnimationEnd}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        className="mari-modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
        style={{
          opacity: isEntering ? 1 : 0,
          transition: "opacity 150ms ease-out",
        }}
      />

      {/* Panel - OS Window style */}
      <div
        className={`mari-modal-panel os-window relative flex w-full flex-col ${width} max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(90dvh,52rem)] shadow-2xl shadow-black/50`}
        style={{
          opacity: isEntering ? 1 : 0,
          transform: isEntering ? "scale(1) translateY(0)" : "scale(0.97) translateY(6px)",
          transition: "opacity 150ms ease-out, transform 150ms ease-out",
        }}
      >
        {/* Pastel gradient title bar */}
        <div className="pastel-gradient h-[0.1875rem]" />
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-[var(--border)]/30 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--primary)]"
          >
            <X size="1rem" />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
