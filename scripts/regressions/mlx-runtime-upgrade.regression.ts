// Exercise the real installer with deterministic process/download boundaries.
// Native uv upgrade/downgrade and Metal proofs are recorded separately in #8079.
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "marinara-mlx-upgrade-"));
process.env.DATA_DIR = root;
const { MLX_RUNTIME_MANIFEST, serializeMlxRuntimeManifestStamp } =
  await import("../../packages/server/src/services/sidecar/runtime-integrity-manifest.js");
const { mlxRuntimeService } = await import("../../packages/server/src/services/sidecar/mlx-runtime.service.js");
const runtime = join(root, "sidecar-runtime", "mlx");
const windows = process.platform === "win32";
const uv = join(runtime, "uv", windows ? "uv.exe" : "uv");
const python = join(runtime, ".venv", windows ? "Scripts" : "bin", windows ? "python.exe" : "python");
const stamp = join(runtime, "mlx-lm-package.txt");
const model = join(runtime, "hf-home", "model.safetensors");
const oldStamp = "previous-approved-environment\n";
const originalExec = childProcess.execFileSync;
const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
const arch = Object.getOwnPropertyDescriptor(process, "arch")!;
type Boundary = {
  runCommand: (command: string, args: string[], options: unknown) => Promise<void>;
  downloadVerifiedAsset: (asset: unknown, destination: string) => Promise<void>;
};
const boundary = mlxRuntimeService as unknown as Boundary;
const originalRun = boundary.runCommand;
const originalDownload = boundary.downloadVerifiedAsset;
let version: string | null = "0.31.3";
let fail: "download" | "sync" | "verify" | null = null;
const commands: string[][] = [];
const seed = () => {
  mkdirSync(join(runtime, "uv"), { recursive: true });
  mkdirSync(join(python, ".."), { recursive: true });
  mkdirSync(join(runtime, "hf-home"), { recursive: true });
  writeFileSync(uv, "approved uv fixture");
  writeFileSync(python, "existing environment");
  writeFileSync(model, "operator model");
  writeFileSync(stamp, oldStamp);
  writeFileSync(
    join(runtime, "uv-package.txt"),
    JSON.stringify({ version: MLX_RUNTIME_MANIFEST.uv.version, sha256: MLX_RUNTIME_MANIFEST.uv.archive.sha256 }),
  );
  version = "0.31.3";
  commands.length = 0;
};
const preserved = () => {
  assert.equal(readFileSync(uv, "utf8"), "approved uv fixture");
  assert.equal(readFileSync(model, "utf8"), "operator model");
};

try {
  Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
  Object.defineProperty(process, "arch", { value: "arm64", configurable: true });
  childProcess.execFileSync = ((command: string, ...args: unknown[]) => {
    if (command === uv) return `uv ${MLX_RUNTIME_MANIFEST.uv.version}`;
    if (command === python) {
      if (!version) throw new Error("package metadata missing");
      return version;
    }
    return Reflect.apply(originalExec, childProcess, [command, ...args]);
  }) as typeof originalExec;
  syncBuiltinESMExports();
  boundary.downloadVerifiedAsset = async (_asset, destination) => {
    if (fail === "download") throw new Error("source integrity failure");
    writeFileSync(destination, "verified source fixture");
  };
  boundary.runCommand = async (command, args) => {
    assert.equal(command, uv);
    commands.push(args);
    if (args[0] === "venv") {
      if (existsSync(python) && !args.includes("--allow-existing")) {
        throw new Error("A virtual environment already exists");
      }
      assert.equal(existsSync(stamp), false, "invalidate before the first environment mutation");
    } else if (args[0] === "pip" && args[1] === "sync") {
      assert.ok(args.includes("--require-hashes"));
      version = null;
      if (fail === "sync") throw new Error("Install aborted during dependency mutation");
    } else if (args[0] === "pip" && args[1] === "install") {
      assert.ok(args.includes("--no-deps") && args.includes("--no-build-isolation"));
      version = fail === "verify" ? null : "0.32.2";
    } else {
      assert.fail(`unexpected install command ${args.join(" ")}`);
    }
  };

  seed();
  const installed = await mlxRuntimeService.ensureInstalled();
  assert.equal(installed.build, "mlx-lm 0.32.2");
  assert.equal(readFileSync(stamp, "utf8").trim(), serializeMlxRuntimeManifestStamp());
  assert.equal(mlxRuntimeService.getStatus().installed, true);
  preserved();

  seed();
  fail = "sync";
  await assert.rejects(mlxRuntimeService.ensureInstalled(), /aborted during dependency mutation/u);
  assert.equal(existsSync(stamp), false, "a partially changed environment must not retain its previous approval");
  assert.equal(mlxRuntimeService.getStatus().installed, false);
  preserved();
  fail = null;
  await mlxRuntimeService.ensureInstalled();
  assert.equal(mlxRuntimeService.getStatus().installed, true, "retry must reuse the existing environment");
  preserved();

  seed();
  fail = "verify";
  await assert.rejects(mlxRuntimeService.ensureInstalled(), /could not be verified/u);
  assert.equal(existsSync(stamp), false, "missing package metadata must not be stamped current");
  preserved();

  seed();
  fail = null;
  await assert.rejects(
    mlxRuntimeService.ensureInstalled((progress) => {
      if (progress.label === "Verifying MLX runtime") mlxRuntimeService.cancelInstall();
    }),
    /Install aborted/u,
  );
  assert.equal(existsSync(stamp), false, "a cancellation at final verification must not approve the environment");
  preserved();

  seed();
  fail = "download";
  await assert.rejects(mlxRuntimeService.ensureInstalled(), /source integrity failure/u);
  assert.equal(readFileSync(stamp, "utf8"), oldStamp, "pre-mutation integrity failure must preserve the old approval");
  assert.equal(version, "0.31.3");
  assert.deepEqual(commands, [], "failed source verification must never start an environment mutation");
  preserved();
  console.log("MLX runtime upgrade, interrupted retry and verification regressions passed.");
} finally {
  boundary.runCommand = originalRun;
  boundary.downloadVerifiedAsset = originalDownload;
  childProcess.execFileSync = originalExec;
  syncBuiltinESMExports();
  Object.defineProperty(process, "platform", platform);
  Object.defineProperty(process, "arch", arch);
  rmSync(root, { recursive: true, force: true });
}
