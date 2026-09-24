import assert from "node:assert/strict";
import { spawnSync, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";

// Settings > Advanced > Features "Minimize the console to the system tray" (consoleTray). OFF (default)
// is the standard behaviour: no helper, console untouched. ON starts a hidden PowerShell helper on
// Windows that shows a tray icon and hides the console while it is minimized. MARINARA_CONSOLE_TRAY
// wins both ways.
// Other platforms: a no-op, reported as unavailable. No real helper is started here: a fake spawner
// records what the server would run.
process.env.LOG_LEVEL = "silent";
delete process.env.MARINARA_CONSOLE_TRAY;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path: string) => readFileSync(path, "utf8");
const features = await import("../../packages/server/src/services/features/feature-settings.js");
const tray = await import("../../packages/server/src/services/console-tray/console-tray.service.js");
const { isFeatureEnabled, resetFeatureSettingsForTests, featureUnavailable, notifyFeatureSettingsChange } = features;

// ── default OFF, env override both ways ──
resetFeatureSettingsForTests();
assert.equal(isFeatureEnabled("consoleTray"), false, "the switch defaults off");
process.env.MARINARA_CONSOLE_TRAY = "1";
assert.equal(isFeatureEnabled("consoleTray"), true, "env 1 beats the default off");
assert.deepEqual(features.featureEnvOverrides(), { consoleTray: "MARINARA_CONSOLE_TRAY" });
assert.equal(features.featureEnvEffective().consoleTray, true);
resetFeatureSettingsForTests({ consoleTray: true });
process.env.MARINARA_CONSOLE_TRAY = "0";
assert.equal(isFeatureEnabled("consoleTray"), false, "env 0 beats a saved on");
process.env.MARINARA_CONSOLE_TRAY = "";
assert.equal(isFeatureEnabled("consoleTray"), true, "a blank variable falls through to the saved value");
delete process.env.MARINARA_CONSOLE_TRAY;
assert.equal(isFeatureEnabled("consoleTray"), true, "unset falls through to the saved value");
resetFeatureSettingsForTests();

