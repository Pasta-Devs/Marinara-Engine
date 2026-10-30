import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";
import { useMatchMedia } from "../../../hooks/use-match-media";
import {
  CHAT_VISUAL_VIEWPORT_CHANGE_EVENT,
  type ChatVisualViewportChangeDetail,
} from "../../../hooks/use-visual-viewport-chat-bottom";
import {
  MARI_COMPANION_WIDTH_MAX_REM,
  MARI_COMPANION_WIDTH_MIN_REM,
  normalizeMariCompanionWidthRem,
  useUIStore,
} from "../../../stores/ui.store";

const GAP_PX = 12;
/** The editor's field column keeps at least this much room; the panel stops growing first. */
const MIN_COLUMN_REM = 24;

export type MariCompanionShape = "panel" | "sheet";
export type MariSheetSnap = "peek" | "half" | "full";
const SNAPS: MariSheetSnap[] = ["peek", "half", "full"];

// The omnibar remounts per open: these outlive it, so one held change auto-peeks only once.
let handledWaitingKey: string | null = null;
let peekSheet: (() => void) | null = null;
// Set when a drag ends on a new snap, so that snap lands without the glide.
let sheetReleased = false;

/** Drops the open sheet to peek and scrolls the editor to the first field of her held change.
 *  False when she is not a sheet or the editor shows another character. */
export function revealWaitingField(): boolean {
  const ui = useUIStore.getState();
  const field = ui.mariFieldReview?.mode === "waiting" ? ui.mariFieldReview.fields[0] : undefined;
  if (!peekSheet || !field || ui.characterDetailId !== field.characterId) return false;
  peekSheet();
  ui.revealMariField(field.characterId, field.fieldId);
  return true;
}

const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
const halfRem = (value: number) => Math.floor(value * 2) / 2;

/**
 * Prof. Mari's desktop companion: while an editor that opts in (`useMariCompanionEditor`) is open
 * and its shell has room for her panel plus a sane field column, her window becomes a solid panel
 * fixed at the left, 12px below the editor header bar. Only the editor's field column moves right,
 * as far as needed: shift = max(0, panelRight + gap - columnLeft); when room runs out it narrows.
 * `available` shows the dock toggle; `active` is the companion layout itself.
 */
