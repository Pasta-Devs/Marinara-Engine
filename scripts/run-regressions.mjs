#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { BATCH_MARKER } from './run-regression-batch.mjs';

const FILE_TIMEOUT_MS = 30_000;
const SERIAL_RETRY_LIMIT = 20;
const REGRESSION_SUFFIXES = ['.regression.ts', '.regression.mjs', '.regression.js'];
const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143, SIGBREAK: 1 };
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const regressionsRoot = path.join(repositoryRoot, 'scripts', 'regressions');
const serverRequire = createRequire(path.join(repositoryRoot, 'packages', 'server', 'package.json'));
// Running children, each mapped to its force-kill timer once termination has started.
const activeChildren = new Map();
let interruption;

function repositoryRelative(file) {
  return path.relative(repositoryRoot, file).split(path.sep).join('/');
}

export function regressionTimeoutMs(relativePath) {
  if (relativePath === 'scripts/regressions/server-signal-shutdown.regression.ts') {
    // 20s main-server phase + six sequential 40s PTY bounds + 10s setup/cleanup margin.
    return 270_000;
  }
  if (relativePath === 'scripts/regressions/restart-supervisor.regression.ts') return 90_000;
  // Two provider deadlines (8 s each): a silent getContext and a claim that answers late.
  if (relativePath === 'scripts/regressions/scene-package-origin.regression.ts') return 60_000;
  // Two slow Decision recall passes (5.5 s each) prove that each has its own time limit.
  if (relativePath === 'scripts/regressions/advanced-memory-recall-shortlist.regression.ts') return 60_000;
  // Hundreds of complete d20 and dice-pool fights: 75-130 s on CI runners and up to about 180 s locally.
  if (relativePath === 'scripts/regressions/game-ruleset/ruleset-combat-director.regression.ts') return 300_000;
  // An out-of-memory control and a small-heap 64 MB gallery round trip: 20 s alone, 26 s to over 60 s in the CI pool.
  if (relativePath === 'scripts/regressions/native-export-memory.regression.ts') return 90_000;
  // Real large-text, multipart and 10,001-entry transfers exceed 30 s on the CI file-backed store, and over 90 s on slow
  // CI runners (about 1.6x slower), where it was being retried.
  if (relativePath === 'scripts/regressions/chat-request-validation.regression.ts') return 150_000;
  // Eighteen blink and talk pictures lined up with their face at full size: about 10 s, more on a busy runner.
  if (relativePath === 'scripts/regressions/avatar-variant-composite.regression.ts') return 120_000;
  // Every cap of the ruleset schema proved at its edge, against the whole 5e ruleset: about 40 s.
  if (relativePath === 'scripts/regressions/game-ruleset/game-ruleset-caps.regression.ts') return 120_000;
  // Every language's ruleset strings read and drawn against the whole 5e ruleset: about 60 s alone.
  if (relativePath === 'scripts/regressions/game-ruleset/game-ruleset-locales.regression.ts') return 120_000;
  return FILE_TIMEOUT_MS;
}

// Files that only call engine code run BATCH_SIZE at a time in one shared process (scripts/run-regression-batch.mjs):
// most of a separate file's time is starting up and loading the same modules. A file that does not pass there, or a
// batch that crashes, hangs or sets an exit code, runs alone as usual, so batching never fails a file. Modules load once
// per batch (a setting read at load, such as DATA_DIR, keeps the first file's value), so add a prefix only for a folder
// whose files mostly call engine code: one that depends on saved data, servers or child processes usually fails there
// and runs again alone, which costs its time twice (a few of game-ruleset's files do). --isolated (or
// REGRESSION_ISOLATED=1) turns batching off; full runs use it, so a file that passes only because of what an earlier
// file left behind still shows up.
export const BATCHED_REGRESSION_PREFIXES = ['scripts/regressions/game-ruleset/'];
const BATCH_SIZE = 20;
// A shared process cannot tell these files' results apart or would skip their checks.
const NOT_BATCHABLE = /node:test|process\.exit\(|process\.exitCode|process\.argv/u;

export function batchable(relativePath, text) {
  return BATCHED_REGRESSION_PREFIXES.some((prefix) => relativePath.startsWith(prefix)) && !NOT_BATCHABLE.test(text);
}

export function discoverRegressions(directory = regressionsRoot) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...discoverRegressions(entryPath));
    } else if (entry.isFile() && REGRESSION_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) {
      files.push(repositoryRelative(entryPath));
    }
  }
  return files.sort();
}

