import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// The Windows launchers must open the browser through the readiness poller, never after a fixed delay.
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const helper = readFileSync(join(root, "scripts", "open-when-ready.cmd"), "utf8");
assert.match(helper, /curl -k -s -f -o nul --max-time 3 "%URL%\/api\/health"/u, "helper polls /api/health");
assert.match(helper, /OPEN_WHEN_READY_DRY_RUN/u, "helper supports a dry run for tests");
assert.ok(helper.includes("\n"), "helper keeps line endings");
assert.doesNotMatch(helper, /\r(?!\n)/u, "helper does not contain bare carriage returns");
for (const name of ["start.bat", "start-local.bat"]) {
  const launcher = readFileSync(join(root, name), "utf8");
  assert.ok(!/timeout \/t 4 \/nobreak >nul && start/u.test(launcher), `${name} no longer opens after a fixed delay`);
  assert.match(
    launcher,
    /open-when-ready\.cmd" "%PROTOCOL%:\/\/%BROWSER_HOST%:%PORT%"/u,
    `${name} spawns the readiness poller`,
  );
  assert.ok(launcher.includes("\r\n"), `${name} keeps CRLF line endings`);
}
console.log("launcher open-when-ready regression passed");
