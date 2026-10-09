import assert from "node:assert/strict";
import { insertLibraryItems, readLibraryOrder } from "../../packages/client/src/lib/library-order.js";

// A gathered stack preserves list order, including items hidden by filters or collapsed folders.
const order = ["a", "hidden", "b", "c", "d"];
assert.deepEqual(insertLibraryItems(order, ["d", "b"], "a", "before"), ["b", "d", "a", "hidden", "c"]);
assert.deepEqual(insertLibraryItems(order, ["b", "d"], "c", "after"), ["a", "hidden", "c", "b", "d"]);
assert.deepEqual(insertLibraryItems(order, ["b"], "b", "after"), order);
assert.deepEqual(insertLibraryItems(order, ["b"], "deleted", "before"), order);
assert.deepEqual(order, ["a", "hidden", "b", "c", "d"]);

// Persisted settings may be absent or malformed; unknown values never become item IDs.
assert.deepEqual(readLibraryOrder(null), { active: false, ids: [] });
assert.deepEqual(readLibraryOrder({ active: true, ids: null }), { active: false, ids: [] });
assert.deepEqual(readLibraryOrder({ active: true, ids: ["a", 12, "b", "a", null] }), {
  active: true,
  ids: ["a", "b"],
});
assert.deepEqual(readLibraryOrder({ active: "true", ids: ["a"] }), { active: false, ids: ["a"] });
