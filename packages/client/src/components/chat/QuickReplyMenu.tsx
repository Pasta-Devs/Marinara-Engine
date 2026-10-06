import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";

export interface QuickReplyAction {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  onSelect: () => void | Promise<void>;
}

interface QuickReplyMenuProps {
  actions: QuickReplyAction[];
  disabled?: boolean;
}

export function QuickReplyMenu({ actions, disabled = false }: QuickReplyMenuProps) {
  const { t: localizeUi } = useUiTranslation();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pendingFocusRef = useRef<"first" | "last" | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, ready: false });
  const isDisabled = disabled || actions.length === 0;
  const singleAction = actions.length === 1 ? actions[0] : null;
  const visibleActions = actions.slice().reverse();

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 8;
    const left = Math.max(
      viewportPadding,
      Math.min(
        triggerRect.left + triggerRect.width / 2 - menuRect.width / 2,
        window.innerWidth - viewportPadding - menuRect.width,
      ),
    );
    const preferredTop = triggerRect.top - gap - menuRect.height;
    const maxTop = window.innerHeight - viewportPadding - menuRect.height;
    const top =
      preferredTop >= viewportPadding
        ? preferredTop
        : Math.max(viewportPadding, Math.min(triggerRect.bottom + gap, maxTop));

    setMenuPosition((current) =>
      current.ready && current.top === top && current.left === left ? current : { top, left, ready: true },
    );
  }, []);

  const focusMenuItem = useCallback((target: "first" | "last" | { fromIndex: number; delta: 1 | -1 }) => {
    const focusable = itemRefs.current
      .map((button, index) => ({ button, index }))
      .filter(
        (entry): entry is { button: HTMLButtonElement; index: number } => !!entry.button && !entry.button.disabled,
      );
    if (focusable.length === 0) return;

    const next =
      target === "first"
        ? focusable[0]
        : target === "last"
          ? focusable[focusable.length - 1]
          : (() => {
              const current = focusable.findIndex((entry) => entry.index === target.fromIndex);
              const base = current === -1 ? (target.delta > 0 ? -1 : 0) : current;
              return focusable[(base + target.delta + focusable.length) % focusable.length];
            })();
    next?.button.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    let frame = 0;
    const scrollListenerOptions = { capture: true, passive: true } as const;
    const scheduleUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        updateMenuPosition();
      });
    };
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, scrollListenerOptions);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, scrollListenerOptions);
    };
  }, [open, updateMenuPosition, visibleActions.length]);

  useEffect(() => {
    if (!open || !pendingFocusRef.current) return;
    const target = pendingFocusRef.current;
    const frame = requestAnimationFrame(() => {
      focusMenuItem(target);
      pendingFocusRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [focusMenuItem, open, visibleActions.length]);

  useEffect(() => {
    if (actions.length <= 1 && open) setOpen(false);
  }, [actions.length, open]);

  const handleSelect = async (action: QuickReplyAction) => {
    if (disabled || action.disabled) return;
    setOpen(false);
    await action.onSelect();
  };

  const formatActionTitle = (action: QuickReplyAction) =>
    action.disabled
      ? `${action.label}: ${action.disabledReason ?? action.description}`
      : `${action.label}: ${action.description}`;

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const target = event.key === "ArrowUp" ? "last" : "first";
    if (open) {
      focusMenuItem(target);
    } else {
      pendingFocusRef.current = target;
      setOpen(true);
    }
  };

  const handleItemKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        focusMenuItem({ fromIndex: index, delta: 1 });
        break;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        focusMenuItem({ fromIndex: index, delta: -1 });
        break;
      case "Home":
        event.preventDefault();
        focusMenuItem("first");
        break;
      case "End":
        event.preventDefault();
        focusMenuItem("last");
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
    }
  };

  if (singleAction) {
    const singleDisabled = disabled || singleAction.disabled;
    return (
      <button
        type="button"
        onClick={() => void handleSelect(singleAction)}
        disabled={singleDisabled}
        aria-label={localizeUi("ui.chat.quickreplymenu.value1Value2", {
          value1: singleAction.label,
          value2: singleAction.description,
        })}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-200 focus-visible:ring-2 focus-visible:ring-foreground/20 sm:h-8 sm:w-8",
          !singleDisabled
            ? "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70 active:scale-90"
            : "cursor-not-allowed text-foreground/20",
        )}
        title={formatActionTitle(singleAction)}
      >
        {singleAction.icon}
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative flex h-11 w-11 shrink-0 items-center justify-center sm:h-8 sm:w-8">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleTriggerKeyDown}
        disabled={isDisabled}
        aria-label={localizeUi("settings.quickReplies.label")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 sm:h-8 sm:w-8",
          open
            ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20"
            : !isDisabled
              ? "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70 active:scale-90"
              : "text-foreground/20",
        )}
        title={localizeUi("settings.quickReplies.label")}
      >
        <MoreHorizontal size="1rem" />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <div
              ref={menuRef}
              data-chat-input-popup="quick-reply"
              className="fixed z-[9999]"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                visibility: menuPosition.ready ? "visible" : "hidden",
              }}
            >
              <motion.div
                key="quick-replies-rail"
                id={menuId}
                role="menu"
                aria-label={localizeUi("settings.quickReplies.label")}
                aria-orientation="vertical"
                className="flex flex-col items-center gap-1.5"
                initial="closed"
                animate="open"
                exit="closed"
                variants={{
                  open: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
                  closed: { transition: { staggerChildren: 0.025, staggerDirection: -1 } },
                }}
              >
                {visibleActions.map((action, index) => (
                  <motion.button
                    ref={(element) => {
                      itemRefs.current[index] = element;
                    }}
                    key={action.id}
                    type="button"
                    role="menuitem"
                    disabled={action.disabled}
                    onClick={() => void handleSelect(action)}
                    onKeyDown={(event) => handleItemKeyDown(event, index)}
                    aria-label={localizeUi("ui.chat.quickreplymenu.value1Value2", {
                      value1: action.label,
                      value2: action.description,
                    })}
                    className={cn(
                      "mari-chat-style-control mari-chat-quick-reply group relative flex h-11 w-11 items-center justify-center rounded-full border shadow-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-foreground/20 sm:h-10 sm:w-10",
                      action.disabled
                        ? "cursor-not-allowed border-foreground/10 bg-[var(--card)]/75 opacity-45"
                        : "border-foreground/20 bg-[var(--card)] text-foreground/55 hover:bg-foreground/10 hover:text-foreground/80 active:scale-95",
                    )}
                    title={formatActionTitle(action)}
                    variants={{
                      open: {
                        opacity: 1,
                        scale: 1,
                        y: 0,
                        filter: "blur(0px)",
                        transition: {
                          type: "spring",
                          stiffness: 520,
                          damping: 28,
                          mass: 0.75,
                          delay: index * 0.015,
                        },
                      },
                      closed: {
                        opacity: 0,
                        scale: 0.55,
                        y: 36 + index * 10,
                        filter: "blur(2px)",
                        transition: { duration: 0.12, ease: "easeOut" },
                      },
                    }}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 transition-colors",
                        action.disabled
                          ? "bg-foreground/5 text-foreground/40 ring-transparent"
                          : "bg-foreground/10 ring-foreground/15 group-hover:bg-transparent group-hover:ring-transparent",
                      )}
                    >
                      {action.icon}
                    </span>
                  </motion.button>
                ))}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