export function useMariCompanion(mariSurface: boolean, panelRef: RefObject<HTMLElement | null>) {
  const desktop = useMatchMedia("(min-width: 1024px)");
  const root = useUIStore((s) => s.mariCompanionRoot);
  const docked = useUIStore((s) => s.mariCompanionDocked);
  const savedRem = useUIStore((s) => s.mariCompanionWidthRem);
  // Largest panel width the shell can draw; below the minimum the companion does not fit.
  const [maxRem, setMaxRem] = useState(MARI_COMPANION_WIDTH_MAX_REM);
  // Slice 6: below 1024px the companion is a bottom sheet under the editor instead.
  const available = mariSurface && root !== null && (!desktop || maxRem >= MARI_COMPANION_WIDTH_MIN_REM);
  const active = available && docked;
  const shape: MariCompanionShape | null = active ? (desktop ? "panel" : "sheet") : null;
  // The omnibar remounts per open, so every open starts at half height.
  const [snap, setSnap] = useState<MariSheetSnap>("half");
  const sheetHeight = useRef<number | null>(null);
  const waitingKey = useUIStore((s) => (s.mariFieldReview?.mode === "waiting" ? s.mariFieldReview.key : null));

  // A held change drops the sheet to peek, closes her keyboard and scrolls the first
  // changed field into view. Typing in an editor field keeps its focus and place.
  useEffect(() => {
    if (shape !== "sheet") return;
    peekSheet = () => setSnap("peek");
    return () => {
      peekSheet = null;
    };
  }, [shape]);
  useEffect(() => {
    if (shape !== "sheet" || !waitingKey || waitingKey === handledWaitingKey) return;
    handledWaitingKey = waitingKey;
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && root?.contains(focused)) {
      setSnap("peek");
      return;
    }
    if (focused instanceof HTMLElement && panelRef.current?.contains(focused)) focused.blur();
    // Another character's change waits for its own editor.
    if (!revealWaitingField()) handledWaitingKey = null;
  }, [shape, waitingKey, root, panelRef]);

  // The sheet covers the editor's bottom: a spacer as tall as the sheet ends the editor's
  // scroll root (CSS `[data-mari-sheet-host]::after`), so every field can scroll above it.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!root || shape !== "sheet" || !panel) return;
    root.dataset.mariSheetHost = "";
    const pad = () => {
      sheetHeight.current = panel.offsetHeight;
      root.style.setProperty("--mari-sheet-pad", `${panel.offsetHeight}px`);
    };
    pad();
    const observer = new ResizeObserver(pad);
    observer.observe(panel);
    return () => {
      observer.disconnect();
      sheetHeight.current = null;
      delete root.dataset.mariSheetHost;
      root.style.removeProperty("--mari-sheet-pad");
    };
  }, [root, shape, panelRef]);

  // A snap glides from the last height to the new one. Peek is `height: auto`, which CSS cannot
  // transition. A drag already moved the sheet, so its release lands at once. Height, not transform:
  // the editor's scroll pad and her chat follow the sheet's real height.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const running = panel?.getAnimations().filter((animation) => animation.id === "mari-sheet-snap") ?? [];
    if (shape !== "sheet" || !panel || sheetHeight.current === null) {
      running.forEach((animation) => animation.cancel());
      return;
    }
    const from = running.length > 0 ? panel.offsetHeight : sheetHeight.current;
    running.forEach((animation) => animation.cancel());
    const to = panel.offsetHeight;
    const skip =
      sheetReleased ||
      Math.abs(to - from) < 2 ||
      document.documentElement.hasAttribute("data-mari-software-keyboard-open") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sheetReleased = false;
    if (skip) return;
    const animation = panel.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      id: "mari-sheet-snap",
      duration: 220,
      easing: "ease-out",
    });
    // The keyboard rules set their own height, so a glide in flight stops when the keyboard opens.
    const onViewport = (event: Event) => {
      if ((event as CustomEvent<ChatVisualViewportChangeDetail>).detail.keyboardOpen) animation.cancel();
    };
    window.addEventListener(CHAT_VISUAL_VIEWPORT_CHANGE_EVENT, onViewport);
    return () => window.removeEventListener(CHAT_VISUAL_VIEWPORT_CHANGE_EVENT, onViewport);
  }, [snap, shape, panelRef]);
  const drawnRem = Math.max(MARI_COMPANION_WIDTH_MIN_REM, Math.min(savedRem, maxRem));

  // A drag previews its width here and only saves on release.
  const widthRef = useRef(savedRem);
  const placeRef = useRef(() => {});
  useLayoutEffect(() => {
    widthRef.current = savedRem;
    placeRef.current();
  }, [savedRem]);

  useLayoutEffect(() => {
    if (!root || !mariSurface || !desktop) return;
    const shell = root.closest<HTMLElement>(".mari-editor-shell") ?? root;
    const header = shell.querySelector<HTMLElement>(".mari-editor-header");
    const column = root.querySelector<HTMLElement>(":scope > .mari-editor-content-inner");
    // Static per editor; read once before any inline override.
    const columnMax = column ? parseFloat(getComputedStyle(column).maxWidth) || Infinity : Infinity;
    const rootStyle = getComputedStyle(root);
    const padLeft = parseFloat(rootStyle.paddingLeft);
    const padRight = parseFloat(rootStyle.paddingRight);

    const clearColumn = () => {
      if (!column) return;
      column.style.marginInlineStart = "";
      column.style.maxWidth = "";
    };

    const place = () => {
      const rem = remPx();
      const s = shell.getBoundingClientRect();
      const fit = halfRem(Math.min(MARI_COMPANION_WIDTH_MAX_REM, (s.width - 3 * GAP_PX) / rem - MIN_COLUMN_REM));
      setMaxRem(fit);
      const panel = panelRef.current;
      if (!active || !panel || fit < MARI_COMPANION_WIDTH_MIN_REM) return;
      const width = Math.max(MARI_COMPANION_WIDTH_MIN_REM, Math.min(widthRef.current, fit)) * rem;
      const top = (header?.getBoundingClientRect().bottom ?? s.top) + GAP_PX;
      // The column is centered by margin-inline: auto, so its natural left follows from the root's content box.
      const box = root.getBoundingClientRect();
      const contentLeft = box.left + root.clientLeft + padLeft;
      const contentWidth = root.clientWidth - padLeft - padRight;
      const columnWidth = Math.min(columnMax, contentWidth);
      const naturalLeft = contentLeft + (contentWidth - columnWidth) / 2;
      const shift = Math.max(0, Math.round(s.left + GAP_PX + width + GAP_PX - naturalLeft));

      panel.style.setProperty("--mari-companion-top", `${top}px`);
      panel.style.setProperty("--mari-companion-left", `${s.left + GAP_PX}px`);
      panel.style.setProperty(
        "--mari-companion-bottom",
        `${Math.max(GAP_PX, window.innerHeight - s.bottom + GAP_PX)}px`,
      );
      panel.style.setProperty("--mari-companion-width", `${width}px`);
      if (!column) return;
      if (!shift) return clearColumn();
      const left = naturalLeft + shift;
      column.style.marginInlineStart = `${left - contentLeft}px`;
      column.style.maxWidth = `${Math.max(0, Math.min(columnWidth, contentLeft + contentWidth - left))}px`;
    };

    placeRef.current = place;
    place();
    const observer = new ResizeObserver(place);
    observer.observe(shell);
    observer.observe(root);
    return () => {
      observer.disconnect();
      placeRef.current = () => {};
      clearColumn();
    };
  }, [root, mariSurface, desktop, active, panelRef]);

  const preview = (rem: number) => {
    widthRef.current = normalizeMariCompanionWidthRem(rem);
    placeRef.current();
  };

  return { available, active, desktop, shape, snap, setSnap, drawnRem, maxRem, preview };
}

