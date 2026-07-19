import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

export const LAUNCHER_ENV_KEYS = [
  "AUTO_UPDATE_ENABLED",
  "PORT",
  "HOST",
  "SSL_CERT",
  "SSL_KEY",
  "AUTO_OPEN_BROWSER",
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

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(process.argv[1], "file:"))) {
  main();
}
