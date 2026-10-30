// Guard the exact source backport used by the PWA build's installed Rollup resolver.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const clientRequire = createRequire(new URL("../../packages/client/package.json", import.meta.url));
const pwaRequire = createRequire(clientRequire.resolve("vite-plugin-pwa"));
const workboxRequire = createRequire(pwaRequire.resolve("workbox-build"));
const resolverRequire = createRequire(workboxRequire.resolve("@rollup/plugin-node-resolve"));
const packageRoot = dirname(resolverRequire.resolve("deepmerge/package.json"));
assert.equal(resolverRequire("deepmerge/package.json").version, "4.3.1", "Reassess the backport on version changes");

const payload = () => JSON.parse('{"__proto__":{"poisoned":true},"saved":"value"}');
let cases = 0;
for (const [name, merge] of [
  ["CJS", resolverRequire("deepmerge")],
  ["UMD", resolverRequire(join(packageRoot, "dist/umd.js"))],
]) {
  const safe = (result, label) => {
    assert.equal(Object.getPrototypeOf(result), Object.prototype, `${name}/${label}: retain the ordinary prototype`);
    assert.equal(result.poisoned, undefined, `${name}/${label}: no attacker-controlled inherited properties`);
    assert.equal(Object.hasOwn(result, "__proto__"), false, `${name}/${label}: reject the prototype setter key`);
    assert.equal(result.saved, "value", `${name}/${label}: preserve ordinary data`);
    assert.equal({}.poisoned, undefined, "No global prototype pollution");
    cases++;
  };
  safe(merge(Object.create(null), payload()), "null-prototype target");
  safe(merge(payload(), {}), "target copy loop");
  safe(merge({ session: payload() }, {}).session, "nested target copy");
  for (const placeholder of [null, undefined, false, 0, "pending"]) {
    safe(merge({ session: placeholder }, { session: payload() }).session, `placeholder ${String(placeholder)}`);
  }
  safe(merge({}, payload()), "ordinary target negative control");
  safe(merge([payload()], [])[0], "array clone negative control");

  const target = { nested: { first: 1 }, rows: ["first"] };
  const source = { nested: { second: 2 }, rows: ["second"] };
  const result = merge(target, source);
  assert.deepEqual(result, { nested: { first: 1, second: 2 }, rows: ["first", "second"] });
  assert.deepEqual(target, { nested: { first: 1 }, rows: ["first"] }, "Do not mutate the target");
  assert.deepEqual(source, { nested: { second: 2 }, rows: ["second"] }, "Do not mutate the source");
  assert.notEqual(result.nested, target.nested, "Retain default cloning");
  const symbol = Symbol("saved");
  assert.equal(merge({}, { [symbol]: "value" })[symbol], "value", "Preserve enumerable symbols");
  assert.deepEqual(merge({ session: null }, { session: { enabled: true } }), { session: { enabled: true } });
  assert.deepEqual(
    merge(Object.create(null), JSON.parse('{"constructor":{"saved":true},"prototype":{"saved":true}}')),
    { constructor: { saved: true }, prototype: { saved: true } },
    "Only __proto__ invokes the setter; retain ordinary constructor/prototype data",
  );
}

for (const file of ["index.js", "dist/cjs.js", "dist/umd.js"]) {
  const source = readFileSync(join(packageRoot, file), "utf8");
  assert.match(source, /function propertyIsForbidden\(key\)\s*\{\s*return key === '__proto__'/u, file);
  assert.match(source, /getKeys\(target\)\.forEach\(function\(key\)\s*\{\s*if \(propertyIsForbidden\(key\)\)/u, file);
  assert.match(
    source,
    /getKeys\(source\)\.forEach\(function\(key\)\s*\{\s*if \(propertyIsForbidden\(key\) \|\| propertyIsUnsafe\(target, key\)\)/u,
    file,
  );
}

const workspace = readFileSync(new URL("../../pnpm-workspace.yaml", import.meta.url), "utf8");
const lock = readFileSync(new URL("../../pnpm-lock.yaml", import.meta.url), "utf8");
const section = (text, key) => {
  const lines = text.split(/\r?\n/u);
  const start = lines.indexOf(`${key}:`);
  assert.notEqual(start, -1, `${key} must be explicitly configured`);
  const end = lines.findIndex((line, index) => index > start && /^[^\s#]/u.test(line));
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .filter((line) => line.trim() && !line.trimStart().startsWith("#"))
    .map((line) => line.trim());
};
assert.deepEqual(
  section(workspace, "audit").sort(),
  ["ignore:", "- GHSA-mrhx-c7xc-m3w5", "- GHSA-gcqx-w48m-w2h4"].sort(),
  "Only the independently guarded Zod and deepmerge backports may be exempted",
);
assert.deepEqual(
  section(workspace, "patchedDependencies").filter((line) => line.includes("deepmerge@")),
  ["deepmerge@4.3.1: patches/deepmerge@4.3.1.patch"],
);
const patch = readFileSync(new URL("../../patches/deepmerge@4.3.1.patch", import.meta.url));
const patchHash = createHash("sha256").update(patch).digest("hex");
assert.equal(
  patchHash,
  "6241e75cd0ebdeefbe93564d0f9a0da153bc6608add12970bd3c390910e7e4f4",
  "Retain the reviewed pnpm patch",
);
assert.ok(section(lock, "patchedDependencies").includes(`deepmerge@4.3.1: ${patchHash}`));
const versions = [
  ...new Set([...lock.matchAll(/^  deepmerge@([^:(\s]+)(?:\([^\n]*\))?:/gmu)].map((match) => match[1])),
];
assert.deepEqual(versions, ["4.3.1"], "Reassess the backport before another deepmerge version is installed");
const resolutions = [...lock.matchAll(/^\s+deepmerge: ([^\r\n]+)/gmu)].map((match) => match[1]);
assert.ok(resolutions.length > 0, "Verify the actual dependency resolutions");
assert.ok(
  resolutions.every((resolution) => resolution === `4.3.1(patch_hash=${patchHash})`),
  "Every consumer must use the backport",
);
assert.ok(
  lock.includes(`  deepmerge@4.3.1(patch_hash=${patchHash}): {}`),
  "Frozen installs must select the patched snapshot",
);
console.log(
  `Deepmerge security backport: ${cases} poisoning controls plus valid-data, installed-source and patch-hash guards passed`,
);
