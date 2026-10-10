import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";
import { createChatsStorage } from "../../../packages/server/src/services/storage/chats.storage.js";

const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const dir = mkdtempSync(join(tmpdir(), "marinara-mari-chat-update-message-"));
process.env.FILE_STORAGE_DIR = dir;

try {
  const db = await createFileNativeDB();
  try {
    const chats = createChatsStorage(db);
    const mari = new MariDbService(db);

    // L5: a non-game chat with a cut-off assistant reply.
    const chat = await chats.create({
      name: "Reply fix regression",
      mode: "roleplay",
      characterIds: ["character-a"],
    });
    const broken = await chats.createMessage({
      chatId: chat.id,
      role: "assistant",
      content: "The door creaked open and she sa",
    });
    assert.ok(broken);
    const messageId = broken!.id;

    // Keep path: apply never overwrites - it adds a new swipe and makes it active, so both
    // texts exist as swipes right away.
    const applied = await mari.executeAction({
      action: "chat.updateMessage",
      chatId: chat.id,
      messageId,
      content: "The door creaked open and she said nothing.",
      reason: "Reply was cut off mid-sentence",
      apply: true,
    });
    assert.equal(applied.ok, true, "chat.updateMessage should apply");
    assert.equal(applied.approval?.status, "pending", "chat.updateMessage always stages a review");
    const keepReviewId = applied.approval!.id!;

    const afterApply = await chats.getMessage(messageId);
    assert.equal(afterApply?.content, "The door creaked open and she said nothing.", "the fix is active");
    assert.equal(afterApply?.activeSwipeIndex, 1, "the new swipe is active, not swipe 0");
    const swipesAfterApply = await chats.getSwipes(messageId);
    assert.deepEqual(
      swipesAfterApply.map((swipe) => swipe.content),
      ["The door creaked open and she sa", "The door creaked open and she said nothing."],
      "the broken original is kept as swipe 0, the fix is added as swipe 1 - never overwritten",
    );

    // Keep: the fix stays applied; both swipes remain (the broken original stays reachable).
    await mari.keepAppliedReview(keepReviewId);
    assert.ok(
      !mari.getPendingApprovals().some((approval) => approval.id === keepReviewId),
      "Keep resolves the review",
    );
    const afterKeep = await chats.getMessage(messageId);
    assert.equal(afterKeep?.content, "The door creaked open and she said nothing.", "Keep leaves the fix active");
    const swipesAfterKeep = await chats.getSwipes(messageId);
    assert.equal(swipesAfterKeep.length, 2, "Keep keeps both texts as swipes");

    // Restore path: a second broken reply, fixed, then restored.
    const secondBroken = await chats.createMessage({
      chatId: chat.id,
      role: "narrator",
      content: "The storm rolled in ac",
    });
    const secondMessageId = secondBroken!.id;
    const secondApplied = await mari.executeAction({
      action: "chat.updateMessage",
      chatId: chat.id,
      messageId: secondMessageId,
      content: "The storm rolled in across the bay.",
      reason: "Reply was cut off mid-sentence",
      apply: true,
    });
    assert.equal(secondApplied.approval?.status, "pending");
    const restoreReviewId = secondApplied.approval!.id!;
    const swipesBeforeRestore = await chats.getSwipes(secondMessageId);
    assert.equal(swipesBeforeRestore.length, 2, "both texts exist as swipes before Restore resolves anything");

    const restored = await mari.restoreAppliedReview(restoreReviewId);
    assert.ok(restored && "history" in restored, "Restore should resolve the review, not report a state change");
    assert.ok(
      !mari.getPendingApprovals().some((approval) => approval.id === restoreReviewId),
      "Restore resolves the review",
    );
    const afterRestore = await chats.getMessage(secondMessageId);
    assert.equal(afterRestore?.content, "The storm rolled in ac", "Restore puts the old reply back as active");
    assert.equal(afterRestore?.activeSwipeIndex, 0, "Restore sets the old swipe active, through chat storage");
    const swipesAfterRestore = await chats.getSwipes(secondMessageId);
    assert.equal(swipesAfterRestore.length, 1, "Restore removes the fixed swipe through chat storage, not a raw row restore");
    assert.equal(swipesAfterRestore[0]?.content, "The storm rolled in ac");

    // #L7 review finding #1: a missing/false `apply` must stay a dry-run preview, even in
    // Permissions Mode Plan (where isPreviewOnlyAppDataCommand treats apply:false as non-mutating
    // and lets it through the Plan-mode floor) - the message and its swipes must be untouched.
    const thirdBroken = await chats.createMessage({
      chatId: chat.id,
      role: "assistant",
      content: "The lantern flickered onc",
    });
    const thirdMessageId = thirdBroken!.id;
    const dryRun = await mari.executeAction({
      action: "chat.updateMessage",
      chatId: chat.id,
      messageId: thirdMessageId,
      content: "The lantern flickered once and died.",
      apply: false,
    });
    assert.equal(dryRun.ok, true, "a dry-run chat.updateMessage should still report ok");
    assert.equal(dryRun.mode, "dry-run", "apply:false must report dry-run, not apply");
    assert.equal(dryRun.approval?.status, "not_required", "a dry-run never stages a review");
    const afterDryRun = await chats.getMessage(thirdMessageId);
    assert.equal(afterDryRun?.content, "The lantern flickered onc", "a dry-run must not change the message content");
    const swipesAfterDryRun = await chats.getSwipes(thirdMessageId);
    assert.equal(swipesAfterDryRun.length, 1, "a dry-run must not add a new swipe");

    const missingApplyRun = await mari.executeAction({
      action: "chat.updateMessage",
      chatId: chat.id,
      messageId: thirdMessageId,
      content: "The lantern flickered once and died.",
    });
    assert.equal(missingApplyRun.mode, "dry-run", "a missing apply must default to dry-run, like every other app_data write");
    assert.equal((await chats.getSwipes(thirdMessageId)).length, 1, "a missing apply must not add a new swipe either");

    // Slice 68: a message-search row id `message:<chatId>:<n>` (post number) resolves to that post.
    const postNumber = (await chats.listMessages(chat.id)).findIndex((m) => m.id === thirdMessageId) + 1;
    const byPost = await mari.executeAction({
      action: "chat.updateMessage",
      chatId: chat.id,
      messageId: `message:${chat.id}:${postNumber}`,
      content: "The lantern flickered once and died.",
      apply: false,
    });
    assert.equal(byPost.ok, true, "a post-number row id must resolve to its message");
    assert.equal(byPost.mode, "dry-run");

    // #L7 review finding #2: `mari db transform all <script>` must never reach messages/message_swipes.
    // "all" now expands without the message tables (resolveTransformTables, pinned in
    // command-center), so the untrusted script never gets them; a nonexistent script still fails.
    const transformAllResult = await mari.executeCli({
      argv: ["db", "transform", "all", join(dir, "does-not-exist.mjs"), "--apply"],
    });
    assert.equal(transformAllResult.ok, false, "a transform with a missing script fails");
    assert.equal(
      (await chats.getMessage(messageId))?.content,
      "The door creaked open and she said nothing.",
      "transform all must not have touched the messages table",
    );

    // Guard rails: user messages, and game chats, are out of scope. executeAction never rejects -
    // it catches and reports failure through the result (ok:false + error), same as every other
    // app_data action - so these assert on the returned result, not a thrown rejection.
    const userMessage = await chats.createMessage({ chatId: chat.id, role: "user", content: "Hi" });
    const userMessageResult = await mari.executeAction({
      action: "chat.updateMessage",
      chatId: chat.id,
      messageId: userMessage!.id,
      content: "Hello",
      apply: true,
    });
    assert.equal(userMessageResult.ok, false, "chat.updateMessage must refuse a user message");
    assert.match(String(userMessageResult.error), /assistant or narrator/);

    const gameChat = await chats.create({ name: "Game chat", mode: "game", characterIds: ["character-a"] });
    const gameMessage = await chats.createMessage({ chatId: gameChat.id, role: "assistant", content: "cut off h" });
    const gameChatResult = await mari.executeAction({
      action: "chat.updateMessage",
      chatId: gameChat.id,
      messageId: gameMessage!.id,
      content: "cut off here.",
      apply: true,
    });
    assert.equal(gameChatResult.ok, false, "chat.updateMessage must refuse a game chat");
    assert.match(String(gameChatResult.error), /non-game chats/);

    // Raw mari db writes to messages/message_swipes are refused outright.
    const rawPatch = await mari.executeCli({ argv: ["db", "patch", "messages", messageId, "--json", '{"content":"hacked"}', "--apply"] });
    assert.equal(rawPatch.ok, false, "a raw mari db patch to messages must fail");
    assert.match(String(rawPatch.error), /chat\.updateMessage/);
    const rawInsert = await mari.executeCli({
      argv: ["db", "insert", "message_swipes", "--json", JSON.stringify({ messageId, index: 99, content: "hacked" }), "--apply"],
    });
    assert.equal(rawInsert.ok, false, "a raw mari db insert to message_swipes must fail");
    assert.match(String(rawInsert.error), /chat\.updateMessage/);
  } finally {
    await db._fileStore.close();
  }
} finally {
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(dir, { recursive: true, force: true });
}

console.log("Mari chat.updateMessage regressions passed.");
