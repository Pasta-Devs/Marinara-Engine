// Professor Mari's boundaries around server secrets and code she can edit:
// - the auto-generated encryption key (DATA_DIR/.encryption-key) is as secret as .env, for her tools and shell;
// - saved data (DATA_DIR/storage) is read-only to her shell, as it already is to her write tool;
// - her shell can neither read nor change .git, .env or the key file, nor create them where they do not exist yet;
// - `mari code check` runs pnpm check in the shell sandbox without the server's environment, or not at all when
//   no sandbox exists, because pnpm check executes workspace scripts she can change. Only a real help flag keeps
//   it direct.
import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const workspace = realpathSync(mkdtempSync(join(tmpdir(), "marinara-mari-secrets-")));
const shimDir = realpathSync(mkdtempSync(join(tmpdir(), "marinara-mari-pnpm-shim-")));
const dataDir = join(workspace, "packages", "server", "data");
const storageDir = join(dataDir, "storage");
const keyFile = join(dataDir, ".encryption-key");
const serverDist = join(workspace, "packages", "server", "dist");
const KEY = "ab".repeat(32);
const SECRET = "server-secret-mari-must-not-see";
const ENV_FILE = "ENV_SECRET=env-secret-mari-must-not-see\n";
const GIT_CONFIG = "[core]\n\tbare = false\n";
const originalEnv = {
  FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR,
  MARINARA_GIT_COMMIT: process.env.MARINARA_GIT_COMMIT,
  PATH: process.env.PATH,
  MARI_CHECK_REGRESSION_SECRET: process.env.MARI_CHECK_REGRESSION_SECRET,
};
process.env.FILE_STORAGE_DIR = storageDir;

const {
  buildMacosWorkspaceShellProfile,
  getWorkspaceShellSandboxStatus,
  linuxBubblewrapArgs,
  spawnWorkspaceSandboxedShell,
  workspacePolicyPaths,
} = await import("../../../packages/server/src/services/professor-mari/workspace-shell-sandbox.js");
const { workspacePathAccessPolicy } =
  await import("../../../packages/server/src/services/professor-mari/workspace-change-review.service.js");
const { ProfessorMariWorkspaceService, workspaceMutationTargetForPath } =
  await import("../../../packages/server/src/services/professor-mari/workspace-agent.service.js");

async function sandboxRun(command: string) {
  const sandboxed = await spawnWorkspaceSandboxedShell({ command, workspaceRoot: workspace, env: process.env });
  let output = "";
  sandboxed.child.stdout?.on("data", (chunk) => (output += String(chunk)));
  sandboxed.child.stderr?.on("data", (chunk) => (output += String(chunk)));
  const code = await new Promise<number | null>((resolve) => sandboxed.child.on("close", resolve));
  await sandboxed.cleanup();
  return { code, output };
}

