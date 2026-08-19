import assert from "node:assert/strict";
import { normalizeBeholderProse } from "../../packages/server/src/services/agents/beholder-normalizer.js";

// Asterisk actions are the dominant roleplay surface form and the one the
// extractor never saw in training: the wrapper goes, the sentence stays.
assert.equal(normalizeBeholderProse("*Tim shifts*"), "Tim shifts.");
assert.equal(normalizeBeholderProse("*Tim shifts.*"), "Tim shifts.");
assert.equal(
  normalizeBeholderProse('*She tugs her coat tighter.* "Cold out," she says.'),
  'She tugs her coat tighter. "Cold out," she says.',
);

// Markdown emphasis is unwrapped without eating the words.
assert.equal(normalizeBeholderProse("**bold** and __also bold__ and ~~struck~~"), "bold and also bold and struck");
assert.equal(normalizeBeholderProse("a _quiet_ word"), "a quiet word");
assert.equal(normalizeBeholderProse("snake_case_name stays"), "snake_case_name stays");

// Block markup: headings, quotes, list bullets, fences.
assert.equal(normalizeBeholderProse("# Chapter\nHe stands."), "Chapter He stands.");
assert.equal(normalizeBeholderProse("> He waits."), "He waits.");
assert.equal(normalizeBeholderProse("- He kneels."), "He kneels.");

// BBCode and HTML go; entities decode; <br> becomes a break, not a join.
assert.equal(normalizeBeholderProse("[b]Bold[/b] [color=red]red[/color]"), "Bold red");
assert.equal(normalizeBeholderProse("<i>He nods.</i>"), "He nods.");
assert.equal(normalizeBeholderProse("Tea &amp; toast &quot;now&quot;"), 'Tea & toast "now"');
assert.equal(normalizeBeholderProse("He stands.<br>She sits."), "He stands. She sits.");

// Entities decode exactly once. Chained replacements would turn "&amp;lt;" into
// "&lt;" and then "<", conjuring markup the author never wrote.
assert.equal(normalizeBeholderProse("&amp;lt;"), "&lt;", "an escaped entity is not decoded twice");
assert.equal(normalizeBeholderProse("&amp;amp;"), "&amp;");

// Tag stripping runs to a fixed point: one pass over a nested tag leaves a working
// one behind.
assert.ok(!normalizeBeholderProse("<scr<script>ipt>alert(1)").includes("<"), "nested tags do not survive");
assert.ok(!normalizeBeholderProse("<<div>>text").includes("<"));

// OOC notes are removed entirely.
assert.equal(normalizeBeholderProse("(OOC: brb) He waits."), "He waits.");
assert.equal(normalizeBeholderProse("[OOC: skip ahead] She nods."), "She nods.");

// Stage directions become sentences.
assert.equal(normalizeBeholderProse("[Tim sits]"), "Tim sits.");

// Labeled dialogue becomes attributed prose, with terminal punctuation fixed.
assert.equal(normalizeBeholderProse('Mara (quiet): "Better."'), '"Better," Mara said quietly.');
assert.equal(normalizeBeholderProse('Mara (sharp): "Where?"'), '"Where?" Mara said sharply.');
assert.equal(normalizeBeholderProse("TIM (flat): Fine by me."), '"Fine by me," Tim said flatly.');

// Whitespace collapses into flowing prose.
assert.equal(normalizeBeholderProse("One.\n\nTwo.\n\n\nThree."), "One. Two. Three.");
assert.equal(normalizeBeholderProse("  padded   spacing  "), "padded spacing");

// Plain canonical prose is already in surface form and must pass through untouched:
// the normalizer may never rewrite what the extractor was trained on.
const canonical = 'She pulls the grey wool coat tighter and grips the lantern. "We should go," she said quietly.';
assert.equal(normalizeBeholderProse(canonical), canonical);

// Degenerate input must not throw.
assert.equal(normalizeBeholderProse(""), "");
assert.equal(normalizeBeholderProse("   "), "");

// A realistic roleplay turn: several markup styles at once.
const messy = [
  "**Chapter 3**",
  "",
  "*Rissha skips across the stone.* She stops in front of <b>Hesperia</b>.",
  "",
  'Hesperia (nervous): "What did you do?"',
  "",
  "(OOC: sorry for the delay)",
].join("\n");
const cleaned = normalizeBeholderProse(messy);
assert.ok(!cleaned.includes("*"), "no asterisks survive");
assert.ok(!cleaned.includes("<"), "no HTML survives");
assert.ok(!cleaned.includes("OOC"), "no OOC note survives");
assert.ok(cleaned.includes("Rissha skips across the stone."), "action prose is preserved");
assert.ok(cleaned.includes('"What did you do?" Hesperia said nervously.'), "dialogue is attributed");
