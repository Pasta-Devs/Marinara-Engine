import { lchownSync, lstatSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { constants as osConstants } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const DEFAULT_COMMAND = ["node", "packages/server/dist/index.js"];

function log(message) {
  process.stderr.write(`[docker-entrypoint] ${message}\n`);
}

function parseNameServiceFile(path, nameOrId, fieldIndex) {
  if (/^\d+$/.test(nameOrId)) return Number(nameOrId);

  let rows;
  try {
    rows = readFileSync(path, "utf8").split("\n");
  } catch {
    return null;
  }

  for (const row of rows) {
    const fields = row.split(":");
    if (fields[0] === nameOrId) {
      const parsed = Number(fields[fieldIndex]);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}

function resolveUid(user) {
  return parseNameServiceFile("/etc/passwd", user, 2);
}

function resolveGid(group) {
  return parseNameServiceFile("/etc/group", group, 2);
}

function resolveHomeDir(user) {
  let rows;
  try {
    rows = readFileSync("/etc/passwd", "utf8").split("\n");
  } catch {
    return null;
  }

  for (const row of rows) {
    const fields = row.split(":");
    if (fields[0] === user || fields[2] === user) return fields[5] || null;
  }
  return null;
}

function resolveStoragePath(value) {
  if (!value) return null;
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

function isSameOrDescendant(parent, candidate) {
  const nestedPath = relative(parent, candidate);
  return nestedPath === "" || (nestedPath !== ".." && !nestedPath.startsWith(`..${sep}`) && !isAbsolute(nestedPath));
}

function minimizeOwnershipRoots(paths) {
  const roots = [...new Set(paths.map((path) => resolve(path)))].sort(
    (left, right) => left.length - right.length || left.localeCompare(right),
  );
  return roots.filter(
    (candidate, index) => !roots.slice(0, index).some((parent) => isSameOrDescendant(parent, candidate)),
  );
}

function hasExpectedOwnership(path, uid, gid) {
  const stat = lstatSync(path);
  return stat.uid === uid && stat.gid === gid;
}

function findOwnershipRepairRoots(dataDir, fileStorageDir, uid, gid) {
  // A moved or restored data directory still gets the original full-tree repair. When its root is already correct,
  // limit discovery to common top-level imports while always checking storage, whose permission hardening is recursive.
  if (!hasExpectedOwnership(dataDir, uid, gid)) {
    return minimizeOwnershipRoots([dataDir, fileStorageDir]);
  }

  const repairRoots = [fileStorageDir];
  for (const child of readdirSync(dataDir)) {
    const childPath = join(dataDir, child);
    if (resolve(childPath) === resolve(fileStorageDir)) continue;
    if (!hasExpectedOwnership(childPath, uid, gid)) repairRoots.push(childPath);
  }
  return minimizeOwnershipRoots(repairRoots);
}

function chownRecursive(path, uid, gid) {
  const stack = [path];
  let firstError = null;
  let repairedEntries = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    try {
      const stat = lstatSync(current);
      if (stat.uid !== uid || stat.gid !== gid) {
        lchownSync(current, uid, gid);
        repairedEntries += 1;
      }
      if (!stat.isDirectory() || stat.isSymbolicLink()) continue;

      for (const child of readdirSync(current)) {
        stack.push(join(current, child));
      }
    } catch (error) {
      firstError ??= error;
    }
  }

  if (firstError) throw firstError;
  return repairedEntries;
}

function prepareDataDirectories(uid, gid) {
  const dataDir = resolveStoragePath(process.env.DATA_DIR) ?? "/app/data";
  const fileStorageDir = resolveStoragePath(process.env.FILE_STORAGE_DIR) ?? join(dataDir, "storage");
  const dirs = [...new Set([dataDir, fileStorageDir])];

  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }

  if (process.env.MARINARA_SKIP_DATA_CHOWN === "true") return;

  for (const dir of findOwnershipRepairRoots(dataDir, fileStorageDir, uid, gid)) {
    const repairedEntries = chownRecursive(dir, uid, gid);
    if (repairedEntries > 0) {
      log(`Repaired ownership for ${repairedEntries} ${repairedEntries === 1 ? "entry" : "entries"} under ${dir}`);
    }
  }
}

function dropPrivileges(uid, gid) {
  process.setgid(gid);
  process.setuid(uid);
}

function run() {
  const command = process.argv.slice(2);
  const [bin, ...args] = command.length > 0 ? command : DEFAULT_COMMAND;

  if (process.getuid?.() === 0) {
    const user = process.env.MARINARA_DOCKER_USER ?? "node";
    const group = process.env.MARINARA_DOCKER_GROUP ?? user;
    const uid = resolveUid(user);
    const gid = resolveGid(group);
    const homeDir = resolveHomeDir(user);

    if (uid == null || gid == null) {
      log(`Could not resolve runtime user "${user}:${group}"; continuing as root.`);
    } else {
      try {
        prepareDataDirectories(uid, gid);
      } catch (error) {
        log(`Could not repair data directory ownership: ${error instanceof Error ? error.message : String(error)}`);
      }
      dropPrivileges(uid, gid);
      if (homeDir) {
        process.env.HOME = homeDir;
      }
    }
  }

  // An in-app restart exits 75 and gets a new server here, so Restart Server works without a Docker restart policy.
  let child;
  let stopping = false;
  const start = () => {
    child = spawn(bin, args, {
      stdio: "inherit",
      env: { ...process.env, MARINARA_RESTART_SUPERVISOR: String(process.pid) },
    });
    child.on("error", (error) => {
      log(`Failed to start ${bin}: ${error.message}`);
      process.exit(1);
    });
    child.on("exit", (code, signal) => {
      if (code === 75 && !stopping) return start();
      if (signal) {
        process.exit(128 + (osConstants.signals[signal] ?? 0));
      }
      process.exit(code ?? 0);
    });
  };
  const forwardSignal = (signal) => {
    stopping = true;
    child.kill(signal);
  };

  process.on("SIGINT", forwardSignal);
  process.on("SIGTERM", forwardSignal);
  start();
}

run();
