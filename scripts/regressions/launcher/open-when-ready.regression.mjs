import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The Windows launcher must open the browser through the readiness poller, never after a fixed delay: a fixed 4 s
// lands on a connection error while a large data folder is still loading.
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const helperPath = join(root, "scripts", "open-when-ready.cmd");
const helper = readFileSync(helperPath, "utf8");
assert.match(helper, /curl -k -s -f -o nul --max-time 3 "%URL%\/api\/health"/u, "helper polls /api/health");
assert.match(helper, /OPEN_WHEN_READY_DRY_RUN/u, "helper supports a dry run for tests");
assert.ok(helper.includes("\r\n"), "helper keeps CRLF line endings (cmd labels misbehave with LF only)");
assert.doesNotMatch(helper, /\r(?!\n)/u, "helper does not contain bare carriage returns");
const launcher = readFileSync(join(root, "start.bat"), "utf8");
assert.ok(!/timeout \/t 4 \/nobreak >nul && start/u.test(launcher), "start.bat no longer opens after a fixed delay");
assert.match(
  launcher,
  /open-when-ready\.cmd" "%PROTOCOL%:\/\/%BROWSER_HOST%:%PORT%"/u,
  "start.bat spawns the readiness poller",
);
assert.ok(launcher.includes("\r\n"), "start.bat keeps CRLF line endings");

// On Windows with curl, run the helper for real (dry run: it prints instead of opening a browser).
const hasCurl = process.platform === "win32" && spawnSync("where", ["curl"], { windowsHide: true }).status === 0;
if (hasCurl) {
  const server = createServer((request, response) => {
    response.statusCode = request.url === "/api/health" ? 200 : 404;
    response.end("{}");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const url = `http://127.0.0.1:${port}`;
    const stdout = await new Promise((resolve, reject) =>
      execFile(
        process.env.ComSpec ?? "cmd.exe",
        ["/d", "/c", helperPath, url, "10"],
        { env: { ...process.env, OPEN_WHEN_READY_DRY_RUN: "1" }, windowsHide: true, timeout: 20_000 },
        (error, out) => (error ? reject(error) : resolve(out)),
      ),
    );
    assert.match(String(stdout), new RegExp(`READY ${url}`, "u"), "the helper sees the server as ready");
  } finally {
    server.close();
  }
}

console.log("launcher open-when-ready regression passed");
