import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer, get } from "node:http";
import { createRequire } from "node:module";
import * as os from "node:os";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";
import AdmZip from "adm-zip";
import type { SidecarDownloadProgress } from "@marinara-engine/shared";

const workDir = mkdtempSync(join(os.tmpdir(), "marinara-extraction-security-"));
process.env.DATA_DIR = join(workDir, "data");
const payload = Buffer.from("verified runtime fixture");
const runtimeZip = new AdmZip();
runtimeZip.addFile("bin/llama-server.exe", payload);
const runtimeArchive = runtimeZip.toBuffer();
const packageZip = new AdmZip();
packageZip.addFile("native/runtime.dll", payload);
const packageArchive = packageZip.toBuffer();
let baseUrl = "";
const server = createServer((request, response) => {
  if (request.url === "/index.json") {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ resources: [{ "@type": "PackageBaseAddress/3.0.0", "@id": `${baseUrl}/flat/` }] }));
  } else if (request.url?.endsWith("/index.json")) {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ versions: ["1.0.0"] }));
  } else {
    const body = request.url === "/runtime.zip" ? runtimeArchive : packageArchive;
    response.setHeader("content-length", body.length);
    response.end(body);
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const outside = join(workDir, "outside");
  mkdirSync(outside);
  writeFileSync(join(outside, "runtime.dll"), "untouched");
  writeFileSync(join(outside, "llama-server.exe"), "untouched");

  // Exercise ONNX's actual installer, with only its NuGet HTTP transport and
  // temporary-directory root redirected to local fixtures.
  const serverRequire = createRequire(new URL("../../packages/server/package.json", import.meta.url));
  const installerFile = serverRequire.resolve("onnxruntime-node/script/install-utils.js");
  const onnxTemp = join(workDir, "onnx-temp");
  const legacyOnnxDir = join(onnxTemp, "onnxruntime-node-pkgs_123456");
  mkdirSync(legacyOnnxDir, { recursive: true });
  symlinkSync(outside, join(legacyOnnxDir, "extracted"), "junction");
  const installerModule = { exports: {} as { installPackages: (...args: unknown[]) => Promise<void> } };
  const onnxRoots: string[] = [];
  const onnxModes: number[] = [];
  runInNewContext(readFileSync(installerFile, "utf8"), {
    module: installerModule,
    console: { log() {}, warn() {} },
    Date: { now: () => 123456 },
    require: (id: string) => {
      if (id === "https") return { get };
      if (id === "os") return { ...os, tmpdir: () => onnxTemp };
      if (id === "adm-zip") {
        return function (file: string) {
          onnxRoots.push(dirname(file));
          onnxModes.push(statSync(dirname(file)).mode & 0o777);
          return new AdmZip(file);
        };
      }
      return serverRequire(id);
    },
  });
  const packageInfo = { name: "security-fixture", versions: [{ feed: "fixture", version: "1.0.0" }] };
  const installedDll = join(workDir, "installed", "runtime.dll");
  await installerModule.exports.installPackages(
    [packageInfo],
    [{ packagesInfo: packageInfo, filepath: installedDll, pathInPackage: "native/runtime.dll" }],
    { fixture: { type: "nuget", index: `${baseUrl}/index.json` } },
  );
  const onnxOutsideContent = readFileSync(join(outside, "runtime.dll"), "utf8");
  assert.deepEqual(readFileSync(installedDll), payload, "ONNX must still install the requested library");
  assert.ok(
    onnxRoots.every((root) => !existsSync(root)),
    "ONNX must clean its temporary files",
  );

  const { sidecarRuntimeService } =
    await import("../../packages/server/src/services/sidecar/sidecar-runtime.service.js");
  const { LLAMA_CPP_RUNTIME_MANIFEST } =
    await import("../../packages/server/src/services/sidecar/runtime-integrity-manifest.js");
  const service = sidecarRuntimeService as unknown as {
    selectBestAsset: () => Promise<unknown>;
    extractArchive: (file: string, target: string) => Promise<void>;
    installLatest: (onProgress: (progress: SidecarDownloadProgress) => void) => Promise<{ serverPath: string }>;
  };
  service.selectBestAsset = async () => ({
    variant: "security-fixture",
    asset: {
      name: "runtime.zip",
      browser_download_url: `${baseUrl}/runtime.zip`,
      size: runtimeArchive.length,
      sha256: createHash("sha256").update(runtimeArchive).digest("hex"),
    },
  });
  const runtimeDir = join(process.env.DATA_DIR!, "sidecar-runtime");
  const legacySidecarDir = join(runtimeDir, `${LLAMA_CPP_RUNTIME_MANIFEST.releaseTag}-security-fixture.extract`);
  const extractArchive = service.extractArchive.bind(service);
  const sidecarRoots: Array<{ path: string; mode: number; ino: number }> = [];
  service.extractArchive = async (file, target) => {
    const stat = statSync(target);
    sidecarRoots.push({ path: target, mode: stat.mode & 0o777, ino: stat.ino });
    if (sidecarRoots.length === 1) {
      writeFileSync(join(target, "partial.bin"), "interrupted extraction");
      throw new Error("simulated first extraction failure");
    }
    assert.equal(existsSync(join(target, "partial.bin")), false, "retry must remove partial contents");
    await extractArchive(file, target);
  };
  const installedRuntime = await service.installLatest((progress) => {
    if (progress.label !== "Extracting runtime files") return;
    mkdirSync(legacySidecarDir, { recursive: true });
    const link = join(legacySidecarDir, "bin");
    if (!existsSync(link)) symlinkSync(outside, link, "junction");
  });
  assert.deepEqual(readFileSync(installedRuntime.serverPath), payload, "sidecar retry must install the executable");
  const sidecarOutsideContent = readFileSync(join(outside, "llama-server.exe"), "utf8");
  assert.deepEqual(
    { onnx: onnxOutsideContent, sidecar: sidecarOutsideContent },
    { onnx: "untouched", sidecar: "untouched" },
    "installers must not extract through pre-seeded symlinks in their old predictable paths",
  );
  assert.equal(sidecarRoots.length, 2, "the fixture must exercise an extraction retry");
  assert.equal(sidecarRoots[0]!.ino, sidecarRoots[1]!.ino, "retry must preserve the private extraction directory");
  assert.ok(sidecarRoots.every((root) => root.path !== legacySidecarDir && !existsSync(root.path)));
  assert.ok(onnxRoots.every((root) => root !== legacyOnnxDir));
  if (process.platform !== "win32") {
    assert.deepEqual(onnxModes, [0o700], "ONNX temporary directories must be private");
    assert.ok(
      sidecarRoots.every((root) => root.mode === 0o700),
      "sidecar directories must remain private on retry",
    );
  }
  service.extractArchive = async () => {
    throw new Error("simulated permanent extraction failure");
  };
  await assert.rejects(
    service.installLatest(() => {}),
    /permanent extraction failure/,
  );
  assert.deepEqual(
    readdirSync(runtimeDir).filter((name) => name.includes(".extract")),
    [],
    "failed installs must clean private extraction directories",
  );
  console.info("Archive extraction security regressions passed.");
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  rmSync(workDir, { recursive: true, force: true });
}
