import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Lock, MoreHorizontal, Unlock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { WindowBubble } from "../ui/WindowBubble";
import { usePhoneBubbleBounds } from "../ui/FloatingWindow";
import {
  PHONE_BUBBLE_GAP_PX,
  PHONE_BUBBLE_SIZE_PX,
  getPhoneBubbleSlot,
  type WindowPoint,
} from "../../lib/floating-window-layout";
import { PHONE_BUBBLE_Z_INDEX, useFloatingWindowStore } from "../../stores/floating-window.store";
import { CHAT_TOOLS_MENU_ID, useChatToolsMenuStore, type ChatToolsMenuEntry } from "../../stores/chat-tools-menu.store";

function ToolButton({
  entry,
  position,
  count,
  locked,
  onOpen,
  onMove,
}: {
  entry: ChatToolsMenuEntry;
  position: number;
  count: number;
  locked: boolean;
  onOpen: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const { t } = useTranslation();
  const dragControls = useDragControls();
  const hintId = useId();
  const suppressClick = useRef(false);
  return (
    <Reorder.Item
      value={entry.id}
      dragListener={false}
      dragControls={dragControls}
      drag={locked ? false : "y"}
      data-chat-tools-menu-item={entry.id}
      className="relative flex min-h-[44px] shrink-0 items-center justify-center"
      style={{ paddingBlock: PHONE_BUBBLE_GAP_PX / 2 }}
      aria-posinset={position}
      aria-setsize={count}
      onDragStart={() => {
        suppressClick.current = true;
      }}
      onDragEnd={() => {
        // A drag must not open its tool. A later deliberate tap still should.
        window.setTimeout(() => {
          suppressClick.current = false;
        }, 0);
      }}
    >
      <button
        type="button"
        aria-label={entry.label}
        aria-describedby={locked ? undefined : hintId}
        title={entry.label}
        data-chat-tools-menu-tool={entry.id}
        data-presentation="sheet"
        data-locked={locked ? "true" : "false"}
        className="mari-window-bubble mari-chat-tools-button relative shrink-0"
        onClick={() => {
          if (!suppressClick.current) onOpen();
        }}
        onPointerDown={(event) => {
          if (!locked && event.button === 0)
            dragControls.start(event, { distanceThreshold: event.pointerType === "touch" ? 10 : 4 });
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          event.stopPropagation();
          if (locked) return;
          onMove(event.key === "ArrowUp" ? -1 : 1);
          const button = event.currentTarget;
          requestAnimationFrame(() => button.scrollIntoView({ block: "nearest" }));
        }}
      >
        <span className="mari-window-bubble__paint pointer-events-none" aria-hidden="true" />
        <span className="mari-window-bubble__icon [&_svg]:size-4">{entry.icon}</span>
        {entry.badge}
      </button>
      <span id={hintId} className="sr-only">
        {t("chat.toolsMenu.reorder", { name: entry.label, position, count })}
      </span>
    </Reorder.Item>
  );
}

/** One phone launcher for Chat Settings tools; their existing sheets keep ownership of their content. */
export function ChatToolsMenu() {
  const { t } = useTranslation();
  const bounds = usePhoneBubbleBounds(true);
  const entries = useChatToolsMenuStore((state) => state.entries);
  const menu = useFloatingWindowStore((state) => state.phoneMenu);
  const points = useFloatingWindowStore((state) => state.phoneBubbles);
  const resetRevision = useFloatingWindowStore((state) => state.resetRevision);
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(PHONE_BUBBLE_SIZE_PX);
  const [placed, setPlaced] = useState<WindowPoint>(() => getPhoneBubbleSlot(bounds, 1, size));
  const bubbleRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const locked = menu?.locked === true;
  const savedOrder = menu?.order ?? [];
  // Existing saved phone rows provide a familiar initial order; new tools follow by stable id.
  const ids = Object.keys(entries).sort((left, right) => {
    const leftIndex = savedOrder.indexOf(left);
    const rightIndex = savedOrder.indexOf(right);
    if (leftIndex >= 0 || rightIndex >= 0)
      return (leftIndex < 0 ? Infinity : leftIndex) - (rightIndex < 0 ? Infinity : rightIndex);
    const a = points[left];
    const b = points[right];
    if (a && b) return a.y - b.y || a.x - b.x || left.localeCompare(right);
    return Number(!a) - Number(!b) || left.localeCompare(right);
  });
  const hasEntries = ids.length > 0;
  const updatePosition = useCallback((point: WindowPoint) => {
    setPlaced((current) => (current.x === point.x && current.y === point.y ? current : point));
  }, []);
  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) bubbleRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => setOpen(false), [resetRevision, hasEntries]);
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus({ preventScroll: true });
    const onOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || panelRef.current?.contains(target) || bubbleRef.current?.contains(target))
        return;
      close(false);
    };
    document.addEventListener("pointerdown", onOutside, true);
    return () => document.removeEventListener("pointerdown", onOutside, true);
  }, [close, open]);

  if (!hasEntries) return null;

  // Keep the same single column of icons as the old mobile toolbar, with enough
  // space around their 44px touch targets to scroll past an unlocked drag button.
  // Split the snap gap across rows so focus rings and 44px touch targets stay inside the scroller.
  const rowSize = Math.max(44, size + PHONE_BUBBLE_GAP_PX);
  const launcherGap = (rowSize - size) / 2;
  const width = Math.min(Math.max(44, size) + 32, Math.max(0, bounds.right - bounds.left));
  // The launcher already keeps visible buttons in bounds; don't shift their column for invisible scroll padding.
  const centeredLeft = placed.x + (size - width) / 2;
  const below = bounds.bottom - placed.y - size - launcherGap;
  const above = placed.y - bounds.top - launcherGap;
  const placeBelow = below >= Math.min(240, rowSize * (ids.length + 1)) || below >= above;
  const available = Math.max(0, placeBelow ? below : above);
  // With the keyboard open, a short viewport may only leave room beside the
  // trigger. Use that space without covering the button that collapses the stack.
  const sideLeft = placed.x - width - PHONE_BUBBLE_GAP_PX;
  const sideRight = placed.x + size + PHONE_BUBBLE_GAP_PX;
  const beside = available < rowSize * 2 && (sideLeft >= bounds.left || sideRight + width <= bounds.right);
  const left = beside ? (sideLeft >= bounds.left ? sideLeft : sideRight) : centeredLeft;
  const top = beside ? bounds.top : placeBelow ? placed.y + size + launcherGap : placed.y - launcherGap;
  const maxHeight = Math.max(0, beside ? bounds.bottom - bounds.top : available);
  const reorder = (order: string[]) => useFloatingWindowStore.getState().savePhoneMenuOrder(order);

  return (
    <>
      <WindowBubble
        id={CHAT_TOOLS_MENU_ID}
        buttonRef={bubbleRef}
        point={points[CHAT_TOOLS_MENU_ID] ?? { ...getPhoneBubbleSlot(bounds, 1, size), automatic: true }}
        bounds={bounds}
        size={PHONE_BUBBLE_SIZE_PX}
        onSizeChange={setSize}
        onPositionChange={updatePosition}
        icon={<MoreHorizontal size={18} />}
        label={t("chat.toolsMenu.title")}
        ariaLabel={t("chat.toolsMenu.title")}
        expanded={open}
        locked={locked}
        zIndex={PHONE_BUBBLE_Z_INDEX}
        attributes={{ "data-presentation": "sheet", "data-chat-tools-menu-button": true }}
        onMove={(point) => useFloatingWindowStore.getState().savePhoneBubble(CHAT_TOOLS_MENU_ID, point)}
        onOpen={() => setOpen((current) => !current)}
      />
      {open && (
        <div
          ref={panelRef}
          role="group"
          aria-label={t("chat.toolsMenu.title")}
          tabIndex={-1}
          data-chat-tools-menu
          data-presentation="menu"
          data-locked={locked ? "true" : "false"}
          data-no-intuitive-swipe
          className="fixed flex min-h-0 flex-col items-center outline-none"
          style={{
            left,
            top,
            width,
            maxHeight,
            transform: !beside && !placeBelow ? "translateY(-100%)" : undefined,
            zIndex: PHONE_BUBBLE_Z_INDEX + 1,
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || event.defaultPrevented) return;
            event.preventDefault();
            event.stopPropagation();
            close(true);
          }}
        >
          <div
            className="flex min-h-[44px] shrink-0 items-center justify-center"
            style={{ paddingBlock: PHONE_BUBBLE_GAP_PX / 2 }}
          >
            <button
              type="button"
              data-window-control="lock"
              data-presentation="sheet"
              aria-label={t(locked ? "chat.toolsMenu.unlock" : "chat.toolsMenu.lock")}
              title={t(locked ? "chat.toolsMenu.unlock" : "chat.toolsMenu.lock")}
              aria-pressed={locked}
              className="mari-window-bubble mari-chat-tools-button relative shrink-0"
              onClick={() => useFloatingWindowStore.getState().setPhoneMenuLocked(!locked)}
            >
              <span className="mari-window-bubble__paint pointer-events-none" aria-hidden="true" />
              <span className="mari-window-bubble__icon">{locked ? <Lock size={16} /> : <Unlock size={16} />}</span>
            </button>
          </div>
          <Reorder.Group
            axis="y"
            values={ids}
            onReorder={reorder}
            layoutScroll
            className="flex min-h-0 w-full flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-4"
          >
            {ids.map((id, index) => (
              <ToolButton
                key={id}
                entry={entries[id]!}
                position={index + 1}
                count={ids.length}
                locked={locked}
                onOpen={() => {
                  close(false);
                  useFloatingWindowStore.getState().openWindow(id, bubbleRef.current);
                }}
                onMove={(direction) => {
                  const nextIndex = index + direction;
                  if (nextIndex < 0 || nextIndex >= ids.length) return;
                  const next = [...ids];
                  [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
                  reorder(next);
                }}
              />
            ))}
          </Reorder.Group>
        </div>
      )}
    </>
  );
}
