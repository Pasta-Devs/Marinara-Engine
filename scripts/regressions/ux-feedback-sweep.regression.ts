import assert from "node:assert/strict";
import { dailyCharacters } from "../../packages/client/src/lib/daily-characters.js";
import {
  deferEditorLeave,
  hasEditorLeaveHandler,
  registerEditorLeaveHandler,
  leaveWithoutSaving,
} from "../../packages/client/src/lib/editor-leave.js";

const rows = Array.from({ length: 20 }, (_, index) => ({ id: `character-${index}` }));
const today = dailyCharacters(rows, "2026-09-07");
assert.equal(today.length, 4);
assert.deepEqual(today, dailyCharacters([...rows].reverse(), "2026-09-07"));
assert.notDeepEqual(today, dailyCharacters(rows, "2026-09-08"));
assert.equal(new Set(today.map((row) => row.id)).size, 4);
assert.deepEqual(dailyCharacters([], "2026-09-07"), []);
assert.equal(rows.length, 20);

const state = { characterDetailId: "a", personaDetailId: null };
let requests = 0;
let proceed: (() => void) | null = null;
let navigated = false;
const unregister = registerEditorLeaveHandler({
  key: "characterDetailId:a",
  request: (next) => {
    requests++;
    proceed = next;
    return true;
  },
});
assert.equal(hasEditorLeaveHandler(state), true);
assert.equal(
  deferEditorLeave(state, { characterDetailId: "a" }, () => {}),
  false,
);
assert.equal(
  deferEditorLeave(state, {}, () => {}),
  false,
  "Unrelated UI updates stay synchronous",
);
assert.equal(
  deferEditorLeave(state, { characterDetailId: null, personaDetailId: "b" }, () => {
    navigated = true;
  }),
  true,
);
assert.equal(navigated, false, "Navigation waits for the mounted editor's save");
assert.equal(requests, 1);
(proceed as unknown as () => void)();
assert.equal(navigated, true);
leaveWithoutSaving(() =>
  assert.equal(
    deferEditorLeave(state, { characterDetailId: null }, () => {}),
    false,
  ),
);
assert.equal(hasEditorLeaveHandler(state), true);
unregister();
assert.equal(hasEditorLeaveHandler(state), false);
assert.equal(
  deferEditorLeave(state, { characterDetailId: null }, () => {}),
  false,
);
console.info("UX sweep: deterministic daily cards and editor navigation gate passed.");
