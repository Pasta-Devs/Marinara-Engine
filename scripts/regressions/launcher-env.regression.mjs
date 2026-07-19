import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { LAUNCHER_ENV_KEYS, readLauncherEnvValue } from "../read-launcher-env.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "marinara-launcher-env-"));
const envPath = join(temporaryDirectory, ".env");
const executionMarker = join(temporaryDirectory, "shell-executed");
const envContents = [
  `AUTO_UPDATE_ENABLED=$(printf shell-evaluated > ${executionMarker})`,
  "PORT=8123",
  'HOST="lan host" # dotenv comment',
  "SSL_CERT='certs/my cert.pem'",
  "SSL_KEY=keys/$USER.pem",
  "AUTO_OPEN_BROWSER=false",
  "BACKGROUNDREMOVER_AUTO_INSTALL=true",
  "BASIC_AUTH_REALM=My Private Server",
].join("\n");

try {
  writeFileSync(envPath, envContents);

  assert.equal(
    readLauncherEnvValue(envContents, "AUTO_UPDATE_ENABLED", {}),
    `$(printf shell-evaluated > ${executionMarker})`,
  );
  assert.equal(readLauncherEnvValue(envContents, "PORT", {}), "8123");
  assert.equal(readLauncherEnvValue(envContents, "HOST", {}), "lan host");
  assert.equal(readLauncherEnvValue(envContents, "SSL_CERT", {}), "certs/my cert.pem");
  assert.equal(readLauncherEnvValue(envContents, "SSL_KEY", {}), "keys/$USER.pem");
  assert.equal(readLauncherEnvValue(envContents, "AUTO_OPEN_BROWSER", {}), "false");
  assert.equal(readLauncherEnvValue(envContents, "BASIC_AUTH_REALM", {}), null);
  assert.equal(readLauncherEnvValue(envContents, "PORT", { PORT: "9000" }), null);
  assert.equal(readLauncherEnvValue(envContents, "PORT", { PORT: "" }), null);

  const cleanEnvironment = { ...process.env };
  for (const key of LAUNCHER_ENV_KEYS) delete cleanEnvironment[key];
  const helperPath = join(repositoryRoot, "scripts/read-launcher-env.mjs");
  const literalRead = spawnSync(process.execPath, [helperPath, envPath, "AUTO_UPDATE_ENABLED"], {
    encoding: "utf8",
    env: cleanEnvironment,
  });
  assert.equal(literalRead.status, 0, literalRead.stderr);
  assert.equal(literalRead.stdout, `$(printf shell-evaluated > ${executionMarker})`);
  assert.equal(existsSync(executionMarker), false, "dotenv command-substitution text must never execute");

  const ambientRead = spawnSync(process.execPath, [helperPath, envPath, "PORT"], {
    encoding: "utf8",
    env: { ...cleanEnvironment, PORT: "9000" },
  });
  assert.equal(ambientRead.status, 1);
  assert.equal(ambientRead.stdout, "");

  for (const launcherName of ["start.sh", "start-termux.sh"]) {
    const launcherPath = join(repositoryRoot, launcherName);
    const launcherSource = readFileSync(launcherPath, "utf8");
    assert.doesNotMatch(launcherSource, /^\s*(?:source|\.)\s+\.\/\.env\s*$/mu);
    assert.match(launcherSource, /node scripts\/read-launcher-env\.mjs \.env "\$setting_name"/u);
    assert.ok(
      launcherSource.indexOf("# Read only settings used by this launcher") >
        launcherSource.indexOf('if [ "$NODE_VERSION" -lt 24 ]'),
      `${launcherName} must wait until Node 24 is available before parsing .env`,
    );
    const syntaxCheck = spawnSync("bash", ["-n", launcherPath], { encoding: "utf8" });
    assert.equal(syntaxCheck.status, 0, syntaxCheck.stderr);
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

console.log("Launcher dotenv regressions passed.");
