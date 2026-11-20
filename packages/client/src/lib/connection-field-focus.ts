import { highlightJumpTarget, scrollingAncestorOf } from "./jump-highlight";

/** Connection editor fields a button elsewhere can open the editor at. */
export type ConnectionFocusField = "maxOutputTokens";

let pending: { connectionId: string; field: ConnectionFocusField } | null = null;

/** Asks the next connection editor that opens on this connection to scroll to the field and light it up. */
export function requestConnectionFieldFocus(connectionId: string, field: ConnectionFocusField) {
  pending = { connectionId, field };
}

/** The field asked for this connection, once: the request is cleared when read. */
export function takeConnectionFieldFocus(connectionId: string | null | undefined): ConnectionFocusField | null {
  if (!pending || !connectionId || pending.connectionId !== connectionId) return null;
  const { field } = pending;
  pending = null;
  return field;
}

/** Scrolls the editor to the field once it has rendered (the editor loads its connection first), then flashes it. */
export function revealConnectionField(field: ConnectionFocusField, root: HTMLElement | null, attempt = 0) {
  window.requestAnimationFrame(() => {
    const target = root?.querySelector<HTMLElement>(`[data-connection-field="${field}"]`) ?? null;
    if (!target || target.offsetParent === null) {
      if (attempt < 30) window.setTimeout(() => revealConnectionField(field, root, attempt + 1), 100);
      return;
    }
    const scroller = scrollingAncestorOf(target);
    const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    // A third of the way down, so the field sits in view with its section heading above it.
    scroller.scrollTo({ top: Math.max(0, top - scroller.clientHeight / 3), behavior: "smooth" });
    highlightJumpTarget(target, scroller);
  });
}