const USAGE = 'Usage: node scripts/run-regressions.mjs [--list] [--filter <text>]... [--concurrency <n>] [--shard <i>/<n>] [--isolated]';

function parseConcurrency(value, message = USAGE) {
  if (!/^[1-9][0-9]*$/.test(value ?? '')) throw new Error(message);
  return Number(value);
}

// "2/3" selects the second of three shards; shards are 1-based and disjoint.
function parseShard(value) {
  const match = /^([1-9][0-9]*)\/([1-9][0-9]*)$/.exec(value ?? '');
  if (!match || Number(match[1]) > Number(match[2])) throw new Error(USAGE);
  return { index: Number(match[1]), total: Number(match[2]) };
}

function parseArguments(args) {
  let list = false;
  let isolated = process.env.REGRESSION_ISOLATED === '1';
  // A file runs when any --filter matches it.
  const filters = [];
  let concurrency;
  let shard;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--') {
      continue;
    } else if (argument === '--list') {
      list = true;
    } else if (argument === '--isolated') {
      isolated = true;
    } else if (argument === '--filter') {
      if (index + 1 === args.length || args[index + 1] === '') throw new Error(USAGE);
      filters.push(args[index + 1]);
      index += 1;
    } else if (argument === '--concurrency') {
      if (concurrency !== undefined) throw new Error(USAGE);
      concurrency = parseConcurrency(args[index + 1]);
      index += 1;
    } else if (argument === '--shard') {
      if (shard !== undefined) throw new Error(USAGE);
      shard = parseShard(args[index + 1]);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  const fromEnv = process.env.REGRESSION_CONCURRENCY;
  concurrency ??= fromEnv
    ? parseConcurrency(fromEnv, 'REGRESSION_CONCURRENCY must be a positive whole number.')
    : os.availableParallelism();
  return { concurrency, filters, isolated, list, shard };
}

// Deal the slow-first order round-robin so every shard gets its share of the known slow files.
export function shardOf(files, { index, total }) {
  return [...files].sort(slowFirst).filter((_, position) => position % total === index - 1).sort();
}

function slowFirst(a, b) {
  return regressionTimeoutMs(b) - regressionTimeoutMs(a);
}

function pipeWithContext(stream, relativePath, label, destination) {
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  lines.on('line', (line) => destination.write(`[${relativePath}] ${label}: ${line}\n`));
}

