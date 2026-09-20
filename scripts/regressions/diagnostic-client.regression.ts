import assert from "node:assert/strict";
import { ApiError, api } from "../../packages/client/src/lib/api-client";
import {
  configureClientDiagnosticSender,
  reportClientDiagnostic,
  sanitizeClientDiagnostic,
  sanitizeClientPath,
} from "../../packages/client/src/lib/client-diagnostics";

const stored = { value: "[]", writes: [] as string[], failWrites: false };
const fakeWindow = {
  location: { origin: "http://localhost", pathname: "/chat" },
  setTimeout,
  clearTimeout,
  addEventListener: () => undefined,
};
Object.assign(globalThis, {
  window: fakeWindow,
  localStorage: {
    getItem: () => stored.value,
    setItem: (_key: string, value: string) => {
      stored.writes.push(value);
      if (stored.failWrites) throw new Error("storage blocked");
      stored.value = value;
    },
  },
});

const structured = new ApiError(500, "Generation failed", {
  code: "ME_PROVIDER_ERROR",
  errorId: "err-123",
  requestId: "req-456",
  jsonRepair: { kind: "session_conclusion", rawJson: "{}", title: "Repair", applyEndpoint: "/x" },
});
assert.equal(structured.code, "ME_PROVIDER_ERROR");
assert.match(structured.message, /Reference: err-123/);
assert.equal(
  new ApiError(500, `${structured.message}: detail`, structured.payload).message,
  `${structured.message}: detail`,
);
assert.ok((structured.payload as { jsonRepair: unknown }).jsonRepair);

const openAiToken = ["sk-", "live-abcdefghijkl"].join("");
const githubToken = ["ghp_", "1234567890abcdefghijklmnop"].join("");
const githubFineGrainedToken = ["github_pat_", "1234567890abcdefghijklmnop"].join("");
const report = sanitizeClientDiagnostic({
  kind: "error",
  message: `Bearer super-secret {"apiKey":"topsecret","password":"pw","token":"tok"} ${openAiToken} ${githubToken} ${githubFineGrainedToken}`,
  stack: "at https://user:secret@localhost/app.js?token=secret:1:2",
  path: "/chat/abc?token=secret#fragment",
});
assert.doesNotMatch(JSON.stringify(report), /super-secret|topsecret|\"pw\"|\"tok\"|abcdefghijkl|secret|token=secret/);
assert.equal(report.path, "/chat/abc");
assert.equal(sanitizeClientPath("/chat/abc?secret=hidden"), "/chat/abc");

let sent = 0;
await configureClientDiagnosticSender(async () => {
  sent += 1;
  return true;
});
await reportClientDiagnostic({ kind: "error", message: "dedupe-me", clientEventId: "dedupe-1" });
await reportClientDiagnostic({ kind: "error", message: "dedupe-me", clientEventId: "dedupe-1" });
assert.equal(sent, 1, "duplicate runtime failures should send once");

stored.value = "[]";
stored.writes.length = 0;
await configureClientDiagnosticSender(async () => false);
for (let index = 0; index < 40; index += 1)
  await reportClientDiagnostic({ kind: "error", message: `eviction-${index}`, clientEventId: `eviction-${index}` });
assert.equal((JSON.parse(stored.value) as unknown[]).length, 24, "queue must evict oldest records at the item bound");
await configureClientDiagnosticSender(async () => true);
assert.ok(sent > 0, "configured sender should remain usable after queue pressure");

stored.value = "[]";
stored.writes.length = 0;
let timeoutCalls = 0;
const originalWindowTimeout = fakeWindow.setTimeout;
fakeWindow.setTimeout = ((callback: TimerHandler) => {
  timeoutCalls += 1;
  if (typeof callback === "function") callback();
  return 1 as unknown as number;
}) as typeof setTimeout;
await configureClientDiagnosticSender(() => new Promise<boolean>(() => undefined));
await reportClientDiagnostic({ kind: "error", message: "timeout-me", clientEventId: "timeout-1" });
assert.ok(timeoutCalls > 0, "flush must have a finite timeout");
fakeWindow.setTimeout = originalWindowTimeout;

stored.failWrites = true;
stored.value = "[]";
let failedEndpointCalls = 0;
await configureClientDiagnosticSender(async () => {
  failedEndpointCalls += 1;
  return false;
});
await reportClientDiagnostic({ kind: "network", message: "storage-fallback", clientEventId: "storage-1" });
assert.ok(stored.writes.length > 0, "storage failure path must attempt persistence");
assert.equal(failedEndpointCalls, 1, "endpoint failure must not recursively report itself");
const recovered: string[] = [];
await configureClientDiagnosticSender(async (record) => {
  recovered.push(record.message);
  return true;
});
assert.ok(recovered.includes("storage-fallback"), "memory queue survives failed writes with successful stale reads");

const originalFetch = globalThis.fetch;
globalThis.fetch = (async () => {
  throw new DOMException("aborted", "AbortError");
}) as typeof fetch;
const controller = new AbortController();
controller.abort();
await assert.rejects(
  api.raw("/diagnostics/client", { signal: controller.signal }),
  (error: unknown) => error instanceof DOMException && error.name === "AbortError",
);
globalThis.fetch = originalFetch;
console.log("diagnostic-client regression: ok");
