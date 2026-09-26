import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Writable } from "node:stream";
import pino from "../../packages/server/node_modules/pino/pino.js";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";

// One line per failure: an unknown 500 is logged once, a user stop is info, causes survive,
// repeating failures are rate limited, and model or provider text stays out of non-debug lines.
const { logger } = await import("../../packages/server/src/lib/logger.js");
const { failureLevel, isCancellation, logContextMixin } = await import("../../packages/server/src/lib/log-context.js");
const { logRateLimited, resetRateLimitedLogs, takeRateLimitedSlot } =
  await import("../../packages/server/src/lib/log-rate-limit.js");
const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
const { RequestLogController } = await import("../../packages/server/src/lib/request-logging.js");

const abort = Object.assign(new Error("stopped"), { name: "AbortError" });
assert.equal(isCancellation(abort), true);
assert.equal(isCancellation(Object.assign(new Error("x"), { code: "ABORT_ERR" })), true);
assert.equal(
  isCancellation(Object.assign(new Error("slow"), { name: "TimeoutError" })),
  false,
  "timeouts are failures",
);
assert.equal(isCancellation("AbortError"), false);
assert.equal(failureLevel(abort), "info");
assert.equal(failureLevel(new Error("boom")), "error");
assert.equal(failureLevel(new Error("boom"), "warn"), "warn");

// The shared logger serialises Errors under err and error, cause chain included.
const serializers = Reflect.get(logger, pino.symbols.serializersSym) as Record<string, (value: unknown) => unknown>;
assert.equal(typeof serializers.err, "function");
assert.equal(typeof serializers.error, "function", "{ error } is serialised, not printed as {}");
const root = new Error("disk full");
const wrapped = new Error("Could not save chat", { cause: root });
const serialised = serializers.error!(wrapped) as { message: string; stack: string };
assert.match(serialised.message, /Could not save chat: disk full/u, "the cause message is kept");
assert.match(serialised.stack, /caused by: Error: disk full/u, "the cause stack is kept");

// Repeats: the first line is written, the rest of the window is counted, the next line says how many.
resetRateLimitedLogs();
assert.equal(takeRateLimitedSlot("k", 1_000, 0), 0);
assert.equal(takeRateLimitedSlot("k", 1_000, 10), null);
assert.equal(takeRateLimitedSlot("k", 1_000, 20), null);
assert.equal(takeRateLimitedSlot("k", 1_000, 1_500), 2, "the next line reports the skipped repeats");
const warnings: unknown[][] = [];
const priorWarn = logger.warn;
logger.warn = ((...args: unknown[]) => warnings.push(args)) as typeof logger.warn;
try {
  for (let index = 0; index < 5; index += 1) {
    logRateLimited("warn", "poll", new Error("offline"), "Poll failed for %s", "sample");
  }
} finally {
  logger.warn = priorWarn;
}
assert.equal(warnings.length, 1, "a failure repeated inside the window is written once");
assert.ok((warnings[0]![0] as { err?: unknown }).err instanceof Error, "the error stays under err");
assert.equal(warnings[0]![1], "Poll failed for %s");

// A decision slot that stays down writes one rate-limited line, not one per gate. The
// decision sidecar entry is unavailable here (unsupported platform, or not enabled), which
// is the same path a misconfigured slot takes on every turn.
const { resolveDecisionSlot } = await import("../../packages/server/src/services/decision/decision-slots.js");
resetRateLimitedLogs();
const slotWarnings: unknown[][] = [];
logger.warn = ((...args: unknown[]) => slotWarnings.push(args)) as typeof logger.warn;
try {
  for (let index = 0; index < 4; index += 1) {
    const resolution = await resolveDecisionSlot("decision_sidecar");
    assert.equal(resolution.resolved, null);
  }
} finally {
  logger.warn = priorWarn;
}
assert.equal(slotWarnings.length, 1, "a repeated decision slot failure is written once per window");
assert.equal((slotWarnings[0]![0] as { slot?: string }).slot, "decision_sidecar");
const decisionDefault = readFileSync(
  new URL("../../packages/server/src/services/decision/decision-default.ts", import.meta.url),
  "utf8",
);
assert.doesNotMatch(decisionDefault, /cannot serve decisions/u, "the slot writes the one line, not the caller too");

