// #8547: exporting a range of messages writes only the messages from the first to the last boundary, in chat order,
// with each message's selected swipe. A JSONL excerpt leaves out chat-wide state (summaries, memory, world) that
// belongs to the rest of the story. The export reads the chat and changes nothing in it.
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
process.env.DISABLE_REQUEST_LOGGING = "true";
process.env.AUTO_CREATE_DEFAULT_CONNECTION = "false";

const { buildApp } = await import("../../packages/server/src/app.js");
const { closeDB, getDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { importSTChat } = await import("../../packages/server/src/services/import/st-chat.importer.js");

type Response = { statusCode: number; body: string; headers: Record<string, unknown> };
const app = (await buildApp()) as unknown as {
  ready(): Promise<void>;
  close(): Promise<void>;
  inject(options: Record<string, unknown>): Promise<Response>;
};
await app.ready();

try {
  const db = await getDB();
  const chats = createChatsStorage(db);

  const chat = (await chats.create({ name: "Range fixture", mode: "roleplay", characterIds: [] }))!;
  await chats.updateMetadata(chat.id, { summary: "Unrelated secret summary." });
  const ids: string[] = [];
  for (let index = 0; index < 6; index++) {
    const role = index % 2 ? ("assistant" as const) : ("user" as const);
    ids.push((await chats.createMessage({ chatId: chat.id, role, content: `msg ${index}` }))!.id);
  }
  await chats.addSwipe(ids[3]!, "msg 3 second take");
  await chats.setActiveSwipe(ids[3]!, 1);
  const other = (await chats.create({ name: "Other chat", mode: "roleplay", characterIds: [] }))!;
  const foreignId = (await chats.createMessage({ chatId: other.id, role: "user", content: "elsewhere" }))!.id;

  const snapshot = async () =>
    Promise.all(
      (await chats.listMessages(chat.id)).map(async (message) => ({
        id: message.id,
        content: message.content,
        activeSwipeIndex: message.activeSwipeIndex,
        swipes: (await chats.getSwipes(message.id)).map((swipe) => swipe.content),
      })),
    );

  const exportChat = (format: string, query = "") =>
    app.inject({ method: "GET", url: `/api/chats/${chat.id}/export?format=${format}${query}` });
  const range = (start: string, end: string) => `&startMessageId=${start}&endMessageId=${end}`;
  const exportOk = async (format: string, query = "") => {
    const response = await exportChat(format, query);
    assert.equal(response.statusCode, 200, response.body);
    return response.body;
  };
  // Message 3 exports its selected swipe, so that is its text everywhere it legitimately appears.
  const rangeText = (row: number) => (row === 3 ? "msg 3 second take" : `msg ${row}`);
  const assertRange = (body: string, format: string, rows: number[]) => {
    const positions = rows.map((row) => body.indexOf(rangeText(row)));
    assert.ok(
      positions.every((position) => position >= 0),
      `${format} range is missing a message:\n${body}`,
    );
    assert.deepEqual(
      positions,
      [...positions].sort((left, right) => left - right),
      `${format} range keeps chat order`,
    );
    let rest = body;
    for (const row of rows) rest = rest.split(rangeText(row)).join("");
    assert.ok(!/msg \d/u.test(rest), `${format} range exported a message outside it, or an alternate swipe:\n${body}`);
  };

  // Boundaries picked last-to-first still export first-to-last.
  assertRange(await exportOk("text", range(ids[3]!, ids[1]!)), "text", [1, 2, 3]);
  assertRange(await exportOk("markdown", range(ids[1]!, ids[3]!)), "markdown", [1, 2, 3]);
  assertRange(await exportOk("html", range(ids[1]!, ids[3]!)), "html", [1, 2, 3]);
  // One boundary on both ends exports that one message only.
  assertRange(await exportOk("text", range(ids[2]!, ids[2]!)), "text", [2]);

  const [headerLine, ...messageLines] = (await exportOk("jsonl", range(ids[1]!, ids[3]!))).split("\n");
  const header = JSON.parse(headerLine!);
  assert.deepEqual(header.chat_metadata, { mode: "roleplay", branchName: "", marinara_metadata: { mode: "roleplay" } });
  const lines = messageLines.map((line) => JSON.parse(line));
  assert.deepEqual(
    lines.map((line) => line.marinara_message_id),
    ids.slice(1, 4),
  );
  const swiped = lines[2]!;
  assert.equal(swiped.mes, "msg 3 second take");
  assert.deepEqual(swiped.swipes, ["msg 3 second take"]);
  assert.equal(swiped.swipe_id, 0);
  assert.ok(lines.every((line) => typeof line.send_date === "string" && line.send_date));

  // The excerpt imports as a chat of its own with the selected swipe.
  const imported = (await importSTChat([headerLine, ...messageLines].join("\n"), db, {})) as { chatId?: string };
  assert.ok(imported.chatId, JSON.stringify(imported));
  const importedMessages = await chats.listMessages(imported.chatId);
  assert.deepEqual(
    importedMessages.map((message) => message.content),
    ["msg 1", "msg 2", "msg 3 second take"],
  );
  assert.deepEqual(
    (await chats.getSwipes(importedMessages[2]!.id)).map((swipe) => swipe.content),
    ["msg 3 second take"],
  );

  // A whole-chat export keeps every swipe and the chat's metadata.
  const whole = (await exportOk("jsonl")).split("\n");
  assert.equal(whole.length, 7);
  assert.match(whole[0]!, /Unrelated secret summary/u);
  const wholeSwiped = JSON.parse(whole[4]!);
  assert.deepEqual(wholeSwiped.swipes, ["msg 3", "msg 3 second take"]);
  assert.equal(wholeSwiped.swipe_id, 1);
  assert.match(await exportOk("text"), /msg 0[\s\S]*msg 5/u);

  // {{input}} resolves inside the range, so an excerpt's echo never fills in a user message it leaves out.
  const asked = (await chats.createMessage({ chatId: chat.id, role: "user", content: "msg 6" }))!;
  const echoed = (await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    content: "echo: {{input}}",
  }))!;
  (await chats.createMessage({ chatId: chat.id, role: "user", content: "Outside msg 7" }))!;
  const beforeExcerpt = await snapshot();
  const excerpt = await exportOk("text", range(asked.id, echoed.id));
  assert.match(excerpt, /echo: msg 6/u, excerpt);
  // On its own, the echo has no user message inside the range to fill in, and takes none from outside it.
  const echoOnly = await exportOk("text", range(echoed.id, echoed.id));
  assert.match(echoOnly, /^echo: $/mu, echoOnly);
  assert.ok(!echoOnly.includes("Outside msg 7"), echoOnly);
  // The whole chat still fills {{input}} from its latest user message.
  assert.match(await exportOk("text"), /echo: Outside msg 7/u);

  // A boundary outside this chat, or a missing one, is refused instead of exporting the whole chat.
  for (const [query, status] of [
    [range(ids[1]!, foreignId), 404],
    [range("missing-message", ids[3]!), 404],
    [`&startMessageId=${ids[1]}`, 400],
    [`&endMessageId=${ids[3]}`, 400],
  ] as const) {
    const response = await exportChat("text", query);
    assert.equal(response.statusCode, status, `${query}: ${response.body}`);
  }

  assert.deepEqual(await snapshot(), beforeExcerpt, "exporting a range leaves the chat unchanged");

  console.info("Chat range export regression passed");
} finally {
  await app.close();
  await closeDB();
}
