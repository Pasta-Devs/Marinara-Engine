import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, totalmem } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkClientBuild } from "../../check-client-build.mjs";
import {
  resolveClientBuildHeapMb,
  resolveDesktopClientBuildHeapMb,
  splitNodeOptions,
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

// A desktop build type-checks the client too, which needs about 2.1 GiB: more than Node's default on a
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
  write("android.mjs", 'Object.defineProperty(process, "platform", { value: "android" });');
  write("node_modules/typescript/package.json", '{"name":"typescript"}');
  write("node_modules/typescript/bin/tsc", 'require("node:fs").appendFileSync("steps", "tsc\\n");');
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
