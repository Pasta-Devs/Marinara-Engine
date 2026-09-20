import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { diagnosticsRoutes } from "../../packages/server/src/routes/diagnostics.routes.js";
import { errorHandler } from "../../packages/server/src/middleware/error-handler.js";
import { sendSseEvent } from "../../packages/server/src/routes/generate/sse.js";
import { registerDiagnosticHttpHooks } from "../../packages/server/src/app.js";
import { logger } from "../../packages/server/src/lib/logger.js";
import { ZodError, ZodIssueCode } from "../../packages/server/node_modules/zod";

const app = Fastify({ logger: false });
registerDiagnosticHttpHooks(app as any);
const loggerApp = Fastify({ loggerInstance: logger });
assert.equal(typeof loggerApp.log.info, "function");
await loggerApp.close();
app.setErrorHandler(errorHandler);
await app.register(diagnosticsRoutes, { prefix: "/api/diagnostics" });
app.get("/direct", async (_request, reply) =>
  reply.status(400).send({ error: "direct failure", details: { jsonRepair: true } }),
);
app.get("/business", async (_request, reply) =>
  reply.status(403).send({ error: "spatial owner turn failed", code: "SPATIAL_OWNER_TURN" }),
);
app.get("/unknown", async () => {
  throw new Error("read failed at C:\\Users\\fixture\\private\\secret.json");
});
app.get("/rate", async (_request, reply) => reply.status(429).send({ error: "slow down" }));
app.get("/zod", async () => {
  throw new ZodError([
    {
      code: ZodIssueCode.invalid_type,
      expected: "string",
      received: "number",
      path: ["name"],
      message: "Expected string",
    },
  ]);
});

const accepted = await app.inject({
  method: "POST",
  url: "/api/diagnostics/client",
  payload: { kind: "error", message: "client failure", clientEventId: "evt-1", path: "/chat?secret=removed" },
});
assert.equal(accepted.statusCode, 202);
assert.match(accepted.json().errorId, /^[A-Za-z0-9_-]+$/);

const rejected = await app.inject({
  method: "POST",
  url: "/api/diagnostics/client",
  payload: { kind: "error", message: "bad", clientEventId: "evt 1", severity: "fatal" },
});
assert.equal(rejected.statusCode, 400);

const oversized = await app.inject({
  method: "POST",
  url: "/api/diagnostics/client",
  payload: { kind: "error", message: "x".repeat(20_000), clientEventId: "evt-2" },
});
assert.equal(oversized.statusCode, 413);

const direct = await app.inject({ method: "GET", url: "/direct" });
assert.equal(direct.statusCode, 400);
assert.equal(direct.json().details.jsonRepair, true);
assert.match(direct.json().errorId, /^[A-Za-z0-9_-]+$/);

const business = await app.inject({ method: "GET", url: "/business" });
assert.equal(business.statusCode, 403);
assert.equal(business.json().code, "SPATIAL_OWNER_TURN");
assert.match(business.json().errorId, /^[A-Za-z0-9_-]+$/);

const unknown = await app.inject({ method: "GET", url: "/unknown" });
assert.equal(unknown.statusCode, 500);
assert.equal(unknown.json().error, "Internal Server Error");
assert.doesNotMatch(JSON.stringify(unknown.json()), /C:\\Users\\fixture|secret\.json/);
assert.match(unknown.json().errorId, /^[A-Za-z0-9_-]+$/);

const rate = await app.inject({ method: "GET", url: "/rate" });
assert.equal(rate.statusCode, 429);
assert.equal(rate.json().code, "ME_RATE_LIMIT");

const zod = await app.inject({ method: "GET", url: "/zod" });
assert.equal(zod.statusCode, 400);
assert.equal(zod.json().error, "Validation Error");
assert.equal(zod.json().details[0].path, "name");
assert.match(zod.json().errorId, /^[A-Za-z0-9_-]+$/);

const writes: string[] = [];
const disconnectedReply = {
  request: { id: "sse-regression", url: "/api/generate", routeOptions: { url: "/api/generate" } },
  raw: { destroyed: true, writableEnded: false, writableFinished: false, write: (chunk: string) => writes.push(chunk) },
} as any;
assert.equal(
  sendSseEvent(disconnectedReply, {
    type: "agent_result",
    data: { success: false, error: "agent failed", chatId: "chat-1", messageId: "message-1" },
  }),
  false,
);
assert.equal(writes.length, 0);

disconnectedReply.raw.destroyed = false;
const suppliedReference = { code: "ME_PROVIDER_ERROR", errorId: "same-provider-ref" };
sendSseEvent(disconnectedReply, {
  type: "error",
  data: 'provider rejected {"token":"sse-secret"}',
  ...suppliedReference,
});
const event = JSON.parse(writes[0]!.slice(6));
assert.equal(event.errorId, suppliedReference.errorId);
assert.match(event.data, /same-provider-ref/);
assert.doesNotMatch(event.data, /sse-secret/);
disconnectedReply.raw.write = () => {
  disconnectedReply.raw.destroyed = true;
  throw new Error("socket lost");
};
assert.equal(sendSseEvent(disconnectedReply, { type: "token", data: "not logged" }), false);

await app.close();
