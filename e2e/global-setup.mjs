import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(repoRoot, ".tmp/playwright-data");

export function resetPlaywrightData() {
  rmSync(dataDir, { recursive: true, force: true });
  mkdirSync(dataDir, { recursive: true });
}

export default async function globalSetup() {
  // The web-server command resets this directory before the server opens it.
  // Removing a live file-backed store here races startup and leaves stale state
  // in memory, so global setup only guarantees that the directory exists.
  mkdirSync(dataDir, { recursive: true });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  resetPlaywrightData();
}
