// ──────────────────────────────────────────────
// PickerWindow: the floating picker window shared by the character, persona,
// preset and lorebook pickers. On desktop a popover anchored to its trigger;
// on a phone a bottom sheet (Modal), except inside a Modal, where it stays a popover so two sheets never
// stack (S.O.U.P.). Escape and an outside click close it;
// clicks on the anchor are left to the trigger, so the trigger can toggle it.
// ──────────────────────────────────────────────
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useBackDismiss } from "../../hooks/use-back-dismiss";
import { cn } from "../../lib/utils";
import { Modal } from "./Modal";
import { useInsideModal } from "./modal-context";
import { useUIStore } from "../../stores/ui.store";
import { NEUTRAL_SURFACE_VARIABLES } from "./neutral-surface-styles";
import { scrollPickedRow } from "./PickerParts";

// Where Modal turns into a bottom sheet, so a picker and the dialogs around it switch at the same width.
const PHONE_QUERY = "(max-width: 639px)";

type Placement = { left: number; width: number; maxHeight: number; top?: number; bottom?: number };

/**
 * The popover hugs its rows: as wide as the widest one needs, at least the field's width, at most 352 px (or the
 * field's width when that is wider). Measured once when it opens, so it doesn't jump while the search filters rows.
 */
function fitWidth(anchor: HTMLElement, panel: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const max = Math.min(Math.max(rect.width, 352), window.innerWidth - 16);
  panel.style.width = "max-content";
  const natural = panel.offsetWidth;
  panel.style.width = "";
  return Math.max(Math.min(rect.width, max), Math.min(max, natural));
}

/** Popover next to the anchor: below it, or above when there is more room there. */
function place(anchor: HTMLElement, width: number): Placement {
  const rect = anchor.getBoundingClientRect();
  const viewport = window.visualViewport;
  const top = viewport?.offsetTop ?? 0;
  const bottom = top + (viewport?.height ?? window.innerHeight);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const below = bottom - rect.bottom - 12;
  const above = rect.top - top - 12;
  const openAbove = below < 320 && above > below;
  const maxHeight = Math.max(160, Math.min(448, openAbove ? above : below));
  return openAbove
    ? { left, width, maxHeight, bottom: window.innerHeight - rect.top + 4 }
    : { left, width, maxHeight, top: rect.bottom + 4 };
}

/**
 * The boxes that clip the anchor: its scrolling ancestors. Read once when the popover opens, since
 * reading computed styles on every scroll event costs more than the check itself.
 */
function clippingBoxes(anchor: HTMLElement): HTMLElement[] {
  const boxes: HTMLElement[] = [];
  for (let el = anchor.parentElement; el && el !== document.body; el = el.parentElement) {
    const style = getComputedStyle(el);
    // A box without size (display: contents) clips nothing.
    if (style.display === "contents" || el.clientHeight === 0) continue;
    if (/auto|scroll|hidden|clip/.test(style.overflowX + style.overflowY)) boxes.push(el);
  }
  return boxes;
}

/** The anchor's middle has left what its clipping boxes show (a native dropdown closes then too). */
function scrolledOutOfView(anchor: HTMLElement, boxes: readonly HTMLElement[]) {
  const rect = anchor.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  if (y < 0 || y > window.innerHeight) return true;
  return boxes.some((box) => {
    const clip = box.getBoundingClientRect();
    return y < clip.top || y > clip.bottom || x < clip.left || x > clip.right;
  });
}

