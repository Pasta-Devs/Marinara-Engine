import assert from "node:assert/strict";
import {
  IDLE_TAB_MODE,
  nextTabMode,
  type TabMode,
  type TabModeEvent,
} from "../../../packages/client/src/lib/textarea-editing.js";

// QC Nov 22 K1: Tab-indenting prompt boxes must never trap keyboard users.
function run(events: TabModeEvent[], start: TabMode = IDLE_TAB_MODE) {
  let state = start;
  const leaves: boolean[] = [];
  for (const event of events) {
    const result = nextTabMode(state, event);
    state = result.state;
    if (event.type === "tab") leaves.push(result.leave);
  }
  return { state, leaves };
}

const tab = (hasSelection = false): TabModeEvent => ({ type: "tab", hasSelection });

// Arriving by Tab: the next Tab (and Shift+Tab, same event) moves on, with nothing typed.
assert.deepEqual(run([{ type: "focus", byTab: true }, tab()]).leaves, [true]);
// Arriving by a click (or a script): Tab indents, as before.
assert.deepEqual(run([{ type: "focus", byTab: false }, tab()]).leaves, [false]);
// Arrived by Tab, then typed: Tab indents from then on.
assert.deepEqual(run([{ type: "focus", byTab: true }, { type: "input" }, tab(), tab()]).leaves, [false, false]);
// Arrived by Tab, then clicked in the box: Tab indents.
assert.deepEqual(run([{ type: "focus", byTab: true }, { type: "pointerdown" }, tab()]).leaves, [false]);
// Arrived by Tab and selected text (Shift+arrows): Tab indents the selection, and the box is now being edited.
assert.deepEqual(run([{ type: "focus", byTab: true }, tab(true), tab()]).leaves, [false, false]);
// Arrows alone (reading the text) keep the way out.
assert.deepEqual(run([{ type: "focus", byTab: true }, { type: "key" }, tab()]).leaves, [true]);

// Escape, then Tab leaves, even while typing.
assert.deepEqual(run([{ type: "focus", byTab: false }, { type: "input" }, { type: "escape" }, tab()]).leaves, [true]);
// Escape, then another key: the next Tab indents again.
assert.deepEqual(run([{ type: "focus", byTab: false }, { type: "escape" }, { type: "key" }, tab()]).leaves, [false]);
// Escape, then typing (input) also disarms.
assert.deepEqual(run([{ type: "focus", byTab: false }, { type: "escape" }, { type: "input" }, tab()]).leaves, [false]);
// Leaving the box forgets everything; coming back by a click indents.
const afterBlur = run([{ type: "focus", byTab: false }, { type: "escape" }, { type: "blur" }]).state;
assert.deepEqual(afterBlur, IDLE_TAB_MODE);
assert.deepEqual(run([{ type: "focus", byTab: false }, tab()], afterBlur).leaves, [false]);
// A new focus by Tab after editing earlier starts passing through again.
assert.deepEqual(
  run([{ type: "focus", byTab: false }, { type: "input" }, { type: "blur" }, { type: "focus", byTab: true }, tab()])
    .leaves,
  [true],
);

console.log("textarea-tab-exit: ok");
