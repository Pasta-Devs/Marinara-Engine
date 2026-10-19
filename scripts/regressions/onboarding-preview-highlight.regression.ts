// #7777: the onboarding preview marks the runs of a persona field that the player's answers filled in,
// so the author's static text and the player's choices can be told apart. A value the author also wrote
// in prose for that field stays plain: highlighting must never claim an author's word as the player's.
import assert from "node:assert/strict";
import { highlightAnswerValues } from "../../packages/client/src/lib/onboarding-preview-highlight.js";

const highlighted = (text: string, values: string[], template: string) =>
  highlightAnswerValues(text, values, template)
    .filter((segment) => segment.yours)
    .map((segment) => segment.text);

// inserted answers are marked, in place
assert.deepEqual(
  highlighted(
    "Name: Ylli\nClass: ranger\nFaction: Crown",
    ["Ylli", "ranger", "Crown"],
    "Name: {{player}}\nClass: {{class}}\nFaction: {{faction}}",
  ),
  ["Ylli", "ranger", "Crown"],
);

// a value the card also wrote in prose for this field is not guessed at
assert.deepEqual(
  highlighted(
    "Terrified of dragons, though Ylli would never, ever admit it.",
    ["dragons", "Ylli"],
    "Terrified of dragons, though {{player}} would never, ever admit it.",
  ),
  ["Ylli"],
);
assert.deepEqual(highlighted("Weakness: dragons", ["dragons"], "Weakness: {{weakness}}"), ["dragons"]);

// whole values only: no marking inside a longer word
assert.deepEqual(highlighted("Name: Crowny", ["Crown"], "Name: {{faction}}"), []);
assert.deepEqual(highlighted("Name: Crown", ["Crown"], "Name: {{faction}}"), ["Crown"]);

// a value the authored text only contains inside a longer word is still the player's
assert.deepEqual(highlighted("Crowned heir of Crown.", ["Crown"], "Crowned heir of {{faction}}."), ["Crown"]);

// the longest value wins, and touching runs are one mark
assert.deepEqual(highlighted("Tall and sharp-featured", ["Tall", "Tall and sharp-featured"], "{{looks}}"), [
  "Tall and sharp-featured",
]);

// blanks, one-character values and duplicates are ignored
assert.deepEqual(highlighted("Name: A", ["A", " ", ""], "Name: {{player}}"), []);
assert.deepEqual(highlighted("Name: Ylli", ["Ylli", "Ylli"], "Name: {{player}}"), ["Ylli"]);

// segments always rebuild the resolved text exactly
for (const [text, values, template] of [
  ["Raised in the Crown's lower quarter.", ["Crown"], "Raised in the {{faction}}'s lower quarter."],
  ["no answer here", ["Crown"], "no answer here"],
  ["Ylli and Ylli", ["Ylli"], "{{player}} and {{player}}"],
] as const) {
  const segments = highlightAnswerValues(text, values, template);
  assert.equal(segments.map((segment) => segment.text).join(""), text);
}
assert.deepEqual(
  highlightAnswerValues("Raised in the Crown's lower quarter.", ["Crown"], "Raised in the {{faction}}'s lower quarter.")
    .filter((segment) => segment.yours)
    .map((segment) => segment.text),
  ["Crown"],
);
