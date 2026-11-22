// ──────────────────────────────────────────────
// UI overhaul: roleplay message footer (mockup "RP B", with RP C's menus)
//
// One thin line at the bottom of a reply: swipe arrows and counter on the
// left, Regenerate / Edit / Copy / Branch and More on the right. It shows on
// hover (or while one of its menus is open). The counter opens a
// swipe list you can read before picking; More opens every action not already
// on the message (the upstream action buttons, shown as a labelled menu).
// ──────────────────────────────────────────────
import { useArmedAfterPaint } from "../../lib/idle-batch";
import { useFollowBubble } from "../../lib/follow-bubble";
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
  ListOrdered,
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
import { DEFAULT_MESSAGE_BUTTONS, type MessageButtonId } from "./message-buttons";
import { useTranslation as useUiTranslation } from "react-i18next";
import { menuOpenerFromClick, openMessageMoreFromMenuKey, useMenuKeyboard } from "../../hooks/use-menu-keyboard";

type Anchor = {
  left: number;
  top: number;
  bottom: number;
  right: number;
  alignRight?: boolean;
  /** The button that opened it: Escape and a run item hand focus back to it. */
  opener?: HTMLElement | null;
  /** Opened from the keyboard: focus starts on the first item (A11Y1). */
  keyboard?: boolean;
};

