/**
 * Importing a ruleset file, and removing one again, through `/api/game-rulesets`.
 *
 * What is pinned here:
 *   - The file is filed under `local/<its own id>`, and re-importing the same bytes is a no-op.
 *   - Different bytes under a stored version are a 409 the importer can act on, never a swap.
 *   - An Engine-owned id, an unusable file and an oversized one are each a 400.
 *   - Import follows the custom Agent import policy; REMOVAL does not, because a user who turned
 *     imports off must still be able to clean up.
 *   - Removing a ruleset a game plays on needs a second, explicit confirmation, and then takes
 *     every stored version with it.
 *   - `/rulesets` lists a community ruleset's stored versions, so the UI can say what goes.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { RULESET_MAX_BYTES, type GameSetupConfig } from "../../packages/shared/src/index.js";

const exampleUrl = new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url);
const exampleText = readFileSync(fileURLToPath(exampleUrl), "utf8");

/** A variant of the shipped 5e document: parse, edit, serialize. */
function ruleset(edit: (doc: Record<string, any>) => void): string {
  const doc = JSON.parse(exampleText) as Record<string, any>;
  edit(doc);
  return JSON.stringify(doc, null, 2);
}

const houseV1 = ruleset((doc) => {
  doc.id = "house-rules";
  doc.name = "House Rules";
});
const houseV1Relabelled = ruleset((doc) => {
  doc.id = "house-rules";
  doc.name = "House Rules";
  doc.sheet.skills[0].label = "Tumbling";
});
const houseV2 = ruleset((doc) => {
  doc.id = "house-rules";
  doc.name = "House Rules";
  doc.version = 2;
});
const spare = ruleset((doc) => {
  doc.id = "spare-rules";
  doc.name = "Spare Rules";
});
const reserved = ruleset((doc) => {
  doc.id = "traditional";
  doc.name = "Not a ruleset";
});

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-import-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { setCustomAgentImportsEnabled } =
  await import("../../packages/server/src/services/agents/custom-agent-import-policy.service.js");
