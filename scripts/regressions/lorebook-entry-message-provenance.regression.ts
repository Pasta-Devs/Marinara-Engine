// Deleted-message lorebook cascade, part 1: entry provenance.
//
// Agent-written lorebook entries had no message linkage, so deleting the chat
// turn a keeper entry was extracted from left the lore live: later generations
// kept being steered by "facts" from a turn the user removed: an invented
// "current state" claim re-armed every turn by its keys, plus a keeper rewrite
// of an older, innocent entry in place.
//
// Part 1 pins the attribution layer:
//   - createEntry accepts an optional sourceAgentId + sourceMessageRefs and
//     persists them; entries created without them read back as unattributed.
//   - updateEntry on behalf of an agent (sourceAgentId present) snapshots the
//     pre-write content + refs (depth-1 undo, mirroring how addSwipe backfills
//     the outgoing swipe) and stamps the new refs — last write wins.
//   - a content-bearing update WITHOUT provenance is a human edit: attribution
//     is cleared, so the cascade must never touch the entry again.
//
// Part 2 pins the cascade — deleting a message unwinds agent lore:
//   - a rewrite whose last-write turn is deleted reverts to its pre-write
//     snapshot (content + refs), when the snapshot's own sources survive;
//   - a poisoned snapshot (its sources are in the same deletion batch) is
//     discarded first, so the entry deletes instead of reverting to lore
//     whose source is gone;
//   - a keeper create whose only turn is deleted has nothing to revert to
//     and is removed;
//   - deleting an old turn that no longer feeds the current content leaves
//     the entry (and its snapshot) alone;
//   - manual entries and unrelated entries are never touched.
//
// Project imports are DYNAMIC, after the env assignments (see the gallery
// suites for why).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-lore-provenance-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { createChatsStorage, withChatMetadataPatchQueue } =
  await import("../../packages/server/src/services/storage/chats.storage.js");
