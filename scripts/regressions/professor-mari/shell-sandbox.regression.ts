import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildMacosWorkspaceShellProfile,
  getWorkspaceShellSandboxStatus,
  linuxBubblewrapArgs,
  sanitizeWorkspaceShellEnv,
  spawnWorkspaceSandboxedShell,
} from "../../../packages/server/src/services/professor-mari/workspace-shell-sandbox.js";
import {
  BUILD_OUTPUT_WRITE_REFUSAL,
  bashCommandTargetsSensitivePath,
  bashCommandWritesBuildOutput,
  isBuildOutputPath,
  isPackageManagerMutationCommand,
  WorkspaceChangeReviewService,
  workspacePathAccessPolicy,
} from "../../../packages/server/src/services/professor-mari/workspace-change-review.service.js";
import { ProfessorMariWorkspaceService } from "../../../packages/server/src/services/professor-mari/workspace-agent.service.js";

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

const cleanEnv = sanitizeWorkspaceShellEnv({
  PATH: process.env.PATH,
  LANG: process.env.LANG,
  LC_ALL: process.env.LC_ALL,
  ADMIN_SECRET: "must-not-leak",
  MARINARA_SANDBOX_SECRET: "must-not-leak",
});
assert.equal(cleanEnv.ADMIN_SECRET, undefined);
assert.equal(cleanEnv.MARINARA_SANDBOX_SECRET, undefined);
assert.equal(cleanEnv.PATH, process.env.PATH);

