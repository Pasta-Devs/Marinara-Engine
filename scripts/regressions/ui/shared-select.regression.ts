// #9400: the shared Select replaces native <select>s. On a closed field the arrow keys step through the enabled
// options and stop at the ends, and a letter jumps to the next option starting with it, like a native select.
import assert from "node:assert/strict";
import {
  SELECT_SEARCH_MIN,
  stepSelectOption,
  typeAheadSelectOption,
} from "../../../packages/client/src/lib/select-options.js";

const options = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Middle", disabledReason: "Not yet" },
  { value: "bottom", label: "Bottom" },
  { value: "beside", label: "Beside" },
] as const;

// Arrow keys skip disabled options and stop at the ends.
assert.equal(stepSelectOption(options, "top", 1), "bottom");
assert.equal(stepSelectOption(options, "bottom", -1), "top");
assert.equal(stepSelectOption(options, "top", -1), "top");
assert.equal(stepSelectOption(options, "beside", 1), "beside");
// Nothing picked yet: Down takes the first option, Up the last.
assert.equal(stepSelectOption(options, null, 1), "top");
assert.equal(stepSelectOption(options, null, -1), "beside");
assert.equal(stepSelectOption([{ value: "a", label: "A", disabledReason: "off" }], null, 1), undefined);

// A letter cycles through the options starting with it, case-insensitively, and skips disabled ones.
assert.equal(typeAheadSelectOption(options, "top", "b"), "bottom");
assert.equal(typeAheadSelectOption(options, "bottom", "B"), "beside");
assert.equal(typeAheadSelectOption(options, "beside", "b"), "bottom");
assert.equal(typeAheadSelectOption(options, "top", "m"), undefined);
assert.equal(typeAheadSelectOption(options, null, "t"), "top");

assert.equal(SELECT_SEARCH_MIN, 8, "short lists open without a search box");

console.log("shared-select regression passed");
