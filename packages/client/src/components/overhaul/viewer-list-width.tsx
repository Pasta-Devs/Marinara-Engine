// The Library viewers' list column (Regex scripts, Settings profiles, Connections, …) can be dragged wider or
// narrower like the Library sidebar. One width serves every viewer and every window, so it is kept in local storage.
import { useCallback, useRef, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";

const KEY = "marinara:ov-viewer-list-width";
const EVENT = "marinara:ov-viewer-list-width";
export const VIEWER_LIST_MIN = 208;
export const VIEWER_LIST_MAX = 448;
export const VIEWER_LIST_DEFAULT = 272;

const clamp = (value: number) => Math.round(Math.min(VIEWER_LIST_MAX, Math.max(VIEWER_LIST_MIN, value)));

function read(): number | null {
  try {
    const value = Number(localStorage.getItem(KEY));
    return Number.isFinite(value) && value > 0 ? clamp(value) : null;
  } catch {
    return null;
  }
}

function write(value: number | null) {
  try {
    if (value === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(clamp(value)));
  } catch {
    // Private windows: the width just lasts until the page reloads.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The saved width in px, or null for the default. */
export function useViewerListWidth() {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** The drag handle on the list column's right edge. Double-click puts the default width back. */
export function ViewerListResizeHandle({ width }: { width: number | null }) {
  const { t } = useTranslation();
  const drag = useRef<{ x: number; start: number } | null>(null);
  const current = width ?? VIEWER_LIST_DEFAULT;
  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const column = event.currentTarget.parentElement;
      drag.current = { x: event.clientX, start: column?.getBoundingClientRect().width ?? current };
      event.currentTarget.setPointerCapture(event.pointerId);
      document.documentElement.dataset.ovResizing = "";
    },
    [current],
  );
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const delta = (event.clientX - drag.current.x) * (rtl ? -1 : 1);
    write(drag.current.start + delta);
  };
  const end = () => {
    drag.current = null;
    delete document.documentElement.dataset.ovResizing;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 48 : 16;
    if (event.key === "ArrowLeft") write(current - step);
    else if (event.key === "ArrowRight") write(current + step);
    else if (event.key === "Home") write(VIEWER_LIST_MIN);
    else if (event.key === "End") write(VIEWER_LIST_MAX);
    else return;
    event.preventDefault();
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t("library.viewer.resizeList")}
      aria-valuemin={VIEWER_LIST_MIN}
      aria-valuemax={VIEWER_LIST_MAX}
      aria-valuenow={Math.round(current)}
      title={t("library.viewer.resizeListHint")}
      tabIndex={0}
      className="ov-vw__resize"
      data-ov-vw-resize=""
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => write(null)}
      onKeyDown={onKeyDown}
    />
  );
}
