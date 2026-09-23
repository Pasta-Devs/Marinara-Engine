// Cross-platform process control for engine processes: who listens on a port, is a PID alive, stop a process
// tree, start a detached process.
//
// Windows: PowerShell (Get-NetTCPConnection + Win32_Process) with a netstat fallback, taskkill /T /F, and
//          Start-Process for the live engine.
// POSIX (Linux, macOS): lsof, then ss, then the PID file this tool wrote; ps for the parent chain; SIGTERM to the
//          top engine process (the run-server supervisor forwards it to the server) and SIGKILL for the whole tree
//          after a grace period; spawn(detached) to start.
import { execFile, spawn } from "node:child_process";
import { existsSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { IS_WINDOWS, RUN_DIR } from "./config.mjs";
import { sleep } from "./util.mjs";

const run = promisify(execFile);

async function sh(file, args, options = {}) {
  const { stdout } = await run(file, args, { windowsHide: true, maxBuffer: 8 * 1024 * 1024, ...options });
  return stdout.trim();
}

const psq = (value) => String(value).replace(/'/g, "''");
export async function powershell(script, options = {}) {
  return sh("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], options);
}

// ------------------------------------------------------------------ PID files

const pidFile = (port) => join(RUN_DIR, `engine-${port}.pid`);
export function writePidFile(port, pid) {
  writeFileSync(pidFile(port), String(pid));
}
function readPidFile(port) {
  try {
    const pid = Number(readFileSync(pidFile(port), "utf8").trim());
    return pid > 0 && isAlive(pid) ? pid : null;
  } catch {
    return null;
  }
}
export function clearPidFile(port) {
  rmSync(pidFile(port), { force: true });
}

// ------------------------------------------------------------------ lookup

export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

async function windowsListener(port) {
  const json = await powershell(
    `$c = Get-NetTCPConnection -LocalPort ${Number(port)} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1;` +
      ` if (-not $c) { '' } else {` +
      ` $chain = @(); $id = $c.OwningProcess;` +
      ` for ($i = 0; $i -lt 6 -and $id; $i++) { $p = Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue; if (-not $p) { break };` +
      ` $chain += [pscustomobject]@{ pid = $p.ProcessId; ppid = $p.ParentProcessId; name = $p.Name; cmd = $p.CommandLine; started = $p.CreationDate.ToString('o') }; $id = $p.ParentProcessId };` +
      ` $chain | ConvertTo-Json -Compress }`,
  ).catch(() => null);
  if (json) return [].concat(JSON.parse(json));
  if (json === "") return null;
  // No Get-NetTCPConnection (older or trimmed Windows): netstat gives the PID without the chain.
  const table = await sh("netstat", ["-ano", "-p", "TCP"]).catch(() => "");
  const row = table.split(/\r?\n/).find((line) => new RegExp(`:${Number(port)}\\s+\\S+\\s+LISTENING`, "i").test(line));
  const pid = row ? Number(row.trim().split(/\s+/).pop()) : null;
  return pid ? [{ pid, ppid: null, name: null, cmd: null, started: null }] : null;
}

async function posixListenerPid(port) {
  const viaLsof = await sh("lsof", ["-nP", `-iTCP:${Number(port)}`, "-sTCP:LISTEN", "-t"]).catch(() => "");
  if (viaLsof) return Number(viaLsof.split("\n")[0]);
  const viaSs = await sh("ss", ["-ltnpH", `sport = :${Number(port)}`]).catch(() => "");
  const match = /pid=(\d+)/.exec(viaSs);
  if (match) return Number(match[1]);
  return readPidFile(port);
}

async function posixInfo(pid) {
  // lstart is five words ("Wed Sep 23 12:00:00 2026"); args is the rest of the line.
  const line = await sh("ps", ["-o", "pid=,ppid=,lstart=,args=", "-p", String(pid)]).catch(() => "");
  const parts = line.trim().split(/\s+/);
  if (parts.length < 8) return null;
  const started = new Date(parts.slice(2, 7).join(" "));
  const cmd = parts.slice(7).join(" ");
  return {
    pid: Number(parts[0]),
    ppid: Number(parts[1]),
    name: basename(parts[7] ?? ""),
    cmd,
    started: Number.isNaN(started.getTime()) ? null : started.toISOString(),
  };
}

async function posixListener(port) {
  const pid = await posixListenerPid(port);
  if (!pid) return null;
  const chain = [];
  for (let id = pid, i = 0; id > 1 && i < 6; i += 1) {
    const info = await posixInfo(id);
    if (!info) break;
    chain.push(info);
    id = info.ppid;
  }
  return chain.length ? chain : [{ pid, ppid: null, name: null, cmd: null, started: null }];
}

/** The process listening on `port`, with its command line and up to five ancestors. */
export async function listenerProcess(port) {
  const chain = IS_WINDOWS ? await windowsListener(port) : await posixListener(port);
  if (!chain?.length) return null;
  return { pid: chain[0].pid, started: chain[0].started, chain };
}

/**
 * The topmost ancestor that belongs to the engine (the run-server supervisor, a launcher script, or pnpm start), so
 * stopping it does not leave a supervisor that restarts the server.
 */
const ENGINE_CMD = /run-server\.mjs|dist[\w-]*[\\/]index\.js|start(-local)?\.(bat|sh)|pnpm.*start/i;

export function engineRoot(proc) {
  const engineChain = proc.chain.filter((p) => ENGINE_CMD.test(String(p.cmd ?? "")));
  return engineChain[engineChain.length - 1] ?? proc.chain[0];
}

/** False when the listener's command line is known and nothing in its chain looks like the engine. */
export function looksLikeEngine(proc) {
  if (proc.chain[0]?.cmd == null) return true;
  return proc.chain.some((p) => ENGINE_CMD.test(String(p.cmd ?? "")));
}

// ------------------------------------------------------------------ stop

async function posixDescendants(pid) {
  const table = await sh("ps", ["-e", "-o", "pid=,ppid="]).catch(() => "");
  const children = new Map();
  for (const line of table.split("\n")) {
    const [child, parent] = line.trim().split(/\s+/).map(Number);
    if (!child) continue;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(child);
  }
  const all = [];
  const walk = (id) => {
    for (const child of children.get(id) ?? []) {
      all.push(child);
      walk(child);
    }
  };
  walk(pid);
  return all;
}

/**
 * Stop `rootPid` and everything under it, then wait for `watchPid` (the listener) to exit.
 * Windows: taskkill /T /F (console servers ignore a polite taskkill). POSIX: SIGTERM to the root first so the server
 * can flush its storage, then SIGKILL to anything left after `graceSeconds`.
 */
export async function stopTree(rootPid, { watchPid = rootPid, graceSeconds = 20, timeoutSeconds = 60 } = {}) {
  if (IS_WINDOWS) {
    await sh("taskkill", ["/PID", String(rootPid), "/T", "/F"]).catch(() => undefined);
  } else {
    const tree = [rootPid, ...(await posixDescendants(rootPid))];
    try {
      process.kill(rootPid, "SIGTERM");
    } catch {
      /* already gone */
    }
    const graceEnd = Date.now() + graceSeconds * 1000;
    while (Date.now() < graceEnd && tree.some(isAlive)) await sleep(500);
    for (const pid of tree) {
      try {
        if (isAlive(pid)) process.kill(pid, "SIGKILL");
      } catch {
        /* already gone */
      }
    }
  }
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    if (!isAlive(watchPid)) return true;
    await sleep(1000);
  }
  return false;
}

// ------------------------------------------------------------------ start

/**
 * Start `node <args>` detached in `cwd`, output appended to `outLog` / `errLog`. Returns the PID.
 *
 * `windowsStartProcess` launches through PowerShell Start-Process with a hidden window (the path the live engine has
 * always used on Windows). Otherwise, and on every POSIX system, it is a plain detached spawn in its own process group.
 * `env` is the complete environment of the new process.
 */
export async function startDetached({ cwd, args, env, outLog, errLog, windowsStartProcess = false }) {
  if (IS_WINDOWS && windowsStartProcess) {
    const argList = args.map((a) => `'${psq(a)}'`).join(",");
    // The PID goes through a file, and PowerShell runs with no pipes: the started server can inherit PowerShell's
    // handles, and a pipe it holds open would keep this call waiting for as long as the server runs.
    const pidOut = join(RUN_DIR, `start-${process.pid}-${Date.now()}.pid`);
    const script =
      `$p = Start-Process -FilePath '${psq(process.execPath)}' -ArgumentList ${argList} -WorkingDirectory '${psq(cwd)}'` +
      ` -WindowStyle Hidden -RedirectStandardOutput '${psq(outLog)}' -RedirectStandardError '${psq(errLog)}' -PassThru;` +
      ` Set-Content -LiteralPath '${psq(pidOut)}' -Value $p.Id -Encoding ascii`;
    const code = await new Promise((resolve, reject) => {
      const ps = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
        env,
        stdio: "ignore",
        windowsHide: true,
      });
      ps.once("error", reject);
      ps.once("exit", resolve);
    });
    const pid = existsSync(pidOut) ? Number(readFileSync(pidOut, "utf8").trim()) : 0;
    rmSync(pidOut, { force: true });
    if (!pid) throw new Error(`Start-Process did not return a PID (PowerShell exit code ${code})`);
    return pid;
  }
  const child = spawn(process.execPath, args, {
    cwd,
    env,
    detached: true,
    stdio: ["ignore", openSync(outLog, "a"), openSync(errLog, "a")],
    windowsHide: true,
  });
  child.unref();
  return child.pid;
}

export function tail(file, lines = 12) {
  return existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").slice(-lines).join("\n") : "";
}
