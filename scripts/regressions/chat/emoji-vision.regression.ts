// Conversation emoji vision: which emojis and stickers go on the picture sheet, how they are numbered, and where the
// legend lands in the prompt.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeCustomEmojiSelection } from "../../../packages/shared/src/index.js";
import {
  buildConversationEmojiVisionLegend,
  createConversationAssetVisionCatalog,
  extractCustomAssetNames,
  insertConversationEmojiVisionLegend,
  rewriteStickerNamesWrittenAsEmojis,
} from "../../../packages/server/src/services/generation/conversation-emoji-vision.js";
import { listAdvertisedAssetNames } from "../../../packages/server/src/routes/generate/conversation-custom-assets.js";
import { getSharp } from "../../../packages/server/src/utils/sharp.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";

const history = (role: string, content: string) => ({ role, content, contextKind: "history" });

const cases: RegressionCase[] = [
  {
    name: "a sticker name written as an emoji becomes the sticker, unless an emoji owns the name",
    run: () => {
      const stickers = new Set(["hug", "wave"]);
      const emojis = new Set(["wave"]);
      const fixed = rewriteStickerNamesWrittenAsEmojis("aww :hug: :wave: at 10:hug:", stickers, emojis);
      assert.deepEqual(fixed, { text: "aww sticker:hug: :wave: at 10:hug:", changed: true });
      assert.equal(rewriteStickerNamesWrittenAsEmojis("plain :cat:", stickers, emojis).changed, false);
      assert.deepEqual(rewriteStickerNamesWrittenAsEmojis("sleep well :hug:\n\nsticker:hug:", stickers, emojis), {
        text: "sleep well\n\nsticker:hug:",
        changed: true,
      });
      assert.equal(rewriteStickerNamesWrittenAsEmojis(":hug: :hug:", stickers, emojis).text, "sticker:hug:");
      // Only the duplicate goes: hard breaks, indentation and blank lines elsewhere stay as written.
      const formatted =
        "line one  \nline two\n\n```\n    code\n```\n\n\nsticker:hug:\n:hug:\nend :wave: sticker:wave: :hug: bye";
      assert.equal(
        rewriteStickerNamesWrittenAsEmojis(formatted, new Set(["hug", "wave"]), new Set()).text,
        "line one  \nline two\n\n```\n    code\n```\n\n\nsticker:hug:\nend sticker:wave: bye",
      );
    },
  },
  {
    name: "emoji vision reads emoji and sticker tokens newest first, without counting a sticker as an emoji",
    run: () => {
      const names = extractCustomAssetNames(["hi :wave: sticker:hug: :wave:", "old :cat: sticker:hug:"]);
      assert.deepEqual(names, { emojis: ["wave", "cat"], stickers: ["hug"] });
    },
  },
  {
    name: "emoji vision prefs default to off and clamp their counts",
    run: () => {
      assert.equal(normalizeCustomEmojiSelection(undefined).visionMode, "off");
      const prefs = normalizeCustomEmojiSelection({
        visionMode: "recent",
        visionRecentCount: 99,
        visionOfferedCount: -3,
      });
      assert.equal(prefs.visionRecentCount, 20);
      assert.equal(prefs.visionOfferedCount, 0);
    },
  },
  {
    name: "offered names follow the advertisement order and cap",
    run: () => {
      const single = listAdvertisedAssetNames([{ charId: "a" }], ["g1", "own1", "g2"], new Map([["a", ["own1"]]]), 2);
      assert.deepEqual(single, ["own1", "g1"]);
      const group = listAdvertisedAssetNames(
        [{ charId: "a" }, { charId: "b" }],
        ["g1"],
        new Map([
          ["a", ["a1"]],
          ["b", ["b1", "g1"]],
        ]),
        5,
      );
      assert.deepEqual(group, ["g1", "a1", "b1"]);
    },
  },
  {
    name: "the legend numbers seen items first, then offered ones, and sits before the newest message",
    run: async () => {
      const sharp = await getSharp();
      if (!sharp) {
        console.log("# sharp unavailable; skipping the picture part");
        return;
      }
      const dir = mkdtempSync(join(tmpdir(), "emoji-vision-"));
      try {
        const catalog = createConversationAssetVisionCatalog();
        for (const [name, color] of [
          ["wave", "#f00"],
          ["cat", "#0f0"],
          ["star", "#00f"],
        ] as const) {
          const path = join(dir, `${name}.png`);
          await sharp({ create: { width: 64, height: 64, channels: 4, background: color } })
            .png()
            .toFile(path);
          catalog.emojiPaths.set(name, path);
        }
        catalog.offeredEmojis = ["star", "wave"];
        const messages = [
          { role: "system", content: "rules", contextKind: "system" },
          history("user", "older :cat:"),
          history("assistant", "reply"),
          history("user", "hello :wave: :unknown:"),
        ];

        const lastOnly = await buildConversationEmojiVisionLegend(
          messages,
          normalizeCustomEmojiSelection({ visionMode: "last", visionOfferedCount: 5 }),
          catalog,
        );
        assert.ok(lastOnly);
        assert.equal(lastOnly.images.length, 1);
        assert.match(lastOnly.message.content, /1 = :wave: \(in the chat, you may use it\)/);
        assert.match(lastOnly.message.content, /2 = :star: \(you may use it\)/);
        assert.doesNotMatch(lastOnly.message.content, /:cat:|:unknown:/);

        const recent = await buildConversationEmojiVisionLegend(
          messages,
          normalizeCustomEmojiSelection({ visionMode: "recent", visionRecentCount: 3, visionOfferedCount: 0 }),
          catalog,
        );
        assert.ok(recent);
        assert.match(recent.message.content, /1 = :wave: \(in the chat\)\n2 = :cat: \(in the chat\)$/);

        const placed = [...messages];
        insertConversationEmojiVisionLegend(placed, recent.message);
        assert.equal(placed[3], recent.message, "legend goes right before the newest history message");
        assert.equal(placed[4]!.content, "hello :wave: :unknown:");

        const off = await buildConversationEmojiVisionLegend(messages, normalizeCustomEmojiSelection({}), catalog);
        assert.equal(off, null);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  },
];

await runNamedCases(cases);
