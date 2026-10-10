import assert from "node:assert/strict";
import { isQuestionShaped } from "../../packages/client/src/lib/omnibar-scope.js";

// Ctrl/⌘+J carries only question-shaped text into Mari's composer (UX-22). Half-typed searches open her empty.
assert.equal(isQuestionShaped("why is my lorebook empty"), true, "a wh-question carries");
assert.equal(isQuestionShaped("Can I use two presets?"), true, "a question mark carries");
assert.equal(isQuestionShaped("is it slow"), true, "an auxiliary question carries");
assert.equal(isQuestionShaped("lorebook"), false, "a bare search word does not carry");
assert.equal(isQuestionShaped("make eliza meaner"), false, "a request without a question shape does not carry");
assert.equal(isQuestionShaped("faq: why is it slow"), true, "the scope prefix is stripped before the check");
assert.equal(isQuestionShaped("   "), false, "blank text does not carry");
console.log("omnibar question shape: OK");
