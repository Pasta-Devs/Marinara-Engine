import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

// Updating continuity (#8820): a constant summary over the share is cut in half, in requests that hold only the
// combine prompt and the text to shorten. Private sections are shortened one set of readers at a time.
const directory = mkdtempSync(join(tmpdir(), "marinara-compaction-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";

const COMBINE_PROMPT = "MERGE_NOTES_PROMPT: merge these notes into one, oldest first.";
type Request = { messages: Array<{ role: string; content: string }>; maxTokens?: number };
/** Every request that carries the combine prompt, as the Helper got it. */
const requests: Request[] = [];
/** Each distinct word once, in order: a reply about half as long, or less. */
const shorten = (text: string) => [...new Set(text.split(/\s+/u).filter(Boolean))].join(" ");
const shortening = (text: string) => ({ content: shorten(text) });
let answer: (text: string) => { content: string; finishReason?: string } = shortening;
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const messages: Request["messages"] = body.messages ?? [];
  let reply = { content: JSON.stringify({ ends: [], starts: [] }), finishReason: "stop" };
  if (messages.some((message) => message.content.includes(COMBINE_PROMPT))) {
    requests.push({ messages, maxTokens: body.max_tokens ?? body.max_completion_tokens });
    reply = { finishReason: "stop", ...answer(messages.at(-1)!.content) };
  }
  response.setHeader("content-type", "application/json");
  response.end(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content: reply.content }, finish_reason: reply.finishReason }],
    }),
  );
});

const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { CHAT_SUMMARY_PROMPT_SETTINGS_KEY, characterDataSchema, createChatSummaryEntry, estimateChatSummaryTokens } =
  await import("../../packages/shared/src/index.js");
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);
type Entry = ReturnType<typeof createChatSummaryEntry>;
const half = (text: string) => Math.floor(estimateChatSummaryTokens(text) / 2);
const sizeLine = (text: string) =>
  `Shorten it to about ${half(text)} tokens, about half its current length. Return only the shortened summary.`;
