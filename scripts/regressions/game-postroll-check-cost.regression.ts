/** A real streamed Game turn pays a check before rewriting its narration (#8180). */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatMessage, ChatOptions, LLMUsage } from "../../packages/server/src/services/llm/base-provider.js";
import type { RulesetLiveStates } from "../../packages/shared/src/index.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-postroll-check-cost-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { ClaudeSubscriptionProvider } =
  await import("../../packages/server/src/services/llm/providers/claude-subscription.provider.js");
const {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  parseSkillCheckTagBody,
  readRulesetLive,
  rowsFromCatalogEntry,
} = await import("../../packages/shared/src/index.js");

let draft = "";
let consequences = "";
let requestedSpend = 0;
let useEntry = false;
const prompts: ChatMessage[][] = [];
const originalChat = ClaudeSubscriptionProvider.prototype.chat;
ClaudeSubscriptionProvider.prototype.chat = async function* (
  messages: ChatMessage[],
  _options: ChatOptions,
): AsyncGenerator<string, LLMUsage> {
  prompts.push(structuredClone(messages));
  if (prompts.length === 1) yield draft;
  else {
    assert.equal(prompts.length, 2, "one draft and one post-roll rewrite, with no external provider");
    // A local narrator follows the payment contract it was given. The old instruction asks it to
    // repeat the purchase; actual paid receipts let it omit that command, retaining NEW costs.
    const instruction = messages.at(-1)!.content;
    const paid = instruction.includes(
      "Reported check-purchase payments (other check-entry costs may also have been paid):",
    );
    const repeated =
      !paid && requestedSpend ? ` [sheet: who="Mira" op="spend" pool="resolve" amount="${requestedSpend}"]` : "";
    // Entry costs can debit more than the legacy single-pool receipt reports. The explicit
    // all-costs instruction, not invented receipt data, governs the unreported use counter.
    const repeatedEntry =
      useEntry &&
      !instruction.includes(
        "The check pass has already applied any accepted purchases and check-entry costs to the sheets:",
      )
        ? ' [sheet: who="Mira" op="spend" pool="resolve" amount="1"] [sheet: who="Mira" op="spend" pool="charms:steady hand" amount="1"]'
        : "";
    yield `Mira presses on.${repeated}${repeatedEntry} ${consequences}`;
  }
  return { promptTokens: 10, completionTokens: 5, totalTokens: 15, finishReason: "stop" };
};

