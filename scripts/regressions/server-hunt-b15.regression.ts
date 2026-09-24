import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Server hunt batch 15 (routes/generate.routes.ts):
// 1. The eager game-state snapshot promise gets a rejection handler as soon as it is created.
// 2. The cross-chat awareness name map is keyed by each character's own id.
// 3. A tool round whose streamed text the provider parsed into tool calls drops that markup.
// 4. A tool round writes result.content only when nothing streamed in the round (no suffix test).
// 5. A continuation that yields only commands/verbs anchors to the continued message and keeps
//    the issued command content on it.
// 6. NPC avatar generation skips names whose slug is empty.
// 7. Illustrator fields are type-checked before .trim() (also in retry-agents-route.ts).
// 8. Illustration and roleplay-sound attachments use one locked swipe+mirror append (behavioural),
//    and a message without swipe rows still gets the mirror write.
// 9. The illustrator log does not call .slice on a non-string reason.
// 10. The conversation summary connection carries claudeFastMode / treatAsLocalEndpoint / defaultParameters.
// Items 1-7, 9 and 10 live deep inside the /generate route and need a live LLM, so they are pinned by
// source assertions. Item 8 is exercised against a real file-backed store.

const root = mkdtempSync(join(tmpdir(), "marinara-server-hunt-b15-"));
process.env.DATA_DIR = root;
process.env.FILE_STORAGE_DIR = join(root, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

const source = readFileSync(new URL("../../packages/server/src/routes/generate.routes.ts", import.meta.url), "utf8");
const retrySource = readFileSync(
  new URL("../../packages/server/src/routes/generate/retry-agents-route.ts", import.meta.url),
  "utf8",
);

// 1. Snapshot promise handled immediately.
{
  const created = source.indexOf("const selectedGameStateSnapshotPromise = Promise.all([");
  assert.notEqual(created, -1);
  const nextDecl = source.indexOf("const selectedGameStateForPrompt", created);
  assert.match(
    source.slice(created, nextDecl),
    /void selectedGameStateSnapshotPromise\.catch\(\(\) => undefined\);/u,
    "the derived snapshot promise must be marked handled right after it is created",
  );
}

// 2. Awareness name map keyed by charId.
{
  const start = source.indexOf("const charNameMap = new Map<string, string>();");
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf("buildAwarenessBlock(", start));
  assert.match(block, /for \(const info of convoCharInfo\) charNameMap\.set\(info\.charId, info\.name\);/u);
  assert.doesNotMatch(block, /characterIds\[ci\]/u, "index pairing shifts names when a character row is missing");
}

// 3 + 4. Tool loop streamed text handling.
{
  const start = source.indexOf("const roundResponseStart = fullResponse.length;");
  assert.notEqual(start, -1);
  const loop = source.slice(start, source.indexOf("if (!result.toolCalls.length) break;", start));
  assert.doesNotMatch(loop, /fullResponse\.endsWith\(result\.content\)/u);
  assert.match(loop, /if \(result\.content && fullResponse\.length === roundResponseStart\)/u);
  assert.match(
    loop,
    /!gameToolPlan &&\s*result\.toolCalls\.length &&\s*!result\.content &&\s*fullResponse\.length > roundResponseStart/u,
  );
  assert.match(loop, /fullResponse = fullResponse\.slice\(0, roundResponseStart\);/u);
  assert.match(loop, /type: "content_replace", data: fullResponse/u);
}

