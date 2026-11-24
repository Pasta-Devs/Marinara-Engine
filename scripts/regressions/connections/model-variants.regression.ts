import assert from "node:assert/strict";

// A proxy's long list shows one line per model: "[free]claude-fable-5-1", "[SP]claude-fable-5-1" and
// "[SP]claude-fable-5-1-thinking" fold under "claude-fable-5-1". Names that are a different model never fold.
const { splitModelVariant, groupModelVariants, variantLabel } =
  await import("../../../packages/client/src/lib/model-variants.js");

assert.deepEqual(splitModelVariant("[SP]claude-fable-5-1-thinking"), {
  base: "claude-fable-5-1",
  tags: ["SP", "thinking"],
});
assert.deepEqual(splitModelVariant("deepseek/deepseek-v4:free"), { base: "deepseek-v4", tags: ["free"] });
assert.deepEqual(splitModelVariant("gpt-5.1-high"), { base: "gpt-5.1", tags: ["high"] });
assert.equal(variantLabel("[free]claude-opus-5-5"), "free");
assert.equal(variantLabel("claude-opus-5-5"), "claude-opus-5-5");

// Sizes, names and dates are part of the model.
for (const id of ["qwen3-max", "mistral-medium", "gpt-4o-mini", "claude-sonnet-4-5-20250929"]) {
  assert.equal(splitModelVariant(id).base, id, id);
}

const groups = groupModelVariants(
  [
    "[free]claude-fable-5-1",
    "[SP]claude-fable-5-1",
    "[SP]claude-fable-5",
    "qwen3-max",
    "qwen3",
    "[SP]claude-fable-5-1-thinking",
  ],
  (id) => id,
);
assert.deepEqual(
  groups.map((group) => [group.base, group.items.length]),
  [
    ["claude-fable-5-1", 3],
    ["claude-fable-5", 1],
    ["qwen3-max", 1],
    ["qwen3", 1],
  ],
);

// A route letter "-r" folds only when the list has the model without it; "command-r" alone stays a model.
const routed = groupModelVariants(
  ["claude-opus-5-r", "claude-opus-5", "command-r", "[SP]claude-sonnet-5-5-r"],
  (id) => id,
);
assert.deepEqual(
  routed.map((group) => [group.base, group.items.length]),
  [
    ["claude-opus-5", 2],
    ["command-r", 1],
    ["claude-sonnet-5-5-r", 1],
  ],
);
assert.equal(variantLabel("claude-opus-5-r", "claude-opus-5"), "r");
assert.equal(variantLabel("[SP]claude-opus-5-r-thinking", "claude-opus-5"), "r · SP · thinking");

console.log("model-variants regression passed");
