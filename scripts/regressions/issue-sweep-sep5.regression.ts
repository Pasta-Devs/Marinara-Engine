import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { resolveMacros, resolveCharacterScopedMacros } from "../../packages/shared/src/utils/macro-engine.js";
import { CSRF_HEADER, CSRF_HEADER_VALUE } from "../../packages/shared/src/constants/security.js";
import { csrfProtectionHook } from "../../packages/server/src/middleware/csrf-protection.js";
import { csrfDiagnosticsRoutes } from "../../packages/server/src/routes/csrf-diagnostics.routes.js";
import { api, ApiError } from "../../packages/client/src/lib/api-client.js";

const profile = {
  name: "Ada",
  systemPrompt: "{{original}}Speak as {{char}}.{{ ORIGINAL }}",
  postHistoryInstructions: "{{original}}Keep <scene> intact. $&",
};
const context = { user: "User", char: "Ada", characters: ["Ada"], variables: {}, characterFields: profile };
assert.equal(resolveMacros("{{charSysInfo}}", context), "Speak as Ada.");
assert.equal(resolveMacros("{{charPostHistory}}", context), "Keep <scene> intact. $&");
assert.equal(resolveCharacterScopedMacros("{{charSysInfo}}", profile), "Speak as Ada.");
assert.equal(resolveCharacterScopedMacros("{{charPostHistory}}", profile), "Keep <scene> intact. $&");
assert.match(profile.systemPrompt, /\{\{original\}\}/, "prompt expansion must not mutate the saved card");

const app = Fastify();
app.addHook("onRequest", csrfProtectionHook);
await app.register(csrfDiagnosticsRoutes, { prefix: "/api/csrf" });
const originalFetch = globalThis.fetch;
try {
  const untrusted = await app.inject({
    method: "POST",
    url: "/api/csrf/upload-preflight",
    headers: { origin: "https://untrusted.invalid", [CSRF_HEADER]: CSRF_HEADER_VALUE },
  });
  assert.equal(untrusted.statusCode, 403);
  const trusted = await app.inject({
    method: "POST",
    url: "/api/csrf/upload-preflight",
    headers: { origin: "http://localhost:7860", [CSRF_HEADER]: CSRF_HEADER_VALUE },
  });
  assert.equal(trusted.statusCode, 204);

  const calls: string[] = [];
  let blocked = true;
  let uploadDenied = false;
  let preflightFailure: DOMException | undefined;
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    calls.push(path);
    assert.equal(new Headers(init?.headers).get(CSRF_HEADER), CSRF_HEADER_VALUE);
    if (path === "/api/csrf/upload-preflight") {
      assert.equal(init?.body, undefined, "preflight must not carry the upload body");
      if (preflightFailure) throw preflightFailure;
      return blocked
        ? new Response(JSON.stringify({ error: "Origin is not trusted" }), { status: 403 })
        : new Response(null, { status: 204 });
    }
    if (uploadDenied) return new Response(JSON.stringify({ error: "Upload access denied" }), { status: 403 });
    return Response.json({ uploaded: true });
  };
  const form = new FormData();
  form.append("file", new Blob(["synthetic backup"]), "backup.zip");
  await assert.rejects(api.upload("/import", form), (error) => error instanceof ApiError && error.status === 403);
  assert.deepEqual(calls, ["/api/csrf/upload-preflight"], "a denied preflight must send no upload bytes");
  blocked = false;
  calls.length = 0;
  assert.deepEqual(await api.upload("/import", form), { uploaded: true });
  assert.deepEqual(calls, ["/api/csrf/upload-preflight", "/api/import"]);
  calls.length = 0;
  await api.raw("/backup/import", { method: "POST", body: form });
  assert.deepEqual(calls, ["/api/csrf/upload-preflight", "/api/backup/import"]);
  uploadDenied = true;
  await assert.rejects(api.upload("/import", form), (error) => error instanceof ApiError && error.status === 403);
  uploadDenied = false;
  for (const name of ["AbortError", "TimeoutError"]) {
    calls.length = 0;
    preflightFailure = new DOMException("Preflight stopped", name);
    await assert.rejects(api.upload("/import", form), (error) => error === preflightFailure);
    assert.deepEqual(calls, ["/api/csrf/upload-preflight"], "interrupted preflight must send no upload bytes");
  }
  preflightFailure = undefined;
  calls.length = 0;
  await api.post("/settings", { value: "unchanged JSON path" });
  assert.deepEqual(calls, ["/api/settings"], "ordinary JSON writes do not need upload preflight");
} finally {
  globalThis.fetch = originalFetch;
  await app.close();
}

console.log("September 5 issue sweep regressions passed.");
