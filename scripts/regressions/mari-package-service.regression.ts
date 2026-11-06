// Professor Mari's package_service tool: packages that declare `mari-actions` register
// `mari-actions:<package-id>`, and Mari can list those actions and run one with JSON input.
import assert from "node:assert/strict";
import { capabilityPackageManifestSchema } from "../../packages/shared/src/schemas/capability-package.schema.js";
import {
  assertCapabilityMariActionsServiceRegistration,
  listCapabilityMariActions,
  runCapabilityMariAction,
  type CapabilityMariActionsService,
} from "../../packages/server/src/services/capability-packages/capability-mari-actions.service.js";
import {
  registerCapabilityService,
  resetCapabilityServices,
} from "../../packages/server/src/services/capability-packages/capability-service-registry.service.js";
import {
  auditWorkspaceCompletionClaim,
  isMutatingWorkspaceCommand,
  parseAssistantWorkspaceAction,
  ProfessorMariWorkspaceService,
  resolveWorkspaceMutationVerification,
  workspaceCommandProtocolPrompt,
} from "../../packages/server/src/services/professor-mari/workspace-agent.service.js";

// ── The manifest permission needs capability API 1.50 ───────────────────────
const manifest = (minor: number) => ({
  schemaVersion: 2,
  capabilityApi: { major: 1, minor },
  builtAgainst: { engineVersion: "2.4.6", engineCommit: "a".repeat(40) },
  id: "slurp2",
  name: "Slurp",
  version: "1.0.0",
  engine: { min: "2.3.0", maxExclusive: "3.0.0" },
  kind: ["agent"],
  entrypoints: { server: "server.mjs" },
  files: [{ path: "server.mjs", sha256: "0".repeat(64), bytes: 1 }],
  permissions: ["mari-actions"],
  restartRequired: true,
});
assert.doesNotThrow(() => capabilityPackageManifestSchema.parse(manifest(50)));
assert.throws(() => capabilityPackageManifestSchema.parse(manifest(49)), /mari-actions.{0,2} permission requires/);

// ── Registration: permission required, and only under the package's own id ──
assert.doesNotThrow(() => assertCapabilityMariActionsServiceRegistration("slurp2", [], "slurp2:actions"));
assert.doesNotThrow(() =>
  assertCapabilityMariActionsServiceRegistration("slurp2", ["mari-actions"], "mari-actions:slurp2"),
);
assert.throws(
  () => assertCapabilityMariActionsServiceRegistration("slurp2", [], "mari-actions:slurp2"),
  /must declare the "mari-actions" permission/,
);
assert.throws(
  () => assertCapabilityMariActionsServiceRegistration("evil", ["mari-actions"], "mari-actions:slurp2"),
  /cannot register Mari actions for another package/,
);

// ── Listing and running ─────────────────────────────────────────────────────
resetCapabilityServices();
const live = new AbortController().signal;
// withDeadline unrefs its timer (right for the server); keep this script alive while it waits.
const keepAlive = setInterval(() => undefined, 1_000);
const received: unknown[] = [];
let hangSignal: AbortSignal | null = null;
const slurp: CapabilityMariActionsService = {
  list: () => [
    { name: "add-idea", summary: "Give a Creator an idea.", inputs: { accountId: "The Creator.", text: "The idea." } },
    { name: "draw-picture", summary: "Draw a picture." },
    { name: "long", summary: "y".repeat(5000), inputs: { ok: "fine", bad: 3 as unknown as string } },
    { name: "odd", summary: { not: "text" } as unknown as string },
    { name: "hang" },
    { name: "huge-error" },
    { name: "bad name with spaces" },
  ],
  run: async (name, input, { signal }) => {
    received.push(input);
    if (name === "hang") {
      // Ignores its signal on purpose: the Engine must stop waiting anyway.
      hangSignal = signal;
      return new Promise(() => undefined);
    }
    if (name === "huge-error") {
      return { ok: false, error: `data:image/png;charset=x;base64,${"B".repeat(9000)} bad ${"z".repeat(10_000)}` };
    }
    if (name === "draw-picture") return { ok: true, value: { image: `data:image/png;base64,${"A".repeat(5000)}` } };
    if (input.text === "too many") return { ok: false, status: 409, error: "That is plenty of ideas for now." };
    return { ok: true, value: { steering: { nudges: [input.text] } } };
  },
};
registerCapabilityService("mari-actions:slurp2", slurp);
registerCapabilityService("mari-actions:broken", {
  list: () => {
    throw new Error("boom");
  },
  run: async () => ({ ok: true, value: null }),
});
registerCapabilityService("mari-actions:not-a-service", { hello: true });
registerCapabilityService("mari-actions:sync-throw", {
  list: () => [{ name: "boom", inputs: ["array", "inputs"] as unknown as Record<string, string> }],
  run: () => {
    throw new Error("thrown before any promise");
  },
});
const releaseSlow = registerCapabilityService("mari-actions:slow", {
  list: () => new Promise(() => undefined),
  run: async () => ({ ok: true, value: null }),
});
registerCapabilityService("slurp2:actions", slurp);

