// ──────────────────────────────────────────────
// Expanded Textarea — Fullscreen editing overlay
// ──────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Minimize2 } from "lucide-react";

interface ExpandedTextareaProps {
  open: boolean;
  onClose: () => void;
  title: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ExpandedTextarea({ open, onClose, title, value, onChange, placeholder }: ExpandedTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          className="fixed inset-0 z-[100] flex flex-col bg-[var(--background)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-3">
            <h2 className="text-sm font-semibold">{title}</h2>
            <div className="flex items-center gap-2">
              <span className="text-[0.625rem] text-[var(--muted-foreground)]">{value.length} characters</span>
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                <Minimize2 size="0.875rem" />
                <span className="max-md:hidden">Collapse</span>
              </button>
            </div>
          </div>

          {/* Textarea */}
          <div className="flex-1 overflow-hidden p-4 md:p-6">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="h-full w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-5 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
