// Cross-platform process control for engine processes: who listens on a port, is a PID alive, stop a process
// tree, start a detached process.
//
// Windows: PowerShell (Get-NetTCPConnection + Win32_Process) with a netstat fallback, taskkill /T /F, and
//          Start-Process for the live engine.
// POSIX (Linux, macOS): lsof, then ss, then the PID file this tool wrote; ps for the parent chain; SIGTERM to the
//          top engine process (the run-server supervisor forwards it to the server) and SIGKILL for the whole tree
//          after a grace period; spawn(detached) to start.
import { execFile, spawn } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, readlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { IS_WINDOWS, REPO, RUN_DIR } from "./config.mjs";
import { sleep } from "./util.mjs";

const run = promisify(execFile);

async function sh(file, args, options = {}) {
  const { stdout } = await run(file, args, { windowsHide: true, maxBuffer: 8 * 1024 * 1024, ...options });
  return stdout.trim();
}

// PowerShell treats the typographic single quotes as quote characters too, so they are doubled as well.
const psq = (value) => String(value).replace(/['\u2018\u2019\u201A\u201B]/g, "$&$&");
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

/** The working directory of `pid`: /proc on Linux, lsof elsewhere; null when it cannot be read. */
async function posixCwd(pid) {
  try {
    return readlinkSync(`/proc/${Number(pid)}/cwd`);
  } catch {
    const out = await sh("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"]).catch(() => "");
    const line = out.split("\n").find((l) => l.startsWith("n"));
    return line ? line.slice(1) : null;
  }
}

async function posixListener(port) {
  const pid = await posixListenerPid(port);
  if (!pid) return null;
  const chain = [];
  for (let id = pid, i = 0; id > 1 && i < 6; i += 1) {
    const info = await posixInfo(id);
    if (!info) break;
    chain.push({ ...info, cwd: await posixCwd(id) });
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

/** The listener and its consecutive engine-looking ancestors: the tree a stop would kill. */
function engineChain(proc) {
  // Climb only through consecutive engine processes: an unrelated ancestor whose command line happens to match (a
  // shell that once ran `pnpm start`, say) must never become the root of the tree that is killed.
  const chain = [proc.chain[0]];
  for (const parent of proc.chain.slice(1)) {
    if (!ENGINE_CMD.test(String(parent.cmd ?? ""))) break;
    chain.push(parent);
  }
  return chain;
}

export function engineRoot(proc) {
  return engineChain(proc).at(-1);
}

/** Case-insensitive on Windows, where paths are; resolved through links where the path exists. */
function comparable(path) {
  let full = resolve(path);
  try {
    full = realpathSync.native(full);
  } catch {
    /* a path that no longer exists is compared as written */
  }
  return IS_WINDOWS ? full.toLowerCase() : full;
}

const under = (root, path) => {
  const rel = relative(comparable(root), comparable(path));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

/** Absolute paths named in a command line: quoted arguments, or runs of non-space characters that start like a path. */
function commandPaths(cmd) {
  const paths = [];
  for (const match of String(cmd).matchAll(/"+([^"]+)"+|'+([^']+)'+|(\S+)/g)) {
    const token = match[1] ?? match[2] ?? match[3];
    if (isAbsolute(token) && (IS_WINDOWS ? /^[A-Za-z]:[\\/]/.test(token) : token.startsWith("/"))) paths.push(token);
  }
  return paths;
}

/**
 * Evidence that the engine tree belongs to this checkout (`repo`): a process in it is the one this tool started on
 * that port (PID file), runs with its working directory under the repo, or names a script path under the repo.
 * A command line alone ("node dist/index.js") says nothing about which checkout it came from.
 */
export function belongsToCheckout(proc, port, repo = REPO) {
  const recorded = port === undefined ? null : readPidFile(port);
  return engineChain(proc).some(
    (p) =>
      (recorded !== null && p.pid === recorded) ||
      (typeof p.cwd === "string" && p.cwd && under(repo, p.cwd)) ||
      commandPaths(p.cmd ?? "").some((path) => ENGINE_CMD.test(path) && under(repo, path)),
  );
}

/**
 * True when the listening process looks like the engine. A listener whose command line cannot be read
 * (netstat or PID-file fallbacks) counts only if it is the process this tool started on that port.
 */
export function looksLikeEngine(proc, port) {
  if (proc.chain[0]?.cmd == null) return port !== undefined && proc.pid === readPidFile(port);
  // The listener itself must be the engine: an unrelated server started under an engine-looking ancestor (a
  // `pnpm start` of another project, say) is not.
  return ENGINE_CMD.test(String(proc.chain[0].cmd));
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
  const out = openSync(outLog, "a");
  const err = openSync(errLog, "a");
  try {
    const child = spawn(process.execPath, args, { cwd, env, detached: true, stdio: ["ignore", out, err], windowsHide: true });
    child.unref();
    return child.pid;
  } finally {
    // The child holds its own copies; the parent's would leak on every start.
    closeSync(out);
    closeSync(err);
  }
}

export function tail(file, lines = 12) {
  return existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").slice(-lines).join("\n") : "";
}
