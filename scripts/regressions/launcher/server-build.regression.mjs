import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// #6984: one built server file damaged after its build stopped every start, and rebuilds kept the damage.
// A one-module copy of the server package runs through the real launcher, build and metadata scripts.
// It lives under the ignored .tmp folder so the build resolves the repository's TypeScript.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
mkdirSync(join(repo, ".tmp"), { recursive: true });
const root = mkdtempSync(join(repo, ".tmp", "server-build-regression-"));
const server = join(root, "packages", "server");
const put = (file, content) => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
};
const read = (file) => readFileSync(join(server, file), "utf8");
const damage = (file) => writeFileSync(join(server, file), "if(, raw) { }\n"); // the line from the report
const build = () => spawnSync(process.execPath, ["scripts/build.mjs"], { cwd: server, encoding: "utf8" });
const start = (entry = "dist/index.js") =>
  spawnSync(process.execPath, ["../../scripts/run-server.mjs", entry], { cwd: server, encoding: "utf8" });
const assertBuilt = (result) => assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

try {
  for (const file of [
    "scripts/run-server.mjs",
    "packages/server/scripts/build.mjs",
    "packages/server/scripts/write-build-meta.mjs",
  ]) {
    put(file, readFileSync(join(repo, file)));
  }
  put("packages/server/package.json", '{ "type": "module" }\n');
  put(
    "packages/server/tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        composite: true,
        outDir: "dist",
        rootDir: "src",
        module: "NodeNext",
        target: "ES2022",
        types: [],
      },
      include: ["src/**/*.ts"],
    }),
  );
  put("packages/server/src/db/default-preset.json", "{}\n");
  put("packages/server/src/db/novel-preset.json", "{}\n");
  put("packages/server/src/runtime.ts", "export const ready = (raw: string) => `${raw} started`;\n");
  put("packages/server/src/index.ts", 'import { ready } from "./runtime.js";\nconsole.log(ready("fixture server"));\n');

  assertBuilt(build());
  const runtime = read("dist/runtime.js");
  const entry = read("dist/index.js");

  // The launchers' start: a damaged or deleted module is named in the terminal and rebuilt, and the server starts.
  let result;
  for (const harm of [damage, (file) => rmSync(join(server, file))]) {
    harm("dist/runtime.js");
    result = start();
    assertBuilt(result);
    assert.match(result.stderr, /\[WARN\].*dist\/runtime\.js/);
    assert.match(result.stdout, /fixture server started/);
    assert.equal(read("dist/runtime.js"), runtime);
  }

  // The Windows installer and in-app updates rebuild without cleaning first. That rebuild must
  // rewrite a damaged file and a deleted one instead of trusting tsc's saved state.
  damage("dist/runtime.js");
  rmSync(join(server, "dist", "index.js"));
  assertBuilt(build());
  assert.equal(read("dist/runtime.js"), runtime);
  assert.equal(read("dist/index.js"), entry);

  // Starting a private build that another tool made leaves the launchers' build alone, even a changed one:
  // a live engine may be running from it.
  cpSync(join(server, "dist"), join(server, "dist-private"), { recursive: true });
  damage("dist/runtime.js");
  result = start("dist-private/index.js");
  assertBuilt(result);
  assert.match(result.stdout, /fixture server started/);
  assert.doesNotMatch(result.stderr, /\[WARN\]/);
  assert.notEqual(read("dist/runtime.js"), runtime);

  // A build from before hashes were recorded (the reported install) cannot be checked at start,
  // so it starts as before; the next build, such as an update's, writes every file again.
  writeFileSync(join(server, "dist", "config", "build-meta.json"), '{ "commit": null }\n');
  damage("dist/runtime.js");
  result = start();
  assert.match(result.stderr, /SyntaxError/);
  assert.doesNotMatch(result.stderr, /\[WARN\]/);
  assertBuilt(build());
  assert.equal(read("dist/runtime.js"), runtime);
  assertBuilt(start());

  // A build with type errors fails, but tsc still wrote every file. The next start runs them instead of calling
  // them damaged. The failed build records no commit, so the launchers still build again.
  appendFileSync(join(server, "src", "runtime.ts"), 'export const typeError: number = "text";\n');
  result = build();
  assert.equal(result.status, 2, `${result.stdout}\n${result.stderr}`);
  result = start();
  assertBuilt(result);
  assert.doesNotMatch(result.stderr, /\[WARN\]/);
  assert.equal(JSON.parse(read("dist/config/build-meta.json")).commit, null);

  // A stop sent only to the launcher during its repair build (as a supervisor sends it) ends the build and its
  // tsc right away, and the server does not start. A tsc that waits stands in for a slow build. Windows has no
  // such signal; console Ctrl+C reaches every process there.
  if (process.platform !== "win32") {
    const tscPidFile = join(root, "tsc.pid");
    put("packages/server/node_modules/typescript/package.json", '{ "name": "typescript" }\n');
    put(
      "packages/server/node_modules/typescript/bin/tsc",
      `require("node:fs").writeFileSync(${JSON.stringify(tscPidFile)}, String(process.pid));\nsetTimeout(() => {}, 60_000);\n`,
    );
    damage("dist/runtime.js");
    const launcher = spawn(process.execPath, ["../../scripts/run-server.mjs", "dist/index.js"], { cwd: server });
    let output = "";
    launcher.stdout.on("data", (chunk) => (output += chunk));
    launcher.stderr.on("data", (chunk) => (output += chunk));
    const exited = new Promise((resolve) => launcher.once("exit", resolve));
    const closed = new Promise((resolve) => launcher.once("close", resolve));
    const isRunning = (pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };
    let tscPid;
    try {
      for (let waited = 0; !existsSync(tscPidFile); waited += 50) {
        assert.ok(waited < 30_000, `The repair build never started tsc.\n${output}`);
        await sleep(50);
      }
      tscPid = Number(readFileSync(tscPidFile, "utf8"));
      launcher.kill("SIGTERM");
      const status = await Promise.race([exited, sleep(10_000, "still running", { ref: false })]);
      assert.equal(status, 130, output);
      for (let waited = 0; isRunning(tscPid); waited += 50) {
        assert.ok(waited < 5_000, "tsc kept running after the launcher stopped.");
        await sleep(50);
      }
      await closed; // all output is in once nothing holds the launcher's pipes
      assert.doesNotMatch(output, /fixture server started|\[ERROR\]/);
    } finally {
      launcher.kill("SIGKILL");
      if (tscPid && isRunning(tscPid)) process.kill(tscPid, "SIGKILL");
    }
  }

  console.info("Damaged server build repair regression passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
  try {
    rmdirSync(join(repo, ".tmp")); // only when nothing else is in it
  } catch {}
}
