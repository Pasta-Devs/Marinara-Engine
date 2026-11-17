// Macro context: the lorebook entry counts that macros read.
import assert from "node:assert/strict";
import { setLorebookEntryCounts } from "../../../packages/server/src/services/prompt/macro-context.js";

const staleLorebookCountContext = {
  user: "Mari",
  char: "Character",
  characters: ["Character"],
  variables: {},
  lorebookEntryCounts: { stale: 4 },
};
setLorebookEntryCounts(staleLorebookCountContext, undefined);
assert.deepEqual(
  staleLorebookCountContext.lorebookEntryCounts,
  {},
  "an omitted lorebook count snapshot must clear stale values",
);
