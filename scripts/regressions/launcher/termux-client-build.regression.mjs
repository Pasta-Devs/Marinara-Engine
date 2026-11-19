import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir, totalmem } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkClientBuild } from "../../check-client-build.mjs";
import {
  resolveClientBuildHeapMb,
  resolveDesktopClientBuildHeapMb,
  splitNodeOptions,
  typeCheckHeapHint,
} from "../../../packages/client/scripts/build-heap.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

// The client build no longer fits in the 1 GiB heap Termux gives the server: give it 1536 MiB,
// capped at half of device memory, but never less than the 1280 MiB it needs.
const GiB = 1024 ** 3;
const buildHeap = (totalMemoryBytes, env = {}, lowMemory = true) =>
  resolveClientBuildHeapMb({ lowMemory, env, totalMemoryBytes });
assert.equal(buildHeap(8 * GiB), 1536);
assert.equal(buildHeap(3 * GiB), 1536);
assert.equal(buildHeap(2.75 * GiB), 1408);
assert.equal(buildHeap(2 * GiB), 1280, "a 2 GB phone still gets the heap the build needs");
assert.equal(buildHeap(8 * GiB, { MARINARA_EXPLICIT_NODE_HEAP: "1" }), null, "a heap the user set wins");
assert.equal(buildHeap(8 * GiB, {}, false), null, "desktop builds take their heap from the desktop rule below");

// A desktop build type-checks the client too, which needs about 2.3 GiB: more than Node's default on a
// 7 GiB machine (the macos-15 runners, about 2 GiB), so it gets 3072 MiB when half the memory allows.
const desktopHeap = (totalMemoryBytes, defaultHeapMb, env = {}, constrainedMemoryBytes = 0) =>
  resolveDesktopClientBuildHeapMb({ env, totalMemoryBytes, defaultHeapMb, constrainedMemoryBytes });
assert.equal(desktopHeap(7 * GiB, 2048), 3072, "a 7 GiB machine gets the heap the type-check needs");
assert.equal(desktopHeap(14 * GiB, 2048), 3072);
assert.equal(desktopHeap(32 * GiB, 4192), null, "a default already above it is kept, never lowered");
assert.equal(desktopHeap(4 * GiB, 2048), null, "never more than half the device's memory");
assert.equal(
  desktopHeap(7 * GiB, 2048, { NODE_OPTIONS: "--max-old-space-size=1800" }),
  null,
  "a heap the user set in NODE_OPTIONS wins",
);
assert.equal(desktopHeap(7 * GiB, 2048, { NODE_OPTIONS: "--max_old_space_size=1800" }), null, "however they spell it");
assert.equal(
  desktopHeap(7 * GiB, 2048, { NODE_OPTIONS: '--require "./hooks/--max-old-space-size.cjs"' }),
  3072,
  "the same words inside another option's value are not a heap",
);
assert.equal(
  desktopHeap(7 * GiB, 2048, { NODE_OPTIONS: "--require ./x.cjs --max-old-space-size 1800" }),
  null,
  "the flag as its own option is (Node refuses a value after a space there; the build leaves it to Node)",
);
assert.equal(
  desktopHeap(7 * GiB, 2048, { NODE_OPTIONS: '"--max-old-space-size=1024"' }),
  null,
  "and so is a quoted one, which Node reads as the same option",
);
assert.equal(
  desktopHeap(7 * GiB, 2048, { NODE_OPTIONS: "--max-old-space-size-percentage=50" }),
  null,
  "and its percentage form, which sets the heap too",
);
// In a container, half of its memory limit, not of the machine's.
assert.equal(desktopHeap(32 * GiB, 2048, {}, 4 * GiB), null, "a 4 GiB container never gets more than 2 GiB");
assert.equal(desktopHeap(32 * GiB, 2048, {}, 8 * GiB), 3072, "an 8 GiB container gets the heap the build needs");
assert.equal(desktopHeap(7 * GiB, 2048, {}, 2 ** 62), 3072, "a limit above the machine's memory is no limit");
// NODE_OPTIONS read as Node reads it: quotes group an option, spaces included, and a backslash inside
// them keeps the next character.
assert.deepEqual(splitNodeOptions('--require "./my hooks/x.cjs"  --max-old-space-size=900'), [
  "--require",
  "./my hooks/x.cjs",
  "--max-old-space-size=900",
]);
assert.deepEqual(splitNodeOptions('"--title=a \\"b\\""'), ['--title=a "b"']);
assert.deepEqual(splitNodeOptions('  ""  '), [""], "an empty quoted option is still one");
assert.deepEqual(splitNodeOptions(""), []);

