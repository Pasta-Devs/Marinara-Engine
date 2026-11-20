import { useEffect, useRef, type RefObject } from "react";
import { isBrowserExtensionUi } from "../lib/chat-floating-ui-events";
import { registerBackLayer } from "../lib/back-navigation";
import { registerLayer } from "../lib/layer-stack";

export interface DismissOptions {
  /** Close on a press outside the layer. Off for layers that stay while you work elsewhere (a pinned window). */
  outsideClick?: boolean;
  /** Close on Escape when this is the topmost layer in its window. */
  escape?: boolean;
  /** Close on the hardware / gesture back button. */
  back?: boolean;
  /**
   * The control that opened the layer. A mouse press on it only closes the layer: the click that follows is
   * swallowed, so a toggle button does not open it again.
   */
  openerRef?: RefObject<Element | null>;
}

/**
 * Closes a mounted layer (menu, popover, panel) on Escape, an outside press and the back button, in one order.
 *
 * - Only the topmost layer in a window takes Escape (`layer-stack.ts`), so a menu inside a dialog closes first and
 *   the dialog stays. The press is stopped, so hand-built Escape handlers under the layer don't act on it either.
 * - A press inside a layer opened after this one (a submenu, a confirm) is not outside.
 * - Mouse and pen close on `pointerdown`. A finger closes on a finished tap, so pressing to scroll the page does not
 *   close the menu (a scroll cancels the pointer). The closing press still reaches what is under it.
 * - Listens on the window the layer renders in (`ref`'s `ownerDocument`), so it works in a popped-out window.
 *
 * `onDismiss` is read through a ref, so an inline arrow function does not churn the listeners.
 */
export function useDismiss(
  ref: RefObject<Element | null>,
  open: boolean,
  onDismiss: () => void,
  { outsideClick = true, escape = true, back = true, openerRef }: DismissOptions = {},
) {
  const dismissRef = useRef(onDismiss);
  // Options are read at event time, so changing them never re-registers an open layer above its submenu.
  const optionsRef = useRef({ outsideClick, escape, back, openerRef });
  useEffect(() => {
    dismissRef.current = onDismiss;
    optionsRef.current = { outsideClick, escape, back, openerRef };
  });

  useEffect(() => {
    if (!open) return;
    const doc = ref.current?.ownerDocument ?? document;
    const view = doc.defaultView;
    if (!view) return;
    const layer = registerLayer({ kind: "popover", doc, getElement: () => ref.current });
    // Back pops the main window's history, so a layer in a popped-out window stays out of its stack.
    const releaseBack =
      optionsRef.current.back && view === window ? registerBackLayer(() => dismissRef.current()) : null;

    const isOutside = (target: EventTarget | null) => {
      const element = ref.current;
      if (!element || !(target instanceof view.Node)) return false;
      if (element.contains(target) || layer.isInsideLayerAbove(target)) return false;
      return !isBrowserExtensionUi(target);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!optionsRef.current.escape || event.key !== "Escape" || event.isComposing) return;
      if (!layer.isTopmost() || isBrowserExtensionUi(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      dismissRef.current();
    };

    // A press on the opener only closes; without this, the click that follows would open the layer again.
    const swallowNextClickOnOpener = (target: EventTarget | null) => {
      if (!optionsRef.current.openerRef?.current?.contains(target as Node)) return;
      const swallow = (click: MouseEvent) => {
        if (click.detail === 0) return; // keyboard / programmatic click: let it through
        click.stopPropagation();
        click.preventDefault();
      };
      view.addEventListener("click", swallow, { capture: true, once: true });
      view.addEventListener("pointerdown", () => view.removeEventListener("click", swallow, true), {
        capture: true,
        once: true,
      });
    };

    let touchStartedOutside = false;
    const onPointerDown = (event: PointerEvent) => {
      if (!optionsRef.current.outsideClick) return;
      if (event.pointerType === "touch") {
        touchStartedOutside = isOutside(event.target);
        return;
      }
      if (!isOutside(event.target)) return;
      if (event.button === 0) swallowNextClickOnOpener(event.target);
      dismissRef.current();
    };
    const onPointerCancel = () => {
      touchStartedOutside = false;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || !touchStartedOutside || !optionsRef.current.outsideClick) return;
      touchStartedOutside = false;
      if (!isOutside(event.target)) return;
      swallowNextClickOnOpener(event.target);
      dismissRef.current();
    };

    view.addEventListener("keydown", onKeyDown, true);
    // Wait a frame, so the press that opened the layer does not close it.
    const frame = view.requestAnimationFrame(() => {
      view.addEventListener("pointerdown", onPointerDown, true);
      view.addEventListener("pointercancel", onPointerCancel, true);
      view.addEventListener("pointerup", onPointerUp, true);
    });
    return () => {
      view.cancelAnimationFrame(frame);
      view.removeEventListener("keydown", onKeyDown, true);
      view.removeEventListener("pointerdown", onPointerDown, true);
      view.removeEventListener("pointercancel", onPointerCancel, true);
      view.removeEventListener("pointerup", onPointerUp, true);
      layer.release();
      releaseBack?.();
    };
  }, [open, ref]);
}
