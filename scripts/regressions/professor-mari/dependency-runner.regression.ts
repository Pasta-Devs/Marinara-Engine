import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { WorkspaceChangeReviewService } from "../../../packages/server/src/services/professor-mari/workspace-change-review.service.js";

const scratch = mkdtempSync(join(tmpdir(), "marinara-dependency-runner-"));
const bin = join(scratch, "bin");
const cli = join(bin, "fixture.cjs");
const version = "12.15.0";
const descriptor = `pnpm@${version}+sha512.abcd`;
const integrity = "sha512-approved-fixture";
const originalEnv = { ...process.env };
mkdirSync(bin);
writeFileSync(
  cli,
  `const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const [manager, ...args] = process.argv.slice(2);
const mode = fs.readFileSync('.fixture-mode', 'utf8');
fs.appendFileSync('.fixture-calls', JSON.stringify({ manager, args, env: process.env }) + '\\n');
if (args.at(-1) === '--version') {
  if (manager === 'corepack' && mode === 'fallback') process.exit(1);
  process.stdout.write(manager === 'pnpm' ? '10.30.3\\n' : '${version}\\n');
  process.exit(0);
}
assert.equal(manager, mode === 'unpinned' ? 'pnpm' : mode === 'fallback' ? 'npx' : 'corepack');
if (manager === 'corepack') assert.equal(args.shift(), '${descriptor}');
if (manager === 'npx') assert.deepEqual(args.splice(0, 2), ['--yes', 'pnpm@${version}']);
assert.equal(process.env.npm_config_ignore_scripts, 'true');
assert.equal(process.env.npm_config_registry, 'https://registry.npmjs.org/');
if (args[0] === 'add') {
  assert.ok(args.includes('--ignore-scripts'));
  assert.ok(args.includes('--lockfile-only'));
  assert.ok(args.includes('--save-exact'));
  assert.ok(args.includes('is-number@7.0.0'));
  const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  manifest.dependencies = { 'is-number': '7.0.0' };
  fs.writeFileSync('package.json', JSON.stringify(manifest));
  fs.writeFileSync('pnpm-lock.yaml', 'integrity: ${integrity}\\n');
} else if (args[0] === 'fetch') {
  assert.deepEqual(args, ['fetch', '--registry=https://registry.npmjs.org/']);
} else {
  assert.deepEqual(args, ['install', '--offline', '--frozen-lockfile', '--ignore-scripts']);
}
`,
);
for (const manager of ["corepack", "pnpm", "npx"]) {
  if (process.platform === "win32") {
    writeFileSync(join(bin, `${manager}.cmd`), `@echo off\r\n"${process.execPath}" "${cli}" ${manager} %*\r\n`);
  } else {
    const quote = (value: string) => `'${value.replace(/'/gu, "'\\''")}'`;
    const wrapper = join(bin, manager);
    writeFileSync(wrapper, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(cli)} ${manager} "$@"\n`);
    chmodSync(wrapper, 0o755);
  }
}
process.env.PATH = `${bin}${delimiter}${originalEnv.PATH ?? ""}`;
process.env.MARI_DEPENDENCY_SECRET_CANARY = "must-not-leak";
process.env.npm_config_userconfig = join(scratch, "private-user.npmrc");
writeFileSync(process.env.npm_config_userconfig, "//registry.npmjs.org/:_authToken=must-not-leak\n");

try {
  for (const mode of ["corepack", "fallback", "unpinned", "invalid"]) {
    const workspace = join(scratch, mode);
    mkdirSync(workspace);
    writeFileSync(join(workspace, ".fixture-mode"), mode);
    const manifest = JSON.stringify({
      name: "dependency-runner-fixture",
      private: true,
      ...(mode === "unpinned" ? {} : { packageManager: mode === "invalid" ? "pnpm@latest" : descriptor }),
    });
    writeFileSync(join(workspace, "package.json"), manifest);
    const reviews = new WorkspaceChangeReviewService(workspace, {
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            name: "is-number",
            version: "7.0.0",
            dist: { integrity, tarball: "https://registry.npmjs.org/is-number/-/is-number-7.0.0.tgz" },
          }),
        )) as typeof fetch,
    });
    try {
      const approval = await reviews.requestDependencyInstall({
        packageName: "is-number",
        version: "7.0.0",
        target: "root",
        sessionId: "dependency-runner-regression",
      });
      const result = await reviews.approve(approval.id);
      assert.ok(result);
      if (mode === "invalid") {
        assert.equal(result.outcome, "failed");
        assert.match(result.error ?? "", /exact pnpm version/u);
        assert.equal(readFileSync(join(workspace, "package.json"), "utf8"), manifest);
        assert.equal(existsSync(join(workspace, "pnpm-lock.yaml")), false);
        assert.equal(existsSync(join(workspace, ".fixture-calls")), false);
        continue;
      }
      assert.equal(result.outcome, "applied", result.error ?? result.output);
      const calls = readFileSync(join(workspace, ".fixture-calls"), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as { manager: string; args: string[]; env: NodeJS.ProcessEnv });
      assert.deepEqual(
        calls.map(({ manager }) => manager),
        mode === "corepack"
          ? Array(4).fill("corepack")
          : mode === "fallback"
            ? ["corepack", "pnpm", ...Array(4).fill("npx")]
            : Array(3).fill("pnpm"),
      );
      if (mode === "corepack") assert.deepEqual(calls[0].args, [descriptor, "--version"]);
      if (mode === "fallback") assert.deepEqual(calls[2].args, ["--yes", `pnpm@${version}`, "--version"]);
      for (const { env } of calls) {
        assert.equal(env.MARI_DEPENDENCY_SECRET_CANARY, undefined);
        assert.ok(env.HOME?.includes("marinara-mari-dependency-"));
        for (const key of [
          "USERPROFILE",
          "APPDATA",
          "LOCALAPPDATA",
          "XDG_CONFIG_HOME",
          "XDG_DATA_HOME",
          "XDG_CACHE_HOME",
        ]) {
          assert.equal(env[key], env.HOME);
        }
        assert.equal(env.COREPACK_HOME, join(env.HOME!, "corepack"));
        assert.equal(env.PNPM_HOME, join(env.HOME!, "pnpm"));
        assert.equal(env.npm_config_userconfig, join(env.HOME!, ".npmrc"));
        assert.equal(existsSync(env.HOME!), false, "Temporary package-manager home must be removed after approval");
      }
    } finally {
      reviews.clear();
    }
  }
} finally {
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
  rmSync(scratch, { recursive: true, force: true });
}
console.log("Professor Mari default dependency runner regressions passed.");
