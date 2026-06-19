import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface SmoothFolderContentProps {
  open: boolean;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}

const folderContentTransition = {
  height: { duration: 0.2, ease: [0.25, 0.8, 0.25, 1] },
  opacity: { duration: 0.14, ease: "easeOut" },
} as const;

export function SmoothFolderContent({ open, children, className, innerClassName }: SmoothFolderContentProps) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="folder-content"
          initial={reduceMotion ? false : { height: 0, opacity: 0 }}
          animate={reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={reduceMotion ? { duration: 0.01 } : folderContentTransition}
          className={cn("overflow-hidden will-change-[height,opacity]", className)}
        >
          <div className={innerClassName}>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
