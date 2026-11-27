// ──────────────────────────────────────────────
// UI overhaul: the pure parts of Back / Forward and the tab keys
//
// No DOM and no React, so the regression script can drive them with plain values.
// place-history.ts and use-navigation-keys.ts hold the parts that touch the page.
// ──────────────────────────────────────────────
import { overhaulTabKey, type OverhaulTab } from "../stores/overhaul.store";

/** A place: the tab on screen, or null for Home. */
export type Place = OverhaulTab | null;

const PLACE_LIMIT = 50;

export function placeKey(place: Place): string {
  return place ? overhaulTabKey(place) : "home";
}

/** The history after the page on screen became `place`: places ahead of the current one are dropped. */
export function recordPlace(entries: Place[], index: number, place: Place): { entries: Place[]; index: number } {
  const key = placeKey(place);
  if (index >= 0 && placeKey(entries[index] ?? null) === key) return { entries, index };
  const kept = entries.slice(0, index + 1);
  kept.push(place);
  const overflow = Math.max(0, kept.length - PLACE_LIMIT);
  return { entries: kept.slice(overflow), index: kept.length - 1 - overflow };
}

/** Alt+← / Alt+→ everywhere; ⌘[ / ⌘] too on a Mac. Not while typing (there Alt+← moves by word). */
export function placeKeyStep(
  event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">,
  apple: boolean,
): -1 | 1 | 0 {
  if (event.shiftKey) return 0;
  if (event.altKey && !event.ctrlKey && !event.metaKey) {
    if (event.key === "ArrowLeft") return -1;
    if (event.key === "ArrowRight") return 1;
  }
  if (apple && event.metaKey && !event.altKey && !event.ctrlKey) {
    if (event.key === "[") return -1;
    if (event.key === "]") return 1;
  }
  return 0;
}

export type TabKeyAction =
  { kind: "step"; step: -1 | 1 } | { kind: "jump"; position: number | "last" } | { kind: "close" } | null;

type KeyLike = Pick<KeyboardEvent, "key" | "code" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">;

/** Which tab command a key press is, or null. */
export function tabKeyAction(event: KeyLike): TabKeyAction {
  if (!event.altKey || event.ctrlKey || event.metaKey) return null;
  if (event.key === "PageUp" && !event.shiftKey) return { kind: "step", step: -1 };
  if (event.key === "PageDown" && !event.shiftKey) return { kind: "step", step: 1 };
  if (event.shiftKey && event.key === "ArrowLeft") return { kind: "step", step: -1 };
  if (event.shiftKey && event.key === "ArrowRight") return { kind: "step", step: 1 };
  // Read from the key's position: Shift changes the character (Alt+Shift+1 types "!"), and Option on a Mac types symbols.
  const digit = /^Digit([1-9])$/.exec(event.code ?? "");
  if (event.shiftKey && digit) {
    const position = Number(digit[1]);
    return { kind: "jump", position: position === 9 ? "last" : position };
  }
  if (!event.shiftKey && event.code === "KeyW") return { kind: "close" };
  return null;
}

/** The tab a step or jump lands on, from the strip's order. From Home or a Library page, a step starts at an end. */
export function tabKeyTarget(
  tabs: readonly OverhaulTab[],
  currentKey: string | null,
  action: Exclude<TabKeyAction, null | { kind: "close" }>,
): OverhaulTab | null {
  if (!tabs.length) return null;
  if (action.kind === "jump") {
    if (action.position === "last") return tabs[tabs.length - 1]!;
    return tabs[action.position - 1] ?? null;
  }
  const index = currentKey ? tabs.findIndex((tab) => overhaulTabKey(tab) === currentKey) : -1;
  if (index < 0) return action.step === 1 ? tabs[0]! : tabs[tabs.length - 1]!;
  return tabs[(index + action.step + tabs.length) % tabs.length]!;
}
