// Pixelforge 0.16.2 slice 3 regression: player-selected lorebook ENTRIES reaching
// POST /api/game/:chatId/experience-generation.
//
// A game-surface Experience writes its world in one host-run call. Before this
// change no lorebook content reached that call in any form, so a player who had
// already written the history of a place got a world that had never heard of it.
// The route now takes a list of ENTRY ids — never whole books — and resolves them
// through the same lorebook machinery the /setup opening-scene block uses.
//
// Pinned behaviors:
//   1. DEFAULT-OFF, and this is the headline. An absent key and an explicit empty
//      list both produce the exact outbound messages the route sent before, and a
//      response with no lorebook key at all. Nothing is looked up.
//   2. D-13: an entry the player ticked bypasses the probability roll, and ONLY
//      the roll. enabled, the character/tag filters, the generation-trigger filter
//      and sticky/cooldown/delay timing all still bite.
//   3. D-13 leak guard: ignoreProbability is read by passesForcedEntryActivationGates
//      and nowhere else, so an ordinary keyword match still rolls in the same call
//      and the shared probabilityDecisions map is never seeded behind its back.
//   4. D-12: the forced-entry location budget is the caller's to set. The route
//      spends the picker's own 3,000-token figure instead of the 2,048-token
//      current-location default, so a selection the player was shown as affordable
//      arrives whole.
//   5. D-14: when a selection DOES overrun, whole entries are dropped following the
//      mechanism's own order — constants first, then position in the lorebook — and
//      never the end of the supplied id list. No entry is half-included.
//   6. budgetSkippedEntries is the single source of the omitted count: the number
//      the response reports equals the number of entries actually absent from the
//      prompt, and names them.
//   7. The wire count ceiling is LIMITS.MAX_LOREBOOK_ENTRIES — 101 ids is a clean
//      400 rather than a silent truncation.
//   8. A disabled entry cannot be smuggled in by ticking it.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { LIMITS } from "../../packages/shared/src/constants/defaults.js";
import { createLorebookEntrySchema } from "../../packages/shared/src/schemas/lorebook.schema.js";
import type { LorebookEntry } from "../../packages/shared/src/types/lorebook.js";
import { errorHandler } from "../../packages/server/src/middleware/error-handler.js";
import { gameRoutes } from "../../packages/server/src/routes/game.routes.js";
import {
  passesForcedEntryActivationGates,
  scanForActivatedEntries,
} from "../../packages/server/src/services/lorebook/keyword-scanner.js";
import { createChatsStorage } from "../../packages/server/src/services/storage/chats.storage.js";
import { createConnectionsStorage } from "../../packages/server/src/services/storage/connections.storage.js";
import { createLorebooksStorage } from "../../packages/server/src/services/storage/lorebooks.storage.js";

// ── Part 1: the gate mechanics, as pure functions ────────────────────────────
// These need no server. A seeded random that always fails the roll is what makes
// "the entry arrived because the roll was skipped" a measurement and not a hope.
const ALWAYS_FAILS_THE_ROLL = () => 0.99;

const makeEntry = (overrides: Record<string, unknown>): LorebookEntry =>
  ({
    ...createLorebookEntrySchema.parse({
      lorebookId: "book",
      name: "Viridian City",
      keys: ["viridian"],
      content: "A green city at the edge of the forest.",
      ...overrides,
    }),
    id: (overrides.id as string) ?? "viridian",
    embedding: null,
  }) as LorebookEntry;

