import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";

// Covers the lorebook test tool: the real scanner, recursion, blocked reasons, and chat input.

const dataDir = mkdtempSync(join(tmpdir(), "marinara-lorebook-test-scan-"));
const previous = {
  DATA_DIR: process.env.DATA_DIR,
  FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR,
  MARINARA_FILE_STORAGE_DIR: process.env.MARINARA_FILE_STORAGE_DIR,
};
type Response = { statusCode: number; body: string; json(): any };
let app: {
  close(): Promise<void>;
  inject(options: Record<string, unknown>): Promise<Response>;
} | null = null;
let db: Awaited<
  ReturnType<typeof import("../../packages/server/src/db/file-backed-store.js").createFileNativeDB>
> | null = null;

try {
  const fileStorageDir = join(dataDir, "file-storage");
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = fileStorageDir;
  process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;

  // A minimal app with just the lorebook routes keeps this well inside the time budget.
  const [{ createFileNativeDB }, { lorebooksRoutes }, { createCharactersStorage }, { createChatsStorage }] =
    await Promise.all([
      import("../../packages/server/src/db/file-backed-store.js"),
      import("../../packages/server/src/routes/lorebooks.routes.js"),
      import("../../packages/server/src/services/storage/characters.storage.js"),
      import("../../packages/server/src/services/storage/chats.storage.js"),
    ]);
  db = await createFileNativeDB();
  const Fastify = createRequire(new URL("../../packages/server/package.json", import.meta.url))("fastify");
  // Same general body limit as the real app, so the route's own cap is what is tested.
  const server = Fastify({ bodyLimit: 256 * 1024 * 1024 });
  server.decorate("db", db);
  await server.register(lorebooksRoutes, { prefix: "/api/lorebooks" });
  app = server;
  const request = async (method: string, url: string, payload?: unknown) => {
    const response = await app!.inject({ method, url, payload });
    assert.ok(response.statusCode < 400, `${method} ${url} -> ${response.statusCode}`);
    return response.body ? response.json() : null;
  };

  const book = await request("POST", "/api/lorebooks", {
    name: "Test World",
    recursiveScanning: true,
    maxRecursionDepth: 2,
  });
  const entry = (name: string, extra: Record<string, unknown>) =>
    request("POST", `/api/lorebooks/${book.id}/entries`, { lorebookId: book.id, name, ...extra });
  const city = await entry("Valdenmoor", {
    keys: ["Valdenmoor"],
    content: "The capital, ruled by Queen Sybel.",
    preventRecursion: false,
  });
  const queen = await entry("Queen Sybel", { keys: ["Sybel"], content: "A silver-haired monarch." });
  const constant = await entry("Rules", { constant: true, content: "World rules." });
  const gated = await entry("Harbor", {
    keys: ["harbor"],
    selective: true,
    secondaryKeys: ["storm"],
    selectiveLogic: "and",
    content: "Docks.",
  });
  const filtered = await entry("Elf lore", {
    keys: ["elves"],
    characterTagFilterMode: "include",
    characterTagFilters: ["elf"],
    content: "Elves.",
  });
  const unrelated = await entry("Moon", { keys: ["moon"], content: "Pale." });

  // ── Test tool ──
  const result = await request("POST", `/api/lorebooks/${book.id}/test`, {
    text: "We rode to Valdenmoor by the harbor. Rumours say elves live nearby.",
  });
  const activatedById = new Map(result.activated.map((item: { entryId: string }) => [item.entryId, item]));
  assert.equal(result.recursive, true);
  assert.deepEqual((activatedById.get(city.id) as any).matchedKeys, ["Valdenmoor"], "reports the key that matched");
  assert.deepEqual((activatedById.get(constant.id) as any).matchedKeys, ["[constant]"]);
  const recursive = activatedById.get(queen.id) as any;
  assert.ok(recursive, "recursion follows activated content like generation does");
  assert.deepEqual(recursive.activationSources, ["recursive"]);
  assert.deepEqual(recursive.triggeredBy, [city.id], "names the entry whose content triggered it");
  assert.ok(!activatedById.has(unrelated.id));
  const blockedById = new Map(result.blocked.map((item: { entryId: string; reason: string }) => [item.entryId, item]));
  assert.equal((blockedById.get(gated.id) as any)?.reason, "secondary_keys");
  assert.equal((blockedById.get(filtered.id) as any)?.reason, "filters");

  const empty = await request("POST", `/api/lorebooks/${book.id}/test`, { text: "" });
  assert.deepEqual(
    empty.activated.map((item: { entryId: string }) => item.entryId),
    [constant.id],
    "empty text still shows constant entries",
  );
  // Blocked reasons use the entry's own scan depth: a key only in older messages is not "held back".
  const shallow = await entry("Old harbor", {
    keys: ["lighthouse"],
    selective: true,
    secondaryKeys: ["fog"],
    selectiveLogic: "and",
    scanDepth: 1,
    content: "A lighthouse.",
  });
  const { runLorebookTestScan } = await import("../../packages/server/src/services/lorebook/test-scan.js");
  const shallowRow = shallow;
  assert.equal(shallowRow.scanDepth, 1);
  const depthResult = runLorebookTestScan({
    lorebook: { id: book.id, scanDepth: null, recursiveScanning: false, maxRecursionDepth: 1 } as never,
    entries: [shallowRow],
    messages: [
      { role: "user", content: "The lighthouse stood dark." },
      { role: "assistant", content: "Nothing else happened." },
    ],
  });
  assert.deepEqual(depthResult.blocked, [], "a key outside the entry's own scan window is not reported as blocked");
  const depthHit = runLorebookTestScan({
    lorebook: { id: book.id, scanDepth: null, recursiveScanning: false, maxRecursionDepth: 1 } as never,
    entries: [shallowRow],
    messages: [{ role: "user", content: "The lighthouse stood dark." }],
  });
  assert.equal(depthHit.blocked[0]?.reason, "secondary_keys");

  // The route caps request size well below the general upload limit.
  const oversized = await app.inject({
    method: "POST",
    url: `/api/lorebooks/${book.id}/test`,
    payload: { text: "x".repeat(2 * 1024 * 1024) },
  });
  assert.equal(oversized.statusCode, 413, "oversized test text is rejected");

  const missingChat = await app.inject({
    method: "POST",
    url: `/api/lorebooks/${book.id}/test`,
    payload: { chatId: "no-such-chat" },
  });
  assert.equal(missingChat.statusCode, 404);

  // Picking a chat scans its messages and uses its cast for character-tag gates.
  const elf = await createCharactersStorage(db).create({
    name: "Ilyra",
    description: "An elf.",
    tags: ["Elf"],
  } as never);
  const chats = createChatsStorage(db);
  const chat = await chats.create({ name: "Trip", mode: "roleplay", characterIds: [elf!.id] } as never);
  await chats.createMessage({ chatId: chat!.id, role: "user", characterId: null, content: "Do elves visit the moon?" });
  const chatResult = await request("POST", `/api/lorebooks/${book.id}/test`, { chatId: chat!.id });
  const chatIds = chatResult.activated.map((item: { entryId: string }) => item.entryId);
  assert.ok(chatIds.includes(filtered.id), "the chat's character tags open the tag gate");
  assert.ok(chatIds.includes(unrelated.id));
  assert.ok(chatResult.scannedMessages >= 1);

  // L4: the Mari-facing `lorebook.testScan` app_data action wraps the same scanner for a
  // secondary-key block and a "no key matched" absent entry, and never carries chat text.
  const { MariDbService } = await import("../../packages/server/src/services/mari-db/mari-db.service.js");
  const mariDb = new MariDbService(db);
  const scanChat = await chats.create({ name: "Harbor trip", mode: "roleplay", characterIds: [] } as never);
  await chats.createMessage({
    chatId: scanChat!.id,
    role: "user",
    characterId: null,
    content: "We rode to Valdenmoor by the harbor.",
  });
  const blockedScan = await mariDb.executeAction({
    action: "lorebook.testScan",
    lorebookId: book.id,
    chatId: scanChat!.id,
    entryId: gated.id,
    sessionId: "test",
  } as never);
  assert.equal(blockedScan.ok, true);
  assert.equal((blockedScan.output as any).status, "blocked");
  assert.equal((blockedScan.output as any).reason, "secondary_keys");
  assert.match((blockedScan.output as any).fix, /secondaryKeys/u, "a blocked entry carries its fix for Mari");
  assert.deepEqual((blockedScan.output as any).matchedKeys, ["harbor"]);
  assert.ok(
    !JSON.stringify(blockedScan.output).includes("We rode to Valdenmoor"),
    "the scanned message text never leaves this action",
  );

  const noMatchScan = await mariDb.executeAction({
    action: "lorebook.testScan",
    lorebookId: book.id,
    chatId: scanChat!.id,
    entryId: unrelated.id,
    sessionId: "test",
  } as never);
  assert.equal(noMatchScan.ok, true);
  assert.equal((noMatchScan.output as any).status, "no_match");
  assert.equal((noMatchScan.output as any).reason, "no key matched in the scanned messages");

  const fullScan = await mariDb.executeAction({
    action: "lorebook.testScan",
    lorebookId: book.id,
    chatId: scanChat!.id,
    sessionId: "test",
  } as never);
  assert.equal(fullScan.ok, true);
  assert.ok(Array.isArray((fullScan.output as any).activated));
  assert.ok(Array.isArray((fullScan.output as any).blocked));

  // F2: an entry the real scanner would activate, but the last real generation's token budget
  // actually left out, must be reported as blocked (reason "budget"), not activated — otherwise
  // Mari tells the user an entry fired when it never reached the prompt.
  const nightBell = await entry("Night bell", { keys: ["bell"], content: "A bell that tolls at midnight." });
  const saltmarsh = await entry("Saltmarsh Pact", { keys: ["pact"], content: "An old treaty." });
  const budgetChat = await chats.create({ name: "Harbor intrigue", mode: "roleplay", characterIds: [] } as never);
  await chats.createMessage({
    chatId: budgetChat!.id,
    role: "user",
    characterId: null,
    content: "The bell tolled as she read the pact aloud.",
  });
  // The real generation's saved scan: "Night bell" matched but was skipped for budget; "Saltmarsh
  // Pact" was never skipped, so it should stay a normal activation.
  await chats.createMessage({
    chatId: budgetChat!.id,
    role: "assistant",
    characterId: null,
    content: "Understood.",
    extra: {
      lorebookScan: {
        budgetSkippedEntries: [
          {
            id: nightBell.id,
            lorebookId: book.id,
            name: "Night bell",
            estimatedTokens: 420,
            lorebookBudget: 300,
            lorebookUsedTokens: 300,
            blockedBy: "lorebook",
          },
        ],
      },
    },
  } as never);
  const budgetScan = await mariDb.executeAction({
    action: "lorebook.testScan",
    lorebookId: book.id,
    chatId: budgetChat!.id,
    sessionId: "test",
  } as never);
  assert.equal(budgetScan.ok, true);
  const budgetOutput = budgetScan.output as { activated: Array<{ entryId: string }>; blocked: Array<any> };
  assert.ok(
    !budgetOutput.activated.some((item) => item.entryId === nightBell.id),
    "a budget-skipped entry must not be reported as activated",
  );
  const blockedBell = budgetOutput.blocked.find((item) => item.entryId === nightBell.id);
  assert.ok(blockedBell, "the budget-skipped entry must appear in blocked");
  assert.equal(blockedBell.reason, "budget");
  assert.match(blockedBell.fix, /Token Budget/u, "the budget fix names the setting");
  assert.equal(blockedBell.estimatedTokens, 420);
  assert.equal(blockedBell.lorebookBudget, 300);
  assert.equal(blockedBell.lorebookUsedTokens, 300);
  // Negative case: an entry that matched with no budget conflict stays activated as before.
  assert.ok(
    budgetOutput.activated.some((item) => item.entryId === saltmarsh.id),
    "an entry with no budget conflict stays activated",
  );
  assert.ok(
    !budgetOutput.blocked.some((item) => item.entryId === saltmarsh.id),
    "an entry with no budget conflict is not reported as blocked",
  );
} finally {
  await app?.close();
  await db?._fileStore.close();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}

console.log("lorebook-test-scan regression passed");
