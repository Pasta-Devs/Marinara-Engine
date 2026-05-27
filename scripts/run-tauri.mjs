import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

const cargoHome = process.env.CARGO_HOME || (process.env.HOME ? join(process.env.HOME, ".cargo") : "");
const cargoBin = cargoHome ? join(cargoHome, "bin") : "";

const env = { ...process.env };
const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") || "PATH";

if (cargoBin && existsSync(cargoBin)) {
  env[pathKey] = [cargoBin, env[pathKey]].filter(Boolean).join(delimiter);
}

const tauriBin = process.platform === "win32" ? "tauri.cmd" : "tauri";
const child = spawn(tauriBin, process.argv.slice(2), {
  env,
  shell: process.platform === "win32",
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
