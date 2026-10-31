import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const path = "packages/client/src/components/modals/create-connection/CreateConnectionModalContent.tsx";
const source = process.env.REGRESSION_SOURCE_REF
  ? execFileSync("git", ["show", `${process.env.REGRESSION_SOURCE_REF}:${path}`], { encoding: "utf8" })
  : readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const handler = (start: string, end: string, name: string, context: object) => {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Must find the ${name} handler without including JSX`);
  return new Function(
    "context",
    `with(context) { ${ts.transpile(source.slice(first, last) + `\nreturn ${name};`, { target: ts.ScriptTarget.ES2022 })} }`,
  )(context);
};

const calls: string[] = [];
let fail = false;
let main = false;
let offerMain = true;
const context = {
  firstPick: { connectionId: "added" },
  get offerMain() {
    return offerMain;
  },
  makeMainOn: true,
  hasAgents: false,
  useInChat: false,
  updateRow: {
    mutateAsync: async (data: object) => {
      calls.push("save");
      assert.deepEqual(data, { id: "added", isDefault: true, defaultForAgents: true });
      if (fail) throw new Error("offline");
      main = true;
    },
  },
  toast: { error: () => calls.push("error") },
  t: () => "error",
  errorText: String,
  setFinishing: (value: boolean) => calls.push(`busy:${value}`),
  discard: async () => calls.push("discard"),
  onClose: () => {
    assert.equal(main, true, "Save Main before closing the Add window");
    calls.push("close");
  },
  target: null,
};
const applyChoices = handler("const applyChoices =", "  const setAsMain =", "applyChoices", context);
const close = handler("const close =", "  const requestClose", "close", { ...context, applyChoices });
assert.match(source, /const finishModels = \(\) => void close\(true\);/u, "Done must save the footer choices");
fail = true;
await close(true);
assert.equal(main, false);
assert.deepEqual(calls, ["busy:true", "save", "error", "busy:false"]);
calls.length = 0;
fail = false;
await close(true);
assert.deepEqual(calls, ["busy:true", "save", "discard", "busy:false", "close"]);

calls.length = 0;
await close();
assert.deepEqual(calls, ["busy:true", "discard", "busy:false", "close"], "Dismiss must not assign Main");
calls.length = 0;
offerMain = false;
await close(true);
assert.deepEqual(calls, ["busy:true", "discard", "busy:false", "close"], "An existing Main must not be replaced");
console.log("add Main choice regression passed");
