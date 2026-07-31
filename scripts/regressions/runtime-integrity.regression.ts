import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LLAMA_CPP_RUNTIME_MANIFEST,
  MLX_RUNTIME_MANIFEST,
  getLlamaRuntimeManifestEntry,
  serializeMlxRuntimeManifestStamp,
  type RuntimeManifestAsset,
} from "../../packages/server/src/services/sidecar/runtime-integrity-manifest.js";
import {
  downloadFileWithProgress,
  retry,
} from "../../packages/server/src/services/sidecar/sidecar-download.js";
import {
  dependencyAssetDigestsMatch,
  isLlamaRuntimeRecordCurrent,
} from "../../packages/server/src/services/sidecar/sidecar-runtime.service.js";

function digest(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertAsset(asset: RuntimeManifestAsset, expectedTag: string): void {
  assert.match(asset.sha256, /^[a-f0-9]{64}$/u);
  assert.ok(asset.size > 0);
  assert.equal(new URL(asset.browser_download_url).protocol, "https:");
  assert.ok(
    asset.browser_download_url.includes(`/${expectedTag}/`) ||
      asset.browser_download_url.includes(`/archive/${expectedTag}.zip`),
  );
}

const variants = LLAMA_CPP_RUNTIME_MANIFEST.entries.map((entry) => entry.variant);
assert.equal(new Set(variants).size, variants.length, "each llama.cpp variant must have one manifest entry");
for (const entry of LLAMA_CPP_RUNTIME_MANIFEST.entries) {
  assert.equal(getLlamaRuntimeManifestEntry(entry.variant), entry);
  assertAsset(entry.asset, LLAMA_CPP_RUNTIME_MANIFEST.releaseTag);
  for (const dependency of entry.dependencyAssets ?? []) {
    assertAsset(dependency, LLAMA_CPP_RUNTIME_MANIFEST.releaseTag);
  }
}
assert.equal(getLlamaRuntimeManifestEntry("unknown-upstream-asset"), null);

const sample = LLAMA_CPP_RUNTIME_MANIFEST.entries[0]!;
const sampleRecord = {
  build: LLAMA_CPP_RUNTIME_MANIFEST.releaseTag,
  variant: sample.variant,
  assetName: sample.asset.name,
  assetSha256: sample.asset.sha256,
  dependencyAssetSha256: (sample.dependencyAssets ?? []).map((asset) => asset.sha256),
};
assert.equal(isLlamaRuntimeRecordCurrent(sampleRecord), true);
assert.equal(
  isLlamaRuntimeRecordCurrent({ ...sampleRecord, build: "moving-latest" }),
  false,
  "a different release tag must require an explicit runtime update",
);
assert.equal(
  isLlamaRuntimeRecordCurrent({ ...sampleRecord, assetSha256: "0".repeat(64) }),
  false,
  "a different runtime digest must invalidate the installed stamp",
);

const dependencySample = LLAMA_CPP_RUNTIME_MANIFEST.entries.find(
  (entry) => (entry.dependencyAssets?.length ?? 0) > 0,
);
assert.ok(dependencySample, "the runtime manifest must retain a dependency-bearing regression fixture");
const dependencyDigests = dependencySample.dependencyAssets.map((asset) => asset.sha256);
const dependencyRecord = {
  build: LLAMA_CPP_RUNTIME_MANIFEST.releaseTag,
  variant: dependencySample.variant,
  assetName: dependencySample.asset.name,
  assetSha256: dependencySample.asset.sha256,
  dependencyAssetSha256: dependencyDigests,
};
assert.equal(isLlamaRuntimeRecordCurrent(dependencyRecord), true);
assert.equal(
  isLlamaRuntimeRecordCurrent({
    ...dependencyRecord,
    dependencyAssetSha256: dependencyDigests.map((sha256, index) => (index === 0 ? "0".repeat(64) : sha256)),
  }),
  false,
  "a changed dependency digest must invalidate the installed stamp",
);
assert.equal(
  isLlamaRuntimeRecordCurrent({ ...dependencyRecord, dependencyAssetSha256: dependencyDigests.slice(1) }),
  false,
  "a removed dependency digest must invalidate the installed stamp",
);
assert.equal(
  dependencyAssetDigestsMatch(["dependency-a", "dependency-b"], ["dependency-b", "dependency-a"]),
  false,
  "dependency digest order must remain part of the installed-runtime identity",
);

assertAsset(MLX_RUNTIME_MANIFEST.mlxLm.archive, MLX_RUNTIME_MANIFEST.mlxLm.revision);
assertAsset(MLX_RUNTIME_MANIFEST.uv.archive, MLX_RUNTIME_MANIFEST.uv.version);
const mlxRequirementsLock = readFileSync(
  fileURLToPath(new URL("../../packages/server/src/assets/mlx-runtime-requirements.lock", import.meta.url)),
);
assert.equal(
  digest(mlxRequirementsLock),
  MLX_RUNTIME_MANIFEST.mlxLm.requirementsLockSha256,
  "the checked-in MLX dependency lock must match its manifest digest",
);
const mlxRequirementsText = mlxRequirementsLock.toString("utf8");
for (const requirementBlock of mlxRequirementsText.split(/(?=^[a-z0-9])/gimu).slice(1)) {
  assert.match(requirementBlock, /==[^\s\\]+/u, "every MLX dependency must be pinned exactly");
  assert.match(requirementBlock, /--hash=sha256:[a-f0-9]{64}/u, "every MLX dependency must carry a SHA-256");
}
assert.match(mlxRequirementsText, /^mlx==0\.31\.2\b/mu);
assert.match(mlxRequirementsText, /^transformers==/mu);
const mlxStamp = serializeMlxRuntimeManifestStamp();
assert.match(mlxStamp, new RegExp(MLX_RUNTIME_MANIFEST.mlxLm.revision, "u"));
assert.match(mlxStamp, new RegExp(MLX_RUNTIME_MANIFEST.mlxLm.archive.sha256, "u"));
assert.match(mlxStamp, new RegExp(MLX_RUNTIME_MANIFEST.mlxLm.requirementsLockSha256, "u"));
assert.match(mlxStamp, new RegExp(MLX_RUNTIME_MANIFEST.uv.archive.sha256, "u"));
assert.notEqual(
  mlxStamp,
  mlxStamp.replace(MLX_RUNTIME_MANIFEST.mlxLm.revision, "0".repeat(40)),
  "changing the approved MLX revision must change the installed-runtime stamp",
);

const payload = Buffer.from("verified runtime fixture", "utf8");
const workDir = await mkdtemp(join(tmpdir(), "marinara-runtime-integrity-"));
const server = createServer((request, response) => {
  if (request.url === "/abort") {
    response.writeHead(200, { "content-length": payload.length });
    setTimeout(() => response.end(payload), 100);
    return;
  }
  response.writeHead(200, { "content-length": payload.length });
  response.end(payload);
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const goodPath = join(workDir, "good.bin");
  await downloadFileWithProgress({
    url: `${baseUrl}/good`,
    destPath: goodPath,
    expectedBytes: payload.length,
    expectedSha256: digest(payload),
    progress: { phase: "runtime", label: "good fixture" },
  });
  assert.deepEqual(await readFile(goodPath), payload);

  const mismatchPath = join(workDir, "mismatch.bin");
  await assert.rejects(
    downloadFileWithProgress({
      url: `${baseUrl}/mismatch`,
      destPath: mismatchPath,
      expectedBytes: payload.length,
      expectedSha256: "0".repeat(64),
      progress: { phase: "runtime", label: "mismatch fixture" },
    }),
    /SHA-256 mismatch/u,
  );
  assert.equal(existsSync(mismatchPath), false, "digest mismatch must abort before promotion");

  const abortController = new AbortController();
  const abortedPath = join(workDir, "aborted.bin");
  const abortedDownload = downloadFileWithProgress({
    url: `${baseUrl}/abort`,
    destPath: abortedPath,
    signal: abortController.signal,
    expectedBytes: payload.length,
    expectedSha256: digest(payload),
    progress: { phase: "runtime", label: "abort fixture" },
  });
  setTimeout(() => abortController.abort(), 10);
  await assert.rejects(abortedDownload, /abort/i);
  assert.equal(existsSync(abortedPath), false, "cancelled downloads must not promote partial content");

  let attempts = 0;
  const retried = await retry(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("temporary offline fixture");
      return "ready";
    },
    { retries: 3, baseDelayMs: 1 },
  );
  assert.equal(retried, "ready");
  assert.equal(attempts, 3, "transient runtime download failures must remain retryable");
} finally {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    }),
  );
  await rm(workDir, { recursive: true, force: true });
}

console.info("Runtime integrity regressions passed.");