const sandboxSource = readFileSync(
  new URL("../../../packages/server/src/services/professor-mari/workspace-shell-sandbox.ts", import.meta.url),
  "utf8",
);
const workspaceSource = readFileSync(
  new URL("../../../packages/server/src/services/professor-mari/workspace-agent.service.ts", import.meta.url),
  "utf8",
);
const registrySource = readFileSync(
  new URL("../../../packages/server/src/services/professor-mari/tool-registry.ts", import.meta.url),
  "utf8",
);
assert.match(sandboxSource, /\(deny network\*\)/u);
assert.match(sandboxSource, /--unshare-all/u);
assert.match(sandboxSource, /throw new Error\(\s*`\$\{status\.reason\}/u);
assert.match(workspaceSource, /spawnWorkspaceSandboxedShell/u);
assert.match(workspaceSource, /Use the dependency tool/u);
assert.match(registrySource, /name: "copy"/u);
assert.match(registrySource, /name: "move"/u);
assert.match(registrySource, /name: "remove"/u);
assert.match(workspaceSource, /write\|copy\|move\|remove\|bash/u);
assert.match(workspaceSource, /Final prompt messages/u);
assert.match(sandboxSource, /copy, move, remove/u);
assert.doesNotMatch(workspaceSource, /spawn\(shell,\s*shellArgs/u);

const structuredWorkspace = mkdtempSync(join(tmpdir(), "marinara-mari-structured-workspace-"));
try {
  const service = new ProfessorMariWorkspaceService({} as never);
  service.setEnabled(true, structuredWorkspace);
  const commandRunner = service as unknown as {
    executeWorkspaceCommand(
      command: {
        id: string;
        name: "copy" | "move" | "remove";
        arguments: Record<string, unknown>;
        authorization: string;
      },
      signal: AbortSignal,
      trace: unknown[],
      onEvent: () => void,
      authorizationContext: { directUserText: string },
    ): Promise<{ output: string; success: boolean }>;
  };
  let commandId = 0;
  const runFileCommand = (name: "copy" | "move" | "remove", args: Record<string, unknown>) => {
    const authorization = `${name[0]!.toUpperCase()}${name.slice(1)} files in this workspace.`;
    return commandRunner.executeWorkspaceCommand(
      { id: `structured-${commandId++}`, name, arguments: args, authorization },
      new AbortController().signal,
      [],
      () => undefined,
      { directUserText: authorization },
    );
  };

  writeFileSync(join(structuredWorkspace, "source.txt"), "source-content", "utf8");
  writeFileSync(join(structuredWorkspace, "existing.txt"), "existing-content", "utf8");

  const blockedCopy = await runFileCommand("copy", { source: "source.txt", destination: "existing.txt" });
  assert.equal(blockedCopy.success, false);
  assert.match(blockedCopy.output, /copy destination already exists/u);
  assert.equal(readFileSync(join(structuredWorkspace, "source.txt"), "utf8"), "source-content");
  assert.equal(readFileSync(join(structuredWorkspace, "existing.txt"), "utf8"), "existing-content");

  const blockedMove = await runFileCommand("move", { source: "source.txt", destination: "existing.txt" });
  assert.equal(blockedMove.success, false);
  assert.match(blockedMove.output, /move destination already exists/u);
  assert.equal(readFileSync(join(structuredWorkspace, "source.txt"), "utf8"), "source-content");
  assert.equal(readFileSync(join(structuredWorkspace, "existing.txt"), "utf8"), "existing-content");

  mkdirSync(join(structuredWorkspace, "non-empty"));
  writeFileSync(join(structuredWorkspace, "non-empty", "child.txt"), "keep-me", "utf8");
  const blockedDirectoryMove = await runFileCommand("move", {
    source: "non-empty",
    destination: "moved-directory",
  });
  assert.equal(blockedDirectoryMove.success, false);
  assert.match(blockedDirectoryMove.output, /move source must be a file/u);
  assert.equal(readFileSync(join(structuredWorkspace, "non-empty", "child.txt"), "utf8"), "keep-me");

  await runFileCommand("copy", { source: "source.txt", destination: "copied.txt" });
  assert.equal(readFileSync(join(structuredWorkspace, "copied.txt"), "utf8"), "source-content");
  await runFileCommand("move", { source: "copied.txt", destination: "moved.txt" });
  assert.equal(existsSync(join(structuredWorkspace, "copied.txt")), false);
  assert.equal(readFileSync(join(structuredWorkspace, "moved.txt"), "utf8"), "source-content");
  await runFileCommand("remove", { path: "moved.txt" });
  assert.equal(existsSync(join(structuredWorkspace, "moved.txt")), false);
  const blockedDirectoryRemove = await runFileCommand("remove", { path: "non-empty" });
  assert.equal(blockedDirectoryRemove.success, false);
  assert.match(blockedDirectoryRemove.output, /not empty|ENOTEMPTY/iu);
} finally {
  rmSync(structuredWorkspace, { recursive: true, force: true });
}

// #6984: build output (packages/<pkg>/dist and dist-* builds) stays readable but no Professor Mari tool, review
// or shell command may create, change, move or delete anything in it.
const buildWorkspace = realpathSync(mkdtempSync(join(tmpdir(), "marinara-mari-build-output-")));
try {
  const serverDist = join(buildWorkspace, "packages", "server", "dist");
  const builtFile = join(serverDist, "index.js");
  mkdirSync(serverDist, { recursive: true });
  mkdirSync(join(buildWorkspace, "packages", "server", "dist-sandbox"));
  mkdirSync(join(buildWorkspace, "packages", "server", "src"));
  mkdirSync(join(buildWorkspace, "packages", "client"));
  writeFileSync(builtFile, "built", "utf8");
  writeFileSync(join(buildWorkspace, "packages", "server", "src", "index.ts"), "source", "utf8");

  const isBuildOutput = (path: string) => isBuildOutputPath(buildWorkspace, join(buildWorkspace, path));
  for (const path of [
    "packages/server/dist",
    "packages/server/dist/services/generation/conversation-command-runtime.js",
    "packages/client/dist/index.html",
    "packages/server/dist-sandbox/index.js",
    "packages/server/DIST/index.js",
    "packages/server/src/../dist/index.js",
    // Windows opens dist for these names.
    "packages/server/dist./index.js",
    "packages/server/dist::$INDEX_ALLOCATION/index.js",
    // APFS folds the long s and the ligature, and HFS+ skips the zero-width mark.
    "packages/server/diſt/index.js",
    "packages/server/diﬆ/index.js",
    "packageſ/server/dist/index.js",
    "packages/server/di\u200cst/index.js",
  ]) {
    assert.equal(isBuildOutput(path), true, `build output: ${path}`);
  }
  for (const path of [
    ".",
    "packages/server",
    "packages/server/src/index.ts",
    "packages/server/src/dist/index.ts",
    "packages/server/distribution.md",
  ]) {
    assert.equal(isBuildOutput(path), false, `not build output: ${path}`);
  }
  if (process.platform === "win32") assert.equal(isBuildOutput("packages\\server/dist\\index.js"), true);

  const service = new ProfessorMariWorkspaceService({} as never);
  service.setEnabled(true, buildWorkspace);
  const runner = service as unknown as {
    executeWorkspaceCommand(
      command: { id: string; name: string; arguments: Record<string, unknown> },
      signal: AbortSignal,
      trace: unknown[],
      onEvent: () => void,
    ): Promise<{ output: string; success: boolean }>;
  };
  let buildCommandId = 0;
  const run = (name: string, args: Record<string, unknown>) =>
    runner.executeWorkspaceCommand(
      { id: `build-output-${buildCommandId++}`, name, arguments: args },
      new AbortController().signal,
      [],
      () => undefined,
    );
  const refused = async (name: string, args: Record<string, unknown>) => {
    const result = await run(name, args);
    assert.equal(result.success, false, `${name} ${JSON.stringify(args)} must be refused`);
    assert.equal(result.output, BUILD_OUTPUT_WRITE_REFUSAL);
  };

  await refused("write", { path: "packages/server/dist/index.js", content: "tampered" });
  await refused("edit", {
    path: "packages/server/dist/index.js",
    edits: [{ oldText: "built", newText: "if(, raw) { }" }],
  });
  await refused("write", { path: "packages/server/src/../dist/new.js", content: "new" });
  await refused("write", { path: "packages/server/DIST/new.js", content: "new" });
  await refused("write", { path: "packages/server/diſt/index.js", content: "if(, raw) { }" });
  await refused("write", { path: "packages/server/dist-sandbox/index.js", content: "new" });
  await refused("write", { path: "packages/client/dist/index.html", content: "new" });
  await refused("copy", { source: "packages/server/src/index.ts", destination: "packages/server/dist/copy.js" });
  await refused("move", { source: "packages/server/dist/index.js", destination: "packages/server/src/moved.js" });
  await refused("move", { source: "packages/server/src/index.ts", destination: "packages/server/dist/moved.js" });
  await refused("remove", { path: "packages/server/dist/index.js" });
  await refused("remove", { path: "packages/server/dist-sandbox" });
  await refused("bash", { command: "printf tampered > packages/server/dist/index.js; echo done" });
  let linked = true;
  try {
    symlinkSync(serverDist, join(buildWorkspace, "dist-link"), "junction");
    mkdirSync(join(buildWorkspace, "node_modules", "@marinara-engine"), { recursive: true });
    symlinkSync(
      join(buildWorkspace, "packages", "server"),
      join(buildWorkspace, "node_modules", "@marinara-engine", "server"),
      "junction",
    );
  } catch {
    linked = false;
    console.log("Symlink creation unavailable; skipping the linked build-output cases.");
  }
  if (linked) {
    await refused("write", { path: "dist-link/index.js", content: "tampered" });
    await refused("write", { path: "node_modules/@marinara-engine/server/dist/index.js", content: "tampered" });
    // An approved review is written where it was staged, so neither a link at staging nor one added afterwards can
    // carry it into dist.
    const reviews = new WorkspaceChangeReviewService(buildWorkspace);
    await assert.rejects(
      reviews.stageSensitiveFileChange({
        absolutePath: join(buildWorkspace, "dist-link", "package.json"),
        afterContent: '{"type":"commonjs"}',
        sessionId: "build-output-regression",
      }),
      { message: BUILD_OUTPUT_WRITE_REFUSAL },
    );
    const staged = await reviews.stageSensitiveFileChange({
      absolutePath: join(buildWorkspace, "packages", "server", "src", "gen", "package.json"),
      afterContent: '{"type":"commonjs"}',
      sessionId: "build-output-regression",
    });
    symlinkSync(serverDist, join(buildWorkspace, "packages", "server", "src", "gen"), "junction");
    assert.equal((await reviews.approve(staged.id))?.outcome, "state_changed");
  }
  assert.equal(readFileSync(builtFile, "utf8"), "built");
  assert.deepEqual(readdirSync(serverDist), ["index.js"]);
  assert.deepEqual(readdirSync(join(buildWorkspace, "packages", "server", "dist-sandbox")), []);
  assert.equal(existsSync(join(buildWorkspace, "packages", "client", "dist")), false);
  assert.equal(readFileSync(join(buildWorkspace, "packages", "server", "src", "index.ts"), "utf8"), "source");

  // Reading stays allowed, so does copying a build file out, and source edits still work.
  assert.match((await run("read", { path: "packages/server/dist/index.js" })).output, /^1: built$/mu);
  assert.equal((await run("ls", { path: "packages/server/dist" })).success, true);
  const copiedOut = { source: "packages/server/dist/index.js", destination: "packages/server/src/copy.js" };
  assert.equal((await run("copy", copiedOut)).success, true);
  assert.equal((await run("write", { path: "packages/server/src/index.ts", content: "fixed" })).success, true);

  // An approved review writes its file, so build output cannot be staged for one either.
  await assert.rejects(
    new WorkspaceChangeReviewService(buildWorkspace).stageSensitiveFileChange({
      absolutePath: join(serverDist, "package.json"),
      afterContent: '{"type":"commonjs"}',
      sessionId: "build-output-regression",
    }),
    { message: BUILD_OUTPUT_WRITE_REFUSAL },
  );

  for (const blocked of [
    "sed -i 's/built/x/' packages/server/dist/index.js; echo done",
    "perl -pi -e 's/built/x/' packages/server/dist/index.js",
    "echo x > packages/server/dist/index.js",
    'printf x >> "./packages/client/dist/index.html"',
    "cat <<'EOF' > packages/server/dist/new.js",
    "tee packages/shared/dist/index.js < input.txt",
    "cp -r src/ packages/server/dist && echo copied",
    "mv packages/server/dist/index.js /tmp/index.js",
    "rm -rf packages/client/dist",
    "mkdir -p packages/client/dist/assets",
    "ln -s ../src/index.ts packages/server/dist/index.js",
    "node -e \"require('fs').writeFileSync('packages/server/dist/index.js','')\"",
    "dd if=/dev/zero of=packages/server/dist/index.js",
    "echo x > packages/server/dist-sandbox/index.js",
    `echo x > ${buildWorkspace}/packages/server/DIST/index.js`,
    String.raw`echo x > packages\server\dist\index.js`,
  ]) {
    assert.equal(bashCommandWritesBuildOutput(blocked), true, `should refuse: ${blocked}`);
  }
  for (const allowed of [
    "cat packages/server/dist/index.js",
    "grep -rn built packages/server/dist | head",
    "ls packages/server/dist 2>/dev/null",
    "sed -n '1,5p' packages/server/dist/index.js",
    "cp packages/server/dist/index.js /tmp/index.js",
    "ln -s packages/server/dist/index.js built-link.js",
    "diff packages/server/dist/index.js packages/server/src/index.ts > notes.txt",
    "echo x > packages/server/src/dist.ts",
    "mkdir -p packages/server/src/dist",
    "rm packages/server/distribution.md",
  ]) {
    assert.equal(bashCommandWritesBuildOutput(allowed), false, `should allow: ${allowed}`);
  }
  // Both shell checks run on the server's event loop before every command, so a long one-line command must stay
  // cheap. Each of these took seconds or minutes while a regex was retried from every word or every "/".
  for (const command of [
    `rm -f ${"x".repeat(100_000)}`,
    "rm ".repeat(10_000),
    "node writefile ".repeat(400),
    `cp ${"a/".repeat(20_000)}b`,
  ]) {
    const started = performance.now();
    assert.equal(bashCommandWritesBuildOutput(command) || bashCommandTargetsSensitivePath(command), false);
    assert.ok(performance.now() - started < 250, `a long command must not stall the server: ${command.slice(0, 20)}`);
  }

  // The sandbox makes build output read-only on both backends and pins the folders holding it, so a command cannot
  // move a package away and build a new dist in its place. Seatbelt rules follow paths, so they also cover a dist
  // that does not exist yet; a bubblewrap mount needs an existing folder.
  const literal = (path: string) => JSON.stringify(path);
  const serverPackage = join(buildWorkspace, "packages", "server");
  const profile = await buildMacosWorkspaceShellProfile(buildWorkspace, {}, tmpdir(), true, "/bin/bash", true);
  const ruleStart = profile.indexOf("(deny file-write*\n    (regex ");
  const buildOutputRule = profile.slice(ruleStart, profile.indexOf("\n(", ruleStart));
  assert.match(buildOutputRule, /\(regex "[^"\n]*packages\/\[\^\/\]\+\/dist\(-\[\^\/\]\*\)\?\(\/\|\$\)"\)/u);
  assert.ok(buildOutputRule.includes(`(subpath ${literal(serverDist)})`));
  assert.ok(buildOutputRule.includes(`(literal ${literal(serverPackage)})`));
  const bwrap = async (writable: boolean) =>
    (await linuxBubblewrapArgs(buildWorkspace, {}, tmpdir(), "/bin/bash", ["-c", "true"], writable)).join("\u0000");
  const bwrapArgs = await bwrap(true);
  for (const output of [serverDist, join(buildWorkspace, "packages", "server", "dist-sandbox")]) {
    assert.ok(bwrapArgs.includes(`--ro-bind\u0000${output}\u0000${output}`), `read-only mount: ${output}`);
  }
  const pinned = (path: string) => `--bind\u0000${path}\u0000${path}\u0000`;
  for (const holder of [join(buildWorkspace, "packages"), serverPackage]) {
    // Before the read-only mounts inside it, which a later bind would hide.
    const at = bwrapArgs.indexOf(pinned(holder));
    assert.ok(at >= 0 && at < bwrapArgs.indexOf(`--ro-bind\u0000${serverDist}`), `pinned first: ${holder}`);
  }
  assert.ok(!(await bwrap(false)).includes(pinned(serverPackage)), "a read-only workspace stays read-only");

  const sandbox = getWorkspaceShellSandboxStatus();
  if (sandbox.available) {
    const seatbelt = sandbox.backend === "macos-seatbelt";
    const sandboxed = await spawnWorkspaceSandboxedShell({
      command: [
        "printf tampered > packages/server/dist/index.js 2>/dev/null && exit 60",
        "rm -f packages/server/dist/index.js 2>/dev/null; test -f packages/server/dist/index.js || exit 61",
        "printf new > packages/server/dist-sandbox/new.js 2>/dev/null && exit 62",
        ...(seatbelt ? ["mkdir packages/client/dist 2>/dev/null && exit 63"] : []),
        "mv packages/server packages/moved 2>/dev/null && exit 64",
        "printf ok > packages/server/src/ok.ts || exit 65",
        "cat packages/server/dist/index.js",
      ].join("; "),
      workspaceRoot: buildWorkspace,
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    sandboxed.child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    sandboxed.child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    const code = await new Promise<number | null>((resolve) => sandboxed.child.on("close", resolve));
    await sandboxed.cleanup();
    assert.equal(code, 0, stderr);
    assert.equal(stdout, "built");
    assert.equal(readFileSync(builtFile, "utf8"), "built");
    assert.deepEqual(readdirSync(join(buildWorkspace, "packages", "server", "dist-sandbox")), []);
    assert.equal(readFileSync(join(buildWorkspace, "packages", "server", "src", "ok.ts"), "utf8"), "ok");
    if (seatbelt) assert.equal(existsSync(join(buildWorkspace, "packages", "client", "dist")), false);
  }
  console.log(`Professor Mari build-output regression passed${sandbox.available ? ` with ${sandbox.backend}` : ""}.`);
} finally {
  rmSync(buildWorkspace, { recursive: true, force: true });
}

const reviewWorkspace = mkdtempSync(join(tmpdir(), "marinara-mari-review-workspace-"));
const fakeIntegrity = "sha512-regression-integrity";
try {
  const manifestPath = join(reviewWorkspace, "package.json");
  const lockfilePath = join(reviewWorkspace, "pnpm-lock.yaml");
  const launcherPath = join(reviewWorkspace, "start.sh");
  writeFileSync(manifestPath, '{"name":"review-fixture","private":true}\n', "utf8");
  writeFileSync(lockfilePath, "lockfileVersion: '9.0'\n", "utf8");
  writeFileSync(launcherPath, "#!/bin/sh\nprintf old\n", "utf8");

  assert.equal(workspacePathAccessPolicy(reviewWorkspace, join(reviewWorkspace, "src/app.ts")), "normal");
  assert.equal(workspacePathAccessPolicy(reviewWorkspace, manifestPath), "sensitive");
  assert.equal(workspacePathAccessPolicy(reviewWorkspace, launcherPath), "sensitive");
  assert.equal(workspacePathAccessPolicy(reviewWorkspace, join(reviewWorkspace, ".env")), "forbidden");
  assert.equal(workspacePathAccessPolicy(reviewWorkspace, join(reviewWorkspace, ".git/config")), "forbidden");
  assert.equal(isPackageManagerMutationCommand("pnpm add zod"), true);
  assert.equal(isPackageManagerMutationCommand("pnpm --filter @marinara-engine/server add zod"), true);
  assert.equal(isPackageManagerMutationCommand("python -m pip install requests"), true);
  assert.equal(isPackageManagerMutationCommand("pnpm check"), false);

  let installCalls = 0;
  const reviews = new WorkspaceChangeReviewService(reviewWorkspace, {
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({
          name: "nanoid",
          version: "5.1.11",
          dist: {
            integrity: fakeIntegrity,
            tarball: "https://registry.npmjs.org/nanoid/-/nanoid-5.1.11.tgz",
          },
        }),
        { headers: { "content-type": "application/json" } },
      )) as typeof fetch,
    installDependency: async ({ packageName, version }) => {
      installCalls += 1;
      writeFileSync(
        manifestPath,
        `${JSON.stringify({ name: "review-fixture", private: true, dependencies: { [packageName]: version } }, null, 2)}\n`,
        "utf8",
      );
      writeFileSync(lockfilePath, `lockfileVersion: '9.0'\nintegrity: ${fakeIntegrity}\n`, "utf8");
      return { ok: true, output: "fake install complete" };
    },
  });

  const fileApproval = await reviews.stageSensitiveFileChange({
    absolutePath: launcherPath,
    afterContent: "#!/bin/sh\nprintf new\n",
    reason: "Regression review",
    sessionId: "sandbox-regression",
  });
  assert.equal(readFileSync(launcherPath, "utf8"), "#!/bin/sh\nprintf old\n");
  assert.match(fileApproval.preview, /- printf old/u);
  assert.match(fileApproval.preview, /\+ printf new/u);
  assert.equal(fileApproval.previewTruncated, false);
  assert.equal((await reviews.approve(fileApproval.id))?.outcome, "applied");
  assert.equal(readFileSync(launcherPath, "utf8"), "#!/bin/sh\nprintf new\n");

  const discardedFile = await reviews.stageSensitiveFileChange({
    absolutePath: launcherPath,
    afterContent: "#!/bin/sh\nprintf discarded\n",
    sessionId: "sandbox-regression",
  });
  assert.equal(reviews.reject(discardedFile.id)?.outcome, "discarded");
  assert.equal(readFileSync(launcherPath, "utf8"), "#!/bin/sh\nprintf new\n");

  const staleFile = await reviews.stageSensitiveFileChange({
    absolutePath: launcherPath,
    afterContent: "#!/bin/sh\nprintf stale\n",
    sessionId: "sandbox-regression",
  });
  writeFileSync(launcherPath, "#!/bin/sh\nprintf external\n", "utf8");
  assert.equal((await reviews.approve(staleFile.id))?.outcome, "state_changed");
  assert.equal(readFileSync(launcherPath, "utf8"), "#!/bin/sh\nprintf external\n");

  const dependencyApproval = await reviews.requestDependencyInstall({
    packageName: "nanoid",
    version: "latest",
    target: "root",
    reason: "Regression dependency",
    sessionId: "sandbox-regression",
  });
  assert.equal(dependencyApproval.version, "5.1.11");
  assert.equal(dependencyApproval.integrity, fakeIntegrity);
  assert.deepEqual(dependencyApproval.directDependencies, []);
  assert.equal(installCalls, 0);
  assert.equal((await reviews.approve(dependencyApproval.id))?.outcome, "applied");
  assert.equal(installCalls, 1);
  assert.equal(JSON.parse(readFileSync(manifestPath, "utf8")).dependencies.nanoid, "5.1.11");
  reviews.clear();

  const manifestBeforeFailedInstall = readFileSync(manifestPath, "utf8");
  const lockfileBeforeFailedInstall = readFileSync(lockfilePath, "utf8");
  const failingReviews = new WorkspaceChangeReviewService(reviewWorkspace, {
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({
          name: "nanoid",
          version: "5.1.11",
          dist: {
            integrity: fakeIntegrity,
            tarball: "https://registry.npmjs.org/nanoid/-/nanoid-5.1.11.tgz",
          },
        }),
      )) as typeof fetch,
    installDependency: async () => {
      writeFileSync(manifestPath, '{"name":"partially-mutated"}\n', "utf8");
      writeFileSync(lockfilePath, "partial: true\n", "utf8");
      return { ok: false, output: "simulated package-manager failure" };
    },
  });
  const failingApproval = await failingReviews.requestDependencyInstall({
    packageName: "nanoid",
    version: "5.1.11",
    target: "root",
    sessionId: "sandbox-regression",
  });
  assert.equal((await failingReviews.approve(failingApproval.id))?.outcome, "failed");
  assert.equal(readFileSync(manifestPath, "utf8"), manifestBeforeFailedInstall);
  assert.equal(readFileSync(lockfilePath, "utf8"), lockfileBeforeFailedInstall);
  failingReviews.clear();
} finally {
  rmSync(reviewWorkspace, { recursive: true, force: true });
}

const status = getWorkspaceShellSandboxStatus();
if (!status.available) {
  assert.ok(status.reason.length > 0);
  console.log(`Professor Mari shell sandbox regression skipped runtime proof: ${status.reason}`);
} else {
  const workspace = mkdtempSync(join(tmpdir(), "marinara-mari-sandbox-workspace-"));
  const outside = mkdtempSync(join(tmpdir(), "marinara-mari-sandbox-outside-"));
  const outsideSecret = join(outside, "secret.txt");
  const insideFile = join(workspace, "inside.txt");
  const workspaceSecret = join(workspace, ".env");
  const protectedManifest = join(workspace, "package.json");
  writeFileSync(outsideSecret, "outside-secret", "utf8");
  writeFileSync(workspaceSecret, "WORKSPACE_SECRET=must-not-leak", "utf8");
  writeFileSync(protectedManifest, '{"name":"sandbox-fixture"}\n', "utf8");
  try {
    const command = [
      'test -z "${MARINARA_SANDBOX_SECRET:-}" || exit 40',
      `if head -c 1 ${shellQuote(outsideSecret)} >/dev/null 2>&1; then exit 41; fi`,
      "if command -v curl >/dev/null 2>&1 && curl -m 2 -fsS https://example.com >/dev/null 2>&1; then exit 42; fi",
      "if head -c 1 .env >/dev/null 2>&1; then exit 43; fi",
      "if printf tampered > package.json 2>/dev/null; then exit 44; fi",
      `printf inside-ok > ${shellQuote(insideFile)}`,
      "printf sandbox-ok",
    ].join("; ");
    const sandboxed = await spawnWorkspaceSandboxedShell({
      command,
      workspaceRoot: workspace,
      env: { ...process.env, MARINARA_SANDBOX_SECRET: "must-not-leak" },
    });
    let stdout = "";
    let stderr = "";
    sandboxed.child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    sandboxed.child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      sandboxed.child.on("close", (code, signal) => resolve({ code, signal }));
    });
    await sandboxed.cleanup();
    assert.deepEqual(result, { code: 0, signal: null }, stderr);
    assert.equal(stdout, "sandbox-ok");
    assert.equal(readFileSync(insideFile, "utf8"), "inside-ok");
    assert.equal(readFileSync(outsideSecret, "utf8"), "outside-secret");
    assert.equal(readFileSync(workspaceSecret, "utf8"), "WORKSPACE_SECRET=must-not-leak");
    assert.equal(readFileSync(protectedManifest, "utf8"), '{"name":"sandbox-fixture"}\n');
    console.log(`Professor Mari shell sandbox regression passed with ${sandboxed.backend}.`);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
}
