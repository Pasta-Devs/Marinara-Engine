#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

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
  if (relativePath === 'scripts/regressions/ruleset-combat-director.regression.ts') return 300_000;
  // An out-of-memory control and a small-heap 64 MB gallery round trip: 20 s alone, 26 s to over 60 s in the CI pool.
  if (relativePath === 'scripts/regressions/native-export-memory.regression.ts') return 90_000;
  // Real large-text, multipart and 10,001-entry transfers exceed 30 s on the CI file-backed store.
  if (relativePath === 'scripts/regressions/chat-request-validation.regression.ts') return 90_000;
  // Eighteen blink and talk pictures lined up with their face at full size: about 10 s, more on a busy runner.
  if (relativePath === 'scripts/regressions/avatar-variant-composite.regression.ts') return 120_000;
  return FILE_TIMEOUT_MS;
}

function discoverRegressions(directory = regressionsRoot) {
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

const USAGE = 'Usage: node scripts/run-regressions.mjs [--list] [--filter <text>] [--concurrency <n>] [--shard <i>/<n>]';

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
  let filter;
  let concurrency;
  let shard;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--') {
      continue;
    } else if (argument === '--list') {
      list = true;
    } else if (argument === '--filter') {
      if (filter !== undefined || index + 1 === args.length || args[index + 1] === '') {
        throw new Error(USAGE);
      }
      filter = args[index + 1];
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
  return { concurrency, filter, list, shard };
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

async function main() {
  for (const signal of process.platform === 'win32' ? ['SIGINT', 'SIGTERM', 'SIGBREAK'] : ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => handleRunnerSignal(signal));
  }
  const { concurrency, filter, list, shard } = parseArguments(process.argv.slice(2));
  const discovered = discoverRegressions();
  if (discovered.length === 0) throw new Error('No regression files were discovered.');

  const matched = filter === undefined ? discovered : discovered.filter((file) => file.includes(filter));
  if (matched.length === 0) throw new Error(`No regression files matched filter: ${filter}`);
  const selected = shard ? shardOf(matched, shard) : matched;
  if (selected.length === 0) throw new Error(`Shard ${shard.index}/${shard.total} has no regression files.`);

  if (list) {
    for (const file of selected) process.stdout.write(`${file}\n`);
    return;
  }

  const workers = Math.min(concurrency, selected.length);
  const pooled = workers > 1;
  // A longer timeout marks a known slow file; in a pool those start first so they do not finish last.
  const queue = pooled ? [...selected].sort(slowFirst) : [...selected];
  let results = [];
  const worker = async (buffered) => {
    while (!interruption && queue.length > 0) {
      const file = queue.shift();
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
