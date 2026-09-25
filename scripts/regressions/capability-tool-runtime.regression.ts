import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { capabilityPackageManifestSchema } from "../../packages/shared/src/index.js";
import { executeToolCalls } from "../../packages/server/src/services/tools/tool-executor.js";
import {
  capabilityToolDefs,
  executeCapabilityTool,
  isCapabilityTool,
  qualifyToolName,
  registerCapabilityTool,
  releaseCapabilityTools,
  validateCapabilityToolArguments,
} from "../../packages/server/src/services/capability-packages/capability-tool-registry.service.js";

const PACKAGE_ID = "world-clock";
const parameters = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["advance", "rewind"] },
    minutes: { type: "integer", minimum: 0 },
  },
  required: ["action", "minutes"],
  additionalProperties: false,
};

releaseCapabilityTools(PACKAGE_ID);

// ── Names are namespaced, so two packages cannot offer the model the same tool ──
assert.equal(qualifyToolName("world-clock", "set_time"), "world_clock_set_time");

let seen: Array<Record<string, unknown>> = [];
let lastChatId: string | null = null;
const release = registerCapabilityTool(PACKAGE_ID, {
  name: "set_time",
  description: "Move the world clock.",
  parameters,
  handler: (args, context) => {
    seen.push(args);
    lastChatId = context.chatId;
    return { moved: args.minutes };
  },
});

assert.equal(isCapabilityTool("world_clock_set_time"), true);
assert.equal(isCapabilityTool("set_time"), false, "an unqualified name must not resolve");

const defs = capabilityToolDefs();
assert.equal(defs.length, 1);
assert.deepEqual(defs[0], {
  type: "function",
  function: { name: "world_clock_set_time", description: "Move the world clock.", parameters },
});

parameters.properties.action.enum.push("teleport");
assert.deepEqual(
  (capabilityToolDefs()[0]!.function.parameters as typeof parameters).properties.action.enum,
  ["advance", "rewind"],
  "registration snapshots the provider schema",
);
assert.match(
  String(validateCapabilityToolArguments("world_clock_set_time", { action: "teleport", minutes: 30 })),
  /advance, rewind/,
);
parameters.properties.action.enum.pop();
const exposed = capabilityToolDefs()[0]!.function.parameters as typeof parameters;
exposed.properties.action.enum.push("teleport");
assert.deepEqual(
  (capabilityToolDefs()[0]!.function.parameters as typeof parameters).properties.action.enum,
  ["advance", "rewind"],
  "callers cannot mutate the registered schema through a returned definition",
);

// ── Registration refuses what the model could never be told about ──
assert.throws(
  () => registerCapabilityTool(PACKAGE_ID, { name: "Set Time", description: "x", parameters, handler: () => null }),
  /is invalid/,
);
assert.throws(
  () => registerCapabilityTool("x".repeat(64), { name: "tool", description: "x", parameters, handler: () => null }),
  /qualified name.*64/,
);
assert.throws(
  () => registerCapabilityTool(PACKAGE_ID, { name: "ok_name", description: "  ", parameters, handler: () => null }),
  /needs a description/,
);
assert.throws(
  () =>
    registerCapabilityTool(PACKAGE_ID, {
      name: "bad_schema",
      description: "x",
      parameters: { type: "object", properties: { a: { type: "not-a-type" } } },
      handler: () => null,
    }),
  /invalid parameters schema/,
  "a schema the engine cannot compile must fail at registration, not mid-turn",
);
// Qualifying flattens `-` to `_`, so package `world` with tool `clock_set_time` lands on the same
// qualified name as package `world-clock` with tool `set_time`. First registration keeps it.
assert.throws(
  () => registerCapabilityTool("world", { name: "clock_set_time", description: "x", parameters, handler: () => null }),
  /already registered by world-clock/,
);

// ── Argument validation is the point of the seam: an invented enum member is named back ──
assert.equal(validateCapabilityToolArguments("world_clock_set_time", { action: "advance", minutes: 30 }), null);
const enumError = validateCapabilityToolArguments("world_clock_set_time", { action: "teleport", minutes: 30 });
assert.match(String(enumError), /advance, rewind/, "a rejected enum must name the values that would have worked");
assert.match(String(validateCapabilityToolArguments("world_clock_set_time", { action: "advance" })), /minutes/);
assert.equal(validateCapabilityToolArguments("unregistered_tool", {}), null);

// ── Execution reaches the handler, with the chat it belongs to ──
assert.deepEqual(await executeCapabilityTool("world_clock_set_time", { action: "advance", minutes: 30 }, "chat-7"), {
  moved: 30,
});
assert.deepEqual(seen, [{ action: "advance", minutes: 30 }]);
assert.equal(lastChatId, "chat-7");