function terminateChild(child) {
  if (!child?.pid) return;

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

function forceTerminateChild(child) {
  if (!child?.pid || process.platform === 'win32') return;
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
}

function terminateActiveChild(child) {
  if (!activeChildren.has(child) || activeChildren.get(child)) return;
  activeChildren.set(child, setTimeout(() => forceTerminateChild(child), 2_000));
  terminateChild(child);
}

function releaseActiveChild(child) {
  clearTimeout(activeChildren.get(child));
  activeChildren.delete(child);
}

function handleRunnerSignal(signal) {
  if (interruption) return;
  interruption = signal;
  process.exitCode = SIGNAL_EXIT_CODES[signal];
  process.stderr.write(`[runner] ${signal} received; terminating active regression.\n`);
  for (const child of activeChildren.keys()) terminateActiveChild(child);
}

function commandFor(relativePath) {
  if (relativePath.endsWith('.regression.ts')) {
    return {
      command: process.execPath,
      args: [serverRequire.resolve('tsx/cli'), path.join(repositoryRoot, relativePath)],
      cwd: path.join(repositoryRoot, 'packages', 'server'),
    };
  }

  return {
    command: process.execPath,
    args: [relativePath],
    cwd: repositoryRoot,
  };
}

// Each file gets throwaway storage and an empty .env: the repo .env can point DATA_DIR and FILE_STORAGE_DIR at a
// real data folder, and a regression that forgets to isolate itself must never open (or be blocked by) that store.
function regressionEnvironment(scratchDir) {
  const dataDir = path.join(scratchDir, 'data');
  return {
    ...process.env,
    MARINARA_ENV_FILE: path.join(scratchDir, '.env'),
    DATA_DIR: dataDir,
    FILE_STORAGE_DIR: path.join(dataDir, 'storage'),
    // Overworld games are locked by default; the lanes that make worlds run with them on, and the lock's own
    // checks turn them off themselves.
    MARINARA_OVERWORLD_GAMES: process.env.MARINARA_OVERWORLD_GAMES ?? 'true',
  };
}

// Buffered output is held back and returned with the result, so files running side by side print in whole blocks.
function runRegression(relativePath, buffered) {
  const { args, command, cwd } = commandFor(relativePath);
  const timeoutMs = regressionTimeoutMs(relativePath);
  const startedAt = Date.now();
  const output = [];
  const sink = (destination) => (buffered ? { write: (text) => output.push([destination, text]) } : destination);
  const stdout = sink(process.stdout);
  const stderr = sink(process.stderr);
  stdout.write(`[${relativePath}] START\n`);
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marinara-regression-'));

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      detached: process.platform !== 'win32',
      env: regressionEnvironment(scratchDir),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    activeChildren.set(child, undefined);
    pipeWithContext(child.stdout, relativePath, 'stdout', stdout);
    pipeWithContext(child.stderr, relativePath, 'stderr', stderr);

    let settled = false;
    let timedOut = false;
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      stderr.write(`[${relativePath}] TIMEOUT after ${timeoutMs / 1000}s; terminating child.\n`);
      terminateActiveChild(child);
    }, timeoutMs);

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      releaseActiveChild(child);
      try {
        fs.rmSync(scratchDir, { recursive: true, force: true, maxRetries: 3 });
      } catch {
        // A child still exiting can hold a file open on Windows; the OS temp cleaner removes it.
      }
      resolve({ ...result, durationMs: Date.now() - startedAt, output });
    };

    child.once('error', (error) => finish({ status: 'start-error', error }));
    child.once('close', (code, signal) => {
      if (timedOut) {
        finish({ status: 'timeout' });
      } else if (code === 0) {
        finish({ status: 'passed' });
      } else {
        finish({ status: 'failed', code, signal });
      }
    });
  });
}

