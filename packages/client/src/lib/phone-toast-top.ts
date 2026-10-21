// ──────────────────────────────────────────────
// Phone toast placement: below the header rows at the top of the screen
// ──────────────────────────────────────────────
// A phone toast sits top-centre, where windows, editors, the right panel, the chat list and the chat
// put their header controls (the Chat Settings star, Save, Close). Sonner pauses a hovered or pressed
// toast, so one over those controls stays there. The toaster reads its phone top from
// PHONE_TOAST_TOP_VARIABLE, which these helpers keep below the header rows stacked under the top bar.

export const PHONE_TOAST_TOP_VARIABLE = "--mari-phone-toast-top";

// The chat's buttons, a window or sheet, the right panel, the chat list, an editor and custom headers.
const PHONE_HEADER_ROWS = [
  ".mari-window-bubble",
  ".mari-window__header",
  ".mari-right-panel-header",
  ".mari-sidebar-header",
  ".mari-editor-header",
  "[data-chat-window-top-obstacle]",
  "[data-phone-toast-header]",
].join(",");
// A row starting this close below the rows above it belongs to the same stack (the chat's buttons sit
// 8px under the top bar); anything further down, such as a chat button moved lower, does not.
const STACK_GAP_PX = 16;
const TOAST_GAP_PX = 8;
const TOP_BAR = '[data-component="TopBar"]';
const HEADERS = `${TOP_BAR},${PHONE_HEADER_ROWS}`;

/** The top for a phone toast in px: under the top bar and every header row stacked below it. */
export function phoneToastTop(): number {
  let bottom = document.querySelector(TOP_BAR)?.getBoundingClientRect().bottom ?? 0;
  const rows = Array.from(document.querySelectorAll(PHONE_HEADER_ROWS))
    .filter((row) => getComputedStyle(row).visibility === "visible")
    .map((row) => row.getBoundingClientRect())
    .filter(
      (rect) =>
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.left < window.innerWidth &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight,
    )
    .sort((a, b) => a.top - b.top);
  for (const rect of rows) {
    if (rect.top <= bottom + STACK_GAP_PX) bottom = Math.max(bottom, rect.bottom);
  }
  return Math.round(bottom + TOAST_GAP_PX);
}

/**
 * Keeps PHONE_TOAST_TOP_VARIABLE on the toaster's host current while a toast shows: measured as a toast
 * mounts (before it paints) and when headers change, so a window or editor opened under it moves it down.
 * Returns the cleanup.
 */
export function watchPhoneToastTop(host: HTMLElement): () => void {
  let watching = false;
  const observedHeaders = new Set<Element>();
  const place = () => {
    const top = `${phoneToastTop()}px`;
    if (host.style.getPropertyValue(PHONE_TOAST_TOP_VARIABLE) !== top) {
      host.style.setProperty(PHONE_TOAST_TOP_VARIABLE, top);
    }
  };
  const resizeObserver = new ResizeObserver(place);
  const refreshHeaders = () => {
    const headers = new Set<Element>();
    for (const header of document.querySelectorAll(HEADERS)) {
      headers.add(header);
      // A centered custom dialog's growing body moves its header without resizing the header itself.
      if (header.matches("[data-phone-toast-header]") && header.parentElement) headers.add(header.parentElement);
    }
    for (const header of observedHeaders) {
      if (headers.has(header)) continue;
      resizeObserver.unobserve(header);
      observedHeaders.delete(header);
    }
    for (const header of headers) {
      if (observedHeaders.has(header)) continue;
      resizeObserver.observe(header);
      observedHeaders.add(header);
    }
    place();
  };
  const containsHeader = (node: Node) =>
    node instanceof Element &&
    (node.matches(HEADERS) ||
      node.querySelector(HEADERS) !== null ||
      // A class change can remove a header's selector before this delivery.
      [...observedHeaders].some((header) => node.contains(header)));
  const insideCustomPanel = (node: Node) =>
    [...observedHeaders].some(
      (header) => header.matches("[data-phone-toast-header]") && header.parentElement?.contains(node),
    );
  const layoutObserver = new MutationObserver((records) => {
    // Streaming messages and toast animations cannot move these headers. Keep relevant updates in
    // this delivery: deferring them to another animation frame can paint a toast over new controls.
    if (
      records.some(
        (record) =>
          !host.contains(record.target) &&
          (insideCustomPanel(record.target) ||
            (record.type === "attributes"
              ? containsHeader(record.target)
              : [...record.addedNodes, ...record.removedNodes].some(containsHeader))),
      )
    ) {
      refreshHeaders();
    }
  });
  const stopWatching = () => {
    watching = false;
    layoutObserver.disconnect();
    resizeObserver.disconnect();
    observedHeaders.clear();
    window.removeEventListener("resize", refreshHeaders);
    host.style.removeProperty(PHONE_TOAST_TOP_VARIABLE);
  };
  const sync = () => {
    if (!host.querySelector("[data-sonner-toast]")) {
      if (watching) stopWatching();
      return;
    }
    if (!watching) {
      watching = true;
      layoutObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "hidden", "data-chat-covered"],
      });
      window.addEventListener("resize", refreshHeaders);
    }
    refreshHeaders();
  };
  // Mutation callbacks run before the next paint, so a new toast never shows at the old place first.
  const observer = new MutationObserver(sync);
  observer.observe(host, { childList: true, subtree: true });
  sync();
  return () => {
    observer.disconnect();
    stopWatching();
  };
}
