// Windows launcher and build scripts: start.bat detects Node by running it and cleans each workspace, and the build
// and update scripts never pass an argument array through a Windows shell.
// regression-layout: source-path the scripts' own text is checked: no call site may combine an argument array
// with shell: true.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const windowsLauncherSource = readFileSync(join(REPOSITORY_ROOT, "start.bat"), "utf8");
assert.match(windowsLauncherSource, /node --version >nul 2>&1/u);
assert.doesNotMatch(windowsLauncherSource, /where node >nul 2>&1/u);
for (const workspace of ["shared", "server", "client"]) {
  assert.match(windowsLauncherSource, new RegExp(`--filter @marinara-engine/${workspace} run clean`, "u"));
}
for (const relativePath of [
  "packages/client/scripts/build.mjs",
  "packages/server/src/config/build-info.ts",
  "packages/server/src/routes/updates.routes.ts",
  "packages/server/src/services/mari-db/mari-db.service.ts",
  "scripts/check-tracked-installers.mjs",
  "scripts/ensure-native-deps.mjs",
]) {
  const source = readFileSync(join(REPOSITORY_ROOT, relativePath), "utf8");
  assert.doesNotMatch(
    source,
    /shell:\s*process\.platform\s*===\s*"win32"/u,
    `${relativePath} must not pass an argument array through shell: true on Windows`,
  );
}

// A crash inside Node.js itself exits with a negative code, which "if errorlevel 1" misses: the window then closed
// with nothing on screen. Both launchers must keep the window open for any non-zero exit.
for (const launcher of ["start.bat", "start-local.bat"]) {
  const source = readFileSync(join(REPOSITORY_ROOT, launcher), "utf8");
  const afterServer = source.slice(source.indexOf("node ../../scripts/run-server.mjs"));
  assert.match(
    afterServer,
    /set "SERVER_EXIT=%errorlevel%"\r?\nif not "%SERVER_EXIT%"=="0" \(/u,
    `${launcher} must pause on any non-zero server exit`,
  );
  assert.doesNotMatch(
    afterServer.split("goto :eof")[0],
    /if errorlevel 1/u,
    `${launcher} must not test the server exit with "if errorlevel 1"`,
  );
}