// 5. Hidden anchor honours continueMessageId.
{
  const start = source.indexOf("saving hidden command anchor");
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf("[generate] Empty response from model", start));
  assert.match(
    block,
    /: input\.continueMessageId\s*\?\s*\(\(await chats\.getMessage\(input\.continueMessageId\)\) \?\? continueTargetMessage\)/u,
  );
  assert.match(block, /if \(savedMsg\?\.id && !input\.continueMessageId\) \{\s*anchoredMsg = await chats\.updateMessageExtra/u);
  assert.match(block, /continuation: Boolean\(input\.continueMessageId\)/u);
  assert.doesNotMatch(block, /continuation: false/u);
  assert.match(block, /chatMode === "conversation" && !input\.regenerateMessageId && !input\.continueMessageId/u);
  // Review fix: the continued message records the command content this continuation issued,
  // appended to what it already carried, without being marked hidden or command-only.
  const cont = block.slice(block.indexOf("} else if (savedMsg?.id && input.continueMessageId) {"));
  assert.ok(cont.length > 0 && block.includes("} else if (savedMsg?.id && input.continueMessageId) {"));
  const contBody = cont.slice(0, cont.indexOf("markInjectedConnectedInfluencesConsumed"));
  assert.match(contBody, /continuedExtraPatch\.conversationCommandContent = appendContinuationMessageContent\(/u);
  assert.match(contBody, /existingCommandContent,\s*conversationCommandContent,\s*input\.continueAddsNewline/u);
  assert.doesNotMatch(contBody, /hiddenFromUser|hiddenFromAI|commandOnly: true/u);
  // Main's scene-request anchor stays visible and announced.
  assert.match(block, /hiddenFromUser: !sceneRequest/u);
  assert.match(block, /if \(sceneRequest && anchoredMsg\?\.id\) \{\s*sendSseEvent\(reply, \{ type: "message_saved", data: anchoredMsg \}\)/u);
  const { appendContinuationMessageContent } = await import("../../packages/server/node_modules/@marinara-engine/shared/dist/index.js");
  const merged = appendContinuationMessageContent("Earlier line", "[selfie: beach]", false);
  assert.ok(merged.includes("Earlier line") && merged.includes("[selfie: beach]"), "merge keeps both parts");
}

// 6. Empty NPC slug skipped before the image call.
{
  const start = source.indexOf("for (const npc of charsNeedingAvatars) {");
  assert.notEqual(start, -1);
  const body = source.slice(start, source.indexOf("writeFileSync(join(npcDir", start));
  const guard = body.indexOf("if (!safeName) continue;");
  assert.notEqual(guard, -1, "an empty slug must skip the NPC");
  assert.ok(guard < body.indexOf("await generateImage("), "the guard must run before the paid image call");
  assert.equal(body.match(/const safeName = npcAvatarSlug\(npcName\);/gu)?.length, 1);
  const { npcAvatarSlug } = await import("../../packages/server/src/services/game/npc-avatar-utils.js");
  assert.equal(npcAvatarSlug("???"), "", "the case the guard exists for");
}

// 7 + 9. Illustrator field coercion.
for (const [label, text] of [
  ["generate.routes.ts", source],
  ["retry-agents-route.ts", retrySource],
] as const) {
  assert.doesNotMatch(text, /\(\(illData\.(prompt|negativePrompt|style) as string\) \?\? ""\)\.trim\(\)/u, label);
  assert.match(text, /typeof illData\.prompt === "string" \? illData\.prompt\.trim\(\) : ""/u, label);
  assert.match(text, /typeof illData\.style === "string"/u, label);
}
for (const text of [source, retrySource]) {
  assert.doesNotMatch(text, /\(illData\.reason as string\)/u);
  assert.doesNotMatch(text, /reason: illData\.reason,/u, "SSE reason is type-checked");
  assert.match(text, /reason: typeof illData\.reason === "string" \? illData\.reason : undefined,/u);
}
// The illustration log line only slices the reason when it is a string.
assert.match(source, /\(typeof illData\.reason === "string" \? illData\.reason : imagePrompt\)\.slice\(0, 80\)/u);

// 10. Summary connection inherits the connection's custom parameters.
{
  const start = source.indexOf("await prepareConversationPromptHistory({");
  assert.notEqual(start, -1);
  const call = source.slice(start, source.indexOf("connectionId: conn.id", start));
  assert.match(call, /claudeFastMode: conn\.claudeFastMode/u);
  assert.match(call, /treatAsLocalEndpoint: conn\.treatAsLocalEndpoint/u);
  assert.match(call, /defaultParameters: conn\.defaultParameters/u);
}

// 8. Swipe + mirror attachment append is one critical section (behavioural).
assert.doesNotMatch(source, /await chats\.appendSwipeAttachment\(/u, "generate route uses the combined locked append");
assert.equal(source.match(/chats\.appendSwipeAttachmentAndActiveMirror\(/gu)?.length, 2);

let db: any = null;
try {
  const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  db = await createFileNativeDB();
  const chats = createChatsStorage(db);
  const chat = await chats.create({
    name: "b15",
    mode: "roleplay",
    characterIds: [],
    groupId: null,
    personaId: null,
    promptPresetId: null,
    connectionId: null,
  } as any);
  const msg = await chats.createMessage({ chatId: chat!.id, role: "assistant", characterId: null, content: "first" });
  await chats.addSwipe(msg!.id, "second");
  const parse = (extra: unknown) => (typeof extra === "string" ? JSON.parse(extra) : (extra ?? {})) as any;
  const attachmentUrls = (extra: unknown) => (parse(extra).attachments ?? []).map((a: any) => a.url);

  // Active swipe is 1. Append to it while a switch to swipe 0 is queued right behind the append.
  assert.equal((await chats.getMessage(msg!.id))?.activeSwipeIndex, 1);
  const appended = chats.appendSwipeAttachmentAndActiveMirror(msg!.id, 1, { type: "image", url: "/img-1" });
  const switched = chats.setActiveSwipe(msg!.id, 0);
  const mirror = await appended;
  await switched;
  assert.deepEqual(attachmentUrls(mirror?.extra), ["/img-1"], "the mirror write happened while swipe 1 was active");
  const swipesAfterSwitch = await chats.getSwipes(msg!.id);
  assert.deepEqual(
    attachmentUrls(swipesAfterSwitch.find((s: any) => s.index === 1)?.extra),
    ["/img-1"],
    "the swipe switch must not erase the attachment from swipe 1",
  );
  assert.deepEqual(attachmentUrls((await chats.getMessage(msg!.id))?.extra), [], "swipe 0 shows no attachment");

  // Swipe 0 is active now: appending to swipe 1 writes the swipe row only and leaves the mirror alone.
  const inactive = await chats.appendSwipeAttachmentAndActiveMirror(msg!.id, 1, { type: "image", url: "/img-2" });
  assert.equal(inactive, null);
  assert.deepEqual(
    attachmentUrls((await chats.getMessage(msg!.id))?.extra),
    [],
    "inactive swipe never reaches the mirror",
  );
  await chats.setActiveSwipe(msg!.id, 1);
  assert.deepEqual(attachmentUrls((await chats.getMessage(msg!.id))?.extra), ["/img-1", "/img-2"]);

  // Unknown swipe index is a no-op.
  assert.equal(await chats.appendSwipeAttachmentAndActiveMirror(msg!.id, 9, { url: "/nope" }), null);

  // Review fix: a message with no swipe rows (for example restored from trash without them)
  // still gets the attachment on the message mirror when the index is its active one.
  const { messageSwipes } = await import("../../packages/server/src/db/schema/index.js");
  const { eq } = await import("../../packages/server/src/db/file-query.js");
  const bare = await chats.createMessage({ chatId: chat!.id, role: "assistant", characterId: null, content: "bare" });
  await db.delete(messageSwipes).where(eq(messageSwipes.messageId, bare!.id));
  assert.equal((await chats.getSwipes(bare!.id)).length, 0, "setup: no swipe rows");
  const bareActive = (await chats.getMessage(bare!.id))?.activeSwipeIndex ?? 0;
  const bareResult = await chats.appendSwipeAttachmentAndActiveMirror(bare!.id, bareActive, { url: "/bare" });
  assert.deepEqual(attachmentUrls(bareResult?.extra), ["/bare"], "missing swipe row must not drop the attachment");
  assert.deepEqual(attachmentUrls((await chats.getMessage(bare!.id))?.extra), ["/bare"]);
} finally {
  try {
    await db?.close?.();
  } catch {
    /* ignore */
  }
  rmSync(root, { recursive: true, force: true });
}

process.stdout.write("Server hunt batch 15 regression passed.\n");
