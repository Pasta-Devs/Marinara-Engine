/** Shared party sheets (Capability API 1.144): isolated values, commands and reply history. */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  RULESET_PARTY_KEY,
  applySheetCommandTags,
  defaultRulesetSheetBuild,
  normalizeCharacterLookupName,
  parseRulesetDefinition,
  parseSheetCommandTagBody,
  readRulesetLive,
  readRulesetPartySheet,
  rulesetPartyDefinition,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

mkdirSync(".tmp", { recursive: true });
const dataDir = mkdtempSync(join(process.cwd(), ".tmp/party-sheet-"));
const previous = { DATA_DIR: process.env.DATA_DIR, FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR };
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const source = readFileSync(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8");
const document = () => {
  const doc = JSON.parse(source);
  doc.party = {
    label: "Crew",
    fields: [
      { id: "heat", label: "Heat", type: "number", min: 0, max: 9, default: 0 },
      { id: "vault", label: "Vault", type: "number", min: 1, max: 20, default: 8 },
      { id: "upgrades", label: "Upgrades", type: "text", maxLength: 40 },
      { id: "locked", label: "Locked", type: "boolean" },
    ],
    pools: [{ id: "coin", label: "Coin", max: { field: "vault" } }],
    advancement: { fields: ["heat", "vault", "upgrades"], text: "Record heat after each score." },
    text: "Coin belongs to the crew.",
  };
  doc.sheet.fields.push({ id: "heat", label: "Heat", type: "number", min: 0, max: 9, default: 0 });
  doc.sheet.advancement = { fields: ["heat"] };
  return doc;
};
const parse = (raw: unknown): RulesetDefinition => {
  const parsed = parseRulesetDefinition(raw);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  return parsed.definition;
};
const definition = parse(document());
assert.equal(definition.party!.summary, undefined, "an omitted party summary retains the all-fields fallback");
assert.deepEqual(
  parse({ ...document(), party: { ...document().party, summary: {} } }).party!.summary,
  { fields: [], derived: [], lists: [] },
  "an explicit empty summary still hides all fields",
);
const party = rulesetPartyDefinition(definition)!;
const partyBuild = defaultRulesetSheetBuild(party);
const build = defaultRulesetSheetBuild(definition);
const context = {
  definition,
  cards: [
    { name: "Kit", build },
    { name: "$party", build },
  ],
  playerName: "Kit",
  live: {},
};
const tag = (body: string) => `[sheet: sheet="party" ${body}]`;

try {
  for (const value of [
    {},
    { label: "Crew" },
    { label: "Crew", fields: [], pools: [] },
    { ...document().party, typo: true },
    { ...document().party, label: "[sheet: bad]" },
    { ...document().party, text: "x".repeat(401) },
    { ...document().party, advancement: { fields: ["missing"] } },
    { ...document().party, advancement: { fields: ["locked"] } },
    { ...document().party, advancement: { fields: ["heat", "heat"] } },
    { ...document().party, advancement: { abilities: true } },
    { ...document().party, summary: { fields: ["missing"] } },
    { ...document().party, summary: { derived: ["grit_max"] } },
    { ...document().party, pools: [{ id: "heat", label: "Duplicate", max: { const: 1 } }] },
    { ...document().party, fields: [...document().party.fields, document().party.fields[0]] },
    { ...document().party, pools: [{ id: "coin", label: "Coin", max: { field: "toughness" } }] },
    { ...document().party, pools: [{ id: "coin", label: "Coin", max: { field: "upgrades" } }] },
    { ...document().party, pools: [{ id: "coin", label: "Coin", max: { derived: "grit_max" } }] },
    { ...document().party, fields: [{ id: "bad", label: "Bad", type: "number", min: 4, max: 1 }] },
    { ...document().party, fields: [{ id: "bad", label: "Bad", type: "text", maxLength: 1, default: "long" }] },
  ])
    assert.equal(parseRulesetDefinition({ ...document(), party: value }).ok, false, JSON.stringify(value));
  const crossRead = document();
  crossRead.sheet.live.pools[0].max = { field: "vault" };
  assert.equal(parseRulesetDefinition(crossRead).ok, false, "characters cannot read party fields");
  parse({
    ...document(),
    party: { label: "Ship", fields: [{ id: "name", label: "Name", type: "text", maxLength: 40 }] },
  });
  parse({
    ...document(),
    party: { label: "Story Points", pools: [{ id: "story", label: "Story", max: { const: 5 } }] },
  });
  assert.notEqual(normalizeCharacterLookupName("$party"), RULESET_PARTY_KEY);
  const commands = [
    tag('op="spend" pool="coin" amount="2" result="forged"'),
    tag('op="restore" pool="coin" amount="1"'),
    tag('op="advance" field="heat" by="2"'),
    tag('op="advance" field="upgrades" to="Hidden vault"'),
    '[sheet: who="party" op="advance" field="heat" by="1"]',
  ].join(" ");
  const applied = applySheetCommandTags(commands, context);
  assert.ok(
    applied.outcomes.every((outcome) => outcome.ok),
    applied.content,
  );
  assert.equal(applied.builds[RULESET_PARTY_KEY]?.fields.heat, 2);
  assert.equal(applied.builds[RULESET_PARTY_KEY]?.fields.upgrades, "Hidden vault");
  assert.equal(applied.builds.kit?.fields.heat, 1);
  assert.equal(applied.builds.party?.fields.heat, 1);
  assert.equal(readRulesetLive(party, partyBuild, applied.live[RULESET_PARTY_KEY]).pools[0]?.value, 7);
  assert.equal(partyBuild.fields.heat, 0);
  assert.doesNotMatch(applied.content, /forged/);
  assert.match(applied.content, /sheet="party" op="spend"/);
  assert.equal(parseSheetCommandTagBody('sheet="party" op="spend" pool="coin" amount="2"').sheet, "party");
  const raised = applySheetCommandTags(
    tag('op="advance" field="vault" by="2"') + tag('op="spend" pool="coin" amount="10"'),
    context,
  );
  assert.ok(
    raised.outcomes.every((outcome) => outcome.ok),
    raised.content,
  );
  for (const body of [
    'op="spend" pool="coin" amount="9"',
    'op="spend" pool="missing" amount="1"',
    'op="restore" pool="coin" amount="-1"',
    'op="advance" field="heat" by="10"',
    'op="advance" field="locked" to="true"',
    'op="advance" field="missing" by="1"',
    'op="advance" field="upgrades" to="' + "x".repeat(41) + '"',
    'op="advance" ability="brawn" by="1"',
    'op="rest" rest="camp"',
    'op="spend" pool="coin" amount="1" who="party"',
    'op="missing"',
  ]) {
    const result = applySheetCommandTags(tag(body), context);
    assert.equal(result.outcomes[0]?.ok, false, result.content);
    assert.match(result.content, /result="refused"/);
    assert.deepEqual(result.builds, {});
    assert.deepEqual(result.live, {});
  }
  const legacy = document();
  delete legacy.party;
  assert.equal(
    applySheetCommandTags(tag('op="spend" pool="coin" amount="1"'), { ...context, definition: parse(legacy) })
      .outcomes[0]?.reason,
    "unknown-sheet",
  );
  assert.equal(
    applySheetCommandTags('[sheet: sheet="typo" op="advance" field="heat" by="1"]', context).outcomes[0]?.reason,
    "unknown-sheet",
  );
  const failed = applySheetCommandTags(raised.content, { ...context, advancementRefusal: "save-failed" });
  assert.equal(failed.outcomes[0]?.reason, "save-failed");
  assert.equal(failed.outcomes[1]?.ok, false);
  assert.equal(
    applySheetCommandTags(tag('op="spend" pool="coin" amount="1"'), { ...context, partyBuild: null }).outcomes[0]?.ok,
    false,
  );

  const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  const { createGameStateStorage, parseStoredRulesetLive } =
    await import("../../packages/server/src/services/storage/game-state.storage.js");
  const { resolveVisibleGameStateAnchor } =
    await import("../../packages/server/src/routes/generate/generate-route-utils.js");
  const {
    applyGameRulesetSheetTurn,
    loadGameRulesetSheetContext,
    saveGameRulesetAdvancement,
    rulesetAdvancementTurnStart,
    renderGameRulesetSheetBlocks,
  } = await import("../../packages/server/src/services/game/ruleset-sheet-turn.service.js");
  const { buildGmFormatReminder } = await import("../../packages/server/src/services/game/gm-prompts.js");
  const { getCapabilityPackageInstallIssue } =
    await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
  const blocks = renderGameRulesetSheetBlocks(definition, [{ name: "Kit" }], applied.live);
  assert.match(blocks.at(-1)!, /Crew\nHeat 0, Vault 8, Locked no\nCoin 7\/8/);
  assert.equal(renderGameRulesetSheetBlocks(definition, [], {}, {}, undefined, { broken: true }).length, 0);
  const prompt = buildGmFormatReminder({
    turnNumber: 2,
    gameActiveState: "exploration",
    partyNames: ["Kit"],
    playerName: "Kit",
    ruleset: definition,
    rulesetSheetBlocks: blocks,
  });
  assert.match(prompt, /sheet="party" op="advance"/);
  assert.match(prompt, /Coin belongs to the crew/);
  assert.match(prompt, /who="party" still means every character/);
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "party-sheet",
    name: "Party sheet",
    version: "0.1.0",
    description: "Shared sheet",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  assert.match(getCapabilityPackageInstallIssue(manifest(143) as never, document()) ?? "", /capabilityApi 1\.144/);
  assert.equal(getCapabilityPackageInstallIssue(manifest(144) as never, document()), null);

  const db = await getDB();
  try {
    const chats = createChatsStorage(db);
    const states = createGameStateStorage(db);
    const chat = await chats.create({ name: "Crew", mode: "game", characterIds: [] } as never);
    assert.ok(chat);
    const ref = { id: definition.id, version: definition.version, packageId: null, options: {} };
    const resolved = {
      status: "ok" as const,
      ref,
      definition,
      baseDefinition: definition,
      layers: [],
      packageId: null,
    };
    await chats.patchMetadata(chat.id, {
      gameRuleset: ref,
      gameCharacterCards: [{ name: "Kit" }, { name: "$party" }],
      unrelated: "kept",
    });
    const metadata = async () => JSON.parse((await chats.getById(chat.id))!.metadata!);
    const heat = async () =>
      readRulesetPartySheet(definition, (await metadata()).gamePartySheet)!.build.fields.heat ?? 0;
    const visible = async () =>
      states.getForGeneration(chat.id, {
        preferLatestVisible: true,
        visibleAnchor: resolveVisibleGameStateAnchor(await chats.listMessages(chat.id)),
      });
    const coin = async () =>
      readRulesetLive(party, partyBuild, parseStoredRulesetLive((await visible())?.rulesetLive)?.[RULESET_PARTY_KEY])
        .pools[0]!.value;
    const first = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Before the score" });
    const base = await states.updateByMessage(first.id, 0, chat.id, { rulesetLive: {} }, undefined, {
      baseSnapshot: null,
    });
    assert.ok(base);
    await states.commit(base.id, chat.id);
    const loaded = await loadGameRulesetSheetContext(db, chat.id, resolved);
    assert.ok(loaded);
    const turn = applyGameRulesetSheetTurn(loaded, commands, {});
    const reply = await chats.createMessage({ chatId: chat.id, role: "assistant", content: turn.content });
    await saveGameRulesetAdvancement(db, chat.id, reply.id, 0, definition, turn);
    await states.updateByMessage(reply.id, 0, chat.id, { rulesetLive: turn.live }, undefined, { baseSnapshot: base });
    assert.equal(await heat(), 2);
    assert.equal(await coin(), 7);
    assert.equal((await metadata()).gameCharacterCards.length, 2, "no fake character is persisted");
    const before = await rulesetAdvancementTurnStart(db, chat.id, await metadata(), reply.id);
    assert.equal(readRulesetPartySheet(definition, before.gamePartySheet)!.build.fields.heat, 0);
    assert.equal(await heat(), 2, "reading a regenerated turn makes no writes");
    const start = await states.getForGeneration(chat.id, {
      excludeMessageId: reply.id,
      fallbackMessageIds: [first.id],
    });
    const regen = await loadGameRulesetSheetContext(db, chat.id, resolved, reply.id);
    assert.ok(regen);
    const alternate = applyGameRulesetSheetTurn(
      regen,
      tag('op="advance" field="heat" by="1"') + tag('op="spend" pool="coin" amount="4"'),
      parseStoredRulesetLive(start?.rulesetLive),
    );
    const swipe = await chats.addSwipe(reply.id, alternate.content);
    assert.equal(await heat(), 0);
    await saveGameRulesetAdvancement(db, chat.id, reply.id, swipe.index, definition, alternate);
    await states.updateByMessage(reply.id, swipe.index, chat.id, { rulesetLive: alternate.live }, undefined, {
      baseSnapshot: start,
    });
    assert.equal(await heat(), 1);
    assert.equal(await coin(), 4);
    await chats.setActiveSwipe(reply.id, 0);
    assert.equal(await heat(), 2);
    assert.equal(await coin(), 7);
    await chats.setActiveSwipe(reply.id, swipe.index);
    assert.equal(await heat(), 1);
    assert.equal(await coin(), 4);
    await chats.removeSwipe(reply.id, swipe.index);
    assert.equal(await heat(), 2);
    assert.equal(await coin(), 7);
    await chats.removeMessage(reply.id);
    assert.equal(await heat(), 0);
    assert.equal(await coin(), 8);
    assert.equal((await metadata()).unrelated, "kept");

    // A later snapshot retains the shared build, and a later edit survives undo.
    const next = await chats.createMessage({ chatId: chat.id, role: "assistant", content: turn.content });
    await saveGameRulesetAdvancement(db, chat.id, next.id, 0, definition, turn);
    const laterContext = await loadGameRulesetSheetContext(db, chat.id, resolved);
    assert.ok(laterContext);
    const later = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Next scene" });
    await saveGameRulesetAdvancement(
      db,
      chat.id,
      later.id,
      0,
      definition,
      applyGameRulesetSheetTurn(laterContext, "Next scene", turn.live),
    );
    await chats.removeMessage(next.id);
    assert.equal(await heat(), 2);
    const edited = (await metadata()).gamePartySheet;
    edited.build.fields.upgrades = "Player edit";
    await chats.patchMetadata(chat.id, { gamePartySheet: edited });
    await chats.removeMessage(later.id);
    assert.equal(await heat(), 0);
    assert.equal((await metadata()).gamePartySheet.build.fields.upgrades, "Player edit");
  } finally {
    await closeDB();
  }
  console.log(
    "Party sheets: schema, commands, isolation, prompts, gate and stored regeneration/swipe/delete lifecycle passed.",
  );
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
