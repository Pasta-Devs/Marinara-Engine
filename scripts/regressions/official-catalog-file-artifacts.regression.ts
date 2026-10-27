// ──────────────────────────────────────────────
// Regression: official catalog entries published as files, not zips
// ──────────────────────────────────────────────
// The official catalog pins each entry's artifact to its canonical Marinara-Agents URL. A ruleset is
// published as its ruleset package file (`<id>-<version>.ruleset.json`, Capability API 1.374) and an
// Experience as its Experience file (`<id>-<version>.experience.json`), never a zip, since those are the
// only forms the installer takes. The canonical name used to be `<id>-<version>.zip` for every kind, so a
// ruleset entry made the published catalog throw (every package gone) and was dropped from the preview
// overlay, and its URL would have been rewritten to a .zip that does not exist. Pinned here:
//   * a ruleset or Experience file entry loads from the published catalog and from the overlay, its
//     artifact resolved onto the catalog's own branch under its published name;
//   * a .zip entry (including a ruleset still listed as one) still loads and resolves as before;
//   * a name that is not the entry's own (another kind's, another version's) is still refused.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-official-catalog-files-"));
process.env.DATA_DIR = dataDir;
process.env.MARINARA_GIT_BRANCH = "staging";
process.env.LOG_LEVEL = "silent";
delete process.env.MARINARA_AGENT_CATALOG_URL;

const AGENTS_ROOT = "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents";
const artifacts = (branch: "main" | "staging") => `${AGENTS_ROOT}/${branch}/artifacts`;
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

