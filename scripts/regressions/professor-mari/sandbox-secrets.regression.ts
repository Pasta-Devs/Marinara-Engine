// Professor Mari's boundaries around server secrets and code she can edit:
// - the auto-generated encryption key (DATA_DIR/.encryption-key) is as secret as .env, for her tools and shell;
// - saved data (DATA_DIR/storage) is read-only to her shell, as it already is to her write tool, and so are the app's
//   media folders, which change only through mari images and the app; the folders holding them are pinned, so a
//   command can neither move one away nor put a link or a folder of its own in its place;
// - her shell can neither read nor change .git, .env or the key file, nor create them where they do not exist yet;
//   a root .git or .env that appears during a run anyway is moved aside after it;
// - `mari code check` runs pnpm check in the shell sandbox without the server's environment, or not at all when
//   no sandbox exists, because pnpm check executes workspace scripts she can change. Only a real help flag keeps
//   it direct.
import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
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
  DATA_DIR: process.env.DATA_DIR,
  FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR,
  MARINARA_GIT_COMMIT: process.env.MARINARA_GIT_COMMIT,
  PATH: process.env.PATH,
  MARI_CHECK_REGRESSION_SECRET: process.env.MARI_CHECK_REGRESSION_SECRET,
};
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = storageDir;
const MEDIA = [
  "avatars",
  "backgrounds",
  "backgrounds-thumbs",
  "conversation-call-character-videos",
  "game-assets",
  "game-scene-videos",
  "gallery",
  "lorebooks/images",
  "sprites",
];
const media = (name: string) => join(dataDir, ...name.split("/"));

