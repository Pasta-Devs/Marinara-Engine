import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const supportedOnnxTuples = new Set([
  "darwin/arm64",
  "darwin/x64",
  "linux/arm64",
  "linux/x64",
  "win32/arm64",
  "win32/x64",
]);
const checks = [
  { workspace: ".", packageName: "esbuild" },
  { workspace: "packages/server", packageName: "pino" },
  { workspace: "packages/client", packageName: "react" },
];

export function workspaceLockfileMatches(root) {
  try {
    const expectedLockfile = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const installedLockfile = readFileSync(join(root, "node_modules", ".pnpm", "lock.yaml"), "utf8");
    return (
      expectedLockfile.replace(/\r\n?/gu, "\n") === installedLockfile.replace(/\r\n?/gu, "\n")
    );
  } catch {
    return false;
  }
}

export function getWorkspaceInstallProblems({
  root = process.cwd(),
  platform = process.platform,
  arch = process.arch,
} = {}) {
  const missing = [];

  if (!workspaceLockfileMatches(root)) {
    missing.push("workspace dependencies matching pnpm-lock.yaml");
  }

  for (const check of checks) {
    const requireFromWorkspace = createRequire(resolve(root, check.workspace, "package.json"));
    try {
      requireFromWorkspace.resolve(check.packageName);
    } catch {
      missing.push(`${check.packageName} from ${check.workspace}`);
    }
  }

  const onnxTuple = `${platform}/${arch}`;
  if (supportedOnnxTuples.has(onnxTuple)) {
    const requireFromServer = createRequire(resolve(root, "packages/server/package.json"));
    try {
      const packageDir = dirname(requireFromServer.resolve("onnxruntime-node/package.json"));
      const bindingPath = join(packageDir, "bin", "napi-v6", platform, arch, "onnxruntime_binding.node");
      if (!existsSync(bindingPath)) {
        missing.push(`onnxruntime-node native binding for ${onnxTuple}`);
      }
    } catch {
      missing.push("onnxruntime-node from packages/server");
    }
  }

  if (platform === "android") {
    const requireFromServer = createRequire(resolve(root, "packages/server/package.json"));
    try {
      requireFromServer("sharp");
    } catch {
      missing.push("sharp WebAssembly runtime for android");
    }
  }

  return missing;
}

function main() {
  const missing = getWorkspaceInstallProblems();
  if (missing.length > 0) {
    console.error(
      `Incomplete Marinara dependency install. Missing: ${missing.join(", ")}. Run \`pnpm install --frozen-lockfile\` from the repository root.`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
