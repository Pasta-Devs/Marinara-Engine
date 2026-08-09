import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getWorkspaceShellSandboxStatus,
  sanitizeWorkspaceShellEnv,
  spawnWorkspaceSandboxedShell,
} from "../../packages/server/src/services/professor-mari/workspace-shell-sandbox.js";
import {
  isPackageManagerMutationCommand,
  WorkspaceChangeReviewService,
  workspacePathAccessPolicy,
} from "../../packages/server/src/services/professor-mari/workspace-change-review.service.js";
import { ProfessorMariWorkspaceService } from "../../packages/server/src/services/professor-mari/workspace-agent.service.js";

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
  new URL("../../packages/server/src/services/professor-mari/workspace-shell-sandbox.ts", import.meta.url),
  "utf8",
);
const workspaceSource = readFileSync(
  new URL("../../packages/server/src/services/professor-mari/workspace-agent.service.ts", import.meta.url),
  "utf8",
);
assert.match(sandboxSource, /\(deny network\*\)/u);
assert.match(sandboxSource, /--unshare-all/u);
assert.match(sandboxSource, /throw new Error\(\s*`\$\{status\.reason\}/u);
assert.match(workspaceSource, /spawnWorkspaceSandboxedShell/u);
assert.match(workspaceSource, /Use the dependency tool/u);
assert.match(workspaceSource, /name: "copy"/u);
assert.match(workspaceSource, /name: "move"/u);
assert.match(workspaceSource, /name: "remove"/u);
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
      },
      signal: AbortSignal,
      trace: unknown[],
      onEvent: () => void,
    ): Promise<{ output: string; success: boolean }>;
  };
  let commandId = 0;
  const runFileCommand = (name: "copy" | "move" | "remove", args: Record<string, unknown>) =>
    commandRunner.executeWorkspaceCommand(
      { id: `structured-${commandId++}`, name, arguments: args },
      new AbortController().signal,
      [],
      () => undefined,
    );

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
