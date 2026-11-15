/** Capability API 1.163: the party's shared sheet set up once through its own guided builder and
 *  lists, saved on the revision it was opened at, with fields read off the party's characters. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  parseRulesetDefinition,
  readRulesetBuilderState,
  readRulesetPartySheet,
  rulesetBuilderSpendAction,
  rulesetBuilderSpending,
  rulesetPartyDefinition,
  type RulesetDefinition,
  type RulesetSheetEnvelope,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-party-creation-"));
const previousEnv = { DATA_DIR: process.env.DATA_DIR, FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR };
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createGameRulesetsStorage } =
  await import("../../../packages/server/src/services/storage/game-rulesets.storage.js");
const { gameRulesetsRoutes } = await import("../../../packages/server/src/routes/game-rulesets.routes.js");
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { loadGameRulesetSheetContext, renderGameRulesetSheetBlocks } =
  await import("../../../packages/server/src/services/game/ruleset-sheet-turn.service.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(gameRulesetsRoutes, { prefix: "/api/game-rulesets" });

const gravewatchText = readFileSync(new URL("../../../docs/examples/rulesets/gravewatch.json", import.meta.url), "utf8");
const fixture = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(gravewatchText) as Record<string, any>;
  doc.party = {
    label: "The Watch-house",
    fields: [
      { id: "tier", label: "Tier", type: "number", min: 0, max: 4, default: 0 },
      { id: "rep", label: "Reputation", type: "number", min: 0, max: 6, default: 0 },
      { id: "size", label: "Wardens", type: "number", min: 0, max: 12, default: 0 },
      { id: "light", label: "Lantern oil", type: "number", min: 0, max: 99, default: 0 },
    ],
    lists: [
      {
        id: "upgrades",
        label: "Upgrades",
        maxItems: 8,
        columns: [
          { id: "name", label: "Name", type: "text", maxLength: 60 },
          { id: "cost", label: "Cost", type: "number", min: 0, max: 4, default: 1 },
        ],
      },
    ],
    builder: {
      pools: [{ id: "favor", label: "Favor", budget: { const: 4 } }],
      steps: [
        { id: "tier", label: "Tier", kind: "fields", fields: ["tier"] },
        { id: "kind", label: "Kind of house", kind: "catalog", catalog: "house_kinds", min: 0, max: 1 },
        { id: "upgrades", label: "Upgrades", kind: "rows", list: "upgrades", pool: "favor", cost: { column: "cost" } },
        {
          id: "buy",
          label: "Standing",
          kind: "spend",
          pool: "favor",
          offers: [{ id: "rep", label: "Reputation", target: { field: "rep" }, min: 0, max: 6, cost: { flat: 1 } }],
        },
      ],
    },
    fromMembers: [
      { field: "size", count: true },
      { field: "light", sum: "lantern" },
    ],
    summary: { fields: ["tier", "rep", "size"], derived: [], lists: [{ list: "upgrades", nameColumn: "name" }] },
  };
  // A catalog only the party's setup reads writes the party's own rows and fields.
  doc.catalogs.push({
    id: "house_kinds",
    label: "Kinds of watch-house",
    feeds: ["upgrades"],
    entries: [
      {
        id: "chapel",
        label: "Chapel watch",
        rows: [{ list: "upgrades", values: { name: "Bell tower", cost: 0 } }],
        grants: { sets: { rep: 1 } },
      },
    ],
  });
  edit(doc);
  return doc;
};
const parse = (doc: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const issuesOf = (doc: unknown) => {
  const result = parseRulesetDefinition(doc);
  return result.ok ? "" : result.issues.join("; ");
};

try {
  const definition = parse(fixture());
  const party = rulesetPartyDefinition(definition)!;
  assert.ok(party.sheet.builder, "the shared sheet carries its own builder");
  assert.deepEqual(
    party.sheet.lists.map((list) => list.id),
    ["upgrades"],
  );

  // ── One shared choice, made through the party's own builder ──
  let envelope = readRulesetPartySheet(definition, null)!;
  let state = readRulesetBuilderState(envelope);
  let build = envelope.build;
  build = { ...build, fields: { ...build.fields, tier: 1 }, lists: { upgrades: [{ name: "Iron gate", cost: 2 }] } };
  ({ build, state } = applyRulesetBuilder(party, build, state, {}));
  state = rulesetBuilderSpendAction(party, build, state, {}, "buy", "rep", "buy");
  ({ build, state } = applyRulesetBuilder(party, build, state, {}));
  assert.equal(build.fields.rep, 1);
  assert.equal(rulesetBuilderSpending(party, build, state, {})[0]!.remaining, 1);
  // The party's own catalog writes the party's rows and fields.
  const partyCatalogs = Object.fromEntries(
    (party.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
  );
  assert.deepEqual(Object.keys(partyCatalogs), ["house_kinds"], "the party copy keeps only its own catalogs");
  {
    let picked = applyRulesetBuilder(party, build, { ...state, picks: { kind: ["chapel"] } }, partyCatalogs);
    assert.ok((picked.build.lists.upgrades ?? []).some((row) => row.name === "Bell tower"));
    picked = applyRulesetBuilder(party, picked.build, { ...picked.state, picks: { kind: [] } }, partyCatalogs);
    assert.ok(!(picked.build.lists.upgrades ?? []).some((row) => row.name === "Bell tower"));
  }
  envelope = { ...envelope, build, builder: state } as RulesetSheetEnvelope;

  // ── Saved on a revision ──
  const chats = createChatsStorage(db);
  await createGameRulesetsStorage(db).put({
    rulesetId: "local/gravewatch-party",
    version: 1,
    sourceKind: "local",
    definition: JSON.stringify({ ...fixture(), id: "gravewatch-party" }),
  });
  const chat = await chats.create({ name: "Watch", mode: "game", characterIds: [] });
  const lanternSheet = (lantern: number) => ({ v: 1, build: { fields: { lantern } } });
  await chats.patchMetadata(chat.id, {
    gameRuleset: { id: "local/gravewatch-party", version: 1, packageId: null, options: {} },
    gameCharacterCards: [
      { name: "Ada", rulesetSheet: lanternSheet(3) },
      { name: "Bram", rulesetSheet: lanternSheet(4) },
      { name: "Cole" },
    ],
  });
  const post = (sheet: unknown, revision: number) =>
    app.inject({
      method: "POST",
      url: "/api/game-rulesets/party-sheet",
      payload: { chatId: chat.id, sheet, revision },
    });
  const stored = async () => JSON.parse(String((await chats.getById(chat.id))!.metadata)) as Record<string, any>;

  const first = await post(envelope, 0);
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(first.json().revision, 1);
  let meta = await stored();
  assert.equal(meta.gamePartySheetRevision, 1);
  assert.equal(meta.gamePartySheet.build.fields.rep, 1);
  assert.deepEqual(meta.gamePartySheet.builder.spending.buy.rep.length, 1, "the builder's choices are saved too");
  // Read off the three characters: a card with no sheet yet counts, with a blank one.
  assert.equal(meta.gamePartySheet.build.fields.size, 3);
  assert.equal(meta.gamePartySheet.build.fields.light, 10, "Cole's blank sheet starts at 3");

  // Two players open the same revision; the second save is refused and nothing of the first is lost.
  const mine = { ...envelope, build: { ...envelope.build, fields: { ...envelope.build.fields, tier: 2 } } };
  const theirs = { ...envelope, build: { ...envelope.build, fields: { ...envelope.build.fields, tier: 3 } } };
  assert.equal((await post(theirs, 1)).statusCode, 200);
  const stale = await post(mine, 1);
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().reason, "stale");
  assert.equal(stale.json().revision, 2);
  assert.equal(stale.json().sheet.build.fields.tier, 3, "the refused player sees what was saved");
  meta = await stored();
  assert.equal(meta.gamePartySheet.build.fields.tier, 3);
  // Saving again on the revision now shown is the player's choice to replace it.
  const again = await post(mine, 2);
  assert.equal(again.statusCode, 200);
  assert.equal((await stored()).gamePartySheet.build.fields.tier, 2);

  // What is not a party sheet is refused.
  assert.equal((await post({ v: 1, build: "nope" }, 3)).statusCode, 400);
  assert.equal((await post(envelope, 99)).statusCode, 409);

  // ── Read off the party as it stands ──
  // A character leaving, or gaining oil, changes the shared sheet without anybody saving it.
  await chats.patchMetadata(chat.id, {
    gameCharacterCards: [
      { name: "Ada", rulesetSheet: lanternSheet(5) },
      { name: "Bram", rulesetSheet: lanternSheet(4) },
    ],
  });
  const context = (await loadGameRulesetSheetContext(db, chat.id))!;
  assert.equal(context.partyBuild!.fields.size, 2);
  assert.equal(context.partyBuild!.fields.light, 9);
  meta = await stored();
  const blocks = renderGameRulesetSheetBlocks(
    context.definition,
    meta.gameCharacterCards,
    undefined,
    undefined,
    undefined,
    meta.gamePartySheet,
  );
  const partyBlock = blocks.find((block: string) => block.includes("The Watch-house"))!;
  assert.match(partyBlock, /Wardens[^\n]*2/);
  assert.match(partyBlock, /Iron gate/);
  // The stored values stay as saved until the next save.
  assert.equal(meta.gamePartySheet.build.fields.size, 3);
  const members = [{ fields: { lantern: 1 } }].map((each) => ({ ...context.cards[0]!.build, ...each }));
  assert.equal(readRulesetPartySheet(definition, meta.gamePartySheet, members)!.build.fields.size, 1);

  // ── The schema ──
  assert.match(
    issuesOf(fixture((doc) => (doc.party.fromMembers = [{ field: "nowhere", count: true }]))),
    /No number party field "nowhere"/,
  );
  assert.match(
    issuesOf(fixture((doc) => (doc.party.fromMembers = [{ field: "size", count: true, sum: "lantern" }]))),
    /count or sum, not both/,
  );
  assert.match(
    issuesOf(fixture((doc) => (doc.party.fromMembers = [{ field: "size", sum: "post" }]))),
    /No number field "post" on a character's sheet/,
  );
  assert.match(issuesOf(fixture((doc) => (doc.party.builder.steps[1].list = "nowhere"))), /party\.builder\.steps\.1/);
  assert.match(issuesOf(fixture((doc) => (doc.party.lists[0].id = "tier"))), /Duplicate party id "tier"/);

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "party-creation",
    name: "Party creation",
    version: "1.0.0",
    description: "Party creation proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(162, fixture()) ?? "", /1\.163/);
  assert.equal(gate(163, fixture()), null);
  const membersOnly = fixture((doc) => {
    delete doc.party.builder;
    delete doc.party.lists;
    doc.party.summary.lists = [];
  });
  assert.match(gate(162, membersOnly) ?? "", /1\.163/, "fields read off the party count");

  console.log("game-ruleset-party-creation: passed");
} finally {
  await app.close();
  await closeDB();
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
