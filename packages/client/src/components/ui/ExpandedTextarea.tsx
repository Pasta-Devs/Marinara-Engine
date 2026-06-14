// ──────────────────────────────────────────────
// Expanded Textarea — Fullscreen editing overlay
// ──────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Minimize2 } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  NEUTRAL_PANEL_HEADER,
  NEUTRAL_PANEL_SCROLL_AREA,
  NEUTRAL_PANEL_TITLE,
  NEUTRAL_SURFACE_VARIABLES,
} from "./neutral-surface-styles";

interface ExpandedTextareaProps {
  open: boolean;
  onClose: () => void;
  title: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  surface?: "default" | "chat";
}

export function ExpandedTextarea({
  open,
  onClose,
  title,
  value,
  onChange,
  placeholder,
  surface = "default",
}: ExpandedTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isChatSurface = surface === "chat";

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Focus textarea when opened
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn(
            "fixed inset-0 z-[100] flex flex-col max-md:pt-[env(safe-area-inset-top)]",
            isChatSurface ? `bg-zinc-950/95 text-zinc-100 ${NEUTRAL_SURFACE_VARIABLES}` : "bg-[var(--background)]",
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Header */}
          <div
            className={cn(
              "flex shrink-0 items-center justify-between",
              isChatSurface ? NEUTRAL_PANEL_HEADER : "border-b border-[var(--border)] px-5 py-3",
            )}
          >
            <h2 className={isChatSurface ? NEUTRAL_PANEL_TITLE : "text-sm font-semibold"}>{title}</h2>
            <div className="flex items-center gap-2">
              <span className="text-[0.625rem] text-[var(--muted-foreground)]">{value.length} characters</span>
              <button
                onClick={onClose}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                  isChatSurface
                    ? "border border-foreground/10 bg-foreground/5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                )}
              >
                <Minimize2 size="0.875rem" />
                <span className="max-md:hidden">Collapse</span>
              </button>
            </div>
          </div>

          {/* Textarea */}
          <div className={cn("flex-1 overflow-hidden p-4 md:p-6", isChatSurface && NEUTRAL_PANEL_SCROLL_AREA)}>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className={cn(
                "h-full w-full resize-none rounded-xl p-5 text-sm leading-relaxed outline-none transition-colors",
                isChatSurface
                  ? "border border-foreground/10 bg-[var(--card)] text-foreground/85 placeholder:text-foreground/30 focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10"
                  : "border border-[var(--border)] bg-[var(--secondary)] placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20",
              )}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