// ── server wiring: started after listen, stopped alongside the graceful close ──
const serverIndex = readFileSync(join(repoRoot, "packages", "server", "src", "index.ts"), "utf8");
assert.match(serverIndex, /startConsoleTrayService\(\{[\s\S]{0,200}onQuit: \(\) => void shutdown\("SIGINT"\)/);
assert.match(serverIndex, /const trayStopped = stopConsoleTrayService\(\);/);
assert.match(read(join(repoRoot, "docs", "CONFIGURATION.md")), /`MARINARA_CONSOLE_TRAY`/, "the env var is documented");

// ── platform availability ──
assert.deepEqual(featureUnavailable("win32"), {}, "available on Windows");
assert.deepEqual(featureUnavailable("linux"), { consoleTray: "windowsOnly" });
assert.deepEqual(featureUnavailable("darwin"), { consoleTray: "windowsOnly" });

// ── browser address: the real port, wildcard hosts become 127.0.0.1 like start.bat ──
assert.equal(tray.consoleTrayBrowserUrl("http", "0.0.0.0", 7860), "http://127.0.0.1:7860");
assert.equal(tray.consoleTrayBrowserUrl("http", "::", 7871), "http://127.0.0.1:7871");
assert.equal(tray.consoleTrayBrowserUrl("https", "192.168.1.5", 8443), "https://192.168.1.5:8443");
assert.equal(tray.consoleTrayBrowserUrl("http", "::1", 7860), "http://[::1]:7860");
assert.equal(tray.consoleTrayBrowserUrl("http", "", 7860), "http://127.0.0.1:7860");

// ── the helper script ships with the server ──
const scriptPath = tray.resolveConsoleTrayScriptPath();
assert.ok(existsSync(scriptPath), `helper script at ${scriptPath}`);
assert.equal(scriptPath, join(repoRoot, "packages", "server", "src", "assets", "console-tray.ps1"));
const script = readFileSync(scriptPath, "utf8");
assert.ok(!/[^\x00-\x7F]/.test(script), "the script is plain ASCII (Windows PowerShell reads it without a BOM)");
for (const needle of [
  "IsIconic",
  "NotifyIcon",
  "Open Marinara",
  "Quit Marinara",
  "PseudoConsoleWindow",
  "HasExited",
  "Start-Watchdog",
]) {
  assert.ok(script.includes(needle), `script handles ${needle}`);
}
const buildScript = readFileSync(join(repoRoot, "packages", "server", "scripts", "build.mjs"), "utf8");
assert.match(
  buildScript,
  /cpSync\(resolve\(SRC_DIR, "assets"\), resolve\(DIST_DIR, "assets"\)/,
  "the build copies src/assets to dist/assets",
);
const distService = join(repoRoot, "packages", "server", "dist", "services", "console-tray", "console-tray.service.js");
if (existsSync(distService)) {
  assert.ok(
    existsSync(join(repoRoot, "packages", "server", "dist", "assets", "console-tray.ps1")),
    "a built dist has the helper",
  );
}
if (process.platform === "win32") {
  const parse = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `$e=$null;$t=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${scriptPath.replace(/'/g, "''")}',[ref]$t,[ref]$e);$e.Count`,
    ],
    { encoding: "utf8", windowsHide: true, timeout: 20_000 },
  );
  if (parse.status === 0) assert.equal(parse.stdout.trim(), "0", "the helper script parses");
}

// ── fake helper ──
type FakeChild = ChildProcess & { stdinText: string; emitLine(line: string): void; exitNow(code?: number): void };
const spawned: Array<{ command: string; args: string[]; options: Record<string, unknown>; child: FakeChild }> = [];
function fakeSpawn(command: string, args: string[], options: Record<string, unknown>): ChildProcess {
  const child = new EventEmitter() as FakeChild;
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  Object.assign(child, {
    stdin,
    stdout,
    stderr: new PassThrough(),
    pid: 40_000 + spawned.length,
    exitCode: null,
    signalCode: null,
    stdinText: "",
    kill() {
      child.exitNow(1);
      return true;
    },
    emitLine(line: string) {
      stdout.write(`${line}\n`);
    },
    exitNow(code = 0) {
      if (child.exitCode !== null) return;
      (child as { exitCode: number | null }).exitCode = code;
      child.emit("exit", code, null);
    },
  });
  stdin.on("data", (chunk: Buffer) => {
    child.stdinText += chunk.toString();
    if (child.stdinText.includes("stop\n")) setImmediate(() => child.exitNow(0));
  });
  spawned.push({ command, args, options, child });
  return child;
}
const tick = () => new Promise((r) => setTimeout(r, 20));

// Non-Windows: nothing is spawned, whatever the switch says (process.platform mocked).
const realPlatform = Object.getOwnPropertyDescriptor(process, "platform")!;
Object.defineProperty(process, "platform", { value: "linux" });
try {
  resetFeatureSettingsForTests({ consoleTray: true });
  const linux = new tray.ConsoleTrayController({ url: "http://127.0.0.1:1", port: 1, onQuit() {}, spawn: fakeSpawn });
  linux.sync();
  assert.equal(spawned.length, 0, "no helper off Windows");
  assert.equal(linux.getState(), "off");
  assert.deepEqual(featureUnavailable(), { consoleTray: "windowsOnly" }, "the features response marks it unavailable");
} finally {
  Object.defineProperty(process, "platform", realPlatform);
}

// Windows (injected), switch off (the default): nothing is spawned.
resetFeatureSettingsForTests();
const idle = new tray.ConsoleTrayController({
  url: "http://127.0.0.1:1",
  port: 1,
  onQuit() {},
  platform: "win32",
  spawn: fakeSpawn,
});
idle.sync();
assert.equal(spawned.length, 0, "switch off: no helper, console untouched");
assert.equal(idle.getState(), "off");

// Windows (injected): the service follows the switch at runtime, no restart.
let quits = 0;
resetFeatureSettingsForTests({ consoleTray: true });
const controller = tray.startConsoleTrayService({
  url: "http://127.0.0.1:7871",
  port: 7871,
  onQuit: () => quits++,
  platform: "win32",
  spawn: fakeSpawn,
  iconPath: "C:\\icons\\app-icon.ico",
  parentPid: 4242,
})!;
assert.ok(controller, "service started");
assert.equal(spawned.length, 1, "switch on at startup: helper spawned");
const first = spawned[0];
assert.match(first.command, /powershell\.exe$/i);
for (const flag of ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-File"]) {
  assert.ok(first.args.includes(flag), `helper flag ${flag}`);
}
assert.equal(first.args[first.args.indexOf("-File") + 1], scriptPath);
assert.equal(first.args[first.args.indexOf("-ParentPid") + 1], "4242");
assert.equal(first.args[first.args.indexOf("-Url") + 1], "http://127.0.0.1:7871");
assert.equal(first.args[first.args.indexOf("-Port") + 1], "7871");
assert.equal(first.args[first.args.indexOf("-IconPath") + 1], "C:\\icons\\app-icon.ico");
assert.equal(first.options.windowsHide, true);
assert.notEqual(first.options.detached, true, "a detached PowerShell with piped stdio exits at once");
assert.deepEqual(first.options.stdio, ["pipe", "pipe", "pipe"], "no inherited stdio, so the helper gets no console");
first.child.emitLine("ready hide");
await tick();
assert.equal(controller.getState(), "running");

// A repeated sync (any other save) does not start a second helper.
notifyFeatureSettingsChange();
assert.equal(spawned.length, 1);

// Quit in the tray menu runs the server's graceful shutdown callback.
first.child.emitLine("quit");
await tick();
assert.equal(quits, 1, "quit reaches the shutdown callback");

// Switch OFF at runtime: the helper is told to stop (it restores the console) and exits.
resetFeatureSettingsForTests();
await tick();
assert.ok(first.child.stdinText.includes("stop\n"), "stop sent");
assert.notEqual(first.child.exitCode, null, "helper exited");
assert.equal(controller.isRunning(), false);
assert.equal(controller.getState(), "off");

// Switch ON again: a new helper.
resetFeatureSettingsForTests({ consoleTray: true });
assert.equal(spawned.length, 2, "switch on at runtime: helper spawned again");
spawned[1].child.emitLine("ready tray-only windows-terminal");
await tick();
assert.equal(controller.getState(), "tray-only");

// The env override stops it too (the .env watcher notifies the same listeners).
process.env.MARINARA_CONSOLE_TRAY = "0";
notifyFeatureSettingsChange();
await tick();
assert.ok(spawned[1].child.stdinText.includes("stop\n"));
assert.equal(controller.isRunning(), false);
delete process.env.MARINARA_CONSOLE_TRAY;

// No console: the helper says so and exits; it is not restarted on every save.
notifyFeatureSettingsChange();
assert.equal(spawned.length, 3);
spawned[2].child.emitLine("noconsole no-console");
await tick();
spawned[2].child.exitNow(0);
await tick();
assert.equal(controller.getState(), "no-console");
notifyFeatureSettingsChange();
assert.equal(spawned.length, 3, "no retry loop without a console");

// A crash of the helper is a warning, not a restart loop; an off/on toggle retries.
resetFeatureSettingsForTests();
resetFeatureSettingsForTests({ consoleTray: true });
assert.equal(spawned.length, 4, "off then on retries");
spawned[3].child.exitNow(3);
await tick();
assert.equal(controller.getState(), "failed");
notifyFeatureSettingsChange();
assert.equal(spawned.length, 4, "no retry loop after a crash");

// A spawn that throws (no PowerShell) leaves the server running.
const broken = new tray.ConsoleTrayController({
  url: "http://127.0.0.1:1",
  port: 1,
  onQuit() {},
  platform: "win32",
  spawn: () => {
    throw Object.assign(new Error("spawn powershell.exe ENOENT"), { code: "ENOENT" });
  },
  isEnabled: () => true,
});
broken.sync();
assert.equal(broken.getState(), "failed");

// Shutdown: the running helper is stopped and later saves do nothing.
resetFeatureSettingsForTests();
resetFeatureSettingsForTests({ consoleTray: true });
assert.equal(spawned.length, 5);
spawned[4].child.emitLine("ready hide");
await tick();
await tray.stopConsoleTrayService();
assert.ok(spawned[4].child.stdinText.includes("stop\n"), "shutdown sends stop");
assert.equal(controller.isRunning(), false);
resetFeatureSettingsForTests();
resetFeatureSettingsForTests({ consoleTray: true });
assert.equal(spawned.length, 5, "no helper after shutdown");

resetFeatureSettingsForTests();
console.log("feature-switch-console-tray regression passed");
