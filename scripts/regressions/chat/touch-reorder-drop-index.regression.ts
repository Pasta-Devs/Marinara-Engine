// Dragging a summary entry by touch drops it at the entry's saved position, even when a filter hides some entries: the
// rows carry their saved index, and a drop between or after the visible rows uses those indexes, not the rows' order on
// screen.
import assert from "node:assert/strict";

class FakeElement {
  parent: FakeElement | null = null;
  children: FakeElement[] = [];
  dataset: Record<string, string> = {};
  constructor(
    readonly role: "root" | "item",
    readonly top = 0,
    readonly bottom = 0,
  ) {}
  closest(selector: string) {
    for (let node: FakeElement | null = this; node; node = node.parent) {
      if (selector === `[data-${node.role}]`) return node;
    }
    return null;
  }
  querySelectorAll(selector: string) {
    return selector === "[data-item]" ? this.children : [];
  }
  getBoundingClientRect() {
    return { top: this.top, bottom: this.bottom, height: this.bottom - this.top };
  }
}
// The filter shows only the entries saved at 0, 2 and 5, as rows 40px tall with 20px gaps.
const root = new FakeElement("root", 0, 200);
for (const [savedIndex, top] of [
  [0, 0],
  [2, 60],
  [5, 120],
]) {
  const row = new FakeElement("item", top, top + 40);
  row.dataset.touchReorderIndex = String(savedIndex);
  row.parent = root;
  root.children.push(row);
}
let pointed: FakeElement | null = null;
Object.assign(globalThis, { Element: FakeElement, document: { elementFromPoint: () => pointed } });
const { getTouchReorderDropIndex } = await import("../../../packages/client/src/lib/touch-reorder.js");
const dropAt = (y: number, target: FakeElement | null) => {
  pointed = target;
  return getTouchReorderDropIndex({ x: 10, y, itemSelector: "[data-item]", rootSelector: "[data-root]", itemCount: 8 });
};

assert.equal(dropAt(70, root.children[1]!), 2, "the upper half of a row drops before it");
assert.equal(dropAt(90, root.children[1]!), 3, "the lower half of a row drops after it");
assert.equal(
  dropAt(110, root),
  5,
  "Touch reorder gaps must use persisted row indexes when filtered entries are not rendered",
);
assert.equal(dropAt(180, root), 6, "a drop below the last row goes after its saved position");
assert.equal(dropAt(10, null), null, "a drop outside the list does nothing");
