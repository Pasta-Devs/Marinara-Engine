import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkClientBuild } from "../../check-client-build.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const fixture = mkdtempSync(join(tmpdir(), "marinara-termux-build-"));
const write = (path, content) => {
  mkdirSync(dirname(join(fixture, path)), { recursive: true });
  writeFileSync(join(fixture, path), content);
};
try {
  write("package.json", '{"type":"module"}');
  write("scripts/build.mjs", readFileSync(join(repositoryRoot, "packages/client/scripts/build.mjs"), "utf8"));
  write("node_modules/typescript/package.json", '{"name":"typescript"}');
  write("node_modules/typescript/bin/tsc", 'require("node:fs").appendFileSync("steps", "tsc\\n");');
  write("node_modules/vite/package.json", '{"name":"vite"}');
  write(
    "node_modules/vite/bin/vite.js",
    `
    const fs = require("node:fs");
    fs.appendFileSync("steps", "vite:" + (process.env.SKIP_PWA ?? "") + "\\n");
    fs.rmSync("dist", { recursive: true, force: true });
    fs.mkdirSync("dist/.vite", { recursive: true });
    fs.mkdirSync("dist/assets");
    fs.writeFileSync("dist/index.html", '<script src="/assets/index.js"></script>');
    fs.writeFileSync("dist/assets/index.js", "fixture");
    fs.writeFileSync("dist/.vite/manifest.json", JSON.stringify({ "index.html": { isEntry: true, file: "assets/index.js" } }));
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
  const env = { ...process.env, MARINARA_LOW_MEMORY_BUILD: "0" };
  delete env.SKIP_PWA;
  delete env.MARINARA_TERMUX_HEAP_MB;
  const mobile = spawnSync(
    "bash",
    [
      "-c",
      `${launcher.slice(start, end)}
    run_pnpm() {
      if [ "$*" = "--filter @marinara-engine/client build" ]; then
        node scripts/build.mjs
      elif [ "$*" = "--filter @marinara-engine/client exec vite build" ]; then
        node node_modules/vite/bin/vite.js build
      else
        return 90
      fi
    }
    build_termux_client
  `,
    ],
    { cwd: fixture, env, encoding: "utf8" },
  );
  assert.equal(mobile.status, 0, mobile.stdout + mobile.stderr);
  assert.doesNotThrow(
    () => checkClientBuild(join(fixture, "dist")),
    "the real Termux helper must produce the complete client, including guest assets",
  );
  assert.equal(
    readFileSync(join(fixture, "steps"), "utf8"),
    "vite:1\nguest\n",
    "Termux keeps its low-memory path and builds guest assets after Vite",
  );

  write("steps", "");
  const desktop = spawnSync(process.execPath, ["scripts/build.mjs"], { cwd: fixture, env, encoding: "utf8" });
  assert.equal(desktop.status, 0, desktop.stdout + desktop.stderr);
  assert.equal(
    readFileSync(join(fixture, "steps"), "utf8"),
    "tsc\nvite:\nguest\n",
    "desktop retains typechecking and ordinary PWA policy",
  );
  assert.doesNotThrow(() => checkClientBuild(join(fixture, "dist")));
  console.info("Termux and desktop client build orchestration regression passed.");
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