// The output reserve is Chat Summary's 4,096 default, raised to 8,196; the cap is the text's size and 1,024 more.
const cap = (text: string) => Math.min(8196, 2 * half(text) + 1024);
/** Every `{{#if …}}` opening tag, once. */
const conditions = (texts: string[]) => [...new Set(texts.flatMap((text) => text.match(/\{\{#if [^{}]*\}\}/gu) ?? []))];

try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert(address && typeof address === "object");
  await createAppSettingsStorage(db).set(
    CHAT_SUMMARY_PROMPT_SETTINGS_KEY,
    JSON.stringify({ combinePrompt: COMBINE_PROMPT }),
  );
  const connection = await createConnectionsStorage(db).create({
    name: "Compaction fixture",
    provider: "custom",
    model: "fixture",
    apiKey: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    maxContext: 65000,
  });
  const [maukie, pantalone] = await Promise.all(
    ["Maukie", "Pantalone"].map((name) => createCharactersStorage(db).create(characterDataSchema.parse({ name }))),
  );
  assert(maukie && pantalone);
  // A chat whose first three messages are archived, with one summary per message.
  const fixture = async (name: string, contents: string[], both = false) => {
    const chat = await chats.create({
      name,
      mode: "roleplay",
      characterIds: both ? [maukie.id, pantalone.id] : [maukie.id],
      connectionId: connection.id,
    });
    assert(chat);
    await chats.createMessagesBatch(chat.id, [
      { role: "user", content: "The first walk." },
      { role: "assistant", characterId: maukie.id, content: "The second walk." },
      { role: "user", content: "The third walk." },
      { role: "user", content: "The current scene.", extra: { isConversationStart: true } },
    ]);
    const messages = await chats.listMessages(chat.id);
    const entries = contents.map((content, index) =>
      createChatSummaryEntry({
        id: `${name}-${index}`,
        content,
        enabled: true,
        origin: "automated",
        sourceMode: "range",
        messageIds: [messages[index]!.id],
        messageCount: 1,
        rangeStartIndex: index + 1,
        rangeEndIndex: index + 1,
      }),
    );
    await chats.patchMetadata(chat.id, {
      enableAgents: false,
      ...(both ? { groupChatMode: "individual" } : {}),
      advancedMemory: {
        enabled: true,
        summaryBudgetTokens: 512,
        sceneCheckInterval: 100,
        ...(both ? { knowledgeStarts: { [maukie.id]: null, [pantalone.id]: null } } : {}),
      },
      summaryEntries: entries,
    });
    return { chat, messages, entries };
  };
  const saved = async (chatId: string) => JSON.parse((await chats.getById(chatId))!.metadata).summaryEntries as Entry[];
  const update = (chatId: string) => memory.checkScenesAfterGeneration(chatId, { blocking: false });
  const view = async (chatId: string, characterId: string) =>
    (
      await memory.prepare({
        chatId,
        messages: await chats.listMessages(chatId),
        audienceCharacterIds: [characterId],
        budgetTokens: 50_000,
        readOnly: true,
      })
    ).chatSummary ?? "";
  // Two summaries one character reads, together over the 358-token share of a 512-token budget.
  const early = "EARLY_WALK remembered detail. ".repeat(50).trim();
  const late = "LATE_WALK remembered detail. ".repeat(50).trim();
  // Three summaries two characters read, each with parts for one or both of them.
  const forBoth = '{{#if char == "Maukie" || "Pantalone"}}';
  const forMaukie = '{{#if char == "Maukie"}}';
  const forPantalone = '{{#if char == "Pantalone"}}';
  const walk = "SHARED_WALK ".repeat(80).trim();
  const secret = "MAUKIE_SECRET ".repeat(60).trim();
  const note = "PANTALONE_NOTE kept the ledger.";
  const later = "SHARED_LATER ".repeat(80).trim();
  const sections = [
    `${forBoth}${walk}{{/if}}${forMaukie}${secret}{{/if}}`,
    `${forPantalone}${note}{{/if}}`,
    `${forBoth}${later}{{/if}}`,
  ];

  await test("(1, 2) a summary over the share is sent alone with the combine prompt and a line asking for half", async () => {
    answer = shortening;
    requests.length = 0;
    const plain = await fixture("plain", [early, late]);
    await update(plain.chat.id);
    assert.equal(requests.length, 1, "one request shortens the summaries");
    const [request] = requests;
    assert.equal(request!.messages.length, 2, "the request is the prompt and the text, nothing else");
    const [system, user] = request!.messages;
    assert.equal(system!.role, "system");
    assert.equal(user!.role, "user");
    assert.equal(user!.content, `${early}\n\n${late}`, "the user message is the summaries, in chat order");
    assert.equal(
      system!.content,
      `${COMBINE_PROMPT}\n\n${sizeLine(user!.content)}`,
      "the user's combine prompt and the size line",
    );
    assert.doesNotMatch(
      system!.content,
      /Summarize the supplied|historical recap|Keep character knowledge|eligible source material|soft target|audience|recollection|memory/iu,
    );
    assert.equal(request!.maxTokens, cap(user!.content), "the reply may be as long as the text and 1,024 tokens more");
    const plainSaved = await saved(plain.chat.id);
    assert.deepEqual(
      plainSaved.filter((entry) => !entry.enabled).map((entry) => entry.id),
      plain.entries.map((entry) => entry.id),
    );
    assert.equal(
      plainSaved.find((entry) => entry.enabled)!.content,
      `{{#if char == "Maukie"}}${shorten(user!.content)}{{/if}}`,
    );
  });

  await test("(3) private sections are halved one set of readers at a time and keep their conditions", async () => {
    // The Helper never sees a condition; each part gets exactly its condition back, the check on who reads what
    // passes, and the result is saved.
    answer = shortening;
    requests.length = 0;
    const sectioned = await fixture("sectioned", sections, true);
    await update(sectioned.chat.id);
    assert.deepEqual(
      requests.map((item) => item.messages[1]!.content),
      [`${walk}\n\n${later}`, secret],
      "one request for the text both read, in chat order, and one for Maukie's; Pantalone's short note is not sent",
    );
    for (const item of requests) {
      assert.equal(item.messages.length, 2);
      assert.equal(item.messages[0]!.content, `${COMBINE_PROMPT}\n\n${sizeLine(item.messages[1]!.content)}`);
      assert.equal(item.maxTokens, cap(item.messages[1]!.content));
    }
    const sectionedSaved = await saved(sectioned.chat.id);
    const combined = sectionedSaved.find((entry) => entry.enabled)!;
    assert.equal(
      combined.content,
      `${forBoth}SHARED_WALK SHARED_LATER{{/if}}\n\n${forMaukie}MAUKIE_SECRET{{/if}}\n\n${forPantalone}${note}{{/if}}`,
    );
    assert.deepEqual(
      conditions([combined.content]).sort(),
      conditions(sections).sort(),
      "every condition is kept byte for byte, and none is added",
    );
    assert.deepEqual(
      sectionedSaved.filter((entry) => !entry.enabled).map((entry) => entry.id),
      sectioned.entries.map((entry) => entry.id),
    );
    const maukieView = await view(sectioned.chat.id, maukie.id);
    assert.match(maukieView, /SHARED_WALK SHARED_LATER[\s\S]*MAUKIE_SECRET/u);
    assert.doesNotMatch(maukieView, /PANTALONE_NOTE/u);
    const pantaloneView = await view(sectioned.chat.id, pantalone.id);
    assert.match(pantaloneView, /SHARED_WALK SHARED_LATER[\s\S]*PANTALONE_NOTE/u);
    assert.doesNotMatch(pantaloneView, /MAUKIE_SECRET/u);
  });

  await test("(4) a reply no shorter, empty or cut off keeps the originals and is not asked again", async () => {
    // That one request is the only one: the update after the next reply, with the same summaries, sends nothing,
    // and no error stops later updates.
    for (const [name, failing] of [
      ["unchanged", (text: string) => ({ content: text })],
      ["empty", () => ({ content: "" })],
      ["cut-off", (text: string) => ({ content: text.slice(0, 200), finishReason: "length" })],
    ] as const) {
      answer = failing;
      requests.length = 0;
      const failed = await fixture(name, [early, late]);
      await update(failed.chat.id);
      await chats.createMessagesBatch(failed.chat.id, [
        { role: "assistant", characterId: maukie.id, content: "The next reply." },
      ]);
      await update(failed.chat.id);
      assert.equal(requests.length, 1, `${name}: one request, and none on the next update`);
      assert.deepEqual(await saved(failed.chat.id), failed.entries, `${name}: the originals stay`);
      const { job } = await memory.status(failed.chat.id);
      assert.equal(job.status, "ready", `${name}: the update finishes`);
      assert.equal(job.error, null);
    }
  });

  await test("(5) a failed reply for one set of readers is one failed attempt, with no smaller groups", async () => {
    // The Helper returns the text both read unchanged: nothing is saved, no smaller groups are tried, and nothing
    // is sent again.
    answer = (text) => ({ content: text.startsWith("SHARED_WALK") ? text : shorten(text) });
    requests.length = 0;
    const unchanged = await fixture("unchanged-set", sections, true);
    await update(unchanged.chat.id);
    await update(unchanged.chat.id);
    assert.equal(requests.length, 1, "the first set's failed reply ends the attempt, and it is not asked again");
    assert.deepEqual(await saved(unchanged.chat.id), unchanged.entries);
  });

  await test("(6) a common phrase the shared part shares with a private part by chance is saved", async () => {
    // The Helper only sees the text both read, so four words in a row it writes that Maukie's part also has
    // ("at the end of") are its own wording, not Maukie's secret.
    const together = "When the night ended, Maukie and Pantalone left the inn and talked about the harvest. ".repeat(
      15,
    );
    const hidden = "At the end of the night Maukie hid the brass key under the floorboard. ".repeat(10);
    const reply = "At the end of the night, Maukie and Pantalone left the inn and talked about the harvest.";
    answer = (text) => ({ content: text.startsWith("When the night ended") ? reply : shorten(text) });
    requests.length = 0;
    const phrased = await fixture("phrased", [`${forBoth}${together}{{/if}}${forMaukie}${hidden}{{/if}}`], true);
    await update(phrased.chat.id);
    assert.deepEqual(
      requests.map((item) => item.messages[1]!.content),
      [together.trim(), hidden.trim()],
      "each set of readers is sent alone",
    );
    const combined = (await saved(phrased.chat.id)).find((entry) => entry.enabled)!;
    assert.equal(combined.content, `${forBoth}${reply}{{/if}}\n\n${forMaukie}${shorten(hidden)}{{/if}}`);
    const pantaloneView = await view(phrased.chat.id, pantalone.id);
    assert.match(pantaloneView, /At the end of the night, Maukie and Pantalone left the inn/u);
    assert.doesNotMatch(pantaloneView, /brass key/u);
  });

  await test("(7) the same readers are one set however each summary's conditions order them", async () => {
    // Both summaries keep parts for Dottore and Cyno, who left the chat, named in opposite orders. The text that
    // Maukie, Pantalone, Dottore and Cyno read is still halved in one request and rebuilt in one condition.
    answer = shortening;
    requests.length = 0;
    const forDottore = '{{#if char == "Dottore"}}';
    const forCyno = '{{#if char == "Cyno"}}';
    const departed = await fixture(
      "departed",
      [
        `${walk}${forDottore}DOTTORE_PART{{/if}}${forCyno}CYNO_PART{{/if}}`,
        `${later}${forCyno}CYNO_LATER{{/if}}${forDottore}DOTTORE_LATER{{/if}}`,
      ],
      true,
    );
    await update(departed.chat.id);
    assert.deepEqual(
      requests.map((item) => item.messages[1]!.content),
      [`${walk}\n\n${later}`],
      "one request for the readers both summaries share",
    );
    const combined = (await saved(departed.chat.id)).find((entry) => entry.enabled)!;
    assert.equal(
      combined.content,
      `{{#if char == "Maukie" || "Pantalone" || "Dottore" || "Cyno"}}SHARED_WALK SHARED_LATER{{/if}}\n\n` +
        `${forDottore}DOTTORE_PART\n\nDOTTORE_LATER{{/if}}\n\n${forCyno}CYNO_PART\n\nCYNO_LATER{{/if}}`,
    );
    const maukieView = await view(departed.chat.id, maukie.id);
    assert.match(maukieView, /SHARED_WALK SHARED_LATER/u);
    assert.doesNotMatch(maukieView, /DOTTORE|CYNO/u);
  });
  console.log(
    "Advanced Memory halves continuity summaries with only the combine prompt, one set of readers at a time.",
  );
} finally {
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await db._fileStore.close();
  rmSync(directory, { recursive: true, force: true });
}