const {
  buildMacosWorkspaceShellProfile,
  getWorkspaceShellSandboxStatus,
  linuxBubblewrapArgs,
  quarantineNewRootSecrets,
  snapshotSensitiveWorkspaceFiles,
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
  mkdirSync(join(dataDir, "backgrounds"));
  writeFileSync(join(dataDir, "backgrounds", "dawn.png"), "image\n");
  mkdirSync(join(dataDir, "avatars"));
  writeFileSync(join(dataDir, "avatars", "face.png"), "image\n");
  mkdirSync(join(dataDir, "gallery", "mari-images"), { recursive: true });
  writeFileSync(join(dataDir, "gallery", "mari-images", "manifest.json"), "[]\n");
  mkdirSync(join(workspace, "outside-media"));
  // A package store the user left in a media folder: its build caches must not reopen the folder.
  const mediaStore = join(dataDir, "game-assets", "pack", "node_modules");
  mkdirSync(mediaStore, { recursive: true });
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
  assert.deepEqual(policy.mediaDirs, MEDIA.map(media), "every media folder, made yet or not");
  const holders = [
    join(workspace, "packages"),
    join(workspace, "packages", "server"),
    dataDir,
    join(dataDir, "lorebooks"),
  ];
  assert.deepEqual(
    new Set(policy.appDataHolders),
    new Set(holders),
    "and the folders holding them, up to the workspace",
  );
  const profile = await buildMacosWorkspaceShellProfile(workspace, {}, tmpdir(), true, "/bin/bash", true);
  const appDataStart = profile.indexOf(`(deny file-write*\n    (subpath ${JSON.stringify(storageDir)})\n`);
  assert.ok(appDataStart >= 0, "saved data stays read-only");
  const appDataRule = profile.slice(appDataStart, profile.indexOf("\n(", appDataStart));
  for (const holder of holders) assert.ok(appDataRule.includes(`(literal ${JSON.stringify(holder)})`), holder);
  const anyCase = (name: string) => name.replace(/[a-z]/gu, (c) => `[${c}${c.toUpperCase()}]`);
  // The data dir is matched literally, so characters such as `.` or Windows' `\` in its path are escaped.
  const dataPrefix = `^${dataDir.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}/`;
  const mediaPattern = `${dataPrefix}(${MEDIA.map(anyCase).join("|")})(/|$)`;
  assert.ok(appDataRule.includes(`(regex ${JSON.stringify(mediaPattern)})`), "media folders are matched by name");
  assert.ok(appDataRule.includes(`(regex ${JSON.stringify(`${dataPrefix}(${anyCase("lorebooks")})$`)})`));
  const cacheAllow = profile.indexOf(`(subpath ${JSON.stringify(join(mediaStore, ".cache"))})`);
  assert.ok(
    cacheAllow >= 0 && cacheAllow < appDataStart,
    "the media deny comes after the store cache allow, so the last matching rule keeps the media folder read-only",
  );
  const readOnly = await buildMacosWorkspaceShellProfile(workspace, {}, tmpdir(), false, "/bin/bash", true);
  assert.ok(!readOnly.includes(mediaPattern), "a read-only workspace needs no media rule");
  const forbiddenRule = profile.slice(profile.indexOf("(deny file-read* file-write*\n"));
  assert.ok(profile.includes("(deny file-read* file-write*\n"), "forbidden paths are closed to writes, not only reads");
  assert.ok(forbiddenRule.includes(`(subpath ${JSON.stringify(keyFile)})`));
  assert.ok(forbiddenRule.includes(`(literal ${JSON.stringify(dataDir)})`), "the folder holding the key is pinned");
  assert.ok(forbiddenRule.includes(`(literal ${JSON.stringify(workspace)})`), "so is the workspace itself");
  const bwrap = (await linuxBubblewrapArgs(workspace, {}, tmpdir(), "/bin/bash", ["-c", "true"], true)).join("\0");
  assert.ok(bwrap.includes(`--ro-bind\0/dev/null\0${keyFile}`));
  assert.ok(bwrap.includes(`--ro-bind\0${storageDir}\0${storageDir}`));
  // A mount needs an existing folder, so the missing media folders were made, and every one is mounted read-only after
  // the folders holding it are pinned.
  for (const name of MEDIA) {
    const at = bwrap.indexOf(`--ro-bind\0${media(name)}\0${media(name)}\0`);
    assert.ok(at >= 0, `read-only mount: ${name}`);
    for (const holder of holders) {
      const pinned = bwrap.indexOf(`--bind\0${holder}\0${holder}\0`);
      assert.ok(pinned >= 0 && pinned < at, `${holder} is pinned before the ${name} mount`);
    }
  }
  const cacheBind = bwrap.indexOf(`--bind\0${join(mediaStore, ".cache")}\0${join(mediaStore, ".cache")}\0`);
  assert.ok(
    cacheBind >= 0 && cacheBind < bwrap.indexOf(`--ro-bind\0${media("game-assets")}\0${media("game-assets")}\0`),
    "the read-only media mount comes after the store cache bind, so it covers it",
  );
  const pinOrder = holders.map((holder) => bwrap.indexOf(`--bind\0${holder}\0${holder}\0`));
  assert.deepEqual(
    pinOrder,
    [...pinOrder].sort((a, b) => a - b),
    "a holder is pinned before the folders it holds",
  );
  assert.ok(
    bwrap.indexOf(`--bind\0${dataDir}\0${dataDir}\0`) < bwrap.indexOf(`--ro-bind\0/dev/null\0${keyFile}`),
    "the data dir is pinned before the key is masked, so its bind cannot hide the mask",
  );
  const readOnlyBwrap = (await linuxBubblewrapArgs(workspace, {}, tmpdir(), "/bin/bash", ["-c", "true"], false)).join(
    "\0",
  );
  assert.ok(!readOnlyBwrap.includes(`--bind\0${dataDir}\0`), "a read-only workspace stays read-only");
  // A media folder, or the folder holding one, that is a link gets no mount, and nothing is made through it.
  rmSync(join(dataDir, "lorebooks"), { recursive: true, force: true });
  symlinkSync(join(workspace, "outside-media"), join(dataDir, "lorebooks"), "dir");
  const linkedBwrap = (await linuxBubblewrapArgs(workspace, {}, tmpdir(), "/bin/bash", ["-c", "true"], true)).join(
    "\0",
  );
  assert.deepEqual(readdirSync(join(workspace, "outside-media")), [], "no folder is made through the link");
  assert.ok(!linkedBwrap.includes(`\0${join(dataDir, "lorebooks")}`), "and none is mounted at or through it");
  rmSync(join(dataDir, "lorebooks"));
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
  const checkAppDataStart = checkProfile.indexOf(`(deny file-write*\n    ${subpath(storageDir)}\n`);
  assert.ok(checkAppDataStart >= 0, "saved data stays read-only");
  const checkAppDataRule = checkProfile.slice(checkAppDataStart, checkProfile.indexOf("\n(", checkAppDataStart));
  assert.ok(checkAppDataRule.includes(`(regex ${JSON.stringify(mediaPattern)})`), "and so do the media folders");
  assert.ok(checkProfile.includes(subpath(pnpmTools)), "the check reads the pnpm versions pnpm keeps");
  assert.ok(!checkProfile.includes(subpath(pnpmHome)), "but not the rest of pnpm's home");
  assert.ok(!checkProfile.includes(subpath(realpathSync(tmpdir()))), "a stray pnpm opens nothing around it");
  const shellProfile = await buildMacosWorkspaceShellProfile(workspace, pnpmEnv, sandboxTemp, true, "/bin/bash", true);
  // The check's "no /dist(- rule" above means something only while every other command keeps that rule.
  assert.ok(shellProfile.includes("/dist(-"), "other commands keep the build-output rule");
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
    if (seatbelt) {
      // Every Seatbelt rule matches paths under the workspace, so the workspace itself cannot move out from under them.
      const moved = await sandboxRun(
        [
          'ws="$PWD"',
          'mv "$ws" "$TMPDIR/ws" && (cd "$TMPDIR/ws" && cat .env packages/server/data/.encryption-key; printf planted >> .git/config; printf planted > .env.local; mkdir -p sub/.git)',
          'mv "$TMPDIR/ws" "$ws" 2>/dev/null',
          "printf ok > ordinary.txt",
          "true",
        ].join("; "),
      );
      assert.ok(!moved.output.includes(KEY), `the moved workspace never shows the key:\n${moved.output}`);
      assert.ok(!moved.output.includes("env-secret"), `the moved workspace never shows .env:\n${moved.output}`);
      assert.equal(readFileSync(join(workspace, ".git", "config"), "utf8"), GIT_CONFIG, "Git's config stays as it was");
      assert.equal(readFileSync(join(workspace, ".env"), "utf8"), ENV_FILE, ".env stays as it was");
      for (const path of [".env.local", "sub"]) {
        assert.equal(existsSync(join(workspace, path)), false, `${path} cannot be made from a moved workspace`);
      }
      assert.equal(readFileSync(join(workspace, "ordinary.txt"), "utf8"), "ok", "the pinned workspace takes new files");
    }

    // The media folders: her shell can read them, but it can neither write, delete, link nor move anything there, nor
    // make a missing one. The loop is the race #8802 left open, in which a command kept swapping the backgrounds
    // folder for a link while mari images checked it and then wrote; it cannot swap it even once now.
    // The bubblewrap builders above made every missing media folder, so two go again: Seatbelt starts without them.
    for (const name of ["sprites", "lorebooks"]) rmSync(media(name), { recursive: true, force: true });
    const data = "packages/server/data";
    const swapLoop = [
      "swaps=0;",
      "for i in $(seq 1 25); do",
      `mv ${data}/backgrounds ${data}/backgrounds.real && ln -s ../../../outside-media ${data}/backgrounds && swaps=$((swaps+1));`,
      `[ -L ${data}/backgrounds ] && rm -f ${data}/backgrounds; [ -d ${data}/backgrounds.real ] && mv ${data}/backgrounds.real ${data}/backgrounds;`,
      "done",
    ].join(" ");
    const mediaShell = await sandboxRun(
      [
        `printf planted > ${data}/backgrounds/new.png`,
        `printf planted >> ${data}/backgrounds/dawn.png`,
        `rm -f ${data}/backgrounds/dawn.png`,
        `ln -s ../../../../../outside-media ${data}/gallery/mari-images/link`,
        `printf planted > ${data}/gallery/mari-images/manifest.json`,
        `ln ${data}/avatars/face.png hard-face && printf planted >> hard-face`,
        // Inside the data dir on every backend: under bubblewrap a move out of it crosses mounts, and mv then copies.
        `mv ${data}/avatars ${data}/avatars.moved`,
        ...(seatbelt ? [`mv ${data}/avatars moved-avatars`] : []),
        `printf planted > ${data}/game-assets/pack/node_modules/.cache/planted && echo cache-written`,
        `rm -rf ${data}/game-assets`,
        `ln -s ../../../outside-media ${data}/sprites`,
        `mkdir -p ${data}/lorebooks/images`,
        ...(seatbelt ? [`mkdir ${data}/SPRITES`, `mkdir -p staged/images && mv staged ${data}/lorebooks`] : []),
        `${swapLoop} 2>/dev/null`,
        'echo "swaps=$swaps"',
        `cat ${data}/backgrounds/dawn.png`,
        `printf ok > ${data}/media-notes.txt`,
        "true",
      ].join("; "),
    );
    assert.equal(mediaShell.code, 0, mediaShell.output);
    assert.match(mediaShell.output, /^swaps=0$/mu, `the folder is never swapped for a link:\n${mediaShell.output}`);
    assert.match(mediaShell.output, /^image$/mu, "the shell still reads the media folders");
    assert.equal(readFileSync(join(dataDir, "backgrounds", "dawn.png"), "utf8"), "image\n");
    assert.deepEqual(readdirSync(join(dataDir, "backgrounds")), ["dawn.png"], "nothing is written or left there");
    assert.equal(readFileSync(join(dataDir, "gallery", "mari-images", "manifest.json"), "utf8"), "[]\n");
    assert.deepEqual(readdirSync(join(dataDir, "gallery", "mari-images")), ["manifest.json"]);
    assert.equal(readFileSync(join(dataDir, "avatars", "face.png"), "utf8"), "image\n", "not even through a hard link");
    assert.ok(!lstatSync(media("avatars")).isSymbolicLink(), "avatars is never a link");
    assert.equal(existsSync(join(dataDir, "avatars.moved")), false, "avatars cannot be moved away");
    if (seatbelt) assert.equal(existsSync(join(workspace, "moved-avatars")), false, "not even out of the data dir");
    assert.doesNotMatch(mediaShell.output, /^cache-written$/mu, "a store cache in a media folder stays read-only");
    assert.ok(existsSync(media("game-assets")), "game-assets cannot be deleted");
    for (const name of ["backgrounds", "sprites", "lorebooks", "lorebooks/images"]) {
      const stats = lstatSync(media(name), { throwIfNoEntry: false });
      assert.ok(!stats?.isSymbolicLink(), `${name} is never a link`);
      if (stats && name !== "backgrounds" && name !== "lorebooks") assert.deepEqual(readdirSync(media(name)), []);
    }
    if (seatbelt) {
      for (const name of ["sprites", "SPRITES", "lorebooks"]) {
        assert.equal(existsSync(join(dataDir, name)), false, `a missing ${name} folder cannot be made or moved in`);
      }
    }
    assert.deepEqual(readdirSync(join(workspace, "outside-media")), [], "nothing lands where a link would point");
    assert.equal(readFileSync(join(dataDir, "media-notes.txt"), "utf8"), "ok", "the data dir still takes new files");
  }

  // Bubblewrap can only mask paths that exist, so the post-run pass moves aside a root .git or .env that appeared
  // during a run, the two that host git and the .env loader read. Created here between the snapshot and the pass.
  const bare = realpathSync(mkdtempSync(join(tmpdir(), "marinara-mari-bare-")));
  try {
    const before = await snapshotSensitiveWorkspaceFiles(bare);
    mkdirSync(join(bare, ".git"));
    writeFileSync(join(bare, ".git", "config"), GIT_CONFIG);
    writeFileSync(join(bare, ".env"), ENV_FILE);
    const lines = await quarantineNewRootSecrets(before);
    assert.equal(lines.length, 2, lines.join("\n"));
    assert.equal(existsSync(join(bare, ".git")), false, "a root .git made during the run is moved aside");
    assert.equal(existsSync(join(bare, ".env")), false, "a root .env made during the run is moved aside");
    const kept = readdirSync(bare).sort();
    assert.equal(kept.length, 2);
    assert.ok(kept[0]!.startsWith(".env.unreviewed-") && kept[1]!.startsWith(".git.unreviewed-"), kept.join(", "));
    assert.ok(
      lines.every((line) => !line.includes("env-secret")),
      "the lines never show what the files hold",
    );
    // Ones that already existed are left to the sandbox's own rules.
    mkdirSync(join(bare, ".git"));
    writeFileSync(join(bare, ".env"), ENV_FILE);
    assert.deepEqual(await quarantineNewRootSecrets(await snapshotSensitiveWorkspaceFiles(bare)), []);
    assert.ok(existsSync(join(bare, ".git")) && existsSync(join(bare, ".env")));
  } finally {
    rmSync(bare, { recursive: true, force: true });
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
