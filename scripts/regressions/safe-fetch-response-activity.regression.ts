import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { safeFetch } from "../../packages/server/src/utils/security.js";

const pendingResponses = new Map<string, (response: ServerResponse) => void>();
const server = createServer((request, response) => {
  const waiting = pendingResponses.get(request.url ?? "");
  if (waiting) {
    pendingResponses.delete(request.url!);
    response.writeHead(200, { "content-type": "text/event-stream", "x-fixture": "raw-data" });
    response.flushHeaders();
    waiting(response);
    return;
  }
  if (request.url === "/empty") {
    response.writeHead(204);
    response.end();
    return;
  }
  response.writeHead(200, { "content-type": request.url === "/type" ? "text/html" : "text/event-stream" });
  response.end("data: oversized\n\n");
});
await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    server.off("error", reject);
    resolve();
  });
});
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const policy = { allowLoopback: true, allowedOrigins: [origin], allowedProtocols: ["http:"] };

try {
  for (const bufferResponse of [false, true]) {
    const path = `/chunks-${bufferResponse}`;
    const responseReady = Promise.withResolvers<ServerResponse>();
    pendingResponses.set(path, responseReady.resolve);
    const abort = new AbortController();
    let activityCalls = 0;
    let notifyActivity: (() => void) | undefined;
    const nextActivity = () =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("No response-data activity received")), 2_000);
        notifyActivity = () => {
          clearTimeout(timer);
          notifyActivity = undefined;
          resolve();
        };
      });
    let completed = false;
    const fetched = safeFetch(`${origin}${path}`, {
      policy,
      bufferResponse,
      signal: abort.signal,
      onResponseData: () => {
        activityCalls++;
        notifyActivity?.();
      },
    });
    const body = fetched.then(async (response) => {
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("x-fixture"), "raw-data");
      const text = await response.text();
      completed = true;
      return text;
    });
    try {
      const upstream = await responseReady.promise;
      if (!bufferResponse) await fetched;
      assert.equal(activityCalls, 0, "headers alone must not report response data");

      const ping = ": ping\n\n";
      const thinking =
        'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"Working"}}\n\n';
      const first = nextActivity();
      upstream.write("");
      upstream.write(ping);
      await first;
      assert.equal(activityCalls, 1, "raw SSE keepalive bytes must report activity before parsing");
      assert.equal(completed, false, "activity must arrive before the buffered or streamed body completes");

      const second = nextActivity();
      upstream.write(thinking);
      await second;
      assert.equal(activityCalls, 2, "raw thinking bytes must report activity without visible text");
      upstream.end();
      assert.equal(await body, ping + thinking);
      assert.equal(activityCalls, 2, "empty writes and response completion must not report activity");
    } finally {
      abort.abort();
      await body.catch(() => undefined);
    }

    let emptyCalls = 0;
    const empty = await safeFetch(`${origin}/empty`, {
      policy,
      bufferResponse,
      onResponseData: () => emptyCalls++,
    });
    assert.equal(await empty.text(), "");
    assert.equal(emptyCalls, 0, "a bodyless response must not report activity");

    let cappedCalls = 0;
    await assert.rejects(async () => {
      const capped = await safeFetch(`${origin}/limit`, {
        policy,
        bufferResponse,
        maxResponseBytes: 4,
        onResponseData: () => cappedCalls++,
      });
      await capped.text();
    }, /Outbound response exceeded 4 bytes/u);
    assert.ok(cappedCalls > 0, "observing actual bytes must preserve the response-size limit");

    let rejectedCalls = 0;
    await assert.rejects(
      safeFetch(`${origin}/type`, {
        policy,
        bufferResponse,
        allowedContentTypes: ["text/event-stream"],
        onResponseData: () => rejectedCalls++,
      }),
      /content type is not allowed/u,
    );
    assert.equal(rejectedCalls, 0, "a rejected content type must not enter the body readers");
  }
  console.info(
    "Safe fetch reports raw response activity in buffered and streaming modes without changing body guards.",
  );
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
