/**
 * An installed package whose files went missing (#9195: the phone hosting the Engine died during an install, and
 * `versions/expression/1.0.6` was gone on the next start) must not stop the Engine from starting. Its agents are left
 * out, the other packages' agents still load, and the package says it needs a check, once, until it is reinstalled.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-package-agents-missing-"));
process.env.DATA_DIR = dir;
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

const packagesRoot = join(dir, "capability-packages");
const registryPath = join(packagesRoot, "installed.json");

/** One agent definition, as a package's agents.json lists it. */
const agent = (id: string) => ({
  id,
  name: id,
  description: "Package agents regression fixture.",
  phase: "parallel",
  enabledByDefault: false,
  category: "misc",
  defaultPromptTemplate: "A prompt.",
});

/** An installed agents-only package (no server entrypoint), with its agents.json written and hashed. */
function agentsPackage(id: string, agentIds: string[]) {
  const versionRoot = join(packagesRoot, "versions", id, "1.0.0");
  mkdirSync(versionRoot, { recursive: true });
  const data = Buffer.from(JSON.stringify(agentIds.map(agent)));
  writeFileSync(join(versionRoot, "agents.json"), data);
  return {
    id,
    version: "1.0.0",
    manifest: {
      schemaVersion: 1,
      id,
      name: id,
      version: "1.0.0",
      description: "Package agents regression fixture.",
      engine: { min: "2.3.0", maxExclusive: "3.0.0" },
      kind: ["agent"],
      entrypoints: { agents: "agents.json" },
      files: [{ path: "agents.json", sha256: createHash("sha256").update(data).digest("hex"), bytes: data.byteLength }],
      permissions: [],
      restartRequired: false,
    },
    installedAt: "2026-11-14T00:00:00.000Z",
    status: "active",
    error: null,
    readiness: "ready",
    readinessError: null,
    legacy: false,
  };
}

const installed = () =>
  (JSON.parse(readFileSync(registryPath, "utf8")) as { packages: Array<Record<string, unknown>> }).packages;

const { capabilityPackageManager } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

const cases: RegressionCase[] = [
  {
    name: "a package whose version folder is gone is skipped, marked as needing a check, and the others still load",
    async run() {
      const expression = agentsPackage("expression", ["expression"]);
      const other = agentsPackage("other-agents", ["helper"]);
      writeFileSync(registryPath, JSON.stringify({ schemaVersion: 1, packages: [expression, other] }, null, 2));
      rmSync(join(packagesRoot, "versions", "expression"), { recursive: true, force: true });

      const definitions = await capabilityPackageManager.agentDefinitions();
      assert.deepEqual(
        definitions.map(({ id, packageId }) => ({ id, packageId })),
        [{ id: "helper", packageId: "other-agents" }],
      );
      const [broken, fine] = installed();
      assert.equal(broken!.readiness, "error");
      assert.match(String(broken!.readinessError), /Reinstall it/u);
      assert.equal(fine!.readiness, "ready");

      // Read again (every install refreshes the agents): still started, and the registry is not written again.
      const before = readFileSync(registryPath, "utf8");
      assert.deepEqual(
        (await capabilityPackageManager.agentDefinitions()).map(({ id }) => id),
        ["helper"],
      );
      assert.equal(readFileSync(registryPath, "utf8"), before);
    },
  },
  {
    name: "once the files read again, the agents load and the package no longer needs a check",
    async run() {
      const restored = agentsPackage("restored-agents", ["restored"]);
      writeFileSync(registryPath, JSON.stringify({ schemaVersion: 1, packages: [restored] }, null, 2));
      const file = join(packagesRoot, "versions", "restored-agents", "1.0.0", "agents.json");
      const original = readFileSync(file);
      writeFileSync(file, "[]");
      assert.deepEqual(await capabilityPackageManager.agentDefinitions(), []);
      assert.equal(installed()[0]!.readiness, "error");
      writeFileSync(file, original);
      assert.deepEqual(
        (await capabilityPackageManager.agentDefinitions()).map(({ id }) => id),
        ["restored"],
      );
      assert.deepEqual([installed()[0]!.readiness, installed()[0]!.readinessError], ["ready", null]);
    },
  },
  {
    name: "a restart-required update whose previous manifest is corrupt is skipped, and the others still load",
    async run() {
      const updating = {
        ...agentsPackage("updating-agents", ["updating"]),
        status: "restart-required",
        previousVersion: "0.9.0",
      };
      const other = agentsPackage("steady-agents", ["steady"]);
      const previousRoot = join(packagesRoot, "versions", "updating-agents", "0.9.0");
      mkdirSync(previousRoot, { recursive: true });
      writeFileSync(join(previousRoot, "manifest.json"), "{");
      writeFileSync(registryPath, JSON.stringify({ schemaVersion: 1, packages: [updating, other] }, null, 2));
      assert.deepEqual(
        (await capabilityPackageManager.agentDefinitions()).map(({ id }) => id),
        ["steady"],
      );
      assert.equal(installed()[0]!.readinessError, null, "a previous version's files say nothing about the new one");
    },
  },
  {
    name: "an agents file changed on disk is skipped the same way",
    async run() {
      const changed = agentsPackage("changed-agents", ["changed"]);
      writeFileSync(registryPath, JSON.stringify({ schemaVersion: 1, packages: [changed] }, null, 2));
      writeFileSync(join(packagesRoot, "versions", "changed-agents", "1.0.0", "agents.json"), "[]");
      assert.deepEqual(await capabilityPackageManager.agentDefinitions(), []);
      assert.equal(installed()[0]!.readiness, "error");
    },
  },
];

try {
  await runNamedCases(cases);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
