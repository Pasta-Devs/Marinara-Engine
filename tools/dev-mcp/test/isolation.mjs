// Offline isolation regressions: nothing here touches a real engine, a real checkout's dist or real data. Every case
// builds a disposable fixture checkout in the temp folder and runs in its own Node process, because lib/config.mjs
// reads its settings from the environment once at import.
//
//   sandbox refresh with a linked live storage folder or shard leaves every live byte unchanged
//   stopEngine refuses an unrelated Node listener on the port and leaves it running
//   stopEngine still stops this checkout's own supervisor tree
//   the checkout ownership check on fake process chains
//   build / typecheck / restart-with-rebuild never write the live dist in sandbox mode
//
// Usage: node test/isolation.mjs
import { spawn, spawnSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const LIB = join(dirname(SELF), "..", "lib");
const lib = (name) => import(pathToFileURL(join(LIB, name)).href);
const IS_WINDOWS = process.platform === "win32";
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function write(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

/** A minimal checkout (with a space in its path, as real ones often have): packages/server/package.json (what config.mjs checks) and a .env with its own port. */
function fixtureRepo(root, livePort) {
  const repo = join(root, "fixture checkout");
  write(join(repo, "packages", "server", "package.json"), "{}\n");
  write(join(repo, ".env"), `PORT=${livePort}\n`);
  return repo;
}

function freePort() {
  return new Promise((done, fail) => {
    const server = createServer();
    server.once("error", fail);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => done(port));
    });
  });
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

/** Every file under `dir` (following links, as a reader of the live store would) with its bytes. */
function snapshot(dir) {
  const files = {};
  const walk = (path) => {
    for (const name of readdirSync(path)) {
      const full = join(path, name);
      if (readdirSafe(full)) walk(full);
      else files[full] = readFileSync(full, "utf8");
    }
  };
  walk(dir);
  return files;
}
function readdirSafe(path) {
  try {
    readdirSync(path);
    return true;
  } catch {
    return false;
  }
}

/** A directory link that needs no privilege: a junction on Windows, a symlink elsewhere. */
const linkDir = (target, path) => symlinkSync(target, path, IS_WINDOWS ? "junction" : "dir");

/** A process listening on `port` until killed; answers every request with 200 so a health probe sees it. */
const LISTENER_JS = `
const http = require("node:http");
http.createServer((req, res) => res.end("{}")).listen(Number(process.argv[2]), "127.0.0.1");
setInterval(() => {}, 1 << 30);
`;

async function waitForPort(port, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  throw new Error(`nothing listened on ${port}`);
}

// ------------------------------------------------------------------ cases (each runs in a child process)

