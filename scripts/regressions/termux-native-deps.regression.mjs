import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path) => readFileSync(join(repositoryRoot, path), "utf8");

// #7178: pnpm 10 reads supportedArchitectures only from pnpm-workspace.yaml, package.json or the
// --os/--cpu/--libc flags. The .npmrc lines start-termux.sh used to append never applied, and
// Termux installs with pnpm's default target (android/<arch>), which is the one it needs.
for (const path of ["start-termux.sh", ".npmrc", "pnpm-workspace.yaml", "package.json"]) {
  assert.doesNotMatch(
    read(path),
    /supportedArchitectures|TERMUX_FORCE_INSTALL/u,
    `${path} must leave Termux installs on pnpm's default android/<arch> target`,
  );
}

// Every native loader Termux runs picks its binary by process.platform ("android"), so the
// default target must keep an android/arm64 build of each one. Linux builds are never loaded.
const lock = read("pnpm-lock.yaml")
  .split(/^---[ \t]*$/mu)
  .at(-1);
const [packagesSection, snapshotsSection] = lock.split("\npackages:\n")[1].split("\nsnapshots:\n");
// Each entry starts at a two-space-indented key; blank lines between entries are optional in YAML.
const blocks = (section) => {
  const entries = new Map();
  let key = null;
  for (const line of section.split("\n")) {
    if (/^ {2}\S/u.test(line)) {
      key = line
        .trim()
        .replace(/:( \{\})?$/u, "")
        .replace(/^'|'$/gu, "");
      entries.set(key, "");
    } else if (key && line.trim()) entries.set(key, `${entries.get(key)}${line}\n`);
  }
  return entries;
};
const packages = blocks(packagesSection);
const snapshots = blocks(snapshotsSection);
// Compare whole array values: "!android" or "!arm64" excludes the target instead of naming it.
const listField = (metadata, field) =>
  (new RegExp(`^ {4}${field}: \\[([^\\]]*)\\]`, "mu").exec(metadata)?.[1] ?? "")
    .split(",")
    .map((value) => value.trim().replace(/^'|'$/gu, ""))
    .filter(Boolean);
const allows = (values, target) => values.includes(target) && !values.includes(`!${target}`);
const runsOnAndroidArm64 = (key) => {
  const metadata = packages.get(key) ?? "";
  return allows(listField(metadata, "os"), "android") && allows(listField(metadata, "cpu"), "arm64");
};

for (const loader of ["esbuild", "rollup", "lightningcss", "@tailwindcss/oxide", "@napi-rs/canvas"]) {
  const versions = [...snapshots].filter(([key]) => key.startsWith(`${loader}@`));
  assert.ok(versions.length > 0, `${loader} must be in the lockfile`);
  for (const [key, body] of versions) {
    const optional = body.split("optionalDependencies:\n")[1] ?? "";
    const androidBuild = [...optional.matchAll(/^ {6}'?([^':\s]+)'?: (\S+)/gmu)]
      .map(([, name, version]) => `${name}@${version.replace(/\(.*$/u, "")}`)
      .find(runsOnAndroidArm64);
    assert.ok(androidBuild, `${key} needs an android/arm64 optional build for Termux installs`);
  }
}

console.info("Termux installs use pnpm's Android target, and every native loader has an android/arm64 build.");