const listed = await listCapabilityMariActions(live);
assert.deepEqual(
  listed.map((entry) => [entry.package, entry.actions.map((action) => action.name)]),
  [
    ["slurp2", ["add-idea", "draw-picture", "long", "odd", "hang", "huge-error"]],
    ["sync-throw", ["boom"]],
  ],
  "only well-formed mari-actions services are listed; a throwing or hanging list hides only its own package",
);
releaseSlow();
// Stop must also interrupt discovery and the list used to validate an action.
let slowLists = 0;
const releaseStoppedList = registerCapabilityService("mari-actions:stopped-list", {
  list: () => {
    slowLists++;
    return new Promise(() => undefined);
  },
  run: async () => ({ ok: true, value: null }),
});
await assert.rejects(runCapabilityMariAction("stopped-list", "add", [], live), /must be a JSON object/);
await assert.rejects(
  runCapabilityMariAction("stopped-list", "add", { text: "x".repeat(70_000) }, live),
  /larger than 64000 characters/,
);
assert.equal(slowLists, 0, "invalid input is rejected before calling package code");
for (const invoke of [
  (signal: AbortSignal) => listCapabilityMariActions(signal),
  (signal: AbortSignal) => runCapabilityMariAction("stopped-list", "add", {}, signal),
]) {
  const stopListing = new AbortController();
  const pending = invoke(stopListing.signal);
  await new Promise((resolve) => setImmediate(resolve));
  const stoppedAt = performance.now();
  stopListing.abort();
  await assert.rejects(pending, /abort/i);
  assert.ok(performance.now() - stoppedAt < 1_000, "Stop must not wait for the five-second list deadline");
}
releaseStoppedList();
// Removal or replacement during async discovery invalidates the captured activation.
for (const replace of [false, true]) {
  let finishList!: (actions: Array<{ name: string }>) => void;
  const waitingList = new Promise<Array<{ name: string }>>((resolve) => {
    finishList = resolve;
  });
  let oldRuns = 0;
  let newRuns = 0;
  const removeOld = registerCapabilityService("mari-actions:changing", {
    list: () => waitingList,
    run: async () => {
      oldRuns++;
      return { ok: true, value: "old" };
    },
  });
  const pendingList = listCapabilityMariActions(live);
  const pendingRun = runCapabilityMariAction("changing", "mutate", {}, live);
  await new Promise((resolve) => setImmediate(resolve));
  removeOld();
  const removeNew = replace
    ? registerCapabilityService("mari-actions:changing", {
        list: () => [{ name: "mutate" }],
        run: async () => {
          newRuns++;
          return { ok: true, value: "new" };
        },
      })
    : undefined;
  finishList([{ name: "mutate" }]);
  await assert.rejects(pendingRun, /changed while listing/, "stale discovery cannot authorize an action");
  assert.equal(
    (await pendingList).some((entry) => entry.package === "changing"),
    false,
    "an old activation is not advertised after removal or replacement",
  );
  assert.equal(oldRuns, 0, "a removed activation cannot run after its list resolves");
  assert.equal(newRuns, 0, "a pending old call is not silently routed to the replacement");
  if (replace) {
    assert.equal(await runCapabilityMariAction("changing", "mutate", {}, live), "new");
    assert.equal(newRuns, 1, "a fresh call may run the replacement activation");
  }
  removeNew?.();
}
const long = listed[0]!.actions.find((action) => action.name === "long")!;
assert.ok((long.summary?.length ?? 0) <= 301, "package-authored list text is capped");
assert.deepEqual(long.inputs, { ok: "fine" }, "only string input descriptions reach Mari");
assert.equal(listed[0]!.actions.find((action) => action.name === "odd")!.summary, undefined);

