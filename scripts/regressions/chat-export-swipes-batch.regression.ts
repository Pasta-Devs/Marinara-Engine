// Whole-chat exports, branches, imports and scene forks read every swipe at once (#7445). One read per
// message scanned all swipes each time, so a 12,000-message export held the server for about 20 seconds.
// The batched read keeps every swipe in index order, with the active swipe where the per-message read put it.
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
const { messageSwipes, chatImages } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");

type Response = { statusCode: number; body: string };
const app = (await buildApp()) as unknown as {
  ready(): Promise<void>;
  close(): Promise<void>;
  inject(options: Record<string, unknown>): Promise<Response>;
};
await app.ready();

try {
  const db = await getDB();
  const chats = createChatsStorage(db);
  const injectOk = async (options: Record<string, unknown>) => {
    const response = await app.inject(options);
    assert.equal(response.statusCode, 200, response.body);
    return response;
  };
  const exportLines = async (chatId: string) => {
    const { body } = await injectOk({ method: "GET", url: `/api/chats/${chatId}/export?format=jsonl` });
    return {
      body,
      lines: body
        .split("\n")
        .slice(1)
        .map((line) => JSON.parse(line)),
    };
  };
  const importOk = async (jsonl: string) => {
    const result = (await importSTChat(jsonl, db, {})) as { chatId?: string };
    assert.ok(result.chatId, JSON.stringify(result));
    return result.chatId;
  };
  // What the per-message read gave each message: its swipes in index order, the active one showing the message text.
  const expectedSwipes = async (chatId: string) =>
    Promise.all(
      (await chats.listMessages(chatId)).map(async (message) => {
        const swipes = await chats.getSwipes(message.id);
        return swipes.length === 0
          ? [{ index: 0, content: message.content, createdAt: message.createdAt }]
          : swipes.map((swipe) => ({
              index: swipe.index,
              content: swipe.index === message.activeSwipeIndex ? message.content : swipe.content,
              createdAt: swipe.createdAt,
            }));
      }),
    );

  // ── Fixture: attachments, several swipes with a middle one active, a hidden message, an interruption,
  // swipes saved out of index order and a message without swipe rows ──
  const chat = (await chats.create({ name: "Export fixture", mode: "roleplay", characterIds: [] }))!;
  const original = '"I was going to cross the bridge, then tell you everything."';
  const target = (await chats.createMessage({ chatId: chat.id, role: "user", content: original }))!;
  await chats.appendMessageAttachment(target.id, { type: "image", url: "/api/gallery/file/map.png", name: "map.png" });
  const owner = (await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Wait." }))!;
  await chats.commitRoleplayInterruption({
    messageId: owner.id,
    swipeIndex: owner.activeSwipeIndex,
    extraUpdate: {
      roleplayCommandActivity: [
        { command: { type: "interrupt", part: "I was going to" }, raw: '[interrupt: part="I was going to"]' },
      ],
    },
    target: (await chats.getMessage(target.id))!,
  });
  const swiped = (await chats.createMessage({ chatId: chat.id, role: "assistant", content: "First take." }))!;
  await chats.addSwipe(swiped.id, "Second take.");
  await chats.addSwipe(swiped.id, "Third take.");
  await chats.setActiveSwipe(swiped.id, 1);
  const hidden = (await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Hidden aside." }))!;
  await chats.updateMessageExtra(hidden.id, { hiddenFromAI: true });
  const shuffled = (await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Zero." }))!;
  for (const index of [2, 1]) {
    await db.insert(messageSwipes).values({
      id: `${shuffled.id}-swipe-${index}`,
      messageId: shuffled.id,
      index,
      content: index === 2 ? "Two." : "One.",
      extra: "{}",
      createdAt: shuffled.createdAt,
    });
  }
  const bare = (await chats.createMessage({ chatId: chat.id, role: "user", content: "No swipe rows." }))!;
  await db.delete(messageSwipes).where(eq(messageSwipes.messageId, bare.id));

  const exported = await exportLines(chat.id);
  const messages = await chats.listMessages(chat.id);
  const expected = await expectedSwipes(chat.id);
  assert.equal(exported.lines.length, messages.length);
  exported.lines.forEach((line, position) => {
    const swipes = expected[position]!;
    assert.equal(line.marinara_message_id, messages[position]!.id);
    assert.deepEqual(
      line.swipes,
      swipes.map((swipe) => swipe.content),
    );
    assert.deepEqual(
      line.extra.marinara_swipes.map((swipe: { index: number; created_at: string }) => [swipe.index, swipe.created_at]),
      swipes.map((swipe) => [swipe.index, swipe.createdAt]),
    );
  });
  const lineFor = (id: string) => exported.lines.find((line) => line.marinara_message_id === id);
  assert.deepEqual(lineFor(swiped.id).swipes, ["First take.", "Second take.", "Third take."]);
  assert.equal(lineFor(swiped.id).swipe_id, 1);
  assert.equal(lineFor(swiped.id).mes, "Second take.");
  assert.deepEqual(lineFor(shuffled.id).swipes, ["Zero.", "One.", "Two."], "swipes export in index order");
  assert.deepEqual(lineFor(bare.id).swipes, ["No swipe rows."]);
  assert.equal(lineFor(target.id).extra.attachments.length, 1);
  assert.equal(lineFor(hidden.id).extra.hiddenFromAI, true);
  const receipt = lineFor(owner.id).extra.roleplayCommandActivity[0].interruption;
  assert.equal(receipt.targetMessageId, target.id);
  assert.equal(receipt.targetSwipeIndex, 0);
  assert.equal(receipt.originalContent, original);

  // A branch and a JSONL import copy the same swipes in the same order.
  const branch = await injectOk({ method: "POST", url: `/api/chats/${chat.id}/branch`, payload: {} });
  for (const copyId of [JSON.parse(branch.body).id as string, await importOk(exported.body)]) {
    assert.deepEqual(
      (await expectedSwipes(copyId)).map((swipes) => swipes.map((swipe) => [swipe.index, swipe.content])),
      expected.map((swipes) => swipes.map((swipe) => [swipe.index, swipe.content])),
    );
  }

  // Branches own their image stack rows, including versions reachable only through a saved swipe.
  const { createGalleryStorage } = await import("../../packages/server/src/services/storage/gallery.storage.js");
  const { groupChatImageVariants } = await import("../../packages/shared/src/utils/chat-image-variants.js");
  const gallery = createGalleryStorage(db);
  const firstImage = (await gallery.create({
    chatId: chat.id,
    filePath: "shared/branch-first.png",
    prompt: "first",
    provider: "fixture",
    model: "fixture",
  }))!;
  const secondImage = (await gallery.create({
    chatId: chat.id,
    filePath: "shared/branch-second.png",
    prompt: "second",
    provider: "fixture",
    model: "fixture",
  }))!;
  await db
    .update(chatImages)
    .set({ variantGroupId: firstImage.id, variantSelected: 1 })
    .where(eq(chatImages.id, firstImage.id));
  await db.update(chatImages).set({ variantGroupId: firstImage.id }).where(eq(chatImages.id, secondImage.id));
  await chats.appendMessageAttachment(target.id, { type: "image", url: "/first.png", galleryId: firstImage.id });
  const imageBranch = JSON.parse(
    (await injectOk({ method: "POST", url: `/api/chats/${chat.id}/branch`, payload: {} })).body,
  );
  const copiedImages = await gallery.listByChatId(imageBranch.id);
  assert.equal(copiedImages.length, 2);
  assert.equal(groupChatImageVariants(copiedImages).length, 1);
  assert.equal(groupChatImageVariants(copiedImages)[0]!.selected.filePath, firstImage.filePath);
  assert.ok(copiedImages.every((image) => image.id !== firstImage.id && image.id !== secondImage.id));
  assert.ok(
    (await chats.listMessages(imageBranch.id)).some((message) =>
      message.extra.includes(groupChatImageVariants(copiedImages)[0]!.selected.id),
    ),
  );

  // ── A long chat takes a few swipe reads, not one per message ──
  // A bound well below the message count keeps an unrelated read from failing the check.
  const swipeReads = async (run: () => Promise<unknown>) => {
    const select = db.select;
    let reads = 0;
    db.select = ((...args: Parameters<typeof db.select>) => {
      const query = select.apply(db, args);
      const from = query.from;
      query.from = ((table: unknown) => {
        if (table === messageSwipes) reads++;
        return from.call(query, table as never);
      }) as typeof query.from;
      return query;
    }) as typeof db.select;
    try {
      await run();
    } finally {
      db.select = select;
    }
    return reads;
  };
  const count = 40;
  const long = (await chats.create({ name: "Long", mode: "roleplay", characterIds: [] }))!;
  await chats.createMessagesBatch(
    long.id,
    Array.from({ length: count }, (_, index) => ({
      role: "assistant" as const,
      characterId: null,
      content: `Reply ${index}`,
      activeSwipeIndex: 1,
      swipes: [
        { index: 0, content: `Draft ${index}` },
        { index: 1, content: `Reply ${index}` },
      ],
    })),
  );
  const scene = (await chats.create({ name: "Scene", mode: "roleplay", characterIds: [] }))!;
  await chats.updateMetadata(scene.id, { sceneStatus: "active" });
  await chats.createMessagesBatch(
    scene.id,
    Array.from({ length: count }, (_, index) => ({ role: "assistant" as const, content: `Beat ${index}` })),
  );
  let jsonl = "";
  const reads = {
    export: await swipeReads(async () => {
      jsonl = (await exportLines(long.id)).body;
    }),
    branch: await swipeReads(() => injectOk({ method: "POST", url: `/api/chats/${long.id}/branch`, payload: {} })),
    import: await swipeReads(() => importOk(jsonl)),
    sceneFork: await swipeReads(() =>
      injectOk({ method: "POST", url: "/api/scene/fork", payload: { sceneChatId: scene.id, mode: "clone" } }),
    ),
  };
  for (const [path, total] of Object.entries(reads)) {
    assert.ok(total < count / 4, `${path} read swipes ${total} times for ${count} messages`);
  }

  console.info("Chat export swipes batch regression passed");
} finally {
  await app.close();
  await closeDB();
}