/** A popover in a portal, so the bubble's overflow cannot clip it. Opens above the button when there is no room below. */
export function FooterPopover({
  anchor,
  onClose,
  className,
  menu = false,
  label,
  children,
}: {
  anchor: Anchor;
  onClose: () => void;
  className?: string;
  /** A list of actions (the ⋯ menu): announced as a menu, its buttons as menu items. */
  menu?: boolean;
  label?: string;
  children: ReactNode;
}) {
  // One keyboard behaviour for every menu (hooks/use-menu-keyboard): arrows move, Escape returns to ⋯.
  const keys = useMenuKeyboard({
    open: true,
    onClose,
    trigger: anchor.opener ?? null,
    initialFocus: anchor.keyboard ? "first" : null,
  });
  const ref = keys.menuRef;
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
  }, [anchor, ref]);
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
  }, [onClose, ref]);
  return createPortal(
    <div
      ref={ref}
      className={cn("ov-rpf-pop", className)}
      style={style}
      role={menu ? "menu" : "dialog"}
      aria-label={label}
    >
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
  speak,
  shown = DEFAULT_MESSAGE_BUTTONS.roleplay,
  toolsExtra,
  generateExtra,
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
  /** Every action not on the bars, rendered inside the More menu; null hides More. */
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
  /** Speak button, left of Regenerate; only passed while a voice model is set up (and picked to show). */
  speak?: ReactNode;
  /** The buttons picked to sit on the message (Settings > Chatting > Message buttons); the rest stay in More. */
  shown?: readonly MessageButtonId[];
  /** More picked buttons for the top bar (before More), such as Delete or Hide from AI. */
  toolsExtra?: ReactNode;
  /** More picked buttons for the bottom bar (before Regenerate), such as Translate. */
  generateExtra?: ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState<null | { kind: "more" | "swipes" | "marks"; anchor: Anchor }>(null);
  // Bookmark on the bar: the same marks form as in More, under the bar's right end.
  const openMarksFromBar = () => {
    const r = rootRef.current?.getBoundingClientRect();
    if (!r) return;
    setOpen((current) =>
      current?.kind === "marks"
        ? null
        : { kind: "marks", anchor: { left: r.right - 240, top: r.top, bottom: r.bottom, right: r.right } },
    );
  };
  const openAt = (kind: "more" | "swipes", el: HTMLElement, keyboard = false) => {
    if (open?.kind === kind || (kind === "more" && open?.kind === "marks")) return setOpen(null);
    const r = el.getBoundingClientRect();
    setOpen({
      kind,
      anchor: {
        opener: el,
        keyboard,
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
  // Under the message: line up with the bubble's edge, not the row's, when bubbles don't fill the row.
  useFollowBubble(
    rootRef,
    (bar) => bar.parentElement?.querySelector<HTMLElement>(':scope > [data-mari-part="bubble"]') ?? null,
    placement === "below" && armed,
    `${swipeCount}-${swipeIndex}`,
    // ...and its last button (›) sits right under the top bar's ⋯, wherever the theme puts that bar.
    (bar) =>
      bar.closest("[data-message-id]")?.querySelector<HTMLElement>(".ov-rpf--tools > button:last-of-type") ?? null,
  );
  const count = Math.max(1, swipeCount);
  const hasSwipes = swipeCount > 1;
  const show = (id: MessageButtonId) => shown.includes(id);
  const regenerate = show("regenerate") ? onRegenerate : undefined;
  const swipesOnBar = show("swipes") && (hasSwipes || !!onCreateSwipe);
  // Swipes left off the bar: More lists them, so the other versions stay one click away.
  const swipesInMenu = !show("swipes") && (hasSwipes || !!onCreateSwipe);
  if (part === "generate" && !speak && !generateExtra && !regenerate && !swipesOnBar) return null;
  const footerClassName = cn(
    "ov-rpf",
    placement === "below" && "ov-rpf--below",
    part !== "all" && `ov-rpf--${part}`,
    pinned && "is-pinned",
    open && "is-open",
  );
  if (!armed) return <div className={footerClassName} data-ov-rp-footer data-mari-part="actions" />;
  return (
    <div
      ref={rootRef}
      className={footerClassName}
      data-ov-rp-footer
      data-mari-part="actions"
      onContextMenu={openMessageMoreFromMenuKey}
    >
      {part === "generate" ? speak : null}
      {part === "generate" ? generateExtra : null}
      {part === "generate" && regenerate ? (
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
      {part !== "tools" && swipesOnBar ? (
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
            onClick={(event) => openAt("swipes", event.currentTarget, event.detail === 0)}
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
      {part === "all" ? speak : null}
      {part === "all" ? generateExtra : null}
      {part === "all" && regenerate ? (
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
          {show("edit") ? (
            <button
              type="button"
              className="ov-rpf__btn"
              title={localizeUi("chat.settingsProfile.builder.edit")}
              aria-label={localizeUi("chat.settingsProfile.builder.edit")}
              onClick={onEdit}
            >
              <Pencil size={14} />
            </button>
          ) : null}
          {show("copy") ? (
            <button
              type="button"
              className="ov-rpf__btn"
              title={localizeUi("lorebook.editor.batch.copy")}
              aria-label={localizeUi("lorebook.editor.batch.copy")}
              onClick={onCopy}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          ) : null}
          {onBranch && show("branch") ? (
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
          {toolsExtra ? (
            <OvMarksMenuContext.Provider value={marksPanel ? openMarksFromBar : null}>
              {toolsExtra}
            </OvMarksMenuContext.Provider>
          ) : null}
          {more || swipesInMenu ? (
            <button
              type="button"
              className={cn("ov-rpf__btn", (open?.kind === "more" || open?.kind === "marks") && "is-on")}
              title={localizeUi("connections.accounts.header.more")}
              aria-label={localizeUi("connections.accounts.header.more")}
              aria-expanded={open?.kind === "more" || open?.kind === "marks"}
              aria-haspopup="menu"
              data-message-more=""
              onClick={(event) => openAt("more", event.currentTarget, event.detail === 0)}
            >
              <MoreHorizontal size={15} />
            </button>
          ) : null}
        </>
      ) : null}
      {open?.kind === "more" ? (
        <FooterPopover
          anchor={open.anchor}
          onClose={() => setOpen(null)}
          className="ov-rpf-menu"
          menu
          label={localizeUi("ui.overhaul.ovrpmessagefooter.messageActions")}
        >
          <p className="ov-rpf-pop__label" aria-hidden="true">
            {localizeUi("ui.overhaul.ovrpmessagefooter.messageActions")}
          </p>
          {swipesInMenu ? (
            <div className="mari-message-actions">
              <button
                type="button"
                title={localizeUi("ui.overhaul.messagebuttons.swipesInMenu", { current: swipeIndex + 1, count })}
                aria-label={localizeUi("ui.overhaul.messagebuttons.swipesInMenu", { current: swipeIndex + 1, count })}
                onClick={() => setOpen({ kind: "swipes", anchor: { ...open.anchor, alignRight: true } })}
              >
                <ListOrdered size={14} />
              </button>
            </div>
          ) : null}
          <div className="contents" onClickCapture={closeAfterAction(() => setOpen(null))}>
            <OvMarksMenuContext.Provider
              value={
                marksPanel
                  ? () =>
                      setOpen({
                        kind: "marks",
                        anchor: { ...open.anchor, keyboard: menuOpenerFromClick().keyboard },
                      })
                  : null
              }
            >
              {more}
            </OvMarksMenuContext.Provider>
          </div>
        </FooterPopover>
      ) : null}
      {open?.kind === "marks" && marksPanel ? (
        <FooterPopover anchor={open.anchor} onClose={() => setOpen(null)} className="ov-rpf-menu ov-marks-pop">
          {marksPanel({
            back: () => setOpen({ kind: "more", anchor: { ...open.anchor, keyboard: menuOpenerFromClick().keyboard } }),
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
