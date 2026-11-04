// ──────────────────────────────────────────────
// UI overhaul, phones and tablets: long-press a message
//
// Messages show no action row on phones. Holding a message opens this sheet:
// Regenerate, Edit, Copy and Branch as big buttons, the swipes, then every
// other action as labelled rows (the same buttons the desktop More menu lists).
// Pulling the sheet down, tapping outside or Escape closes it.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Copy, GitBranch, List, Pencil, RefreshCw } from "lucide-react";
import type { MessageSwipe } from "@marinara-engine/shared";
import { api } from "../../lib/api-client";
import { chatKeys } from "../../hooks/use-chats";
import { cn } from "../../lib/utils";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { closeAfterAction } from "./RpMessageFooter";

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;

/**
 * Long-press on touch (and right-click / the context-menu key elsewhere) calls `onLongPress`.
 * Spread the returned handlers on the message's root element. The click that follows a long
 * press is swallowed so it does not also run the tap handler.
 */
export function useLongPress(onLongPress: () => void, enabled: boolean) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);
  useEffect(() => clear, [clear]);
  const fire = useCallback(() => {
    fired.current = true;
    clear();
    window.getSelection()?.removeAllRanges();
    navigator.vibrate?.(8);
    onLongPress();
  }, [clear, onLongPress]);
  if (!enabled) return {};
  return {
    "data-ovm-longpress": "true",
    onPointerDown: (event: React.PointerEvent) => {
      fired.current = false;
      if (event.pointerType === "mouse") return;
      const target = event.target as HTMLElement;
      if (target.closest("button, a, input, textarea, select, [contenteditable='true']")) return;
      start.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(fire, LONG_PRESS_MS);
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (!start.current) return;
      if (
        Math.abs(event.clientX - start.current.x) > MOVE_TOLERANCE_PX ||
        Math.abs(event.clientY - start.current.y) > MOVE_TOLERANCE_PX
      )
        clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onContextMenu: (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable='true']")) return;
      event.preventDefault();
      if (!fired.current) fire();
    },
    onClickCapture: (event: React.MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}

function SwipeRows({
  chatId,
  messageId,
  activeIndex,
  count,
  onPick,
}: {
  chatId: string;
  messageId: string;
  activeIndex: number;
  count: number;
  onPick: (index: number) => void;
}) {
  const { data } = useQuery({
    queryKey: [...chatKeys.all, "swipes", messageId],
    queryFn: () => api.get<MessageSwipe[]>(`/chats/${chatId}/messages/${messageId}/swipes`),
    staleTime: 10_000,
  });
  const rows = data?.length ? [...data].sort((a, b) => a.index - b.index) : null;
  return (
    <div className="ov-rpf-swipes" role="listbox" aria-label="Swipes">
      {(rows ?? Array.from({ length: count }, (_, index) => ({ index, content: "" }))).map((row) => (
        <button
          key={row.index}
          type="button"
          role="option"
          aria-selected={row.index === activeIndex}
          className={cn("ov-rpf-swipe", row.index === activeIndex && "is-on")}
          onClick={() => onPick(row.index)}
        >
          <span className="ov-rpf-swipe__n">{row.index + 1}</span>
          <span className="ov-rpf-swipe__t">
            {row.content
              ? row.content
                  .replace(/[*_~`]+/g, "")
                  .replace(/\s+/g, " ")
                  .slice(0, 140)
              : "…"}
          </span>
        </button>
      ))}
    </div>
  );
}

export function OvMobileMessageSheet({
  chatId,
  messageId,
  swipeIndex,
  swipeCount,
  onSetSwipe,
  onCreateSwipe,
  copied,
  onRegenerate,
  onEdit,
  onCopy,
  onBranch,
  more,
  top,
  onClose,
}: {
  /** Shown above the big buttons (Convo: quick reactions). */
  top?: ReactNode;
  chatId: string;
  messageId: string;
  swipeIndex: number;
  swipeCount: number;
  onSetSwipe?: (index: number) => void;
  onCreateSwipe?: () => void;
  copied: boolean;
  onRegenerate?: () => void;
  onEdit?: () => void;
  onCopy: () => void;
  onBranch?: () => void;
  /** Every other action (the upstream action buttons), shown as labelled rows. */
  more: ReactNode;
  onClose: () => void;
}) {
  const localize = useLocalizedUiText();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [swipeListOpen, setSwipeListOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ y: number; startScroll: number } | null>(null);
  const count = Math.max(1, swipeCount);
  const showSwipes = Boolean(onSetSwipe) && (swipeCount > 1 || Boolean(onCreateSwipe));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = (action?: () => void) => () => {
    onClose();
    action?.();
  };

  return createPortal(
    <>
      <div className="ovm-sheet-scrim" aria-hidden="true" onClick={onClose} />
      <div
        ref={sheetRef}
        className="ovm-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={localize("Message actions")}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse") return;
          if ((sheetRef.current?.scrollTop ?? 0) > 0) return;
          drag.current = { y: event.clientY, startScroll: sheetRef.current?.scrollTop ?? 0 };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setDragY(Math.max(0, event.clientY - drag.current.y));
        }}
        onPointerUp={() => {
          if (!drag.current) return;
          const height = sheetRef.current?.offsetHeight ?? 400;
          drag.current = null;
          if (dragY > height * 0.25) onClose();
          else setDragY(0);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragY(0);
        }}
      >
        <div className="ovm-sheet__handle" aria-hidden="true" />
        {top ? (
          <div className="ovm-sheet__top" onClickCapture={closeAfterAction(onClose)}>
            {top}
          </div>
        ) : null}
        <div className="ovm-sheet__quick">
          <button type="button" onClick={run(onRegenerate)} disabled={!onRegenerate}>
            <RefreshCw size={22} />
            {localize("Regenerate")}
          </button>
          <button type="button" onClick={run(onEdit)} disabled={!onEdit}>
            <Pencil size={22} />
            {localize("Edit")}
          </button>
          <button type="button" onClick={run(onCopy)}>
            {copied ? <Check size={22} /> : <Copy size={22} />}
            {localize("Copy")}
          </button>
          <button type="button" onClick={run(onBranch)} disabled={!onBranch}>
            <GitBranch size={22} />
            {localize("Branch")}
          </button>
        </div>
        {showSwipes ? (
          <div className="ovm-sheet__group">
            <div className="ovm-sheet__swipes">
              <span>{localize("Swipes")}</span>
              <button
                type="button"
                aria-label={localize("Previous swipe")}
                disabled={swipeIndex <= 0}
                onClick={() => onSetSwipe?.(swipeIndex - 1)}
              >
                <ChevronLeft size={20} />
              </button>
              <small>
                {swipeIndex + 1} / {count}
              </small>
              <button
                type="button"
                aria-label={localize(swipeIndex < count - 1 ? "Next swipe" : "Generate another swipe")}
                disabled={swipeIndex >= count - 1 && !onCreateSwipe}
                onClick={() => {
                  if (swipeIndex < count - 1) onSetSwipe?.(swipeIndex + 1);
                  else run(onCreateSwipe)();
                }}
              >
                <ChevronRight size={20} />
              </button>
              <button
                type="button"
                className={cn(swipeListOpen && "is-on")}
                aria-label={localize("Show all swipes")}
                aria-expanded={swipeListOpen}
                onClick={() => setSwipeListOpen((open) => !open)}
              >
                <List size={20} />
              </button>
            </div>
            {swipeListOpen ? (
              <SwipeRows
                chatId={chatId}
                messageId={messageId}
                activeIndex={swipeIndex}
                count={count}
                onPick={(index) => {
                  onClose();
                  if (index !== swipeIndex) onSetSwipe?.(index);
                }}
              />
            ) : null}
          </div>
        ) : null}
        <div className="ovm-sheet__group ovm-sheet__more ov-rpf-menu" onClickCapture={closeAfterAction(onClose)}>
          {more}
        </div>
      </div>
    </>,
    document.body,
  );
}