// Runs `files` in one shared process. Returns the files that passed there, each with its own output, and the files that
// must run alone: those that failed or never finished, or every file when the process exits non-zero, since an error
// one file leaves behind can surface while another runs. The options shorten the time limits and swap the shared
// process's script for the runner's own test.
export function runBatch(
  files,
  buffered,
  { timeoutMs = regressionTimeoutMs, idleMs = FILE_TIMEOUT_MS, batchPath = 'scripts/run-regression-batch.mjs' } = {},
) {
  const outputs = new Map(files.map((file) => [file, []]));
  const startedAt = new Map();
  const passed = new Map();
  const failedHere = new Set();
  let current;
  let timedOut;
  let fileTimer;
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marinara-regression-'));
  const label = `[runner] batch of ${files.length} (${files[0]} …)`;

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [serverRequire.resolve('tsx/cli'), path.join(repositoryRoot, batchPath), ...files], {
      cwd: path.join(repositoryRoot, 'packages', 'server'),
      detached: process.platform !== 'win32',
      env: regressionEnvironment(scratchDir),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    activeChildren.set(child, undefined);
    // Starting up, before its first file, the process must also get going; each marker replaces this timer.
    fileTimer = setTimeout(() => {
      timedOut = `the shared process did not start a file within ${idleMs / 1000}s`;
      terminateActiveChild(child);
    }, idleMs);

    // Output belongs to the file running when it was printed; buffered, it is held back and printed with that file.
    const write = (destination, text) => {
      if (buffered && current) outputs.get(current).push([destination, text]);
      else destination.write(text);
    };
    const record = (stream, line) =>
      write(stream === 'stdout' ? process.stdout : process.stderr, `[${current ?? batchPath}] ${stream}: ${line}\n`);
    readline.createInterface({ input: child.stdout, crlfDelay: Infinity }).on('line', (text) => {
      // A file whose output did not end its line leaves the marker after that output.
      const at = text.indexOf(BATCH_MARKER);
      if (at < 0) return record('stdout', text);
      if (at > 0) record('stdout', text.slice(0, at));
      const line = text.slice(at);
      const [, event, file] = /^\S+ (start|pass|fail) (.+)$/u.exec(line) ?? [];
      if (!outputs.has(file)) return record('stdout', line);
      clearTimeout(fileTimer);
      if (event === 'start') {
        current = file;
        startedAt.set(file, Date.now());
        write(process.stdout, `[${file}] START (shared process)\n`);
        fileTimer = setTimeout(() => {
          timedOut = `${file} timed out after ${timeoutMs(file) / 1000}s`;
          terminateActiveChild(child);
        }, timeoutMs(file));
        return;
      }
      if (event === 'pass') passed.set(file, Date.now() - startedAt.get(file));
      else failedHere.add(file);
      current = undefined;
      // Between files, and after the last one, the process must move on or end, as a lone file's process would.
      fileTimer = setTimeout(() => {
        timedOut = `the shared process did not move on or exit within ${idleMs / 1000}s after ${file}`;
        terminateActiveChild(child);
      }, idleMs);
    });
    readline.createInterface({ input: child.stderr, crlfDelay: Infinity }).on('line', (line) => record('stderr', line));

    let settled = false;
    const finish = (reason) => {
      if (settled) return;
      settled = true;
      clearTimeout(fileTimer);
      releaseActiveChild(child);
      try {
        fs.rmSync(scratchDir, { recursive: true, force: true, maxRetries: 3 });
      } catch {
        // A child still exiting can hold a file open on Windows; the OS temp cleaner removes it.
      }
      const trusted = reason ? new Map() : passed;
      const alone = files.filter((file) => !trusted.has(file));
      if (alone.length > 0 && !interruption) {
        const why = reason ?? (failedHere.size > 0 ? `${failedHere.size} did not pass here` : 'the shared process ended early');
        process.stdout.write(`${label}: ${trusted.size} passed; running ${alone.length} alone (${why}).\n`);
        // What a file printed before failing here, or before the process died or stalled while it ran, helps when it
        // passes alone: it may depend on what ran before it.
        const shown = new Set([...failedHere, ...(current ? [current] : [])]);
        if (buffered) for (const file of shown) for (const [destination, text] of outputs.get(file)) destination.write(text);
      }
      resolve({
        passed: [...trusted].map(([file, durationMs]) => ({ file, durationMs, output: buffered ? outputs.get(file) : [] })),
        alone,
      });
    };
    child.once('error', (error) => finish(`could not start: ${error.message}`));
    child.once('close', (code, signal) => {
      if (timedOut) finish(timedOut);
      else if (code !== 0) finish(`the shared process exited with ${code ?? signal}`);
      else finish();
    });
  });
}

// Queue items: a file path, or a batch of batchable files run in one process.
export function queueItems(files, isolated) {
  if (isolated) return [...files];
  const batched = files.filter((file) => batchable(file, fs.readFileSync(path.join(repositoryRoot, file), 'utf8')));
  if (batched.length < 2) return [...files];
  const batchedSet = new Set(batched);
  const alone = files.filter((file) => !batchedSet.has(file));
  const batches = [];
  for (let index = 0; index < batched.length; index += BATCH_SIZE) batches.push(batched.slice(index, index + BATCH_SIZE));
  return [...batches, ...alone];
}

const itemWeight = (item) => (Array.isArray(item) ? item.reduce((sum, file) => sum + regressionTimeoutMs(file), 0) : regressionTimeoutMs(item));

