import { spawn, type ChildProcess } from "node:child_process";
import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { closeSync, existsSync, openSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { getBubblewrapRuntimeStatus } from "../sandbox/bubblewrap-runtime.js";

export type PersonalExtensionSandboxBackend = "macos-seatbelt" | "linux-bubblewrap";

export type PersonalExtensionSandboxStatus =
  | { available: true; backend: PersonalExtensionSandboxBackend }
  | { available: false; backend: null; reason: string };

export type SandboxedPersonalExtensionProcess = {
  backend: PersonalExtensionSandboxBackend;
  child: ChildProcess;
  protocol: {
    inputPath: string;
    outputPath: string;
    heartbeatPath: string;
    errorPath: string;
  };
  cleanup: () => Promise<void>;
};

const MACOS_SANDBOX_EXEC = "/usr/bin/sandbox-exec";
const RUNNER_SOURCE = fileURLToPath(new URL("../../assets/personal-extension-runner.mjs", import.meta.url));

function findBubblewrap() {
  const status = getBubblewrapRuntimeStatus();
  return status.available ? status.executable : null;
}

export function getPersonalExtensionSandboxStatus(): PersonalExtensionSandboxStatus {
  if (process.platform === "darwin" && existsSync(MACOS_SANDBOX_EXEC)) {
    return { available: true, backend: "macos-seatbelt" };
  }
  if (process.platform === "linux") {
    const status = getBubblewrapRuntimeStatus();
    if (status.available) return { available: true, backend: "linux-bubblewrap" };
    return { available: false, backend: null, reason: `Server extensions are disabled. ${status.reason}` };
  }
  return {
    available: false,
    backend: null,
    reason: `Server extensions are disabled because Marinara has no supported OS sandbox on ${process.platform}.`,
  };
}

function sandboxLiteral(path: string) {
  return JSON.stringify(realpathSync(path));
}

function macosProfile(
  sandboxDir: string,
  nodeExecutable: string,
  writablePaths: { outputPath: string; heartbeatPath: string; errorPath: string },
) {
  const readableRoots = [
    dirname(dirname(nodeExecutable)),
    sandboxDir,
    "/System",
    "/usr",
    "/bin",
    "/sbin",
    "/Library",
    "/dev",
  ]
    .filter((path) => existsSync(path))
    .map((path) => `    (subpath ${sandboxLiteral(path)})`)
    .join("\n");
  const writableFiles = Object.values(writablePaths)
    .map((path) => `    (literal ${sandboxLiteral(path)})`)
    .join("\n");
  return `(version 1)
(deny default)
(allow process-exec (literal ${sandboxLiteral(nodeExecutable)}))
(allow process-info* (target self))
(allow signal (target self))
(allow sysctl-read)
(allow mach-lookup)
(allow ipc-posix*)
(allow file-read-metadata)
(allow file-read*
    (literal "/")
${readableRoots})
(allow file-write*
${writableFiles}
    (literal "/dev/null"))
(deny network*)
`;
}

function linuxArgs(
  sandboxDir: string,
  nodeExecutable: string,
  writablePaths: { outputPath: string; heartbeatPath: string },
) {
  const args = [
    "--die-with-parent",
    "--new-session",
    "--unshare-all",
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--tmpfs",
    "/tmp",
  ];
  for (const path of ["/usr", "/bin", "/sbin", "/lib", "/lib64", "/etc", "/nix/store"]) {
    if (existsSync(path)) args.push("--ro-bind", path, path);
  }
  const nodeRoot = dirname(dirname(nodeExecutable));
  args.push("--ro-bind", nodeRoot, "/runtime-node");
  args.push("--ro-bind", sandboxDir, "/sandbox");
  args.push("--bind", writablePaths.outputPath, "/sandbox/output.jsonl");
  args.push("--bind", writablePaths.heartbeatPath, "/sandbox/heartbeat");
  args.push("--chdir", "/sandbox");
  args.push(
    `/runtime-node/bin/${basename(nodeExecutable)}`,
    "--permission",
    "--allow-fs-read=/sandbox/runner.mjs",
    "--allow-fs-read=/sandbox/input.jsonl",
    "--allow-fs-write=/sandbox/output.jsonl",
    "--allow-fs-write=/sandbox/heartbeat",
    "--max-old-space-size=64",
    "/sandbox/runner.mjs",
    "/sandbox/input.jsonl",
    "/sandbox/output.jsonl",
    "/sandbox/heartbeat",
  );
  return args;
}

export async function spawnSandboxedPersonalExtension(): Promise<SandboxedPersonalExtensionProcess> {
  const status = getPersonalExtensionSandboxStatus();
  if (!status.available) throw new Error(status.reason);

  const sandboxDir = realpathSync(await mkdtemp(join(tmpdir(), "marinara-extension-sandbox-")));
  const runnerPath = join(sandboxDir, "runner.mjs");
  const inputPath = join(sandboxDir, "input.jsonl");
  const outputPath = join(sandboxDir, "output.jsonl");
  const heartbeatPath = join(sandboxDir, "heartbeat");
  const errorPath = join(sandboxDir, "runner-error.log");
  await copyFile(RUNNER_SOURCE, runnerPath);
  await Promise.all([
    writeFile(inputPath, "", { mode: 0o600 }),
    writeFile(outputPath, "", { mode: 0o600 }),
    writeFile(heartbeatPath, "", { mode: 0o600 }),
    writeFile(errorPath, "", { mode: 0o600 }),
  ]);
  const nodeExecutable = realpathSync(process.execPath);
  const environment: NodeJS.ProcessEnv = {
    LANG: process.env.LANG ?? "C",
    LC_ALL: process.env.LC_ALL ?? "C",
    HOME: sandboxDir,
    TMPDIR: sandboxDir,
    TMP: sandboxDir,
    TEMP: sandboxDir,
  };

  let child: ChildProcess;
  const errorFd = openSync(errorPath, "a");
  try {
    if (status.backend === "macos-seatbelt") {
      child = spawn(
        MACOS_SANDBOX_EXEC,
        [
          "-p",
          macosProfile(sandboxDir, nodeExecutable, { outputPath, heartbeatPath, errorPath }),
          nodeExecutable,
          "--permission",
          `--allow-fs-read=${runnerPath}`,
          `--allow-fs-read=${inputPath}`,
          `--allow-fs-write=${outputPath}`,
          `--allow-fs-write=${heartbeatPath}`,
          "--max-old-space-size=64",
          runnerPath,
          inputPath,
          outputPath,
          heartbeatPath,
        ],
        {
          cwd: sandboxDir,
          env: environment,
          windowsHide: true,
          stdio: ["ignore", "ignore", errorFd],
        },
      );
    } else {
      child = spawn(findBubblewrap()!, linuxArgs(sandboxDir, nodeExecutable, { outputPath, heartbeatPath }), {
        cwd: resolve(sandboxDir),
        env: environment,
        windowsHide: true,
        stdio: ["ignore", "ignore", errorFd],
      });
    }
  } catch (error) {
    closeSync(errorFd);
    await rm(sandboxDir, { recursive: true, force: true });
    throw error;
  }
  closeSync(errorFd);

  let cleaned = false;
  return {
    backend: status.backend,
    child,
    protocol: { inputPath, outputPath, heartbeatPath, errorPath },
    cleanup: async () => {
      if (cleaned) return;
      cleaned = true;
      await rm(sandboxDir, { recursive: true, force: true });
    },
  };
}
