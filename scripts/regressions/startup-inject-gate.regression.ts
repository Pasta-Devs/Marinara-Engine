import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// A background task that calls app.inject() while startup is still registering routes used to boot Fastify early.
// Every later capability package then failed with "Root plugin has already booted" and the next addHook threw and
// killed the server. The gate holds such calls until registration has finished.
process.env.LOG_LEVEL = "silent";
process.env.LOG_FILE_LEVEL = "silent";
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { holdInjectUntilRegistered, failInjectFastDuring, InjectDuringRegistrationError } =
  await import("../../packages/server/src/lib/fastify-inject-gate.js");

const app = Fastify();
const release = holdInjectUntilRegistered(app);
app.get("/early", async () => ({ ok: "early" }));

// A background call fires before registration is finished.
const earlyCall = app.inject({ method: "GET", url: "/late" });
await new Promise((resolve) => setTimeout(resolve, 20));

// Registration continues after the early call: this used to throw "already listening/booted".
app.get("/late", async () => ({ ok: "late" }));
app.addHook("onRequest", async () => undefined);
await app.register(async (child) => {
  child.get("/plugin", async () => ({ ok: "plugin" }));
});

release();
const late = await earlyCall;
assert.equal(late.statusCode, 200, "the held request runs after registration and reaches a route added later");
assert.deepEqual(late.json(), { ok: "late" });
assert.equal((await app.inject({ method: "GET", url: "/plugin" })).statusCode, 200, "calls after release run directly");

// Callback style is held too.
const app2 = Fastify();
const release2 = holdInjectUntilRegistered(app2);
const callbackResult = new Promise<number>((resolve, reject) =>
  app2.inject({ method: "GET", url: "/cb" }, (error, response) =>
    error ? reject(error) : resolve(response!.statusCode),
  ),
);
app2.get("/cb", async () => "ok");
release2();
assert.equal(await callbackResult, 200);
await app.close();
await app2.close();

// A held callback-style call whose inject() throws synchronously once released reports the error to its callback
// instead of leaving an unhandled rejection.
const throwing = {
  inject: (..._args: unknown[]) => {
    throw new Error("synchronous inject failure fixture");
  },
};
const releaseThrowing = holdInjectUntilRegistered(
  throwing as unknown as Parameters<typeof holdInjectUntilRegistered>[0],
);
const syncThrow = new Promise<unknown>((resolve) =>
  (throwing.inject as (options: unknown, callback: (error: unknown) => void) => void)({ url: "/x" }, resolve),
);
releaseThrowing();
assert.match(String((await syncThrow) as Error), /synchronous inject failure fixture/u);

// Startup must not hang on a call that registration itself awaits (a capability package awaiting runInternalRoute
// inside activate() or selfCheck()): inside failInjectFastDuring such a call fails at once, promise and callback style.
const app3 = Fastify();
const release3 = holdInjectUntilRegistered(app3);
app3.get("/internal", async () => "ok");
const startedAt = Date.now();
await assert.rejects(
  failInjectFastDuring(() => app3.inject({ method: "GET", url: "/internal" })),
  (error: unknown) => error instanceof InjectDuringRegistrationError,
);
const callbackError = await failInjectFastDuring(
  () => new Promise<unknown>((resolve) => app3.inject({ method: "GET", url: "/internal" }, (error) => resolve(error))),
);
assert.ok(callbackError instanceof InjectDuringRegistrationError);
assert.ok(Date.now() - startedAt < 5_000, "the awaited call fails fast instead of waiting for registration");
// A timer started inside activate() that fires after it returned is held like any background call.
let timerCall: Promise<{ statusCode: number }> | null = null;
await failInjectFastDuring(async () => {
  setTimeout(() => {
    timerCall = app3.inject({ method: "GET", url: "/internal" }) as unknown as Promise<{ statusCode: number }>;
  }, 10);
});
await new Promise((resolve) => setTimeout(resolve, 30));
assert.ok(timerCall, "the timer fired");
app3.get("/after", async () => "after");
release3();
assert.equal((await timerCall!).statusCode, 200);
await app3.close();

// Any other held call gives up after maxHoldMs, so startup fails loudly instead of hanging forever.
const app4 = Fastify();
holdInjectUntilRegistered(app4, { warnAfterMs: 5, maxHoldMs: 20 });
// The gate's timers are unref'd (they must not keep a server alive); keep this script alive until the limit fires.
const keepAlive = setTimeout(() => undefined, 5_000);
await assert.rejects(
  app4.inject({ method: "GET", url: "/never" }) as unknown as Promise<unknown>,
  (error: unknown) => error instanceof InjectDuringRegistrationError,
);
clearTimeout(keepAlive);
await app4.close();

// buildApp installs the gate right after creating the instance and releases it only at the very end.
const appSource = readFileSync(new URL("../../packages/server/src/app.ts", import.meta.url), "utf8");
const install = appSource.indexOf("holdInjectUntilRegistered(app)");
const runtimeStart = appSource.indexOf("capabilityModuleRuntime.start(app)");
const schedulerStart = appSource.indexOf("startServerAutonomousScheduler(app)");
const releaseAt = appSource.indexOf("releaseInjectGate();");
const returnAt = appSource.lastIndexOf("return app;");
assert.ok(
  install > 0 && install < schedulerStart && install < runtimeStart,
  "gate is installed before background work and packages start",
);
assert.ok(
  releaseAt > runtimeStart && releaseAt < returnAt,
  "gate is released after package activation, just before buildApp returns",
);

console.log("startup-inject-gate regression passed");

// A host lifecycle failure must not roll a package back or mark it "error" (that disabled healthy packages for good).
const { isHostLifecycleActivationError } =
  await import("../../packages/server/src/services/capability-packages/capability-module-runtime.service.js");
const booted = Object.assign(new Error("Root plugin has already booted"), { code: "AVV_ERR_ROOT_PLG_BOOTED" });
const listening = Object.assign(new Error("Fastify instance is already listening. Cannot add route!"), {
  code: "FST_ERR_INSTANCE_ALREADY_LISTENING",
});
assert.equal(isHostLifecycleActivationError(booted), true);
assert.equal(isHostLifecycleActivationError(listening), true);
assert.equal(isHostLifecycleActivationError(new Error("Cannot find module './server.mjs'")), false);
const runtimeSource = readFileSync(
  new URL(
    "../../packages/server/src/services/capability-packages/capability-module-runtime.service.ts",
    import.meta.url,
  ),
  "utf8",
);
assert.ok(
  runtimeSource.indexOf("if (hostLifecycleError) {\n        // Keep the installed version") > 0 &&
    runtimeSource.indexOf("if (hostLifecycleError) {\n        // Keep the installed version") <
      runtimeSource.indexOf("await capabilityPackageManager.rollbackRuntime(installed.id)"),
  "host lifecycle errors return before rollback and before the error status is persisted",
);
assert.equal(
  runtimeSource.match(/was not activated because the server finished starting too early/gu)?.length,
  1,
  "a host lifecycle failure is logged once, as a warning",
);
assert.match(runtimeSource, /failInjectFastDuring\(\(\) => activate\.call\(module, context\)\)/u);
assert.match(runtimeSource, /failInjectFastDuring\(\(\) => module\.selfCheck\?\.\(context\)\)/u);
console.log("capability host-lifecycle error handling passed");
