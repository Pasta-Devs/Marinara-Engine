// GHSA-3g3m-2fjr-6pw4 (glob) and GHSA-g3hv-75wg-m249 (minimatch) are fixed only in the glob 14 and
// minimatch 11 majors, which pnpm-workspace.yaml forces under every consumer. Guard the resolutions
// and the exact calls each consumer makes, so a reverted override or a broken major shows up here.
// GHSA-fc5q-39xc-vjpf (picomatch) has no fixed release, so pnpm-workspace.yaml ignores it; see the end.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePnpmRunner } from "../../pnpm-runner.mjs";

const lock = readFileSync(new URL("../../../pnpm-lock.yaml", import.meta.url), "utf8");
for (const [name, fixed] of [
  ["glob", [14, 0, 2]],
  ["minimatch", [11, 0, 1]],
]) {
  const versions = [...lock.matchAll(new RegExp(`^  ${name}@(\\d+)\\.(\\d+)\\.(\\d+)[:(]`, "gmu"))];
  assert.ok(versions.length > 0, `Verify the actual ${name} resolutions`);
  for (const match of versions) {
    const version = match.slice(1).map(Number);
    const differs = version.findIndex((part, index) => part !== fixed[index]);
    assert.ok(differs === -1 || version[differs] > fixed[differs], `${name}@${version.join(".")} predates the fix`);
  }
}

const fromRepo = (path) => createRequire(realpathSync(new URL(path, import.meta.url)));
const chain = (from, ...names) => names.reduce((parent, name) => createRequire(parent.resolve(name)), from);
const staticRequire = chain(fromRepo("../../../packages/server/package.json"), "@fastify/static");
// ESM-only, so start from its package directory instead of resolving an entry point.
const piRequire = fromRepo("../../../packages/server/node_modules/@earendil-works/pi-coding-agent/package.json");
const workboxRequire = chain(fromRepo("../../../packages/client/package.json"), "vite-plugin-pwa", "workbox-build");
const filelistRequire = chain(workboxRequire, "@trickfilm400/rollup-plugin-off-main-thread", "ejs", "jake", "filelist");

// glob returns native separators (assets\index-AbCd.js on Windows). Both consumers convert results
// to "/" themselves, so the assertions do the same and the glob calls stay exactly as they make them.
const posixSorted = (files) => files.map((file) => file.replaceAll("\\", "/")).sort();

const root = mkdtempSync(join(tmpdir(), "marinara-glob-overrides-"));
try {
  mkdirSync(join(root, "assets"));
  for (const file of ["index.html", ".hidden", "assets/index-AbCd.js"]) writeFileSync(join(root, file), "");

  // @fastify/static walks client/dist once at registration because wildcard is false.
  const { glob } = staticRequire("glob");
  const served = await glob("**/**", { cwd: `${root}/`, absolute: false, follow: true, nodir: true });
  assert.deepEqual(posixSorted(served), ["assets/index-AbCd.js", "index.html"]);

  // workbox-build lists the PWA precache files.
  const precached = workboxRequire("glob").globSync("**/*.{js,html}", { cwd: root, follow: true, ignore: [] });
  assert.deepEqual(posixSorted(precached), ["assets/index-AbCd.js", "index.html"]);
} finally {
  rmSync(root, { recursive: true, force: true });
}

// pi-coding-agent matches model scopes. filelist was on minimatch 5, whose CJS export was the function
// itself; it only calls the `match` helper, which minimatch 11 still exports.
assert.equal(piRequire("minimatch").minimatch("openai/GPT-5", "openai/gpt-*", { nocase: true }), true);
assert.equal(piRequire("minimatch").minimatch("skills/x.md", "skills/*.ts"), false);
assert.deepEqual(filelistRequire("minimatch").match(["a.js", "b.ts"], "*.js", {}), ["a.js"]);

// picomatch's ReDoS (single-branch repeated extglobs) needs a pattern someone else wrote. Only build and lint tools
// load picomatch here, on the repository's own patterns, so the advisory is ignored until a fixed release exists.
// Reassess it when picomatch reaches a production dependency or another version is installed.
const pnpm = resolvePnpmRunner();
const whyPicomatch = (...args) => {
  const result = spawnSync(pnpm.command, [...pnpm.args, "why", "picomatch", "--json", ...args], {
    cwd: fileURLToPath(new URL("../../..", import.meta.url)),
    encoding: "utf8",
    env: { ...process.env, COREPACK_ENABLE_NETWORK: "0" },
    timeout: 60_000,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr + (result.error?.message ?? ""));
  return JSON.parse(result.stdout);
};
assert.deepEqual(whyPicomatch("--prod"), [], "picomatch must stay out of production dependencies while ignored");
assert.deepEqual(
  [...new Set(whyPicomatch().map((entry) => entry.version))],
  ["4.0.7"],
  "picomatch changed: reassess the GHSA-fc5q-39xc-vjpf exception, and drop it if the new version is fixed",
);

console.log(
  "glob/minimatch/picomatch security guards: fixed resolutions, every consumer call and the picomatch exception passed",
);
