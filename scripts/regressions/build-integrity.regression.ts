import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The build writes a source inventory into dist/config/build-meta.json. Startup and the in-app updater compare it
// with dist (and src when present), so a partial or stale build is reported instead of failing later as a
// confusing "Cannot find module" or as behaviour that ignores a fix.
process.env.LOG_LEVEL = "silent";
process.env.LOG_FILE_LEVEL = "silent";
const { checkBuildIntegrity, getLastBuildIntegrity, verifyDistAgainstMeta } =
  await import("../../packages/server/src/lib/build-integrity.js");

const root = mkdtempSync(join(tmpdir(), "marinara-build-integrity-"));
try {
  const serverRoot = join(root, "packages", "server");
  const write = (rel: string, text = "") => {
    const path = join(serverRoot, rel);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, text);
    return path;
  };
  const builtAt = new Date(Date.now() - 60_000);
  const old = new Date(builtAt.getTime() - 60_000);
  for (const rel of ["src/index.ts", "src/lib/util.ts"]) utimesSync(write(rel), old, old);
  write("src/types.d.ts");
  write("dist/index.js");
  write("dist/lib/util.js");
  const writeMeta = (meta: Record<string, unknown>) =>
    write("dist/config/build-meta.json", JSON.stringify({ builtAt: builtAt.toISOString(), ...meta }));

  writeMeta({ commit: "abcdef123456", srcFiles: ["index.ts", "lib/util.ts"] });
  const clean = verifyDistAgainstMeta(serverRoot, "abcdef1234567890");
  assert.equal(clean.outcome, "ok");
  assert.equal(clean.stale, false);
  assert.equal(clean.commitMatches, true, "an abbreviated built commit matches the full target");
  assert.equal(verifyDistAgainstMeta(serverRoot, "123456abcdef").commitMatches, false);
  assert.equal(verifyDistAgainstMeta(serverRoot).commitMatches, true, "no target commit: nothing to compare");

  // A module the build knew about but dist lacks (a stale tsbuildinfo skipped its emit).
  writeMeta({ commit: "abcdef123456", srcFiles: ["index.ts", "lib/util.ts", "lib/missing.ts"] });
  utimesSync(write("src/lib/missing.ts"), old, old);
  const missing = verifyDistAgainstMeta(serverRoot);
  assert.equal(missing.outcome, "failed");
  assert.deepEqual(missing.missingInDist, ["lib/missing.ts"]);
  assert.equal(missing.missingCount, 1);

  // A src file edited after the build, and one the build never saw.
  writeMeta({ commit: "abcdef123456", srcFiles: ["index.ts", "lib/util.ts", "lib/missing.ts"] });
  write("dist/lib/missing.js");
  write("src/lib/util.ts", "// edited");
  write("src/lib/added.ts");
  const drift = verifyDistAgainstMeta(serverRoot);
  assert.equal(drift.stale, true);
  assert.deepEqual(drift.newerFiles, ["lib/added.ts", "lib/util.ts"]);
  assert.deepEqual(drift.unknownSrc, ["lib/added.ts"]);
  assert.ok(!drift.newerFiles.includes("types.d.ts"), "declaration files are not modules");

  // Missing or unreadable metadata fails verification rather than passing silently.
  write("dist/config/build-meta.json", "{not json");
  const unreadable = verifyDistAgainstMeta(serverRoot, "abcdef123456");
  assert.equal(unreadable.outcome, "failed");
  assert.equal(unreadable.commitMatches, false);

  // The updater refuses to announce a successful update for a build that does not match.
  const { verifyPinnedBuild } = await import("../../packages/server/src/routes/updates.routes.js");
  writeMeta({ commit: "abcdef123456", srcFiles: ["index.ts"] });
  rmSync(join(serverRoot, "src"), { recursive: true, force: true });
  assert.doesNotThrow(() => verifyPinnedBuild(root, "abcdef123456"));
  assert.throws(
    () => verifyPinnedBuild(root, "fedcba654321"),
    (error: unknown) => (error as { errorCode?: string }).errorCode === "ME_UPDATE_BUILD_STALE",
  );
  writeMeta({ commit: "abcdef123456", srcFiles: ["index.ts", "gone.ts"] });
  assert.throws(() => verifyPinnedBuild(root, "abcdef123456"), /1 server modules are missing from dist/);
} finally {
  rmSync(root, { recursive: true, force: true });
}

// Under tsx (this runner) the startup check is skipped and never throws.
assert.equal(getLastBuildIntegrity(), null);
const startupResult = checkBuildIntegrity();
assert.equal(startupResult.runtime, "tsx");
assert.equal(startupResult.outcome, "skipped");
assert.equal(getLastBuildIntegrity(), startupResult);

console.log("build-integrity regression passed");
