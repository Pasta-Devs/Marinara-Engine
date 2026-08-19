import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const checkerPath = join(repositoryRoot, "scripts/check-port-available.mjs");

function listen(server) {
  return new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
}

function close(server) {
  return new Promise((resolveClose, reject) => server.close((error) => (error ? reject(error) : resolveClose())));
}

function runChecker(port) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [checkerPath], {
      cwd: repositoryRoot,
      env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), SSL_CERT: "", SSL_KEY: "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (status) => resolveRun({ status, stdout, stderr }));
  });
}

const healthyServer = createServer((request, response) => {
  if (request.url === "/api/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", version: "2.4.4", build: "v2.4.4 regression" }));
    return;
  }
  response.writeHead(404).end();
});
await listen(healthyServer);
const healthyAddress = healthyServer.address();
assert.ok(healthyAddress && typeof healthyAddress === "object");
const healthyResult = await runChecker(healthyAddress.port);
assert.equal(healthyResult.status, 2, healthyResult.stderr);
assert.match(healthyResult.stdout, /Marinara Engine v2\.4\.4 regression is already running/u);
await close(healthyServer);

const unrelatedServer = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ status: "ok" }));
});
await listen(unrelatedServer);
const unrelatedAddress = unrelatedServer.address();
assert.ok(unrelatedAddress && typeof unrelatedAddress === "object");
const unrelatedResult = await runChecker(unrelatedAddress.port);
assert.equal(unrelatedResult.status, 1);
assert.match(unrelatedResult.stderr, /Port \d+ is already in use/u);
await close(unrelatedServer);

const freeResult = await runChecker(unrelatedAddress.port);
assert.equal(freeResult.status, 0, freeResult.stderr);

for (const launcherPath of ["start.bat", "start.sh"]) {
  const source = readFileSync(join(repositoryRoot, launcherPath), "utf8");
  const firstPortCheck = source.indexOf("check_launch_port");
  const updateCheck = source.indexOf("Checking for updates");
  assert.ok(
    firstPortCheck >= 0 && firstPortCheck < updateCheck,
    `${launcherPath} must reuse the server before updates`,
  );
  assert.match(source, /Reopening the running Marinara Engine instance/u);
}

console.log("Existing-server launcher regressions passed.");
