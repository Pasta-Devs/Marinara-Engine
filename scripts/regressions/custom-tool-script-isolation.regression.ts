import assert from "node:assert/strict";
import { executeToolCalls, type CustomToolDef } from "../../packages/server/src/services/tools/tool-executor.js";

process.env.CUSTOM_TOOL_SCRIPT_ENABLED = "true";
process.env.CUSTOM_TOOL_TIMEOUT_MS = "1000";

function tool(scriptBody: string): CustomToolDef {
  return {
    name: "isolated_script",
    executionType: "script",
    webhookUrl: null,
    staticResult: null,
    scriptBody,
    includeHiddenContext: true,
    validateArguments: () => null,
  };
}

const call = {
  id: "call-1",
  type: "function" as const,
  function: { name: "isolated_script", arguments: JSON.stringify({ value: 7 }) },
};

const [success] = await executeToolCalls([call], {
  customTools: [tool("return { result: args.value, context: context.allowed };")],
  hiddenContext: { allowed: "yes" },
});
assert.equal(success?.success, true);
assert.deepEqual(JSON.parse(success?.result ?? "{}"), { result: 7, context: "yes" });

process.env.CUSTOM_TOOL_TIMEOUT_MS = "100";
const started = Date.now();
const [timedOut] = await executeToolCalls([call], {
  customTools: [tool("while (true) {}")],
});
assert.equal(timedOut?.success, false);
assert.match(timedOut?.result ?? "", /timeout/u);
assert.ok(Date.now() - started < 2_000, "a script loop must be terminated outside the server thread");

process.env.CUSTOM_TOOL_TIMEOUT_MS = "1000";
const [escapeAttempt] = await executeToolCalls([call], {
  customTools: [
    tool(`
      let escaped = false;
      try {
        escaped = globalThis.constructor.constructor("return typeof process !== 'undefined'")();
      } catch {}
      return { escaped, processType: typeof process, requireType: typeof require };
    `),
  ],
});
assert.equal(escapeAttempt?.success, true);
assert.deepEqual(JSON.parse(escapeAttempt?.result ?? "{}"), {
  escaped: false,
  processType: "undefined",
  requireType: "undefined",
});

console.info("Custom tool script isolation regressions passed.");