const input = { accountId: "creator-1", text: "A rainy-day cafe post" };
assert.deepEqual(await runCapabilityMariAction("slurp2", "add-idea", input, live), {
  steering: { nudges: ["A rainy-day cafe post"] },
});
assert.deepEqual(received.at(-1), input);
assert.notEqual(received.at(-1), input, "the package receives a plain-data copy, not the caller's object");
await assert.rejects(runCapabilityMariAction("slurp2", "add-idea", { text: "too many" }, live), /plenty of ideas/);
await assert.rejects(runCapabilityMariAction("slurp2", "delete-everything", {}, live), /has no Mari action/);
await assert.rejects(runCapabilityMariAction("slurp2", "bad name with spaces", {}, live), /has no Mari action/);
await assert.rejects(runCapabilityMariAction("other", "add-idea", {}, live), /offers no Mari actions/);
await assert.rejects(runCapabilityMariAction("../slurp2", "add-idea", {}, live), /is not a package id/);
await assert.rejects(runCapabilityMariAction("slurp2", "add-idea", ["x"], live), /must be a JSON object/);
await assert.rejects(
  runCapabilityMariAction("slurp2", "add-idea", { text: "x".repeat(70_000) }, live),
  /larger than 64000 characters/,
);
assert.equal(listed[1]!.actions[0]!.inputs, undefined, "array inputs are not shown as numbered keys");
// A plain (non-async) run that throws must fail the call, not reach the process as an unhandled rejection.
await assert.rejects(runCapabilityMariAction("sync-throw", "boom", {}, live), /sync-throw boom failed: thrown before/);
await new Promise((resolve) => setImmediate(resolve));

const hugeError = await runCapabilityMariAction("slurp2", "huge-error", {}, live).catch((err: Error) => err.message);
assert.ok(String(hugeError).length < 2_200, "package error text is capped");
assert.doesNotMatch(String(hugeError), /BBBBBBBBBB/, "a data URL in an error never reaches Mari");
assert.match(String(hugeError), /<data URL, \d+ characters, omitted> bad/);

const stop = new AbortController();
const hanging = runCapabilityMariAction("slurp2", "hang", {}, stop.signal);
await new Promise((resolve) => setTimeout(resolve, 20));
stop.abort();
await assert.rejects(hanging, /slurp2 hang failed: slurp2 hang was stopped/, "Mari's stop ends a stuck action");
assert.equal(hangSignal?.aborted, true, "the package is told to stop too");
await assert.rejects(runCapabilityMariAction("slurp2", "add-idea", input, stop.signal), /abort/i);

const callsBefore = received.length;
await assert.rejects(runCapabilityMariAction("slurp2", "add-idea", "nope", live), /must be a JSON object/);
assert.equal(received.length, callsBefore, "rejected input never reaches the package");

// ── Mari: protocol, permissions classification, JSON and XML fallback ───────
assert.match(workspaceCommandProtocolPrompt(), /package_service/);
const listCall = { id: "1", name: "package_service" as const, arguments: {} };
const runCall = { id: "2", name: "package_service" as const, arguments: { package: "slurp2", action: "add-idea" } };
assert.equal(isMutatingWorkspaceCommand(listCall), false, "listing is read-only");
assert.equal(isMutatingWorkspaceCommand(runCall), true, "running counts as a change for Plan and Manual mode");

