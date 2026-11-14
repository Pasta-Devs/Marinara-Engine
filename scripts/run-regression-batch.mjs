// Runs several regression files one after another in this one process, so they share its start-up and module loading.
// scripts/run-regressions.mjs starts it under tsx with repository-relative paths, and reads the marker lines it prints:
// a file counts as passed only on its "pass" marker, and only when this process then exits 0. Each file sees the
// environment and working directory it started with; anything else it leaves behind stays for the next file, which
// is why only files the runner lists in BATCHED_REGRESSION_PREFIXES run here.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const BATCH_MARKER = "\u001e[regression-batch]";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function restoreEnvironment(saved) {
  for (const key of Object.keys(process.env)) if (!Object.hasOwn(saved, key)) delete process.env[key];
  Object.assign(process.env, saved);
}

async function runBatch(files) {
  for (const file of files) {
    const savedEnvironment = { ...process.env };
    const savedDirectory = process.cwd();
    process.stdout.write(`${BATCH_MARKER} start ${file}\n`);
    let outcome = "pass";
    try {
      await import(pathToFileURL(path.join(repositoryRoot, file)).href);
      // Never reset: a file may set it after it finished loading, while a later one runs, and a non-zero exit then
      // sends the whole batch to run alone.
      if (process.exitCode) outcome = "fail";
    } catch (error) {
      console.error(error);
      outcome = "fail";
    }
    restoreEnvironment(savedEnvironment);
    process.chdir(savedDirectory);
    process.stdout.write(`${BATCH_MARKER} ${outcome} ${file}\n`);
  }
  // The process then ends as a lone file's would: an error a file left scheduled fails the whole batch, and a timer or
  // server it left running keeps the process alive until the runner stops it. Either way every file then runs alone.
}

if (
  process.argv[1] &&
  fs.existsSync(process.argv[1]) &&
  fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runBatch(process.argv.slice(2));
}
