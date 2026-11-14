/** Permanent sheet advancement (Capability API 1.142): permissions, arithmetic and saved swipes. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetSheetOp,
  applySheetCommandTags,
  createRulesetSheetEnvelope,
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  parseRulesetDefinition,
  parseSheetCommandTagBody,
  readResolvedSheetCommandTags,
  type RulesetDefinition,
  type RulesetSheetOp,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-advancement-"));
const previous = { DATA_DIR: process.env.DATA_DIR, FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR };
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const source = readFileSync(new URL("../../../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8");
const document = () => {
  const doc = JSON.parse(source);
  doc.sheet.fields.push(
    { id: "xp", label: "Experience", type: "number", min: 0, max: 10000 },
    { id: "humanity", label: "Humanity", type: "number", min: 0, max: 10, default: 7 },
    { id: "ratio", label: "Ratio", type: "number", min: -2, max: 2, integer: false },
    { id: "history", label: "History", type: "longtext", maxLength: 2000 },
    { id: "flag", label: "Flag", type: "boolean" },
  );
  doc.sheet.saves = [{ id: "will", label: "Willpower", ability: "heart" }];
  doc.sheet.advancement = {
    fields: ["xp", "humanity", "ratio", "calling", "history", "toughness"],
    abilities: true,
    skills: true,
    saves: true,
    text: "Award XP at the end of a session.",
  };
  return doc;
};
const parsed = (doc: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const definition = parsed(document());
const build = defaultRulesetSheetBuild(definition);
const context = { definition, cards: [{ name: "Kit", build }], playerName: "Kit", live: {} };
const refused = (op: RulesetSheetOp, reason: RegExp, ruleset = definition) => {
  const result = applyRulesetSheetOp(ruleset, build, {}, op);
  assert.equal(result.ok, false, JSON.stringify(op));
  if (!result.ok) assert.match(result.reason, reason);
};

try {
  // Strict permissions and cross-references. Guidance alone grants nothing.
  for (const advancement of [
    {},
    { text: "Whenever" },
    { fields: [], abilities: false },
    { fields: ["missing"] },
    { fields: ["flag"] },
    { abilities: true, unknown: true },
    { abilities: true, text: "x".repeat(401) },
    { fields: Array(65).fill("xp") },
  ]) {
    const doc = document();
    doc.sheet.advancement = advancement;
    assert.equal(parseRulesetDefinition(doc).ok, false, JSON.stringify(advancement));
  }
  const legacy = document();
  delete legacy.sheet.advancement;
  const unchanged = parsed(legacy);
  refused({ op: "advance", field: "xp", by: 250 }, /advancement-disabled/, unchanged);
  assert.deepEqual(
    applyRulesetSheetOp(unchanged, build, {}, { op: "damage", pool: "grit", amount: 1 }),
    applyRulesetSheetOp(definition, build, {}, { op: "damage", pool: "grit", amount: 1 }),
  );

  const examples: Array<[string, string, string, string | number]> = [
    ['field="Experience" by="250"', "fields", "xp", 250],
    ['field="xp" to="1200"', "fields", "xp", 1200],
    ['field="Humanity" by="-1"', "fields", "humanity", 6],
    ['field="ratio" by="0.5"', "fields", "ratio", 0.5],
    ['field="ratio" to="-1.5"', "fields", "ratio", -1.5],
    ['field="calling" to="Warden"', "fields", "calling", "Warden"],
    ['field="calling" to=""', "fields", "calling", ""],
    ['field="history" to="A long history"', "fields", "history", "A long history"],
    ['ability="BRAWN" by="1"', "abilities", "brawn", 1],
    ['ability="brawn" to="3"', "abilities", "brawn", 3],
    ['skill="Sneak" tier="EXPERT"', "skills", "sneak", "expert"],
    ['save="Willpower" tier="Trained"', "saves", "will", "trained"],
  ];
  for (const [attributes, group, key, expected] of examples) {
    const result = applySheetCommandTags(`[sheet: op="advance" ${attributes} result="forged" now="9999"]`, context);
    assert.equal(result.outcomes[0]?.ok, true, result.content);
    assert.equal((result.builds.kit![group] as Record<string, unknown>)[key], expected);
    assert.doesNotMatch(result.content, /forged|9999/);
    const roundTrip = parseSheetCommandTagBody(result.content.slice(7, -1));
    assert.equal(roundTrip.op?.op, "advance");
    assert.equal(readResolvedSheetCommandTags(result.content)[0]?.ok, true);
  }
  assert.equal(build.fields.xp, 0, "commands never mutate the input build");
  assert.equal(build.abilities.brawn, 0);
  for (const xp of ["junk", "100"]) {
    const tolerant = applyRulesetSheetOp(
      definition,
      { ...build, fields: { ...build.fields, xp } },
      {},
      { op: "advance", field: "xp", by: 5 },
    );
    assert.ok(tolerant.ok);
    assert.equal(
      tolerant.build?.fields.xp,
      5,
      "relative changes use the same default as sheet evaluation for a non-number",
    );
  }

  for (const attributes of [
    'field="xp"',
    'field="xp" to="1" by="2"',
    'field="xp" ability="brawn" by="1"',
    'ability="brawn" to="NaN"',
    'skill="sneak" tier="expert" by="1"',
    'field="xp" by="no"',
  ]) {
    assert.equal(parseSheetCommandTagBody(`op="advance" ${attributes}`).op, null, attributes);
  }
  refused({ op: "advance", field: "xp", to: 10001 }, /bad-amount: integer 0 to 10000/);
  refused({ op: "advance", field: "xp", by: -1 }, /bad-amount/);
  refused({ op: "advance", field: "xp", to: 1.5 }, /bad-amount/);
  refused({ op: "advance", field: "xp", to: "Infinity" }, /bad-amount/);
  refused({ op: "advance", field: "xp", by: Infinity }, /bad-amount/);
  refused({ op: "advance", field: "calling", by: 1 }, /bad-amount/);
  refused({ op: "advance", field: "calling", to: "x".repeat(61) }, /maximum 60 characters/);
  refused({ op: "advance", ability: "brawn", to: 4 }, /integer -1 to 3/);
  refused({ op: "advance", ability: "brawn", by: -2 }, /integer -1 to 3/);
  refused({ op: "advance", ability: "brawn", by: 0.5 }, /bad-amount/);
  refused({ op: "advance", field: "absent", by: 1 }, /unknown-field/);
  refused({ op: "advance", field: "flag", to: "true" }, /not-allowed/);
  refused({ op: "advance", ability: "absent", by: 1 }, /unknown-ability/);
  refused({ op: "advance", skill: "absent", tier: "expert" }, /unknown-skill/);
  refused({ op: "advance", save: "absent", tier: "expert" }, /unknown-save/);
  refused({ op: "advance", skill: "sneak", tier: "absent" }, /unknown-tier/);
  refused({ op: "advance", save: "will", tier: "absent" }, /unknown-tier/);
  const restricted = document();
  restricted.sheet.advancement = { fields: ["xp"] };
  for (const op of [
    { op: "advance", field: "humanity", by: 1 },
    { op: "advance", ability: "brawn", by: 1 },
    { op: "advance", skill: "sneak", tier: "expert" },
    { op: "advance", save: "will", tier: "expert" },
  ] as RulesetSheetOp[]) {
    refused(op, /not-allowed/, parsed(restricted));
  }
  const failedTag = applySheetCommandTags('[sheet: op="advance" ability="brawn" to="4"]', context);
  assert.match(failedTag.content, /result="refused" reason="bad-amount: integer -1 to 3"/);
  assert.deepEqual(failedTag.builds, {});

  const party = applySheetCommandTags(
    '[sheet: op="advance" field="xp" by="250" who="party"] [sheet: op="advance" field="xp" by="50"]',
    { ...context, cards: [...context.cards, { name: "Tam", build }] },
  );
  assert.equal(party.builds.kit?.fields.xp, 300);
  assert.equal(party.builds.tam?.fields.xp, 250);
  assert.match(party.content, /Kit 250; Tam 250/);
  const partial = applySheetCommandTags('[sheet: op="advance" field="xp" by="250" who="party"]', {
    ...context,
    cards: [...context.cards, { name: "Tam", build: { ...build, fields: { ...build.fields, xp: 10000 } } }],
  });
  assert.match(partial.content, /Tam refused \(bad-amount/);
  assert.equal(partial.builds.tam, undefined);
  const raised = applySheetCommandTags(
    '[sheet: op="advance" field="toughness" by="1"] [sheet: op="spend" pool="grit" amount="7"]',
    context,
  );
  assert.equal(evaluateRulesetSheet(definition, raised.builds.kit!).derived.grit_max, 7);
  assert.equal(raised.outcomes[1]?.ok, true, "later commands use the new build's derived maximum");
  const failedSave = applySheetCommandTags(raised.content, { ...context, advancementRefusal: "save-failed" });
  assert.match(failedSave.content, /reason="save-failed"/);
  assert.equal(failedSave.outcomes[1]?.ok, false, "a failed build write cannot lend a larger live maximum");
  assert.deepEqual(failedSave.builds, {});

  const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
  const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
  const {
    applyGameRulesetSheetTurn,
    loadGameRulesetSheetContext,
    saveGameRulesetAdvancement,
    rulesetAdvancementTurnStart,
  } = await import("../../../packages/server/src/services/game/ruleset-sheet-turn.service.js");
  const { buildGmFormatReminder } = await import("../../../packages/server/src/services/game/gm-prompts.js");
  const { getCapabilityPackageInstallIssue } =
    await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");
  const reminderContext = {
    turnNumber: 2,
    gameActiveState: "exploration" as const,
    partyNames: ["Kit"],
    playerName: "Kit",
    rulesetSheetBlocks: ["Kit: XP 0"],
  };
  const reminder = buildGmFormatReminder({ ...reminderContext, ruleset: definition });
  for (const text of [
    'op="advance"',
    'ability="Ability"',
    'skill="Skill"',
    'save="Save"',
    "Experience",
    "Expert (expert)",
    definition.sheet.advancement!.text!,
  ])
    assert.ok(reminder.includes(text), text);
  assert.doesNotMatch(
    buildGmFormatReminder({ ...reminderContext, ruleset: unchanged }),
    /op="advance"|Permanent advancement/,
  );
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "ruleset-advancement",
    name: "Advancement",
    version: "0.1.0",
    description: "A ruleset with permanent advancement.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  assert.match(getCapabilityPackageInstallIssue(manifest(141) as never, document()) ?? "", /capabilityApi 1\.142/);
  assert.equal(getCapabilityPackageInstallIssue(manifest(142) as never, document()), null);

  const db = await getDB();
  try {
    const chats = createChatsStorage(db);
    const chat = await chats.create({ name: "Advancement", mode: "game", characterIds: [] } as never);
    assert.ok(chat);
    const envelope = { ...createRulesetSheetEnvelope(definition), v: definition.sheet.version + 1, future: "kept" };
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
      unrelated: "kept",
      gameCharacterCards: [{ name: "Kit", description: "Kept", rulesetSheet: envelope }, { name: "Tam" }],
    });
    const metadata = async () => JSON.parse((await chats.getById(chat.id))!.metadata!);
    const xp = async () =>
      (await metadata()).gameCharacterCards.map((card: any) => card.rulesetSheet?.build.fields.xp ?? 0);
    const initial = await loadGameRulesetSheetContext(db, chat.id, resolved);
    assert.ok(initial);
    const turn = applyGameRulesetSheetTurn(initial, '[sheet: op="advance" field="xp" by="250" who="party"]', {});
    const message = await chats.createMessage({ chatId: chat.id, role: "assistant", content: turn.content });
    await saveGameRulesetAdvancement(db, chat.id, message.id, 0, definition, turn);
    assert.deepEqual(await xp(), [250, 250]);
    assert.equal((await metadata()).gameCharacterCards[0].rulesetSheet.v, envelope.v);
    assert.equal((await metadata()).gameCharacterCards[0].rulesetSheet.future, "kept");
    assert.equal((await metadata()).gameCharacterCards[0].description, "Kept");
    assert.equal((await metadata()).unrelated, "kept");
    const rewound = await rulesetAdvancementTurnStart(db, chat.id, await metadata(), message.id);
    assert.equal((rewound.gameCharacterCards as any[])[0].rulesetSheet.build.fields.xp, 0);
    assert.deepEqual(await xp(), [250, 250], "preparing a regenerated turn makes no writes");
    const regenerate = await loadGameRulesetSheetContext(db, chat.id, resolved, message.id);
    assert.ok(regenerate);
    const alternate = applyGameRulesetSheetTurn(
      regenerate,
      '[sheet: op="advance" field="xp" by="100" who="party"]',
      {},
    );
    const swipe = await chats.addSwipe(message.id, alternate.content);
    assert.deepEqual(await xp(), [0, 0], "outgoing swipe is undone before the new build saves");
    await saveGameRulesetAdvancement(db, chat.id, message.id, swipe.index, definition, alternate);
    assert.deepEqual(await xp(), [100, 100], "regeneration awards once, from the prior build");
    await chats.setActiveSwipe(message.id, 0);
    assert.deepEqual(await xp(), [250, 250]);
    await chats.setActiveSwipe(message.id, swipe.index);
    assert.deepEqual(await xp(), [100, 100]);
    await chats.removeSwipe(message.id, swipe.index);
    assert.deepEqual(await xp(), [250, 250], "deleting an active swipe restores the selected one");
    const continuationContext = await loadGameRulesetSheetContext(db, chat.id, resolved);
    assert.ok(continuationContext);
    const continuation = applyGameRulesetSheetTurn(
      continuationContext,
      '[sheet: op="advance" field="xp" by="50" who="party"]',
      {},
    );
    await saveGameRulesetAdvancement(db, chat.id, message.id, 0, definition, continuation);
    assert.deepEqual(await xp(), [300, 300]);
    await chats.removeMessage(message.id);
    assert.deepEqual(await xp(), [0, 0], "deleting a continued reply undoes its whole record");
    assert.equal((await metadata()).gameCharacterCards[1].rulesetSheet, undefined, "a formerly blank card is restored");

    // A player edit after the command survives its deletion.
    const editedMessage = await chats.createMessage({ chatId: chat.id, role: "assistant", content: turn.content });
    await saveGameRulesetAdvancement(db, chat.id, editedMessage.id, 0, definition, turn);
    const edited = await metadata();
    edited.gameCharacterCards[0].rulesetSheet.build.fields.xp = 900;
    await chats.patchMetadata(chat.id, { gameCharacterCards: edited.gameCharacterCards });
    await chats.removeMessage(editedMessage.id);
    assert.deepEqual(await xp(), [900, 0]);

    // Queued player edits and GM saves take locks in the same order, and unrelated values survive.
    const nextContext = await loadGameRulesetSheetContext(db, chat.id, resolved);
    assert.ok(nextContext);
    const nextTurn = applyGameRulesetSheetTurn(nextContext, '[sheet: who="Kit" op="advance" field="xp" by="50"]', {});
    const nextMessage = await chats.createMessage({ chatId: chat.id, role: "assistant", content: nextTurn.content });
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.all([
          chats.patchMetadata(chat.id, async (meta) => {
            await Promise.resolve();
            const cards = structuredClone(meta.gameCharacterCards) as any[];
            cards[0].rulesetSheet.build.fields.calling = "Player edit";
            return { gameCharacterCards: cards };
          }),
          saveGameRulesetAdvancement(db, chat.id, nextMessage.id, 0, definition, nextTurn),
        ]),
        new Promise((_, reject) => {
          deadline = setTimeout(() => reject(new Error("Advancement queues deadlocked")), 5000);
        }),
      ]);
    } finally {
      clearTimeout(deadline);
    }
    assert.deepEqual(await xp(), [950, 0]);
    assert.equal((await metadata()).gameCharacterCards[0].rulesetSheet.build.fields.calling, "Player edit");
    const laterEdit = await metadata();
    laterEdit.gameCharacterCards[0].rulesetSheet.build.fields.history = "Written after the award";
    await chats.patchMetadata(chat.id, { gameCharacterCards: laterEdit.gameCharacterCards });
    const nextRewound = await rulesetAdvancementTurnStart(db, chat.id, await metadata(), nextMessage.id);
    assert.equal((nextRewound.gameCharacterCards as any[])[0].rulesetSheet.build.fields.xp, 900);
    await chats.removeMessage(nextMessage.id);
    assert.deepEqual(await xp(), [900, 0]);
    assert.equal((await metadata()).gameCharacterCards[0].rulesetSheet.build.fields.calling, "Player edit");

    assert.equal((await metadata()).gameCharacterCards[0].rulesetSheet.build.fields.history, "Written after the award");

    const conflict = await chats.createMessage({ chatId: chat.id, role: "assistant", content: nextTurn.content });
    const changed = await metadata();
    changed.gameCharacterCards[0].rulesetSheet.build.fields.xp = 901;
    await chats.patchMetadata(chat.id, { gameCharacterCards: changed.gameCharacterCards });
    await assert.rejects(
      saveGameRulesetAdvancement(db, chat.id, conflict.id, 0, definition, nextTurn),
      /conflicts with an edited/,
    );
    assert.deepEqual(await xp(), [901, 0]);
    assert.equal(JSON.parse((await chats.getMessage(conflict.id))!.extra!).rulesetAdvancement, undefined);

    // A later unchanged snapshot retains earlier awards, exactly like live-state snapshots.
    const historyChat = await chats.create({ name: "Advancement history", mode: "game", characterIds: [] } as never);
    assert.ok(historyChat);
    await chats.patchMetadata(historyChat.id, {
      gameRuleset: ref,
      gameCharacterCards: [{ name: "Kit", rulesetSheet: createRulesetSheetEnvelope(definition) }],
    });
    const historyXp = async () =>
      JSON.parse((await chats.getById(historyChat.id))!.metadata!).gameCharacterCards[0].rulesetSheet.build.fields.xp;
    const saveReply = async (content: string) => {
      const loaded = await loadGameRulesetSheetContext(db, historyChat.id, resolved);
      assert.ok(loaded);
      const applied = applyGameRulesetSheetTurn(loaded, content, {});
      const reply = await chats.createMessage({ chatId: historyChat.id, role: "assistant", content: applied.content });
      await saveGameRulesetAdvancement(db, historyChat.id, reply.id, 0, definition, applied);
      return reply;
    };
    const award = '[sheet: who="Kit" op="advance" field="xp" by="250"]';
    const older = await saveReply(award);
    const newer = await saveReply("The journey continues.");
    await chats.removeMessage(older.id);
    assert.equal(await historyXp(), 250, "the surviving later snapshot retains the award");
    await chats.removeMessage(newer.id);
    assert.equal(await historyXp(), 0, "removing the later snapshot restores the initial build");

    const original = await saveReply(award);
    const later = await saveReply("The next scene.");
    const earlierContext = await loadGameRulesetSheetContext(db, historyChat.id, resolved, original.id);
    assert.ok(earlierContext);
    assert.equal(earlierContext.cards[0]!.build.fields.xp, 0);
    const other = applyGameRulesetSheetTurn(earlierContext, '[sheet: who="Kit" op="advance" field="xp" by="100"]', {});
    const otherSwipe = await chats.addSwipe(original.id, other.content);
    await saveGameRulesetAdvancement(db, historyChat.id, original.id, otherSwipe.index, definition, other);
    assert.equal(await historyXp(), 250, "an older swipe cannot replace the later visible snapshot");
    await chats.removeMessage(later.id);
    assert.equal(await historyXp(), 100, "the selected earlier swipe takes effect once the later reply is removed");
    await chats.removeMessage(original.id);
    assert.equal(await historyXp(), 0);

    const bulkA = await saveReply(award);
    const bulkB = await saveReply(award);
    assert.equal(await historyXp(), 500);
    await chats.removeMessages([bulkA.id, bulkB.id], historyChat.id);
    assert.equal(await historyXp(), 0, "bulk deletion rewinds all selected snapshots");
  } finally {
    await closeDB();
  }
  console.log("Ruleset advancement: schema, operations, prompts, gate and stored swipe lifecycle passed.");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
