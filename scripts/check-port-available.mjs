import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rawPort = process.env.PORT ?? "7860";
const port = Number.parseInt(rawPort, 10);
const host = process.env.HOST ?? "0.0.0.0";
const protocol = process.env.SSL_CERT && process.env.SSL_KEY ? "https" : "http";
const browserHost = host === "" || host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
const urlHost = browserHost.includes(":") && !browserHost.startsWith("[") ? `[${browserHost}]` : browserHost;
const browserUrl = `${protocol}://${urlHost}:${rawPort}`;

async function findRunningMarinara() {
  try {
    const response = await fetch(`${browserUrl}/api/health`, {
      signal: AbortSignal.timeout(1_500),
    });
    if (!response.ok) return null;
    const health = await response.json();
    if (!health || typeof health !== "object" || health.status !== "ok") return null;
    // A Marinara that requires sign-in tells this unauthenticated probe only `{ status: "ok" }`.
    if (Object.keys(health).length === 1) return health;
    if (typeof health.version !== "string" || typeof health.build !== "string") return null;
    return health;
  } catch {
    return null;
  }
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The commit this folder holds now, or null when it is not a Git checkout. */
function readCheckoutCommit() {
  try {
    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000,
    }).trim();
    return /^[0-9a-f]{7,64}$/iu.test(head) ? head.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * A Marinara left running from before a branch switch or a manual update keeps serving its
 * old build. Reopening it would show the old version with no hint why, so a running server
 * whose commit is not this folder's commit is reported instead of reused.
 */
function isOtherBuild(health, checkoutCommit) {
  if (!checkoutCommit || typeof health.commit !== "string") return false;
  const runningCommit = health.commit.trim().toLowerCase();
  if (!/^[0-9a-f]{7,64}$/u.test(runningCommit)) return false;
  return !checkoutCommit.startsWith(runningCommit);
}

function printOtherBuildMessage(health, checkoutCommit) {
  console.error("");
  console.error(`  [ERROR] A different version of Marinara Engine is still running at ${browserUrl}.`);
  console.error(`          Running build: ${health.build || health.commit}`);
  console.error(`          This folder:   ${checkoutCommit.slice(0, 12)}`);
  console.error("");
  console.error("  Opening it would show that version instead of this folder's.");
  console.error("  Close the Marinara console window that is still open (or press Ctrl+C in it),");
  console.error("  then start Marinara again.");
  console.error("");
}

function printPortBusyMessage() {
  console.error("");
  console.error(`  [ERROR] Port ${rawPort} is already in use.`);
  console.error(
    "  Marinara Engine did not start, and the browser was not opened to avoid showing another local service.",
  );
  console.error("  Close the app using that port or start Marinara on another port:");
  console.error("");
  console.error("    macOS/Linux:       PORT=7869 bash ./start.sh");
  console.error("    Windows PowerShell: $env:PORT=7869; .\\start.bat");
  console.error("    Windows cmd:        set PORT=7869 && start.bat");
  console.error("");
}

if (!Number.isFinite(port) || port <= 0 || port > 65_535) {
  console.error("");
  console.error(`  [ERROR] PORT must be a number from 1 to 65535. Received: ${rawPort}`);
  console.error("");
  process.exit(1);
}

const runningMarinara = await findRunningMarinara();
if (runningMarinara) {
  const checkoutCommit = readCheckoutCommit();
  if (isOtherBuild(runningMarinara, checkoutCommit)) {
    printOtherBuildMessage(runningMarinara, checkoutCommit);
    process.exit(1);
  }
  console.log(
    runningMarinara.build
      ? `  [OK] Marinara Engine ${runningMarinara.build} is already running at ${browserUrl}`
      : `  [OK] Marinara Engine is already running at ${browserUrl} (sign-in required)`,
  );
  process.exit(2);
}

const server = createServer();

server.once("error", (err) => {
  if (err && typeof err === "object" && "code" in err && err.code === "EADDRINUSE") {
    printPortBusyMessage();
  } else {
    console.error("");
    console.error(`  [ERROR] Could not check whether ${host}:${rawPort} is available.`);
    console.error(err);
    console.error("");
  }
  process.exit(1);
});

server.listen({ host, port }, () => {
  server.close(() => {
    process.exit(0);
  });
});
