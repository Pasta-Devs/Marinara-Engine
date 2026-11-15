/** Party/scene progress clocks (Capability API 1.143): requests, snapshots and restore. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyClockCommandTags,
  parseClockCommandTagBody,
  parseRulesetDefinition,
  rulesetClocksSchema,
  stripClockCommandTags,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-clocks-"));
const previous = { DATA_DIR: process.env.DATA_DIR, FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR };
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const source = readFileSync(new URL("../../../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8");
const document = () => ({ ...JSON.parse(source), clocks: { text: "Tick threats when the fiction advances." } });
const parsed = (doc: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const definition = parsed(document());
const unchanged = parsed(JSON.parse(source));

try {
  assert.deepEqual(definition.clocks, { sizes: [4, 6, 8], max: 8, text: document().clocks.text });
  assert.equal(unchanged.clocks, undefined);
  for (const clocks of [
    null,
    [],
    { unexpected: true },
    { sizes: [] },
    { sizes: [4, 4] },
    { sizes: [1] },
    { sizes: [13] },
    { sizes: [2.5] },
    { sizes: [2, 3, 4, 5, 6, 7, 8] },
    { max: 0 },
    { max: 13 },
    { max: 1.5 },
    { text: "x".repeat(401) },
    { text: "[clock:]" },
    { text: "{{macro}}" },
    { text: "two\nlines" },
  ])
    assert.equal(parseRulesetDefinition({ ...document(), clocks }).ok, false, JSON.stringify(clocks));
  assert.deepEqual(parsed({ ...document(), clocks: {} }).clocks, { sizes: [4, 6, 8], max: 8 });
  assert.ok(parseRulesetDefinition({ ...document(), clocks: { sizes: [2, 12], max: 12 } }).ok);

  const create = '[clock: name="Alarm raised" size="6" result="forged" now="999" reason="fake"]';
  const created = applyClockCommandTags(create, definition, []);
  assert.deepEqual(created.clocks, [{ name: "Alarm raised", size: 6, filled: 0 }]);
  assert.equal(created.content, '[clock: name="Alarm raised" size="6" result="ok" now="0/6"]');
  const result = applyClockCommandTags(
    `${create} [clock: name="Alarm raised" tick="2"] [clock: name="ALARM RAISED" tick="2" now="999"]`,
    definition,
    [],
  );
  assert.equal(result.clocks[0]?.filled, 4);
  assert.match(result.content, /now="4\/6"/);
  assert.doesNotMatch(result.content, /forged|999|fake/);
  assert.equal(stripClockCommandTags(`Before ${result.content} after`).trim(), "Before after");
  const clamped = applyClockCommandTags('[clock: name="Alarm raised" tick="999999999"]', definition, result.clocks);
  assert.equal(clamped.clocks[0]?.filled, 6);
  assert.equal(result.clocks[0]?.filled, 4, "input snapshot is immutable");
  const removed = applyClockCommandTags('[clock: name="Alarm raised" tick="-999999999"]', definition, clamped.clocks);
  assert.equal(removed.clocks[0]?.filled, 0);
  const cleared = applyClockCommandTags(
    '[clock: name="Alarm raised" clear result="forged"]',
    definition,
    result.clocks,
  );
  assert.deepEqual(cleared.clocks, []);
  assert.match(cleared.content, /clear result="ok" now="cleared"/);
  assert.deepEqual(
    applyClockCommandTags(`${create} [clock: name="Alarm raised" clear] ${create}`, definition, []).clocks,
    created.clocks,
  );
  const limited = parsed({ ...document(), clocks: { max: 1 } });
  for (const [tag, reason, ruleset, base] of [
    [create, "name-exists", definition, result.clocks],
    ['[clock: name="alarm raised" size="4"]', "name-exists", definition, result.clocks],
    ['[clock: name="Escape" size="5"]', "size-not-allowed", definition, []],
    ['[clock: name="Escape" size="4"]', "max-clocks", limited, clamped.clocks],
    ['[clock: name="Missing" tick="1"]', "unknown-clock", definition, []],
    ['[clock: name="Missing" clear]', "unknown-clock", definition, []],
    [create, "clocks-disabled", unchanged, []],
    ['[clock: name="Alarm" size="6" tick="2" now="999"]', "bad-command", definition, []],
  ] as const) {
    const refused = applyClockCommandTags(tag, ruleset, [...base]);
    assert.match(refused.content, new RegExp(`result="refused" reason="${reason}"`));
    assert.deepEqual(refused.clocks, base);
    assert.doesNotMatch(refused.content, /999|forged/);
  }
  for (const body of [
    'name="A"',
    'size="4"',
    'name="A" size="4" tick="1"',
    'name="A" clear tick="1"',
    'name="A" tick="1.5"',
    'name="A" tick="Infinity"',
    'name="A" tick="1000000000"',
    'name="A" clear="true"',
    'name="clear"',
    'name="A" size="4" size="6"',
    `name="${"a".repeat(101)}" size="4"`,
    'name="{{macro}}" size="4"',
  ])
    assert.equal(parseClockCommandTagBody(body), null, body);
  assert.deepEqual(parseClockCommandTagBody('name="Clear skies" size="4"'), { name: "Clear skies", size: 4 });
  const many = applyClockCommandTags(create + ' [clock: name="Alarm raised" tick="1"]'.repeat(40), definition, []);
  assert.deepEqual(many.outcomes.at(-1), { ok: false, reason: "too-many-commands" });
  const unclosed = "[clock:".repeat(10000);
  assert.equal(applyClockCommandTags(unclosed, definition, []).content, unclosed);
  for (const invalid of [
    [{ name: "A", size: 6, filled: 7 }],
    [{ name: "A", size: 1, filled: 0 }],
    [{ name: "A", size: 6, filled: -1 }],
    [{ name: "A", size: 6, filled: 1.5 }],
    [{ name: "A", size: 6, filled: 0, unknown: true }],
    [
      { name: "A", size: 6, filled: 0 },
      { name: "a", size: 4, filled: 0 },
    ],
    Array.from({ length: 13 }, (_, i) => ({ name: String(i), size: 4, filled: 0 })),
  ])
    assert.equal(rulesetClocksSchema.safeParse(invalid).success, false);

  const { buildGmFormatReminder } = await import("../../../packages/server/src/services/game/gm-prompts.js");
  const { getCapabilityPackageInstallIssue } =
    await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");
  const context = { turnNumber: 2, gameActiveState: "exploration" as const, partyNames: ["Kit"], playerName: "Kit" };
  const reminder = buildGmFormatReminder({ ...context, ruleset: definition, rulesetClocks: result.clocks });
  for (const text of [
    "PROGRESS CLOCKS",
    "Alarm raised: 4/6",
    'tick="2"',
    "clear]",
    "4, 6, 8",
    definition.clocks!.text!,
  ])
    assert.ok(reminder.includes(text), text);
  assert.match(
    buildGmFormatReminder({ ...context, ruleset: definition, rulesetClocks: clamped.clocks }),
    /6\/6 \(done\)/,
  );
  assert.match(buildGmFormatReminder({ ...context, ruleset: definition }), /Open clocks:\nNone\./);
  assert.match(
    buildGmFormatReminder({ ...context, ruleset: parsed({ ...document(), clocks: { sizes: [2] } }) }),
    /size="2"/,
  );
  const editorSchema = JSON.parse(
    readFileSync(new URL("../../../docs/extending/ruleset.schema.json", import.meta.url), "utf8"),
  );
  assert.equal(editorSchema.properties.clocks.properties.sizes.uniqueItems, true);
  assert.doesNotMatch(buildGmFormatReminder({ ...context, ruleset: unchanged }), /PROGRESS CLOCKS|\[clock:/);
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "ruleset-clocks",
    name: "Clocks",
    version: "0.1.0",
    description: "Progress clocks.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  assert.match(getCapabilityPackageInstallIssue(manifest(142) as never, document()) ?? "", /capabilityApi 1\.143/);
  assert.equal(getCapabilityPackageInstallIssue(manifest(143) as never, document()), null);

  const generate = readFileSync(
    new URL("../../../packages/server/src/routes/generate.routes.ts", import.meta.url),
    "utf8",
  );
  assert.equal(
    generate.match(/parseStoredRulesetClocks\(\(await turnStartRulesetSnapshot\(\)\)\?\.rulesetClocks\)/gu)?.length,
    2,
    "the GM reminder and commands read the same continuation-first snapshot",
  );

  assert.match(
    generate,
    /const before = allChatMessages\.slice\(0, index\);[\s\S]*?fallbackMessageIds: before\.map\(\(message\) => message\.id\)/u,
    "a missing continuation snapshot limits fallback to earlier messages",
  );

  const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
  const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
  const { createGameStateStorage, parseStoredRulesetClocks } =
    await import("../../../packages/server/src/services/storage/game-state.storage.js");
  const { resolveVisibleGameStateAnchor, parseGameStateRow } =
    await import("../../../packages/server/src/routes/generate/generate-route-utils.js");
  assert.deepEqual(parseStoredRulesetClocks(undefined), []);
  assert.deepEqual(parseStoredRulesetClocks("bad json"), []);
  assert.deepEqual(parseStoredRulesetClocks(JSON.stringify(result.clocks)), result.clocks);
  let db = await getDB();
  try {
    let chats = createChatsStorage(db);
    let states = createGameStateStorage(db);
    const chat = await chats.create({ name: "Clocks", mode: "game", characterIds: [] } as never);
    assert.ok(chat);
    const first = await chats.createMessage({ chatId: chat.id, role: "assistant", content: created.content });
    const base = await states.updateByMessage(first.id, 0, chat.id, { rulesetClocks: created.clocks }, undefined, {
      baseSnapshot: null,
    });
    assert.ok(base);
    await states.commit(base.id, chat.id);
    const withoutSnapshot = await chats.createMessage({
      chatId: chat.id,
      role: "assistant",
      content: "An older reply without a snapshot",
    });
    const second = await chats.createMessage({ chatId: chat.id, role: "assistant", content: result.content });
    await states.updateByMessage(second.id, 0, chat.id, { rulesetClocks: result.clocks }, undefined, {
      baseSnapshot: base,
    });
    const visible = async () =>
      states.getForGeneration(chat.id, {
        preferLatestVisible: true,
        visibleAnchor: resolveVisibleGameStateAnchor(await chats.listMessages(chat.id)),
      });
    assert.deepEqual(parseGameStateRow((await visible())!).rulesetClocks, result.clocks);
    const timeline = await chats.listMessages(chat.id);
    const beforeMissing = timeline.slice(
      0,
      timeline.findIndex((message) => message.id === withoutSnapshot.id),
    );
    const missingFallback = await states.getForGeneration(chat.id, {
      preferLatestVisible: true,
      visibleAnchor: resolveVisibleGameStateAnchor(beforeMissing),
      fallbackMessageIds: beforeMissing.map((message) => message.id),
    });
    assert.deepEqual(
      parseStoredRulesetClocks(missingFallback?.rulesetClocks),
      created.clocks,
      "a missing continuation snapshot cannot inherit future clocks",
    );
    const turnStart = await states.getForGeneration(chat.id, {
      excludeMessageId: second.id,
      fallbackMessageIds: [first.id],
    });
    assert.deepEqual(
      parseStoredRulesetClocks(turnStart?.rulesetClocks),
      created.clocks,
      "regenerate starts before the replaced reply",
    );
    const alternate = applyClockCommandTags(
      '[clock: name="Alarm raised" tick="1"]',
      definition,
      parseStoredRulesetClocks(turnStart?.rulesetClocks),
    );
    const swipe = await chats.addSwipe(second.id, alternate.content);
    await states.updateByMessage(second.id, swipe.index, chat.id, { rulesetClocks: alternate.clocks }, undefined, {
      baseSnapshot: turnStart,
    });
    assert.equal(parseStoredRulesetClocks((await visible())?.rulesetClocks)[0]?.filled, 1);
    await chats.setActiveSwipe(second.id, 0);
    assert.deepEqual(parseStoredRulesetClocks((await visible())?.rulesetClocks), result.clocks);
    await chats.setActiveSwipe(second.id, swipe.index);
    assert.deepEqual(parseStoredRulesetClocks((await visible())?.rulesetClocks), alternate.clocks);
    await chats.removeSwipe(second.id, swipe.index);
    assert.deepEqual(parseStoredRulesetClocks((await visible())?.rulesetClocks), result.clocks);
    const row = await visible();
    assert.ok(row);
    const { rulesetClocks: _clocks, ...tracker } = parseGameStateRow(row);
    await states.create(tracker);
    assert.deepEqual(
      parseStoredRulesetClocks((await visible())?.rulesetClocks),
      result.clocks,
      "tracker replacement keeps the clocks",
    );
    const cloneBase = await visible();
    const third = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Next scene" });
    await states.updateByMessage(third.id, 0, chat.id, { weather: "Rain" }, undefined, {
      baseSnapshot: cloneBase,
    });
    assert.deepEqual(
      parseStoredRulesetClocks((await visible())?.rulesetClocks),
      result.clocks,
      "snapshot cloning keeps clocks",
    );
    await states.updateByMessage(third.id, 0, chat.id, { rulesetClocks: [] });
    assert.deepEqual(
      parseStoredRulesetClocks((await visible())?.rulesetClocks),
      [],
      "explicit empty clears instead of inheriting",
    );
    const continued = await states.getByChatAndMessage(chat.id, second.id, 0);
    const continuationClocks = parseStoredRulesetClocks(continued?.rulesetClocks);
    const continuation = applyClockCommandTags('[clock: name="Alarm raised" tick="1"]', definition, continuationClocks);
    assert.equal(continuation.clocks[0]?.filled, 5, "continuing an older reply uses its own snapshot");
    assert.match(
      buildGmFormatReminder({ ...context, ruleset: definition, rulesetClocks: continuationClocks }),
      /Alarm raised: 4\/6/,
    );
    await chats.removeMessage(third.id);
    assert.deepEqual(parseStoredRulesetClocks((await visible())?.rulesetClocks), result.clocks);
    await closeDB();
    db = await getDB();
    chats = createChatsStorage(db);
    states = createGameStateStorage(db);
    assert.deepEqual(
      parseStoredRulesetClocks((await visible())?.rulesetClocks),
      result.clocks,
      "disk round-trip keeps the snapshot",
    );
    await chats.removeMessage(second.id);
    assert.deepEqual(
      parseStoredRulesetClocks((await visible())?.rulesetClocks),
      created.clocks,
      "delete restores the preceding snapshot",
    );
  } finally {
    await closeDB();
  }
  console.log("Ruleset clocks: schema, commands, outcomes, snapshots, regeneration, swipes, prompts and gate passed.");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