{
  // 25% with a roll that lands at 0.99: the gate fails every time it is asked.
  const unlikely = makeEntry({ probability: 25 });
  assert.equal(
    passesForcedEntryActivationGates(unlikely, { random: ALWAYS_FAILS_THE_ROLL }),
    false,
    "Baseline: without the opt-in, a ticked entry is still a dice roll",
  );
  assert.equal(
    passesForcedEntryActivationGates(unlikely, { random: ALWAYS_FAILS_THE_ROLL, ignoreProbability: true }),
    true,
    "D-13: an explicitly selected entry arrives regardless of the roll",
  );

  // 0 is the deterministic end of the same gate, not a different one.
  const never = makeEntry({ probability: 0 });
  assert.equal(passesForcedEntryActivationGates(never, {}), false, "probability 0 refuses on its own");
  assert.equal(
    passesForcedEntryActivationGates(never, { ignoreProbability: true }),
    true,
    "D-13 covers the whole probability gate, including its deterministic end",
  );
}

{
  // Only the roll is skipped. Every other gate must still refuse.
  const disabled = makeEntry({ probability: 25, enabled: false });
  assert.equal(
    passesForcedEntryActivationGates(disabled, { ignoreProbability: true }),
    false,
    "A disabled entry stays refused — ticking is not a way past enabled",
  );

  const triggerFiltered = makeEntry({
    probability: 25,
    generationTriggerFilterMode: "include",
    generationTriggerFilters: ["game_setup"],
  });
  assert.equal(
    passesForcedEntryActivationGates(triggerFiltered, {
      ignoreProbability: true,
      generationTriggers: ["chat"],
    }),
    false,
    "The generation-trigger filter still bites; ScanOptions' ['chat'] default would silently refuse it",
  );
  assert.equal(
    passesForcedEntryActivationGates(triggerFiltered, {
      ignoreProbability: true,
      generationTriggers: ["game_setup", "game"],
    }),
    true,
    "...and passing the game triggers explicitly is what lets it through",
  );

  const characterFiltered = makeEntry({
    probability: 25,
    characterFilterMode: "include",
    characterFilterIds: ["someone-else"],
  });
  assert.equal(
    passesForcedEntryActivationGates(characterFiltered, { ignoreProbability: true, activeCharacterIds: [] }),
    false,
    "The character filter still bites against an empty party",
  );

  // Timing is a separate opt-in (ignoreTiming) and must not travel with this one.
  // A delayed entry with no timing state yet is the first-call case checkTiming
  // refuses outright.
  const delayed = makeEntry({ probability: 25, delay: 5 });
  assert.equal(
    passesForcedEntryActivationGates(delayed, { ignoreProbability: true }),
    false,
    "Timing still filters — ignoreProbability does not imply ignoreTiming",
  );
  assert.equal(
    passesForcedEntryActivationGates(delayed, { ignoreProbability: true, ignoreTiming: true }),
    true,
    "...and the timing opt-in remains the separate control it always was",
  );
}

{
  // The leak guard. The obvious implementation — pre-seeding probabilityDecisions
  // with true — would suppress the roll on the ORDINARY keyword path too, because
  // the same map is reused across the whole scan. Two assertions pin that it does not.
  const decisions = new Map<string, boolean>();
  assert.equal(
    passesForcedEntryActivationGates(makeEntry({ probability: 25 }), {
      random: ALWAYS_FAILS_THE_ROLL,
      ignoreProbability: true,
      probabilityDecisions: decisions,
    }),
    true,
  );
  assert.equal(decisions.size, 0, "The shared decision map is never written behind the keyword scan's back");

  const keywordMatched = makeEntry({ probability: 25 });
  assert.deepEqual(
    scanForActivatedEntries([{ role: "user", content: "viridian" }], [keywordMatched], {
      random: ALWAYS_FAILS_THE_ROLL,
      ignoreProbability: true,
    } as Parameters<typeof scanForActivatedEntries>[2]).map((row) => row.entry.id),
    [],
    "ignoreProbability never reaches scanForActivatedEntries — an ordinary keyword match still rolls",
  );
}

// ── Part 2: the route, end to end ────────────────────────────────────────────
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const db = await getDB();
const chats = createChatsStorage(db);
const connections = createConnectionsStorage(db);
const lorebooks = createLorebooksStorage(db);
const createdChatIds: string[] = [];
const createdLorebookIds: string[] = [];
let createdConnectionId: string | null = null;
let previousMainFallbackId: string | null = null;

