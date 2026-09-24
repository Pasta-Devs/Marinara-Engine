import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Gemini Omni returns the MP4 as base64 inside a JSON body. The transport cap must
// allow for base64 overhead (MAX_VIDEO_JSON_RESPONSE_BYTES), while the decoded MP4
// is still held to MAX_VIDEO_RESPONSE_BYTES. The request goes through safeFetch with
// a public-https-only policy, so this is checked on source text.
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = readFileSync(join(root, "packages/server/src/services/video/video-generation.ts"), "utf8");

const start = source.indexOf("async function generateGeminiOmniVideo(");
assert.ok(start >= 0, "generateGeminiOmniVideo should exist");
const end = source.indexOf("\nasync function ", start + 1);
const omni = source.slice(start, end > start ? end : undefined);

assert.match(omni, /maxResponseBytes:\s*MAX_VIDEO_JSON_RESPONSE_BYTES\b/, "Omni JSON fetch should use the JSON response cap");
assert.doesNotMatch(omni, /maxResponseBytes:\s*MAX_VIDEO_RESPONSE_BYTES\b/, "Omni JSON fetch must not use the raw video cap");
assert.match(
  omni,
  /buffer\.length\s*>\s*MAX_VIDEO_RESPONSE_BYTES/,
  "decoded Omni MP4 should still be held to the raw video cap",
);

console.log("server-hunt-b55 regression passed");
