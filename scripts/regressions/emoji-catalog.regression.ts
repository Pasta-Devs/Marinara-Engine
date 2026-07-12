import assert from "node:assert/strict";
import { EMOJI_CATEGORIES, EMOJI_SEARCH_NAMES } from "../../packages/client/src/lib/emoji-catalog.generated.js";
import {
  resolveStandardEmojiShortcode,
  searchStandardEmojiShortcodes,
} from "../../packages/client/src/lib/emoji-shortcodes.js";

const allEmoji = EMOJI_CATEGORIES.flatMap((category) => [...category.emojis]);
assert.ok(allEmoji.length >= 1_900, `Expected the full base emoji catalog, received ${allEmoji.length}`);
assert.equal(new Set(allEmoji).size, allEmoji.length);
assert.ok(EMOJI_CATEGORIES.some((category) => category.label === "Travel & Places"));
assert.ok(EMOJI_CATEGORIES.some((category) => category.label === "Activities"));
assert.ok(EMOJI_CATEGORIES.some((category) => category.label === "Flags"));
assert.ok(EMOJI_CATEGORIES.find((category) => category.label === "Objects")?.emojis.includes("🧪"));
assert.match(EMOJI_SEARCH_NAMES["🧪"] ?? "", /test tube/u);
assert.equal(
  allEmoji.some((emoji) => /[\u{1F3FB}-\u{1F3FF}]/u.test(emoji)),
  false,
);
assert.equal(resolveStandardEmojiShortcode("crying"), "😢");
assert.equal(resolveStandardEmojiShortcode("test_tube"), "🧪");
assert.equal(resolveStandardEmojiShortcode("TEST-TUBE"), "🧪");
assert.equal(
  searchStandardEmojiShortcodes("cry").some((entry) => entry.name === "crying"),
  true,
);

process.stdout.write("Emoji catalog regression passed.\n");
