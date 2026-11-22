// ──────────────────────────────────────────────
// A modal sheet: everything outside it is inert
// ──────────────────────────────────────────────
// QC panel 3 AX12: the phone Chat settings sheet covers the chat, but VoiceOver swipes and Tab still
// reached the messages and the composer behind it. While the sheet is open, every element beside it
// (and beside each of its ancestors) gets `inert`; painting is untouched. Live regions and the toast
// area stay live, so announcements still reach a screen reader.

const KEEP_LIVE = "[aria-live], [role='status'], [role='alert'], [data-sonner-toaster], .mari-skip-links";

function inertBranch(element: Element, changed: HTMLElement[]) {
  if (!(element instanceof HTMLElement) || element.inert) return;
  if (element instanceof HTMLScriptElement || element instanceof HTMLStyleElement) return;
  if (element.matches(KEEP_LIVE)) return;
  // A live region deeper inside: leave the path to it alone and inert the rest of this branch.
  if (element.querySelector(KEEP_LIVE)) {
    for (const child of Array.from(element.children)) inertBranch(child, changed);
    return;
  }
  element.inert = true;
  changed.push(element);
}

/** Makes everything outside `root` inert; returns the undo. Only elements it made inert are restored. */
export function inertOutside(root: HTMLElement): () => void {
  const changed: HTMLElement[] = [];
  let node: HTMLElement = root;
  while (node.parentElement && node !== document.body) {
    for (const sibling of Array.from(node.parentElement.children)) {
      if (sibling !== node) inertBranch(sibling, changed);
    }
    node = node.parentElement;
  }
  return () => {
    for (const element of changed) element.inert = false;
  };
}