const { gameRulesetsRoutes } = await import("../../packages/server/src/routes/game-rulesets.routes.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
const { capabilityPackagesRoutes } = await import("../../packages/server/src/routes/capability-packages.routes.js");

const db = await getDB();
const rulesets = createGameRulesetsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(gameRulesetsRoutes, { prefix: "/api/game-rulesets" });
await app.register(gameRoutes, { prefix: "/api/game" });
await app.register(capabilityPackagesRoutes, { prefix: "/api/capability-packages" });

const importFile = (definition: string) =>
  app.inject({ method: "POST", url: "/api/game-rulesets/import", payload: { definition } });
const removeRuleset = (rulesetId: string, force = false) =>
  app.inject({
    method: "DELETE",
    url: `/api/game-rulesets?rulesetId=${encodeURIComponent(rulesetId)}${force ? "&force=true" : ""}`,
  });
const listRulesets = () => app.inject({ method: "GET", url: "/api/capability-packages/rulesets" });

try {
  // ── The happy path, and the same file twice ──
  {
    const added = await importFile(houseV1);
    assert.equal(added.statusCode, 200, added.body);
    assert.deepEqual(added.json(), { status: "added", rulesetId: "local/house-rules", version: 1 });
    assert.equal(
      (await rulesets.get("local/house-rules", 1))?.definition,
      houseV1,
      "the file is stored verbatim, so a re-import of the same file is recognisable as the same bytes",
    );

    const again = await importFile(houseV1);
    assert.equal(again.statusCode, 200, again.body);
    assert.equal(again.json().status, "unchanged", "importing the same file twice changes nothing");
  }

  // ── A stored version is never rewritten ──
  {
    const conflict = await importFile(houseV1Relabelled);
    assert.equal(conflict.statusCode, 409, conflict.body);
    assert.equal(conflict.json().code, "ruleset_version_conflict");
    assert.match(conflict.json().error, /Raise the ruleset's version number/);
    assert.equal(
      (await rulesets.get("local/house-rules", 1))?.definition,
      houseV1,
      "a refused import leaves the stored bytes exactly as they were",
    );
  }

  // ── Files this Engine cannot take ──
  {
    const engineOwned = await importFile(reserved);
    assert.equal(engineOwned.statusCode, 400, engineOwned.body);
    assert.match(engineOwned.json().error, /Engine-owned ruleset id/);

    // Exactly at the ceiling is still a file the Engine takes. `$comment` is dropped before the
    // strict schema sees it, so it pads the file without changing what it means.
    const ceilingBase = ruleset((doc) => {
      doc.id = "ceiling-rules";
      doc.name = "Ceiling Rules";
      doc.$comment = "";
    });
    const atCeiling = ruleset((doc) => {
      doc.id = "ceiling-rules";
      doc.name = "Ceiling Rules";
      doc.$comment = " ".repeat(RULESET_MAX_BYTES - Buffer.byteLength(ceilingBase, "utf8"));
    });
    assert.equal(Buffer.byteLength(atCeiling, "utf8"), RULESET_MAX_BYTES);
    const accepted = await importFile(atCeiling);
    assert.equal(accepted.statusCode, 200, accepted.body);
    // Taken out again so the counts below stay about the refusals.
    assert.equal(await rulesets.removeAll("local/ceiling-rules"), 1);

    const oversize = await importFile(" ".repeat(RULESET_MAX_BYTES + 1));
    assert.equal(oversize.statusCode, 400, oversize.body);
    assert.match(oversize.json().error, new RegExp(`over the ${RULESET_MAX_BYTES}-byte limit`));

    const notJson = await importFile("{ not json");
    assert.equal(notJson.statusCode, 400, notJson.body);
    assert.match(notJson.json().error, /not valid JSON/);

    const unusable = await importFile(
      ruleset((doc) => {
        doc.id = "broken-rules";
        doc.sheet.skills[0].ability = "luck";
      }),
    );
    assert.equal(unusable.statusCode, 400, unusable.body);
    assert.match(unusable.json().error, /Unknown ability "luck"/);
    assert.equal((await rulesets.list()).length, 1, "no refusal left a row behind");
  }

  // ── Every stored version is listed, ascending ──
  {
    assert.equal((await importFile(houseV2)).statusCode, 200);
    const listed = await listRulesets();
    assert.equal(listed.statusCode, 200, listed.body);
    const entries = listed.json() as Array<{ definition: { id: string; version: number }; versions?: number[] }>;
    const imported = entries.find((entry) => entry.definition.id === "local/house-rules");
    assert.ok(imported, "the imported ruleset is listed");
    assert.deepEqual(imported.versions, [1, 2], "the UI can say which versions removing it would take");
    assert.equal(imported.definition.version, 2, "the listed definition is the highest stored version");
  }

  // ── A game on the ruleset makes removal a two-step act ──
  const gameConfig = {
    genre: "Fantasy",
    setting: "A quiet harbor",
    tone: "Hopeful",
    difficulty: "normal",
    rating: "sfw",
    playerGoals: "Find my lost friend",
    gmMode: "standalone",
    partyCharacterIds: [],
  } as unknown as GameSetupConfig;
  {
    const created = await app.inject({
      method: "POST",
      url: "/api/game/create",
      payload: { name: "House game", setupConfig: { ...gameConfig, ruleset: { id: "local/house-rules", version: 2 } } },
    });
    assert.equal(created.statusCode, 200, created.body);

    const refused = await removeRuleset("local/house-rules");
    assert.equal(refused.statusCode, 409, refused.body);
    assert.equal(refused.json().code, "ruleset_in_use");
    assert.equal(refused.json().games, 1, "the count names how much is at stake");
    assert.equal((await rulesets.list()).length, 2, "the refusal removed nothing");

    const forced = await removeRuleset("local/house-rules", true);
    assert.equal(forced.statusCode, 200, forced.body);
    assert.equal(forced.json().removed, 2, "removing a ruleset takes every stored version of it");
    assert.equal(await rulesets.get("local/house-rules", 1), null);
    assert.equal(await rulesets.get("local/house-rules", 2), null);
  }

  // ── The import policy gates importing, never cleaning up ──
  {
    assert.equal((await importFile(spare)).statusCode, 200);
    await setCustomAgentImportsEnabled(db, false);

    const blocked = await importFile(houseV1);
    assert.equal(blocked.statusCode, 403, blocked.body);
    assert.equal((await rulesets.list()).length, 1, "nothing was stored while imports are off");

    const removed = await removeRuleset("local/spare-rules");
    assert.equal(removed.statusCode, 200, removed.body);
    assert.equal(removed.json().removed, 1, "a user who turned imports off can still clean up");
    assert.equal((await rulesets.list()).length, 0);

    await setCustomAgentImportsEnabled(db, true);
  }

  // ── Only an imported ruleset is removable here ──
  {
    const official = await removeRuleset("my-5e");
    assert.equal(official.statusCode, 400, official.body);
    assert.match(official.json().error, /not an imported ruleset/);
  }

  console.info("game ruleset import regressions passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
