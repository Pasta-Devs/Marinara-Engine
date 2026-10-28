// A job picker assigns a catalog model nobody saved yet, and Undo puts the previous one back.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { readOpenRouterModelCapabilities } from "../../packages/server/src/routes/connections.routes.js";

const source = readFileSync(
  new URL("../../packages/client/src/components/connections/ModelPicker.tsx", import.meta.url),
  "utf8",
);
const start = source.indexOf("  const nameOf =");
const end = source.indexOf("  // Decision:");
assert.ok(start > 0 && end > start, "ModelPicker handlers moved");
const js = ts.transpileModule(`${source.slice(start, end)}\nreturn { apply, commit };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

const saved: unknown[] = [];
const changes: Array<string | null> = [];
const toasts: Array<{ message: string; undo?: () => void }> = [];
const rows = [
  { id: "anchor", accountId: "acct", model: "", name: "Provider" },
  { id: "old", accountId: "acct", model: "old-model", name: "old-model" },
  { id: "row-new", accountId: "acct", model: "new-model", name: "new-model" },
];
const make = new Function("context", `with(context){ return (function(){ ${js} })(); }`);
const { apply } = make({
  value: "old",
  rows,
  defaultText: "Main",
  onChange: (next: string | null) => changes.push(next),
  t: (key: string, values?: { job: string; model: string }) => `${key}:${values?.job}:${values?.model}`,
  toast: {
    success: (message: string, options?: { action?: { onClick: () => void } }) =>
      toasts.push({ message, undo: options?.action?.onClick }),
  },
  jobName: "Summary",
  pickModel: {
    mutateAsync: async (body: unknown) => {
      saved.push(body);
      return { connectionId: "row-new" };
    },
  },
}) as { apply: (choice: { connectionId: string; model?: string }) => Promise<void> };

await apply({ connectionId: "anchor", model: "new-model" });
assert.deepEqual(saved, [{ accountId: "acct", model: "new-model" }]);
assert.deepEqual(changes, ["row-new"]);
assert.match(toasts[0].message, /Summary/);
toasts[0].undo?.();
assert.deepEqual(changes, ["row-new", "old"], "Undo restores the previous model");

// The catalog's own log-probabilities flag is kept for the Decision picker.
assert.equal(readOpenRouterModelCapabilities({ supported_parameters: ["logprobs", "temperature"] })?.logprobs, true);
assert.equal(readOpenRouterModelCapabilities({ supported_parameters: ["temperature"] })?.logprobs, undefined);
console.log("model picker job pick regression passed");
