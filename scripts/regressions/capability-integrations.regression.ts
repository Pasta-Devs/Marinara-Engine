import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-host-integrations-"));
process.env.DATA_DIR = dataDir;
process.env.IMAGE_LOCAL_URLS_ENABLED = "false";
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const requests: Array<{ path: string; body: Record<string, unknown>; headers: Record<string, unknown> }> = [];
const server = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw || "{}");
  requests.push({ path: request.url!, body, headers: request.headers });
  response.setHeader("content-type", "application/json");
  if (request.url?.startsWith("/failure/")) {
    response.writeHead(500).end(JSON.stringify({ error: { message: "fixture provider failure" } }));
  } else if (request.url === "/untrusted/v1/images/generations") {
    response.end(JSON.stringify({ data: [{ url: `http://${request.headers.host}/private-image.png` }] }));
  } else if (request.url === "/private-image.png") {
    response.setHeader("content-type", "image/png");
    response.end(Buffer.from(png, "base64"));
  } else if (request.url?.endsWith("/images/generations")) {
    response.end(JSON.stringify({ data: [{ b64_json: png }] }));
  } else {
    response.end(
      JSON.stringify({
        choices: [
          {
            message: {
              role: "assistant",
              content: "host result",
              tool_calls: [{ id: "call-1", type: "function", function: { name: "fixture", arguments: "{}" } }],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 },
      }),
    );
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const { createCapabilityIntegrationHost } =
    await import("../../packages/server/src/services/capability-packages/capability-integrations.service.js");
  const denied = createCapabilityIntegrationHost([]);
  assert.throws(() => denied.llm.createProvider("openai", `${base}/v1`, "fixture"), /network permission/);
  assert.throws(() => denied.llm.localSidecar(), /network permission/);
  assert.throws(() => denied.images.generate("openai", base, "", "openai", { prompt: "denied" }), /network permission/);
  assert.throws(
    () =>
      denied.videos.generate("openai", base, "", "openai", {
        prompt: "denied",
        durationSeconds: 5,
        aspectRatio: "16:9",
      }),
    /network permission/,
  );
  assert.throws(() => denied.images.save("fixture", png, "png"), /storage permission/);
  assert.throws(() => denied.images.stage("fixture", png, "png"), /storage permission/);
  assert.throws(() => denied.images.sweepStaged(), /storage permission/);
  assert.throws(() => denied.images.remove("fixture.png"), /storage permission/);
  assert.throws(() => denied.videos.save("fixture", ""), /storage permission/);
  assert.throws(() => denied.videos.remove("fixture.mp4"), /storage permission/);
  assert.equal(requests.length, 0, "Denied packages must not reach a provider");
  const host = createCapabilityIntegrationHost(["network", "storage"]);
  assert.equal(host.videos.resolveDuration("xai", "xai", { durationSeconds: 30 }), 15);

  const provider = host.llm.createProvider("openai", `${base}/v1`, "fixture-secret", 8192, null, 512, false, false, {
    customParameters: { seed: 42 },
    customHeaders: { "X-Fixture-Session": "chat-1" },
  });
  assert.equal(provider.maxContextValue, 8192);
  assert.equal(provider.maxTokensOverrideValue, 512);
  assert.equal("apiKey" in provider, false);
  assert.equal("baseUrl" in provider, false);
  assert.ok(Object.isFrozen(provider));
  const result = await provider.chatComplete([{ role: "user", content: "A synthetic prompt" }], {
    model: "gpt-4o-mini",
    maxTokens: 128,
    tools: [
      {
        type: "function",
        function: { name: "fixture", description: "Synthetic tool", parameters: { type: "object" } },
      },
    ],
  });
  assert.equal(result.content, "host result");
  assert.equal(result.toolCalls[0]?.function.name, "fixture");
  assert.equal(result.usage?.totalTokens, 10);
  assert.equal(requests.at(-1)?.body.seed, 42, "Stored connection defaults must reach the host provider");
  assert.equal(requests.at(-1)?.headers["x-fixture-session"], "chat-1");

  const failure = host.llm.createProvider("openai", `${base}/failure/v1`, "fixture-secret");
  let notice: string | undefined;
  const fallback = host.llm.withFallback({
    primary: failure,
    primaryConnectionId: "fixture-primary",
    fallbackBaseUrl: `${base}/fallback/v1`,
    category: "agents",
    fallbackConnection: {
      id: "fixture-backup",
      provider: "openai",
      baseUrl: `${base}/fallback/v1`,
      apiKey: "fixture-backup-secret",
      model: "gpt-4o-mini",
    },
    onFallback: (value) => {
      notice = value.connectionId;
    },
  });
  assert.equal(
    (await fallback.chatComplete([{ role: "user", content: "Fallback fixture" }], { model: "gpt-4o-mini" })).content,
    "host result",
  );
  assert.equal(notice, "fixture-backup");
  assert.ok(requests.some((value) => value.path.startsWith("/failure/")));
  assert.ok(requests.some((value) => value.path.startsWith("/fallback/")));
  assert.throws(
    () =>
      createCapabilityIntegrationHost(["network", "storage"]).llm.withFallback({
        primary: provider,
        primaryConnectionId: "foreign",
        fallbackBaseUrl: "",
        category: "agents",
        fallbackConnection: null,
      }),
    /created by this package/,
  );
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    provider.chatComplete([{ role: "user", content: "Cancelled" }], { model: "gpt-4o-mini", signal: abort.signal }),
    /abort/i,
  );

  const generated = await host.images.generate("openai", `${base}/v1`, "fixture-secret", "openai", {
    prompt: "a synthetic landscape",
    model: "local-flux",
  });
  assert.equal(generated.base64, png);
  const untrustedRequest = { prompt: "policy override", allowLocalUrls: true, privateImageResultOrigin: base };
  await assert.rejects(
    host.images.generate("openai", `${base}/untrusted/v1`, "fixture-secret", "openai", untrustedRequest),
    /private|loopback|reserved/i,
    "A package cannot grant private image-result access through request fields",
  );
  assert.equal(
    requests.some((entry) => entry.path === "/private-image.png"),
    false,
  );
  const staged = host.images.stage("fixture-chat", png, "png");
  assert.equal(existsSync(join(dataDir, "gallery", staged.filePath)), false);
  staged.promote();
  assert.deepEqual(readFileSync(join(dataDir, "gallery", staged.filePath)), Buffer.from(png, "base64"));
  staged.compensate();
  assert.equal(existsSync(join(dataDir, "gallery", staged.filePath)), false);
  assert.throws(() => host.images.save("../../outside", png, "png"), /path|directory|outside|escape/i);
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  rmSync(dataDir, { recursive: true, force: true });
}
console.info(
  "Host integrations preserve provider defaults, tools, usage, fallback, cancellation, media services and safe gallery writes.",
);
