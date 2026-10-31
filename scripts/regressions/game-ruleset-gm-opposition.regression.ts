/**
 * Who plays the other side of a fight (Capability API 1.774): `gm.opposition`.
 *
 *   - `game-master` and `engine` parse; anything else is refused.
 *   - The install gate. What it does in a fight is checked by the director route lane.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseRulesetDefinition, supportedCapabilityApi } from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-gm-opposition-"));
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 774);
  const base = () =>
    JSON.parse(readFileSync(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8"));
  const withOpposition = (opposition: unknown) => {
    const doc = base();
    doc.gm.opposition = opposition;
    return doc;
  };
  for (const opposition of ["game-master", "engine"]) {
    const result = parseRulesetDefinition(withOpposition(opposition));
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    if (result.ok) assert.equal(result.definition.gm.opposition, opposition);
  }
  const plain = parseRulesetDefinition(base());
  assert.ok(plain.ok && plain.definition.gm.opposition === undefined, "nothing said is the Engine's picker");
  assert.equal(parseRulesetDefinition(withOpposition("players")).ok, false, "an unknown side is refused");

  const gate =
    "A ruleset that says who plays the other side of a fight (gm.opposition) requires schemaVersion 2 and capabilityApi 1.774 or newer";
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    id: "fate",
    name: "Fate",
    version: "1.0.0",
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  assert.equal(getCapabilityPackageInstallIssue(manifest(773) as never, withOpposition("game-master")), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(774) as never, withOpposition("game-master")), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(773) as never, base()), gate);

  console.log("GM opposition: game-master and engine parse, anything else is refused; gated at 1.774.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