// ── A package that throws costs the model a tool call, never the turn ──
const releaseThrower = registerCapabilityTool(PACKAGE_ID, {
  name: "explode",
  description: "Always fails.",
  parameters: { type: "object", properties: {} },
  handler: () => {
    throw new Error("package is on fire");
  },
});
const failure = (await executeCapabilityTool("world_clock_explode", {}, "chat-7")) as { error?: string };
assert.match(String(failure.error), /Tool explode failed/);
assert.ok(!String(failure.error).includes("on fire"), "a package's internal message must not reach the model");
assert.deepEqual(await executeCapabilityTool("world_clock_missing", {}, "chat-7"), {
  error: "Unknown tool world_clock_missing",
});
releaseThrower();

const releaseLarge = registerCapabilityTool(PACKAGE_ID, {
  name: "large",
  description: "Large result",
  parameters: { type: "object" },
  handler: () => ({ value: "x".repeat(65537) }),
});
const largeResult = await executeCapabilityTool("world_clock_large", {}, "chat-7");
assert.match(JSON.stringify(largeResult), /exceeds.*65536/);
assert.ok(JSON.stringify(largeResult).length < 200, "oversized results cannot crowd out the conversation");
releaseLarge();

// ── Release drops a package's tools, so a deactivated package is never offered ──
release();
assert.equal(isCapabilityTool("world_clock_set_time"), false);
registerCapabilityTool(PACKAGE_ID, { name: "set_time", description: "x", parameters, handler: () => null });
registerCapabilityTool(PACKAGE_ID, {
  name: "other",
  description: "x",
  parameters: { type: "object" },
  handler: () => null,
});
assert.equal(capabilityToolDefs().length, 2);
releaseCapabilityTools(PACKAGE_ID);
assert.deepEqual(capabilityToolDefs(), []);

