/**
 * Package servers take the Engine's own copies of its direct dependencies (capability API 1.341). A package build
 * leaves zod, adm-zip, dotenv, nanoid and jsonrepair out of server.mjs, and Node resolves them through
 * managed snapshot links → `DATA_DIR/capability-packages/node_modules` → `packages/server/node_modules`. Zod is
 * the deliberate API-1 exception: packages retain the full Zod 3 alias while Engine validators use native Zod 4. pnpm's
 * strict layout resolves only direct dependencies there, so the names stay direct dependencies of packages/server,
 * and a link left by another install path (a moved data folder) is rebuilt before packages load.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const serverRoot = join(repositoryRoot, "packages", "server");
const serverNodeModules = join(serverRoot, "node_modules");
const SHARED_SERVER_LIBRARIES = ["zod", "adm-zip", "dotenv", "nanoid", "jsonrepair"] as const;
const EXISTING_SERVER_EXTERNALS = [
  "@huggingface/transformers",
  "onnxruntime-node",
  "onnxruntime-web",
  "sharp",
  "pino",
  "pino-pretty",
  "undici",
] as const;

// ── Every name a package build leaves external is a production dependency of packages/server ──
// Docker installs with --prod, so a devDependency would be missing there.
const serverManifest = JSON.parse(readFileSync(join(serverRoot, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};
for (const name of [...SHARED_SERVER_LIBRARIES, ...EXISTING_SERVER_EXTERNALS]) {
  assert.ok(
    serverManifest.dependencies?.[name] ?? serverManifest.optionalDependencies?.[name],
    `${name} must stay a dependency or optional dependency of packages/server: package servers import it from the Engine`,
  );
}
// Both Docker images keep packages/server/node_modules, the link's target, and strip none of the shared libraries.
for (const file of ["Dockerfile", "Dockerfile.lite"]) {
  const dockerfile = readFileSync(join(repositoryRoot, file), "utf8");
  assert.match(dockerfile, /pnpm install --frozen-lockfile --prod/, `${file} installs the server's dependencies`);
  for (const name of SHARED_SERVER_LIBRARIES) {
    assert.doesNotMatch(dockerfile, new RegExp(`(node_modules|\\.pnpm)/${name}\\b`), `${file} must not remove ${name}`);
  }
}
assert.match(
  readFileSync(join(repositoryRoot, "Dockerfile.lite"), "utf8"),
  /tar cf [^\n]*\\\n(?:[^\n]*\\\n)*\s*packages\/server\/node_modules\b/,
  "Dockerfile.lite copies packages/server/node_modules into the runtime image",
);

// What the host itself resolves for each name, read the way the contract's experiment did: an ES module evaluated
// with packages/server as its base.
const hostResolution = spawnSync(
  process.execPath,
  [
    "--input-type=module",
    "-e",
    `const out = {}; for (const name of ${JSON.stringify(SHARED_SERVER_LIBRARIES)}) out[name] = import.meta.resolve(name === "zod" ? "zod-v3" : name);
     try { import.meta.resolve("ws"); out.ws = "resolved"; } catch (error) { out.ws = error.code; }
     process.stdout.write(JSON.stringify(out));`,
  ],
  { cwd: serverRoot, encoding: "utf8" },
);
assert.equal(hostResolution.status, 0, hostResolution.stderr);
const hostUrls = JSON.parse(hostResolution.stdout) as Record<string, string>;
assert.equal(hostUrls.ws, "ERR_MODULE_NOT_FOUND", "ws is only a transitive dependency, so it never resolves");

const dir = mkdtempSync(join(tmpdir(), "marinara-server-externals-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const serverRequire = createRequire(join(serverRoot, "package.json"));
const Fastify = serverRequire("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { capabilityModuleRuntime } =
  await import("../../packages/server/src/services/capability-packages/capability-module-runtime.service.js");
const { getCapabilityService } =
  await import("../../packages/server/src/services/capability-packages/capability-service-registry.service.js");
const { linkCapabilityPackageDependencies } =
  await import("../../packages/server/src/services/capability-packages/capability-native-dependencies.service.js");
const { linkCapabilitySnapshotDependencies } =
  await import("../../packages/server/src/services/capability-packages/capability-native-dependencies.service.js");
const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");

type ProbeService = {
  modules: Record<string, unknown>;
  urls: Record<string, string>;
  parsed: unknown;
  compat: Record<string, unknown>;
  request: (payload: unknown) => Promise<{ statusCode: number; body: string; json: () => { details: unknown[] } }>;
};

const timestamp = new Date().toISOString();
function fixturePackage(id: string, source: string, permissions: string[] = []) {
  const manifest = {
    schemaVersion: 1,
    id,
    name: id,
    version: "1.0.0",
    description: "Local server externals proof",
    engine: { min: "2.3.0", maxExclusive: "3.0.0" },
    kind: ["agent"],
    entrypoints: { server: "server.mjs" },
    permissions,
    restartRequired: false,
    files: [
      {
        path: "server.mjs",
        bytes: Buffer.byteLength(source),
        sha256: createHash("sha256").update(source).digest("hex"),
      },
    ],
  };
  const root = join(dir, "capability-packages", "versions", id, "1.0.0");
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "server.mjs"), source);
  writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest));
  return {
    id,
    version: "1.0.0",
    manifest,
    installedAt: timestamp,
    status: "active",
    readiness: "ready",
    error: null,
    legacy: false,
  };
}
const probeSource = `${SHARED_SERVER_LIBRARIES.map((name, index) => `import * as m${index} from ${JSON.stringify(name)};`).join("\n")}
import defaultZod, { z as namedZod } from "zod";
import * as subpathZod from "zod/v3";
import * as nativeZod from "zod/v4";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const requiredZod = require("zod");
const names = ${JSON.stringify(SHARED_SERVER_LIBRARIES)};
const modules = Object.fromEntries(names.map((name, index) => [name, [${SHARED_SERVER_LIBRARIES.map((_, index) => `m${index}`).join(", ")}][index]]));
const urls = Object.fromEntries(names.map((name) => [name, import.meta.resolve(name)]));
export async function activate(context) {
  await context.api.registerPrivilegedRoutes(async (app) => {
    app.post("/validate", async (request) => namedZod.record(namedZod.number()).parse(request.body));
  }, { prefix: "/api/externals-probe" });
  const compat = {
    record: namedZod.record(namedZod.number()).parse({ a: 1 }),
    default: namedZod.object({ enabled: namedZod.boolean().default(true) }).default({}).parse(undefined),
    partial: namedZod.object({ enabled: namedZod.boolean().default(true) }).partial().parse({}),
    named: namedZod === m0.z,
    defaultExport: defaultZod === namedZod,
    v3: subpathZod.z === namedZod,
    require: requiredZod.z.record(requiredZod.z.number()).parse({ b: 2 }),
    requireSubpath: requiredZod.z === require("zod/v3").z,
    packageMajor: Number(require("zod/package.json").version.split(".")[0]),
    v4: nativeZod.z.string().parse("bundled v4 subpath"),
  };
  return context.api.registerService("externals-probe", {
    modules, urls, compat, parsed: namedZod.object({ a: namedZod.number() }).parse({ a: 1 }),
    request: (payload) => context.api.runInternalRoute({ method: "POST", url: "/api/externals-probe/validate", payload }),
  });
}
`;
const packages = [
  fixturePackage("externals-probe", probeSource, ["routes"]),
  fixturePackage("externals-transitive", `import "ws";\nexport function activate() {}\n`),
];
writeFileSync(join(dir, "capability-packages", "installed.json"), JSON.stringify({ schemaVersion: 1, packages }));

const link = join(dir, "capability-packages", "node_modules");
const linkType = process.platform === "win32" ? "junction" : "dir";
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
app.setErrorHandler(errorHandler);

async function activateProbe(label: string): Promise<ProbeService> {
  const activated = await capabilityModuleRuntime.activatePackage(app, "externals-probe");
  assert.equal(activated.readiness, "ready", label);
  assert.equal(
    realpathSync(link),
    realpathSync(serverNodeModules),
    `${label}: the dependency link points at the Engine`,
  );
  const probe = getCapabilityService<ProbeService>("externals-probe");
  assert.ok(probe, label);
  for (const name of SHARED_SERVER_LIBRARIES) {
    assert.equal(probe.urls[name], hostUrls[name], `${label}: ${name} resolves to the host's file`);
    // One module instance per URL in a process: the package holds the very namespace the host loads.
    assert.equal(probe.modules[name], await import(hostUrls[name]!), `${label}: ${name} is the host's instance`);
  }
  assert.deepEqual(probe.parsed, { a: 1 }, `${label}: the host's zod parses inside the package`);
  assert.deepEqual(
    probe.compat,
    {
      record: { a: 1 },
      default: { enabled: true },
      partial: {},
      named: true,
      defaultExport: true,
      v3: true,
      require: { b: 2 },
      requireSubpath: true,
      packageMajor: 3,
      v4: "bundled v4 subpath",
    },
    `${label}: the full legacy package ABI survives activation`,
  );
  return probe;
}

try {
  // ── A dangling link (the data folder moved to another install path) is rebuilt ──
  mkdirSync(join(dir, "capability-packages"), { recursive: true });
  symlinkSync(join(dir, "removed-install", "node_modules"), link, linkType);
  assert.ok(lstatSync(link).isSymbolicLink());
  assert.equal(
    existsSync(link),
    false,
    "precondition: existsSync is false for a dangling link, so the old check skipped it",
  );
  await activateProbe("dangling link");
  await capabilityModuleRuntime.deactivatePackage("externals-probe");

  // ── A link to an install that still exists elsewhere is rebuilt too, and its files stay ──
  const oldZod = join(dir, "old-install", "node_modules", "zod");
  mkdirSync(oldZod, { recursive: true });
  writeFileSync(
    join(oldZod, "package.json"),
    JSON.stringify({ name: "zod", version: "0.0.0", type: "module", main: "index.js" }),
  );
  writeFileSync(join(oldZod, "index.js"), "export const z = null;\n");
  rmSync(link);
  symlinkSync(join(dir, "old-install", "node_modules"), link, linkType);
  await activateProbe("link to another install");
  assert.ok(existsSync(join(oldZod, "index.js")), "relinking removes only the link, never what it pointed to");
  await capabilityModuleRuntime.deactivatePackage("externals-probe");

  // ── A transitive dependency of the Engine never resolves for a package ──
  await assert.rejects(
    () => capabilityModuleRuntime.activatePackage(app, "externals-transitive"),
    /Cannot find package 'ws'|ERR_MODULE_NOT_FOUND/,
  );

  // An upgrade retires old managed snapshots and activates unchanged installed packages again.
  const stale = join(dir, "capability-runtime-snapshots", "externals-probe-1.0.0-old");
  mkdirSync(stale, { recursive: true });
  symlinkSync(serverNodeModules, join(stale, "node_modules"), linkType);
  await capabilityModuleRuntime.start(app);
  assert.equal(existsSync(stale), false, "old direct-Engine runtime links are not reused after an upgrade");
  const upgraded = getCapabilityService<ProbeService>("externals-probe");
  assert.ok(upgraded);
  assert.deepEqual(upgraded.compat.partial, {});
  const valid = await upgraded.request({ retained: 1 });
  assert.equal(valid.statusCode, 200, valid.body);
  const invalid = await upgraded.request(
    Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`field${i}`, "do-not-echo-this-value"])),
  );
  assert.equal(invalid.statusCode, 400, invalid.body);
  assert.equal(invalid.json().details.length, 50, "legacy errors retain the Engine's bounded structured output");
  assert.equal(invalid.body.includes("do-not-echo-this-value"), false);
  assert.equal(
    Number(serverRequire("zod/package.json").version.split(".")[0]),
    4,
    "package activation never replaces core Zod 4",
  );

  const managedSnapshot = join(dir, "managed-old-snapshot");
  mkdirSync(managedSnapshot);
  symlinkSync(serverNodeModules, join(managedSnapshot, "node_modules"), linkType);
  await linkCapabilitySnapshotDependencies(managedSnapshot, serverNodeModules);
  assert.equal(
    realpathSync(join(managedSnapshot, "node_modules", "zod")),
    realpathSync(join(serverNodeModules, "zod-v3")),
  );
  assert.ok(
    existsSync(join(serverNodeModules, "zod", "package.json")),
    "repair removes only the old link, not its target",
  );

  const unknownSnapshot = join(dir, "unknown-snapshot");
  mkdirSync(join(unknownSnapshot, "node_modules"), { recursive: true });
  writeFileSync(join(unknownSnapshot, "node_modules", "keep.txt"), "kept");
  await assert.rejects(
    () => linkCapabilitySnapshotDependencies(unknownSnapshot, serverNodeModules),
    /not a managed Engine link/,
  );
  assert.equal(readFileSync(join(unknownSnapshot, "node_modules", "keep.txt"), "utf8"), "kept");

  // ── Something that is not a link is left alone ──
  const realRoot = join(dir, "real-directory-root");
  mkdirSync(join(realRoot, "node_modules"), { recursive: true });
  writeFileSync(join(realRoot, "node_modules", "keep.txt"), "kept");
  await linkCapabilityPackageDependencies(realRoot, serverNodeModules);
  assert.equal(readFileSync(join(realRoot, "node_modules", "keep.txt"), "utf8"), "kept");
  assert.equal(lstatSync(join(realRoot, "node_modules")).isSymbolicLink(), false);

  // ── A correct link is kept as it is, and a missing one is created ──
  const freshRoot = join(dir, "fresh-root");
  await linkCapabilityPackageDependencies(freshRoot, serverNodeModules);
  assert.equal(realpathSync(join(freshRoot, "node_modules")), realpathSync(serverNodeModules));
  const before = lstatSync(join(freshRoot, "node_modules")).ino;
  await linkCapabilityPackageDependencies(freshRoot, serverNodeModules);
  assert.equal(lstatSync(join(freshRoot, "node_modules")).ino, before);
} finally {
  await capabilityModuleRuntime.stop();
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log(
  "Package servers load zod, adm-zip, dotenv, nanoid and jsonrepair as the Engine's own instances; a moved install's dependency link is rebuilt.",
);
