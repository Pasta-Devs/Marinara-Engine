// ──────────────────────────────────────────────
// Reusable animated modal shell
// ──────────────────────────────────────────────
import { useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Width class, e.g. "max-w-md", "max-w-lg" */
  width?: string;
}

export function Modal({ open, onClose, title, children, width = "max-w-md" }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => {
            if (e.target === overlayRef.current) onClose();
          }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Panel - OS Window style */}
          <motion.div
            className={`os-window relative flex w-full flex-col ${width} max-h-[90vh] shadow-2xl shadow-black/50`}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
          >
            {/* Pastel gradient title bar */}
            <div className="pastel-gradient h-[0.1875rem]" />
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between border-b border-[var(--y2k-purple)]/20 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-[var(--y2k-lavender)]">{title}</h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--y2k-pink)]"
              >
                <X size="1rem" />
              </button>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