const VALID_BRIEF = JSON.stringify({ version: 1, settlementName: "Meridian Base" });
let upstreamBodies: Array<Record<string, unknown>> = [];

const mockProvider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  upstreamBodies.push(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ choices: [{ message: { content: VALID_BRIEF }, finish_reason: "stop" }] }));
});
await new Promise<void>((resolve) => mockProvider.listen(0, "127.0.0.1", resolve));
const mockAddress = mockProvider.address();
assert.ok(mockAddress && typeof mockAddress === "object");
const mockBaseUrl = `http://127.0.0.1:${mockAddress.port}/v1`;

const app = Fastify();
app.decorate("db", db);
app.setErrorHandler(errorHandler);
await app.register(gameRoutes, { prefix: "/api/game" });

const EXPERIENCE_ID = "experience-lore-entries-test";
const INSTRUCTIONS = "You produce a world brief. Reply with ONLY a JSON object.";
const BASE_BODY = {
  instructions: INSTRUCTIONS,
  userContent: "A quiet valley, three days' walk from the sea.",
};
const post = (chatId: string, payload: unknown) =>
  app.inject({ method: "POST", url: `/api/game/${chatId}/experience-generation`, payload: payload as object });

/** Filler of an exact length, carrying a marker the assertions can find. */
const loreContent = (marker: string, length: number) =>
  `${marker} ${"settlement history, old roads and older grudges. ".repeat(60)}`.slice(0, length);

const systemPromptOf = (index = 0) =>
  ((upstreamBodies[index]?.messages as Array<{ role: string; content: string }>)[0] as { content: string }).content;

async function createExperienceChat(name: string) {
  const chat = await chats.create({ name, mode: "game", characterIds: [] } as Parameters<typeof chats.create>[0]);
  assert.ok(chat);
  createdChatIds.push(chat.id);
  await chats.patchMetadata(chat.id, () => ({ gameExperienceId: EXPERIENCE_ID }));
  if (createdConnectionId) await chats.update(chat.id, { connectionId: createdConnectionId });
  return chat;
}

/** An unbound, non-global book: it reaches the call ONLY as a forced selection,
 *  so nothing here can be credited to ordinary scope-based activation. */
async function createBook(name: string, tokenBudget: number) {
  const book = await lorebooks.create({ name, tokenBudget, isGlobal: false } as Parameters<typeof lorebooks.create>[0]);
  assert.ok(book);
  createdLorebookIds.push(book.id);
  return book;
}

