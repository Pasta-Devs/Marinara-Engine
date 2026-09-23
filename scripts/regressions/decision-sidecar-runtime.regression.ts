/**
 * The managed decision sidecar's lifecycle, preflight and Hub reading.
 *
 * Runs against a throwaway data directory with a fake `nvidia-smi` on PATH and a fake
 * Python that only announces an address, so every case is deterministic on a machine
 * with no GPU and nothing is downloaded.
 */
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "marinara-decision-runtime-"));
const dataDir = join(root, "data");
const binDir = join(root, "bin");
const spawnMarker = join(root, "spawned.log");
mkdirSync(dataDir, { recursive: true });
mkdirSync(binDir, { recursive: true });
process.env.DATA_DIR = dataDir;

// A slow nvidia-smi, so a start spends a real second in its preflight: the window in
// which a stop used to find nothing to stop.
writeFileSync(
  join(binDir, "nvidia-smi"),
  `#!/bin/sh
sleep 1
case "$1" in
  --query-compute-apps*) exit 0 ;;
esac
echo "0, GPU-fake, NVIDIA Fake 24GB, 24463, 14, 615.71.09, 12.0"
`,
);
chmodSync(join(binDir, "nvidia-smi"), 0o755);
process.env.PATH = `${binDir}:${process.env.PATH ?? ""}`;

const { SIDECAR_DECISION_MODELS } = await import("../../packages/shared/src/index.js");
const { serializeDecisionRuntimeManifestStamp } =
  await import("../../packages/server/src/services/sidecar/runtime-integrity-manifest.js");
const { artifactSnapshotPath, decisionRuntimeInstalled, decisionRuntimeService } =
  await import("../../packages/server/src/services/sidecar/decision-runtime.service.js");
const { decisionProcessService } =
  await import("../../packages/server/src/services/sidecar/decision-process.service.js");
const { preflightDecisionModel } = await import("../../packages/server/src/services/sidecar/decision-preflight.js");
const { hubRevisionUrl, isLoadableArtifactFile, listHubFiles } =
  await import("../../packages/server/src/services/sidecar/decision-hub.js");
const { inspectDecisionRepo } = await import("../../packages/server/src/services/sidecar/decision-byo.js");

const realFetch = globalThis.fetch;
const model = structuredClone(SIDECAR_DECISION_MODELS[0]!);

