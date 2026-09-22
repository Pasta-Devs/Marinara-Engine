/**
 * Rulesets in the custom agent repository lane: a repository may carry Game Mode rulesets as
 * `<top>/rulesets/*.json` beside, or instead of, its `agents.json`.
 *
 * What is pinned here:
 *   - A repository may hold agents only, rulesets only, or both. One with neither is refused.
 *   - Only direct children of `rulesets/` count, at most 32 of them, each within RULESET_MAX_BYTES,
 *     checked on the header's claim and on the real bytes.
 *   - A file that is not a usable ruleset becomes one preview row the confirm skips; it never takes
 *     the repository's agents or its other rulesets down with it.
 *   - The owner is the namespace, lower-cased, so an import can never take an official ruleset's id.
 *   - Confirm stores the file text verbatim. A stored version is never rewritten: the same bytes are
 *     a no-op, different bytes under that version are reported and left alone.
 *   - Withdrawing a ruleset upstream, and removing the repository itself, both keep every stored
 *     version, because a game may be pinned to one.
 *
 * No network: DNS and `fetch` are replaced with the archive this file builds in memory.
 */
import assert from "node:assert/strict";
import { promises as dns } from "node:dns";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

import { RULESET_MAX_BYTES } from "../../packages/shared/src/index.js";

const exampleUrl = new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url);
const exampleText = readFileSync(fileURLToPath(exampleUrl), "utf8");

/** A variant of the shipped 5e document: parse, edit, serialize. */
function ruleset(edit: (doc: Record<string, any>) => void): string {
  const doc = JSON.parse(exampleText) as Record<string, any>;
  edit(doc);
  return JSON.stringify(doc, null, 2);
}

const my5eV1 = ruleset((doc) => {
  doc.id = "my-5e";
  doc.name = "My 5e";
});
const my5eV1Relabelled = ruleset((doc) => {
  doc.id = "my-5e";
  doc.name = "My 5e";
  doc.sheet.skills[0].label = "Tumbling";
});
const my5eV2 = ruleset((doc) => {
  doc.id = "my-5e";
  doc.name = "My 5e";
  doc.version = 2;
});
const reservedId = ruleset((doc) => {
  doc.id = "engine-legacy";
});
const otherFileSameId = ruleset((doc) => {
  doc.id = "my-5e";
  doc.name = "My 5e, again";
});

const agentDefinition = {
  id: "continuity-helper",
  name: "Continuity Helper",
  description: "Checks recent turns for contradictions.",
  phase: "post_processing" as const,
  enabledByDefault: false,
  category: "writer" as const,
  defaultPromptTemplate: "Check {{messages}} for continuity errors.",
};
const agentsJson = JSON.stringify([agentDefinition]);

const TOP = "example-rules-main";

