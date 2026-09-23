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
const gpuState = join(root, "gpu-state");
const noCapability = join(root, "no-compute-capability");
mkdirSync(dataDir, { recursive: true });
mkdirSync(binDir, { recursive: true });
process.env.DATA_DIR = dataDir;

// A slow nvidia-smi, so a start spends a real second in its preflight: the window in
// which a stop used to find nothing to stop.
// Card size and used memory come from a file, so a case can model a smaller card or
// a running model's memory without another script.
writeFileSync(gpuState, "24463 14\n");
writeFileSync(
  join(binDir, "nvidia-smi"),
  `#!/bin/sh
sleep 1
case "$1" in
  --query-compute-apps*) exit 0 ;;
esac
read total used < "${gpuState}"
# An old or odd driver that rejects the compute_cap column: the detailed query fails
# and only the fallback answers.
if [ -e "${noCapability}" ]; then
  case "$1" in *compute_cap*) exit 6 ;; esac
  echo "0, GPU-fake, NVIDIA Fake, $total, $used, 615.71.09"
  exit 0
fi
echo "0, GPU-fake, NVIDIA Fake, $total, $used, 615.71.09, 12.0"
`,
);
chmodSync(join(binDir, "nvidia-smi"), 0o755);
process.env.PATH = `${binDir}:${process.env.PATH ?? ""}`;

const { DECISION_SIDECAR_DEFAULT_SETTINGS, parseDecisionSidecarSettings, SIDECAR_DECISION_MODELS } =
  await import("../../packages/shared/src/index.js");
const { setDecisionSidecarSettingsReader } =
  await import("../../packages/server/src/services/decision/decision-slots.js");
const { serializeDecisionRuntimeManifestStamp } =
  await import("../../packages/server/src/services/sidecar/runtime-integrity-manifest.js");
const { artifactSnapshotPath, decisionRuntimeInstalled, decisionRuntimeService, inheritedEnv } =
  await import("../../packages/server/src/services/sidecar/decision-runtime.service.js");
const { decisionProcessService } =
  await import("../../packages/server/src/services/sidecar/decision-process.service.js");
