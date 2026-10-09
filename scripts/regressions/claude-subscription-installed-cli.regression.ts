import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compareVersions,
  findClaudeCodeInstall,
  readClaudeCodeModelCatalog,
} from "../../packages/server/src/services/llm/providers/claude-subscription/installed-cli.js";

assert.ok(compareVersions("2.1.294", "2.1.282") > 0);
assert.equal(compareVersions("2.1.282 (Claude Code)", "2.1.282"), 0);
assert.ok(compareVersions("2.1.9", "2.1.10") < 0, "compare numerically, not as text");

const home = await mkdtemp(join(tmpdir(), "marinara-claude-cli-"));
try {
  // Host install: the native location wins, an older build is skipped for a newer one on PATH.
  const native = join(home, ".local", "bin", process.platform === "win32" ? "claude.exe" : "claude");
  const onPath = join(home, "bin", process.platform === "win32" ? "claude.exe" : "claude");
  const versions = new Map([[native, "2.1.294"]]);
  const probe = async (path: string) => versions.get(path) ?? null;
  const env = { PATH: join(home, "bin") };
  assert.deepEqual(await findClaudeCodeInstall("2.1.282", { env, home, probe }), { path: native, version: "2.1.294" });
  versions.set(native, "2.1.200");
  assert.equal(await findClaudeCodeInstall("2.1.282", { env, home, probe }), null, "never downgrade the bundled build");
  versions.set(onPath, "2.1.300");
  assert.deepEqual(await findClaudeCodeInstall("2.1.282", { env, home, probe }), { path: onPath, version: "2.1.300" });
  assert.equal(await findClaudeCodeInstall(null, { env, home, probe }), null, "unknown bundled version keeps it");
  const optedOut = { ...env, CLAUDE_SUBSCRIPTION_USE_INSTALLED_CLI: "false" };
  assert.equal(
    await findClaudeCodeInstall("2.1.282", { env: optedOut, home, probe }),
    null,
    "env opt-out keeps bundled",
  );
  versions.clear();
  assert.equal(await findClaudeCodeInstall("2.1.282", { env, home, probe }), null);

  // Model catalog: only the signed-in organization's newest catalog, gated by CLI version.
  const org = "11111111-2222-3333-4444-555555555555";
  const catalogDir = join(home, ".claude", "cache", "model-catalog");
  await mkdir(catalogDir, { recursive: true });
  assert.deepEqual(await readClaudeCodeModelCatalog("2.1.294", { env: {}, home }), [], "no account, no catalog");
  await writeFile(join(home, ".claude.json"), JSON.stringify({ oauthAccount: { organizationUuid: org } }));
  const catalog = (fetchedAt: number, models: unknown[]) =>
    JSON.stringify({ fetchedAt, catalog: { surface: "cc", config: { models } } });
  await writeFile(join(catalogDir, `${org}-old-cc.json`), catalog(1, [{ id: "claude-old", name: "Old" }]));
  await writeFile(
    join(catalogDir, `${org}-new-cc.json`),
    catalog(2, [
      { id: "claude-haiku-5-5", name: "Haiku 5.5" },
      { id: "claude-next", name: "Next", min_claude_code_version: "2.1.300" },
      { id: "bad id; rm -rf", name: "Bad" },
    ]),
  );
  await writeFile(join(catalogDir, `other-org-cc.json`), catalog(3, [{ id: "claude-other", name: "Other" }]));
  await writeFile(join(catalogDir, `${org}-new-ccd.json`), catalog(4, [{ id: "claude-desktop", name: "Desktop" }]));
  assert.deepEqual(await readClaudeCodeModelCatalog("2.1.294", { env: {}, home }), [
    { id: "claude-haiku-5-5", name: "Claude Haiku 5.5" },
  ]);
  assert.deepEqual(
    (await readClaudeCodeModelCatalog("2.1.300", { env: {}, home })).map((m) => m.id),
    ["claude-haiku-5-5", "claude-next"],
  );

  // CLAUDE_CONFIG_DIR keeps the account file inside the config directory.
  const configDir = join(home, "custom");
  await mkdir(join(configDir, "cache", "model-catalog"), { recursive: true });
  await writeFile(join(configDir, ".claude.json"), JSON.stringify({ oauthAccount: { organizationUuid: org } }));
  await writeFile(
    join(configDir, "cache", "model-catalog", `${org}-x-cc.json`),
    catalog(1, [{ id: "claude-custom", name: "Custom" }]),
  );
  assert.deepEqual(
    (await readClaudeCodeModelCatalog(null, { env: { CLAUDE_CONFIG_DIR: configDir }, home })).map((m) => m.id),
    ["claude-custom"],
  );
} finally {
  await rm(home, { recursive: true, force: true });
}

console.log("claude-subscription installed CLI regression passed");