// The decision and utility sidecars start in a root log context, so a start shared by
// later gates does not carry the first requester's requestId on its later lines.
const { runWithRootLogContext } = await import("../../packages/server/src/lib/log-context.js");
const { getLogContext } = await import("../../packages/server/src/lib/log-context.js");
const { decisionProcessService } =
  await import("../../packages/server/src/services/sidecar/decision-process.service.js");
const { utilitySidecarService } =
  await import("../../packages/server/src/services/utility-sidecar/utility-sidecar.service.js");
const startContexts: Array<string | undefined> = [];
const decisionStarter = decisionProcessService as unknown as { start: () => Promise<string | null> };
const utilityStarter = utilitySidecarService as unknown as { start: () => Promise<void> };
const priorDecisionStart = decisionStarter.start;
const priorUtilityStart = utilityStarter.start;
decisionStarter.start = async () => {
  startContexts.push(getLogContext()?.requestId ?? "root");
  return null;
};
utilityStarter.start = async () => {
  startContexts.push(getLogContext()?.requestId ?? "root");
};
try {
  await runWithRootLogContext({ requestId: "first-requester" }, async () => {
    assert.equal(getLogContext()?.requestId, "first-requester");
    await decisionProcessService.ensureRunning({ id: "log-context-probe" } as never);
    await utilitySidecarService.ensureRunning();
  });
} finally {
  decisionStarter.start = priorDecisionStart;
  utilityStarter.start = priorUtilityStart;
}
assert.ok(startContexts.length >= 2, "both sidecar starts ran");
assert.deepEqual([...new Set(startContexts)], ["root"], "sidecar starts do not inherit the requester's requestId");

// An unknown 500 produces exactly one error line; a cancellation that escapes a route is info.
const lines: Array<Record<string, unknown>> = [];
const sink = new Writable({
  write(chunk, _encoding, done) {
    for (const line of String(chunk).split("\n")) if (line.trim()) lines.push(JSON.parse(line));
    done();
  },
});
const shared = pino({ level: "debug", mixin: logContextMixin, serializers }, sink);
const app = Fastify({ loggerInstance: shared, logController: new RequestLogController() });
app.setErrorHandler(errorHandler);
app.get("/boom", async () => {
  throw new Error("synthetic failure");
});
app.get("/stop", async () => {
  throw abort;
});
await app.ready();
const boom = await app.inject({ method: "GET", url: "/boom" });
assert.equal(boom.statusCode, 500);
const errorLines = lines.filter((line) => Number(line.level) >= 50);
assert.equal(errorLines.length, 1, "one error line per 500, not one from the handler and one from Fastify");
assert.match(String((errorLines[0]!.err as { message?: string })?.message), /synthetic failure/u);

lines.length = 0;
await app.inject({ method: "GET", url: "/stop" });
assert.equal(lines.filter((line) => Number(line.level) >= 40).length, 0, "a cancellation is not a warning or error");
assert.ok(lines.some((line) => (line.err as { message?: string })?.message === "stopped" && line.level === 30));
await app.close();

// Model and provider text stays out of warn lines at the sites that used to include it.
const read = (path: string) => readFileSync(new URL(`../../packages/server/src/${path}`, import.meta.url), "utf8");
assert.doesNotMatch(read("routes/game.routes.ts"), /logger\.warn\([^;]*raw\.slice/u);
assert.doesNotMatch(read("services/game/dice.service.ts"), /logger\.warn\(\{ request: request\.slice/u);
assert.doesNotMatch(read("services/spotify/spotify.service.ts"), /logger\.warn\([^;]*body\.slice/u);
assert.doesNotMatch(read("services/video/video-generation.ts"), /logger\.warn\([^;]*pollText\.slice/u);
// Providers rethrow without logging; executeAgent writes the one line.
assert.doesNotMatch(read("services/llm/providers/openai.provider.ts"), /logger\.error\(new Error\(msg\)/u);
assert.match(
  read("services/agents/agent-executor.ts"),
  /logger\[failureLevel\(err, "warn"\)\]\(err, "\[agent\] %s failed"/u,
);
// The friendly Claude (Subscription) message already holds the SDK text; a `cause` would make
// the SSE and agent error formatters append it a second time.
assert.doesNotMatch(
  read("services/llm/providers/claude-subscription.provider.ts"),
  /Claude \(Subscription\) request failed: \$\{friendly\}`, \{ cause/u,
);

console.info("Logging failure lines regression passed");