/** Width handle on the panel's right edge (drag or arrow keys). The panel is never dragged. */
export function MariCompanionResizeHandle({
  panelRef,
  drawnRem,
  maxRem,
  preview,
}: {
  panelRef: RefObject<HTMLElement | null>;
  drawnRem: number;
  maxRem: number;
  preview: (rem: number) => void;
}) {
  const { t } = useTranslation();
  const setWidth = useUIStore((s) => s.setMariCompanionWidthRem);
  const clamp = (rem: number) => Math.max(MARI_COMPANION_WIDTH_MIN_REM, Math.min(maxRem, rem));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (!panel || event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    handle.dataset.dragging = "true";
    const left = panel.getBoundingClientRect().left;
    let width = drawnRem;
    const onMove = (move: globalThis.PointerEvent) => {
      width = clamp((move.clientX - left) / remPx());
      preview(width);
    };
    const onUp = () => {
      delete handle.dataset.dragging;
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      setWidth(width);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    setWidth(clamp(drawnRem + step));
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t("omnibar.companion.resize", "Resize Professor Mari")}
      aria-valuemin={MARI_COMPANION_WIDTH_MIN_REM}
      aria-valuemax={Math.max(MARI_COMPANION_WIDTH_MIN_REM, maxRem)}
      aria-valuenow={drawnRem}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className="mari-companion-resize"
    />
  );
}

/** Grab strip on top of the phone/tablet sheet: tap steps peek, half, full; a drag
 *  snaps to where it is let go; arrow keys grow or shrink it. */
export function MariSheetHandle({
  panelRef,
  snap,
  setSnap,
}: {
  panelRef: RefObject<HTMLElement | null>;
  snap: MariSheetSnap;
  setSnap: (snap: MariSheetSnap) => void;
}) {
  const { t } = useTranslation();
  const drag = useRef<{ startY: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const index = SNAPS.indexOf(snap);
  const valueText = {
    peek: t("omnibar.companion.sheetPeek", "Title only"),
    half: t("omnibar.companion.sheetHalf", "Half height"),
    full: t("omnibar.companion.sheetFull", "Full height"),
  }[snap];

  // Unmounting mid-drag must not leave the drag offset on her panel.
  useEffect(() => {
    const panel = panelRef.current;
    return () => {
      panel?.style.removeProperty("translate");
    };
  }, [panelRef]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragged.current = false;
    drag.current = { startY: event.clientY, moved: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const dy = event.clientY - state.startY;
    if (!state.moved && Math.abs(dy) < 6) return;
    state.moved = true;
    // Feedback for a pull down only; the panel snaps to its new height on release.
    panelRef.current?.style.setProperty("translate", `0 ${Math.max(0, dy)}px`);
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    drag.current = null;
    panelRef.current?.style.removeProperty("translate");
    if (!state?.moved || event.type === "pointercancel") return;
    dragged.current = true;
    const share = event.clientY / window.innerHeight;
    const next = share > 0.75 ? "peek" : share > 0.35 ? "half" : "full";
    // An upward drag shows no preview, so only a pull down lands at once.
    sheetReleased = next !== snap && event.clientY > state.startY;
    setSnap(next);
  };
  const onClick = () => {
    // A drag also ends in a click; only a tap steps.
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    setSnap(SNAPS[(index + 1) % SNAPS.length]!);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
    const next = SNAPS[index + step];
    if (!step || !next) return;
    event.preventDefault();
    setSnap(next);
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      className="mari-sheet-handle"
      data-snap={snap}
      aria-label={t("omnibar.companion.resize", "Resize Professor Mari")}
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={SNAPS.length - 1}
      aria-valuenow={index}
      aria-valuetext={valueText}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClick={onClick}
      onKeyDown={onKeyDown}
    />
  );
}
