import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { pathToFileURL } from "node:url";

export const LAUNCHER_ENV_KEYS = [
  "AUTO_UPDATE_ENABLED",
  "MARINARA_MAX_RESIDENT_CHATS",
  "PORT",
  "HOST",
  "SSL_CERT",
  "SSL_KEY",
  "AUTO_OPEN_BROWSER",
  "DATA_DIR",
  "BACKGROUNDREMOVER_AUTO_INSTALL",
];

const LAUNCHER_ENV_KEY_SET = new Set(LAUNCHER_ENV_KEYS);

export function readLauncherEnvValue(contents, key, ambientEnv = process.env) {
  if (!LAUNCHER_ENV_KEY_SET.has(key) || ambientEnv[key] !== undefined) return null;
  const parsed = parseEnv(contents);
  return Object.prototype.hasOwnProperty.call(parsed, key) ? parsed[key] : null;
}

function main() {
  const [, , envPath, key] = process.argv;
  if (!envPath || !key || !LAUNCHER_ENV_KEY_SET.has(key)) {
    process.exitCode = 2;
    return;
  }

  try {
    const value = readLauncherEnvValue(readFileSync(envPath, "utf8"), key);
    if (value === null) {
      process.exitCode = 1;
      return;
    }
    process.stdout.write(value);
  } catch {
    process.exitCode = 1;
  }
}

// pathToFileURL handles Windows drive letters; new URL(path, "file:") parses
// "D:" as a URL scheme and crashes fileURLToPath with ERR_INVALID_URL_SCHEME.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
