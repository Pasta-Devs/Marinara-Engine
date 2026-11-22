// ──────────────────────────────────────────────
// Search (Ctrl+K): keys typed before its field exists
// ──────────────────────────────────────────────
// The Search window's code loads on demand. Right after the app starts (or on a slow
// CPU) it can take a second or more between Ctrl+K and the search field appearing, and
// everything typed in that gap went to the page and was lost ("wren" vanished entirely,
// QC Nov 21 IA15 / A11Y10). From the moment Search is asked to open, this records the
// keys that would have gone into the field and hands them over once it mounts.

export type OmnibarBufferedKey = { kind: "text"; value: string } | { kind: "backspace" } | { kind: "enter" };

/** Gives up if the field never shows up (a failed chunk load), so the page gets its keys back. */
const BUFFER_TIMEOUT_MS = 8_000;

let buffered: OmnibarBufferedKey[] = [];
let stopListening: (() => void) | null = null;

/** The search field itself: once it has focus it takes keys the normal way. */
function searchFieldFocused() {
  const active = document.activeElement;
  return active instanceof HTMLInputElement && active.closest('[data-component="GlobalOmnibar"]') !== null;
}

function onKeyDown(event: KeyboardEvent) {
  if (searchFieldFocused()) {
    stopOmnibarKeyBuffer();
    return;
  }
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
  // A window already open (What's new, a confirm) stays under Search: Ctrl+K opens over it, so these keys are
  // still meant for the search field.
  if (event.key === "Escape") {
    // Escape before Search shows means "never mind": drop what was typed, let Search close as usual.
    buffered = [];
    return;
  }
  let key: OmnibarBufferedKey | null = null;
  if (event.key === "Backspace") key = { kind: "backspace" };
  else if (event.key === "Enter") key = { kind: "enter" };
  else if (event.key.length === 1) key = { kind: "text", value: event.key };
  if (!key) return;
  event.preventDefault();
  event.stopPropagation();
  buffered.push(key);
}

/** Starts recording. Called the moment Search is asked to open; calling it again while recording does nothing. */
export function startOmnibarKeyBuffer() {
  if (stopListening || typeof window === "undefined") return;
  buffered = [];
  window.addEventListener("keydown", onKeyDown, true);
  const timer = window.setTimeout(stopOmnibarKeyBuffer, BUFFER_TIMEOUT_MS);
  stopListening = () => {
    window.removeEventListener("keydown", onKeyDown, true);
    window.clearTimeout(timer);
  };
}

export function stopOmnibarKeyBuffer() {
  stopListening?.();
  stopListening = null;
}

/** Stops recording and returns what was typed, oldest first. */
export function takeOmnibarKeyBuffer(): OmnibarBufferedKey[] {
  stopOmnibarKeyBuffer();
  const keys = buffered;
  buffered = [];
  return keys;
}

/**
 * Applies buffered keys to the query the field opens with. A reopened Search shows its last
 * query selected, so the first typed key replaces it (and Backspace clears it), as in the field itself.
 */
export function applyOmnibarBufferedKeys(
  initialQuery: string,
  keys: readonly OmnibarBufferedKey[],
): { query: string; enter: boolean } {
  let query = initialQuery;
  let selected = initialQuery.length > 0;
  let enter = false;
  for (const key of keys) {
    if (key.kind === "enter") {
      enter = true;
      break;
    }
    if (key.kind === "backspace") query = selected ? "" : query.slice(0, -1);
    else query = selected ? key.value : query + key.value;
    selected = false;
  }
  return { query, enter };
}

// ── Before the app has started (QC Nov 22 K17) ──
// GlobalOmnibarHost listens for Ctrl+K only once React has mounted it. On a cold load that can be a
// second or more after the page appears, and a Ctrl+K pressed then did nothing (and "wren" went nowhere).
// main.tsx installs this tiny listener before the first render; the host takes the request when it mounts.

let bootOpenRequested = false;
let removeBootListener: (() => void) | null = null;

function isBootOmnibarKey(event: KeyboardEvent) {
  if (event.altKey || event.shiftKey || event.repeat || event.isComposing) return false;
  const key = event.key.toLowerCase();
  // Non-Latin layouts report their own letter; the physical K key still counts (as in isOmnibarShortcut).
  if (key !== "k" && !(!/^[a-z]$/u.test(key) && event.code === "KeyK")) return false;
  const apple = /Mac|iPhone|iPad|iPod/u.test(navigator.platform) || navigator.userAgent.includes("Mac OS");
  return apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

type EarlyBootKeys = { open: boolean; keys: OmnibarBufferedKey[]; stop: (() => void) | null };

export function installBootOmnibarShortcut() {
  if (removeBootListener || typeof window === "undefined") return;
  // public/boot-keys.js ran before any of the app's code (QC panel 3 AX9): take over what it noted.
  const early = (window as unknown as { __marinaraBootKeys?: EarlyBootKeys }).__marinaraBootKeys;
  if (early) {
    early.stop?.();
    if (early.open) {
      bootOpenRequested = true;
      startOmnibarKeyBuffer();
      buffered.push(...early.keys);
    }
    early.open = false;
    early.keys = [];
  }
  const onKey = (event: KeyboardEvent) => {
    if (!isBootOmnibarKey(event)) return;
    event.preventDefault();
    bootOpenRequested = true;
    startOmnibarKeyBuffer();
  };
  window.addEventListener("keydown", onKey, true);
  removeBootListener = () => window.removeEventListener("keydown", onKey, true);
}

/** Called once by GlobalOmnibarHost on mount: stops the boot listener; true when Ctrl+K was pressed before. */
export function takeBootOmnibarOpenRequest(): boolean {
  removeBootListener?.();
  removeBootListener = null;
  const requested = bootOpenRequested;
  bootOpenRequested = false;
  return requested;
}
