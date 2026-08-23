import assert from "node:assert/strict";
import {
  extractNoodleMentionHandles,
  findNoodleTextMentions,
  noodleTextMentionsHandle,
} from "../../../packages/shared/src/utils/noodle-mentions.js";

const content = "Dinner with @Professor_Mari, @dottore and @professor_mari.";
assert.deepEqual(extractNoodleMentionHandles(content), ["professor_mari", "dottore"]);
assert.equal(noodleTextMentionsHandle(content, "Professor_Mari"), true);
assert.equal(noodleTextMentionsHandle(content, "@missing"), false);

const mentions = findNoodleTextMentions(content);
assert.equal(content.slice(mentions[0]!.start, mentions[0]!.end), "@Professor_Mari");
assert.equal(content.slice(mentions[1]!.start, mentions[1]!.end), "@dottore");

assert.deepEqual(extractNoodleMentionHandles("mail@example.com and word@dottore are not tags"), []);
assert.deepEqual(extractNoodleMentionHandles("(@dottore) and @mari! are tags"), ["dottore", "mari"]);

console.info("Noodle mention regression passed.");
