// ─────────────────────────────────────────────────────────────
// Character description split regression
// ─────────────────────────────────────────────────────────────
// Guards the shared pattern splitter behind "Split description into fields":
//  - labelled sections, W++ one-liners (with a "{{char}}'s persona" prefix too), PLists with or without brackets
//    and dialogue blocks land in their fields; an interview whose questions name fields fills those fields
//  - every character of the description survives (lossless), apart from separators and repeated headers
//  - keyword sorting is flagged and ignores the character's own name words
//  - narrator / multi-character cards are skipped unless forced, empty descriptions are skipped
//  - existing field text is appended to, not duplicated, and applyDescriptionSplit writes the extension fields
//  - symbol-only text ("...", "♡") is not dropped as already present
//  - crafted long lines (heading markers, tabs, blank lines, a tab-filled name, bracket macros, unclosed quotes,
//    padded labels) finish quickly
import assert from "node:assert/strict";
import {
  applyDescriptionSplit,
  DESCRIPTION_SPLIT_FIELDS,
  splitCharacterDescription,
} from "../../packages/shared/src/utils/character-description-split.js";

// Compares text regardless of spacing and of the <START> marker the splitter adds in front of examples.
const squash = (s: string) =>
  s
    .toLowerCase()
    .replace(/<start>/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
const joined = (fields: Record<string, string>) => DESCRIPTION_SPLIT_FIELDS.map((f) => fields[f] ?? "").join("\n");

// 1. Labelled sections with markdown headers and "Label: value" lines.
const labelled = splitCharacterDescription({
  name: "Arya Vale",
  description: [
    "Arya Vale is a 24 year old courier who runs packages across the lower city.",
    "",
    "## Appearance",
    "Height: 168 cm",
    "Hair: short black hair with a silver streak",
    "She wears a patched grey jacket and running shoes.",
    "",
    "## Personality",
    "Stubborn, quick to laugh, hates being told to slow down.",
    "Likes: rooftops, cheap noodles",
    "",
    "Backstory: Arya grew up in the docks and ran away from home at fifteen after her father died.",
    "",
    "---",
    "Scenario: {{user}} has just hired Arya to carry a sealed letter across the city.",
  ].join("\n"),
  personality: "",
  scenario: "",
  system_prompt: "",
  mes_example: "",
  extensions: {},
});
assert.equal(labelled.status, "changed");
assert.deepEqual(labelled.changed, ["description", "personality", "appearance", "backstory", "scenario"]);
assert.match(labelled.after.description, /^Arya Vale is a 24 year old courier/);
assert.ok(!labelled.after.description.includes("Hair:"), "appearance lines left the description");
assert.match(labelled.after.appearance, /Height: 168 cm\nHair: short black hair[\s\S]*running shoes\./);
assert.ok(!labelled.after.appearance.includes("## Appearance"), "a header that only names its field is dropped");
assert.match(labelled.after.personality, /^Stubborn, quick to laugh[\s\S]*Likes: rooftops, cheap noodles$/);
assert.match(labelled.after.backstory, /^Backstory: Arya grew up in the docks/);
assert.match(labelled.after.scenario, /^Scenario: \{\{user\}\} has just hired Arya/);
// Lossless apart from the separator and the two canonical headers: every other line is in some field.
const labelledAfter = squash(joined(labelled.after));
const labelledKept = labelled.before.description
  .split("\n")
  .filter((line) => line.trim() && !["## Appearance", "## Personality", "---"].includes(line.trim()));
for (const line of labelledKept) assert.ok(labelledAfter.includes(squash(line)), `kept: ${line}`);
assert.equal(
  labelledAfter.length,
  labelledKept.reduce((sum, line) => sum + squash(line).length, 0),
);

// 2. A one-line W++ card splits per entry.
const wpp = splitCharacterDescription({
  name: "Adriana Hayes",
  description:
    "[Adriana Hayes: age (21 years), sex (Female), personality (kind, shy, bookish, loyal), appearance (long auburn hair, green eyes, 165 cm), background (raised by her grandmother in a coastal town), likes (rain, old novels)]",
});
assert.equal(wpp.status, "changed");
assert.match(wpp.after.description, /age \(21 years\)/);
assert.match(wpp.after.description, /sex \(Female\)/);
assert.match(wpp.after.personality, /personality \(kind, shy, bookish, loyal\)/);
assert.match(wpp.after.personality, /likes \(rain, old novels\)/);
assert.match(wpp.after.appearance, /appearance \(long auburn hair, green eyes, 165 cm\)/);
assert.match(wpp.after.backstory, /background \(raised by her grandmother in a coastal town\)/);
assert.equal(squash(joined(wpp.after)).length, squash(wpp.before.description).length, "W++ split is lossless");

// 2b. A one-line PList card ("[ {{char}}: traits; {{char}}'s body: ...; ]") splits per section.
const plist = splitCharacterDescription({
  name: "Monika",
  description:
    "[ {{char}}: intelligent, confident, introverted, lonely, romantic, likes(literature, piano, {{user}}), dislikes(being trapped, indifference), hobbies(reading, writing); Monika's body: 18 years old, slim build, emerald green eyes, long brown hair (high ponytail with white bow); ]",
});
assert.equal(plist.status, "changed");
assert.match(plist.after.personality, /^\[ \{\{char\}\}: intelligent, confident[\s\S]*hobbies\(reading, writing\);$/);
assert.match(plist.after.appearance, /^Monika's body: 18 years old[\s\S]*white bow\);$/);
assert.equal(plist.after.description, "");
assert.equal(squash(joined(plist.after)).length, squash(plist.before.description).length, "PList split is lossless");

// 2c. A "{{char}}'s persona" W++ prefix is a name prefix, and a PList without brackets still splits per section.
const persona = splitCharacterDescription({
  name: "Kei",
  description:
    "[{{char}}'s persona: age(21), sex(female), personality(cheerful, loud, loyal), appearance(short red hair, brown eyes), likes(ramen, arcades)]",
});
assert.equal(persona.status, "changed");
assert.match(persona.after.description, /age\(21\)/);
assert.match(persona.after.personality, /personality\(cheerful, loud, loyal\)[\s\S]*likes\(ramen, arcades\)/);
assert.match(persona.after.appearance, /appearance\(short red hair, brown eyes\)/);
assert.equal(
  squash(joined(persona.after)).length,
  squash(persona.before.description).length,
  "persona W++ is lossless",
);
const bare = splitCharacterDescription({
  name: "Kei",
  description:
    "{{char}}: cheerful, loud, loyal, likes(ramen, arcades), dislikes(rain, silence); {{char}}'s body: 160 cm, short red hair, brown eyes; Scenario: {{user}} runs into Kei at a ramen stall after closing time.",
});
assert.equal(bare.status, "changed");
assert.match(bare.after.personality, /^\{\{char\}\}: cheerful, loud[\s\S]*dislikes\(rain, silence\);$/);
assert.match(bare.after.appearance, /^\{\{char\}\}'s body: 160 cm[\s\S]*brown eyes;$/);
assert.match(bare.after.scenario, /^Scenario: \{\{user\}\} runs into Kei/);
assert.equal(bare.after.description, "");
assert.equal(squash(joined(bare.after)).length, squash(bare.before.description).length, "bare PList is lossless");
// A persona line whose W++ entries cannot be cut apart stays one trait list under the persona label.
const personaUnsplit = splitCharacterDescription({
  name: "Kei",
  description:
    "[{{char}}'s persona: gender(female) eyes(brown) hair(short, red) likes(ramen, arcades) dislikes(rain) personality(cheerful, loud, loyal) things that specifically are meant for this chat(she runs the arcade)]",
});
assert.equal(personaUnsplit.status, "changed");
assert.deepEqual(personaUnsplit.changed, ["description", "personality"]);
assert.equal(personaUnsplit.after.description, "");
assert.equal(
  squash(personaUnsplit.after.personality),
  squash(personaUnsplit.before.description),
  "unsplit persona is lossless",
);

// 3. Interview-style dialogue and <START> blocks become example messages.
const interview = splitCharacterDescription({
  name: "Mei",
  description: [
    "Mei is a shrine maiden who sells charms at the mountain gate.",
    "",
    'Interviewer: "How would you describe yourself?"',
    '{{char}}: "Oh, just a humble keeper of the gate. Nothing special, really."',
    'Interviewer: "And what do you do when nobody is around?"',
    '{{char}}: *She glances at the trees.* "I talk to the foxes. Don\'t tell anyone."',
    "",
    "<START>",
    "{{user}}: Good morning, Mei.",
    '{{char}}: "Early riser! The charms are fresh today."',
  ].join("\n"),
  mes_example: "",
});
assert.equal(interview.status, "changed");
assert.deepEqual(interview.changed, ["description", "mes_example"]);
assert.equal(interview.after.description, "Mei is a shrine maiden who sells charms at the mountain gate.");
assert.ok(interview.after.mes_example.startsWith("<START>\nInterviewer:"), "examples open with <START>");
assert.match(interview.after.mes_example, /<START>\n\{\{user\}\}: Good morning, Mei\.\n\{\{char\}\}: "Early riser!/);
assert.equal(squash(joined(interview.after)), squash(interview.before.description));

// 3b. {{user}}/{{char}} dialogue without quotes or asterisks is still example dialogue.
const chat = splitCharacterDescription({
  name: "Zoe",
  description: [
    "Zoe is a streamer who answers everything in lowercase.",
    "",
    "{{user}}: hey, you there?",
    "{{char}}: lol yeah, what's up",
    "{{user}}: nothing much",
    "{{char}}: same tbh",
  ].join("\n"),
});
assert.equal(chat.status, "changed");
assert.deepEqual(chat.changed, ["description", "mes_example"]);
assert.equal(chat.after.description, "Zoe is a streamer who answers everything in lowercase.");
assert.match(
  chat.after.mes_example,
  /^<START>\n\{\{user\}\}: hey, you there\?\n\{\{char\}\}: lol yeah[\s\S]*same tbh$/,
);

// 3c. An interview whose questions name fields is a profile: each answer lands in the field its question
// names, the other answers stay in the description, and nothing becomes example dialogue.
const profile = splitCharacterDescription({
  name: "Tala",
  description: [
    "{{user}}: Brief introduction?",
    "{{char}}: *She smiles.* My name is Tala. I used to guard the mountain pass before I came down to the valley.",
    "{{user}}: Personality?",
    "{{char}}: *She taps her chin.* I enjoy good company and quiet evenings, and I leave as soon as people start to argue.",
    "{{user}}: Appearance?",
    "{{char}}: *She stands up straight.* Tall, with short silver hair, grey eyes and a long scar across one cheek.",
  ].join("\n"),
});
assert.equal(profile.status, "changed");
assert.deepEqual(profile.changed, ["description", "personality", "appearance"]);
assert.match(
  profile.after.description,
  /^\{\{user\}\}: Brief introduction\?\n\{\{char\}\}: \*She smiles\.\*[\s\S]*valley\.$/,
);
assert.match(
  profile.after.personality,
  /^\{\{user\}\}: Personality\?\n\{\{char\}\}: \*She taps her chin\.\*[\s\S]*argue\.$/,
);
assert.match(
  profile.after.appearance,
  /^\{\{user\}\}: Appearance\?\n\{\{char\}\}: \*She stands up straight\.\*[\s\S]*cheek\.$/,
);
assert.equal(profile.after.mes_example, "");
assert.equal(profile.keywordSorted, false, "answers are placed by their question, not by keywords");
assert.equal(squash(joined(profile.after)), squash(profile.before.description));
// "Introduction?" asks who the character is: it names the description, so a chat that opens with it stays put.
const introChat = splitCharacterDescription({
  name: "Tala",
  description: [
    "{{user}}: Introduction?",
    "{{char}}: *She waves.* I'm Tala, I run the valley's only inn.",
    "{{user}}: hey, you there?",
    "{{char}}: lol yeah, what's up",
  ].join("\n"),
});
assert.equal(introChat.status, "unchanged");

// 4. Narrator and multi-character cards are left alone unless forced; empty descriptions always are.
const narrator = splitCharacterDescription({
  name: "Dungeon Master",
  description: "Personality: fair but ruthless.\nAppearance: a hooded figure.",
});
assert.equal(narrator.status, "skipped");
assert.match(narrator.reason ?? "", /narrator/);
assert.deepEqual(narrator.after, narrator.before);
const forced = splitCharacterDescription(
  { name: "Dungeon Master", description: "Personality: fair but ruthless.\nAppearance: a hooded figure." },
  { force: true },
);
assert.equal(forced.status, "changed");
assert.equal(forced.after.personality, "Personality: fair but ruthless.");
assert.equal(forced.after.appearance, "Appearance: a hooded figure.");
const twoNames = splitCharacterDescription({
  name: "Twins",
  description: "Name: Riley\nPersonality: loud\n\nName: Misato\nPersonality: quiet",
});
assert.equal(twoNames.status, "skipped");
assert.match(twoNames.reason ?? "", /several characters \(riley, misato\)/);
assert.equal(splitCharacterDescription({ name: "Nobody", description: "   " }).status, "skipped");

// 5. Plain prose with nothing labelled is reported as unchanged, not rewritten.
const prose = splitCharacterDescription({
  name: "Mia",
  description: "Mia is a quiet librarian who spends her evenings reading by the window of her small flat.",
});
assert.equal(prose.status, "unchanged");
assert.deepEqual(prose.after, prose.before);
assert.equal(prose.keywordSorted, false);
assert.equal(labelled.keywordSorted, false, "a labelled card is not flagged");

// 5b. An unlabelled paragraph sorted by its wording alone is flagged, so the UI can warn that it may be misfiled.
const sorted = splitCharacterDescription({
  name: "Mia",
  description: [
    "Mia is a quiet librarian who spends her evenings reading by the window of her small flat.",
    "",
    "She has long auburn hair tied in a loose braid, pale green eyes and a slim build. She usually wears a cardigan over a plain dress and round glasses.",
  ].join("\n"),
});
assert.equal(sorted.status, "changed");
assert.deepEqual(sorted.changed, ["description", "appearance"]);
assert.equal(sorted.keywordSorted, true, "keyword-sorted prose is flagged");

// 5c. The character's own name words do not count as keywords ("Rock Jaw" is not a jaw).
const rockJaw = splitCharacterDescription({
  name: "Rock Jaw",
  description: [
    "Rock Jaw is a retired brawler who runs a boxing gym on the pier.",
    "",
    "Rock Jaw swung first in every bout. Jaw never lost a title fight, and Jaw kept the belt for ten seasons running.",
  ].join("\n"),
});
assert.equal(rockJaw.status, "unchanged", "a paragraph about the character is not filed as appearance");
assert.equal(rockJaw.keywordSorted, false);

// 6. Existing field text is kept: moved text is appended, and text already present is not added twice.
const existing = splitCharacterDescription({
  name: "Nora",
  description: "Nora is a pilot.\n\nPersonality: brave and reckless.\nAppearance: tall, with a shaved head.",
  personality: "Calm under pressure.",
  extensions: { appearance: "Appearance: tall, with a shaved head." },
});
assert.equal(existing.status, "changed");
assert.equal(existing.after.personality, "Calm under pressure.\n\nPersonality: brave and reckless.");
assert.equal(existing.after.appearance, "Appearance: tall, with a shaved head.");
assert.equal(existing.after.description, "Nora is a pilot.");

// 6b. Text with no letters or digits is not mistaken for text the other field already holds.
const symbolMoved = splitCharacterDescription({
  name: "Nora",
  description: "Nora is a pilot.\n\nAppearance: ♡♡",
  extensions: { appearance: "tall" },
});
assert.equal(symbolMoved.after.appearance, "tall\n\nAppearance: ♡♡", "a symbol-only section is appended");
const symbolExisting = splitCharacterDescription({
  name: "Nora",
  description: "Nora is a pilot.\n\nPersonality: brave and reckless.",
  personality: "...",
});
assert.equal(symbolExisting.after.personality, "...\n\nPersonality: brave and reckless.", "symbol-only text is kept");
// ... but a bare <START> marker still counts as present, so no empty example block is added.
const examples = '{{user}}: "Hi there, how are you?"\n{{char}}: "Fine, thanks for asking."';
const startStub = splitCharacterDescription({
  name: "Nora",
  description: `Nora is a pilot.\n\n${examples}`,
  mes_example: "<START>",
});
assert.equal(startStub.after.mes_example, `<START>\n${examples}`, "a <START> stub is replaced by the examples");
const strayStart = splitCharacterDescription({
  name: "Nora",
  description: "Nora is a pilot.\n\nPersonality: brave and reckless.\n\n<START>",
  mes_example: `<START>\n${examples}`,
});
assert.equal(strayStart.after.mes_example, `<START>\n${examples}`, "a stray <START> line is not appended");

// 7. applyDescriptionSplit writes the top-level fields and the appearance/backstory extensions.
const applied = applyDescriptionSplit(
  { name: "Nora", description: "x", extensions: { talkativeness: 0.5, appearance: "", backstory: "" } },
  existing.after,
);
assert.equal(applied.description, "Nora is a pilot.");
assert.equal(applied.personality, existing.after.personality);
assert.equal(applied.extensions?.appearance, existing.after.appearance);
assert.equal(applied.extensions?.talkativeness, 0.5, "other extensions are kept");

// 8. Crafted card text stays linear: each of these lines used to backtrack for seconds to minutes.
const crafted = [
  ...["=", "#", "\t", "!", "** ", "\n"].map((c) => c.repeat(20000) + "x"),
  "[" + "{{a}}".repeat(40) + "x", // a bracket heading's macros
  ...["<", "</", "[", "<!--"].map((c) => c + " ".repeat(20000) + "x"), // a label's padding before ":", ">", "]", "-->"
  "Personality: " + ";".repeat(20000) + "x", // a value's trailing-punctuation trim
  "Name: " + "\n".repeat(20000), // the name scan's padding after "Name:"
  'Mia is a quiet girl who lives in the old town.\nx "' + "a ".repeat(20000), // an unclosed quote
  'Mia is a quiet girl.\n{{char}}: x "' + "a ".repeat(20000),
];
const started = performance.now();
for (const description of crafted) splitCharacterDescription({ name: "Mia", description });
splitCharacterDescription({ name: "\t".repeat(20000) + "x", description: "Personality: kind." });
const elapsed = Math.round(performance.now() - started);
assert.ok(elapsed < 2000, `crafted lines took ${elapsed} ms`);

process.stdout.write("Character description split regression passed.\n");
