import assert from "node:assert/strict";
import { parseGreeting, parseGreetings } from "../../../packages/client/src/lib/character-greetings";

// Tagged greeting: leading [..] groups are tags, the first line is the title.
assert.deepEqual(parseGreeting("[Ep4][Drago][medium] Foot talk\nDrago asked about the new shoes."), {
  tags: ["Ep4", "Drago", "medium"],
  title: "Foot talk",
  preview: "Drago asked about the new shoes.",
});

// More than three tags and spaces between them.
assert.deepEqual(parseGreeting("[Any] [Neutral][mild][what-if] Power cut\nThe lights go out.").tags, [
  "Any",
  "Neutral",
  "mild",
  "what-if",
]);

// Untagged greeting: the first sentence is the title, roleplay markup is dropped.
assert.deepEqual(parseGreeting('*Suzie waves.* "Over here! The train is late."'), {
  tags: [],
  title: "Suzie waves.",
  preview: "Over here! The train is late.",
});

// No sentence end and no newline: everything is the title.
assert.deepEqual(parseGreeting("Hello there"), { tags: [], title: "Hello there", preview: "" });

// Bold and parenthesised titles, also after tags; parentheses mid-line stay text.
assert.deepEqual(parseGreeting("**Car wash** *Suzie waves.* Hi!"), {
  tags: [],
  title: "Car wash",
  preview: "Suzie waves. Hi!",
});
assert.deepEqual(parseGreeting("[Ep2][hot] (Rooftop)\nThe door sticks."), {
  tags: ["Ep2", "hot"],
  title: "Rooftop",
  preview: "The door sticks.",
});
assert.equal(parseGreeting("(She looks up.) Oh, it is you.").title, "(She looks up.) Oh, it is you.");

// A single bracket opener stays text; two tagged greetings switch tag parsing on for the card.
const lone = parseGreetings(["[OOC] Be kind.\nHi.", "Plain greeting."]);
assert.deepEqual(lone[0]!.tags, []);
assert.equal(lone[0]!.title, "[OOC] Be kind.");

const tagged = parseGreetings(["[Ep2] Unpacking\nBoxes.", "[Ep3] Contest\nBeach.", "Plain one. More text."]);
assert.deepEqual(
  tagged.map((entry) => [entry.tags, entry.title]),
  [
    [["Ep2"], "Unpacking"],
    [["Ep3"], "Contest"],
    [[], "Plain one."],
  ],
);

console.log("greeting-tags regression passed");
