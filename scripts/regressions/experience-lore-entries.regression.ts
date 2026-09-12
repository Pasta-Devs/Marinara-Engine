// Real-route proof for exact world-generation lore selections. Automatic token/count
// budgets must not discard selected entries; scope/disabled gates still apply.
// Oversized initial and repair prompts fail explicitly before their provider call.
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
let providerContent = VALID_BRIEF;

const mockProvider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  upstreamBodies.push(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ choices: [{ message: { content: providerContent }, finish_reason: "stop" }] }));
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

  // #5943: the shared location budget binds ordinary and recursive scans too.
  for (const recursiveScanning of [false, true]) {
    const book = await createBook("Location budget", { tokenBudget: 4000, recursiveScanning });
    const blocked = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Over budget",
      constant: true,
      content: loreContent("LOCATIONBLOCK", 1600),
    } as Parameters<typeof lorebooks.createEntry>[0]);
    const ambient = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Ambient",
      constant: true,
      content: "recursion-key",
      preventRecursion: false,
    } as Parameters<typeof lorebooks.createEntry>[0]);
    const child = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Recursive child",
      keys: ["recursion-key"],
      content: "Child lore",
    } as Parameters<typeof lorebooks.createEntry>[0]);
    assert.ok(blocked && ambient && child);
    const result = await processLorebooks(db, [], null, {
      activeLorebookIds: [book.id],
      forcedEntryIds: [blocked.id],
      currentLocationTokenBudget: 100,
    });
    assert.equal(
      result.activatedEntryIds.includes(blocked.id),
      false,
      "A dropped forced constant must not re-enter through a later scan",
    );
    assert.equal(result.activatedEntryIds.includes(ambient.id), true, "Unrelated ambient lore still activates");
    assert.equal(
      result.activatedEntryIds.includes(child.id),
      recursiveScanning,
      "Ordinary recursive activation remains available",
    );
    assert.equal(result.budgetSkippedEntries.filter((entry) => entry.id === blocked.id).length, 1);
    assert.ok(
      result.budgetSkippedEntries.every((entry) => !result.activatedEntryIds.includes(entry.id)),
      "Skip diagnostics must describe entries actually omitted",
    );
  }

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

  // Exact selections include complete entries, including explicitly picked outlets.
  {
    const book = await createBook("Kanto", { tokenBudget: 4_000 });
    const ids: string[] = [];
    for (let index = 0; index < 8; index += 1) {
      const entry = await lorebooks.createEntry({
        lorebookId: book.id,
        name: `Route ${index}`,
        content: loreContent(`LOREMARK${index}`, 1_400),
        ...(index === 7 ? { position: 7, outletName: "world" } : {}),
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
      assert.ok(prompt.includes(`LOREMARK${index}`), `Selected entry ${index} must reach the model`);
    }
    assert.ok(prompt.startsWith(INSTRUCTIONS), "The lore is appended to the package's instructions, not spliced in");
    assert.deepEqual(res.json().lorebook.skippedEntries, [], "A selection inside the budget skips nothing");
    assert.equal(res.json().lorebook.includedEntries, 8);
  }

  // Explicit picks bypass the old location budget and retain whole entries.
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
      [...Array(10).keys()],
      "Every explicitly selected entry survives regardless of automatic selection order",
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
    assert.deepEqual(skipped, []);
    assert.equal(res.json().lorebook.includedEntries, 10);
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

  // A book's default automatic budget does not shrink a player's selection.
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
      [...Array(8).keys()],
      "The book budget only governs automatic activation",
    );
    assert.equal(res.json().lorebook.includedEntries, 8);
    assert.deepEqual(res.json().lorebook.skippedEntries, []);
    const automatic = await processLorebooks(db, [], null, {
      forcedEntryIds: ids,
      activeLorebookIds: [book.id],
      currentLocationTokenBudget: 0,
    });
    assert.equal(
      automatic.activatedEntryIds.filter((id) => ids.includes(id)).length,
      5,
      "Ordinary location callers retain the book's automatic token budget",
    );
  }

  // Exact selections keep every selected constant without inviting ambient recursion.
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
      [...Array(10).keys()],
      "Every selected constant is preserved",
    );

    const skipped = res.json().lorebook.skippedEntries as Array<{ name: string; blockedBy: string }>;
    assert.deepEqual(skipped, []);
    assert.equal(res.json().lorebook.includedEntries, 10);
    assert.equal(
      (res.json().lorebook.includedEntries as number) + skipped.length,
      ids.length,
      "Included plus set aside is the selection itself: the picker can reconcile against either number",
    );
  }

  // More than 100 entries from one default-budget book reach the model.
  {
    const book = await createBook("Large selection");
    const ids: string[] = [];
    for (let index = 0; index <= LIMITS.MAX_LOREBOOK_ENTRIES; index++) {
      const entry = await lorebooks.createEntry({
        lorebookId: book.id,
        name: `Place ${index}`,
        content: `COUNTMARK${index}.`,
      } as Parameters<typeof lorebooks.createEntry>[0]);
      assert.ok(entry);
      ids.push(entry.id);
    }
    const chat = await createExperienceChat("Uncapped count");
    upstreamBodies = [];
    const response = await post(chat.id, { ...BASE_BODY, lorebookEntryIds: ids });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().lorebook.includedEntries, ids.length);
    assert.ok(systemPromptOf().includes(`COUNTMARK${LIMITS.MAX_LOREBOOK_ENTRIES}.`));

    const hugeContent = "Ancient history. ".repeat(50000);
    const huge = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Ancient world",
      content: hugeContent,
    } as Parameters<typeof lorebooks.createEntry>[0]);
    assert.ok(huge);
    await connections.update(conn.id, { maxContext: 500000 });
    upstreamBodies = [];
    const large = await post(chat.id, { ...BASE_BODY, lorebookEntryIds: [huge.id] });
    assert.equal(large.statusCode, 200, large.body);
    assert.ok(
      systemPromptOf().includes(hugeContent.trim()),
      `A roughly 200k-token selection must arrive whole: input=${hugeContent.length}, prompt=${systemPromptOf().length}, included=${large.json().lorebook.includedEntries}, tail=${systemPromptOf().slice(-60)}`,
    );

    await connections.update(conn.id, { maxContext: 1024 });
    for (const lorebookEntryIds of [undefined, [huge.id]]) {
      upstreamBodies = [];
      const rejected = await post(chat.id, {
        ...BASE_BODY,
        instructions: "World instructions. ".repeat(600),
        lorebookEntryIds,
      });
      assert.equal(rejected.statusCode, 422, rejected.body);
      assert.equal(rejected.json().code, "context_limit");
      assert.equal(rejected.json().truncated, false);
      assert.equal(upstreamBodies.length, 0, "Oversized selections and instructions must never reach the provider");
      if (lorebookEntryIds) assert.match(rejected.json().error, /lorebook entries/);
    }
    upstreamBodies = [];
    providerContent = "invalid response ".repeat(300);
    const repair = await post(chat.id, BASE_BODY);
    assert.equal(repair.statusCode, 422, repair.body);
    assert.equal(repair.json().code, "context_limit");
    assert.equal(upstreamBodies.length, 1, "The repair's added history must be checked before a second provider call");
    providerContent = VALID_BRIEF;
    await connections.update(conn.id, { maxContext: 32768 });
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

  // Whole entries above the former location ceiling are included together.
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

    assert.ok(systemPromptOf().includes("OVERMARK0"));
    assert.ok(systemPromptOf().includes("OVERMARK1"));
    assert.equal(res.json().lorebook.includedEntries, 2);
    assert.deepEqual(res.json().lorebook.skippedEntries, []);
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
