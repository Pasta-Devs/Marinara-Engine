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
//   9. EXACT SELECTION. A selection is the whole of what this call carries. A global
//      lorebook's constant entry activates with no messages at all, so without this
//      the player's one tick would drag in every constant in the product; this is a
//      world-writing request, not a chat turn. Pinned in three directions: absent
//      here; still present for every OTHER lorebook caller; and still present for a
//      caller that passes forced ids WITHOUT asking for an exact selection, which is
//      what every pre-existing forced-entry caller does.
//  10. The ROUTE is what supplies the game generation triggers. ScanOptions defaults
//      to ["chat"], so a route that forgets them refuses a game_setup entry with no
//      error anyone could see. Part 1 pins the gate; this pins the caller.
//  11. There are TWO walls, and the second one is the one the route cannot move. The
//      per-book tokenBudget defaults to 2,048 and applies after the location budget,
//      so inside an ordinary book the raised 3,000-token override buys nothing.
//  12. A reported drop is a REAL drop. The exact-selection rule has to skip the
//      ordinary scan rather than empty its inputs, and has to suppress the book
//      filter rather than only the entry list — otherwise a picked CONSTANT the
//      location budget dropped is re-activated (directly, or through the recursion a
//      stray global book switches on) and the response names as set aside an entry
//      it actually sent.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { LIMITS } from "../../packages/shared/src/constants/defaults.js";
import { createLorebookEntrySchema } from "../../packages/shared/src/schemas/lorebook.schema.js";
import type { LorebookEntry } from "../../packages/shared/src/types/lorebook.js";
import { errorHandler } from "../../packages/server/src/middleware/error-handler.js";
import { gameRoutes } from "../../packages/server/src/routes/game.routes.js";
import { processLorebooks } from "../../packages/server/src/services/lorebook/index.js";
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

/** Unbound and non-global unless asked otherwise: such a book reaches the call ONLY
 *  as a forced selection, so nothing here can be credited to ordinary scope-based
 *  activation. Omitting tokenBudget leaves the book on the schema's own 2,048-token
 *  default, which is what an ordinary player's book actually carries. */
