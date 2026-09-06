// Correcting a Beholder slot has to work when the browser is not on loopback.
//
// It did not. `PUT /api/agents/beholder-state/:chatId` was wrapped in
// requirePrivilegedAccess, which admits a request only from loopback or with an
// X-Admin-Secret header. A browser cannot send that header — the shipped package
// contains the string zero times — so behind a reverse proxy, on a LAN, or through a
// tunnel, every slot edit and the entire "start over" action returned 403 and there was
// no configuration that could change it. The gate does not log, and the panel's error
// toast was invisible until 1.3.9, so it failed silently at both ends and read as the
// whole feature being broken.
//
// This test states the property directly rather than trusting a comment: the gate that
// caused it must still reject a proxied request (so nobody concludes it was harmless),
// and the route must not be using it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyReply, FastifyRequest } from "fastify";
import { requirePrivilegedAccess } from "../../packages/server/src/middleware/privileged-gate.js";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/** A request as it arrives from behind a reverse proxy: authenticated, not loopback. */
function proxiedRequest(): FastifyRequest {
  return {
    headers: { host: "127.0.0.1:7860", authorization: "Basic dXNlcjpwYXNz" },
    ip: "192.168.1.50",
    raw: { socket: { localAddress: "192.168.1.10" } },
    url: "/api/agents/beholder-state/abc",
  } as unknown as FastifyRequest;
}

function captureReply() {
  const sent: { status?: number; body?: unknown } = {};
  const reply = {
    status(code: number) {
      sent.status = code;
      return this;
    },
    send(body: unknown) {
      sent.body = body;
      return this;
    },
  } as unknown as FastifyReply;
  return { reply, sent };
}

// ── The gate really does reject this request ────────────────────────────────
// Without this, removing it from the route could be waved away as unnecessary.
{
  const previousSecret = process.env.ADMIN_SECRET;
  const previousAllowRemote = process.env.ALLOW_UNAUTHENTICATED_REMOTE;
  process.env.ALLOW_UNAUTHENTICATED_REMOTE = "true";
  delete process.env.ADMIN_SECRET;

  const { reply, sent } = captureReply();
  const allowed = requirePrivilegedAccess(proxiedRequest(), reply, {
    feature: "Beholder state correction",
  });
  assert.equal(allowed, false, "the privileged gate should refuse a proxied browser request");
  assert.equal(sent.status, 403, "and it refuses with the 403 the bug report described");

  if (previousSecret === undefined) delete process.env.ADMIN_SECRET;
  else process.env.ADMIN_SECRET = previousSecret;
  if (previousAllowRemote === undefined) delete process.env.ALLOW_UNAUTHENTICATED_REMOTE;
  else process.env.ALLOW_UNAUTHENTICATED_REMOTE = previousAllowRemote;
}

// ── So the route must not be behind it ──────────────────────────────────────
{
  const source = readFileSync(join(root, "packages/server/src/routes/agents.routes.ts"), "utf8");
  const marker = '"/beholder-state/:chatId",';
  const start = source.indexOf(marker);
  assert.ok(start > -1, "the beholder-state route should still exist");

  // The PUT handler, up to the next route registration.
  const after = source.slice(start);
  const end = after.indexOf("app.get<", 1);
  const handler = end > -1 ? after.slice(0, end) : after;

  // The CALL, not the word: the handler explains at length why the gate is absent, and
  // a bare substring check fails on that explanation. Matching the invocation lets the
  // reasoning stay next to the code it explains.
  assert.doesNotMatch(
    handler,
    /requirePrivilegedAccess\s*\(/u,
    "the beholder-state write must not require loopback or an admin secret — a browser " +
      "behind a proxy can satisfy neither, and this is ordinary chat data",
  );
  // The protections that replace it are not optional.
  assert.ok(handler.includes("BEHOLDER_STATE_RATE_LIMIT"), "the write must stay rate limited");
  assert.ok(handler.includes("normalizeBeholderState"), "and must still refuse a malformed body");
}

// ── The neighbouring administrative routes keep their gate ──────────────────
// The point is that this route was miscategorised, not that the gate is wrong.
{
  const source = readFileSync(join(root, "packages/server/src/routes/agents.routes.ts"), "utf8");
  for (const feature of ["Custom Agent imports", "Custom Agent import"]) {
    assert.ok(
      source.includes(`requirePrivilegedAccess(req, reply, { feature: "${feature}" })`),
      `${feature} is genuinely administrative and must stay behind the privileged gate`,
    );
  }
}

console.log("beholder state route reachable behind a proxy: OK");
