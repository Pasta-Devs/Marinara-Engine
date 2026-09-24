#!/usr/bin/env node
// Copies untracked files under packages/*/src into a timestamped backup folder before the launchers run
// `git clean -fd` on those trees. The clean repairs stale leftovers from failed checkouts, but on a
// development checkout it also deletes work that was never committed; this keeps a copy of every file
// it is about to remove. Exits 0 in every case so a backup problem never blocks startup.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const trees = ["packages/shared/src", "packages/server/src", "packages/client/src"];

try {
  const output = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z", "--", ...trees], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true,
  });
  const files = output.split("\0").filter(Boolean);
  if (files.length > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupRoot = join(root, ".tmp", "untracked-src-backups", stamp);
    for (const file of files) {
      const target = join(backupRoot, file);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(root, file), target);
    }
    console.log(`  [..] Backed up ${files.length} untracked source file(s) to ${backupRoot} before cleanup.`);
  }
} catch (error) {
  console.log(`  [WARN] Could not back up untracked source files: ${error instanceof Error ? error.message : error}`);
}
