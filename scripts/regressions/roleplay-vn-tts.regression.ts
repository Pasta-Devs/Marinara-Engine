import assert from "node:assert/strict";
import { ttsConfigSchema } from "../../packages/shared/src/types/tts.js";
import { buildTTSVoiceRequests, withTTSVoiceRequestCacheKeys } from "../../packages/client/src/lib/tts-dialogue.js";
import { withRoleplayTTSParagraphs } from "../../packages/client/src/lib/roleplay-vn-tts.js";

const config = ttsConfigSchema.parse({ enabled: true, voice: "narrator", dialogueOnly: false });
const content = 'First paragraph.\n\n"Second paragraph."\n\nLast paragraph.';
const requests = withRoleplayTTSParagraphs(buildTTSVoiceRequests(content, config), content, config);
assert.deepEqual(
  requests.map((request) => request.paragraphIndex),
  [0, 1, 2],
);
assert.deepEqual(
  requests.map((request) => request.text),
  ["First paragraph.", '"Second paragraph."', "Last paragraph."],
);
assert.ok(requests.every((request) => request.voice === "narrator"));
assert.equal(withTTSVoiceRequestCacheKeys(requests, config, "message")[2]!.paragraphIndex, 2);
const repeated = "Again.\n\nAgain.";
assert.deepEqual(
  withRoleplayTTSParagraphs([{ text: "Again." }, { text: "Again.", pauseAfterMs: 500 }], repeated, config).map(
    (request) => [request.paragraphIndex, request.pauseAfterMs],
  ),
  [
    [0, undefined],
    [1, 500],
  ],
);
const filtered = "First.\n\n```js\nsecret\n```\n\nLast.";
const filteredRequests = withRoleplayTTSParagraphs(buildTTSVoiceRequests(filtered, config), filtered, config);
assert.deepEqual(
  filteredRequests.map((request) => request.paragraphIndex),
  [0, 2],
);
assert.ok(filteredRequests.every((request) => !request.text.includes("secret")));
const dialogue = '<speaker="Alice">"Hello."</speaker>\n\n<speaker="Bob">"Goodbye."</speaker>';
const dialogueConfig = { ...config, dialogueOnly: true, dialoguePauseMs: 250 };
const dialogueRequests = withRoleplayTTSParagraphs(
  buildTTSVoiceRequests(dialogue, dialogueConfig),
  dialogue,
  dialogueConfig,
);
assert.deepEqual(
  dialogueRequests.map((request) => [request.speaker, request.paragraphIndex]),
  [
    ["Alice", 0],
    ["Bob", 1],
  ],
);
const rewritten = [{ text: "The extractor paraphrased this.", voice: "alice" }];
assert.deepEqual(withRoleplayTTSParagraphs(rewritten, content, config), rewritten, "unmatched speech remains intact");
assert.deepEqual(
  withRoleplayTTSParagraphs(requests, '"Second paragraph."\n\nLast paragraph.', config, false).map(
    (request) => request.paragraphIndex,
  ),
  [undefined, 0, 1],
  "display regex removal must clear stale source indices and follow the remaining displayed paragraphs",
);
assert.deepEqual(
  withRoleplayTTSParagraphs(requests, content.replaceAll("\n\n", " "), config, false).map(
    (request) => request.paragraphIndex,
  ),
  [0, 0, 0],
  "display regex merging must retain request order while following the single displayed paragraph",
);
console.log("Roleplay VN speech paragraph regressions passed.");