let scenarioFailed = false;
let scenarioError: unknown;
try {
  previousMainFallbackId = (await connections.getFallbackForMain())?.id ?? null;
  const conn = await connections.create({
    name: "experience-lore-entries mock",
    provider: "custom",
    baseUrl: mockBaseUrl,
    apiKey: "test",
    model: "mock-model",
    fallbackForMain: true,
  } as Parameters<typeof connections.create>[0]);
  createdConnectionId = conn.id;

  // ── 1. Default-off: the unused path is the path that already shipped ──
  {
    const chat = await createExperienceChat("unused key");

    upstreamBodies = [];
    const baseline = await post(chat.id, BASE_BODY);
    assert.equal(baseline.statusCode, 200, baseline.body);
    const baselineMessages = upstreamBodies[0]?.messages;

    upstreamBodies = [];
    const empty = await post(chat.id, { ...BASE_BODY, lorebookEntryIds: [] });
    assert.equal(empty.statusCode, 200, empty.body);

    assert.deepEqual(
      upstreamBodies[0]?.messages,
      baselineMessages,
      "An empty selection sends byte-identical messages — this is what lets the route ship default-off",
    );
    assert.equal(systemPromptOf(), INSTRUCTIONS, "The system turn is the package's instructions, untouched");
    assert.equal(
      Object.prototype.hasOwnProperty.call(baseline.json(), "lorebook"),
      false,
      "No selection means no lorebook key on the response at all",
    );
    assert.equal(Object.prototype.hasOwnProperty.call(empty.json(), "lorebook"), false);
  }

  // ── 2. D-12: the budget the player was shown is the budget the server spends ──
  // Eight entries of 1,400 characters = 350 tokens each = 2,800 total. The route's
  // 3,000-token override takes all eight. The 2,048-token default it replaces would
  // take five and silently drop three — the invisible-budget failure this exists for.
  {
    const book = await createBook("Kanto", 4_000);
    const ids: string[] = [];
    for (let index = 0; index < 8; index += 1) {
      const entry = await lorebooks.createEntry({
        lorebookId: book.id,
        name: `Route ${index}`,
        content: loreContent(`LOREMARK${index}`, 1_400),
        order: 100 + index,
      } as Parameters<typeof lorebooks.createEntry>[0]);
      assert.ok(entry);
      ids.push(entry.id);
    }

    const chat = await createExperienceChat("budget override");
    upstreamBodies = [];
    const res = await post(chat.id, { ...BASE_BODY, lorebookEntryIds: ids });
    assert.equal(res.statusCode, 200, res.body);

    const prompt = systemPromptOf();
    for (let index = 0; index < 8; index += 1) {
      assert.ok(
        prompt.includes(`LOREMARK${index}`),
        `Entry ${index} must survive the location budget the route raised (D-12)`,
      );
    }
    assert.ok(prompt.startsWith(INSTRUCTIONS), "The lore is appended to the package's instructions, not spliced in");
    assert.deepEqual(res.json().lorebook.skippedEntries, [], "A selection inside the budget skips nothing");
    assert.equal(res.json().lorebook.includedEntries, 8);
  }

  // ── 3. D-14 + the omitted count: drops follow the mechanism, and are reported ──
  // Ten entries of 1,600 characters = 400 tokens each = 4,000 total against a
  // 3,000-token ceiling, so three must go. The entry placed LAST in the book is a
  // constant: under lorebookSelectionOrder it sorts first and survives, while three
  // entries EARLIER in the book do not. That is the order the plan promises to
  // describe rather than override.
  {
    const book = await createBook("Johto", 8_000);
    const ids: string[] = [];
    for (let index = 0; index < 10; index += 1) {
      const isConstant = index === 9;
      const entry = await lorebooks.createEntry({
        lorebookId: book.id,
        name: isConstant ? "Ecruteak (constant)" : `Town ${index}`,
        content: loreContent(`DROPMARK${index}`, 1_600),
        order: 100 + index,
        constant: isConstant,
      } as Parameters<typeof lorebooks.createEntry>[0]);
      assert.ok(entry);
      ids.push(entry.id);
    }

    const chat = await createExperienceChat("drop order");
    upstreamBodies = [];
    const res = await post(chat.id, { ...BASE_BODY, lorebookEntryIds: ids });
    assert.equal(res.statusCode, 200, res.body);

    const prompt = systemPromptOf();
    const present = [...Array(10).keys()].filter((index) => prompt.includes(`DROPMARK${index}`));
    assert.deepEqual(
      present,
      [0, 1, 2, 3, 4, 5, 9],
      "D-14: the constant survives from the END of the book while entries earlier in it drop",
    );
    assert.ok(prompt.includes(`DROPMARK9`), "The constant wins the selection order outright");

    // No entry is half-included: every surviving marker brings its whole 1,600
    // characters, so the drop unit is the entry rather than the character.
    for (const index of present) {
      assert.ok(
        prompt.includes(loreContent(`DROPMARK${index}`, 1_600).trim()),
        `Entry ${index} must be included whole, never truncated mid-entry`,
      );
    }

    // The count the package shows reads the Engine's own diagnostic, so it cannot
    // disagree with what actually happened.
    const skipped = res.json().lorebook.skippedEntries as Array<{ name: string; blockedBy: string }>;
    assert.equal(skipped.length, 3, "budgetSkippedEntries reports exactly the three that were dropped");
    assert.equal(res.json().lorebook.includedEntries, 7);
    assert.deepEqual(
      skipped.map((entry) => entry.name).sort(),
      ["Town 6", "Town 7", "Town 8"],
      "...and names them, so the omitted line never invents a second count",
    );
    for (const entry of skipped) assert.equal(entry.blockedBy, "location", "Dropped by the location budget");
  }

  // ── 4. A ticked entry is not a dice roll, through the route (D-13) ──
  {
    const book = await createBook("Hoenn", 4_000);
    const never = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Petalburg",
      content: loreContent("ROLLMARK", 400),
      probability: 0,
    } as Parameters<typeof lorebooks.createEntry>[0]);
    const disabled = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Nowhere",
      content: loreContent("DISABLEDMARK", 400),
      enabled: false,
    } as Parameters<typeof lorebooks.createEntry>[0]);
    assert.ok(never && disabled);

    const chat = await createExperienceChat("probability bypass");
    upstreamBodies = [];
    const res = await post(chat.id, { ...BASE_BODY, lorebookEntryIds: [never.id, disabled.id] });
    assert.equal(res.statusCode, 200, res.body);

    const prompt = systemPromptOf();
    assert.ok(prompt.includes("ROLLMARK"), "A ticked entry arrives even when its probability gate would refuse it");
    assert.equal(
      prompt.includes("DISABLEDMARK"),
      false,
      "A disabled entry cannot be smuggled in by ticking it — the storage safeguards still hold",
    );
    assert.equal(res.json().lorebook.includedEntries, 1);
  }

  // ── 5. The wire count ceiling is a clean refusal, not a silent truncation ──
  {
    const chat = await createExperienceChat("count ceiling");
    const overflow = Array.from({ length: LIMITS.MAX_LOREBOOK_ENTRIES + 1 }, (_, index) => `missing-${index}`);
    assert.equal(
      (await post(chat.id, { ...BASE_BODY, lorebookEntryIds: overflow })).statusCode,
      400,
      `More than ${LIMITS.MAX_LOREBOOK_ENTRIES} ids is a clean 400 rather than a quietly trimmed selection`,
    );
    assert.equal(
      (await post(chat.id, { ...BASE_BODY, lorebookEntryIds: overflow.slice(0, LIMITS.MAX_LOREBOOK_ENTRIES) }))
        .statusCode,
      200,
      "...and the ceiling itself is accepted",
    );
  }
} catch (error) {
  scenarioFailed = true;
  scenarioError = error;
}

