// ──────────────────────────────────────────────
// UI overhaul: roleplay message footer (mockup "RP B", with RP C's menus)
//
// One thin line at the bottom of a reply: swipe arrows and counter on the
// left, Regenerate / Edit / Copy / Branch and More on the right. It shows on
// hover (or while one of its menus is open). The counter opens a
// swipe list you can read before picking; More opens every other action
// (the upstream action buttons, shown as a labelled menu).
// ──────────────────────────────────────────────
import { useArmedAfterPaint } from "../../lib/idle-batch";
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
import { OvMarksMenuContext } from "./marks-menu-context";
import { useTranslation as useUiTranslation } from "react-i18next";

type Anchor = { left: number; top: number; bottom: number; right: number; alignRight?: boolean };

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
    // Right-aligned popovers (Swipes) end at their trigger and stay inside the chat column, so they don't
    // spill over the sidebar (audit H10).
    const column = document.getElementById("mari-main")?.getBoundingClientRect();
    const maxRight = Math.min(window.innerWidth, column?.right ?? window.innerWidth) - 8;
    const wanted = anchor.alignRight ? anchor.right - rect.width : anchor.left;
    const left = Math.max(8, Math.min(wanted, maxRight - rect.width));
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

/**
 * Click handler (capture) for a menu of actions: a plain action closes the menu; a toggle that opens its own
 * popover (marks) keeps it. The close waits a tick: React 19 commits a capture-phase update before the bubble
 * phase runs, so closing right away unmounted the menu and a real mouse click never reached the item's onClick.
 */
