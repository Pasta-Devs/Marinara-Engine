import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const path = "packages/client/src/components/modals/create-connection/CreateConnectionModalContent.tsx";
const source = process.env.REGRESSION_SOURCE_REF
  ? execFileSync("git", ["show", `${process.env.REGRESSION_SOURCE_REF}:${path}`], { encoding: "utf8" })
  : readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const handler = (start: string, end: string, name: string, context: object) =>
  new Function(
    "context",
    `with(context) { ${ts.transpile(source.slice(source.indexOf(start), source.indexOf(end)) + `\nreturn ${name};`, { target: ts.ScriptTarget.ES2022 })} }`,
  )(context);

const calls: string[] = [];
let fail = false;
let main = false;
const context = {
  offerJobs: true,
  firstPick: { connectionId: "added" },
  offerMain: true,
  makeMainOn: true,
  hasMain: false,
  hasAgents: false,
  optionalJobs: ["main", "agents"],
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
  setMakeMain: () => {},
  setSelectedJobs: (jobs: string[]) => assert.deepEqual(jobs, [], "already saved jobs must not be assigned twice"),
  setChoosingJobs: (value: boolean) => {
    assert.equal(main, true, "save Main before opening jobs");
    calls.push(`jobs:${value}`);
  },
  requestAnimationFrame: () => {},
};
const applyChoices = handler("const applyChoices =", "  const setAsMain =", "applyChoices", context);
const finish = handler("const finishModels =", "  // ── Header", "finishModels", { ...context, applyChoices });
fail = true;
await finish();
assert.equal(main, false);
assert.deepEqual(calls, ["busy:true", "save", "error", "busy:false"]);
calls.length = 0;
fail = false;
await finish();
assert.deepEqual(calls, ["busy:true", "save", "busy:false", "jobs:true"]);

calls.length = 0;
const close = handler("const close =", "  const requestClose", "close", {
  ...context,
  choosingJobs: true,
  applyChoices: async () => {
    calls.push("duplicate-save");
    return true;
  },
  assignJob: async () => {
    calls.push("assign");
    return null;
  },
  discard: async () => calls.push("discard"),
  onClose: () => calls.push("close"),
  target: null,
});
await close(true);
assert.deepEqual(calls, ["busy:true", "assign", "discard", "busy:false", "close"]);
console.log("add Main choice regression passed");
