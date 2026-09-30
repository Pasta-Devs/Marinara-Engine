import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePnpmRunner } from "../pnpm-runner.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const rootPackage = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8"));
const serverPackage = JSON.parse(readFileSync(join(repositoryRoot, "packages/server/package.json"), "utf8"));
const wasmVersion = serverPackage.dependencies["@img/sharp-wasm32"];
assert(wasmVersion, "the cross-platform WASM fallback must not be pruned with unsupported optional binaries");
const lock = readFileSync(join(repositoryRoot, "pnpm-lock.yaml"), "utf8");
const serverLock = lock.split("\n  packages/server:\n")[1]?.split("\n  packages/shared:\n")[0];
const sharpVersion = serverLock?.match(/\n      sharp:\n        specifier: [^\n]+\n        version: ([^\n]+)/u)?.[1];
assert(sharpVersion);
const runner = resolvePnpmRunner();
const pnpm = (args, cwd) => {
  const result = spawnSync(runner.command, [...runner.args, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env, COREPACK_ENABLE_NETWORK: "0" },
  });
  assert.equal(result.status, 0, result.stdout + result.stderr + (result.error?.message ?? ""));
  return result.stdout.trim();
};
const store = pnpm(["store", "path", "--silent"], repositoryRoot);
const fixture = mkdtempSync(join(tmpdir(), "marinara-sharp-frozen-"));
try {
  writeFileSync(
    join(fixture, "pnpm-workspace.yaml"),
    "packages: []\nautoInstallPeers: false\nconfirmModulesPurge: false\n",
  );
  const writeFixture = (required) => {
    writeFileSync(
      join(fixture, "package.json"),
      JSON.stringify({
        name: "marinara-sharp-proof",
        private: true,
        packageManager: rootPackage.packageManager,
        ...(required ? { dependencies: { "@img/sharp-wasm32": wasmVersion } } : {}),
        optionalDependencies: {
          ...(!required ? { "@img/sharp-wasm32": wasmVersion } : {}),
          sharp: serverPackage.optionalDependencies.sharp,
        },
      }),
    );
    // Reuse exact package snapshots; do not resolve versions or contact a registry.
    writeFileSync(
      join(fixture, "pnpm-lock.yaml"),
      `lockfileVersion: '9.0'
settings:
  autoInstallPeers: false
  excludeLinksFromLockfile: false
importers:
  .:
    ${required ? "dependencies" : "optionalDependencies"}:
      '@img/sharp-wasm32':
        specifier: ${wasmVersion}
        version: ${wasmVersion}
${required ? "    optionalDependencies:\n" : ""}      sharp:
        specifier: ${serverPackage.optionalDependencies.sharp}
        version: ${sharpVersion}
${lock.slice(lock.indexOf("\npackages:\n"))}`,
    );
  };
  const install = ["install", "--offline", "--frozen-lockfile", "--ignore-scripts", "--store-dir", store];
  const probe = (android) => {
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
      import assert from "node:assert/strict";
      import { createRequire } from "node:module";
      const require = createRequire(process.cwd() + "/package.json");
      if (${android}) Object.defineProperty(process, "platform", { value: "android" });
      const sharp = require("sharp");
      const png = await sharp({ create: { width: 2, height: 3, channels: 4, background: "#ee44aa" } }).resize(4, 6).png().toBuffer();
      const metadata = await sharp(png).metadata();
      assert.equal(metadata.width, 4);
      assert.equal(metadata.height, 6);
      assert.equal(metadata.format, "png");
      const wasmLoaded = Object.keys(require.cache).some((path) => path.includes("sharp-wasm32"));
      assert.equal(wasmLoaded, ${android}, "Android uses WASM; the supported desktop runtime keeps its native binding");
    `,
      ],
      { cwd: fixture, encoding: "utf8", timeout: 20_000 },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr + (result.error?.message ?? ""));
  };
  // Reproduce an existing install with optional dependencies omitted, then apply
  // the real manifest/lockfile change without deleting its installed metadata.
  writeFixture(false);
  pnpm([...install, "--no-optional"], fixture);
  const absent = spawnSync(process.execPath, ["-e", 'require.resolve("@img/sharp-wasm32/sharp.node")'], {
    cwd: fixture,
  });
  assert.notEqual(absent.status, 0);
  writeFixture(true);
  pnpm(install, fixture);
  probe(true);
  if (["darwin", "linux", "win32"].includes(process.platform)) probe(false);
  // A clean dependency refresh must restore the fallback without hand-editing node_modules.
  rmSync(join(fixture, "node_modules"), { recursive: true, force: true });
  pnpm(install, fixture);
  probe(true);
  console.info(
    "Frozen/offline Sharp install and update retain the working Android WASM fallback; desktop stays native.",
  );
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