const { configuredCudaIndex, preflightDecisionModel } =
  await import("../../packages/server/src/services/sidecar/decision-preflight.js");
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

  // ── children get an allowlisted environment ───────────────────────────────────

  process.env.MARINARA_TEST_SECRET = "sk-should-not-leak";
  process.env.HTTPS_PROXY = "http://proxy.test:3128";
  assert.equal(inheritedEnv({ network: true }).MARINARA_TEST_SECRET, undefined, "a server secret is not passed on");
  assert.equal(inheritedEnv({ network: true }).HTTPS_PROXY, "http://proxy.test:3128", "uv still sees the proxy");
  assert.equal(inheritedEnv().HTTPS_PROXY, undefined, "the offline model process does not need it");
  assert.ok(inheritedEnv().PATH, "PATH is kept");
  process.env.LD_LIBRARY_PATH = "/run/opengl-driver/lib";
  process.env.CUDA_VISIBLE_DEVICES = "1";
  assert.equal(inheritedEnv().LD_LIBRARY_PATH, "/run/opengl-driver/lib", "the model process can find the CUDA driver");
  assert.equal(inheritedEnv().CUDA_VISIBLE_DEVICES, undefined, "device numbering stays the preflight's");
  delete process.env.LD_LIBRARY_PATH;
  delete process.env.CUDA_VISIBLE_DEVICES;
  delete process.env.MARINARA_TEST_SECRET;
  delete process.env.HTTPS_PROXY;

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
      // The default branch says something else, so the test can tell which one was read.
      if (url.endsWith("/api/models/pasted/model")) return Response.json({ cardData: { license: "other" } });
      if (url.endsWith(`/api/models/pasted/model/revision/${pastedRevision}`))
        return Response.json({ cardData: { license: "mit" } });
      if (url.endsWith(`/api/models/Qwen/Qwen3.5-2B/revision/${baseRevision}`))
        return Response.json({ tags: ["license:apache-2.0"] });
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

  globalThis.fetch = stubRepo(["package/checkpoint/head.pt", "package/checkpoint/adapter/adapter_model.bin"]);
  assert.deepEqual(await inspectDecisionRepo("pasted/model", pastedRevision), { refusal: "unsupported_files" });

  globalThis.fetch = stubRepo(["package/checkpoint/head.pt", "package/checkpoint/model.json"]);
  const inspected = await inspectDecisionRepo("pasted/model", pastedRevision);
  assert.ok("model" in inspected, "a repository of loadable files is accepted");
  assert.deepEqual(
    inspected.model.licenses,
    ["mit (pasted/model)", "apache-2.0 (Qwen/Qwen3.5-2B)"],
    "licences are read at the pinned revisions, not the default branch",
  );

  // A listing that fails is its own refusal, not a verdict about the repository.
  const healthy = stubRepo(["package/checkpoint/model.json"]);
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("/tree/")) return new Response("rate limited", { status: 429 });
    return healthy(input);
  }) as typeof fetch;
  assert.deepEqual(await inspectDecisionRepo("pasted/model", pastedRevision), { refusal: "listing_failed" });

  // ── what gets downloaded is exactly what was described ────────────────────────

  const requested: string[] = [];
  const downloadStub = (describe: (wanted: string[]) => unknown[]) =>
    (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      requested.push(url);
      if (url.includes("/tree/"))
        return Response.json([
          { type: "file", path: "package/checkpoint/a b#1.json", size: 2 },
          { type: "file", path: "package/checkpoint/model.json", size: 2 },
        ]);
      if (url.includes("/paths-info/"))
        return Response.json(describe((JSON.parse(String(init?.body)) as { paths: string[] }).paths));
      return new Response("missing", { status: 404 });
    }) as typeof fetch;
  const single = { ...model, artifacts: [model.artifacts[0]!] };

  globalThis.fetch = downloadStub((wanted) => [{ type: "file", path: wanted[0], size: 2 }]);
  await assert.rejects(
    decisionRuntimeService.downloadModel(single),
    /Could not read file details for ZefanCai\/Open-Jev-2B: package\/checkpoint\/model\.json/u,
    "a paths-info reply that leaves a file out is refused instead of skipping it",
  );
  globalThis.fetch = downloadStub((wanted) => [
    ...wanted.map((path) => ({ type: "file", path, size: 2 })),
    { type: "file", path: wanted[0], size: 2 },
  ]);
  await assert.rejects(
    decisionRuntimeService.downloadModel(single),
    /Could not read file details/u,
    "or duplicates one",
  );

  requested.length = 0;
  globalThis.fetch = downloadStub((wanted) => wanted.map((path) => ({ type: "file", path, size: 2 })));
  await assert.rejects(decisionRuntimeService.downloadModel(single));
  assert.ok(
    requested.some((url) =>
      url.endsWith("/resolve/0c7aa498b1627be8da4acf34c863ff0ee0a92785/package/checkpoint/a%20b%231.json"),
    ),
    `each path segment is encoded, separators kept: ${requested.join(" ")}`,
  );
  globalThis.fetch = realFetch;

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

  // ── one bad stored entry does not reset the whole settings record ────────────

  const stored = (customModel: unknown) =>
    parseDecisionSidecarSettings(
      JSON.stringify({
        enabled: true,
        startPolicy: "with_marinara",
        confirmedAt: "2026-09-23",
        customModel,
        cudaDevice: 1,
      }),
    );
  const pasted = { ...model, id: "byo:pasted", label: "pasted/model" };
  for (const bad of [
    { ...pasted, artifacts: [null] },
    { ...pasted, artifacts: [{ ...pasted.artifacts[0], paths: [7] }] },
    { ...pasted, licenses: "MIT" },
    { ...pasted, licenses: [1] },
  ]) {
    const parsed = stored(bad);
    assert.equal(parsed.customModel, null, "the bad entry is dropped");
    assert.equal(parsed.enabled, true, "and the rest of the record survives");
    assert.equal(parsed.startPolicy, "with_marinara");
    assert.equal(parsed.confirmedAt, "2026-09-23");
  }
  assert.ok(stored(pasted).customModel, "a well-formed entry is kept");
  assert.equal(stored(pasted).cudaDevice, 1);
  assert.equal(parseDecisionSidecarSettings(JSON.stringify({ cudaDevice: -1 })).cudaDevice, null);
  assert.equal(parseDecisionSidecarSettings(JSON.stringify({ cudaDevice: 1.5 })).cudaDevice, null);

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
  // A capability the probe could not read refuses a download, not a launch.
  writeFileSync(noCapability, "");
  const unknownBefore = await preflightDecisionModel(model, { fresh: true });
  assert.equal(unknownBefore.assessment.verdict, "unsupported", "an unreadable capability refuses the download");
  assert.match(unknownBefore.reason ?? "", /Could not read this GPU's compute capability/u);
  for (const artifact of model.artifacts) {
    mkdirSync(artifactSnapshotPath(artifact), { recursive: true });
    writeFileSync(join(artifactSnapshotPath(artifact), ".marinara-download.json"), "{}");
  }
  const unknownAfter = await preflightDecisionModel(model, { fresh: true });
  assert.notEqual(unknownAfter.assessment.verdict, "unsupported", "and does not stop an installed model launching");
  rmSync(noCapability);
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

  // ── the running model is counted once ─────────────────────────────────────────

  // An 8 GB card with this model already loaded on it. Counted twice it reads as
  // not fitting; counted once it fits with room to spare.
  writeFileSync(gpuState, `8192 ${Math.round(model.vramBytes / 1024 / 1024) + 14}\n`);
  const whileRunning = await preflightDecisionModel(model, { fresh: true });
  assert.equal(whileRunning.assessment.verdict, "recommended", "the running model is not counted twice");
  await decisionProcessService.stop();
  assert.equal(decisionProcessService.getStatus().running, false);
  writeFileSync(gpuState, "24463 14\n");

  // ── the chosen GPU is the one weighed ─────────────────────────────────────────

  let settings = { ...DECISION_SIDECAR_DEFAULT_SETTINGS };
  setDecisionSidecarSettingsReader(() => settings);
  process.env.MARINARA_DECISION_CUDA_DEVICE = "3";
  assert.equal(configuredCudaIndex(), 3, "with no choice made, the environment variable still applies");
  settings = { ...settings, cudaDevice: 0 };
  assert.equal(configuredCudaIndex(), 0, "a choice in the panel wins over the environment");
  assert.notEqual((await preflightDecisionModel(model, { fresh: true })).assessment.verdict, "unsupported");
  settings = { ...settings, cudaDevice: 1 };
  const missing = await preflightDecisionModel(model, { fresh: true });
  assert.equal(missing.assessment.verdict, "unsupported", "a chosen card that is gone is not replaced by another");
  assert.match(missing.reason ?? "", /device 1\) is not present/u);
  delete process.env.MARINARA_DECISION_CUDA_DEVICE;
} finally {
  globalThis.fetch = realFetch;
  await decisionProcessService.stop().catch(() => null);
  rmSync(root, { recursive: true, force: true });
}

console.log("decision-sidecar-runtime regression passed");