function archiveOf(files: Record<string, string | Buffer>): Buffer {
  const zip = new AdmZip();
  for (const [path, body] of Object.entries(files)) {
    zip.addFile(path, typeof body === "string" ? Buffer.from(body, "utf8") : body);
  }
  return zip.toBuffer();
}

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-repository-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const {
  classifyRepositoryRulesets,
  createCustomAgentRepositoriesService,
  normalizeCustomAgentRepositoryUrl,
  parseCustomAgentRepositoryArchive,
  parseCustomAgentRepositoryContents,
} = await import("../../packages/server/src/services/agents/custom-agent-repositories.service.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { readRulesetRegistry, resolveGameRuleset } =
  await import("../../packages/server/src/services/game/ruleset-registry.service.js");

// ── The archive the stubbed download serves, swapped between syncs ──
let served = archiveOf({ [`${TOP}/agents.json`]: agentsJson, [`${TOP}/rulesets/my-5e.json`]: my5eV1 });
let downloads = 0;
const originalLookup = dns.lookup;
const originalFetch = globalThis.fetch;
dns.lookup = (async () => [{ address: "140.82.121.4", family: 4 }]) as typeof dns.lookup;
globalThis.fetch = (async () => {
  downloads += 1;
  return new Response(served, { headers: { "content-type": "application/zip" } });
}) as typeof globalThis.fetch;

const db = await getDB();
const service = createCustomAgentRepositoriesService(db);
const rulesets = createGameRulesetsStorage(db);
const url = "https://github.com/Alice/Example-Rules";
const repository = normalizeCustomAgentRepositoryUrl(url);

try {
  // ── What counts as a ruleset file, before anything is stored ──
  {
    const rulesetsOnly = parseCustomAgentRepositoryContents(archiveOf({ [`${TOP}/rulesets/my-5e.json`]: my5eV1 }));
    assert.deepEqual(rulesetsOnly.definitions, [], "a repository may publish rulesets and no agents");
    assert.deepEqual(
      rulesetsOnly.rulesets.map((entry) => entry.file),
      ["my-5e.json"],
    );

    const agentsOnly = archiveOf({ [`${TOP}/agents.json`]: agentsJson });
    assert.deepEqual(
      parseCustomAgentRepositoryArchive(agentsOnly),
      [agentDefinition],
      "a repository with no rulesets parses exactly as it did before",
    );
    assert.deepEqual(parseCustomAgentRepositoryContents(agentsOnly).rulesets, []);

    assert.throws(
      () => parseCustomAgentRepositoryContents(archiveOf({ [`${TOP}/README.md`]: "nothing to import" })),
      /agents\.json/u,
      "an archive with neither agents nor rulesets has nothing to import",
    );
    assert.throws(
      () =>
        parseCustomAgentRepositoryContents(
          archiveOf({ [`${TOP}/agents.json`]: agentsJson, "second-root/agents.json": agentsJson }),
        ),
      /at most one top-level agents\.json/u,
      "two agent lists would leave which one wins to chance",
    );

    assert.deepEqual(
      parseCustomAgentRepositoryContents(
        archiveOf({ [`${TOP}/agents.json`]: agentsJson, [`${TOP}/rulesets/sub/nested.json`]: my5eV1 }),
      ).rulesets,
      [],
      "only direct children of rulesets/ are published",
    );

    {
      // One oversized file is that file's problem: it becomes an unusable row and its neighbour
      // still installs.
      const withHuge = parseCustomAgentRepositoryContents(
        archiveOf({
          [`${TOP}/rulesets/huge.json`]: " ".repeat(RULESET_MAX_BYTES + 1),
          [`${TOP}/rulesets/my-5e.json`]: my5eV1,
        }),
      );
      const huge = withHuge.rulesets.find((entry) => entry.file === "huge.json");
      assert.equal(huge?.text, null, "an oversized file is never decoded");
      const rows = classifyRepositoryRulesets("alice", withHuge.rulesets);
      assert.match(rows.find((entry) => entry.file === "huge.json")!.issues[0]!, /over the \d+-byte limit/u);
      assert.equal(rows.find((entry) => entry.file === "my-5e.json")!.ruleset?.rulesetId, "alice/my-5e");
    }

    const tooMany: Record<string, string> = {};
    for (let index = 0; index <= 32; index += 1) tooMany[`${TOP}/rulesets/pack-${index}.json`] = my5eV1;
    assert.throws(
      () => parseCustomAgentRepositoryContents(archiveOf(tooMany)),
      /at most 32 rulesets/u,
      "the count ceiling holds whatever the files contain",
    );
  }

  // ── One unusable file is one row, never a refused repository ──
  {
    assert.equal(repository.owner, "alice", "the GitHub owner is the namespace, lower-cased");
    const contents = parseCustomAgentRepositoryContents(
      archiveOf({
        [`${TOP}/rulesets/broken.json`]: "{ not json",
        [`${TOP}/rulesets/engine-legacy.json`]: reservedId,
        [`${TOP}/rulesets/my-5e.json`]: my5eV1,
        [`${TOP}/rulesets/zz-my-5e-copy.json`]: otherFileSameId,
      }),
    );
    const classified = classifyRepositoryRulesets(repository.owner, contents.rulesets);
    const byFile = new Map(classified.map((entry) => [entry.file, entry]));

    // `local/` belongs to rulesets the user imported from a file. An account that happens to be
    // named "local" must not be able to file its rulesets among them.
    const fromLocalAccount = classifyRepositoryRulesets("local", contents.rulesets);
    assert.ok(
      fromLocalAccount.every((entry) => entry.ruleset === null && /account named "local"/u.test(entry.issues[0]!)),
      "nothing from an account named local is installable",
    );

    assert.match(byFile.get("broken.json")!.issues[0]!, /not valid JSON/u);
    assert.equal(byFile.get("broken.json")!.ruleset, null);
    assert.match(byFile.get("engine-legacy.json")!.issues.join(" "), /Engine-owned ruleset id/u);
    assert.equal(byFile.get("my-5e.json")!.ruleset?.rulesetId, "alice/my-5e");
    assert.match(
      byFile.get("zz-my-5e-copy.json")!.issues[0]!,
      /my-5e\.json already publishes/u,
      "which of two files claiming one id wins follows the file name, not the archive's order",
    );
    assert.equal(
      classified.filter((entry) => entry.ruleset).length,
      1,
      "the one usable file survives beside three that are not",
    );
  }

  // ── Adding the repository stores the bytes exactly as they arrived ──
  {
    const preview = await service.preview(url);
    assert.deepEqual(
      preview.rulesets.map((entry) => [entry.file, entry.rulesetId, entry.version, entry.status]),
      [["my-5e.json", "alice/my-5e", 1, "new"]],
    );
    assert.equal(preview.rulesets[0]!.name, "My 5e");
    assert.ok(preview.rulesets[0]!.coverage.length > 0, "the preview shows what the ruleset covers");

    const added = await service.add(url, preview.digest, true);
    assert.equal(added.rulesetCount, 1);
    assert.deepEqual(added.rulesets, { added: 1, unchanged: 0, skipped: 0 });

    const stored = await rulesets.get("alice/my-5e", 1);
    assert.equal(stored?.definition, my5eV1, "the file text is stored verbatim, never re-serialized");
    assert.equal(stored?.sourceKind, "repository");
    assert.equal(stored?.sourceUrl, repository.url);
    assert.equal(stored?.repositoryId, repository.id);
  }

  // ── Syncing the same archive changes nothing ──
  {
    const preview = await service.preview(url);
    assert.equal(preview.rulesets[0]!.status, "unchanged");
    const synced = await service.sync(repository.id, preview.digest, false);
    assert.deepEqual(synced.rulesets, { added: 0, unchanged: 1, skipped: 0 });
    assert.equal((await rulesets.list()).length, 1);
  }

  // ── A newer version joins the stored one rather than replacing it ──
  {
    served = archiveOf({ [`${TOP}/agents.json`]: agentsJson, [`${TOP}/rulesets/my-5e.json`]: my5eV2 });
    const preview = await service.preview(url);
    assert.deepEqual(
      preview.rulesets.map((entry) => [entry.version, entry.status]),
      [[2, "new-version"]],
    );
    const synced = await service.sync(repository.id, preview.digest, true);
    assert.deepEqual(synced.rulesets, { added: 1, unchanged: 0, skipped: 0 });
    assert.equal((await rulesets.list()).length, 2, "v2 stands beside v1");
  }

  // ── Different bytes under a stored version are reported, never swapped in ──
  {
    served = archiveOf({ [`${TOP}/agents.json`]: agentsJson, [`${TOP}/rulesets/my-5e.json`]: my5eV1Relabelled });
    const preview = await service.preview(url);
    assert.deepEqual(
      preview.rulesets.map((entry) => [entry.version, entry.status]),
      [[1, "conflict"]],
    );
    const synced = await service.sync(repository.id, preview.digest, true);
    assert.deepEqual(synced.rulesets, { added: 0, unchanged: 0, skipped: 1 });
    assert.equal(
      (await rulesets.get("alice/my-5e", 1))?.definition,
      my5eV1,
      "a game pinned to v1 keeps the arithmetic it was created on",
    );
  }

  // ── A ruleset withdrawn upstream stays installed ──
  {
    served = archiveOf({ [`${TOP}/agents.json`]: agentsJson });
    const preview = await service.preview(url);
    assert.deepEqual(preview.rulesets, []);
    const synced = await service.sync(repository.id, preview.digest, true);
    assert.deepEqual(synced.rulesets, { added: 0, unchanged: 0, skipped: 0 });
    assert.equal(synced.rulesetCount, 0);
    assert.equal((await rulesets.list()).length, 2, "the author withdrawing a file cannot end a game");
  }

  // ── Removing the repository forgets the source, never the rulesets ──
  {
    assert.equal((await rulesets.listByRepository(repository.id)).length, 2);
    assert.equal(await service.remove(repository.id), true);
    assert.equal((await rulesets.listByRepository(repository.id)).length, 0);
    const kept = await rulesets.get("alice/my-5e", 1);
    assert.equal(kept?.repositoryId, null, "only the managing repository is forgotten");
    assert.equal(kept?.sourceUrl, repository.url, "where it came from is still recorded");

    const registry = await readRulesetRegistry(db);
    assert.equal(registry.get("alice/my-5e")?.definition.version, 2, "the newest stored version leads the registry");
    const pinned = resolveGameRuleset(
      { gameRuleset: { id: "alice/my-5e", version: 1, packageId: null, source: repository.url, options: {} } },
      registry,
    );
    assert.equal(pinned.status, "ok", "a game pinned to a removed repository's ruleset still resolves");
    assert.equal(pinned.status === "ok" && pinned.definition.version, 1);
  }

  // ── A registry written before repositories carried rulesets still loads ──
  {
    mkdirSync(join(dataDir, "agents"), { recursive: true });
    writeFileSync(
      join(dataDir, "agents", "custom-repositories.json"),
      JSON.stringify({
        schemaVersion: 1,
        repositories: [
          {
            id: repository.id,
            url: repository.url,
            owner: repository.owner,
            name: repository.name,
            lastDigest: null,
            lastSyncedAt: null,
            agentCount: 1,
          },
        ],
      }),
    );
    const listed = await service.list();
    assert.equal(listed.length, 1, "an older registry file is read, not discarded");
    assert.equal(listed[0]!.rulesetCount, 0);
  }

  assert.ok(downloads > 0, "the archive was read through the real download path");
  console.info("game ruleset repository regressions passed.");
} finally {
  dns.lookup = originalLookup;
  globalThis.fetch = originalFetch;
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
