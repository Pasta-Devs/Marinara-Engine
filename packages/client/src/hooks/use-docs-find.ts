// ──────────────────────────────────────────────
// Find-in-guide for the Docs page: wraps every hit of the search term in the
// rendered guide in <mark>, and steps through them like a browser's find bar.
//
// The markdown renderer is shared with chat, so (like the Copy buttons) this
// augments the committed DOM. That is only safe because the caller keys the
// content container on the document revision, so React remounts it instead of
// reconciling a mutated subtree. Matching is a plain lower-case substring
// search, never a regex, so "c++" or "a|b" match literally.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";

const MAX_MARKS = 500;

export function useDocsFind(container: HTMLElement | null, revision: unknown, term: string) {
  const [marks, setMarks] = useState<HTMLElement[]>([]);
  const [current, setCurrent] = useState(-1);

  useEffect(() => {
    setCurrent(-1);
    if (!container || !revision || term.length < 2) {
      setMarks([]);
      return;
    }
    const needle = term.toLowerCase();
    if (needle.length !== term.length) {
      setMarks([]);
      return;
    }
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest(".docs-copy-button, mark.docs-search-mark, figure")) {
          return NodeFilter.FILTER_REJECT;
        }
        const text = node.textContent ?? "";
        const lower = text.toLowerCase();
        // A few characters grow when lower-cased (İ), which would shift the offsets.
        if (lower.length !== text.length) return NodeFilter.FILTER_REJECT;
        return lower.includes(needle) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const targets: Text[] = [];
    for (let node = walker.nextNode(); node && targets.length < MAX_MARKS; node = walker.nextNode()) {
      targets.push(node as Text);
    }
    const created: HTMLElement[] = [];
    const parents = new Set<Node>();
    for (const textNode of targets) {
      const text = textNode.textContent ?? "";
      const lower = text.toLowerCase();
      const frag = document.createDocumentFragment();
      let last = 0;
      for (let i = lower.indexOf(needle); i !== -1 && created.length < MAX_MARKS; i = lower.indexOf(needle, last)) {
        if (i > last) frag.appendChild(document.createTextNode(text.slice(last, i)));
        const mark = document.createElement("mark");
        mark.className = "docs-search-mark";
        mark.textContent = text.slice(i, i + needle.length);
        frag.appendChild(mark);
        created.push(mark);
        last = i + needle.length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      const parent = textNode.parentNode;
      if (parent) {
        parent.replaceChild(frag, textNode);
        parents.add(parent);
      }
    }
    setMarks(created);
    return () => {
      for (const mark of created) {
        mark.parentNode?.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
      }
      for (const parent of parents) parent.normalize();
    };
  }, [container, revision, term]);

  const go = useCallback(
    (index: number) => {
      if (!marks.length) return;
      const next = ((index % marks.length) + marks.length) % marks.length;
      marks.forEach((mark, i) => mark.classList.toggle("is-current", i === next));
      marks[next]!.scrollIntoView({ block: "center" });
      setCurrent(next);
    },
    [marks],
  );

  return {
    count: marks.length,
    current,
    first: () => go(0),
    next: () => go(current + 1),
    previous: () => go(current < 0 ? -1 : current - 1),
  };
}
