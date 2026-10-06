import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { cn } from "../../lib/utils";

export const MESSAGE_ACTION_ICON_SIZE = "1em";

export function MessageActionButton({
  icon,
  onClick,
  title,
  className,
  disabled,
  ariaPressed,
  thinkingAction,
  tabIndex,
  buttonRef,
  stopPropagation,
}: {
  icon: ReactNode;
  onClick: () => void;
  title: string;
  className?: string;
  disabled?: boolean;
  ariaPressed?: boolean;
  thinkingAction?: boolean;
  tabIndex?: number;
  buttonRef?: Ref<HTMLButtonElement>;
  stopPropagation?: boolean;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={(event) => {
        if (stopPropagation) event.stopPropagation();
        onClick();
      }}
      title={title}
      aria-label={title}
      aria-pressed={ariaPressed}
      data-message-thinking-action={thinkingAction || undefined}
      disabled={disabled}
      tabIndex={tabIndex}
      className={cn(
        "mari-chat-style-control mari-chat-message-action [-webkit-tap-highlight-color:transparent] inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md p-0 text-base leading-none transition-colors md:transition-all md:active:scale-90 max-md:h-8 max-md:w-7 max-md:max-w-full max-md:text-sm max-md:active:bg-[var(--marinara-chat-message-action-bg-hover)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-30",
        "text-[var(--marinara-chat-message-action-text)] [@media(pointer:fine)]:hover:bg-[var(--marinara-chat-message-action-bg-hover)] [@media(pointer:fine)]:hover:text-[var(--marinara-chat-message-action-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]",
        className,
      )}
    >
      {icon}
    </button>
  );
}

export function useMessageActionMenu(align: "left" | "right") {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const button = buttonRef.current;
      const menu = menuRef.current;
      if (!button || !menu) return;
      const rect = button.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
      const viewportRight = viewportLeft + (viewport?.width ?? window.innerWidth);
      const left = align === "right" ? rect.right - menu.offsetWidth : rect.left;
      setPosition({
        top: Math.max(
          viewportTop + 8,
          Math.min(rect.top - menu.offsetHeight - 7, viewportBottom - menu.offsetHeight - 8),
        ),
        left: Math.max(viewportLeft + 8, Math.min(left, viewportRight - menu.offsetWidth - 8)),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    const observer = new ResizeObserver(update);
    if (menuRef.current) observer.observe(menuRef.current);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [align, open]);
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);
  return { open, setOpen, buttonRef, menuRef, position };
}