async function createBook(
  name: string,
  options: { tokenBudget?: number; isGlobal?: boolean; recursiveScanning?: boolean } = {},
) {
  const book = await lorebooks.create({
    name,
    ...(options.tokenBudget === undefined ? {} : { tokenBudget: options.tokenBudget }),
    isGlobal: options.isGlobal ?? false,
    recursiveScanning: options.recursiveScanning ?? false,
  } as Parameters<typeof lorebooks.create>[0]);
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
    const book = await createBook("Kanto", { tokenBudget: 4_000 });
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
    const book = await createBook("Johto", { tokenBudget: 8_000 });
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
    const book = await createBook("Hoenn", { tokenBudget: 4_000 });
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

  // ── 5. EXACT SELECTION: the ticked entries, and nothing riding along with them ──
  // A GLOBAL lorebook is in scope for every chat in the product, and a constant
  // entry needs no messages at all to activate — so the ordinary scan would hand
  // this call content the player never ticked, on the strength of one tick
  // somewhere else. That is wrong here in a way it is not wrong on a chat turn:
  // this route writes a world from a deliberate selection, and the picker's own
  // readout reconciles against the count it gets back.
  {
    const ambient = await createBook("Ambient globals", { isGlobal: true });
    const unticked = await lorebooks.createEntry({
      lorebookId: ambient.id,
      name: "Never picked",
      content: loreContent("UNTICKEDMARK", 400),
      constant: true,
    } as Parameters<typeof lorebooks.createEntry>[0]);
    const pickedFrom = await createBook("Sinnoh", { tokenBudget: 4_000 });
    const picked = await lorebooks.createEntry({
      lorebookId: pickedFrom.id,
      name: "Twinleaf",
      content: loreContent("PICKEDMARK", 400),
    } as Parameters<typeof lorebooks.createEntry>[0]);
    assert.ok(unticked && picked);

    const chat = await createExperienceChat("exact selection");
    upstreamBodies = [];
    const res = await post(chat.id, { ...BASE_BODY, lorebookEntryIds: [picked.id] });
    assert.equal(res.statusCode, 200, res.body);

    const prompt = systemPromptOf();
    assert.ok(prompt.includes("PICKEDMARK"), "The entry the player ticked arrives");
    assert.equal(
      prompt.includes("UNTICKEDMARK"),
      false,
      "A global book's constant entry must not ride in on somebody else's tick — the selection is exact, not a floor",
    );
    assert.equal(
      res.json().lorebook.includedEntries,
      1,
      "...so the count the picker reconciles against is the number of entries the player actually ticked",
    );

    // The other half of the contract: this is scoped to a caller that asked for
    // it. Every ordinary lorebook consumer still gets global constants, which is
    // the whole point of marking a book global.
    const ambientScan = await processLorebooks(db, [], null, {
      chatId: chat.id,
      characterIds: [],
      personaId: null,
    });
    assert.ok(
      ambientScan.activatedEntryIds.includes(unticked.id),
      "A global constant still activates for every caller that did not ask for an exact selection",
    );

    // ...and the case that actually distinguishes the two, which the line above
    // does not: forced ids PRESENT and the ordinary scan still expected to run.
    // /setup, the spatial projection, chats.routes, generate.routes, dry-run and
    // marker-expander all pass forcedEntryIds for a location's own attached lore
    // while still wanting the turn's ambient context. Deriving forcedEntriesOnly
    // from "forcedEntryIds is non-empty" would strip that from every one of them.
    const forcedIdsWithoutExactSelection = await processLorebooks(db, [], null, {
      chatId: chat.id,
      characterIds: [],
      personaId: null,
      forcedEntryIds: [picked.id],
    });
    assert.ok(
      forcedIdsWithoutExactSelection.activatedEntryIds.includes(picked.id),
      "A forced id still arrives for an ordinary caller",
    );
    assert.ok(
      forcedIdsWithoutExactSelection.activatedEntryIds.includes(unticked.id),
      "...and the ambient global comes with it — forcedEntriesOnly is an explicit opt-in, never implied by passing forced ids",
    );

    // Suppressing the ordinary scan is not by itself enough to keep the ambient
    // book out of the POOL, and the pool is scanned a second time whenever the
    // call lands on the recursive entry point — which it does as soon as a picked
    // entry's own book has recursiveScanning switched on. So the entry list has to
    // be suppressed as well as the scan: same tick, same absence, recursive book.
    const recursiveBook = await createBook("Sinnoh Underground", { tokenBudget: 4_000, recursiveScanning: true });
    const pickedFromRecursive = await lorebooks.createEntry({
      lorebookId: recursiveBook.id,
      name: "Oreburgh",
      content: loreContent("RECURSIVEPICKMARK", 400),
    } as Parameters<typeof lorebooks.createEntry>[0]);
    assert.ok(pickedFromRecursive);

    const recursiveChat = await createExperienceChat("exact selection, recursive book");
    upstreamBodies = [];
    const recursiveRes = await post(recursiveChat.id, { ...BASE_BODY, lorebookEntryIds: [pickedFromRecursive.id] });
    assert.equal(recursiveRes.statusCode, 200, recursiveRes.body);
    const recursivePrompt = systemPromptOf();
    assert.ok(
      recursivePrompt.includes("RECURSIVEPICKMARK"),
      "The entry the player ticked arrives from a recursive book too",
    );
    assert.equal(
      recursivePrompt.includes("UNTICKEDMARK"),
      false,
      "Recursion re-scans the entry pool, so the pool itself must hold only the selection — not just the first scan over it",
    );
    assert.equal(recursiveRes.json().lorebook.includedEntries, 1);
  }

  // ── 6. The ROUTE supplies the game triggers, not ScanOptions' ["chat"] default ──
  // Part 1 pins the gate itself; this pins the caller. Without the route's own
  // generationTriggers the entry below is refused, the world never hears of the
  // place, and nothing anywhere says why.
  {
    const book = await createBook("Unova", { tokenBudget: 4_000 });
    const setupOnly = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Nuvema (setup only)",
      content: loreContent("TRIGGERMARK", 400),
      generationTriggerFilterMode: "include",
      generationTriggerFilters: ["game_setup"],
    } as Parameters<typeof lorebooks.createEntry>[0]);
    assert.ok(setupOnly);

    const chat = await createExperienceChat("generation triggers");
    upstreamBodies = [];
    const res = await post(chat.id, { ...BASE_BODY, lorebookEntryIds: [setupOnly.id] });
    assert.equal(res.statusCode, 200, res.body);
    assert.ok(
      systemPromptOf().includes("TRIGGERMARK"),
      "The route must pass the game generation triggers explicitly — the ['chat'] default would refuse a game_setup entry silently",
    );
    assert.equal(res.json().lorebook.includedEntries, 1);
  }

  // ── 7. The second wall: the per-book budget, which the route cannot move ──
  // This book carries the schema's own 2,048-token default because its owner never
  // changed it, which is the ordinary case. The route's 3,000-token override gets
  // all eight entries past the FIRST wall (8 × 350 = 2,800); the per-book budget
  // then takes five and reports three, naming itself as the cause. This is the case
  // the D-12 comment must not promise away: the override raises the location wall
  // and nothing else.
  {
    const book = await createBook("Default-budget book");
    const ids: string[] = [];
    for (let index = 0; index < 8; index += 1) {
      const entry = await lorebooks.createEntry({
        lorebookId: book.id,
        name: `Ward ${index}`,
        content: loreContent(`WALLMARK${index}`, 1_400),
        order: 100 + index,
      } as Parameters<typeof lorebooks.createEntry>[0]);
      assert.ok(entry);
      ids.push(entry.id);
    }

    const chat = await createExperienceChat("per-book wall");
    upstreamBodies = [];
    const res = await post(chat.id, { ...BASE_BODY, lorebookEntryIds: ids });
    assert.equal(res.statusCode, 200, res.body);

    const prompt = systemPromptOf();
    assert.deepEqual(
      [...Array(8).keys()].filter((index) => prompt.includes(`WALLMARK${index}`)),
      [0, 1, 2, 3, 4],
      "Inside a default book the per-book 2,048 binds below the raised location budget: 5 of 8, not 8 of 8",
    );
    assert.equal(res.json().lorebook.includedEntries, 5);

    const skipped = res.json().lorebook.skippedEntries as Array<{ name: string; blockedBy: string }>;
    assert.deepEqual(
      skipped.map((entry) => entry.name).sort(),
      ["Ward 5", "Ward 6", "Ward 7"],
      "...and the three that did not fit are named",
    );
    for (const entry of skipped) {
      assert.equal(
        entry.blockedBy,
        "lorebook",
        "The response names the wall that actually bound — the book's own budget, not the location one",
      );
    }
  }

  // ── 8. A reported drop is a real drop, and no global book can undo it ──
  // Ten CONSTANT entries of 400 tokens each against the 3,000-token location wall,
  // with the book's own budget raised out of the way so only that wall can bind.
  //
  // Two failures share this shape. Emptying the ordinary scan's INPUTS is not the
  // same as skipping the scan: allEntries is the selection itself here, a constant
  // needs no messages to activate, so a picked constant the location budget had
  // just dropped came back through the ordinary scan one line later — while its
  // skip record stayed on the response. Included plus skipped came to thirteen for
  // a ten-id selection, which is exactly the disagreement the exact-selection rule
  // exists to remove. Repeat with recursion enabled on the selected book itself:
  // neither that setting nor an ambient recursive book may re-scan an exact
  // selection and readmit its excluded constants.
  for (const recursiveScanning of [false, true]) {
    await createBook("Ambient recursive globals", { isGlobal: true, recursiveScanning: true });
    const book = await createBook("Kalos", { tokenBudget: 8_000, recursiveScanning });
    const ids: string[] = [];
    for (let index = 0; index < 10; index += 1) {
      const entry = await lorebooks.createEntry({
        lorebookId: book.id,
        name: `Vault ${index}`,
        content: loreContent(`HOLDMARK${index}`, 1_600),
        order: 100 + index,
        constant: true,
      } as Parameters<typeof lorebooks.createEntry>[0]);
      assert.ok(entry);
      ids.push(entry.id);
    }

    const chat = await createExperienceChat(`constant drops hold (recursive=${recursiveScanning})`);
    upstreamBodies = [];
    const res = await post(chat.id, { ...BASE_BODY, lorebookEntryIds: ids });
    assert.equal(res.statusCode, 200, res.body);

    const prompt = systemPromptOf();
    assert.deepEqual(
      [...Array(10).keys()].filter((index) => prompt.includes(`HOLDMARK${index}`)),
      [0, 1, 2, 3, 4, 5, 6],
      "Seven 400-token constants fit the 3,000-token wall and the other three stay out — a constant is not exempt from the budget it overran",
    );

    const skipped = res.json().lorebook.skippedEntries as Array<{ name: string; blockedBy: string }>;
    assert.deepEqual(skipped.map((entry) => entry.name).sort(), ["Vault 7", "Vault 8", "Vault 9"]);
    for (const entry of skipped) assert.equal(entry.blockedBy, "location");
    for (const index of [7, 8, 9]) {
      assert.equal(
        prompt.includes(`HOLDMARK${index}`),
        false,
        `Vault ${index} is reported as set aside, so it must actually be absent — the response is not allowed to name an entry it sent`,
      );
    }
    assert.equal(res.json().lorebook.includedEntries, 7);
    assert.equal(
      (res.json().lorebook.includedEntries as number) + skipped.length,
      ids.length,
      "Included plus set aside is the selection itself: the picker can reconcile against either number",
    );
  }

  // ── 9. The wire count ceiling is a clean refusal, not a silent truncation ──
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

  // ── 10. PROTOCOL: a selection is always answered, even when nothing survives ──
  // The key's presence is the only thing that separates an Engine which considered
  // the picks and kept none from an Engine which has never heard of
  // lorebookEntryIds — emitted only when something survived, those two are the same
  // bytes on the wire. The package half reads that shape as "every id was refused"
  // and writes a line into the seal that outlives the session, so an older Engine
  // would hand every lore-using player a permanent false accusation.
  //
  // Nothing survives here, through two gates of the kind that leave NO skip record:
  // a disabled entry is refused by storage and an unknown id resolves to nothing,
  // both long before any budget runs. That is precisely the case a skipped-count
  // test cannot see, and why the KEY carries the signal rather than its contents.
  {
    const book = await createBook("Johto", { tokenBudget: 4_000 });
    const switchedOff = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Ecruteak (switched off)",
      content: loreContent("REFUSEDMARK", 400),
      enabled: false,
    } as Parameters<typeof lorebooks.createEntry>[0]);
    assert.ok(switchedOff);

    const chat = await createExperienceChat("all refused");
    upstreamBodies = [];
    const res = await post(chat.id, {
      ...BASE_BODY,
      lorebookEntryIds: [switchedOff.id, "deleted-between-picking-and-launching"],
    });
    assert.equal(res.statusCode, 200, res.body);

    assert.equal(systemPromptOf(), INSTRUCTIONS, "Nothing survived, so nothing is appended to the instructions");
    assert.equal(
      Object.prototype.hasOwnProperty.call(res.json(), "lorebook"),
      true,
      "A non-empty selection is ALWAYS answered with the lorebook key — an all-refused reply must not be the same bytes as a reply from an Engine that predates the feature",
    );
    assert.equal(res.json().lorebook.includedEntries, 0);
    assert.deepEqual(
      res.json().lorebook.skippedEntries,
      [],
      "Gates ahead of the budget leave no skip record, so the count is the contract and the array is only ever a diagnostic",
    );

    // Same chat, one request later, with no selection: presence tracks the REQUEST,
    // not the chat and not whether the feature is compiled in.
    const none = await post(chat.id, BASE_BODY);
    assert.equal(none.statusCode, 200, none.body);
    assert.equal(
      Object.prototype.hasOwnProperty.call(none.json(), "lorebook"),
      false,
      "No selection still means no key — absence stays reserved for 'this Engine never answered a selection'",
    );
  }

  // ── 11. ...and it reports the refusals the gates did record ──
  // Two entries, each larger on its own than the 3,000-token location wall, with the
  // book's own budget raised out of the way so only that wall can bind. Included is
  // 0 and both are named: the shape a package reads for its omitted-entry line is
  // the same at zero included as it is at seven, so nothing about the empty case is
  // special-cased on the way out.
  {
    const book = await createBook("Orre", { tokenBudget: 20_000 });
    const ids: string[] = [];
    for (let index = 0; index < 2; index += 1) {
      const entry = await lorebooks.createEntry({
        lorebookId: book.id,
        name: `Colosseum ${index}`,
        content: `OVERMARK${index} ${"granite terraces above the drowned quarter. ".repeat(400)}`.slice(0, 16_000),
        order: 100 + index,
      } as Parameters<typeof lorebooks.createEntry>[0]);
      assert.ok(entry);
      ids.push(entry.id);
    }

    const chat = await createExperienceChat("all refused by budget");
    upstreamBodies = [];
    const res = await post(chat.id, { ...BASE_BODY, lorebookEntryIds: ids });
    assert.equal(res.statusCode, 200, res.body);

    assert.equal(
      systemPromptOf(),
      INSTRUCTIONS,
      "A 4,000-token entry does not fit a 3,000-token wall on its own, and neither does the second",
    );
    assert.equal(res.json().lorebook.includedEntries, 0);
    const skipped = res.json().lorebook.skippedEntries as Array<{ name: string; blockedBy: string }>;
    assert.deepEqual(
      skipped.map((entry) => entry.name).sort(),
      ["Colosseum 0", "Colosseum 1"],
      "An empty inclusion still names every entry the budget turned away",
    );
    for (const entry of skipped) assert.equal(entry.blockedBy, "location");
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