export function PickerWindow({
  title,
  anchorRef,
  onClose,
  className,
  hug,
  children,
}: {
  title: string;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  className?: string;
  /** Phone sheet hugs its rows instead of standing at 85% height (S.O.U.P.: hug by default, large for lists). For short lists without search. */
  hug?: boolean;
  children: ReactNode;
}) {
  const insideModal = useInsideModal();
  const [phone] = useState(
    () => !insideModal && typeof window !== "undefined" && !!window.matchMedia?.(PHONE_QUERY).matches,
  );
  // Back closes the popover first (on a phone inside a Modal it sits over that sheet); the sheet path is a Modal and registers itself.
  useBackDismiss(!phone, onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  // Opened from the omnibar (its settings), the popover takes the omnibar's layer, as a Modal does, or it opens beneath it.
  const [overOmnibar] = useState(() => useUIStore.getState().omnibarOpen);
  // Inside a Modal on the omnibar layer or above it, the popover and the phone sheet join that layer.
  const [hostLayer] = useState<"omnibar" | "top" | undefined>(() => {
    const host = anchorRef.current?.closest<HTMLElement>(".mari-modal");
    if (!host) return undefined;
    const hostZ = Number.parseInt(getComputedStyle(host).zIndex, 10);
    const omnibarZ = Number.parseInt(
      getComputedStyle(document.documentElement).getPropertyValue("--mari-layer-omnibar"),
      10,
    );
    return hostZ > omnibarZ ? "top" : hostZ === omnibarZ ? "omnibar" : undefined;
  });
  const [pos, setPos] = useState<Placement | null>(null);
  const widthRef = useRef<number | null>(null);
  // The scroll listener below is set up once per open; it reads the latest onClose from here.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    if (phone) return;
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      if (widthRef.current === null && panelRef.current) widthRef.current = fitWidth(anchor, panelRef.current);
      // The measured width stays; a narrower window since then still caps it.
      setPos(place(anchor, Math.min(widthRef.current ?? 352, window.innerWidth - 16)));
    };
    update();
    const boxes = anchorRef.current ? clippingBoxes(anchorRef.current) : [];
    // Only a field that was in view when the popover opened closes it by leaving; an odd layout that already
    // clips the field never closes it on the first scroll.
    const startedInView = !!anchorRef.current && !scrolledOutOfView(anchorRef.current, boxes);
    // Scrolling the field out of view (the chat settings window, a long form) closes the popover, or it would
    // follow the field past the window's edge and float over whatever is there.
    const onScroll = (event: Event) => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      // The popover's own list scrolling never moves the field.
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
      if (startedInView && scrolledOutOfView(anchor, boxes)) onCloseRef.current();
      else update();
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", onScroll, true);
    window.visualViewport?.addEventListener("resize", update);
    // The trigger also moves when the layout around it changes size (a centred wizard growing as
    // lorebooks are picked), which fires neither event; watching its ancestors catches that.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    for (let el = anchorRef.current?.parentElement; el && el !== document.body; el = el.parentElement) {
      observer?.observe(el);
    }
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", onScroll, true);
      window.visualViewport?.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [phone, anchorRef]);

  // Close on a click outside the popover or its trigger, and on Escape.
  useEffect(() => {
    if (phone) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [phone, anchorRef, onClose]);

  // autoFocus misses the search box while the popover is still hidden, so focus it once placed.
  const placed = pos !== null;
  useEffect(() => {
    const panel = panelRef.current;
    if (!placed || !panel || panel.contains(document.activeElement)) return;
    const search = window.matchMedia?.("(pointer: fine)").matches ? panel.querySelector("input") : null;
    // A list without a search box takes the keys itself.
    const keys = panel.querySelector<HTMLElement>("[data-picker-keys]");
    (search ?? keys ?? panel).focus();
    // The list could not scroll before the popover had its height, so bring the picked row into view now.
    scrollPickedRow(panel.querySelector<HTMLElement>("[data-picker-list]"));
  }, [placed]);

  if (phone) {
    // A tap in the sheet must not reach the host's outside-click handler (a floating menu like the message note
    // menu), or the host closes and unmounts the field before the pick lands. React events bubble through the portal
    // to this wrapper, so stopping here keeps them from the document, as the popover's own onPointerDown does.
    return (
      <div className="contents" onPointerDown={(event) => event.stopPropagation()}>
        <Modal
          open
          onClose={onClose}
          layer={hostLayer}
          title={title}
          width="max-w-md"
          restoreFocusRef={anchorRef}
          // Same accent tint over the panel colour as the desktop window below. Important, because the
          // opaque-modal rule (.mari-modal--opaque .mari-modal-panel) sets its own background-image.
          panelClassName={`max-sm:mt-auto ${hug ? "" : "max-sm:h-[85dvh]"} max-sm:rounded-b-none bg-[image:linear-gradient(var(--secondary),var(--secondary)),linear-gradient(var(--marinara-chat-chrome-panel-bg),var(--marinara-chat-chrome-panel-bg))]!`}
          contentClassName="flex flex-col !overflow-hidden !p-0"
        >
          {children}
        </Modal>
      </div>
    );
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label={title}
      data-chat-floating-panel
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
        event.stopPropagation();
        onClose();
      }}
      className={cn(
        // Portaled to <body>, so it re-applies the neutral chrome tokens its host (wizard, drawer) sits in;
        // without them --secondary falls back to the theme's raw navy. That tint is translucent (it is
        // made to sit on a panel, like the preset dropdown), so it is layered over the panel colour, blurred like
        // every neutral panel shell. The panel colour is stacked twice (~98% opaque) so sharp lines underneath,
        // like the wizard's footer divider, don't show through.
        "fixed flex flex-col overflow-hidden outline-none rounded-xl border border-[var(--border)] bg-[var(--marinara-chat-chrome-panel-bg)] bg-[image:linear-gradient(var(--secondary),var(--secondary)),linear-gradient(var(--marinara-chat-chrome-panel-bg),var(--marinara-chat-chrome-panel-bg))] text-[var(--foreground)] shadow-2xl backdrop-blur-md",
        hostLayer === "top"
          ? "z-[calc(var(--mari-layer-omnibar)+2)]"
          : hostLayer || overOmnibar
            ? "z-(--mari-layer-omnibar)"
            : "z-[10050]",
        NEUTRAL_SURFACE_VARIABLES,
        className,
      )}
      style={
        pos
          ? {
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
              ...(pos.top !== undefined ? { top: pos.top } : { bottom: pos.bottom }),
            }
          : { visibility: "hidden", left: 0, top: 0 }
      }
    >
      <div className="flex h-10 shrink-0 items-center px-3.5">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>,
    document.body,
  );
}