async function main() {
  for (const signal of process.platform === 'win32' ? ['SIGINT', 'SIGTERM', 'SIGBREAK'] : ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => handleRunnerSignal(signal));
  }
  const { concurrency, filters, isolated, list, shard } = parseArguments(process.argv.slice(2));
  const discovered = discoverRegressions();
  if (discovered.length === 0) throw new Error('No regression files were discovered.');

  const matched = filters.length === 0 ? discovered : discovered.filter((file) => filters.some((filter) => file.includes(filter)));
  if (matched.length === 0) throw new Error(`No regression files matched filter: ${filters.join(', ')}`);
  const selected = shard ? shardOf(matched, shard) : matched;
  if (selected.length === 0) throw new Error(`Shard ${shard.index}/${shard.total} has no regression files.`);

  if (list) {
    for (const file of selected) process.stdout.write(`${file}\n`);
    return;
  }

  const items = queueItems(selected, isolated);
  const workers = Math.min(concurrency, items.length);
  const pooled = workers > 1;
  // A longer timeout marks a known slow file; in a pool those start first so they do not finish last.
  const queue = pooled ? items.sort((a, b) => itemWeight(b) - itemWeight(a)) : items;
  let results = [];
  const worker = async (buffered) => {
    while (!interruption && queue.length > 0) {
      const item = queue.shift();
      if (Array.isArray(item)) {
        const batch = await runBatch(item, buffered);
        if (interruption) return;
        for (const { file, durationMs, output } of batch.passed) {
          for (const [destination, text] of output) destination.write(text);
          results.push({ file, status: 'passed', durationMs });
          process.stdout.write(`[${file}] PASSED (${durationMs}ms, shared process)\n`);
        }
        queue.push(...batch.alone);
        continue;
      }
      const file = item;
      const { output, ...result } = await runRegression(file, buffered);
      for (const [destination, text] of output) destination.write(text);
      if (interruption) return;
      results.push({ file, ...result });
      const detail = result.status === 'failed'
        ? ` (exit ${result.code ?? 'unknown'}${result.signal ? `, ${result.signal}` : ''})`
        : result.status === 'start-error'
          ? ` (${result.error.message})`
          : '';
      process.stdout.write(`[${file}] ${result.status.toUpperCase()} (${result.durationMs}ms)${detail}\n`);
    }
  };
  // A runner error ends the run, as it did when files ran one at a time.
  await Promise.all(Array.from({ length: workers }, () => worker(pooled))).catch((error) => {
    queue.length = 0;
    for (const child of activeChildren.keys()) terminateActiveChild(child);
    throw error;
  });
  if (interruption) return;

  // ponytail: the per-file timeouts and a few wall-clock budgets assume one file at a time, so a file that does not
  // pass beside others gets one serial retry, which decides its result. Ceiling: more than SERIAL_RETRY_LIMIT misses
  // (say, a broken build) are reported without retries; upgrade path: timeouts and budgets that allow for a busy CPU.
  const retries = pooled ? results.filter((result) => result.status !== 'passed') : [];
  if (retries.length > 0 && retries.length <= SERIAL_RETRY_LIMIT) {
    process.stdout.write(`[runner] Retrying ${retries.length} file(s) that did not pass, one at a time.\n`);
    results = results.filter((result) => result.status === 'passed');
    queue.push(...retries.map((result) => result.file));
    await worker(false);
    if (interruption) return;
  } else if (retries.length > SERIAL_RETRY_LIMIT) {
    process.stdout.write(`[runner] ${retries.length} files did not pass; more than ${SERIAL_RETRY_LIMIT}, so none is retried.\n`);
  }

  const failed = results.filter((result) => result.status !== 'passed');
  for (const result of failed) process.stdout.write(`Regression not passed (${result.status}): ${result.file}\n`);
  process.stdout.write(`Regression summary: ${results.length - failed.length}/${results.length} passed; ${failed.length} failed.\n`);
  if (failed.length > 0) process.exitCode = 1;
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`[runner] ${error.message}\n`);
    process.exitCode = 1;
  });
}
