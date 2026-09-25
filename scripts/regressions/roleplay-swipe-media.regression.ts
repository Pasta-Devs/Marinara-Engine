import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../packages/client/src/components/chat/ChatRoleplaySurface.tsx", import.meta.url),
  "utf8",
);
const start = source.indexOf("function RegeneratingMessageContent");
const end = source.indexOf("function readStringArray", start);

assert.notEqual(start, -1);
assert.notEqual(end, -1);

const regeneratingMessage = source.slice(start, end);
assert.match(regeneratingMessage, /attachments: null/u);
// A message being written from scratch shows none of the old one's media. A continuation is the
// same reply going on, so it keeps the storyboard it already had: #6396 made both true at once, and
// this pins the pair rather than the old unconditional null.
assert.match(regeneratingMessage, /storyboard=\{isContinuation \? rest\.storyboard : null\}/u);
assert.match(regeneratingMessage, /storyboardGenerating=\{isContinuation \? rest\.storyboardGenerating : false\}/u);
assert.match(regeneratingMessage, /const isContinuation = /u, "and the flag those two read is worked out here");

process.stdout.write("Roleplay swipe media regression passed.\n");
