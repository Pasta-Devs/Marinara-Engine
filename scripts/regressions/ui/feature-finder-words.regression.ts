import assert from "node:assert/strict";
import { matchFeatures, normalizeFeatureText } from "../../../packages/client/src/lib/feature-finder.js";

// Someone's own word for a feature leads to what Marinara calls it (feature discoverability, Ctrl+K).
const first = (query: string) => matchFeatures(query)[0];

assert.equal(first("chat preset")?.feature.id, "settingsProfiles", "SillyTavern's word finds settings profiles");
assert.equal(first("Chat Presets")?.feature.id, "settingsProfiles", "case and plural don't matter");
assert.equal(first("chat preset")?.fromSillyTavern, true, "the row can say which SillyTavern word matched");
assert.equal(
  first("how do I make chat presets?")?.feature.id,
  "settingsProfiles",
  "the word inside a question still matches",
);
assert.equal(first("chat pre")?.feature.id, "settingsProfiles", "typing the start of the word matches");
assert.equal(first("world info")?.feature.id, "lorebooks");
assert.equal(first("author's note")?.feature.id, "authorsNotes");
assert.equal(first("authors note")?.feature.id, "authorsNotes", "with or without the apostrophe");
assert.equal(first("prompt itemization")?.feature.id, "peekPrompt");
assert.equal(first("qr")?.feature.id, "quickReplies", "a short word matches only on its own");
assert.equal(matchFeatures("qrcode").length, 0, "a short word never fires inside another word");
assert.equal(matchFeatures("a").length, 0, "one letter matches nothing");
assert.equal(matchFeatures("Tavern Night").length, 0, "a chat name that contains 'tavern' is not SillyTavern");
assert.equal(matchFeatures("eliza").length, 0, "a character name matches nothing");
assert.equal(normalizeFeatureText("Author’s Notes!"), "author note");
// SillyTavern's chat completion preset is the prompt and sampler preset: Presets, not Settings profiles.
assert.equal(first("chat completion preset")?.feature.id, "presets");
assert.equal(first("AI Response Configuration")?.feature.id, "presets");
assert.equal(first("samplers")?.feature.id, "presets");
assert.equal(first("prompt manager")?.feature.id, "presets");
assert.equal(first("regex")?.feature.id, "regexScripts");
assert.equal(first("group chats")?.feature.id, "groupChats");
assert.equal(first("instruct template")?.feature.id, "instruct");
assert.equal(first("advanced formatting")?.feature.id, "instruct");
console.log("feature finder words: OK");