const { lorebookEntries } = await import("../../packages/server/src/db/schema/lorebooks.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { MariDbService } = await import("../../packages/server/src/services/mari-db/mari-db.service.js");

const db = await getDB();
const lorebooks = createLorebooksStorage(db);
const chats = createChatsStorage(db);

try {
  const book = await lorebooks.create({ name: "Provenance lore" });
  assert.ok(book);

  // ── createEntry persists agent attribution + source refs ──
  {
    const created = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Ledger evidence",
      content: "The ledger shows the curator took the key.",
      keys: ["ledger", "archive"],
      sourceAgentId: "lorebook-keeper",
      sourceMessageRefs: [
        { id: "m-user-1", swipeIndex: null },
        { id: "m-assist-1", swipeIndex: 0 },
      ],
    });
    assert.ok(created, "entry create failed");
    assert.equal(created.sourceAgentId, "lorebook-keeper");
    assert.deepEqual(created.sourceMessageRefs, [
      { id: "m-user-1", swipeIndex: null },
      { id: "m-assist-1", swipeIndex: 0 },
    ]);
    const reread = await lorebooks.getEntry(created.id);
    assert.deepEqual(
      reread?.sourceMessageRefs,
      [
        { id: "m-user-1", swipeIndex: null },
        { id: "m-assist-1", swipeIndex: 0 },
      ],
      "refs must survive the row parse round-trip",
    );
    const listed = await lorebooks.listEntries(book.id);
    assert.ok(listed.some((entry) => entry.id === created.id && entry.sourceAgentId === "lorebook-keeper"));
    const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
    const { lorebooksRoutes } = await import("../../packages/server/src/routes/lorebooks.routes.js");
    const app = Fastify();
    app.decorate("db", db);
    await app.register(lorebooksRoutes, { prefix: "/api/lorebooks" });
    try {
      const result = await app.inject(
        `/api/lorebooks/${book.id}/entries?sourceMessageId=m-user-1&sourceMessageId=other`,
      );
      assert.equal(result.statusCode, 200, result.body);
      assert.deepEqual(
        result.json().map((entry: { id: string }) => entry.id),
        [created.id],
      );
    } finally {
      await app.close();
    }
  }

  // ── createEntry without provenance reads back unattributed ──
  {
    const manual = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Handwritten",
      content: "Author wrote this.",
      keys: ["hand"],
    });
    assert.ok(manual);
    assert.equal(manual.sourceAgentId, null);
    assert.deepEqual(manual.sourceMessageRefs, []);
  }

  // ── agent rewrite snapshots pre-write state and stamps the new refs ──
  {
    const created = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Slap rumor",
      content: "Kael is rumored to have defaced a shrine.",
      keys: ["kael", "rumor"],
      sourceAgentId: "lorebook-keeper",
      sourceMessageRefs: [{ id: "m-n", swipeIndex: null }],
    });
    assert.ok(created);
    const updated = await lorebooks.updateEntry(created.id, {
      content: "Kael is rumored to have defaced 3 shrines.",
      sourceAgentId: "lorebook-keeper",
      sourceMessageRefs: [{ id: "m-n10", swipeIndex: 2 }],
    });
    assert.ok(updated);
    assert.deepEqual(updated.sourceMessageRefs, [{ id: "m-n10", swipeIndex: 2 }], "last write wins on refs");
    assert.equal(updated.content, "Kael is rumored to have defaced 3 shrines.");
    const row = (
      await db.select().from((await import("../../packages/server/src/db/schema/lorebooks.js")).lorebookEntries)
    ).find((entry: { id: string }) => entry.id === created.id);
    assert.equal(row.previousContent, "Kael is rumored to have defaced a shrine.", "pre-write content snapshotted");
    assert.deepEqual(
      JSON.parse(row.previousSourceMessageRefs),
      [{ id: "m-n", swipeIndex: null }],
      "pre-write refs snapshotted",
    );
  }

  // ── human content edit clears attribution (cascade immunity) ──
  {
    const created = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Keeper then human",
      content: "Agent wrote this.",
      keys: ["agent"],
      sourceAgentId: "lorebook-keeper",
      sourceMessageRefs: [{ id: "m-k", swipeIndex: 0 }],
    });
    assert.ok(created);
    const humanEdited = await lorebooks.updateEntry(created.id, {
      content: "Human rewrote this by hand.",
    });
    assert.ok(humanEdited);
    assert.equal(humanEdited.sourceAgentId, null, "human edit takes ownership");
    assert.deepEqual(humanEdited.sourceMessageRefs, []);
    const row = (
      await db.select().from((await import("../../packages/server/src/db/schema/lorebooks.js")).lorebookEntries)
    ).find((entry: { id: string }) => entry.id === created.id);
    assert.equal(row.previousContent, null, "human edit leaves no revert snapshot");
  }

  // ── attribution survives non-content updates (enabled toggles etc.) ──
  {
    const created = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Toggle me",
      content: "Still agent lore.",
      keys: ["toggle"],
      sourceAgentId: "lorebook-keeper",
      sourceMessageRefs: [{ id: "m-t", swipeIndex: 0 }],
    });
    assert.ok(created);
    const toggled = await lorebooks.updateEntry(created.id, { enabled: false });
    assert.ok(toggled);
    assert.equal(toggled.sourceAgentId, "lorebook-keeper", "non-content PATCH keeps attribution");
    assert.deepEqual(toggled.sourceMessageRefs, [{ id: "m-t", swipeIndex: 0 }]);
  }

  // ── part 2: message-delete cascade ──
  {
    const chat = await chats.create({ name: "Cascade chat", mode: "conversation", characterIds: [] });
    assert.ok(chat);
    const message = (role: "user" | "assistant", content: string) =>
      chats.createMessage({ chatId: chat.id, role, content }).then((row) => row!.id);
    const mN = await message("user", "Kael defaced a shrine.");
    const mAlive = await message("user", "Kael kept out of trouble since.");
    const mN10 = await message("assistant", "Rumor grows: three shrines.");
    const mN10b = await message("assistant", "Rumor grows again.");
    const mGone = await message("assistant", "Invented from whole cloth.");

    // Rewrite whose last-write turn dies → reverts to the snapshot.
    const revertMe = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Revert me",
      content: "Kael is rumored to have defaced a shrine.",
      keys: ["kael"],
      sourceAgentId: "lorebook-keeper",
      sourceMessageRefs: [{ id: mN, swipeIndex: null }],
    });
    await lorebooks.updateEntry(revertMe!.id, {
      content: "Kael is rumored to have defaced 3 shrines.",
      sourceAgentId: "lorebook-keeper",
      sourceMessageRefs: [{ id: mN10, swipeIndex: 0 }],
    });
    await lorebooks.updateEntryEmbedding(revertMe!.id, [1, 0], "discarded-turn");

    // Keeper create whose only source dies → removed outright.
    const dieAlone = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Die alone",
      content: "The curator reset the archive clock; the ledger shows proof.",
      keys: ["curator", "ledger"],
      sourceAgentId: "lorebook-keeper",
      sourceMessageRefs: [{ id: mGone, swipeIndex: 0 }],
    });

    // Two rewrites, then BOTH of their turns die in one batch → the snapshot
    // (whose source is also in the batch) is discarded, entry deleted.
    const poisoned = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Poisoned snapshot",
      content: "First state.",
      keys: ["poison"],
      sourceAgentId: "lorebook-keeper",
      sourceMessageRefs: [{ id: mN, swipeIndex: null }],
    });
    await lorebooks.updateEntry(poisoned!.id, {
      content: "Second state.",
      sourceAgentId: "lorebook-keeper",
      sourceMessageRefs: [{ id: mN10, swipeIndex: 0 }],
    });
    await lorebooks.updateEntry(poisoned!.id, {
      content: "Third state.",
      sourceAgentId: "lorebook-keeper",
      sourceMessageRefs: [{ id: mN10b, swipeIndex: 0 }],
    });

    // Old turn deleted while the current content came from a live turn →
    // entry untouched (its refs no longer mention the deleted message).
    const stillAnchored = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Still anchored",
      content: "Current state from the surviving turn.",
      keys: ["anchor"],
      sourceAgentId: "lorebook-keeper",
      sourceMessageRefs: [{ id: mAlive, swipeIndex: null }],
    });

    // Manual entry: never touched, whatever dies around it.
    const manual = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Manual lore",
      content: "Handwritten and immune.",
      keys: ["manual"],
    });

    await chats.removeMessages([mN10, mN10b, mGone], chat.id);

    const reverted = await lorebooks.getEntry(revertMe!.id);
    assert.ok(reverted, "revertable entry survives its deleted rewrite turn");
    assert.equal(reverted.content, "Kael is rumored to have defaced a shrine.", "content reverted to snapshot");
    assert.deepEqual(reverted.sourceMessageRefs, [{ id: mN, swipeIndex: null }], "refs reverted to snapshot refs");
    assert.equal(reverted.embedding, null, "restored content must not retain the discarded turn's vector");
    assert.equal(reverted.embeddingSpaceId, null);

    const dead = await lorebooks.getEntry(dieAlone!.id);
    assert.equal(dead, null, "keeper create whose only turn died is removed");

    const poisonedAfter = await lorebooks.getEntry(poisoned!.id);
    assert.equal(poisonedAfter, null, "poisoned snapshot is discarded, entry removed rather than reverted");

    const anchored = await lorebooks.getEntry(stillAnchored!.id);
    assert.ok(anchored, "entry anchored to a surviving turn is untouched");
    assert.deepEqual(anchored.sourceMessageRefs, [{ id: mAlive, swipeIndex: null }]);

    const manualAfter = await lorebooks.getEntry(manual!.id);
    assert.ok(manualAfter, "manual entry never cascades");

    // Single-message removeMessage path cascades too: the reverted entry's
    // content now sources from mN, so deleting mN deletes it — the snapshot
    // was consumed by the revert, and lore whose source turn is gone must
    // not keep steering generations.
    await chats.removeMessage(mN);
    assert.equal(
      await lorebooks.getEntry(revertMe!.id),
      null,
      "removeMessage cascades; a reverted entry dies when its remaining source dies",
    );
  }

  // ── part 3: the keeper persistence path stamps provenance ──
  {
    const { persistLorebookKeeperUpdates } =
      await import("../../packages/server/src/routes/generate/lorebook-keeper-utils.js");
    const chat = await chats.create({ name: "Keeper stamp chat", mode: "conversation", characterIds: [] });
    assert.ok(chat);
    const targetBook = await lorebooks.create({ name: "Keeper book", chatId: chat.id });
    assert.ok(targetBook);
    const mTurnUser = (await chats.createMessage({ chatId: chat.id, role: "user", content: "keeper stamp turn" }))!.id;
    const mTurnAssist = (await chats.createMessage({
      chatId: chat.id,
      role: "assistant",
      content: "keeper stamp reply",
    }))!.id;

    // Seed the pre-existing entry the second update rewrites in place.
    const seeded = await lorebooks.createEntry({
      lorebookId: targetBook.id,
      name: "Existing keeper lore",
      content: "Older state.",
      keys: ["rewrite"],
    });
    assert.ok(seeded);

    const returnedTarget = await persistLorebookKeeperUpdates({
      lorebooksStore: lorebooks,
      chatId: chat.id,
      chatName: "Keeper stamp chat",
      preferredTargetLorebookId: targetBook.id,
      writableLorebookIds: [targetBook.id],
      sourceAgentId: "lorebook-keeper",
      sourceMessageRefs: [
        { id: mTurnUser, swipeIndex: null },
        { id: mTurnAssist, swipeIndex: 1 },
      ],
      updates: [
        { name: "Fresh keeper lore", content: "Extracted this turn.", keys: ["fresh"] },
        { name: "Existing keeper lore", content: "Rewritten this turn.", keys: ["rewrite"] },
      ],
    });
    assert.equal(returnedTarget, targetBook.id);

    const createdEntry = (await lorebooks.listEntries(targetBook.id)).find((e) => e.name === "Fresh keeper lore");
    assert.ok(createdEntry, "keeper create landed");
    assert.equal(createdEntry.sourceAgentId, "lorebook-keeper", "keeper create is attributed");
    assert.deepEqual(createdEntry.sourceMessageRefs, [
      { id: mTurnUser, swipeIndex: null },
      { id: mTurnAssist, swipeIndex: 1 },
    ]);

    const rewrittenEntry = (await lorebooks.listEntries(targetBook.id)).find((e) => e.name === "Existing keeper lore");
    assert.ok(rewrittenEntry);
    assert.equal(rewrittenEntry.content, "Rewritten this turn.");
    assert.equal(rewrittenEntry.sourceAgentId, "lorebook-keeper", "keeper rewrite is attributed");
    assert.deepEqual(rewrittenEntry.sourceMessageRefs, [
      { id: mTurnUser, swipeIndex: null },
      { id: mTurnAssist, swipeIndex: 1 },
    ]);
    // And the delete cascade actually reaches keeper-written entries: removing
    // the turn that fed them reverts the rewrite and removes the create.
    await chats.removeMessages([mTurnAssist], chat.id);
    const afterCascade = await lorebooks.getEntry(createdEntry.id);
    assert.equal(afterCascade, null, "keeper create is cascaded away with its turn");
    const revertedKeeperEntry = await lorebooks.getEntry(rewrittenEntry.id);
    assert.ok(revertedKeeperEntry, "keeper rewrite reverts instead of vanishing");
    assert.equal(revertedKeeperEntry.content, "Older state.");
  }

  // ── part 4: injection-time staleness for discarded swipes ──
  // A regenerate keeps the message row and swaps the active swipe, so nothing
  // is deleted and the storage cascade never fires. Instead the injection
  // path lazily excludes keeper entries whose anchor swipe is no longer
  // active — and re-includes them when the user swipes back.
  {
    const { processLorebooks } = await import("../../packages/server/src/services/lorebook/index.js");
    const chat = await chats.create({ name: "Swipe chat", mode: "conversation", characterIds: [] });
    assert.ok(chat);
    const userMsg = await chats.createMessage({ chatId: chat.id, role: "user", content: "kael rumor" });
    const assistantMsg = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "kael rumor" });
    assert.ok(userMsg && assistantMsg);
    const book2 = await lorebooks.create({ name: "Swipe book", chatId: chat.id });
    assert.ok(book2);
    const keeperEntry = await lorebooks.createEntry({
      lorebookId: book2.id,
      name: "Swipe-bound lore",
      content: "kael rumor secret from swipe 0",
      keys: ["kael"],
      sourceAgentId: "lorebook-keeper",
      sourceMessageRefs: [{ id: assistantMsg.id, swipeIndex: 0 }],
    });
    const manualEntry = await lorebooks.createEntry({
      lorebookId: book2.id,
      name: "Manual swipe-proof",
      content: "kael rumor handwritten",
      keys: ["kael"],
    });
    assert.ok(keeperEntry && manualEntry);

    const scanMessages = [
      { role: "user", content: "kael rumor" },
      { role: "assistant", content: "kael rumor" },
    ];
    const injectedContents = async () => {
      const result = await processLorebooks(db, scanMessages as never, null, {
        chatId: chat.id,
        activeLorebookIds: [book2.id],
      });
      return `${result.worldInfoBefore}\n${result.worldInfoAfter}`;
    };

    // Swipe 0 is active (fresh message): the entry injects.
    let combined = await injectedContents();
    assert.ok(combined.includes("secret from swipe 0"), "keeper entry injects while its swipe is active");
    assert.ok(combined.includes("handwritten"), "manual entry injects");

    // Regenerate: swipe 1 becomes active. The keeper entry written during
    // swipe 0 must NOT inject — the manual entry still does.
    await chats.addSwipe(assistantMsg.id, "regenerated away from swipe 0");
    await chats.setActiveSwipe(assistantMsg.id, 1);
    combined = await injectedContents();
    assert.ok(!combined.includes("secret from swipe 0"), "stale-swipe keeper entry is excluded from injection");
    assert.ok(combined.includes("handwritten"), "manual entry unaffected by swipe staleness");

    // Swiping back re-arms the entry — nothing was destroyed.
    await chats.setActiveSwipe(assistantMsg.id, 0);
    combined = await injectedContents();
    assert.ok(combined.includes("secret from swipe 0"), "swiping back re-arms the keeper entry");
  }

  // ── an explicit-but-empty refs array still stamps (agent rewrite on a turn
  //    whose anchors were unavailable keeps its attribution + snapshot, so a
  //    later anchored rewrite can still be unwound) ──
  {
    const chat = await chats.create({ name: "Empty refs chat", mode: "conversation", characterIds: [] });
    const book3 = await lorebooks.create({ name: "Empty refs book", chatId: chat!.id });
    assert.ok(chat && book3);
    const entry = await lorebooks.createEntry({
      lorebookId: book3.id,
      name: "Anchored lore",
      content: "First state.",
      keys: ["anchor"],
      sourceAgentId: "lorebook-keeper",
      sourceMessageRefs: [{ id: "m-earlier", swipeIndex: 0 }],
    });
    assert.ok(entry);
    const { persistLorebookKeeperUpdates } =
      await import("../../packages/server/src/routes/generate/lorebook-keeper-utils.js");
    await persistLorebookKeeperUpdates({
      lorebooksStore: lorebooks,
      chatId: chat!.id,
      chatName: "Empty refs chat",
      preferredTargetLorebookId: book3.id,
      writableLorebookIds: [book3.id],
      sourceAgentId: "lorebook-keeper",
      sourceMessageRefs: [],
      updates: [
        { name: "Anchored lore", content: "Intermediate state.", keys: ["anchor"], targetLorebook: book3.name },
        { name: "Anchored lore", content: "Second state.", keys: ["anchor"] },
        { name: "New unanchored lore", content: "Intermediate new state." },
        { name: "New unanchored lore", content: "Final new state." },
      ],
    });
    const rewritten = await lorebooks.getEntry(entry.id);
    assert.ok(rewritten);
    assert.equal(rewritten.sourceAgentId, "lorebook-keeper", "empty refs must not strip attribution");
    assert.deepEqual(rewritten.sourceMessageRefs, []);
    assert.equal(rewritten.content, "Second state.");
    const row = (
      await db.select().from((await import("../../packages/server/src/db/schema/lorebooks.js")).lorebookEntries)
    ).find((candidate: { id: string }) => candidate.id === entry.id);
    assert.equal(row.previousContent, "First state.", "empty-refs rewrite still snapshots");
    const newEntry = (await db.select().from(lorebookEntries)).find((entry) => entry.name === "New unanchored lore");
    assert.equal(newEntry?.previousContent, null, "new entries must not acquire an intermediate undo snapshot");
  }

  // Tools can run before the assistant exists; bind their writes after save without
  // overwriting a human edit, and preserve the pre-turn snapshot across repeated calls.
  for (const hasUserSource of [true, false]) {
    const { resolveGenerationTools } =
      await import("../../packages/server/src/services/generation/tool-resolution-runtime.js");
    const { stampLorebookWriteApprovalSource, buildLorebookWriteApprovalProposal } =
      await import("../../packages/server/src/routes/generate/agent-write-approval.js");
    const chat = (await chats.create({ name: "Tool provenance", mode: "roleplay", characterIds: [] }))!;
    const user = (await chats.createMessage({ chatId: chat.id, role: "user", content: "Inspect the ledger" }))!;
    const toolBook = (await lorebooks.create({ name: "Tool lore" }))!;
    let refs: Array<{ id: string; swipeIndex: number | null }> = hasUserSource
      ? [{ id: user.id, swipeIndex: null }]
      : [];
    const agent = {
      id: "tool-keeper",
      type: "tool-keeper",
      name: "Tool keeper",
      phase: "parallel",
      promptTemplate: "Save facts",
      connectionId: null,
      settings: { enabledTools: ["save_lorebook_entry"], writableLorebookId: toolBook.id },
      isCustomAgent: true,
      provider: {},
      model: "fixture",
    } as any;
    const runtime = await resolveGenerationTools({
      requestBody: {},
      chatId: chat.id,
      chatMetadata: {},
      chats,
      agentsStore: {},
      customToolsStore: { listEnabled: async () => [] },
      lorebooksStore: lorebooks,
      resolvedAgents: [agent],
      enabledConfigs: [],
      promptCharacterIds: [],
      personaId: null,
      activeLorebookIds: [],
      excludedLorebookIds: [],
      excludedSourceAgentIds: [],
      gameState: null,
      gameSpotifyMusicEnabled: false,
      agentContext: {
        chatId: chat.id,
        chatMode: "roleplay",
        recentMessages: hasUserSource ? [{ id: user.id, role: "user", content: user.content }] : [],
        mainResponse: null,
        gameState: null,
        characters: [],
        persona: null,
        memory: {},
        writableLorebookIds: [toolBook.id],
        chatSummary: null,
      },
      emitMetadataPatch() {},
      getLorebookSourceMessageRefs: () => refs,
    });
    const save = async (name: string, content: string, mode: string) => {
      const result = JSON.parse(
        await agent.toolContext.executeToolCall({
          id: name,
          type: "function",
          function: {
            name: "save_lorebook_entry",
            arguments: JSON.stringify({ name, content, keys: ["ledger"], mode }),
          },
        }),
      );
      assert.equal(result.applied, true, JSON.stringify(result));
      return result.entryId as string;
    };
    const createdId = await save("New fact", "Invented claim", "create");
    await save("New fact", "Second invented claim", "append");
    const original = (await lorebooks.createEntry({
      lorebookId: toolBook.id,
      name: "Old fact",
      content: "Original handwritten fact",
      keys: ["ledger"],
    }))!;
    await save("Old fact", "Invented replacement", "replace");
    await save("Old fact", "Extra invented detail", "append");
    const humanId = await save("Human owned", "Agent draft", "create");
    await lorebooks.updateEntry(humanId, { content: "Human correction" });
    const assistant = (await chats.createMessage({
      chatId: chat.id,
      role: "assistant",
      content: "The invented events",
    }))!;
    refs = [...refs, { id: assistant.id, swipeIndex: 0 }];
    await runtime.finalizeLorebookWrites();
    assert.deepEqual((await lorebooks.getEntry(createdId))?.sourceMessageRefs, refs);
    assert.equal((await lorebooks.getEntry(humanId))?.sourceAgentId, null, "late binding cannot reclaim a human edit");
    const proposal = buildLorebookWriteApprovalProposal({
      chatId: chat.id,
      agentType: agent.type,
      agentName: agent.name,
      updates: [{ name: "Approved fact", content: "Claim" }],
      sourceAgentId: agent.id,
      sourceMessageRefs: [{ id: user.id, swipeIndex: null }],
    });
    const stamped = stampLorebookWriteApprovalSource({ requiresApproval: true, approval: proposal }, agent.id, refs);
    assert.deepEqual(
      stamped.approval.payload?.sourceMessageRefs,
      refs,
      "final proposals include the saved assistant and its swipe",
    );
    assert.equal(stamped.approval.text, proposal.text, "adding provenance preserves the user's approval text");
    await chats.removeMessage(assistant.id);
    assert.equal(
      await lorebooks.getEntry(createdId),
      null,
      "deleting only the assistant cascades repeated pre-save tool writes",
    );
    assert.equal(
      (await lorebooks.getEntry(original.id))?.content,
      "Original handwritten fact",
      "same-turn writes retain the original undo snapshot",
    );
    assert.equal((await lorebooks.getEntry(humanId))?.content, "Human correction");
  }

  // ── part 5: CodeRabbit review fixes ──
  {
    // (a) A chatId-scoped bulk deletion must not cascade ids it did not
    // actually remove (wrong-chat or nonexistent ids keep their messages, so
    // their lore must survive).
    const chatA = await chats.create({ name: "Scope A", mode: "conversation", characterIds: [] });
    const chatB = await chats.create({ name: "Scope B", mode: "conversation", characterIds: [] });
    const msgB = await chats.createMessage({ chatId: chatB!.id, role: "assistant", content: "scope test" });
    const scopedEntry = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Cross-scope lore",
      content: "Anchored to a message in another chat.",
      keys: ["scope"],
      sourceAgentId: "lorebook-keeper",
      sourceMessageRefs: [{ id: msgB!.id, swipeIndex: 0 }],
    });
    await chats.removeMessages([msgB!.id], chatA!.id);
    assert.ok(
      await lorebooks.getEntry(scopedEntry!.id),
      "scoped deletion that kept the message must not cascade its lore",
    );
    await chats.removeMessages([msgB!.id]);
    assert.equal(await lorebooks.getEntry(scopedEntry!.id), null, "the real deletion cascades");

    // (b) Revert restores the PREVIOUS author, not the newest one.
    const chatC = await chats.create({ name: "Dual author chat", mode: "conversation", characterIds: [] });
    const msgA = await chats.createMessage({ chatId: chatC!.id, role: "user", content: "agent a turn" });
    const msgB2 = await chats.createMessage({ chatId: chatC!.id, role: "assistant", content: "agent b turn" });
    const dual = await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Dual author",
      content: "Agent A state.",
      keys: ["dual"],
      sourceAgentId: "agent-a",
      sourceMessageRefs: [{ id: msgA!.id, swipeIndex: null }],
    });
    await lorebooks.updateEntry(dual!.id, {
      content: "Agent B state.",
      sourceAgentId: "agent-b",
      sourceMessageRefs: [{ id: msgB2!.id, swipeIndex: 0 }],
    });
    await chats.removeMessages([msgB2!.id], chatC!.id);
    const dualReverted = await lorebooks.getEntry(dual!.id);
    assert.ok(dualReverted, "agent B rewrite reverts");
    assert.equal(dualReverted.content, "Agent A state.");
    assert.equal(dualReverted.sourceAgentId, "agent-a", "revert restores the previous author");

    // (c) Folder clones are user-directed copies: born manual, immune to the
    // source entries' message cascade.
    const chatD = await chats.create({ name: "Clone chat", mode: "conversation", characterIds: [] });
    const msgD = await chats.createMessage({ chatId: chatD!.id, role: "assistant", content: "clone test" });
    const folder = await lorebooks.createFolder(book.id, { name: "To clone" });
    const folderEntry = await lorebooks.createEntry({
      lorebookId: book.id,
      folderId: folder!.id,
      name: "Folder lore",
      content: "Authored inside a folder.",
      keys: ["folder"],
      sourceAgentId: "lorebook-keeper",
      sourceMessageRefs: [{ id: msgD!.id, swipeIndex: 0 }],
    });
    const clonedRoot = (await lorebooks.cloneFolder(folder!.id, book.id)) as { id: string } | null;
    const newRootId = clonedRoot!.id;
    const clones = (await lorebooks.listEntries(book.id)).filter((e) => e.folderId === newRootId);
    assert.equal(clones.length, 1, "clone landed in the cloned folder");
    assert.equal(clones[0].sourceAgentId, null, "clone is born manual, not attributed");
    assert.deepEqual(clones[0].sourceMessageRefs, [], "clone carries no source refs");
    await chats.removeMessages([msgD!.id]);
    assert.equal(await lorebooks.getEntry(folderEntry!.id), null, "original cascaded with its message");
    const cloneAfter = (await lorebooks.listEntries(book.id)).find((e) => e.folderId === newRootId);
    assert.ok(cloneAfter, "clone survives the source message's deletion");
  }

  // Message deletion must release its transaction before waiting on metadata queues.
  // Each nonempty chunk commits message and lore deletion together, with one lore scan.
  for (const bulk of [false, true]) {
    const chat = (await chats.create({ name: "Queued lore cleanup", mode: "roleplay", characterIds: [] }))!;
    const first = (await chats.createMessage({ chatId: chat.id, role: "assistant", content: "First" }))!;
    const last = (await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Last" }))!;
    const entry = (await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Queued fact",
      content: "Invented",
      sourceAgentId: "keeper",
      sourceMessageRefs: [{ id: first.id, swipeIndex: 0 }],
    }))!;
    await chats.patchMetadata(chat.id, { entryStateOverrides: { [entry.id]: { enabled: false } } });
    let releaseMetadata!: () => void;
    const metadataGate = new Promise<void>((resolve) => {
      releaseMetadata = resolve;
    });
    let metadataAcquired!: () => void;
    const acquired = new Promise<void>((resolve) => {
      metadataAcquired = resolve;
    });
    const edit = withChatMetadataPatchQueue(chat.id, async () => {
      metadataAcquired();
      await metadataGate;
      await chats.patchMetadata(chat.id, { concurrentSetting: "retained" }, { metadataQueueHeld: true });
    });
    await acquired;
    const originalTransaction = db.transaction;
    const originalSelect = db.select;
    let transactionEntered!: () => void;
    const entered = new Promise<void>((resolve) => {
      transactionEntered = resolve;
    });
    let loreScans = 0;
    db.transaction = ((operation: any) =>
      originalTransaction.call(db, async (tx: any) => {
        transactionEntered();
        return operation(tx);
      })) as typeof db.transaction;
    db.select = ((...args: any[]) => {
      const query = (originalSelect as any).apply(db, args);
      const from = query.from;
      query.from = (table: any) => {
        if (table === lorebookEntries) loreScans += 1;
        return from.call(query, table);
      };
      return query;
    }) as typeof db.select;
    // An uncaught watchdog also fails when a lock inversion prevents finally/closeDB from completing.
    const watchdog = setTimeout(() => {
      throw new Error("Message deletion and queued metadata deadlocked");
    }, 3000);
    try {
      const deletion = bulk
        ? chats.removeMessages([first.id, ...Array.from({ length: 499 }, (_, i) => `missing-${i}`), last.id], chat.id)
        : chats.removeMessage(first.id);
      await entered;
      releaseMetadata();
      await Promise.all([edit, deletion]);
      assert.equal(loreScans, bulk ? 2 : 1, "one agent-lore scan per nonempty deletion chunk");
    } finally {
      clearTimeout(watchdog);
      releaseMetadata();
      db.transaction = originalTransaction;
      db.select = originalSelect;
    }
    const metadata = JSON.parse((await chats.getById(chat.id))!.metadata);
    assert.equal(metadata.concurrentSetting, "retained");
    assert.deepEqual(metadata.entryStateOverrides, {});
    assert.equal(await lorebooks.getEntry(entry.id), null);
  }

  // A later chunk failure still cleans up lore from chunks already committed.
  {
    const chat = (await chats.create({ name: "Partial deletion", mode: "roleplay", characterIds: [] }))!;
    const entries = [];
    const messageIds = [];
    for (const content of ["Committed", "Failed"]) {
      const message = (await chats.createMessage({ chatId: chat.id, role: "assistant", content }))!;
      messageIds.push(message.id);
      entries.push(
        (await lorebooks.createEntry({
          lorebookId: book.id,
          name: content,
          content,
          sourceAgentId: "keeper",
          sourceMessageRefs: [{ id: message.id, swipeIndex: 0 }],
        }))!,
      );
    }
    await chats.patchMetadata(chat.id, {
      entryStateOverrides: Object.fromEntries(entries.map((entry) => [entry.id, { enabled: false }])),
    });
    const originalTransaction = db.transaction;
    const failure = new Error("Second deletion chunk failed");
    let transactions = 0;
    db.transaction = ((operation: any) => {
      if (++transactions === 2) return Promise.reject(failure);
      return originalTransaction.call(db, operation);
    }) as typeof db.transaction;
    try {
      await assert.rejects(
        chats.removeMessages(
          [messageIds[0], ...Array.from({ length: 499 }, (_, i) => `absent-${i}`), messageIds[1]],
          chat.id,
        ),
        (error) => error === failure,
      );
    } finally {
      db.transaction = originalTransaction;
    }
    assert.equal(await chats.getMessage(messageIds[0]), null);
    assert.ok(await chats.getMessage(messageIds[1]));
    assert.equal(await lorebooks.getEntry(entries[0].id), null, "committed deletion cascades despite a later failure");
    assert.ok(await lorebooks.getEntry(entries[1].id), "failed deletion preserves its lore");
    assert.deepEqual(JSON.parse((await chats.getById(chat.id))!.metadata).entryStateOverrides, {
      [entries[1].id]: { enabled: false },
    });
  }

  // A lore-write failure rolls back the message deletion in the same chunk.
  {
    const chat = (await chats.create({ name: "Atomic lore cleanup", mode: "roleplay", characterIds: [] }))!;
    const message = (await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Retained" }))!;
    const entry = (await lorebooks.createEntry({
      lorebookId: book.id,
      name: "Retained fact",
      content: "Retained",
      sourceAgentId: "keeper",
      sourceMessageRefs: [{ id: message.id, swipeIndex: 0 }],
    }))!;
    const originalDelete = db.delete;
    const failure = new Error("Lore deletion failed");
    db.delete = ((table: any) => {
      if (table === lorebookEntries) throw failure;
      return originalDelete.call(db, table);
    }) as typeof db.delete;
    try {
      await assert.rejects(chats.removeMessages([message.id], chat.id), (error) => error === failure);
    } finally {
      db.delete = originalDelete;
    }
    assert.ok(await chats.getMessage(message.id), "failed lore cleanup rolls back its message deletion");
    assert.ok(await lorebooks.getEntry(entry.id), "failed chunk preserves both sides of the source link");
  }

  // Mari treats provenance arrays as JSON, including their stored undo references.
  {
    const mari = new MariDbService(db);
    const entry = (await lorebooks.createEntry({
      lorebookId: book.id,
      name: "JSON provenance",
      content: "Fixture",
      sourceAgentId: "keeper",
      sourceMessageRefs: [{ id: "json-source", swipeIndex: 0 }],
    }))!;
    const result = await mari.executeCli({ argv: ["db", "get", "--parsed", "lorebook_entries", entry.id] });
    assert.deepEqual((result.output as any).sourceMessageRefs, [{ id: "json-source", swipeIndex: 0 }]);
    for (const key of ["sourceMessageRefs", "previousSourceMessageRefs"] as const) {
      await db
        .update(lorebookEntries)
        .set({ [key]: "broken JSON" })
        .where(eq(lorebookEntries.id, entry.id));
      const validation = await mari.validate("lorebook_entries");
      assert.ok(validation.errors.some((issue) => issue.id === entry.id && issue.message.includes(key)));
      await db
        .update(lorebookEntries)
        .set({ [key]: "[]" })
        .where(eq(lorebookEntries.id, entry.id));
    }
  }

  console.log("Lorebook entry message provenance regressions passed.");
} finally {
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
