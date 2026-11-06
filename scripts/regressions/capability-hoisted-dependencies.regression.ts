import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire, findPackageJSON } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const directory = await mkdtemp(join(tmpdir(), "marinara-hoisted-dependencies-"));
process.env.DATA_DIR = join(directory, "external-data");
process.env.FILE_STORAGE_DIR = join(directory, "external-storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const { linkCapabilitySnapshotDependencies } =
  await import("../../packages/server/src/services/capability-packages/capability-native-dependencies.service.js");
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const names = ["zod", "zod-v3", "nanoid", "adm-zip", "@fastify/cors"] as const;
const targets = Object.fromEntries(names.map((name) => [name, dirname(requireServer.resolve(`${name}/package.json`))]));
const dependencies = Object.fromEntries(
  await Promise.all(
    names.map(async (name) => [name, JSON.parse(await readFile(join(targets[name]!, "package.json"), "utf8")).version]),
  ),
);
const linkType = process.platform === "win32" ? "junction" : "dir";
async function link(modules: string, name: string, target = targets[name]!) {
  const path = join(modules, name);
  await mkdir(dirname(path), { recursive: true });
  await symlink(target, path, linkType);
}
async function fixture(name: string, required: Record<string, string>, optionalDependencies = {}) {
  const engine = join(directory, "controls", name, "engine");
  const server = join(engine, "packages", "server");
  const snapshot = join(directory, "controls", name, "external-data", "snapshot");
  await mkdir(server, { recursive: true });
  await mkdir(snapshot, { recursive: true });
  await writeFile(join(server, "package.json"), JSON.stringify({ dependencies: required, optionalDependencies }));
  return { server, modules: join(engine, "node_modules"), logicalModules: join(server, "node_modules"), snapshot };
}
async function packageWithoutMetadata(modules: string, name: string) {
  const root = join(modules, name);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "index.js"), "module.exports = {};");
}

