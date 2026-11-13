// A package server bundles the Engine's runtime-config, which finds .env four folders above its own file and creates
// it there when it is missing. From a runtime copy (<data>/capability-runtime-snapshots/<id>/server.mjs) that is two
// folders above the data folder: "/" on a source install with a short DATA_DIR, so every boot logged EACCES
// open '/.env' (Pasta-Devs/Marinara-Agents#2036). The host must hand the copy its own .env path, as it does DATA_DIR.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../../", import.meta.url));
const base = mkdtempSync(join(tmpdir(), "marinara-runtime-env-file-"));
const dataDir = join(base, "install", "data");
const snapshot = join(dataDir, "capability-runtime-snapshots", "noodle-1.5.12-regression");
const strayEnv = join(base, ".env");
const hostEnv = join(base, "host.env");
const configuredEnvFile = process.env.MARINARA_ENV_FILE;

try {
  mkdirSync(snapshot, { recursive: true });
  writeFileSync(hostEnv, "MARINARA_RUNTIME_ENV_PROBE=host\n", { mode: 0o600 });
  // Link the copy's dependencies as createVerifiedRuntimeSnapshot does: one link per Engine dependency. A single
  // junction to packages/server/node_modules is not what the Engine makes, and on Windows it cannot follow pnpm's
  // relative links inside that folder.
  const { linkCapabilitySnapshotDependencies } =
    await import("../../packages/server/src/services/capability-packages/capability-native-dependencies.service.js");
  await linkCapabilitySnapshotDependencies(snapshot, join(root, "packages/server/node_modules"));
  await build({
    entryPoints: [join(root, "packages/server/src/config/runtime-config.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    outfile: join(snapshot, "server.mjs"),
    logLevel: "silent",
  });

  const { prepareCapabilityRuntimeEnvironment } =
    await import("../../packages/server/src/services/capability-packages/capability-module-runtime.service.js");
  // A source install that never set MARINARA_ENV_FILE.
  delete process.env.MARINARA_ENV_FILE;
  prepareCapabilityRuntimeEnvironment(dataDir, hostEnv);

  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const config = await import(${JSON.stringify(pathToFileURL(join(snapshot, "server.mjs")).href)});
console.log("RESULT " + JSON.stringify({ envFile: config.getEnvFilePath(), probe: process.env.MARINARA_RUNTIME_ENV_PROBE ?? null }));
process.exit(0);`,
    ],
    { cwd: base, encoding: "utf8", env: process.env, timeout: 20_000 },
  );
  assert.equal(child.status, 0, child.stderr);
  const line = child.stdout.split("\n").find((entry) => entry.startsWith("RESULT "));
  assert.ok(line, `The package runtime printed no result:\n${child.stdout}\n${child.stderr}`);
  const result = JSON.parse(line.slice("RESULT ".length)) as { envFile: string; probe: string | null };

  assert.equal(existsSync(strayEnv), false, "A package runtime must not create a .env two folders above DATA_DIR");
  assert.equal(result.envFile, hostEnv, "A package runtime must read the host's .env");
  assert.equal(result.probe, "host", "A package runtime must load the host's .env");
  console.log("capability runtime env file regression passed");
} finally {
  if (configuredEnvFile === undefined) delete process.env.MARINARA_ENV_FILE;
  else process.env.MARINARA_ENV_FILE = configuredEnvFile;
  rmSync(base, { recursive: true, force: true });
}
