import assert from "node:assert/strict";
import { createServer } from "node:http";
import { resolveLocalBackendHeaders } from "../../packages/server/src/services/image/image-generation.js";

const { fetchComfyUiLoaderModelNames, postSwarmUiJson } =
  await import("../../packages/server/src/routes/connections.routes.js");

const validHeaders = { "x-test-header": "test-value" };
const extraHeaders = resolveLocalBackendHeaders("fixture-key", validHeaders);
assert.equal(extraHeaders.Authorization, "Bearer fixture-key");
assert.equal(extraHeaders["x-test-header"], "test-value");

const seen: Array<{ url: string; method: string; authorization?: string; custom?: string; cookie?: string }> = [];
const checkpointInfo = {
  CheckpointLoaderSimple: { input: { required: { ckpt_name: [["a.safetensors", "b.safetensors"], {}] } } },
};
const server = createServer(async (request, response) => {
  for await (const _chunk of request) {
    // Drain the body; only headers are under test.
  }
  const authorized = request.headers.authorization === "Bearer fixture-key";
  const hasCustom = request.headers["x-test-header"] === "test-value";
  seen.push({
    url: request.url!,
    method: request.method!,
    authorization: request.headers.authorization,
    custom: request.headers["x-test-header"] as string | undefined,
    cookie: request.headers.cookie,
  });
  const json = (status: number, value: unknown) => {
    response.statusCode = status;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(value));
  };
  if (request.url!.startsWith("/object_info/HtmlNode")) return json(200, "<!DOCTYPE html><html></html>");
  if (request.url!.startsWith("/object_info/UNETLoader")) {
    response.statusCode = 404;
    response.end("not found");
    return;
  }
  if (request.url!.startsWith("/object_info/")) {
    if (!authorized || !hasCustom) {
      response.statusCode = 401;
      response.setHeader("content-type", "text/html");
      response.end("<!DOCTYPE html><html><body>auth required</body></html>");
      return;
    }
    return json(200, checkpointInfo);
  }
  if (request.url === "/API/GetNewSession" && request.method === "POST") {
    if (request.headers.cookie !== "swarm_token=session-key" || !hasCustom) {
      return json(401, { error: "auth required" });
    }
    return json(200, { session_id: "s1" });
  }
  response.statusCode = 404;
  response.end("unexpected request");
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const policy = {
    allowLocal: true,
    allowLoopback: true,
    allowedProtocols: ["https:", "http:"],
    flagName: "IMAGE_LOCAL_URLS_ENABLED",
  };

  // Model listing reaches an authenticated ComfyUI with API key + custom headers.
  const checkpoints = await fetchComfyUiLoaderModelNames(
    baseUrl,
    "CheckpointLoaderSimple",
    "ckpt_name",
    extraHeaders,
    policy,
  );
  assert.deepEqual(checkpoints, { ok: true, status: 200, names: ["a.safetensors", "b.safetensors"] });

  // A missing node degrades to null instead of failing the whole listing.
  const unet = await fetchComfyUiLoaderModelNames(baseUrl, "UNETLoader", "unet_name", extraHeaders, policy);
  assert.deepEqual(unet, { ok: false, status: 404, names: null });

  // A 200 login page reads as missing metadata instead of a JSON SyntaxError.
  const loginPage = await fetchComfyUiLoaderModelNames(baseUrl, "HtmlNode", "unet_name", extraHeaders, policy);
  assert.deepEqual(loginPage, { ok: true, status: 200, names: null });

  // Without headers the proxy refuses with 401 instead of leaking a page into JSON parsing.
  const denied = await fetchComfyUiLoaderModelNames(baseUrl, "CheckpointLoaderSimple", "ckpt_name", {}, policy);
  assert.deepEqual(denied, { ok: false, status: 401, names: null });

  // SwarmUI discovery carries the session cookie plus custom headers
  // (Authorization would come from the same helper with the Swarm key).
  const swarmExtra = resolveLocalBackendHeaders("", validHeaders);
  const session = await postSwarmUiJson(baseUrl, "session-key", "GetNewSession", {}, swarmExtra);
  assert.equal((session as { session_id?: string }).session_id, "s1");

  // The successful requests really left the process with credentials attached.
  assert.ok(
    seen.some(
      ({ url, authorization, custom }) =>
        url.includes("CheckpointLoaderSimple") && authorization === "Bearer fixture-key" && custom === "test-value",
    ),
    "ComfyUI listing carries API-key Authorization and the custom header",
  );
  assert.ok(
    seen.some(
      ({ url, cookie, custom }) =>
        url === "/API/GetNewSession" && cookie === "swarm_token=session-key" && custom === "test-value",
    ),
    "SwarmUI session carries the session cookie and the custom header",
  );
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
console.info("Local-backend model discovery sends API-key Authorization plus validated custom headers.");
