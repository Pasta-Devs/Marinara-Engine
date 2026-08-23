#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const FILE_TIMEOUT_MS = 30_000; // Each regression has a fixed 30-second budget.
const REGRESSION_SUFFIXES = ['.regression.ts', '.regression.mjs', '.regression.js'];
const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143, SIGBREAK: 1 };
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const regressionsRoot = path.join(repositoryRoot, 'scripts', 'regressions');
const serverRequire = createRequire(path.join(repositoryRoot, 'packages', 'server', 'package.json'));
let activeChild;
let activeTermination = false;
let activeForceTimer;
let interruption;

function repositoryRelative(file) {
  return path.relative(repositoryRoot, file).split(path.sep).join('/');
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

function parseArguments(args) {
  let list = false;
  let filter;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--') {
      continue;
    } else if (argument === '--list') {
      list = true;
    } else if (argument === '--filter') {
      if (filter !== undefined || index + 1 === args.length || args[index + 1] === '') {
        throw new Error('Usage: node scripts/run-regressions.mjs [--list] [--filter <text>]');
      }
      filter = args[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return { filter, list };
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

function terminateActiveChild() {
  if (!activeChild || activeTermination) return;
  activeTermination = true;
  terminateChild(activeChild);
  activeForceTimer = setTimeout(() => forceTerminateChild(activeChild), 2_000);
}

function releaseActiveChild(child) {
  if (activeChild !== child) return;
  clearTimeout(activeForceTimer);
  activeForceTimer = undefined;
  activeChild = undefined;
  activeTermination = false;
}

function handleRunnerSignal(signal) {
  if (interruption) return;
  interruption = signal;
  process.exitCode = SIGNAL_EXIT_CODES[signal];
  process.stderr.write(`[runner] ${signal} received; terminating active regression.\n`);
  terminateActiveChild();
}

for (const signal of process.platform === 'win32' ? ['SIGINT', 'SIGTERM', 'SIGBREAK'] : ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => handleRunnerSignal(signal));
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

function runRegression(relativePath) {
  const { args, command, cwd } = commandFor(relativePath);
  const startedAt = Date.now();
  process.stdout.write(`[${relativePath}] START\n`);

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    activeChild = child;
    pipeWithContext(child.stdout, relativePath, 'stdout', process.stdout);
    pipeWithContext(child.stderr, relativePath, 'stderr', process.stderr);

    let settled = false;
    let timedOut = false;
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      process.stderr.write(`[${relativePath}] TIMEOUT after ${FILE_TIMEOUT_MS / 1000}s; terminating child.\n`);
      terminateActiveChild();
    }, FILE_TIMEOUT_MS);

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      releaseActiveChild(child);
      resolve({ ...result, durationMs: Date.now() - startedAt });
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
  const { filter, list } = parseArguments(process.argv.slice(2));
  const discovered = discoverRegressions();
  if (discovered.length === 0) throw new Error('No regression files were discovered.');

  const selected = filter === undefined ? discovered : discovered.filter((file) => file.includes(filter));
  if (selected.length === 0) throw new Error(`No regression files matched filter: ${filter}`);

  if (list) {
    for (const file of selected) process.stdout.write(`${file}\n`);
    return;
  }

  const results = [];
  for (const file of selected) {
    if (interruption) return;
    const result = await runRegression(file);
    results.push({ file, ...result });
    if (interruption) return;
    const detail = result.status === 'failed'
      ? ` (exit ${result.code ?? 'unknown'}${result.signal ? `, ${result.signal}` : ''})`
      : result.status === 'start-error'
        ? ` (${result.error.message})`
        : '';
    process.stdout.write(`[${file}] ${result.status.toUpperCase()} (${result.durationMs}ms)${detail}\n`);
  }

  const failed = results.filter((result) => result.status !== 'passed').length;
  process.stdout.write(`Regression summary: ${results.length - failed}/${results.length} passed; ${failed} failed.\n`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`[runner] ${error.message}\n`);
  process.exitCode = 1;
});