let cleanupFailed = false;
let firstCleanupError: unknown;
const runCleanup = async (cleanup: () => Promise<unknown>) => {
  try {
    await cleanup();
  } catch (error) {
    if (!cleanupFailed) firstCleanupError = error;
    cleanupFailed = true;
  }
};

for (const chatId of createdChatIds) await runCleanup(() => chats.remove(chatId));
for (const lorebookId of createdLorebookIds) await runCleanup(() => lorebooks.remove(lorebookId));
if (createdConnectionId) await runCleanup(() => connections.remove(createdConnectionId));
if (previousMainFallbackId) {
  await runCleanup(() => connections.update(previousMainFallbackId, { fallbackForMain: true }));
}
await runCleanup(() => app.close());
await runCleanup(
  () =>
    new Promise<void>((resolve, reject) => {
      mockProvider.close((error) => (error ? reject(error) : resolve()));
    }),
);
await runCleanup(closeDB);

if (scenarioFailed) {
  if (cleanupFailed) {
    throw new AggregateError(
      [scenarioError, firstCleanupError],
      "Experience lore-entries regression and cleanup both failed",
      {
        cause: scenarioError,
      },
    );
  }
  throw scenarioError;
}
if (cleanupFailed) throw firstCleanupError;
console.log("experience lore-entry selection regression passed");