const CASES = {
  /** A live data/storage that is a link to another folder: refresh must not rewrite the linked live files. */
  async "sandbox-linked-storage-root"({ root }) {
    const external = join(root, "external-storage");
    const shard = { id: "conn-a", provider: "openai", apiKeyEncrypted: "LIVE-KEY-A", baseUrl: "https://api.example.test/v1" };
    write(join(external, "tables", "api_connections", "conn-a.json"), JSON.stringify(shard));
    write(join(external, "tables", "chats", "chat-a.json"), JSON.stringify({ id: "chat-a", metadata: { webhookUrl: "https://hooks.example.test/x" } }));
    const liveData = join(process.env.MARINARA_DEV_REPO, "packages", "server", "data");
    mkdirSync(liveData, { recursive: true });
    linkDir(external, join(liveData, "storage"));
    const before = snapshot(external);
    const { refreshSandboxData } = await lib("sandbox.mjs");
    let outcome;
    try {
      outcome = refreshSandboxData();
    } catch (error) {
      outcome = { refused: error.message };
    }
    const after = snapshot(external);
    const unchanged = JSON.stringify(before) === JSON.stringify(after);
    const sandboxStorage = join(process.env.MARINARA_DEV_STATE, "sandbox", "data", "storage");
    const copy = join(sandboxStorage, "tables", "api_connections", "conn-a.json");
    const copyIsIndependent =
      outcome.refused !== undefined ||
      (!lstatSync(sandboxStorage).isSymbolicLink() && JSON.parse(readFileSync(copy, "utf8")).apiKeyEncrypted === "");
    return { ok: unchanged && copyIsIndependent, unchanged, copyIsIndependent, outcome };
  },

  /** One linked shard inside a real live storage folder: same rule. File symlinks need a privilege on Windows. */
  async "sandbox-linked-shard"({ root }) {
    const externalShard = join(root, "external-shards", "conn-b.json");
    write(externalShard, JSON.stringify({ id: "conn-b", apiKeyEncrypted: "LIVE-KEY-B", baseUrl: "https://api.example.test/v1" }));
    const storage = join(process.env.MARINARA_DEV_REPO, "packages", "server", "data", "storage");
    mkdirSync(join(storage, "tables", "api_connections"), { recursive: true });
    try {
      symlinkSync(externalShard, join(storage, "tables", "api_connections", "conn-b.json"), "file");
    } catch (error) {
      if (IS_WINDOWS && error.code === "EPERM") return { ok: true, skipped: "file symlinks need Developer Mode on Windows" };
      throw error;
    }
    const before = readFileSync(externalShard, "utf8");
    const { refreshSandboxData } = await lib("sandbox.mjs");
    let outcome;
    try {
      outcome = refreshSandboxData();
    } catch (error) {
      outcome = { refused: error.message };
    }
    const unchanged = readFileSync(externalShard, "utf8") === before;
    return { ok: unchanged, unchanged, outcome };
  },

  /** An unrelated app whose command line looks like an engine (".../dist/index.js") holds the port. */
  async "stop-refuses-unrelated-listener"({ root, port }) {
    const service = join(root, "unrelated-service");
    write(join(service, "dist", "index.js"), LISTENER_JS);
    const child = spawn(process.execPath, [join(service, "dist", "index.js"), String(port)], {
      cwd: service,
      stdio: "ignore",
      detached: true,
      windowsHide: true,
    });
    child.unref();
    try {
      await waitForPort(port);
      const { stopEngine } = await lib("engine.mjs");
      let outcome;
      try {
        outcome = await stopEngine(port);
      } catch (error) {
        outcome = { refused: error.message };
      }
      await sleep(500);
      const alive = isAlive(child.pid);
      return { ok: alive && outcome.refused !== undefined, alive, outcome };
    } finally {
      try {
        process.kill(child.pid, "SIGKILL");
      } catch {
        /* already gone */
      }
    }
  },

  /** This checkout's own supervisor (run-server -> dist/index.js), started the way the sandbox starts it. */
  async "stop-stops-own-supervisor"({ port }) {
    const repo = process.env.MARINARA_DEV_REPO;
    write(
      join(repo, "scripts", "run-server.mjs"),
      `import { spawn } from "node:child_process";
const child = spawn(process.execPath, process.argv.slice(2), { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
`,
    );
    write(join(repo, "packages", "server", "dist", "index.js"), LISTENER_JS.replace("Number(process.argv[2])", String(port)));
    const { startDetached, writePidFile, listenerProcess } = await lib("proc.mjs");
    const { stopEngine } = await lib("engine.mjs");
    const log = join(process.env.MARINARA_DEV_STATE, "own.log");
    const pid = await startDetached({
      cwd: join(repo, "packages", "server"),
      args: ["../../scripts/run-server.mjs", "dist/index.js"],
      env: process.env,
      outLog: log,
      errLog: log,
    });
    writePidFile(port, pid);
    await waitForPort(port);
    const listener = await listenerProcess(port);
    let outcome;
    try {
      outcome = await stopEngine(port);
    } catch (error) {
      outcome = { error: error.message };
    }
    await sleep(500);
    const leftovers = [pid, listener?.pid].filter((p) => p && isAlive(p));
    for (const p of leftovers) process.kill(p, "SIGKILL");
    return { ok: outcome.stopped === true && leftovers.length === 0, outcome, leftovers };
  },

  /** The ownership rule itself, on fake process chains (no processes are started or stopped). */
  async "ownership-fake-chains"() {
    const repo = process.env.MARINARA_DEV_REPO;
    const proc = await lib("proc.mjs");
    // Without an ownership check, a stop only asks whether the listener looks like the engine.
    const owned = proc.belongsToCheckout ?? (() => true);
    const accepted = (chain) => {
      const p = { pid: chain[0].pid, chain };
      return proc.looksLikeEngine(p, undefined) && owned(p, undefined, repo);
    };
    const serverDir = join(repo, "packages", "server");
    const elsewhere = join(dirname(repo), "unrelated-service");
    const launcher = join(repo, IS_WINDOWS ? "start.bat" : "start.sh");
    const checks = {
      "unrelated dist/index.js is refused": !accepted([
        { pid: 999999, cmd: `node ${join(elsewhere, "dist", "index.js")}`, cwd: elsewhere },
      ]),
      "the reviewer's /tmp example is refused": !accepted([{ pid: 999999, cmd: "node /tmp/unrelated-service/dist/index.js" }]),
      "a listener with no cwd or path evidence is refused": !accepted([
        { pid: 999991, cmd: "node dist/index.js" },
        { pid: 999992, cmd: "node ../../scripts/run-server.mjs dist/index.js" },
      ]),
      "a path that climbs out of the repo is refused": !accepted([
        { pid: 999999, cmd: `node "${repo}${sep}..${sep}unrelated-service${sep}dist${sep}index.js"` },
      ]),
      "a sibling folder sharing the repo's name prefix is refused": !accepted([
        { pid: 999999, cmd: `node "${repo}-copy${sep}packages${sep}server${sep}dist${sep}index.js"` },
      ]),
      "a repo path on a non-engine ancestor does not vouch for the listener": !accepted([
        { pid: 999991, cmd: `node ${join(elsewhere, "dist", "index.js")}`, cwd: elsewhere },
        { pid: 999992, cmd: "bash", cwd: repo },
      ]),
      "own supervisor, cwd under the repo, is accepted": accepted([
        { pid: 999991, cmd: "node dist/index.js", cwd: serverDir },
        { pid: 999992, cmd: "node ../../scripts/run-server.mjs dist/index.js", cwd: serverDir },
      ]),
      "own launcher, script path under the repo, is accepted": accepted([
        { pid: 999991, cmd: "node dist/index.js" },
        { pid: 999992, cmd: "node ../../scripts/run-server.mjs dist/index.js" },
        { pid: 999993, cmd: IS_WINDOWS ? `cmd.exe /c ""${launcher}""` : `bash "${launcher}"` },
      ]),
    };
    return { ok: Object.values(checks).every(Boolean), checks };
  },

  /** In sandbox mode no build entry point may write the checkout's dist (the live engine's). */
  async "sandbox-builds-never-write-live-dist"({ root }) {
    const repo = process.env.MARINARA_DEV_REPO;
    const markers = ["shared", "server"].map((pkg) => join(repo, "packages", pkg, "dist", "marker.txt"));
    for (const marker of markers) write(marker, "LIVE_BUILD");
    mkdirSync(join(repo, "packages", "server", "src"), { recursive: true });
    // Stands in for pnpm: "--filter @marinara-engine/<pkg> build" overwrites that package's marker.
    write(
      join(root, "fake-pnpm.mjs"),
      `import { writeFileSync } from "node:fs";
const pkg = process.argv[process.argv.indexOf("--filter") + 1].split("/").pop();
writeFileSync("packages/" + pkg + "/dist/marker.txt", "REBUILT_FROM_SANDBOX");
`,
    );
    const engine = await lib("engine.mjs");
    const calls = {};
    const liveDistWrites = [];
    const attempt = async (name, fn) => {
      try {
        calls[name] = await fn();
      } catch (error) {
        calls[name] = { refused: error.message };
      }
      // Checked (and reset) after each call, so each entry point is judged on its own.
      if (markers.some((marker) => readFileSync(marker, "utf8") !== "LIVE_BUILD")) liveDistWrites.push(name);
      for (const marker of markers) write(marker, "LIVE_BUILD");
    };
    await attempt("build", () => engine.build(["shared", "server"]));
    await attempt("typecheck", () => engine.typecheck("server"));
    await attempt("restart-with-rebuild", () =>
      engine.deploy({ packages: ["shared"], waitQuiet: false, quietSeconds: 0, maxWaitSeconds: 0, reason: "isolation test" }),
    );
    const untouched = liveDistWrites.length === 0;
    const buildRefused = /sandbox mode/.test(calls.build?.refused ?? "");
    const restartRefused = /sandbox mode/.test(calls["restart-with-rebuild"]?.error ?? "");
    return { ok: untouched && buildRefused && restartRefused, liveDistWrites, buildRefused, restartRefused, calls };
  },
};

