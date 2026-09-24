/**
 * Server hunt batch 54: utility sidecar install, start and config durability.
 *
 * 1. A failed reinstall must leave the working model file and its record in place, and
 *    the slot must refuse to start that model while its file is being replaced.
 * 2. ensureRunning must not retry a failed start of the same model three times.
 * 3. A spawn error (no 'exit' event) must fail the start fast with the real error.
 * 4. writeConfig must replace the config atomically (temp file plus rename).
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.LOG_LEVEL = "silent";
const dataDir = await mkdtemp(join(tmpdir(), "server-hunt-b54-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = `${process.env.DATA_DIR}/storage`; // never the live store named in .env

const { UtilitySidecarService } = await import(
  "../../packages/server/src/services/utility-sidecar/utility-sidecar.service.js"
);
const { sidecarRuntimeService } = await import("../../packages/server/src/services/sidecar/sidecar-runtime.service.js");

const UTILITY_DIR = join(dataDir, "models", "utility");
const CONFIG_PATH = join(UTILITY_DIR, "utility-sidecar-config.json");
const MODEL_ID = "beholder";
const MODEL_FILE = "model.gguf";
const MODEL_PATH = join(UTILITY_DIR, MODEL_ID, MODEL_FILE);
const WORKING_BYTES = "GGUF-working-copy";

function seedInstalledModel() {
  mkdirSync(join(UTILITY_DIR, MODEL_ID), { recursive: true });
  writeFileSync(MODEL_PATH, WORKING_BYTES);
  writeFileSync(
    CONFIG_PATH,
    JSON.stringify({
      activeModelId: MODEL_ID,
      contextSize: 4096,
      gpuLayers: 0,
      maxParallelJobs: 1,
      models: {
        [MODEL_ID]: {
          repo: "owner/repo",
          file: MODEL_FILE,
          oid: "old-oid",
          bytes: WORKING_BYTES.length,
          downloadedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    }),
  );
}

const realFetch = globalThis.fetch;
const realGetCurrentInstall = sidecarRuntimeService.getCurrentInstall.bind(sidecarRuntimeService);
const realIsGpuVariant = sidecarRuntimeService.isGpuVariant.bind(sidecarRuntimeService);

try {
  // ── 1. failed reinstall keeps the working copy; start is refused mid-install ──
  {
    seedInstalledModel();
    const service = new UtilitySidecarService();
    let releaseDownload!: () => void;
    const downloadGate = new Promise<void>((done) => (releaseDownload = done));
    let downloadStarted!: () => void;
    const downloadStartedPromise = new Promise<void>((done) => (downloadStarted = done));
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/models/")) {
        return new Response(
          JSON.stringify([{ path: MODEL_FILE, oid: "new-oid", size: 999, lfs: { oid: "new-oid", size: 999 } }]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      downloadStarted();
      await downloadGate;
      return new Response("upstream broke", { status: 500 });
    }) as typeof fetch;

    const install = service.installModel({ modelId: MODEL_ID, repo: "owner/repo", file: MODEL_FILE });
    await downloadStartedPromise;
    // The working copy is still on disk while the new one downloads.
    assert.equal(readFileSync(MODEL_PATH, "utf8"), WORKING_BYTES, "working model must survive the download start");
    // A start for the model being replaced is refused rather than respawned on the old file.
    const midStatus = await service.ensureRunning();
    assert.equal(midStatus.ready, false);
    assert.equal(midStatus.error, "The utility model is being updated");
    await assert.rejects(
      service.installModel({ modelId: MODEL_ID, repo: "owner/repo", file: MODEL_FILE }),
      /already being installed/,
    );

    releaseDownload();
    await assert.rejects(install, /HTTP 500/);
    assert.ok(existsSync(MODEL_PATH), "a failed reinstall must not delete the working model");
    assert.equal(readFileSync(MODEL_PATH, "utf8"), WORKING_BYTES);
    assert.equal(service.getConfig().models[MODEL_ID]?.oid, "old-oid", "the old record stays");
    assert.ok(!existsSync(`${MODEL_PATH}.staged`), "the staged download is cleaned up");
    assert.ok(!existsSync(`${MODEL_PATH}.staged.download`), "the partial download is cleaned up");
    globalThis.fetch = realFetch;
  }

  // ── 2. a failed start of the same model is not retried ──
  {
    seedInstalledModel();
    const service = new UtilitySidecarService();
    let starts = 0;
    (service as unknown as { start: () => Promise<void> }).start = async function (this: {
      startupError: string | null;
    }) {
      starts += 1;
      this.startupError = "simulated failure";
    };
    const status = await service.ensureRunning();
    assert.equal(starts, 1, "ensureRunning must not retry a failed start of the same model");
    assert.equal(status.error, "simulated failure");
  }

  // ── 3. a spawn error fails fast with the real reason ──
  {
    seedInstalledModel();
    const service = new UtilitySidecarService();
    sidecarRuntimeService.getCurrentInstall = (() => ({
      serverPath: join(dataDir, "no-such-dir", "llama-server-missing.exe"),
      variant: "cpu",
    })) as typeof sidecarRuntimeService.getCurrentInstall;
    sidecarRuntimeService.isGpuVariant = () => false;
    const began = Date.now();
    const status = await service.ensureRunning();
    const elapsed = Date.now() - began;
    assert.equal(status.ready, false);
    assert.ok(elapsed < 30_000, `spawn error must fail fast, took ${elapsed} ms`);
    assert.match(String(status.error), /ENOENT/, "the real spawn error is reported");
    sidecarRuntimeService.getCurrentInstall = realGetCurrentInstall;
    sidecarRuntimeService.isGpuVariant = realIsGpuVariant;
  }

  // ── 4. config writes are atomic ──
  {
    const source = readFileSync(
      new URL("../../packages/server/src/services/utility-sidecar/utility-sidecar.service.ts", import.meta.url),
      "utf8",
    );
    const body = source.slice(source.indexOf("private writeConfig(): void {"));
    const writeConfig = body.slice(0, body.indexOf("\n  }\n") + 4);
    assert.match(writeConfig, /writeFileSync\(tmp,/, "writeConfig writes a temp file first");
    assert.match(writeConfig, /renameSync\(tmp, CONFIG_PATH\)/, "then renames it over the config");
    assert.doesNotMatch(writeConfig, /writeFileSync\(CONFIG_PATH/, "never truncates the live config in place");

    // Behaviour: a settings change round-trips through the atomic write and leaves no temp file.
    seedInstalledModel();
    const service = new UtilitySidecarService();
    await service.updateSettings({ contextSize: 8192 });
    const onDisk = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    assert.equal(onDisk.contextSize, 8192);
    assert.equal(onDisk.models[MODEL_ID].oid, "old-oid");
    assert.ok(!existsSync(`${CONFIG_PATH}.${process.pid}.tmp`));
  }

  console.log("server-hunt-b54 regression passed");
} finally {
  globalThis.fetch = realFetch;
  sidecarRuntimeService.getCurrentInstall = realGetCurrentInstall;
  sidecarRuntimeService.isGpuVariant = realIsGpuVariant;
  await rm(dataDir, { recursive: true, force: true }).catch(() => {});
}