export function closeAfterAction(close: () => void) {
  return (event: React.MouseEvent) => {
    const button = (event.target as HTMLElement).closest("button");
    if (button && !button.hasAttribute("aria-pressed") && !button.disabled && !button.closest("[data-ovm-keep-open]"))
      window.setTimeout(close, 0);
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
  const { t: localizeUi } = useUiTranslation();
  const { data } = useQuery({
    queryKey: [...chatKeys.all, "swipes", messageId],
    queryFn: () => api.get<MessageSwipe[]>(`/chats/${chatId}/messages/${messageId}/swipes`),
    staleTime: 10_000,
  });
  const rows = data?.length ? [...data].sort((a, b) => a.index - b.index) : null;
  return (
    <div role="listbox" aria-label={localizeUi("ui.overhaul.swiperows.swipes")}>
      <p className="ov-rpf-pop__label">{localizeUi("ui.overhaul.swiperows.swipes")}</p>
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
            <Plus size={13} /> {localizeUi("ui.overhaul.swipelist.generateAnother")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

let coarsePointerQuery: MediaQueryList | null = null;
/** Touch screens show the bars without hover (overhaul.css, pointer: coarse). */
function touchFootersVisible() {
  if (typeof window === "undefined") return true;
  coarsePointerQuery ??= window.matchMedia("(pointer: coarse)");
  return coarsePointerQuery.matches;
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
  marksPanel,
  placement = "footer",
  part = "all",
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
  /** The bookmark / pin / note form, shown in place of the More menu when its row is picked. */
  marksPanel?: (controls: { back: () => void; done: () => void }) => ReactNode;
  /** "below" hangs the bar under the message as an overlay, so showing it moves nothing. */
  placement?: "footer" | "below";
  /**
   * Which actions to show: "all" (one row), "tools" (Edit, Copy, Branch, More: the message header's
   * top-right) or "generate" (Regenerate and swipes, everything that costs an API call: bottom-right).
   */
  part?: "all" | "tools" | "generate";
}) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState<null | { kind: "more" | "swipes" | "marks"; anchor: Anchor }>(null);
  const openAt = (kind: "more" | "swipes", el: HTMLElement) => {
    if (open?.kind === kind || (kind === "more" && open?.kind === "marks")) return setOpen(null);
    const r = el.getBoundingClientRect();
    setOpen({
      kind,
      anchor: {
        left: kind === "more" ? r.right - 240 : r.left,
        top: r.top,
        bottom: r.bottom,
        right: r.right,
        alignRight: kind === "swipes",
      },
    });
  };
  // Hidden until hover on a mouse: a chat opens without building these buttons for every message, and
  // they arrive right after the first paint. Always-visible bars (the newest reply, touch screens) build at once.
  const armed = useArmedAfterPaint(pinned || open !== null || touchFootersVisible());
  const count = Math.max(1, swipeCount);
  const hasSwipes = swipeCount > 1;
  if (part === "generate" && !onRegenerate && !hasSwipes && !onCreateSwipe) return null;
  const footerClassName = cn(
    "ov-rpf",
    placement === "below" && "ov-rpf--below",
    part !== "all" && `ov-rpf--${part}`,
    pinned && "is-pinned",
    open && "is-open",
  );
  if (!armed) return <div className={footerClassName} data-ov-rp-footer data-mari-part="actions" />;
  return (
    <div className={footerClassName} data-ov-rp-footer data-mari-part="actions">
      {part === "generate" && onRegenerate ? (
        <button
          type="button"
          className="ov-rpf__btn is-accent"
          title={localizeUi("ui.agents.secretplotpanel.regenerate")}
          aria-label={localizeUi("ui.agents.secretplotpanel.regenerate")}
          onClick={onRegenerate}
        >
          <RefreshCw size={14} />
        </button>
      ) : null}
      {part !== "tools" && (hasSwipes || onCreateSwipe) ? (
        <span className="ov-rpf__swipes">
          <button
            type="button"
            aria-label={localizeUi("ui.chat.swipejumpcontrol.previousSwipe")}
            title={localizeUi("ui.chat.swipejumpcontrol.previousSwipe")}
            disabled={swipeIndex <= 0}
            onClick={() => onSetSwipe(swipeIndex - 1)}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            className="ov-rpf__count"
            aria-label={localizeUi("ui.overhaul.ovrpmessagefooter.showAllSwipes")}
            title={localizeUi("ui.overhaul.ovrpmessagefooter.showAllSwipes")}
            aria-expanded={open?.kind === "swipes"}
            onClick={(event) => openAt("swipes", event.currentTarget)}
          >
            {swipeIndex + 1} / {count}
            <ChevronDown size={11} />
          </button>
          <button
            type="button"
            aria-label={
              swipeIndex < count - 1
                ? localizeUi("ui.chat.swipejumpcontrol.nextSwipe")
                : localizeUi("ui.overhaul.ovrpmessagefooter.generateAnotherSwipe")
            }
            title={
              swipeIndex < count - 1
                ? localizeUi("ui.chat.swipejumpcontrol.nextSwipe")
                : localizeUi("ui.overhaul.ovrpmessagefooter.generateAnotherSwipe")
            }
            disabled={swipeIndex >= count - 1 && !onCreateSwipe}
            onClick={() => (swipeIndex < count - 1 ? onSetSwipe(swipeIndex + 1) : onCreateSwipe?.())}
          >
            <ChevronRight size={15} />
          </button>
        </span>
      ) : null}
      {meta && part === "all" ? <span className="ov-rpf__meta">{meta}</span> : null}
      {part === "all" ? <span className="ov-rpf__grow" /> : null}
      {part === "all" && onRegenerate ? (
        <button
          type="button"
          className="ov-rpf__btn is-accent"
          title={localizeUi("ui.agents.secretplotpanel.regenerate")}
          aria-label={localizeUi("ui.agents.secretplotpanel.regenerate")}
          onClick={onRegenerate}
        >
          <RefreshCw size={14} />
        </button>
      ) : null}
      {part !== "generate" ? (
        <>
          <button
            type="button"
            className="ov-rpf__btn"
            title={localizeUi("chat.settingsProfile.builder.edit")}
            aria-label={localizeUi("chat.settingsProfile.builder.edit")}
            onClick={onEdit}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className="ov-rpf__btn"
            title={localizeUi("lorebook.editor.batch.copy")}
            aria-label={localizeUi("lorebook.editor.batch.copy")}
            onClick={onCopy}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          {onBranch ? (
            <button
              type="button"
              className="ov-rpf__btn"
              title={localizeUi("ui.chat.chatmessage.branchFromHere")}
              aria-label={localizeUi("ui.chat.chatmessage.branchFromHere")}
              onClick={onBranch}
            >
              <GitBranch size={14} />
            </button>
          ) : null}
          <button
            type="button"
            className={cn("ov-rpf__btn", (open?.kind === "more" || open?.kind === "marks") && "is-on")}
            title={localizeUi("connections.accounts.header.more")}
            aria-label={localizeUi("connections.accounts.header.more")}
            aria-expanded={open?.kind === "more" || open?.kind === "marks"}
            onClick={(event) => openAt("more", event.currentTarget)}
          >
            <MoreHorizontal size={15} />
          </button>
        </>
      ) : null}
      {open?.kind === "more" ? (
        <FooterPopover anchor={open.anchor} onClose={() => setOpen(null)} className="ov-rpf-menu">
          <p className="ov-rpf-pop__label">{localizeUi("ui.overhaul.ovrpmessagefooter.messageActions")}</p>
          <div className="contents" onClickCapture={closeAfterAction(() => setOpen(null))}>
            <OvMarksMenuContext.Provider
              value={marksPanel ? () => setOpen({ kind: "marks", anchor: { ...open.anchor } }) : null}
            >
              {more}
            </OvMarksMenuContext.Provider>
          </div>
        </FooterPopover>
      ) : null}
      {open?.kind === "marks" && marksPanel ? (
        <FooterPopover anchor={open.anchor} onClose={() => setOpen(null)} className="ov-rpf-menu ov-marks-pop">
          {marksPanel({
            back: () => setOpen({ kind: "more", anchor: { ...open.anchor } }),
            done: () => setOpen(null),
          })}
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
