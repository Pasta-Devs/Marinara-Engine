// ──────────────────────────────────────────────
// Expanded Textarea — Fullscreen editing overlay
// ──────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Minimize2, Sparkles } from "lucide-react";
import { MagicRewritePanel } from "./MagicRewritePanel";

interface ExpandedTextareaProps {
  open: boolean;
  onClose: () => void;
  title: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ExpandedTextarea({
  open,
  onClose,
  title,
  value,
  onChange,
  placeholder,
}: ExpandedTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [local, setLocal] = useState(value);
  const [magicRewriteMode, setMagicRewriteMode] = useState(false);
  const [magicRewriteResult, setMagicRewriteResult] = useState("");

  const handleClose = useCallback(() => {
    onChange(local);
    onClose();
  }, [local, onChange, onClose]);

  useEffect(() => {
    if (!open) {
      setMagicRewriteMode(false);
      setMagicRewriteResult("");
    }
    setLocal(value);
  }, [value, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !magicRewriteMode) handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, handleClose, magicRewriteMode]);

  // Focus textarea when opened
  useEffect(() => {
    if (open && !magicRewriteMode) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [open, magicRewriteMode]);

  const handleMagicRewriteResultChange = useCallback((next: string) => {
    setMagicRewriteResult(next);
  }, []);

  const handleMagicRewriteApply = () => {
    if (!magicRewriteResult) return;
    setLocal(magicRewriteResult);
    setMagicRewriteMode(false);
    setMagicRewriteResult("");
    onChange(magicRewriteResult);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleMagicRewriteBack = () => {
    setMagicRewriteMode(false);
    setMagicRewriteResult("");
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col bg-[var(--background)] max-md:pt-[env(safe-area-inset-top)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-3">
            <h2 className="text-sm font-semibold">
              {magicRewriteMode ? "Magic Rewrite" : title}
            </h2>
            <div className="flex items-center gap-2">
              {!magicRewriteMode && (
                <button
                  onClick={() => setMagicRewriteMode(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/10 px-2.5 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-500/20"
                  title="Open Magic Rewrite"
                >
                  <Sparkles size="0.875rem" />
                  Rewrite
                </button>
              )}
              {magicRewriteMode && (
                <button
                  onClick={handleMagicRewriteBack}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)]"
                >
                  Back
                </button>
              )}
              {magicRewriteMode && (
                <button
                  onClick={handleMagicRewriteApply}
                  disabled={!magicRewriteResult}
                  className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Apply
                </button>
              )}
              <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                {local.length} characters
              </span>
              <button
                onClick={handleClose}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                <Minimize2 size="0.875rem" />
                <span className="max-md:hidden">Collapse</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden p-4 md:p-6">
            {magicRewriteMode ? (
              <MagicRewritePanel
                value={local}
                onResultChange={handleMagicRewriteResultChange}
              />
            ) : (
              <textarea
                ref={textareaRef}
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder={placeholder}
                className="h-full w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-5 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