// A heap the user set is kept even when the type-check (2304 MiB) does not fit in it, so a type-check
// that ran out of memory under it says how to fix it: SIGABRT, or exit code 134 on Windows.
const hint = (env, result = { status: null, signal: "SIGABRT" }, heapLimitMb = 3072) =>
  typeCheckHeapHint({ ...result, env, heapLimitMb });
assert.match(hint({ NODE_OPTIONS: "--max-old-space-size=2048" }), /about 2\.5 GiB.*limits it to 2048 MiB.*2560/u);
assert.match(hint({ NODE_OPTIONS: "--max-old-space-size=2048" }, { status: 134, signal: null }), /2048 MiB/u);
assert.match(
  hint({ NODE_OPTIONS: '--require ./x.cjs "--max_old_space_size=1800"' }),
  /1800 MiB/u,
  "however it is spelt",
);
assert.match(
  hint({ NODE_OPTIONS: "--max-old-space-size=4096 --max-old-space-size=2048" }),
  /2048 MiB/u,
  "Node reads the last one",
);
assert.equal(hint({ NODE_OPTIONS: "--max-old-space-size=2048 --max-old-space-size=4096" }), null);
assert.equal(hint({ NODE_OPTIONS: "--max-old-space-size=2304" }), null, "a heap the type-check fits in is not blamed");
assert.equal(hint({}), null, "without a heap the user set, the build chose the heap");
assert.equal(hint({ NODE_OPTIONS: "--max-old-space-size-percentage=50" }), null);
for (const NODE_OPTIONS of [
  "--max-old-space-size-percentage=1",
  "--max-old-space-size=4096 --max-old-space-size-percentage=1",
  "--max-old-space-size-percentage=1 --max-old-space-size=4096",
  "--max_old_space_size_percentage=1",
  "--max-old-space-size-percentage 1",
]) {
  assert.match(
    hint({ NODE_OPTIONS }, undefined, 512),
    /limits it to 512 MiB with --max-old-space-size-percentage.*Raise that percentage/u,
    "a percentage limit uses Node's resolved heap and advice for the effective flag",
  );
}
for (const NODE_OPTIONS of [
  "--max-old-space-size=1024 --max-old-space-size-percentage=50",
  "--max-old-space-size-percentage=50 --max-old-space-size=1024",
]) {
  assert.equal(hint({ NODE_OPTIONS }), null, "an ineffective small absolute limit is not blamed");
}
assert.equal(hint({ NODE_OPTIONS: "--max-old-space-size-percentage=1" }, undefined, 2304), null);
assert.equal(
  hint({ NODE_OPTIONS: "--max-old-space-size-percentage=1" }, { status: 2, signal: null }, 512),
  null,
  "a percentage limit does not turn a type error into a heap failure",
);
assert.equal(
  hint({ NODE_OPTIONS: "--max-old-space-size-percentage=1" }, { status: null, signal: "SIGTERM" }, 512),
  null,
  "a different terminating signal is not a heap failure",
);
assert.equal(
  hint({ NODE_OPTIONS: "--max-old-space-size=2048" }, { status: 2, signal: null }),
  null,
  "type errors are not a heap problem",
);

const fixture = mkdtempSync(join(tmpdir(), "marinara-termux-build-"));
const write = (path, content) => {
  mkdirSync(dirname(join(fixture, path)), { recursive: true });
  writeFileSync(join(fixture, path), content);
};
// What V8 reports for a given limit, to compare with the heap the fixture's Vite ran under.
const heapLimitFor = (mb) =>
  spawnSync(
    process.execPath,
    [`--max-old-space-size=${mb}`, "-p", 'require("node:v8").getHeapStatistics().heap_size_limit'],
    { encoding: "utf8" },
  ).stdout.trim();
