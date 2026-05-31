import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

const cargoHome = process.env.CARGO_HOME || (process.env.HOME ? join(process.env.HOME, ".cargo") : "");
const cargoBin = cargoHome ? join(cargoHome, "bin") : "";

const env = { ...process.env };
const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") || "PATH";
const tauriArgs = process.argv.slice(2);
const isTauriDev = tauriArgs[0] === "dev";
const autoDevtoolsEnv = "MARINARA_TAURI_AUTO_DEVTOOLS";
const webview2DebugArg = "--remote-debugging-port=9222";
const devtoolsFeature = "devtools";

function splitCargoFeatures(value) {
  return value.split(/[,\s]+/).filter(Boolean);
}

function hasCargoFeature(args, feature) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") {
      return false;
    }
    if (arg === "--features" || arg === "-f") {
      for (let featureIndex = index + 1; featureIndex < args.length; featureIndex += 1) {
        const value = args[featureIndex];
        if (!value || value.startsWith("-")) {
          break;
        }
        if (splitCargoFeatures(value).includes(feature)) {
          return true;
        }
      }
      continue;
    }
    if (arg.startsWith("--features=")) {
      if (splitCargoFeatures(arg.slice("--features=".length)).includes(feature)) {
        return true;
      }
    }
  }
  return false;
}

function insertBeforeRunnerArgs(args, values) {
  const separatorIndex = args.indexOf("--");
  if (separatorIndex === -1) {
    args.push(...values);
    return;
  }
  args.splice(separatorIndex, 0, ...values);
}

if (cargoBin && existsSync(cargoBin)) {
  env[pathKey] = [cargoBin, env[pathKey]].filter(Boolean).join(delimiter);
}

if (isTauriDev) {
  env[autoDevtoolsEnv] ??= "1";
  if (!hasCargoFeature(tauriArgs, devtoolsFeature)) {
    insertBeforeRunnerArgs(tauriArgs, ["--features", devtoolsFeature]);
  }

  if (
    process.platform === "win32" &&
    !env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS?.includes("--remote-debugging-port=")
  ) {
    env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = [env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS, webview2DebugArg]
      .filter(Boolean)
      .join(" ");
    console.info("[tauri dev] WebView2 debugging enabled at http://127.0.0.1:9222");
  }

  if (process.platform === "linux") {
    console.info("[tauri dev] WebKitGTK inspection enabled through the native Web Inspector.");
  }

  if (process.platform === "darwin") {
    console.info("[tauri dev] WebKit inspection enabled through Safari Web Inspector.");
  }
}

const tauriBin = process.platform === "win32" ? "tauri.cmd" : "tauri";
const child = spawn(tauriBin, tauriArgs, {
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
