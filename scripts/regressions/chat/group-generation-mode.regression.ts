// Group chats: whether each mode generates one reply per character or one merged reply, and when a regeneration goes
// back to the same character.
import assert from "node:assert/strict";
import {
  resolveGroupGenerationMode,
  shouldRestoreRegenerationCharacterTarget,
} from "../../../packages/server/src/routes/generate/generate-route-utils.js";

assert.equal(resolveGroupGenerationMode("conversation", "individual"), "individual");
assert.equal(resolveGroupGenerationMode("conversation", "merged"), "merged");
assert.equal(
  resolveGroupGenerationMode("conversation", undefined),
  "merged",
  "pre-existing Conversation groups without mode metadata must retain Grouped behavior",
);
assert.equal(resolveGroupGenerationMode("roleplay", "individual"), "individual");
assert.equal(resolveGroupGenerationMode("roleplay", "merged"), "merged");
assert.equal(shouldRestoreRegenerationCharacterTarget("roleplay", "merged", ["a", "b"]), false);
assert.equal(shouldRestoreRegenerationCharacterTarget("roleplay", "individual", ["a", "b"]), true);
assert.equal(shouldRestoreRegenerationCharacterTarget("roleplay", "merged", ["a"]), true);
