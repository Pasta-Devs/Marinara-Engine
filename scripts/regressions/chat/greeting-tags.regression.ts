import assert from "node:assert/strict";
import {
  greetingBody,
  parseGreeting,
  parseGreetings,
  setGreetingHeader,
  splitGreetingHeader,
} from "../../../packages/client/src/lib/character-greetings";

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

// Cards that repeat the header as the first body line: the preview and the opened body skip it.
const repeated = "**Rooftop**\n**Rooftop**\nThe door sticks.";
assert.equal(parseGreeting(repeated).preview, "The door sticks.");
assert.equal(greetingBody(repeated), "The door sticks.");
assert.equal(greetingBody("[Ep2] Rooftop\nThe door sticks."), "The door sticks.");
// Without tags on the card, a bracket line is story text, so the body keeps it.
assert.equal(greetingBody("[OOC] Be kind.\nHi.", false), "[OOC] Be kind.\nHi.");

// A tagged header line still matches its repeat once the tags are set aside.
assert.equal(parseGreeting("[Ep2] **Rooftop**\nRooftop\nThe door sticks.").preview, "The door sticks.");

console.log("greeting-tags regression passed");

// A header sharing its line with the text keeps that text in the opened body.
assert.equal(greetingBody("[Ep4] Foot talk goes on."), "Foot talk goes on.");
// A body that begins with the title word keeps it unless the title is a whole line.
assert.equal(parseGreeting("**Drago**\nDrago asked about the new shoes.").preview, "Drago asked about the new shoes.");
assert.equal(greetingBody("**Drago**\nDrago asked about the new shoes."), "Drago asked about the new shoes.");
assert.equal(greetingBody("[Ep2] Rooftop. The door sticks.\nIt is late."), "The door sticks.\nIt is late.");
// A repeated title line collapses whatever markup, quotes or parentheses wrap it.
assert.equal(parseGreeting('("Car wash")\nCar wash\nThe soap is cold.').preview, "The soap is cold.");
assert.equal(greetingBody('**"Car wash"**\nCar wash\nThe soap is cold.'), "The soap is cold.");
assert.equal(greetingBody('[Ep2] **"Suzie"**\nSuzie\nHi.'), "Hi.");
assert.equal(greetingBody("(Rooftop)\nRooftop\nThe door sticks."), "The door sticks.");
assert.equal(greetingBody("[Ep2] (Rooftop)\nRooftop\nThe door sticks."), "The door sticks.");

// Editor header fields: parts join back to the exact text, and a write keeps the author's form.
for (const text of [
  "[Ep2][hot] (Rooftop)\nThe door sticks.",
  "  **Car wash**\n*Suzie waves.*",
  "Plain one.",
  "[a]\n\nBody",
]) {
  const header = splitGreetingHeader(text);
  assert.equal(header.tagText + header.titleText + header.rest, text);
}
assert.deepEqual(splitGreetingHeader("[Ep2][hot] (Rooftop)\nThe door sticks.").tags, ["Ep2", "hot"]);
assert.equal(splitGreetingHeader("[Ep2][hot] (Rooftop)\nThe door sticks.").title, "Rooftop");
assert.equal(
  setGreetingHeader("[Ep2][hot] (Rooftop)\nThe door sticks.", ["Ep3"], "Roof"),
  "[Ep3] (Roof)\nThe door sticks.",
);
assert.equal(setGreetingHeader("[a]\n**T**\nBody", [], "T"), "**T**\nBody");
assert.equal(setGreetingHeader("Plain one.", ["cosy"], ""), "[cosy] Plain one.");
assert.equal(setGreetingHeader("Plain one.", [], "Morning"), "**Morning**\nPlain one.");
assert.equal(setGreetingHeader("[x] **Old**\nBody", ["x"], ""), "[x] Body");
assert.equal(setGreetingHeader("**$1 deal**\nBody", [], "$& off"), "**$& off**\nBody");
assert.equal(splitGreetingHeader("(Old)\r\nBody").title, "Old");
assert.equal(setGreetingHeader("(Old)\r\nBody", [], "New"), "(New)\r\nBody");
assert.equal(splitGreetingHeader("[OOC] Be kind.", false).tagText, "");
assert.equal(setGreetingHeader("[OOC] Be kind.", [], "Rules", false), "**Rules**\n[OOC] Be kind.");