try {
  mkdirSync(join(storageDir, "tables"), { recursive: true });
  mkdirSync(serverDist, { recursive: true });
  mkdirSync(join(workspace, "scripts"));
  writeFileSync(keyFile, `${KEY}\n`, { mode: 0o600 });
  writeFileSync(join(workspace, ".env"), ENV_FILE, { mode: 0o600 });
  mkdirSync(join(workspace, ".git"));
  writeFileSync(join(workspace, ".git", "config"), GIT_CONFIG);
  writeFileSync(join(storageDir, "tables", "app_settings.json"), "original\n");
  writeFileSync(join(serverDist, "index.js"), "built\n");
  let linked = true;
  try {
    symlinkSync(keyFile, join(workspace, "key-link"));
  } catch {
    linked = false;
  }

  // 1. The key file is forbidden under every spelling the file system opens, like .env and Git internals.
  for (const name of [".encryption-key", ".ENCRYPTION-KEY", ".encryption-key.", ".encryption-key::$DATA"]) {
    assert.equal(workspacePathAccessPolicy(workspace, join(dataDir, name)), "forbidden", name);
  }
  for (const path of [".env", ".env::$DATA", ".env.local.", ".git/config", ".git./config", ".GIT/hooks/pre-commit"]) {
    assert.equal(workspacePathAccessPolicy(workspace, join(workspace, path)), "forbidden", path);
  }
  for (const path of [".env.example", "packages/server/data/encryption-key-notes.md", "src/.encryption-keys.ts"]) {
    assert.equal(workspacePathAccessPolicy(workspace, join(workspace, path)), "normal", path);
  }
  const secretRefusal = /cannot access secret files/u;
  for (const path of ["packages/server/data/.encryption-key", ...(linked ? ["key-link"] : [])]) {
    assert.throws(() => workspaceMutationTargetForPath(workspace, path, { readOnly: true }), secretRefusal, path);
    assert.throws(
      () =>
        workspaceMutationTargetForPath(workspace, path, {
          allowMissing: true,
          forbidStorageMutation: true,
          requireOrdinaryMutationPath: true,
        }),
      secretRefusal,
      `${path} cannot be overwritten or deleted either`,
    );
  }

  const service = new ProfessorMariWorkspaceService({} as never);
  service.setEnabled(true, workspace);
  const runner = service as unknown as {
    executeWorkspaceCommand(
      command: { id: string; name: string; arguments: Record<string, unknown> },
      signal: AbortSignal,
      trace: unknown[],
      onEvent: () => void,
    ): Promise<{ output: string; success: boolean }>;
  };
  let commandId = 0;
  const run = (name: string, args: Record<string, unknown>) =>
    runner.executeWorkspaceCommand(
      { id: `secrets-${commandId++}`, name, arguments: args },
      new AbortController().signal,
      [],
      () => undefined,
    );
  const read = await run("read", { path: "packages/server/data/.encryption-key" });
  assert.equal(read.success, false);
  assert.ok(!read.output.includes(KEY), "the read tool never shows the key");

  // 2. Both sandboxes deny the key file and keep saved data read-only.
  const policy = await workspacePolicyPaths(workspace);
  assert.ok(policy.forbidden.includes(keyFile), "the key file gets the same deny rule as .env");
  assert.equal(policy.storageDir, storageDir);
  const profile = await buildMacosWorkspaceShellProfile(workspace, {}, tmpdir(), true, "/bin/bash", true);
  assert.ok(profile.includes(`(deny file-write*\n    (subpath ${JSON.stringify(storageDir)}))`));
  const forbiddenRule = profile.slice(profile.indexOf("(deny file-read* file-write*\n"));
  assert.ok(profile.includes("(deny file-read* file-write*\n"), "forbidden paths are closed to writes, not only reads");
  assert.ok(forbiddenRule.includes(`(subpath ${JSON.stringify(keyFile)})`));
  assert.ok(forbiddenRule.includes(`(literal ${JSON.stringify(dataDir)})`), "the folder holding the key is pinned");
  const bwrap = (await linuxBubblewrapArgs(workspace, {}, tmpdir(), "/bin/bash", ["-c", "true"], true)).join("\0");
  assert.ok(bwrap.includes(`--ro-bind\0/dev/null\0${keyFile}`));
  assert.ok(bwrap.includes(`--ro-bind\0${storageDir}\0${storageDir}`));
  assert.ok(bwrap.includes(`--ro-bind\0${serverDist}\0${serverDist}`));
  // Only mari code check lifts the build-output rule, so its build can finish, and reads the .tools folder in pnpm's
  // home, where the pinned pnpm waits. A stray pnpm outside a package named pnpm opens nothing around it.
  const pnpmHome = join(shimDir, "pnpm-home");
  const pnpmTools = join(pnpmHome, ".tools");
  mkdirSync(pnpmTools, { recursive: true });
  writeFileSync(join(shimDir, "pnpm"), '#!/bin/sh\nexec node check.mjs "$@"\n');
  chmodSync(join(shimDir, "pnpm"), 0o755);
  const pnpmEnv = { PATH: shimDir, PNPM_HOME: pnpmHome };
  const subpath = (path: string) => `(subpath ${JSON.stringify(path)})`;
  const sandboxTemp = join(shimDir, "sandbox-temp");
  mkdirSync(sandboxTemp);
  const checkProfile = await buildMacosWorkspaceShellProfile(
    workspace,
    pnpmEnv,
    sandboxTemp,
    true,
    "/bin/bash",
    true,
    true,
  );
  assert.ok(!checkProfile.includes("/dist(-"), "the check's build may write dist");
  assert.ok(checkProfile.includes(`${subpath(storageDir)})`), "saved data stays read-only");
  assert.ok(checkProfile.includes(subpath(pnpmTools)), "the check reads the pnpm versions pnpm keeps");
  assert.ok(!checkProfile.includes(subpath(pnpmHome)), "but not the rest of pnpm's home");
  assert.ok(!checkProfile.includes(subpath(realpathSync(tmpdir()))), "a stray pnpm opens nothing around it");
  const shellProfile = await buildMacosWorkspaceShellProfile(workspace, pnpmEnv, sandboxTemp, true, "/bin/bash", true);
  assert.ok(!shellProfile.includes(subpath(pnpmTools)), "other commands never read them");
  const checkBwrap = (
    await linuxBubblewrapArgs(workspace, pnpmEnv, tmpdir(), "/bin/bash", ["-c", "true"], true, true)
  ).join("\0");
  assert.ok(!checkBwrap.includes(`--ro-bind\0${serverDist}\0${serverDist}`));
  assert.ok(checkBwrap.includes(`--ro-bind\0/dev/null\0${keyFile}`));
  assert.ok(checkBwrap.includes(`--ro-bind\0${pnpmTools}\0${pnpmTools}`));

  const sandbox = getWorkspaceShellSandboxStatus();
  if (sandbox.available) {
    writeFileSync(
      join(workspace, "scripts", "fix.mjs"),
      'import { appendFileSync } from "node:fs";\nappendFileSync("packages/server/data/storage/tables/app_settings.json", "planted\\n");\n',
    );
    // Seatbelt follows paths, so it also pins the folders holding a secret and covers names that do not exist yet;
    // under bubblewrap a renamed folder takes its masking mounts along.
    const seatbelt = sandbox.backend === "macos-seatbelt";
    const shell = await sandboxRun(
      [
        "cat packages/server/data/.encryption-key",
        "cat packages/server/data/.ENCRYPTION-KEY",
        ...(linked ? ["cat key-link"] : []),
        "ln packages/server/data/.encryption-key hard-link && cat hard-link",
        "node scripts/fix.mjs",
        "printf planted >> .git/config",
        "mkdir -p .git/hooks && printf planted > .git/hooks/post-merge",
        "printf planted >> .env",
        "mv .env moved-env && cat moved-env",
        "printf planted > packages/server/data/.encryption-key",
        "rm -f packages/server/data/.encryption-key",
        ...(seatbelt
          ? [
              "mv packages/server/data moved-data && cat moved-data/.encryption-key",
              "mkdir -p fresh/.git",
              "printf planted > fresh/.env.local",
              "printf planted > fresh/.ENCRYPTION-KEY",
              "printf ok > .env.example",
              "printf ok > packages/server/data/notes.txt",
            ]
          : []),
        "printf ok > ordinary.txt",
        "true",
      ].join("; "),
    );
    assert.equal(shell.code, 0, shell.output);
    assert.ok(!shell.output.includes(KEY), `the shell never reads the key:\n${shell.output}`);
    assert.ok(!shell.output.includes("env-secret"), `the shell never reads .env:\n${shell.output}`);
    assert.equal(readFileSync(join(storageDir, "tables", "app_settings.json"), "utf8"), "original\n");
    assert.equal(readFileSync(join(workspace, ".git", "config"), "utf8"), GIT_CONFIG, "Git's config stays as it was");
    assert.equal(existsSync(join(workspace, ".git", "hooks")), false, "no Git hook can be planted");
    assert.equal(readFileSync(join(workspace, ".env"), "utf8"), ENV_FILE, ".env stays as it was");
    assert.equal(readFileSync(keyFile, "utf8"), `${KEY}\n`, "the key can be neither replaced nor deleted");
    if (seatbelt) {
      for (const path of ["moved-data", "fresh/.git", "fresh/.env.local", "fresh/.ENCRYPTION-KEY"]) {
        assert.equal(existsSync(join(workspace, path)), false, `${path} cannot be made`);
      }
      assert.equal(readFileSync(join(workspace, ".env.example"), "utf8"), "ok", ".env templates stay writable");
      assert.equal(readFileSync(join(dataDir, "notes.txt"), "utf8"), "ok", "a pinned folder still takes new files");
    }
    assert.equal(readFileSync(join(workspace, "ordinary.txt"), "utf8"), "ok", "ordinary files stay writable");
  }

  // 3. `mari code check`: a pnpm stand-in runs the workspace's own check script, which Mari could have edited.
  writeFileSync(
    join(workspace, "check.mjs"),
    [
      'import { writeFileSync } from "node:fs";',
      "const { MARI_CHECK_REGRESSION_SECRET: secret = null, MARINARA_GIT_COMMIT: commit = null } = process.env;",
      'writeFileSync("check-result.json", JSON.stringify({ args: process.argv.slice(2), secret, commit }));',
      'writeFileSync("packages/server/dist/index.js", "rebuilt\\n");',
      "",
    ].join("\n"),
  );
  process.env.PATH = `${shimDir}${delimiter}${originalEnv.PATH ?? ""}`;
  process.env.MARI_CHECK_REGRESSION_SECRET = SECRET;
  delete process.env.MARINARA_GIT_COMMIT;
  // The sandbox cannot read .git, so the build's commit has to come from outside it.
  let head: string | null = null;
  try {
    const git = (...args: string[]) =>
      execFileSync("git", ["-c", "user.name=regression", "-c", "user.email=regression@example.invalid", ...args], {
        cwd: workspace,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    git("init", "-q");
    git("commit", "-q", "--allow-empty", "--no-verify", "-m", "fixture");
    head = git("rev-parse", "HEAD").trim();
  } catch {
    console.log("git unavailable; skipping the build-commit case.");
  }
  const checkResult = join(workspace, "check-result.json");
  // To the CLI, a --help after -- is not a help flag, so that spelling runs the check too and must reach the sandbox.
  for (const command of ["mari code check", "mari code check -- --help"]) {
    rmSync(checkResult, { force: true });
    writeFileSync(join(serverDist, "index.js"), "built\n");
    const check = await run("bash", { command });
    if (sandbox.available) {
      assert.equal(check.success, true, check.output);
      assert.match(check.output, /^Sandbox: /mu, `${command} runs in the shell sandbox`);
      const result = JSON.parse(readFileSync(checkResult, "utf8"));
      assert.deepEqual(result.args, ["check"]);
      assert.equal(result.secret, null, `${command} does not inherit the server's environment`);
      if (head) assert.equal(result.commit, head, "the build records the checked-out commit");
      assert.equal(readFileSync(join(serverDist, "index.js"), "utf8"), "rebuilt\n", "its build can still write dist");
    } else {
      assert.equal(check.success, false);
      assert.match(check.output, /mari code check runs the workspace's own scripts, so it needs the shell sandbox/u);
      assert.equal(existsSync(checkResult), false, `${command} ran nothing without a sandbox`);
    }
  }
  // A real help flag still gets its text from the direct runtime, and runs nothing.
  rmSync(checkResult, { force: true });
  const help = await run("bash", { command: "mari code check --help" });
  assert.equal(help.success, true, help.output);
  assert.match(help.output, /\(direct mari runtime\)/u);
  assert.equal(existsSync(checkResult), false, "the help text runs nothing");
  console.log(
    `Professor Mari secret-boundary regression passed${sandbox.available ? ` with ${sandbox.backend}` : " without a sandbox"}.`,
  );
} finally {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(workspace, { recursive: true, force: true });
  rmSync(shimDir, { recursive: true, force: true });
}