const jsonFrame = parseAssistantWorkspaceAction(
  JSON.stringify({
    say: "",
    commands: [{ name: "package_service", arguments: { package: "slurp2", action: "add-idea", input } }],
    stop: false,
  }),
);
assert.equal(jsonFrame.commands[0]?.name, "package_service");
assert.deepEqual(jsonFrame.commands[0]?.arguments, { package: "slurp2", action: "add-idea", input });
const xmlFrame = parseAssistantWorkspaceAction(
  '<package_service>{"package":"slurp2","action":"add-idea","input":{"accountId":"creator-1","text":"x"}}</package_service>',
);
assert.equal(xmlFrame.commands[0]?.name, "package_service");
assert.equal(xmlFrame.commands[0]?.arguments.action, "add-idea");

// A package run cannot be read back by the Engine: success is its own evidence, failure never is.
const runResult = (success: boolean) => ({
  id: "r",
  name: "package_service" as const,
  input: { package: "slurp2", action: "add-idea" },
  output: success ? "slurp2 add-idea succeeded." : "slurp2 add-idea failed: nope",
  success,
});
assert.equal(resolveWorkspaceMutationVerification([runResult(true)]), "verified");
const doneClaim = { commands: [], stop: true, visibleText: "Done, I added the idea." };
assert.equal(auditWorkspaceCompletionClaim(doneClaim, [runResult(true)]).issue, null);
assert.notEqual(auditWorkspaceCompletionClaim(doneClaim, [runResult(false)]).issue, null);
// A package list shows no store state, so it cannot pay an unverified write's debt or back a claim.
const unverifiedWrite = {
  id: "w",
  name: "write" as const,
  input: { path: "notes.md", content: "x" },
  output: "Wrote notes.md",
  success: true,
};
const listRead = { id: "l", name: "package_service" as const, input: {}, output: "[]", success: true };
assert.equal(resolveWorkspaceMutationVerification([unverifiedWrite, listRead]), "unverified");
assert.notEqual(auditWorkspaceCompletionClaim(doneClaim, [listRead]).issue, null);

// ── Mari: running the tool end to end ───────────────────────────────────────
const service = new ProfessorMariWorkspaceService({} as never);
const runner = service as unknown as {
  executeWorkspaceCommand(
    command: { id: string; name: "package_service"; arguments: Record<string, unknown> },
    signal: AbortSignal,
    trace: unknown[],
    onEvent: () => void,
  ): Promise<{ output: string; success: boolean }>;
};
const run = (args: Record<string, unknown>) =>
  runner.executeWorkspaceCommand(
    { id: "cmd", name: "package_service", arguments: args },
    new AbortController().signal,
    [],
    () => undefined,
  );

const listResult = await run({});
assert.equal(listResult.success, true);
assert.match(listResult.output, /"package": "slurp2"/);
assert.match(listResult.output, /Give a Creator an idea/);
assert.match((await run({ package: "nothing" })).output, /offers no Mari actions/);

const ideaResult = await run({ package: "slurp2", action: "add-idea", input: JSON.stringify(input) });
assert.equal(ideaResult.success, true, "a JSON-string input from a text-protocol model is accepted");
assert.match(ideaResult.output, /^slurp2 add-idea succeeded\./);
assert.deepEqual(received.at(-1), input);

const pictureResult = await run({ package: "slurp2", action: "draw-picture" });
assert.equal(pictureResult.success, true);
assert.doesNotMatch(pictureResult.output, /AAAAAAAAAA/, "a data URL never reaches Mari's context");
assert.match(pictureResult.output, /<data URL, \d+ characters, omitted>/);

const badInput = await run({ package: "slurp2", action: "add-idea", input: [1, 2] });
assert.equal(badInput.success, false);
assert.match(badInput.output, /package_service input must be a JSON object/);
const missingPackage = await run({ action: "add-idea" });
assert.equal(missingPackage.success, false);
assert.match(missingPackage.output, /needs a non-empty top-level "package" string \(none was sent\)/);
const failed = await run({ package: "slurp2", action: "add-idea", input: { text: "too many" } });
assert.equal(failed.success, false);
assert.match(failed.output, /slurp2 add-idea failed: That is plenty of ideas/);

resetCapabilityServices();
clearInterval(keepAlive);
console.log("mari-package-service regression passed");
