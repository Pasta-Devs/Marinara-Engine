import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(
  new URL("../../packages/client/src/components/connections/ConnectionSelect.tsx", import.meta.url),
  "utf8",
);
const code = ts.transpile(
  source
    .slice(
      source.indexOf("/** What an empty choice falls back to"),
      source.indexOf("/**\n * The Models one slot offers"),
    )
    .replaceAll("export ", "") + "\nreturn { resolveInherited, inheritLabel };",
  { target: ts.ScriptTarget.ES2022 },
);
const { resolveInherited, inheritLabel } = new Function("isConnectionFlagTrue", code)(
  (v: unknown) => v === true || v === "true",
);

const a = { id: "a", model: "Claude Sonnet" };
const b = { id: "b", model: "GPT", defaultForAgents: true };
const rows = [a, b];

assert.equal(resolveInherited("main", rows, rows, a), a);
assert.equal(resolveInherited("agents", rows, rows, a), b);
assert.equal(resolveInherited("agents", [a], [a], a), a, "no agents flag falls back to Main");
assert.equal(resolveInherited({ connectionId: null }, rows, rows, a), a);
assert.equal(resolveInherited({ connectionId: "b" }, rows, rows, a), b);
assert.equal(resolveInherited({ connectionId: "gone" }, rows, rows, a), null);
assert.equal(
  inheritLabel("Same as chat", "Claude Sonnet", (_k: string, v: Record<string, string>) => `${v.label} (→ ${v.model})`),
  "Same as chat (→ Claude Sonnet)",
);
console.log("connection-select-inherit regression passed");
