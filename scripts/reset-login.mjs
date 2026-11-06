// Removes the remote login saved in the app (DATA_DIR/.remote-login.json) and
// signs every browser out (DATA_DIR/.remote-sessions.json). A running server
// notices within a few seconds. A login set with BASIC_AUTH_USER and
// BASIC_AUTH_PASS in .env is not touched. In Docker the image ships this file:
//   docker exec <container> pnpm reset-login
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readLauncherEnvValue } from "./read-launcher-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverRoot = join(root, "packages", "server");
// Same .env the server reads: MARINARA_ENV_FILE (relative to the repo root) or the root .env.
const envPath = resolve(root, process.env.MARINARA_ENV_FILE?.trim() || ".env");
const configured =
  process.env.DATA_DIR?.trim() ||
  (existsSync(envPath) ? readLauncherEnvValue(readFileSync(envPath, "utf8"), "DATA_DIR")?.trim() : null);
const dataDir = configured ? resolve(serverRoot, configured) : join(serverRoot, "data");
const loginFile = join(dataDir, ".remote-login.json");

if (existsSync(loginFile)) {
  rmSync(loginFile);
  console.log(
    `Removed the app login (${loginFile}). Remote devices need a new login; this computer still opens Marinara without one.`,
  );
} else {
  console.log(`No app login found at ${loginFile}.`);
}
const sessionsFile = join(dataDir, ".remote-sessions.json");
try {
  rmSync(sessionsFile, { force: true });
  console.log(`Signed out every browser (${sessionsFile}).`);
} catch (err) {
  console.error(
    `Could not remove ${sessionsFile} (${err.code ?? err.message}). Delete it by hand to sign out every browser.`,
  );
  process.exitCode = 1;
}
