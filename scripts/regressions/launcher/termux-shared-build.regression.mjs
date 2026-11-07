import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isLowMemoryBuild, sharedTscArgs } from "../../../packages/shared/scripts/tsc-build.mjs";

// #8902: in 2.5.2 the shared package's full type-check outgrew the 1 GiB heap Termux gives Node, so "Building shared
// types" aborted with "JavaScript heap out of memory" and Termux never started. Android and low-memory builds now emit
// the same JavaScript without a type-check or declarations.
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const sharedRoot = join(repositoryRoot, "packages/shared");

assert.equal(isLowMemoryBuild({ platform: "android", env: {} }), true, "Termux reports Android");
assert.equal(isLowMemoryBuild({ platform: "linux", env: { MARINARA_LOW_MEMORY_BUILD: "1" } }), true);
assert.equal(isLowMemoryBuild({ platform: "darwin", env: {} }), false);
assert.deepEqual(sharedTscArgs({ platform: "linux", env: {} }), [], "desktop and CI builds still type-check in full");
const lowMemory = sharedTscArgs({ platform: "android", env: {} });
assert.ok(lowMemory.includes("--noCheck"), "no type-check on Android");
assert.equal(
  lowMemory[lowMemory.indexOf("--declaration") + 1],
  "false",
  "and no declarations, which nothing there reads",
);

// Both build scripts compile through it, so the launcher, the in-app updater and the manual update command all do.
const scripts = JSON.parse(readFileSync(join(sharedRoot, "package.json"), "utf8")).scripts;
for (const name of ["build", "build:preserve"]) {
  assert.match(scripts[name], /&& node scripts\/tsc-build\.mjs$/u, `${name} compiles through scripts/tsc-build.mjs`);
}

// The low-memory build fits in the 1 GiB heap Termux starts with, and writes every module's JavaScript.
const out = mkdtempSync(join(tmpdir(), "marinara-shared-low-memory-"));
try {
  const tsc = fileURLToPath(import.meta.resolve("typescript/bin/tsc"));
  const run = spawnSync(
    process.execPath,
    ["--max-old-space-size=1024", tsc, "-p", sharedRoot, ...lowMemory, "--outDir", out],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.ok(existsSync(join(out, "constants/defaults.js")), "the file the launcher checks for is written");
  assert.ok(existsSync(join(out, "index.js")));
  const declarations = readdirSync(out, { recursive: true }).filter((name) => String(name).endsWith(".d.ts"));
  assert.deepEqual(declarations, []);
} finally {
  rmSync(out, { recursive: true, force: true });
}

console.log("Termux shared build regression passed.");