// ------------------------------------------------------------------ runner

async function runCase(name) {
  const root = mkdtempSync(join(tmpdir(), "dev-mcp-isolation-"));
  try {
    const livePort = await freePort();
    let port = await freePort();
    while (port === livePort) port = await freePort();
    const repo = fixtureRepo(root, livePort);
    const env = {
      ...process.env,
      MARINARA_DEV_REPO: repo,
      MARINARA_DEV_STATE: join(root, "state"),
      MARINARA_DEV_AGENT: "isolation-test",
      MARINARA_DEV_SANDBOX_PORT: String(port),
      MARINARA_DEV_PNPM: `node ${join(root, "fake-pnpm.mjs")}`,
      MARINARA_DEV_INSTANCE: name.startsWith("sandbox-builds") ? "sandbox" : "live",
    };
    delete env.MARINARA_DEV_PORT;
    delete env.MARINARA_DEV_SANDBOX_DIR;
    delete env.MARINARA_ENV_FILE;
    const child = spawnSync(process.execPath, [SELF, "--case", name, root, String(port)], {
      env,
      encoding: "utf8",
      timeout: 180_000,
      windowsHide: true,
    });
    const line = (child.stdout || "").trim().split("\n").pop();
    try {
      return JSON.parse(line);
    } catch {
      return { ok: false, error: `${child.stderr || ""}${child.stdout || ""}`.slice(-1500) || `exit ${child.status}` };
    }
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

const caseIndex = process.argv.indexOf("--case");
if (caseIndex !== -1) {
  const name = process.argv[caseIndex + 1];
  const [root, port] = process.argv.slice(caseIndex + 2);
  let result;
  try {
    result = await CASES[name]({ root, port: Number(port) });
  } catch (error) {
    result = { ok: false, error: String(error?.stack ?? error) };
  }
  process.stdout.write(`\n${JSON.stringify(result)}\n`);
  process.exit(0);
} else {
  const only = process.argv[2];
  let failed = 0;
  for (const name of Object.keys(CASES).filter((n) => !only || n.includes(only))) {
    const result = await runCase(name);
    if (!result.ok) failed += 1;
    console.log(`${result.ok ? "PASS" : "FAIL"} ${name}${result.skipped ? ` (skipped: ${result.skipped})` : ""}`);
    if (!result.ok || process.env.VERBOSE) console.log(`  ${JSON.stringify(result).slice(0, 2000)}`);
  }
  console.log(failed ? `${failed} failed` : "all passed");
  process.exit(failed ? 1 : 0);
}
