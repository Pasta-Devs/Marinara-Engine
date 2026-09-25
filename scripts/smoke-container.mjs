#!/usr/bin/env node
// Exercise a locally built image without publishing it or touching user volumes.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const [image, variant, architecture] = process.argv.slice(2);
assert.ok(
  image && ["full", "lite"].includes(variant) && ["amd64", "arm64"].includes(architecture),
  "Usage: node scripts/smoke-container.mjs <local-image> <full|lite> <amd64|arm64>",
);
const name = `marinara-platform-${randomUUID()}`;
const volume = `${name}-data`;
const marker = `platform-proof-${randomUUID()}`;
const runtimeUser = variant === "lite" ? "nonroot" : "node";

function docker(args, options = {}) {
  return execFileSync("docker", args, { encoding: "utf8", timeout: 90_000, ...options });
}

// This runs inside the actual image, so API calls remain loopback-only even
// with Docker networking disabled. No model provider or download is involved.
const probe = String.raw`
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const [phase, marker, variant, architecture] = process.argv.slice(2);
assert.equal(process.arch, architecture === "amd64" ? "x64" : "arm64");
assert.notEqual(process.getuid(), 0, "The runtime user must be able to use the image without root");
const serverUid = Number(readFileSync("/proc/1/status", "utf8").match(/^Uid:\s+(\d+)/m)?.[1]);
assert.equal(serverUid, process.getuid(), "The entrypoint must drop privileges before starting the server");
const require = createRequire("/app/packages/server/package.json");
const sharp = require("sharp");
const png = await sharp({ create: { width: 1, height: 1, channels: 4, background: "#579ad8" } }).png().toBuffer();
assert.ok(png.length > 0, "The image's actual sharp binding must encode an image");
if (variant === "full") {
  assert.equal(typeof require("onnxruntime-node").InferenceSession.create, "function");
} else {
  assert.throws(() => require.resolve("onnxruntime-node"), { code: "MODULE_NOT_FOUND" });
}
const base = "http://127.0.0.1:7860";
let health;
const deadline = Date.now() + 60_000;
while (Date.now() < deadline) {
  try {
    const response = await fetch(base + "/api/health", { signal: AbortSignal.timeout(2_000) });
    if (response.ok) { health = await response.json(); break; }
  } catch { /* Wait for the real server to finish opening its new data volume. */ }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
assert.equal(health?.status, "ok", "The compiled API must become healthy");
assert.equal(health.version, JSON.parse(readFileSync("/app/package.json", "utf8")).version);
assert.ok(health.commit, "The image must report its baked build commit");
const page = await fetch(base + "/");
assert.equal(page.status, 200);
const html = await page.text();
assert.match(html, /<html/i, "The compiled frontend must be served");
const assetPath = html.match(/(?:src|href)="(\/assets\/[^" ]+)"/)?.[1];
assert.ok(assetPath, "The frontend must reference a built asset");
const asset = await fetch(base + assetPath);
assert.equal(asset.status, 200);
assert.ok(!(asset.headers.get("content-type") ?? "").includes("text/html"));
const settingsUrl = base + "/api/app-settings/ui";
if (phase === "write") {
  const saved = await fetch(settingsUrl, {
    method: "PUT", headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ value: JSON.stringify({ platformArtifactProof: marker }) }),
  });
  assert.equal(saved.status, 200, await saved.text());
  const envPath = "/app/data/.env";
  writeFileSync(envPath, readFileSync(envPath, "utf8") + "\nPLATFORM_ARTIFACT_PROOF=" + marker + "\n");
} else {
  const saved = await fetch(settingsUrl);
  assert.equal(saved.status, 200);
  assert.equal(JSON.parse((await saved.json()).value).platformArtifactProof, marker,
    "Replacing the container must preserve settings written through the API");
  assert.ok(readFileSync("/app/data/.env", "utf8").includes("PLATFORM_ARTIFACT_PROOF=" + marker),
    "Replacing the container must preserve its volume-backed configuration");
}
console.log(phase + ": " + variant + "/" + process.arch + " API, frontend, native bindings and writable persistent data passed");
`;

try {
  docker(["volume", "create", volume]);
  for (const phase of ["write", "read"]) {
    docker([
      "run",
      "--detach",
      "--name",
      name,
      "--network",
      "none",
      "--mount",
      `type=volume,src=${volume},dst=/app/data`,
      "--env",
      "AUTO_CREATE_DEFAULT_CONNECTION=false",
      "--env",
      "AUTO_OPEN_BROWSER=false",
      "--env",
      "UPDATES_APPLY_DISABLED=true",
      image,
    ]);
    process.stdout.write(
      docker(
        [
          "exec",
          "--interactive",
          "--user",
          runtimeUser,
          name,
          "node",
          "--input-type=module",
          "-",
          phase,
          marker,
          variant,
          architecture,
        ],
        { input: probe, timeout: 180_000 },
      ),
    );
    docker(["stop", "--time", "20", name]);
    assert.equal(
      docker(["inspect", "--format", "{{.State.ExitCode}}", name]).trim(),
      "0",
      "SIGTERM must finish a clean shutdown before the container is replaced",
    );
    docker(["rm", name]);
  }
} finally {
  // Only this invocation's random names are ever removed, including on failure.
  try {
    process.stdout.write(docker(["logs", name]));
  } catch {
    /* Already removed after success. */
  }
  try {
    docker(["rm", "--force", name], { stdio: "ignore" });
  } catch {
    /* Already removed. */
  }
  docker(["volume", "rm", volume]);
}
