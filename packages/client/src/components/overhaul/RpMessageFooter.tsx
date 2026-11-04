// ──────────────────────────────────────────────
// UI overhaul: roleplay message footer (mockup "RP B", with RP C's menus)
//
// One thin line at the bottom of a reply: swipe arrows and counter on the
// left, Regenerate / Edit / Copy / Branch and More on the right. It is always
// shown on the newest reply and on hover for the others. The counter opens a
// swipe list you can read before picking; More opens every other action
// (the upstream action buttons, shown as a labelled menu).
// ──────────────────────────────────────────────
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  GitBranch,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react";
import type { MessageSwipe } from "@marinara-engine/shared";
import { api } from "../../lib/api-client";
import { chatKeys } from "../../hooks/use-chats";
import { cn } from "../../lib/utils";

type Anchor = { left: number; top: number; bottom: number; right: number };

/** A popover in a portal, so the bubble's overflow cannot clip it. Opens above the button when there is no room below. */
export function FooterPopover({
  anchor,
  onClose,
  className,
  children,
}: {
  anchor: Anchor;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    left: anchor.left,
    top: anchor.bottom + 4,
    visibility: "hidden",
  });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const below = anchor.bottom + 4;
    const top = below + rect.height > window.innerHeight - 8 ? Math.max(8, anchor.top - rect.height - 4) : below;
    const left = Math.min(Math.max(8, anchor.left), window.innerWidth - rect.width - 8);
    setStyle({ left, top });
  }, [anchor]);
  useEffect(() => {
    const close = (event: Event) => {
      if (event.target instanceof Node && ref.current?.contains(event.target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    // Popovers opened from inside the menu (marks, hide from AI…) portal too; only close on clicks outside all of them.
    const onPointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("[role='dialog'], [role='menu'], [data-radix-popper-content-wrapper], .mari-popover"))
        return;
      close(event);
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);
  return createPortal(
    <div ref={ref} className={cn("ov-rpf-pop", className)} style={style}>
      {children}
    </div>,
    document.body,
  );
}

/** Click handler (capture) for a menu of actions: a plain action closes the menu; a toggle that opens its own popover (marks) keeps it. */
export function closeAfterAction(close: () => void) {
  return (event: React.MouseEvent) => {
    const button = (event.target as HTMLElement).closest("button");
    if (button && !button.hasAttribute("aria-pressed") && !button.disabled) close();
  };
}

function SwipeList({
  chatId,
  messageId,
  activeIndex,
  count,
  onPick,
  onCreate,
}: {
  chatId: string;
  messageId: string;
  activeIndex: number;
  count: number;
  onPick: (index: number) => void;
  onCreate?: () => void;
}) {
  const { data } = useQuery({
    queryKey: [...chatKeys.all, "swipes", messageId],
    queryFn: () => api.get<MessageSwipe[]>(`/chats/${chatId}/messages/${messageId}/swipes`),
    staleTime: 10_000,
  });
  const rows = data?.length ? [...data].sort((a, b) => a.index - b.index) : null;
  return (
    <div role="listbox" aria-label="Swipes">
      <p className="ov-rpf-pop__label">Swipes</p>
      <div className="ov-rpf-swipes">
        {(rows ?? Array.from({ length: count }, (_, index) => ({ index, content: "", createdAt: "" }))).map((row) => (
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
                    .slice(0, 180)
                : "…"}
            </span>
            {row.createdAt ? (
              <span className="ov-rpf-swipe__w">
                {new Date(row.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="ov-rpf-pop__foot">
        {onCreate ? (
          <button type="button" onClick={onCreate}>
            <Plus size={13} /> Generate another
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function OvRpMessageFooter({
  chatId,
  messageId,
  pinned,
  swipeIndex,
  swipeCount,
  onSetSwipe,
  onCreateSwipe,
  meta,
  copied,
  onRegenerate,
  onEdit,
  onCopy,
  onBranch,
  more,
}: {
  chatId: string;
  messageId: string;
  /** Always visible (the newest reply); otherwise only on hover. */
  pinned: boolean;
  swipeIndex: number;
  swipeCount: number;
  onSetSwipe: (index: number) => void;
  onCreateSwipe?: () => void;
  meta?: ReactNode;
  copied: boolean;
  onRegenerate?: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onBranch?: () => void;
  /** Every other action, rendered inside the More menu. */
  more: ReactNode;
}) {
  const [open, setOpen] = useState<null | { kind: "more" | "swipes"; anchor: Anchor }>(null);
  const openAt = (kind: "more" | "swipes", el: HTMLElement) => {
    if (open?.kind === kind) return setOpen(null);
    const r = el.getBoundingClientRect();
    setOpen({
      kind,
      anchor: { left: kind === "more" ? r.right - 240 : r.left, top: r.top, bottom: r.bottom, right: r.right },
    });
  };
  const count = Math.max(1, swipeCount);
  const hasSwipes = swipeCount > 1;
  return (
    <div className={cn("ov-rpf", pinned && "is-pinned", open && "is-open")} data-ov-rp-footer>
      {hasSwipes || onCreateSwipe ? (
        <span className="ov-rpf__swipes">
          <button
            type="button"
            aria-label="Previous swipe"
            disabled={swipeIndex <= 0}
            onClick={() => onSetSwipe(swipeIndex - 1)}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            className="ov-rpf__count"
            aria-label="Show all swipes"
            aria-expanded={open?.kind === "swipes"}
            onClick={(event) => openAt("swipes", event.currentTarget)}
          >
            {swipeIndex + 1} / {count}
            <ChevronDown size={11} />
          </button>
          <button
            type="button"
            aria-label={swipeIndex < count - 1 ? "Next swipe" : "Generate another swipe"}
            disabled={swipeIndex >= count - 1 && !onCreateSwipe}
            onClick={() => (swipeIndex < count - 1 ? onSetSwipe(swipeIndex + 1) : onCreateSwipe?.())}
          >
            <ChevronRight size={15} />
          </button>
        </span>
      ) : null}
      {meta ? <span className="ov-rpf__meta">{meta}</span> : null}
      <span className="ov-rpf__grow" />
      {onRegenerate ? (
        <button
          type="button"
          className="ov-rpf__btn is-accent"
          title="Regenerate"
          aria-label="Regenerate"
          onClick={onRegenerate}
        >
          <RefreshCw size={14} />
        </button>
      ) : null}
      <button type="button" className="ov-rpf__btn" title="Edit" aria-label="Edit" onClick={onEdit}>
        <Pencil size={14} />
      </button>
      <button type="button" className="ov-rpf__btn" title="Copy" aria-label="Copy" onClick={onCopy}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      {onBranch ? (
        <button
          type="button"
          className="ov-rpf__btn"
          title="Branch from here"
          aria-label="Branch from here"
          onClick={onBranch}
        >
          <GitBranch size={14} />
        </button>
      ) : null}
      <button
        type="button"
        className={cn("ov-rpf__btn", open?.kind === "more" && "is-on")}
        title="More actions"
        aria-label="More actions"
        aria-expanded={open?.kind === "more"}
        onClick={(event) => openAt("more", event.currentTarget)}
      >
        <MoreHorizontal size={15} />
      </button>
      {open?.kind === "more" ? (
        <FooterPopover anchor={open.anchor} onClose={() => setOpen(null)} className="ov-rpf-menu">
          <p className="ov-rpf-pop__label">Message actions</p>
          <div className="contents" onClickCapture={closeAfterAction(() => setOpen(null))}>
            {more}
          </div>
        </FooterPopover>
      ) : null}
      {open?.kind === "swipes" ? (
        <FooterPopover anchor={open.anchor} onClose={() => setOpen(null)} className="ov-rpf-swipepop">
          <SwipeList
            chatId={chatId}
            messageId={messageId}
            activeIndex={swipeIndex}
            count={count}
            onPick={(index) => {
              setOpen(null);
              if (index !== swipeIndex) onSetSwipe(index);
            }}
            onCreate={
              onCreateSwipe
                ? () => {
                    setOpen(null);
                    onCreateSwipe();
                  }
                : undefined
            }
          />
        </FooterPopover>
      ) : null}
    </div>
  );
}
