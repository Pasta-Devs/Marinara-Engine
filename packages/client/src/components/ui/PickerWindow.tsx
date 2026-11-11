// ──────────────────────────────────────────────
// PickerWindow: the floating picker window shared by the character, persona,
// preset and lorebook pickers. On desktop a popover anchored to its trigger;
// on a phone a bottom sheet (Modal). Escape and an outside click close it;
// clicks on the anchor are left to the trigger, so the trigger can toggle it.
// ──────────────────────────────────────────────
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import { Modal } from "./Modal";
import { NEUTRAL_SURFACE_VARIABLES } from "./neutral-surface-styles";

const PHONE_QUERY = "(max-width: 767px)";

type Placement = { left: number; width: number; maxHeight: number; top?: number; bottom?: number };

/** Popover next to the anchor: below it, or above when there is more room there. */
function place(anchor: HTMLElement): Placement {
  const rect = anchor.getBoundingClientRect();
  const viewport = window.visualViewport;
  const top = viewport?.offsetTop ?? 0;
  const bottom = top + (viewport?.height ?? window.innerHeight);
  const width = Math.min(Math.max(rect.width, 352), window.innerWidth - 16);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const below = bottom - rect.bottom - 12;
  const above = rect.top - top - 12;
  const openAbove = below < 320 && above > below;
  const maxHeight = Math.max(160, Math.min(448, openAbove ? above : below));
  return openAbove
    ? { left, width, maxHeight, bottom: window.innerHeight - rect.top + 4 }
    : { left, width, maxHeight, top: rect.bottom + 4 };
}

export function PickerWindow({
  title,
  anchorRef,
  onClose,
  className,
  children,
}: {
  title: string;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const [phone] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(PHONE_QUERY).matches);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Placement | null>(null);

  useLayoutEffect(() => {
    if (phone) return;
    const update = () => anchorRef.current && setPos(place(anchorRef.current));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    // The trigger also moves when the layout around it changes size (a centred wizard growing as
    // lorebooks are picked), which fires neither event; watching its ancestors catches that.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    for (let el = anchorRef.current?.parentElement; el && el !== document.body; el = el.parentElement) {
      observer?.observe(el);
    }
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
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
    (search ?? panel).focus();
  }, [placed]);

  if (phone) {
    return (
      <Modal
        open
        onClose={onClose}
        title={title}
        width="max-w-md"
        restoreFocusRef={anchorRef}
        // Same accent tint over the panel colour as the desktop window below. Important, because the
        // opaque-modal rule (.mari-modal--opaque .mari-modal-panel) sets its own background-image.
        panelClassName="max-md:mt-auto max-md:h-[85dvh] max-md:rounded-b-none bg-[image:linear-gradient(var(--secondary),var(--secondary)),linear-gradient(var(--marinara-chat-chrome-panel-bg),var(--marinara-chat-chrome-panel-bg))]!"
        contentClassName="flex flex-col !overflow-hidden !p-0"
      >
        {children}
      </Modal>
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
        "fixed z-[10050] flex flex-col overflow-hidden outline-none rounded-xl border border-[var(--border)] bg-[var(--marinara-chat-chrome-panel-bg)] bg-[image:linear-gradient(var(--secondary),var(--secondary)),linear-gradient(var(--marinara-chat-chrome-panel-bg),var(--marinara-chat-chrome-panel-bg))] text-[var(--foreground)] shadow-2xl backdrop-blur-md",
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
          : { visibility: "hidden" }
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