const db = await getDB();
const chats = createChatsStorage(db);
const states = createGameStateStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  const text = readFileSync(new URL("../../docs/examples/rulesets/gravewatch.json", import.meta.url), "utf8");
  const document = { ...JSON.parse(text), id: "gravewatch-postroll-cost" };
  const parsed = parseRulesetDefinition(document);
  assert.ok(parsed.ok, JSON.stringify(parsed));
  const build = defaultRulesetSheetBuild(parsed.definition);
  await createGameRulesetsStorage(db).put({
    rulesetId: "local/gravewatch-postroll-cost",
    version: document.version,
    sourceKind: "local",
    definition: JSON.stringify(document),
  });
  const entryDocument = { ...JSON.parse(text), id: "gravewatch-postroll-entry-cost" };
  delete entryDocument.layers;
  entryDocument.sheet.lists[0].columns.push({ id: "uses", label: "Uses", type: "number", min: 0, max: 2 });
  entryDocument.sheet.lists[0].pools = { nameColumn: "name", maxColumn: "uses" };
  const entry = entryDocument.catalogs[0].entries[0];
  entry.rows[0].values.uses = 2;
  delete entry.mechanics.perCostStep;
  const parsedEntry = parseRulesetDefinition(entryDocument);
  assert.ok(parsedEntry.ok, JSON.stringify(parsedEntry));
  const entryBuild = defaultRulesetSheetBuild(parsedEntry.definition);
  entryBuild.lists.charms = rowsFromCatalogEntry("charms", parsedEntry.definition.catalogs![0]!.entries![0]!).map(
    ({ row }) => row,
  );
  await createGameRulesetsStorage(db).put({
    rulesetId: "local/gravewatch-postroll-entry-cost",
    version: entryDocument.version,
    sourceKind: "local",
    definition: JSON.stringify(entryDocument),
  });
  const connection = await createConnectionsStorage(db).create({
    name: "Post-roll local fixture",
    provider: "claude_subscription",
    model: "fixture",
    apiKey: "synthetic-fixture",
    maxContext: 32768,
  });
  assert.ok(connection);
  const setup = async (resolve = 3, entryCosts = false) => {
    const chat = await chats.create({
      name: "Post-roll payment",
      mode: "game",
      characterIds: [],
      connectionId: connection.id,
      promptPresetId: null,
    });
    assert.ok(chat);
    await chats.patchMetadata(chat.id, {
      enableAgents: false,
      enableTools: false,
      gameOneRequestDice: false,
      gameDiceOutcomeNarration: true,
      gameRuleset: {
        id: entryCosts ? "local/gravewatch-postroll-entry-cost" : "local/gravewatch-postroll-cost",
        version: document.version,
        packageId: null,
        options: {},
      },
      gameCharacterCards: ["Mira", "Bram"].map((name) => ({
        name,
        rulesetSheet: { v: 1, build: entryCosts ? entryBuild : build },
      })),
    });
    const before = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "The watch begins." });
    await states.create({
      chatId: chat.id,
      messageId: before.id,
      swipeIndex: 0,
      date: null,
      time: null,
      location: null,
      weather: null,
      temperature: null,
      presentCharacters: [],
      recentEvents: [],
      playerStats: null,
      personaStats: null,
    });
    await states.updateLatest(chat.id, {
      rulesetLive: {
        mira: { pools: { resolve: { value: resolve } } },
        bram: { pools: { resolve: { value: 3 } }, wounds: { harm: { marks: ["knock"] } } },
      },
    });
    await chats.createMessage({ chatId: chat.id, role: "user", content: "Mira holds her nerve." });
    return chat.id;
  };
  const turn = async (chatId: string, spend = 1, extra = "", regenerateMessageId?: string, entryCosts = false) => {
    requestedSpend = spend;
    useEntry = entryCosts;
    consequences = extra;
    draft = `Mira steadies herself. [skill_check: who="Mira" skill="Nerve" dc="1"${spend ? ` spend="resolve:${spend}"` : ""}${entryCosts ? ' use="Steady Hand"' : ""}] ${extra}`;
    prompts.length = 0;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId, streaming: true, ...(regenerateMessageId ? { regenerateMessageId } : {}) },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
    assert.equal(prompts.length, 2, "the actual route sent the draft and the post-roll request");
    const saved = (await chats.listMessages(chatId)).at(-1)!;
    assert.equal(saved.role, "assistant");
    assert.match(saved.content, /Mira presses on\./, "the rewritten narration was saved");
    const record = parseSkillCheckTagBody(/\[skill_check:([^\]]+)\]/.exec(saved.content)![1]!);
    assert.ok(record?.resolvedResult, "the engine kept the real roll record in the revised message");
    const row = await states.getByChatAndMessage(chatId, saved.id, saved.activeSwipeIndex ?? 0);
    const live: RulesetLiveStates = row?.rulesetLive ? JSON.parse(row.rulesetLive as string) : {};
    return { response, saved, live, record, instruction: prompts[1]!.at(-1)!.content };
  };
  const receipts = (instruction: string) => {
    const encoded =
      /Reported check-purchase payments \(other check-entry costs may also have been paid\): (\[[^\n]*\])/.exec(
        instruction,
      )?.[1];
    return encoded ? JSON.parse(encoded) : [];
  };
  const failures: string[] = [];
  const check = async (name: string, run: () => Promise<void>) => {
    try {
      await run();
      console.info(`PASS ${name}`);
    } catch (error) {
      failures.push(`${name}: ${String(error)}`);
      console.error(`FAIL ${name}:`, error);
    }
  };

  await check("one purchase is paid once, including on regeneration", async () => {
    const id = await setup();
    const first = await turn(id);
    assert.equal(first.live.mira?.pools?.resolve?.value, 2, "Resolve3 pays one check, leaving2");
    assert.deepEqual(receipts(first.instruction), [{ who: "Mira", pool: "resolve", amount: 1 }]);
    assert.deepEqual(first.record.spend, { pool: "resolve", amount: 1 });
    assert.match(first.response.body, /"type":"game_state_patch"[^\n]*"resolve"/, "the client gets the paid sheet");
    const again = await turn(id, 1, "", first.saved.id);
    assert.equal(again.live.mira?.pools?.resolve?.value, 2, "retelling starts before this turn's purchase");
    assert.equal(again.saved.id, first.saved.id);
  });
  await check("the receipt is the clamped actual payment, never the requested amount", async () => {
    const result = await turn(await setup(), 6);
    assert.equal(parsed.definition.resolution.spend![0]!.perCheck, 2, "the shipped ruleset caps purchases at2");
    assert.deepEqual(receipts(result.instruction), [{ who: "Mira", pool: "resolve", amount: 2 }]);
    assert.deepEqual(result.record.spend, { pool: "resolve", amount: 2 });
    assert.equal(result.live.mira?.pools?.resolve?.value, 1);
  });
  await check("an unaffordable purchase claims no payment", async () => {
    const result = await turn(await setup(0));
    assert.deepEqual(receipts(result.instruction), []);
    assert.equal(result.record.spend, undefined);
    assert.equal(result.live.mira?.pools?.resolve?.value, 0);
  });
  await check("new same-pool and other-member costs, harm and healing still execute", async () => {
    const result = await turn(
      await setup(),
      1,
      [
        '[sheet: who="Mira" op="spend" pool="resolve" amount="1"]',
        '[sheet: who="Bram" op="spend" pool="resolve" amount="1"]',
        '[sheet: who="Mira" op="damage" track="harm" kind="knock" amount="1"]',
        '[sheet: who="Bram" op="damage" track="harm" kind="knock" amount="-1"]',
      ].join(" "),
    );
    assert.equal(result.live.mira?.pools?.resolve?.value, 1, "one check plus one NEW same-pool cost");
    assert.equal(result.live.bram?.pools?.resolve?.value, 2, "the other member's cost is retained");
    assert.deepEqual(result.live.mira?.wounds?.harm?.marks, ["knock"]);
    assert.deepEqual(
      readRulesetLive(parsed.definition, build, result.live.bram).tracks.find((track) => track.id === "harm")!.wound!
        .marks,
      [],
      "healing clears the mark (default live entries are omitted from storage)",
    );
    assert.equal((result.saved.content.match(/result="ok"/g) ?? []).length, 4, "all four new sheet commands succeed");
  });
  await check("an entry pays its resource AND use counter once, with an honest partial receipt", async () => {
    for (const [extra, expectedResolve] of [
      ["", 2],
      ['[sheet: who="Mira" op="spend" pool="resolve" amount="1"]', 1],
    ] as const) {
      const result = await turn(await setup(3, true), 0, extra, undefined, true);
      const pools = readRulesetLive(parsedEntry.definition, entryBuild, result.live.mira).pools;
      assert.equal(result.record.useEntry, "Steady Hand", "the actual check used the catalog entry");
      assert.equal(
        pools.find((pool) => pool.key === "resolve")!.value,
        expectedResolve,
        "entry cost paid once, and an additional same-pool cost remains effective",
      );
      assert.equal(
        pools.find((pool) => pool.listId === "charms")!.value,
        1,
        "the entry's row counter is paid once, not twice",
      );
      assert.deepEqual(
        receipts(result.instruction),
        [{ who: "Mira", pool: "resolve", amount: 1 }],
        "report only the actual legacy receipt; do not invent a complete payment ledger",
      );
      assert.doesNotMatch(result.saved.content, /pool="charms:steady hand"/, "no duplicate use-counter command");
    }
  });
  await check("a check with no purchase still applies a new cost", async () => {
    const result = await turn(await setup(), 0, '[sheet: who="Mira" op="spend" pool="resolve" amount="1"]');
    assert.deepEqual(receipts(result.instruction), []);
    assert.equal(result.record.spend, undefined);
    assert.equal(result.live.mira?.pools?.resolve?.value, 2);
  });
  assert.deepEqual(failures, [], failures.join("\n"));
  console.info("Game post-roll payment HTTP regressions passed (local model stub; no live-provider claim).");
} finally {
  ClaudeSubscriptionProvider.prototype.chat = originalChat;
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
