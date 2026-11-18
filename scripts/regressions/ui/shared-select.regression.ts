// #9400: the shared Select replaces native <select>s. On a closed field the arrow keys step through the enabled
// options and stop at the ends, and a letter jumps to the next option starting with it, like a native select.
import assert from "node:assert/strict";
import {
  groupSelectOptions,
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
// Standing on a disabled option, a step goes to its enabled neighbour, not back to the start.
assert.equal(stepSelectOption(options, "middle", 1), "bottom");
assert.equal(stepSelectOption(options, "middle", -1), "top");
assert.equal(typeAheadSelectOption(options, "middle", "b"), "bottom");
assert.equal(stepSelectOption([{ value: "a", label: "A", disabledReason: "off" }], null, 1), undefined);

// A letter cycles through the options starting with it, case-insensitively, and skips disabled ones.
assert.equal(typeAheadSelectOption(options, "top", "b"), "bottom");
assert.equal(typeAheadSelectOption(options, "bottom", "B"), "beside");
assert.equal(typeAheadSelectOption(options, "beside", "b"), "bottom");
assert.equal(typeAheadSelectOption(options, "top", "m"), undefined);
assert.equal(typeAheadSelectOption(options, null, "t"), "top");

// Group headers: consecutive options share one header, ungrouped ones stay loose, headers are never options.
const grouped = [
  { value: "none", label: "None" },
  { value: "a", label: "Alpha", group: "Local" },
  { value: "b", label: "Beta", group: "Local" },
  { value: "c", label: "Gamma", group: "Remote" },
];
assert.deepEqual(
  groupSelectOptions(grouped).map((run) => [run.group, run.options.map((option) => option.value)]),
  [
    [undefined, ["none"]],
    ["Local", ["a", "b"]],
    ["Remote", ["c"]],
  ],
);
// After a search only the groups that still have a match keep their header.
assert.deepEqual(
  groupSelectOptions(grouped.filter((option) => option.label.includes("a") && option.value !== "a")).map(
    (run) => run.group,
  ),
  ["Local", "Remote"],
);
assert.deepEqual(
  groupSelectOptions(grouped.filter((option) => option.value === "c")).map((run) => run.group),
  ["Remote"],
);
assert.equal(stepSelectOption(grouped, "none", 1), "a");
assert.equal(stepSelectOption(grouped, "b", 1), "c");

assert.equal(SELECT_SEARCH_MIN, 8, "short lists open without a search box");

console.log("shared-select regression passed");
