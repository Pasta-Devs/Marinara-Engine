import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateSpriteExpressionEntries } from "../../packages/server/src/routes/generate/expression-agent-utils.js";

// 1. A null entry in a model-produced expressions array is skipped, not thrown on.
{
  const available = [{ characterId: "c1", characterName: "Ada", expressions: ["happy", "sad"] }];
  let result: ReturnType<typeof validateSpriteExpressionEntries> | undefined;
  assert.doesNotThrow(() => {
    result = validateSpriteExpressionEntries(
      [null, { characterId: "c1", characterName: "Ada", expression: "happy" }] as any,
      available,
    );
  });
  assert.equal(result!.expressions.length, 1);
  assert.equal((result!.expressions[0] as any).characterId, "c1");
  assert.ok(result!.warnings.some((w) => /Malformed expression entry/.test(w.message)));
}

// The /dryRun route needs a full app, provider and chat fixture, so the remaining
// checks assert on the route source.
const source = readFileSync(
  new URL("../../packages/server/src/routes/generate/dry-run-route.ts", import.meta.url),
  "utf8",
);

// 2. Client disconnect is detected on the response, not on the already-closed request.
assert.ok(!/req\.raw\.on\("close"/.test(source), "dry-run must not listen for req.raw close");
assert.ok(!/req\.raw\.off\("close"/.test(source), "dry-run must not detach from req.raw close");
assert.equal(source.match(/reply\.raw\.on\("close", onClose\)/g)?.length, 2, "both branches listen on reply.raw close");
assert.equal(source.match(/reply\.raw\.off\("close", onClose\)/g)?.length, 2, "both branches detach from reply.raw close");
assert.equal(
  source.match(/if \(completed \|\| reply\.raw\.writableEnded\) return;/g)?.length,
  2,
  "a normal finish must not count as an abort",
);

// 3. The regenerate target is removed from history for every chat mode.
assert.match(
  source,
  /if \(regenerateMessageId\) \{\s*\/\/[^\n]*\n\s*chatMessages = chatMessages\.filter\(\(message: any\) => message\.id !== regenerateMessageId\);/,
);

// 4. An abort that returns partial content reports "aborted", not a normal result.
assert.equal(
  source.match(/if \(abortController\.signal\.aborted \|\| result\.finishReason === "abort"\) \{/g)?.length,
  2,
  "both branches check for an abort result",
);
const streamAbortIdx = source.indexOf('sendSseEvent(reply, { type: "aborted", data: full ? { content: full } : "" });');
const streamResultIdx = source.indexOf('sendSseEvent(reply, { type: "result"');
assert.ok(streamAbortIdx > 0 && streamAbortIdx < streamResultIdx, "abort check runs before the result event");
assert.match(source, /reply\.send\(\{ aborted: true, runId, \.\.\.\(partialContent \? \{ partialContent \} : \{\}\) \}\)/);

console.log("server-hunt-b17 regression passed");
