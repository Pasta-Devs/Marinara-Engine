// Emoji: standard shortcodes and searching them, and filtering custom emoji by name.
import assert from "node:assert/strict";
import { filterCustomEmojisByName } from "../../../packages/client/src/lib/custom-emoji.js";
import {
  resolveStandardEmojiShortcode,
  searchStandardEmojiShortcodes,
} from "../../../packages/client/src/lib/emoji-shortcodes.js";

assert.equal(resolveStandardEmojiShortcode("crying"), "😢");
assert.equal(resolveStandardEmojiShortcode("test_tube"), "🧪");
assert.equal(
  searchStandardEmojiShortcodes("cry", 5).some((entry) => entry.name === "crying"),
  true,
);
assert.deepEqual(
  filterCustomEmojisByName(
    [
      { name: "MariWave", id: "wave" },
      { name: "dottore_stare", id: "stare" },
    ],
    "mari",
  ),
  [{ name: "MariWave", id: "wave" }],
);
