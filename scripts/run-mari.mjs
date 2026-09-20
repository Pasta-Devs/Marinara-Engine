#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
if (args[0] === "--") args.shift();

const child = spawn(process.execPath, [resolve(rootDir, "packages/server/dist/bin/mari.js"), ...args], {
  stdio: "inherit",
  windowsHide: true,
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
