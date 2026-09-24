import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The launchers run `git clean -fd` on packages/*/src to repair leftovers from failed checkouts. On a development
// checkout that also deletes work that was never committed, so each launcher first copies every file the clean is
// about to remove into .tmp/untracked-src-backups/<timestamp>/.
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

for (const name of ["start.bat", "start.sh", "start-termux.sh"]) {
  const launcher = readFileSync(join(root, name), "utf8");
  const backup = launcher.search(/node scripts[\\/]preserve-untracked-src\.mjs/u);
  const clean = launcher.indexOf("git clean -fd -- packages/shared/src packages/server/src packages/client/src");
  assert.ok(backup > 0, `${name} runs the backup`);
  assert.ok(clean > backup, `${name} backs up before git clean`);
}

const repo = mkdtempSync(join(tmpdir(), "marinara-preserve-src-"));
try {
  const git = (...args) =>
    execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  git("init", "-q");
  mkdirSync(join(repo, "scripts"), { recursive: true });
  copyFileSync(join(root, "scripts", "preserve-untracked-src.mjs"), join(repo, "scripts", "preserve-untracked-src.mjs"));
  const write = (rel, text) => {
    mkdirSync(dirname(join(repo, rel)), { recursive: true });
    writeFileSync(join(repo, rel), text);
  };
  write(".gitignore", "*.log\n");
  write("packages/server/src/tracked.ts", "export const tracked = 1;\n");
  git("add", ".");
  git("-c", "user.email=regression@example.invalid", "-c", "user.name=Regression", "commit", "-q", "-m", "fixture");

  const run = () =>
    execFileSync(process.execPath, [join(repo, "scripts", "preserve-untracked-src.mjs")], {
      cwd: repo,
      encoding: "utf8",
      windowsHide: true,
    });

  // Nothing untracked: no backup folder, exit 0.
  run();
  assert.equal(existsSync(join(repo, ".tmp")), false);

  write("packages/server/src/new-module.ts", "export const draft = 2;\n");
  write("packages/client/src/deep/nested/Draft.tsx", "export {};\n");
  write("packages/server/src/ignored.log", "ignored by .gitignore, so git clean -fd leaves it alone\n");
  write("docs/outside.md", "outside the cleaned trees\n");
  const output = run();
  assert.match(output, /Backed up 2 untracked source file\(s\)/u);
  const backups = readdirSync(join(repo, ".tmp", "untracked-src-backups"));
  assert.equal(backups.length, 1);
  const backupRoot = join(repo, ".tmp", "untracked-src-backups", backups[0]);
  assert.equal(readFileSync(join(backupRoot, "packages/server/src/new-module.ts"), "utf8"), "export const draft = 2;\n");
  assert.ok(existsSync(join(backupRoot, "packages/client/src/deep/nested/Draft.tsx")));
  assert.equal(existsSync(join(backupRoot, "packages/server/src/ignored.log")), false, "only what git clean removes");
  assert.equal(existsSync(join(backupRoot, "docs/outside.md")), false);
  assert.equal(existsSync(join(backupRoot, "packages/server/src/tracked.ts")), false);

  // A backup problem never blocks startup.
  rmSync(join(repo, ".git"), { recursive: true, force: true });
  assert.match(run(), /\[WARN\] Could not back up untracked source files/u);
} finally {
  rmSync(repo, { recursive: true, force: true });
}

console.log("launcher preserve-untracked-src regression passed");