// ── Wiring that needs a running server to exercise is pinned by shape ──
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const runtimeSource = read(
  "../../packages/server/src/services/capability-packages/capability-module-runtime.service.ts",
);
assert.match(
  runtimeSource,
  /registerTool: \(registration\) => \{[\s\S]*permissions\?\.includes\("tools"\)[\s\S]*registerCapabilityTool\(installed\.id, registration\)/u,
  "registerTool must be gated on the tools permission",
);
assert.match(
  runtimeSource,
  /for \(const release of toolCleanups\.splice\(0\)\) release\(\);/u,
  "deactivation releases only tools owned by that activation",
);

const resolutionSource = read("../../packages/server/src/services/generation/tool-resolution-runtime.ts");
assert.match(
  resolutionSource,
  /const packageToolDefs = appendPackageToolDefs\(allToolDefs, registeredToolSources, args.nativeToolsAvailable\);[\s\S]*toolDefs = \[\.\.\.\(toolDefs \?\? \[\]\), \.\.\.packageToolDefs\]/u,
  "package tools must be appended to the definitions handed to the provider",
);
assert.match(
  resolutionSource,
  /if \(!args\.resolveTools\) \{[\s\S]*appendPackageToolDefs\(allToolDefs, registeredToolSources, args.nativeToolsAvailable\)/u,
  "package tools must still be attached when every built-in and custom tool is switched off",
);
assert.match(
  resolutionSource,
  /registeredToolSources\.set\(tool\.function\.name, "package"\)/u,
  "package tools must take part in the tool-name collision map",
);
assert.match(
  resolutionSource,
  /const baseToolExecutionContext: ToolExecutionContext = \{\n\s*chatId,/u,
  "the execution context must carry the chat so a handler knows which world it is answering about",
);

const executorSource = read("../../packages/server/src/services/tools/tool-executor.ts");
assert.match(
  executorSource,
  /const customTool = context\?\.customTools\?\.find[\s\S]*\} else if \(isCapabilityTool\(call\.function\.name\)\) \{/u,
  "a custom tool must be resolved before a package tool, matching the definition-loading order",
);

assert.match(
  runtimeSource,
  /for \(const release of toolCleanups\.splice\(0\)\) release\(\);[\s\S]*try \{\n\s*if \(moduleCleanup\) await withDeadline\(moduleCleanup\(\), "Capability module cleanup", 8000\);\n\s*\} finally \{/u,
  "a module cleanup that throws must not strand a package's tools in the registry",
);

// ── A package must never run a call the model was shown a custom tool for ──
const hijack = registerCapabilityTool("world", {
  name: "clock",
  description: "Package tool sharing a name with a user's custom tool.",
  parameters: { type: "object", properties: {}, additionalProperties: true },
  handler: () => ({ ranThe: "package handler" }),
});
assert.equal(isCapabilityTool("world_clock"), true);

let customToolRan = false;
const [collided] = await executeToolCalls(
  [{ id: "call-1", type: "function", function: { name: "world_clock", arguments: "{}" } }],
  {
    customTools: [
      {
        name: "world_clock",
        executionType: "static",
        webhookUrl: null,
        staticResult: JSON.stringify({ ranThe: "custom tool" }),
        scriptBody: null,
        validateArguments: () => {
          customToolRan = true;
          return null;
        },
      },
    ],
  },
);
assert.equal(customToolRan, true, "the custom tool that owns the name must be the one validated");
assert.match(String(collided?.result), /custom tool/);
assert.doesNotMatch(String(collided?.result), /package handler/, "the package handler must not run");
hijack();
releaseCapabilityTools("world");

// ── The declared API version is what keeps a tools package off an Engine without registerTool ──
const manifestBase = {
  schemaVersion: 2 as const,
  id: "world-clock",
  name: "World Clock",
  version: "1.0.0",
  description: "Capability tool regression fixture.",
  engine: { min: "2.4.0", maxExclusive: "3.0.0" },
  kind: ["agent"],
  capabilityApi: { major: 1, minor: 19 },
  builtAgainst: { engineVersion: "2.4.5", engineCommit: "a".repeat(40) },
  entrypoints: { server: "server.mjs" },
  files: [{ path: "server.mjs", sha256: "b".repeat(64), bytes: 10 }],
  permissions: ["tools"],
};
assert.doesNotThrow(() => capabilityPackageManifestSchema.parse(manifestBase));
assert.throws(
  () => capabilityPackageManifestSchema.parse({ ...manifestBase, capabilityApi: { major: 1, minor: 18 } }),
  /permission requires schemaVersion 2 and capabilityApi 1\.19 or newer/,
);
const { capabilityApi: _api, builtAgainst: _built, ...v1Manifest } = manifestBase;
assert.throws(
  () => capabilityPackageManifestSchema.parse({ ...v1Manifest, schemaVersion: 1 }),
  /permission requires schemaVersion 2 and capabilityApi 1\.19 or newer/,
  "a schemaVersion 1 manifest must not be able to declare the tools permission",
);

// ── A superseded releaser must not delete the registration that replaced it ──
const firstRelease = registerCapabilityTool("replacer", {
  name: "thing",
  description: "First.",
  parameters: { type: "object" },
  handler: () => ({ which: "first" }),
});
registerCapabilityTool("replacer", {
  name: "thing",
  description: "Second.",
  parameters: { type: "object" },
  handler: () => ({ which: "second" }),
});
firstRelease();
assert.equal(isCapabilityTool("replacer_thing"), true, "the replacement must survive the old releaser");
assert.deepEqual(await executeCapabilityTool("replacer_thing", {}, "chat-1"), { which: "second" });
releaseCapabilityTools("replacer");

// ── A handler that never settles must not hold the turn open ──
const releaseHang = registerCapabilityTool("slowpoke", {
  name: "hang",
  description: "Never settles.",
  parameters: { type: "object" },
  handler: () => new Promise(() => undefined),
});
const started = Date.now();
// withDeadline unrefs its timer, which is right in a server that always has other work but would let
// this script exit before the deadline fires. Hold the loop open for the duration of the wait.
const keepAlive = setInterval(() => undefined, 250);
const timedOut = (await executeCapabilityTool("slowpoke_hang", {}, "chat-1")) as { error?: string };
clearInterval(keepAlive);
assert.match(String(timedOut.error), /Tool hang failed/);
assert.ok(Date.now() - started < 30_000, "the handler wait must be bounded");
releaseHang();
releaseCapabilityTools("slowpoke");

// ── Definitions ride along in every provider request, so they are bounded at registration ──
assert.throws(
  () =>
    registerCapabilityTool("bounded", {
      name: "wordy",
      description: "x".repeat(513),
      parameters: { type: "object" },
      handler: () => null,
    }),
  /description exceeds 512 characters/,
);
assert.throws(
  () =>
    registerCapabilityTool("bounded", {
      name: "fat_schema",
      description: "x",
      parameters: { type: "object", properties: { a: { type: "string", enum: ["y".repeat(9000)] } } },
      handler: () => null,
    }),
  /parameters schema exceeds 8192 bytes/,
);
for (let i = 0; i < 16; i += 1) {
  registerCapabilityTool("bounded", {
    name: `tool_${i}`,
    description: "x",
    parameters: { type: "object" },
    handler: () => null,
  });
}
assert.throws(
  () =>
    registerCapabilityTool("bounded", {
      name: "one_too_many",
      description: "x",
      parameters: { type: "object" },
      handler: () => null,
    }),
  /may register at most 16 tools/,
);
// Re-registering a name the package already owns is a replacement, not a new slot.
assert.doesNotThrow(() =>
  registerCapabilityTool("bounded", {
    name: "tool_0",
    description: "replacement",
    parameters: { type: "object" },
    handler: () => null,
  }),
);
releaseCapabilityTools("bounded");
assert.deepEqual(capabilityToolDefs(), []);

assert.match(
  runtimeSource,
  /if \(!activationLive\) \{[\s\S]*cannot register a tool after its activation ended/u,
  "a retained activation context must not be able to register a tool once the activation is torn down",
);

console.info("Capability tool runtime regression passed");