try {
  write("package.json", '{"type":"module"}');
  for (const script of ["build.mjs", "build-heap.mjs"]) {
    write(`scripts/${script}`, readFileSync(join(repositoryRoot, "packages/client/scripts", script), "utf8"));
  }
  // An arm64 phone, whatever this machine is (x86_64 Android is covered further down).
  write(
    "android.mjs",
    'Object.defineProperty(process, "platform", { value: "android" });\nObject.defineProperty(process, "arch", { value: "arm64" });',
  );
  write("node_modules/typescript/package.json", '{"name":"typescript"}');
  // Exits as V8 does on Windows when it runs out of heap, when the fixture asks it to.
  write(
    "node_modules/typescript/bin/tsc",
    'require("node:fs").appendFileSync("steps", "tsc\\n"); if (process.env.FIXTURE_TSC_OOM) process.exit(134);',
  );
  write("node_modules/vite/package.json", '{"name":"vite"}');
  // Stands in for `vite build` loading vite.config.ts, whose android-build-heap plugin calls the
  // same helper, and records the heap the build ran with.
  write(
    "node_modules/vite/bin/vite.js",
    `
    import("../../../scripts/build-heap.mjs").then(({ delegateDirectAndroidBuild }) => {
      delegateDirectAndroidBuild();
      const fs = require("node:fs");
      const heap = require("node:v8").getHeapStatistics().heap_size_limit;
      fs.appendFileSync("steps", "vite:" + (process.env.SKIP_PWA ?? "") + ":" + heap + "\\n");
      fs.rmSync("dist", { recursive: true, force: true });
      fs.mkdirSync("dist/.vite", { recursive: true });
      fs.mkdirSync("dist/assets");
      fs.writeFileSync("dist/index.html", '<script src="/assets/index.js"></script>');
      fs.writeFileSync("dist/assets/index.js", "fixture");
      fs.writeFileSync("dist/.vite/manifest.json", JSON.stringify({ "index.html": { isEntry: true, file: "assets/index.js" } }));
    });
  `,
  );
  write(
    "scripts/build-multiplayer-guest.mjs",
    `
    import * as fs from "node:fs";
    fs.appendFileSync("steps", "guest\\n");
    fs.mkdirSync("dist/multiplayer", { recursive: true });
    for (const file of ["guest.js", "guest.css"]) fs.writeFileSync("dist/multiplayer/" + file, "fixture");
  `,
  );
  const launcher = readFileSync(join(repositoryRoot, "start-termux.sh"), "utf8");
  const start = launcher.indexOf("build_termux_client() (");
  const end = launcher.indexOf("\nload_launcher_setting()", start);
  assert(start >= 0 && end > start);
  // Every path starts under the server heap Termux gives most phones.
  const serverHeap = "--max-old-space-size=1024";
  const android = `--import=${pathToFileURL(join(fixture, "android.mjs")).href}`;
  const baseEnv = { ...process.env, MARINARA_LOW_MEMORY_BUILD: "0", NODE_OPTIONS: serverHeap };
  for (const name of ["SKIP_PWA", "MARINARA_EXPLICIT_NODE_HEAP", "MARINARA_CLIENT_BUILD_SCRIPT"]) delete baseEnv[name];
  const raisedHeap = heapLimitFor(buildHeap(totalmem()));
  const serverHeapLimit = heapLimitFor(1024);
  const build = (label, command, args, env, expectedSteps) => {
    write("steps", "");
    rmSync(join(fixture, "dist"), { recursive: true, force: true });
    const result = spawnSync(command, args, { cwd: fixture, env: { ...baseEnv, ...env }, encoding: "utf8" });
    assert.equal(result.status, 0, `${label}: ${result.stdout}${result.stderr}`);
    assert.equal(readFileSync(join(fixture, "steps"), "utf8"), expectedSteps, label);
  };
  const termuxLauncherScript = `${launcher.slice(start, end)}
    run_pnpm() {
      if [ "$*" = "--filter @marinara-engine/client build" ]; then node scripts/build.mjs; else return 90; fi
    }
    build_termux_client
  `;

  build("Termux launcher", "bash", ["-c", termuxLauncherScript], {}, `vite:1:${raisedHeap}\nguest\n`);
  assert.doesNotThrow(
    () => checkClientBuild(join(fixture, "dist")),
    "the real Termux helper must produce the complete client, including guest assets",
  );
  build(
    "Termux launcher with a heap the user set",
    "bash",
    ["-c", termuxLauncherScript],
    { MARINARA_EXPLICIT_NODE_HEAP: "1" },
    `vite:1:${serverHeapLimit}\nguest\n`,
  );

  // The in-app updater runs `pnpm --filter @marinara-engine/client build` on Android under the
  // server's environment, so the build script itself must raise the heap.
  const updates = readFileSync(join(repositoryRoot, "packages/server/src/routes/updates.routes.ts"), "utf8");
  assert.match(
    updates,
    /if \(process\.platform === "android"\) \{[\s\S]{0,200}runPinnedPnpm\(root, \["--filter", "@marinara-engine\/client", "build"\]/u,
    "the Android in-app update must build the client through its build script",
  );
  build(
    "in-app update on Android",
    process.execPath,
    ["scripts/build.mjs"],
    { NODE_OPTIONS: `${android} ${serverHeap}` },
    `vite:1:${raisedHeap}\nguest\n`,
  );
  assert.doesNotThrow(() => checkClientBuild(join(fixture, "dist")));

  // The v2.4.6 launcher keeps running after updating itself and runs `vite build` directly.
  const viteConfig = readFileSync(join(repositoryRoot, "packages/client/vite.config.ts"), "utf8");
  assert.match(
    viteConfig,
    /name: "android-build-heap", apply: "build", config: \(\) => delegateDirectAndroidBuild\(\)/u,
  );
  assert.match(viteConfig, /plugins: \[\s*androidBuildHeap\(\),/u);
  build(
    "v2.4.6 Termux launcher after updating",
    process.execPath,
    ["node_modules/vite/bin/vite.js", "build"],
    { NODE_OPTIONS: `${android} ${serverHeap}`, SKIP_PWA: "1" },
    `vite:1:${raisedHeap}\nguest\n`,
  );
  assert.doesNotThrow(
    () => checkClientBuild(join(fixture, "dist")),
    "the old launcher's first build after updating must produce the complete client",
  );

  build("desktop", process.execPath, ["scripts/build.mjs"], {}, `tsc\nvite::${serverHeapLimit}\nguest\n`);
  assert.doesNotThrow(() => checkClientBuild(join(fixture, "dist")), "desktop retains typechecking and PWA policy");
  // A desktop type-check that runs out of a heap the user set says how to fix it.
  write("steps", "");
  const outOfMemory = spawnSync(process.execPath, ["scripts/build.mjs"], {
    cwd: fixture,
    env: { ...baseEnv, NODE_OPTIONS: "--max-old-space-size=2048", FIXTURE_TSC_OOM: "1" },
    encoding: "utf8",
  });
  assert.equal(outOfMemory.status, 134, "the build stops with the type-check's status");
  assert.equal(readFileSync(join(fixture, "steps"), "utf8"), "tsc\n", "and runs nothing after it");
  assert.match(outOfMemory.stderr, /^\[build\] The client type-check needs about 2\.5 GiB .* 2048 MiB\./mu);
  build(
    "desktop direct vite build",
    process.execPath,
    ["node_modules/vite/bin/vite.js", "build"],
    {},
    `vite::${serverHeapLimit}\n`,
  );
  console.info("Termux, in-app update, old launcher and desktop client build regression passed.");
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

// #9482: x86_64 Android (Chromebooks, BlueStacks and other Android on PCs) has no native build of three packages the
// client build loads, so each falls back to WebAssembly there: rolldown (Vite's bundler) and Tailwind's oxide load
// their WASI bindings on their own; lightningcss requires `lightningcss-android-x64`, which the client installs as an
// alias of lightningcss's WebAssembly build. The client installs both missing pieces at their packages' versions.
const clientRequire = createRequire(join(repositoryRoot, "packages/client/package.json"));
const rolldownEntry = createRequire(clientRequire.resolve("vite")).resolve("rolldown");
const tailwindNodeRequire = createRequire(
  createRequire(clientRequire.resolve("@tailwindcss/vite")).resolve("@tailwindcss/node"),
);
const lightningcssEntry = tailwindNodeRequire.resolve("lightningcss");
const oxideEntry = tailwindNodeRequire.resolve("@tailwindcss/oxide");
// A package's version, read from the package.json above its entry (some packages don't export package.json).
const versionFrom = (from, name) => {
  for (let dir = dirname(createRequire(from).resolve(name)); ; dir = dirname(dir)) {
    const manifest = join(dir, "package.json");
    if (existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).name === name) {
      return JSON.parse(readFileSync(manifest, "utf8")).version;
    }
    assert.notEqual(dirname(dir), dir, `no package.json for ${name}`);
  }
};
assert.equal(
  versionFrom(rolldownEntry, "@rolldown/binding-wasm32-wasi"),
  versionFrom(rolldownEntry, "rolldown"),
  "the rolldown WebAssembly binding the client installs must match the rolldown Vite uses",
);
assert.equal(
  versionFrom(createRequire(lightningcssEntry).resolve("lightningcss-android-x64"), "lightningcss-wasm"),
  versionFrom(lightningcssEntry, "lightningcss"),
  "the lightningcss WebAssembly build behind lightningcss-android-x64 must match the lightningcss Tailwind uses",
);
// #9530: no dependency may be a local folder. pnpm copies a folder dependency into .pnpm with hard links and does not
// fall back to copying files when that fails. Android does not let apps create hard links, so on every Termux install the
// whole `pnpm install` stops with "Permission denied". Registry packages install there as normal.
const lockfile = readFileSync(join(repositoryRoot, "pnpm-lock.yaml"), "utf8");
assert.deepEqual(
  lockfile.match(/resolution: \{directory: [^}]*\}/gu) ?? [],
  [],
  "a local folder dependency stops `pnpm install` on Android; publish it or alias a registry package instead",
);
// Runs each package the way x86_64 Termux does: Node reports android/x64, so no native build loads.
const x64Fixture = mkdtempSync(join(tmpdir(), "marinara-android-x64-"));
try {
  writeFileSync(
    join(x64Fixture, "android-x64.mjs"),
    'Object.defineProperty(process, "platform", { value: "android" });\nObject.defineProperty(process, "arch", { value: "x64" });\n',
  );
  writeFileSync(join(x64Fixture, "dep.js"), "export const answer = 6 * 7;\n");
  writeFileSync(join(x64Fixture, "entry.js"), 'import { answer } from "./dep.js";\nconsole.log(answer);\n');
  // One process per tool: each loads its WebAssembly as it does inside the build. Their WebAssembly reaches only files
  // under the folder they start in, as build.mjs arranges below.
  const asX64Android = (label, script) => {
    const result = spawnSync(
      process.execPath,
      [`--import=${pathToFileURL(join(x64Fixture, "android-x64.mjs")).href}`, "-"],
      {
        // CommonJS, as a build calls these from its plugins: oxide's WebAssembly scanner deadlocks when an ES module
        // calls it while still being evaluated, before its worker threads have started.
        input: `(async () => {\n${script}\n})().catch((error) => {\n  console.error(error);\n  process.exit(1);\n});`,
        cwd: x64Fixture,
        encoding: "utf8",
        timeout: 60_000,
        killSignal: "SIGKILL",
      },
    );
    assert.equal(result.status, 0, `${label} did not run as on x86_64 Android:\n${result.stderr}`);
    return result.stdout;
  };
  const bundled = asX64Android(
    "rolldown",
    `const { rolldown } = await import(${JSON.stringify(pathToFileURL(rolldownEntry).href)});
    const bundle = await rolldown({ input: ${JSON.stringify(join(x64Fixture, "entry.js"))}, logLevel: "silent" });
    const { output } = await bundle.generate({ format: "esm" });
    await bundle.close();
    process.stdout.write(output[0].code);`,
  );
  // rolldown resolves the import and folds dep.js's 6 * 7 into the entry.
  assert.match(bundled, /console\.log\(42\)/u, "rolldown bundles with its WebAssembly binding");
  const minified = asX64Android(
    "lightningcss",
    `const { code } = require(${JSON.stringify(lightningcssEntry)}).transform({
      filename: "fixture.css",
      code: Buffer.from(".a {\\n  color: #ff0000;\\n}\\n"),
      minify: true,
    });
    process.stdout.write(Buffer.from(code).toString());`,
  );
  assert.equal(minified, ".a{color:red}", "lightningcss minifies with its WebAssembly build");
  const candidates = JSON.parse(
    asX64Android(
      "Tailwind's oxide",
      `const { Scanner } = require(${JSON.stringify(oxideEntry)});
      const found = new Scanner({}).getCandidatesWithPositions({ content: '<div class="flex p-4">', extension: "html" });
      process.stdout.write(JSON.stringify(found.map((candidate) => candidate.candidate)));`,
    ),
  );
  assert.deepEqual(
    candidates.filter((candidate) => ["flex", "p-4"].includes(candidate)).sort(),
    ["flex", "p-4"],
    "Tailwind's oxide finds class names with its WebAssembly binding",
  );
} finally {
  rmSync(x64Fixture, { recursive: true, force: true });
}

// Which is why build.mjs starts Vite and the guest build from the workspace root on x86_64 Android, where the client's
// dependencies (the workspace's .pnpm folder) are inside, and from the package everywhere else.
const workspace = mkdtempSync(join(tmpdir(), "marinara-build-cwd-"));
try {
  const client = join(workspace, "packages/client");
  const put = (path, content) => {
    mkdirSync(dirname(join(client, path)), { recursive: true });
    writeFileSync(join(client, path), content);
  };
  put("package.json", '{"type":"module"}');
  for (const script of ["build.mjs", "build-heap.mjs"]) {
    put(`scripts/${script}`, readFileSync(join(repositoryRoot, "packages/client/scripts", script), "utf8"));
  }
  put("node_modules/typescript/package.json", '{"name":"typescript"}');
  put("node_modules/typescript/bin/tsc", "");
  put("node_modules/vite/package.json", '{"name":"vite"}');
  // Each child records where it started and what it was given.
  const record = (name) =>
    `require("node:fs").appendFileSync(process.env.FIXTURE_RECORD, JSON.stringify({ name: ${JSON.stringify(name)}, cwd: process.cwd(), args: process.argv.slice(2) }) + "\\n");`;
  put("node_modules/vite/bin/vite.js", record("vite"));
  put(
    "scripts/build-multiplayer-guest.mjs",
    `import { createRequire } from "node:module"; const require = createRequire(import.meta.url); ${record("guest")}`,
  );
  const runAs = (arch) => {
    const preload = join(workspace, `android-${arch}.mjs`);
    writeFileSync(
      preload,
      `Object.defineProperty(process, "platform", { value: "android" });\nObject.defineProperty(process, "arch", { value: ${JSON.stringify(arch)} });\n`,
    );
    const recordFile = join(workspace, `record-${arch}`);
    writeFileSync(recordFile, "");
    const env = { ...process.env, FIXTURE_RECORD: recordFile, NODE_OPTIONS: `--import=${pathToFileURL(preload).href}` };
    for (const name of ["SKIP_PWA", "MARINARA_EXPLICIT_NODE_HEAP", "MARINARA_CLIENT_BUILD_SCRIPT"]) delete env[name];
    const built = spawnSync(process.execPath, [join(client, "scripts/build.mjs")], {
      cwd: client,
      env,
      encoding: "utf8",
    });
    assert.equal(built.status, 0, `${arch}: ${built.stdout}${built.stderr}`);
    return readFileSync(recordFile, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  };
  const sameDir = (actual, expected) => assert.equal(realpathSync(actual), realpathSync(expected));
  const [x64Vite, x64Guest] = runAs("x64");
  assert.deepEqual([x64Vite.name, x64Guest.name], ["vite", "guest"]);
  sameDir(x64Vite.cwd, workspace);
  sameDir(x64Guest.cwd, workspace);
  assert.equal(x64Vite.args[0], "build");
  sameDir(x64Vite.args[1], client);
  const [armVite, armGuest] = runAs("arm64");
  sameDir(armVite.cwd, client);
  sameDir(armGuest.cwd, client);
  sameDir(armVite.args[1], client);
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
console.info("x86_64 Android client build tools regression passed.");
