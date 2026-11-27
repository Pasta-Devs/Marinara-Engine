// ──────────────────────────────────────────────
// UI overhaul (desktop shell): keys and mouse buttons for moving around
//
// Back / Forward between places (place-history.ts): Alt+← / Alt+→, ⌘[ / ⌘] on a
// Mac, and the mouse's back and forward buttons. Tabs: Alt+Shift+← / Alt+Shift+→
// (or Alt+Page Up / Alt+Page Down) for the previous or next tab, Alt+Shift+1…8
// for a tab by its place, Alt+Shift+9 for the last one, Alt+W to close the tab
// on screen. Alt+Shift+digit instead of Alt+digit: Chrome and Firefox on Linux
// keep Alt+1…9 for their own tabs and never hand them to the page.
//
// None of them fire while a dialog, Search or another window is open, and the
// letter and digit keys never fire while typing.
// ──────────────────────────────────────────────
import { useEffect } from "react";
import { isApplePlatform } from "../../lib/command-center";
import { isTypingTarget } from "../../lib/keyboard-shortcuts";
import { isModalOverlayOpen } from "../../lib/layer-stack";
import { useDialogStore } from "../../stores/dialog.store";
import { overhaulTabKey, useOverhaulStore } from "../../stores/overhaul.store";
import { placeKeyStep, tabKeyAction, tabKeyTarget } from "../../lib/navigation-keys";
import { useUIStore } from "../../stores/ui.store";
import { activateTab, closeTabAndMove, currentTabNow } from "./OverhaulTopBar";
import { goBackPlace, goForwardPlace, placeHistoryActive, usePlaceHistory } from "./place-history";

/** Something else has the keyboard: a dialog, a window over the page, or Search. */
function somethingOver(): boolean {
  const ui = useUIStore.getState();
  return ui.omnibarOpen || !!ui.modal || !!useDialogStore.getState().dialog || isModalOverlayOpen();
}

function eventTypes(event: Event): boolean {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
  return path.some((node) => isTypingTarget(node));
}

/** Mouse buttons 3 and 4 (counted from 0): the side buttons most mice have for Back and Forward. */
const MOUSE_BACK = 3;
const MOUSE_FORWARD = 4;

export function useNavigationKeys() {
  useEffect(() => {
    const apple = isApplePlatform();
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.repeat) return;
      if (!placeHistoryActive() || somethingOver()) return;
      const typing = eventTypes(event);

      const step = placeKeyStep(event, apple);
      if (step) {
        // In a text box on a Mac, Option+← moves by a word. Elsewhere Alt+← is the browser's Back even there.
        if (typing && apple) return;
        const moved = step === -1 ? goBackPlace() : goForwardPlace();
        if (moved) event.preventDefault();
        return;
      }

      const action = tabKeyAction(event);
      if (!action || typing) return;
      const overhaul = useOverhaulStore.getState();
      const current = currentTabNow();
      const currentKey = current ? overhaulTabKey(current) : null;
      if (action.kind === "close") {
        if (!current || !overhaul.tabs.some((tab) => overhaulTabKey(tab) === currentKey)) return;
        event.preventDefault();
        closeTabAndMove(current, overhaul.tabs, currentKey);
        return;
      }
      const target = tabKeyTarget(overhaul.tabs, currentKey, action);
      if (!target) return;
      event.preventDefault();
      if (overhaulTabKey(target) !== currentKey) activateTab(target);
    };

    // The browser goes back on the button's release; taking both halves keeps it from doing so as well.
    let pressed: number | null = null;
    let handled = false;
    const onMouseDown = (event: MouseEvent) => {
      pressed = null;
      if (event.button !== MOUSE_BACK && event.button !== MOUSE_FORWARD) return;
      if (!placeHistoryActive() || somethingOver()) return;
      const places = usePlaceHistory.getState();
      if (event.button === MOUSE_BACK ? !places.canBack : !places.canForward) return;
      pressed = event.button;
      event.preventDefault();
    };
    const onMouseUp = (event: MouseEvent) => {
      if (pressed === null || event.button !== pressed) return;
      pressed = null;
      handled = true;
      event.preventDefault();
      if (event.button === MOUSE_BACK) goBackPlace();
      else goForwardPlace();
    };
    const onAuxClick = (event: MouseEvent) => {
      if (handled && (event.button === MOUSE_BACK || event.button === MOUSE_FORWARD)) event.preventDefault();
      handled = false;
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("mouseup", onMouseUp, true);
    window.addEventListener("auxclick", onAuxClick, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("mouseup", onMouseUp, true);
      window.removeEventListener("auxclick", onAuxClick, true);
    };
  }, []);
}