try {
  // ── which files a repository may contain ──────────────────────────────────────

  // Recorded from the two pinned curated revisions on 2026-09-23. Every one of them
  // must pass, or the allowlist would break the shipped model.
  const curated = [
    "package/LICENSE",
    "package/LICENSE-CODE",
    "package/README.md",
    "package/UPSTREAM.md",
    "package/checkpoint/adapter/adapter_config.json",
    "package/checkpoint/adapter/adapter_model.safetensors",
    "package/checkpoint/head.pt",
    "package/checkpoint/model.json",
    "package/checkpoint/temperature.json",
    "package/manifest.json",
    "package/metrics.json",
    "package/provenance.json",
    ".gitattributes",
    "LICENSE",
    "README.md",
    "chat_template.jinja",
    "config.json",
    "merges.txt",
    "model.safetensors-00001-of-00001.safetensors",
    "model.safetensors.index.json",
    "preprocessor_config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "video_preprocessor_config.json",
    "vocab.json",
  ];
  for (const path of curated) assert.ok(isLoadableArtifactFile(path), `${path} is loadable`);
  for (const path of [
    "pytorch_model.bin",
    "package/checkpoint/adapter/adapter_model.bin",
    "package/checkpoint/other.pt",
    "package/checkpoint/extra/head.pt",
    "head.pt",
    "weights.pkl",
    "modeling_custom.py",
    "package/setup.sh",
  ])
    assert.equal(isLoadableArtifactFile(path), false, `${path} is refused`);

  // ── the revision URL keeps a slashed ref in one segment ───────────────────────

  assert.equal(
    hubRevisionUrl("owner/name", "refs/pr/1"),
    "https://huggingface.co/api/models/owner/name/revision/refs%2Fpr%2F1",
  );

  // ── a tree listing follows every page, and only on the Hub ────────────────────

  const treeRequests: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    treeRequests.push(url);
    if (url.includes("cursor=2"))
      return new Response(JSON.stringify([{ type: "file", path: "b.safetensors", lfs: { size: 20 } }]), {
        headers: { link: '<https://elsewhere.example/next>; rel="next"' },
      });
    return new Response(
      JSON.stringify([
        { type: "file", path: "a.json", size: 1 },
        { type: "directory", path: "sub" },
      ]),
      { headers: { link: '<https://huggingface.co/api/models/o/n/tree/rev?recursive=1&cursor=2>; rel="next"' } },
    );
  }) as typeof fetch;
  const listed = await listHubFiles("o/n", "rev");
  assert.deepEqual(listed, [
    { path: "a.json", size: 1 },
    { path: "b.safetensors", size: 20 },
  ]);
  assert.equal(treeRequests.length, 2, "the second page is read, and a next link off the Hub is not followed");

  // ── a pasted repository is refused for its files, and shows its licences ──────

  const baseRevision = "15852e8c16360a2fea060d615a32b45270f8a8fc";
  const pastedRevision = "0c7aa498b1627be8da4acf34c863ff0ee0a92785";
  const stubRepo = (checkpointFiles: string[]) =>
    (async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.endsWith("/release-manifest.json"))
        return Response.json({
          artifact_type: "qwen_lora_adapter_plus_scalar_decision_head",
          schema_version: 1,
          base_weights_included: false,
          base_model: "Qwen/Qwen3.5-2B",
          base_revision: baseRevision,
        });
      if (url.includes("/tree/") && url.includes("pasted/model"))
        return Response.json(checkpointFiles.map((path) => ({ type: "file", path, size: 100 })));
      if (url.includes("/tree/")) return Response.json([{ type: "file", path: "model.safetensors", size: 1000 }]);
      if (url.endsWith("/api/models/pasted/model")) return Response.json({ cardData: { license: "mit" } });
      if (url.endsWith("/api/models/Qwen/Qwen3.5-2B")) return Response.json({ tags: ["license:apache-2.0"] });
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

  globalThis.fetch = stubRepo(["package/checkpoint/head.pt", "package/checkpoint/adapter/adapter_model.bin"]);
  assert.deepEqual(await inspectDecisionRepo("pasted/model", pastedRevision), { refusal: "unsupported_files" });

  globalThis.fetch = stubRepo(["package/checkpoint/head.pt", "package/checkpoint/model.json"]);
  const inspected = await inspectDecisionRepo("pasted/model", pastedRevision);
  assert.ok("model" in inspected, "a repository of loadable files is accepted");
  assert.deepEqual(inspected.model.licenses, ["mit (pasted/model)", "apache-2.0 (Qwen/Qwen3.5-2B)"]);

  // ── one download at a time ────────────────────────────────────────────────────

  let listings = 0;
  globalThis.fetch = (async () => {
    listings += 1;
    await new Promise((resolve) => setTimeout(resolve, 50));
    return Response.json([]);
  }) as typeof fetch;
  const first = decisionRuntimeService.downloadModel(model);
  const second = decisionRuntimeService.downloadModel(model);
  const other = decisionRuntimeService.downloadModel({ ...model, id: "another-model" });
  await assert.rejects(other, /Another decision model is already downloading/u);
  const settled = await Promise.allSettled([first, second]);
  assert.equal(listings, 1, "a second install of the same model joins the first instead of listing again");
  assert.deepEqual(
    settled.map((result) => result.status),
    ["rejected", "rejected"],
    "both callers see the one download's outcome",
  );
  globalThis.fetch = realFetch;

  // ── a fake installed runtime ──────────────────────────────────────────────────

  const runtime = decisionRuntimeService.getPaths();
  mkdirSync(join(runtime.pythonPath, ".."), { recursive: true });
  writeFileSync(
    runtime.pythonPath,
    `#!/bin/sh
echo started >> "${spawnMarker}"
echo '{"url": "http://127.0.0.1:9"}'
exec sleep 30
`,
  );
  chmodSync(runtime.pythonPath, 0o755);
  mkdirSync(join(runtime.sourcePath, "jev"), { recursive: true });
  writeFileSync(join(runtime.sourcePath, "jev", "server.py"), "");
  writeFileSync(join(runtime.directoryPath, "runtime-stamp.txt"), `${serializeDecisionRuntimeManifestStamp()}\n`);
  mkdirSync(join(artifactSnapshotPath(model.artifacts[0]!), "package", "checkpoint"), { recursive: true });
  assert.ok(decisionRuntimeInstalled(), "the fake runtime reads as installed");

  // ── free disk is not asked of a model already on disk ─────────────────────────

  // More disk than any machine has, so the only way past the disk check is not
  // being asked it.
  const huge = { ...model, diskBytes: Number.MAX_SAFE_INTEGER };
  assert.equal(
    (await preflightDecisionModel(huge, { fresh: true })).assessment.verdict,
    "not_enough_disk",
    "a model still to download needs the space",
  );
  for (const artifact of model.artifacts) {
    mkdirSync(artifactSnapshotPath(artifact), { recursive: true });
    writeFileSync(join(artifactSnapshotPath(artifact), ".marinara-download.json"), "{}");
  }
  const installed = await preflightDecisionModel(huge, { fresh: true });
  assert.notEqual(installed.assessment.verdict, "not_enough_disk", "an installed model reaches the memory check");
  assert.equal(installed.installable, true);

  // ── a stop during a start's preflight cancels the start ───────────────────────

  const starting = decisionProcessService.ensureRunning(model);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await decisionProcessService.stop();
  assert.equal(await starting, null, "the start gives up");
  assert.equal(existsSync(spawnMarker), false, "nothing was launched after the stop");
  assert.equal(decisionProcessService.getStatus().running, false);

  // Positive control, and proof a cancelled start does not leave a one-minute backoff.
  const url = await decisionProcessService.ensureRunning(model);
  assert.equal(url, "http://127.0.0.1:9", "an uninterrupted start launches straight away");
  assert.equal(readFileSync(spawnMarker, "utf8").trim(), "started");
  await decisionProcessService.stop();
  assert.equal(decisionProcessService.getStatus().running, false);
} finally {
  globalThis.fetch = realFetch;
  await decisionProcessService.stop().catch(() => null);
  rmSync(root, { recursive: true, force: true });
}

console.log("decision-sidecar-runtime regression passed");
