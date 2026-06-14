import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function loadDotEnv() {
  const envPath = resolve(repoRoot, ".env");
  if (!existsSync(envPath)) return;

  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals <= 0) continue;
    const key = line.slice(0, equals).trim();
    const value = line.slice(equals + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function isEnabledFlag(value) {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

function spawnNode(label, script, extraEnv = {}) {
  const child = spawn(process.execPath, [script], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
    windowsHide: false,
  });
  child.once("error", (err) => {
    process.stderr.write(`[${label}] failed to start: ${err.stack ?? err}\n`);
  });
  return child;
}

loadDotEnv();

const port = process.env.PORT?.trim() || "7860";
const serverUrl = process.env.DISCORD_BRIDGE_SERVER_URL?.trim() || `http://127.0.0.1:${port}`;
const children = new Set();
let shuttingDown = false;

const server = spawnNode("server", "packages/server/dist/index.js");
children.add(server);

if (isEnabledFlag(process.env.DISCORD_BRIDGE_ENABLED)) {
  const bot = spawnNode("discord-bot", "packages/discord-bot/dist/index.js", {
    DISCORD_BRIDGE_SERVER_URL: serverUrl,
  });
  children.add(bot);
  bot.once("exit", (code, signal) => {
    children.delete(bot);
    if (!shuttingDown && code !== 0) {
      process.stderr.write(`[discord-bot] exited with code ${code ?? "null"} signal ${signal ?? "null"}\n`);
    }
  });
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

server.once("exit", (code, signal) => {
  children.delete(server);
  shutdown("SIGTERM");
  process.exit(code ?? (signal ? 1 : 0));
});
