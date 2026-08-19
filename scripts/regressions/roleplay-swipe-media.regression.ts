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
assert.match(regeneratingMessage, /storyboard=\{null\}/u);
assert.match(regeneratingMessage, /storyboardGenerating=\{false\}/u);

process.stdout.write("Roleplay swipe media regression passed.\n");