function rulesetEntry(id: string, branch: "main" | "staging", artifactName = `${id}-1.0.0.ruleset.json`) {
  return {
    manifest: {
      schemaVersion: 2,
      id,
      name: id,
      version: "1.0.0",
      description: "Official catalog file regression fixture.",
      engine: { min: "2.4.0", maxExclusive: "3.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: sha256("{}"), bytes: 2 }],
      permissions: [],
      restartRequired: false,
      capabilityApi: { major: 1, minor: 374 },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    },
    category: "misc" as const,
    artifact: { url: `${artifacts(branch)}/${artifactName}`, sha256: "1".repeat(64), bytes: 10 },
  };
}

function experienceEntry(id: string, branch: "main" | "staging") {
  const entry = rulesetEntry(id, branch, `${id}-1.0.0.experience.json`);
  return {
    ...entry,
    manifest: {
      ...entry.manifest,
      kind: ["experience"],
      contributions: { slots: ["game-surface"], gameSurface: { setup: {} }, assets: { paths: ["art/dot.png"] } },
      files: [{ path: "art/dot.png", sha256: sha256("{}"), bytes: 2 }],
      capabilityApi: { major: 1, minor: 373 },
    },
  };
}

function zipEntry(id: string, branch: "main" | "staging") {
  return {
    manifest: {
      schemaVersion: 1,
      id,
      name: id,
      version: "1.0.0",
      description: "Official catalog file regression fixture.",
      engine: { min: "2.3.0", maxExclusive: "3.0.0" },
      kind: ["agent"],
      entrypoints: { server: "server.mjs" },
      files: [{ path: "server.mjs", sha256: "0".repeat(64), bytes: 1 }],
      permissions: ["ui"],
      restartRequired: true,
    },
    category: "misc" as const,
    artifact: { url: `${artifacts(branch)}/${id}-1.0.0.zip`, sha256: "1".repeat(64), bytes: 1 },
  };
}

const documentOf = (packages: unknown[]) => ({ schemaVersion: 1, generatedAt: "2026-10-01T00:00:00.000Z", packages });
const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

try {
  const {
    capabilityPackageManager,
    getCapabilityPackageArtifactSourceIssue,
    resolveCapabilityPackageArtifactUrl,
    resolveCapabilityCatalogUrl,
    resolvePreviewCatalogUrl,
  } = await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
  const { capabilityCatalogPackageSchema } =
    await import("../../packages/shared/src/schemas/capability-package.schema.js");
  const parse = (entry: unknown) => capabilityCatalogPackageSchema.parse(entry);

  const stagingCatalog = resolveCapabilityCatalogUrl("2.4.3", "", "staging");
  const mainCatalog = resolveCapabilityCatalogUrl("2.4.3", "", "main");
  assert.equal(stagingCatalog, `${AGENTS_ROOT}/staging/catalog/v2/catalog.json`);

  // ── Each kind's canonical name, on either official catalog ──
  for (const catalogUrl of [mainCatalog, stagingCatalog]) {
    const branch = catalogUrl === mainCatalog ? "main" : "staging";
    for (const published of ["main", "staging"] as const) {
      if (published === "staging" && branch === "main") continue;
      const ruleset = parse(rulesetEntry("rules-pack", published));
      assert.equal(
        getCapabilityPackageArtifactSourceIssue(ruleset, catalogUrl),
        null,
        `${branch}/${published} ruleset`,
      );
      assert.equal(
        resolveCapabilityPackageArtifactUrl(ruleset, catalogUrl),
        `${artifacts(branch)}/rules-pack-1.0.0.ruleset.json`,
        "a ruleset resolves to its ruleset file on the catalog's branch",
      );
      const experience = parse(experienceEntry("world-pack", published));
      assert.equal(getCapabilityPackageArtifactSourceIssue(experience, catalogUrl), null);
      assert.equal(
        resolveCapabilityPackageArtifactUrl(experience, catalogUrl),
        `${artifacts(branch)}/world-pack-1.0.0.experience.json`,
        "an Experience resolves to its Experience file on the catalog's branch",
      );
      const agent = parse(zipEntry("zip-agent", published));
      assert.equal(getCapabilityPackageArtifactSourceIssue(agent, catalogUrl), null);
      assert.equal(resolveCapabilityPackageArtifactUrl(agent, catalogUrl), `${artifacts(branch)}/zip-agent-1.0.0.zip`);
    }
    // A ruleset still listed as a zip keeps the catalog loading (the install refuses it, saying why).
    const rulesetZip = parse(rulesetEntry("rules-pack", "main", "rules-pack-1.0.0.zip"));
    assert.equal(getCapabilityPackageArtifactSourceIssue(rulesetZip, catalogUrl), null);
    assert.equal(
      resolveCapabilityPackageArtifactUrl(rulesetZip, catalogUrl),
      `${artifacts(branch)}/rules-pack-1.0.0.zip`,
    );
    // Names that are not the entry's own stay refused.
    for (const name of [
      "rules-pack-1.0.0.json",
      "rules-pack-0.9.0.ruleset.json",
      "other-1.0.0.ruleset.json",
      "rules-pack-1.0.0.experience.json",
    ]) {
      assert.match(
        getCapabilityPackageArtifactSourceIssue(parse(rulesetEntry("rules-pack", "main", name)), catalogUrl) ?? "",
        /canonical Marinara-Agents artifact URL/,
        name,
      );
    }
    const agentAsRuleset = parse({
      ...zipEntry("zip-agent", "main"),
      artifact: { ...zipEntry("zip-agent", "main").artifact, url: `${artifacts("main")}/zip-agent-1.0.0.ruleset.json` },
    });
    assert.match(
      getCapabilityPackageArtifactSourceIssue(agentAsRuleset, catalogUrl) ?? "",
      /canonical Marinara-Agents artifact URL/,
      "only a ruleset is published as a ruleset file",
    );
  }
  // A custom catalog is not held to the official names.
  const custom = parse(rulesetEntry("rules-pack", "main", "rules-pack-1.0.0.json"));
  assert.equal(getCapabilityPackageArtifactSourceIssue(custom, "https://example.com/catalog.json"), null);

  // ── Through catalog(): the published lanes and the preview overlay, on a staging Engine ──
  const previewUrl = resolvePreviewCatalogUrl("2.4.3", "", true)!;
  const requested: string[] = [];
  const fetchImpl = (async (url: string | URL) => {
    const href = String(url);
    requested.push(href);
    return href === previewUrl
      ? ok(documentOf([rulesetEntry("preview-rules", "staging")]))
      : ok(
          documentOf([
            rulesetEntry("published-rules", "main"),
            experienceEntry("published-world", "main"),
            zipEntry("published-agent", "main"),
          ]),
        );
  }) as never;
  const catalog = await capabilityPackageManager.catalog(fetchImpl, previewUrl);
  assert.ok(requested.includes(previewUrl));
  const byId = new Map(catalog.packages.map((entry) => [entry.manifest.id, entry]));
  assert.deepEqual([...byId.keys()].sort(), ["preview-rules", "published-agent", "published-rules", "published-world"]);
  assert.equal(byId.get("published-rules")?.artifact.url, `${artifacts("staging")}/published-rules-1.0.0.ruleset.json`);
  assert.equal(
    byId.get("published-world")?.artifact.url,
    `${artifacts("staging")}/published-world-1.0.0.experience.json`,
  );
  assert.equal(byId.get("published-agent")?.artifact.url, `${artifacts("staging")}/published-agent-1.0.0.zip`);
  const preview = byId.get("preview-rules");
  assert.equal(preview?.preview, true, "the overlay's ruleset is kept, not dropped");
  assert.equal(preview?.artifact.url, `${artifacts("staging")}/preview-rules-1.0.0.ruleset.json`);

  console.info("Official catalog file artifacts: ruleset and Experience files load and resolve; zips unchanged.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
