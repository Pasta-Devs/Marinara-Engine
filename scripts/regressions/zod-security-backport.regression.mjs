// Preserve API-1 Zod 3 while guarding both parser generations inside zod@3.25.76.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const serverRequire = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const packageRoot = dirname(serverRequire.resolve("zod-v3/package.json"));
const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
assert.equal(manifest.version, "3.25.76", "Reassess the backport before changing the API-1 validator");
for (const name of ["server", "client", "shared"]) {
  const require = createRequire(new URL(`../../packages/${name}/package.json`, import.meta.url));
  assert.equal(require("zod/package.json").version, "4.6.7", `${name} uses the reviewed native core validator`);
}
let cases = 0;
for (const [name, file, specifier, legacy, mini] of [
  ["root", "index.js", "zod-v3", true, false],
  ["v4", "v4/index.js", "zod-v3/v4", false, false],
  ["v4-mini", "v4/mini/index.js", "zod-v3/v4-mini", false, true],
]) {
  for (const [format, z] of [
    ["ESM", await import(pathToFileURL(join(packageRoot, file)).href)],
    ["CJS", serverRequire(specifier)],
  ]) {
    const parse = (schema, value, async = false) =>
      mini
        ? z[async ? "safeParseAsync" : "safeParse"](schema, value)
        : schema[async ? "safeParseAsync" : "safeParse"](value);
    const element = (fn) => (mini ? z.pipe(z.transform(fn), z.string()) : z.preprocess(fn, z.string()));
    const bound = (kind, item) => {
      if (kind === "map") return z.map(z.string(), item).check(z.maxSize(2));
      const collection = kind.startsWith("array") ? z.array(item) : z.set(item);
      const method = kind.endsWith("exact") ? (kind.startsWith("array") ? "length" : "size") : "max";
      return mini
        ? collection.check(
            z[
              kind.startsWith("array")
                ? method === "max"
                  ? "maxLength"
                  : "length"
                : method === "max"
                  ? "maxSize"
                  : "size"
            ](2),
          )
        : collection[method](2);
    };
    for (const kind of ["array-max", "array-exact", "set-max", "set-exact", ...(!legacy ? ["map"] : [])]) {
      for (const async of [false, true]) {
        let visits = 0;
        const visit = (value) => {
          visits++;
          return value;
        };
        const schema = bound(kind, element(async ? async (value) => visit(value) : visit));
        const invalid = kind.startsWith("array")
          ? Array(1000).fill(0)
          : kind === "map"
            ? new Map(Array.from({ length: 1000 }, (_, i) => [String(i), i]))
            : new Set(Array.from({ length: 1000 }, (_, i) => i));
        const result = await parse(schema, invalid, async);
        assert.equal(result.success, false, `${name}/${format}/${kind}/${async}`);
        assert.equal(visits, 0, "An existing upper bound rejects before visiting invalid elements");
        assert.equal(result.error.issues.length, 1, "One existing bound issue, without an arbitrary error cap");
        assert.equal(result.error.issues[0].code, "too_big");
        cases++;
      }
    }
    const transformed = element((value) => value.trim().toUpperCase());
    assert.deepEqual((await parse(bound("array-max", transformed), [" a ", " b "])).data, ["A", "B"]);
    const defaults = mini
      ? z._default(bound("array-max", z.string()), ["saved"])
      : bound("array-max", z.string()).default(["saved"]);
    assert.deepEqual((await parse(defaults, undefined)).data, ["saved"]);
    const unlimited = z.array(z.string());
    assert.equal((await parse(unlimited, Array(10000).fill("valid"))).data.length, 10000, "No new collection limit");
    assert.equal(
      (await parse(unlimited, Array(1000).fill(0))).error.issues.length,
      1000,
      "Unbounded parsing is deliberately unchanged",
    );
    if (legacy) {
      assert.deepEqual(z.record(z.unknown()).parse({ saved: 1 }), { saved: 1 });
      const error = z.string().safeParse(1).error;
      assert.equal(error.errors, error.issues, "The package-facing Zod 3 error alias remains available");
      assert.deepEqual(
        z
          .object({ value: z.string().default("saved") })
          .partial()
          .parse({}),
        {},
      );
    } else {
      // Like upstream 6652, bounds apply to raw size before collapsing set values/map keys.
      const collapse = element(() => "same");
      assert.equal((await parse(bound("set-max", collapse), new Set(["a", "b", "c"]))).success, false);
      assert.equal(
        (
          await parse(
            z.map(collapse, z.string()).check(z.maxSize(2)),
            new Map([
              ["a", "x"],
              ["b", "y"],
              ["c", "z"],
            ]),
          )
        ).success,
        false,
      );
      assert.deepEqual([...(await parse(bound("set-max", collapse), new Set(["a", "b"]))).data], ["same"]);
      const shrink = mini
        ? z.pipe(
            z.transform((values) => values.slice(0, 2)),
            bound("array-max", z.string()),
          )
        : z.preprocess((values) => values.slice(0, 2), bound("array-max", z.string()));
      assert.deepEqual((await parse(shrink, ["a", "b", "c"])).data, ["a", "b"]);
      const overwrite = z.array(z.string()).check(
        z.overwrite((values) => values.slice(0, 2)),
        z.maxLength(2),
      );
      assert.deepEqual((await parse(overwrite, ["a", "b", "c"])).data, ["a", "b"]);
      const nested = z.object({ rows: bound("array-max", z.string()) });
      for (const jitless of [false, true]) {
        const result = mini
          ? z.safeParse(nested, { rows: Array(1000).fill(0) }, { jitless })
          : nested.safeParse({ rows: Array(1000).fill(0) }, { jitless });
        assert.equal(result.error.issues.length, 1, "Bundled v4 object JIT and interpreter share the size gate");
      }
    }
  }
}
// The single advisory exception is valid only for this exact source backport and resolution.
const workspace = readFileSync(new URL("../../pnpm-workspace.yaml", import.meta.url), "utf8");
const lock = readFileSync(new URL("../../pnpm-lock.yaml", import.meta.url), "utf8");
const section = (text, key) => {
  const lines = text.split(/\r?\n/u);
  const start = lines.indexOf(`${key}:`);
  assert.notEqual(start, -1, `${key} must be explicitly configured`);
  const end = lines.findIndex((line, index) => index > start && /^[^\s#]/u.test(line));
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .filter((line) => line.trim() && !line.trimStart().startsWith("#"));
};
assert.deepEqual(
  section(workspace, "audit").map((line) => line.trim()),
  ["ignore:", "- GHSA-mrhx-c7xc-m3w5"],
  "Only the backported advisory may be exempted",
);
assert.deepEqual(
  section(workspace, "patchedDependencies")
    .filter((line) => line.includes("zod@"))
    .map((line) => line.trim()),
  ["zod@3.25.76: patches/zod@3.25.76.patch"],
);
const versions = [
  ...new Set([...lock.matchAll(/^  zod@([^:(\s]+)(?:\([^\n]*\))?:/gmu)].map((match) => match[1])),
].sort();
assert.deepEqual(versions, ["3.25.76", "4.6.7"], "Only the reviewed native version and patched API-1 alias are allowed");
const patch = readFileSync(new URL("../../patches/zod@3.25.76.patch", import.meta.url));
const patchHash = createHash("sha256").update(patch).digest("hex");
assert.ok(
  section(lock, "patchedDependencies").some((line) => line.trim() === `zod@3.25.76: ${patchHash}`),
  "Frozen installs must bind the exact patch bytes",
);
console.log(
  `Zod security backport: ${cases} bounded sync/async controls plus API, valid-data and unchanged-limit guards passed`,
);