try {
  await test("native Engine Zod 4 reproduces the package's missing innerType API", () => {
    const zod = requireServer("zod");
    assert.equal(Number(requireServer("zod/package.json").version.split(".")[0]), 4);
    const schema = zod.object({}).superRefine(() => {});
    assert.throws(() => schema.innerType(), /innerType is not a function/);
    assert.equal(
      typeof requireServer("zod-v3")
        .object({})
        .superRefine(() => {}).innerType,
      "function",
    );
  });
  for (const location of ["inside-engine", "external-data"] as const) {
    for (const layout of ["pnpm-direct", "no-server-modules", "partial-server-modules", "native-zod-only"] as const) {
      await test(`${location}: ${layout} links every declared dependency and the legacy Zod alias`, async () => {
        const root = join(directory, location, layout);
        const engine = join(root, "engine");
        const server = join(engine, "packages", "server");
        const serverModules = join(server, "node_modules");
        const hoistedModules = join(engine, "node_modules");
        const data = location === "inside-engine" ? join(engine, "data") : join(root, "external-data");
        const snapshot = join(data, "capability-runtime-snapshots", "probe");
        await mkdir(server, { recursive: true });
        await mkdir(snapshot, { recursive: true });
        await writeFile(join(server, "package.json"), JSON.stringify({ name: "fixture-server", dependencies }));
        for (const name of names) await link(hoistedModules, name);
        if (layout === "pnpm-direct") {
          for (const name of names) await link(serverModules, name);
        } else if (layout === "partial-server-modules") {
          await link(serverModules, "adm-zip");
        } else if (layout === "native-zod-only") {
          await link(serverModules, "zod");
        }

        // The logical server base resolves the same installed dependencies in every layout.
        const hostRequire = createRequire(join(server, "package.json"));
        for (const name of names) {
          assert.equal(
            await realpath(dirname(hostRequire.resolve(`${name}/package.json`))),
            await realpath(targets[name]!),
          );
        }
        await linkCapabilitySnapshotDependencies(snapshot, serverModules);
        for (const name of names) {
          assert.equal(
            await realpath(join(snapshot, "node_modules", name)),
            await realpath(targets[name === "zod" ? "zod-v3" : name]!),
            `${name} links to the Engine-resolved package, with only Zod remapped`,
          );
        }
        const entry = join(snapshot, "server.mjs");
        await writeFile(
          entry,
          `import { z } from "zod";
import { nanoid } from "nanoid";
import AdmZip from "adm-zip";
import cors from "@fastify/cors";
const schema = z.object({}).superRefine(() => {});
export const parsed = schema.innerType().parse({});
export const legacyMethod = typeof schema.innerType;
export const generatedId = nanoid(8);
export const zipEntries = new AdmZip().getEntries().length;
export const scopedExport = typeof cors;
`,
        );
        const loaded = await import(pathToFileURL(entry).href);
        assert.deepEqual(loaded.parsed, {});
        assert.equal(loaded.legacyMethod, "function");
        assert.equal(loaded.generatedId.length, 8);
        assert.equal(loaded.zipEntries, 0);
        assert.equal(loaded.scopedExport, "function");
        assert.equal(Number(hostRequire("zod/package.json").version.split(".")[0]), 4, "the host keeps native Zod 4");
      });
    }
  }
  for (const alias of ["missing", "wrong-major"] as const) {
    await test(`${alias} Zod alias refuses snapshot linking instead of falling back to native Zod 4`, async () => {
      const f = await fixture(alias, { zod: dependencies.zod!, "zod-v3": dependencies["zod-v3"]! });
      await link(f.modules, "zod");
      if (alias === "wrong-major") await link(f.modules, "zod-v3", targets.zod);
      await assert.rejects(() => linkCapabilitySnapshotDependencies(f.snapshot, f.logicalModules), /zod-v3/);
      await assert.rejects(() => realpath(join(f.snapshot, "node_modules", "zod")), { code: "ENOENT" });
    });
  }
  await test("missing required package metadata refuses linking even when its entrypoint exists", async () => {
    const name = "fixture-required-metadata";
    const f = await fixture("required-metadata", {
      zod: dependencies.zod!,
      "zod-v3": dependencies["zod-v3"]!,
      [name]: "1",
    });
    await link(f.modules, "zod");
    await link(f.modules, "zod-v3");
    await packageWithoutMetadata(f.modules, name);
    const hostRequire = createRequire(join(f.server, "package.json"));
    assert.equal(await realpath(hostRequire.resolve(name)), await realpath(join(f.modules, name, "index.js")));
    await assert.rejects(
      () => linkCapabilitySnapshotDependencies(f.snapshot, f.logicalModules),
      (error: unknown) => error instanceof Error && (error.cause as NodeJS.ErrnoException)?.code === "ENOENT",
    );
  });
  await test("absent optional/development packages are skipped while installed tools and required APIs remain importable", async () => {
    const absent = "fixture-absent-optional";
    const metadata = "fixture-optional-metadata";
    const f = await fixture(
      "optional",
      { zod: dependencies.zod!, "zod-v3": dependencies["zod-v3"]!, nanoid: dependencies.nanoid! },
      { [absent]: "1", [metadata]: "1" },
    );
    const manifestPath = join(f.server, "package.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.devDependencies = { "adm-zip": dependencies["adm-zip"]!, "fixture-absent-dev": "1" };
    await writeFile(manifestPath, JSON.stringify(manifest));
    for (const name of ["zod", "zod-v3", "nanoid", "adm-zip"]) await link(f.modules, name);
    await packageWithoutMetadata(f.modules, metadata);
    await linkCapabilitySnapshotDependencies(f.snapshot, f.logicalModules);
    assert.equal(await realpath(join(f.snapshot, "node_modules", "adm-zip")), await realpath(targets["adm-zip"]!));
    for (const name of [absent, metadata, "fixture-absent-dev"]) {
      await assert.rejects(() => realpath(join(f.snapshot, "node_modules", name)), { code: "ENOENT" });
    }
    const entry = join(f.snapshot, "server.mjs");
    await writeFile(
      entry,
      'import {z} from "zod"; import {nanoid} from "nanoid"; export const parsed=z.object({}).superRefine(()=>{}).innerType().parse({}); export const id=nanoid(8);',
    );
    const loaded = await import(pathToFileURL(entry).href);
    assert.deepEqual(loaded.parsed, {});
    assert.equal(loaded.id.length, 8);
  });
  await test("ordinary and scoped dependencies can hide package.json in exports and still import", async () => {
    const hidden = ["jsonrepair", "@anthropic-ai/sdk"];
    const resolved: Record<string, string> = {};
    const required = { zod: dependencies.zod!, "zod-v3": dependencies["zod-v3"]! } as Record<string, string>;
    for (const name of hidden) {
      assert.throws(() => requireServer.resolve(`${name}/package.json`), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
      const manifest = findPackageJSON(name, new URL("../../packages/server/package.json", import.meta.url));
      assert(manifest);
      resolved[name] = dirname(manifest);
      required[name] = JSON.parse(await readFile(manifest, "utf8")).version;
    }
    const f = await fixture("hidden-exports", required);
    await link(f.modules, "zod");
    await link(f.modules, "zod-v3");
    for (const name of hidden) await link(f.modules, name, resolved[name]);
    await linkCapabilitySnapshotDependencies(f.snapshot, f.logicalModules);
    for (const name of hidden) {
      assert.equal(await realpath(join(f.snapshot, "node_modules", name)), await realpath(resolved[name]!));
    }
    const entry = join(f.snapshot, "server.mjs");
    await writeFile(
      entry,
      'import {jsonrepair} from "jsonrepair"; import Anthropic from "@anthropic-ai/sdk"; export const parsed=JSON.parse(jsonrepair("{unquoted:true}")); export const scoped=typeof Anthropic;',
    );
    const loaded = await import(pathToFileURL(entry).href);
    assert.deepEqual(loaded.parsed, { unquoted: true });
    assert.equal(loaded.scoped, "function");
  });
} finally {
  await rm(directory, { recursive: true, force: true });
}
