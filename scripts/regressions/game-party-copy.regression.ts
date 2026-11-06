/**
 * A copy of a party member joins the party (5e's Simulacrum): `[party_change: ... copy_of=... condition=...]`.
 *
 *   - The tag parser reads `copy_of` and `condition` on an add.
 *   - /party/recruit with `copyOf`: a game character of the new name joins, with the member's card and
 *     build, fresh but for the ruleset condition it holds from the start; nothing is generated.
 *   - Naming no member, a creature of the ruleset's bestiary is copied instead: its card names the
 *     creature, and in a fight it is that creature on the party's side, its conditions and health read
 *     from its live state and written back.
 *   - A member nobody has, or a condition the ruleset lacks, is refused.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseGmTags, parseRulesetDefinition } from "../../packages/shared/src/index.js";

// ── The tag ──
{
  const tags = parseGmTags(
    'They wake. [party_change: character="Lia\'s Simulacrum" change="add" copy_of="Lia" condition="poisoned"] [party_change: character="Bram" change="add"]',
  );
  assert.deepEqual(tags.partyChanges, [
    { characterName: "Lia's Simulacrum", change: "add", copyOf: "Lia", condition: "poisoned" },
    { characterName: "Bram", change: "add" },
  ]);
}

const exampleBytes = readFileSync(
  fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
);
const dataDir = mkdtempSync(join(tmpdir(), "marinara-party-copy-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const manifest = {
  schemaVersion: 2,
  capabilityApi: { major: 1, minor: 20 },
  builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
  id: "ruleset-5e-2014",
  name: "5e (SRD 5.1)",
  version: "0.1.0",
  description: "5e rules for Game Mode.",
  engine: { min: "2.4.6", maxExclusive: "4.0.0" },
  kind: ["ruleset"],
  entrypoints: {},
  contributions: { assets: { paths: ["ruleset.json"] } },
  files: [
    {
      path: "ruleset.json",
      sha256: createHash("sha256").update(exampleBytes).digest("hex"),
      bytes: exampleBytes.length,
    },
  ],
  permissions: [],
  restartRequired: false,
};
const packageDir = join(dataDir, "capability-packages", "versions", manifest.id, manifest.version);
mkdirSync(packageDir, { recursive: true });
writeFileSync(join(packageDir, "ruleset.json"), exampleBytes);
writeFileSync(
  join(dataDir, "capability-packages", "installed.json"),
  JSON.stringify({
    schemaVersion: 1,
    packages: [
      {
        id: manifest.id,
        version: manifest.version,
        manifest,
        installedAt: "2026-09-18T00:00:00.000Z",
        status: "active",
        error: null,
        legacy: false,
      },
    ],
  }),
);

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createRulesetFight, rulesetFightLiveStates } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");
const { createGameStateStorage, parseStoredRulesetLive } =
  await import("../../packages/server/src/services/storage/game-state.storage.js");
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(gameRoutes, { prefix: "/api/game" });

try {
  const chats = createChatsStorage(db);
  const created = await app.inject({
    method: "POST",
    url: "/api/game/create",
    payload: {
      name: "Simulacrum",
      setupConfig: {
        genre: "Fantasy",
        setting: "A wizard's tower",
        tone: "Wry",
        difficulty: "normal",
        rating: "sfw",
        playerGoals: "Make a copy",
        gmMode: "standalone",
        partyCharacterIds: [],
        ruleset: { id: "5e-2014", version: 1 },
      },
    },
  });
  assert.equal(created.statusCode, 200, created.body);
  const chatId = created.json().sessionChat.id as string;
  const build = {
    abilities: { str: 10, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
    skills: {},
    saves: {},
    bonuses: {},
    fields: { level: 9, hp_max: 50 },
    lists: {},
  };
  await chats.patchMetadata(chatId, {
    gameCharacterCards: [
      {
        name: "Lia",
        shortDescription: "A wizard.",
        class: "Wizard",
        abilities: ["Spellcasting"],
        strengths: ["Clever"],
        weaknesses: ["Frail"],
        extra: {},
        rulesetSheet: { v: 1, build },
      },
    ],
  });
  const states = createGameStateStorage(db);
  await states.create({
    chatId,
    messageId: "m1",
    swipeIndex: 0,
    rulesetLive: { lia: { conditions: ["prone"] } },
  } as never);

  const recruit = (payload: Record<string, unknown>) =>
    app.inject({ method: "POST", url: "/api/game/party/recruit", payload: { chatId, ...payload } });
  const copied = await recruit({ characterName: "Lia's Simulacrum", copyOf: "Lia", condition: "poisoned" });
  assert.equal(copied.statusCode, 200, copied.body);
  assert.equal(copied.json().added, true);
  const meta = JSON.parse((await chats.getById(chatId))!.metadata as string);
  const card = (meta.gameCharacterCards as Array<Record<string, any>>).find((one) => one.name === "Lia's Simulacrum")!;
  assert.ok(card, "the copy has a card");
  assert.equal(card.class, "Wizard");
  assert.deepEqual(card.rulesetSheet, { v: 1, build });
  assert.ok(
    (meta.gamePartyCharacterIds as string[]).some((id) => id.startsWith("npc:")),
    "the copy is in the party",
  );
  const live = parseStoredRulesetLive((await states.getLatest(chatId))!.rulesetLive)!;
  assert.deepEqual(
    live["lia's simulacrum"]?.conditions ??
      live[Object.keys(live).find((key) => key.includes("simulacrum"))!]?.conditions,
    ["poisoned"],
  );
  assert.deepEqual(live.lia?.conditions, ["prone"], "the member's own state is untouched");

  // ── A creature of the bestiary, copied ──
  const hound = await recruit({ characterName: "Hound Copy", copyOf: "Cinder Hound", condition: "poisoned" });
  assert.equal(hound.statusCode, 200, hound.body);
  const houndMeta = JSON.parse((await chats.getById(chatId))!.metadata as string);
  const houndCard = (houndMeta.gameCharacterCards as Array<Record<string, any>>).find(
    (one) => one.name === "Hound Copy",
  )!;
  assert.deepEqual(houndCard.rulesetCreature, { catalogId: "creatures", entryId: "cinder-hound" });
  assert.equal(houndCard.rulesetSheet, undefined);
  const houndLive = parseStoredRulesetLive((await states.getLatest(chatId))!.rulesetLive)!;
  assert.deepEqual(houndLive["hound copy"]?.conditions, ["poisoned"]);

  // ── In a fight, it is that creature on the party's side, as its live state left it ──
  {
    const parsed = parseRulesetDefinition(JSON.parse(exampleBytes.toString("utf8")));
    assert.ok(parsed.ok);
    const definition = parsed.definition;
    const bestiary = Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const built = createRulesetFight({
      definition,
      seed: 3,
      party: [{ id: "p-hound", name: "Hound Copy" }],
      enemies: [{ id: "e-lurker", name: "Thorn Lurker", creature: "creatures/thorn-lurker" }],
      cards: houndMeta.gameCharacterCards,
      playerName: null,
      live: { "hound copy": { conditions: ["poisoned"], pools: { hp: { value: 5 } } } },
      partyCatalogs: {},
      bestiary,
    } as never);
    assert.ok(built.ok, built.ok ? "" : built.error);
    const copy = built.fight.encounter.combatants.find((one) => one.id === "p-hound")!;
    assert.equal(copy.side, "party");
    assert.deepEqual(copy.creature && { catalogId: copy.creature.catalogId, entryId: copy.creature.entryId }, {
      catalogId: "creatures",
      entryId: "cinder-hound",
    });
    assert.equal(copy.health?.value, 5);
    assert.ok(copy.tracked.some((entry) => entry.condition === "poisoned"));
    copy.health!.value = 3;
    assert.deepEqual(rulesetFightLiveStates(built.fight)["hound copy"], {
      conditions: ["poisoned"],
      pools: { hp: { value: 3 } },
    });
  }

  // ── Refused: nobody to copy, or a condition the ruleset lacks ──
  assert.notEqual((await recruit({ characterName: "Echo", copyOf: "Nobody" })).statusCode, 200);
  assert.notEqual((await recruit({ characterName: "Echo", copyOf: "Lia", condition: "sparkly" })).statusCode, 200);

  console.log(
    "Simulacrum: a copy of a party member joins with their card and build, holding the condition; a bestiary creature copied fights as that creature on the party's side, its live state read and written back; refusals hold.",
  );
} finally {
  await app.close();
  await closeDB();
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(dataDir, { recursive: true, force: true });
}
