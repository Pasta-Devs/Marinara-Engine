/**
 * Slice 5 of Game Mode rulesets, server side: where live sheet state lives and how it rewinds.
 *
 * Live state (current pools, tracks, conditions) rides the game-state snapshot of a message and
 * swipe, because sheet commands are relative: a swipe or a regenerated turn must start from the
 * state BEFORE it, or it would spend twice. The arithmetic itself is pinned in
 * game-ruleset-live.regression.ts; this file pins the storage and the turn around it.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRulesetSheetEnvelope, parseRulesetDefinition } from "../../packages/shared/src/index.js";

const exampleUrl = new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url);
const exampleBytes = readFileSync(fileURLToPath(exampleUrl));
const parsedExample = parseRulesetDefinition(JSON.parse(exampleBytes.toString("utf8")));
assert.ok(parsedExample.ok);
const fiveE = parsedExample.definition;

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-live-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

// A really installed ruleset package: the registry record plus the hash-pinned asset on disk.
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
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createGameStateStorage, parseStoredRulesetLive } =
  await import("../../packages/server/src/services/storage/game-state.storage.js");
const { applyGameRulesetSheetTurn, loadGameRulesetSheetContext, renderGameRulesetSheetBlocks, sheetCommandCards } =
  await import("../../packages/server/src/services/game/ruleset-sheet-turn.service.js");
const { buildGmFormatReminder } = await import("../../packages/server/src/services/game/gm-prompts.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(chatsRoutes, { prefix: "/api/chats" });

try {
  const chats = createChatsStorage(db);
  const states = createGameStateStorage(db);

  // A wizard with two 3rd-level slots, in a game pinned to the installed ruleset.
  const wizard = createRulesetSheetEnvelope(fiveE);
  // A caster: the example hides every slot pool while the spellcasting ability is "none".
  wizard.build.fields = {
    ...wizard.build.fields,
    level: 5,
    hp_max: 32,
    spellcasting_ability: "int",
    slots_max_3: 2,
  };
  const chat = await chats.create({ name: "Live state", mode: "game", characterIds: [] } as never);
  assert.ok(chat?.id);
  const chatId = chat.id as string;
  await chats.patchMetadata(chatId, {
    gameRuleset: { id: "5e-2014", version: fiveE.version, packageId: manifest.id, options: {} },
    gameCharacterCards: [
      { name: "Mira", rulesetSheet: wizard },
      { name: "Tam the Bold" }, // no sheet: the blank build
    ],
  });

  // ── The turn: commands are applied against the state the turn started with ──
  const context = await loadGameRulesetSheetContext(db, chatId);
  assert.ok(context, "a pinned, installed ruleset loads");
  assert.deepEqual(
    context.cards.map((card) => card.name),
    ["Mira", "Tam the Bold"],
  );
  assert.equal(context.playerName, null, "no persona: a command that names nobody is refused, not guessed");

  const cast = 'Flame fills the hall. [sheet: who="Mira" op="spend" pool="slots_3" amount="1"]';
  const first = applyGameRulesetSheetTurn(context, cast, null);
  assert.match(first.content, /result="ok" now="1\/2"/);
  assert.deepEqual(first.live, { mira: { pools: { slots_3: { value: 1 } } } });

  // Message A is the turn before. Message B is the cast. Its row is cloned from A's and carries
  // the live state the turn ended with.
  const baseId = await states.create({
    chatId,
    messageId: "msg-a",
    swipeIndex: 0,
    date: null,
    time: null,
    location: "The hall",
    weather: null,
    temperature: null,
    presentCharacters: [],
    recentEvents: [],
    playerStats: null,
    personaStats: null,
  } as never);
  const baseRow = await states.getById(baseId, chatId);
  assert.ok(baseRow);
  assert.equal(parseStoredRulesetLive(baseRow.rulesetLive), null, "a row with no live state reads as none");

  await states.updateByMessage("msg-b", 0, chatId, { rulesetLive: first.live }, undefined, { baseSnapshot: baseRow });
  const castRow = await states.getByChatAndMessage(chatId, "msg-b", 0);
  assert.ok(castRow);
  assert.deepEqual(parseStoredRulesetLive(castRow.rulesetLive), first.live);
  assert.equal(castRow.location, "The hall", "the rest of the row is cloned from the turn before");

  // Regenerate: the new telling starts from A again, so the slot is spent once, not twice.
  const regenerated = applyGameRulesetSheetTurn(context, cast, parseStoredRulesetLive(baseRow.rulesetLive));
  assert.deepEqual(regenerated.live, first.live, "regenerate does not double-spend");
  // A telling with no cast leaves the slot alone: swiping to it restores the slot.
  const quiet = applyGameRulesetSheetTurn(context, "Mira holds her fire.", parseStoredRulesetLive(baseRow.rulesetLive));
  await states.updateByMessage("msg-b", 1, chatId, { rulesetLive: quiet.live }, undefined, { baseSnapshot: castRow });
  const quietRow = await states.getByChatAndMessage(chatId, "msg-b", 1);
  assert.ok(quietRow, "the swipe has a row of its own");
  assert.equal(parseStoredRulesetLive(quietRow.rulesetLive), null, "the swipe with no cast has every slot");
  assert.deepEqual(
    parseStoredRulesetLive((await states.getByChatAndMessage(chatId, "msg-b", 0))?.rulesetLive),
    first.live,
    "and the first telling still has its own",
  );

  // The next turn starts from the row it follows, and a cast with no slot left is refused.
  const second = applyGameRulesetSheetTurn(context, cast, first.live);
  assert.match(second.content, /result="ok" now="0\/2"/);
  const third = applyGameRulesetSheetTurn(context, cast, second.live);
  assert.match(third.content, /result="refused" reason="insufficient"/);
  assert.deepEqual(third.live, second.live, "a refused command changes nothing");
  assert.equal(third.outcomes[0]?.ok, false);

  // A tracker that rebuilds the row of the same message and swipe has never heard of live state.
  // The row keeps it; passing null on purpose still clears it.
  await states.create({
    chatId,
    messageId: "msg-b",
    swipeIndex: 0,
    date: "Day 2",
    time: null,
    location: "The hall",
    weather: null,
    temperature: null,
    presentCharacters: [],
    recentEvents: [],
    playerStats: null,
    personaStats: null,
  } as never);
  const rebuilt = await states.getByChatAndMessage(chatId, "msg-b", 0);
  assert.equal(rebuilt?.date, "Day 2");
  assert.deepEqual(parseStoredRulesetLive(rebuilt?.rulesetLive), first.live, "a rebuilt row keeps its live state");
  await states.updateByMessage("msg-b", 0, chatId, { rulesetLive: null });
  assert.equal(parseStoredRulesetLive((await states.getByChatAndMessage(chatId, "msg-b", 0))?.rulesetLive), null);

  // Junk in the column reads as none, never as a crash.
  assert.equal(parseStoredRulesetLive("{not json"), null);
  assert.equal(parseStoredRulesetLive(JSON.stringify({ mira: { pools: { hp: { value: "lots" } } } })), null);

  // ── The player's own edits go through the game-state route, bounded ──
  {
    const edited = await app.inject({
      method: "PATCH",
      url: `/api/chats/${chatId}/game-state`,
      payload: { rulesetLive: { mira: { pools: { hp: { value: 20 } }, conditions: ["poisoned"] } } },
    });
    assert.equal(edited.statusCode, 200, edited.body);
    assert.deepEqual(
      edited.json().rulesetLive,
      { mira: { pools: { hp: { value: 20 } }, conditions: ["poisoned"] } },
      "the PATCH answers with the object, not the stored JSON text",
    );
    const shown = await app.inject({ method: "GET", url: `/api/chats/${chatId}/game-state` });
    assert.equal(shown.statusCode, 200, shown.body);
    assert.deepEqual(shown.json().rulesetLive, { mira: { pools: { hp: { value: 20 } }, conditions: ["poisoned"] } });

    const junk = await app.inject({
      method: "PATCH",
      url: `/api/chats/${chatId}/game-state`,
      payload: { rulesetLive: { mira: { pools: { hp: { value: "lots" } } } } },
    });
    assert.equal(junk.statusCode, 400, "live state is validated at the boundary");
    const cleared = await app.inject({
      method: "PATCH",
      url: `/api/chats/${chatId}/game-state`,
      payload: { rulesetLive: null },
    });
    assert.equal(cleared.statusCode, 200, cleared.body);
    assert.equal(
      (await app.inject({ method: "GET", url: `/api/chats/${chatId}/game-state` })).json().rulesetLive,
      null,
    );
  }

  // ── The Game Master sees the sheets as they stand, late in the prompt ──
  {
    const blocks = renderGameRulesetSheetBlocks(fiveE, [{ name: "Mira", rulesetSheet: wizard }], second.live);
    assert.equal(blocks.length, 1);
    assert.match(blocks[0]!, /^Mira\n/);
    assert.match(blocks[0]!, /3rd-level slots 0\/2/);
    const base = { hasSceneModel: true } as never as Parameters<typeof buildGmFormatReminder>[0];
    const withSheets = buildGmFormatReminder({ ...base, ruleset: fiveE, rulesetSheetBlocks: blocks });
    assert.match(withSheets, /CHARACTER SHEETS:/);
    assert.match(withSheets, /\[sheet: who="Name" op="spend" pool="Pool" amount="N"\]/);
    assert.match(withSheets, /rests: Short rest, Long rest\./);
    assert.match(withSheets, /Tracks: .*Exhaustion \(0 to 6\)/);
    assert.match(withSheets, /3rd-level slots 0\/2/);
    assert.match(withSheets, /<character_sheets>\nMira\n[\s\S]*<\/character_sheets>/, "sheets are delimited as data");
    // The `use` line is only for a ruleset that ships catalogs of ROWS: a bestiary writes nothing
    // onto a sheet, so nothing there carries a price the Engine could pay and the line would
    // describe a command that always refuses. This example ships one of each, so the line is there.
    assert.deepEqual(
      fiveE.catalogs?.map((catalog) => catalog.holds),
      ["creatures", "rows"],
    );
    assert.match(withSheets, /op="use"/, "a catalog of rows is something a sheet can use");
    const bestiaryOnly = parseRulesetDefinition(
      JSON.parse(
        JSON.stringify({
          ...(fiveE as unknown as Record<string, unknown>),
          catalogs: (fiveE.catalogs ?? []).filter((catalog) => catalog.holds === "creatures"),
        }),
      ),
    );
    assert.ok(bestiaryOnly.ok, "the example without its catalog of rows must still validate");
    assert.doesNotMatch(
      buildGmFormatReminder({
        ...base,
        ruleset: bestiaryOnly.definition,
        rulesetSheetBlocks: renderGameRulesetSheetBlocks(bestiaryOnly.definition, [{ name: "Mira" }], null),
      }),
      /op="use"/,
      "a bestiary on its own is not something a sheet can use",
    );
    const emberParsed = parseRulesetDefinition(
      JSON.parse(
        readFileSync(fileURLToPath(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url)), "utf8"),
      ),
    );
    assert.ok(emberParsed.ok, "the 2d6 example must validate");
    const withCatalogs = buildGmFormatReminder({
      ...base,
      ruleset: emberParsed.definition,
      rulesetSheetBlocks: renderGameRulesetSheetBlocks(emberParsed.definition, [{ name: "Vex" }], null),
    });
    assert.match(
      withCatalogs,
      /\[sheet: who="Name" op="use" name="Name on the sheet"\] - pays what that ability costs\. Add pool="Pool" to pay from a higher pool of the same group\./,
    );
    // No sheets to show (or no ruleset): the section is not rendered at all.
    assert.doesNotMatch(buildGmFormatReminder({ ...base, ruleset: fiveE }), /CHARACTER SHEETS:/);
    assert.doesNotMatch(buildGmFormatReminder(base), /\[sheet:/);
  }

  // ── A card that HOLDS a sheet this version cannot read is left alone ──
  // No sheet at all gets the blank build. An unreadable one has unknown maximums, so commands that
  // name it are refused instead of being measured against a guess.
  {
    const party = sheetCommandCards(fiveE, [
      { name: "Mira", rulesetSheet: wizard },
      { name: "Tam the Bold" },
      { name: "Old Save", rulesetSheet: { v: "two", build: "lost" } },
    ]);
    assert.deepEqual(
      party.map((card) => card.name),
      ["Mira", "Tam the Bold"],
    );
    const refused = applyGameRulesetSheetTurn(
      { definition: fiveE, cards: party, playerName: null },
      '[sheet: who="Old Save" op="damage" pool="hp" amount="3"]',
      null,
    );
    assert.match(refused.content, /result="refused" reason="unknown-character"/);
    assert.deepEqual(refused.live, {});
  }

  // ── One turn, one ruleset: the resolution the prompt used is the one commands are checked with ──
  {
    const handedIn = await loadGameRulesetSheetContext(db, chatId, {
      status: "unavailable",
      reason: "missing",
      ref: null,
      installedVersion: null,
    });
    assert.equal(handedIn, null, "a turn that rendered no ruleset applies no commands, whatever is installed now");
  }

  // ── A pin the install cannot honour applies nothing and loses nothing ──
  {
    await chats.patchMetadata(chatId, {
      gameRuleset: { id: "5e-2014", version: fiveE.version, packageId: "someone-else", options: {} },
    });
    assert.equal(await loadGameRulesetSheetContext(db, chatId), null);
    await chats.patchMetadata(chatId, { gameRuleset: null });
    assert.equal(await loadGameRulesetSheetContext(db, chatId), null, "no pin: the Engine's own rules");
  }

  console.info("game ruleset live storage regressions passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
