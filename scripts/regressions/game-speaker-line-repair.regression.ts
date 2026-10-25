import assert from "node:assert/strict";
import {
  parseGameNarrationSegments,
  repairGameSpeakerLine,
  stripGmTagsKeepReadables,
} from "../../packages/shared/src/utils/game-narration-text.js";
import { parseGmTags } from "../../packages/shared/src/utils/game-tag-parser.js";

// The shapes a GM drifted into in the tail-caching eval, put back into `[Name] [type] [expression]: text`.
for (const [written, repaired] of [
  ['[Vyre Ashcombe] [main] [side] [disgusted]: "Charming."', '[Vyre Ashcombe] [main] [disgusted]: "Charming."'],
  [
    '[Ser Aldric Vane] [main] [whisper:Brother Kesh] [determined]: "Watch the door."',
    '[Ser Aldric Vane] [main] [determined]: "Watch the door."',
  ],
  ['[Brother Kesh] [main|thinking]: "Hm."', '[Brother Kesh] [main] [thinking]: "Hm."'],
  [
    "[Vyre Ashcombe] [thought] - Something doesn't sit right.",
    "[Vyre Ashcombe] [thought]: Something doesn't sit right.",
  ],
] as const) {
  assert.equal(repairGameSpeakerLine(written), repaired, written);
}
// Lines already in shape, lines with no type slot and plain prose are left alone.
for (const line of [
  '[Alice] [main] [happy]: "Hi."',
  '[Alice] [whisper:Bob] [calm]: "Quiet."',
  '[Alice] [main]: "Hi."',
  '[Brother Kesh] [embarrassed]: "Sorry."',
  "Rain falls on the [old] road - again.",
  "[Note: the bridge is out]",
  "[Alice] [main] [happy] waves.",
]) {
  assert.equal(repairGameSpeakerLine(line), line, line);
}

const segments = (content: string) =>
  parseGameNarrationSegments({ id: "m", content }).map((segment) => ({
    type: segment.type,
    speaker: segment.speaker,
    sprite: segment.sprite,
    partyType: segment.partyType,
    whisperTarget: segment.whisperTarget,
    content: segment.content,
  }));

// The narration screen shows each drifted line as the character's line.
assert.deepEqual(segments('[Vyre Ashcombe] [main] [side] [disgusted]: "Charming."'), [
  {
    type: "dialogue",
    speaker: "Vyre Ashcombe",
    sprite: "disgusted",
    partyType: "main",
    whisperTarget: undefined,
    content: "Charming.",
  },
]);
assert.deepEqual(segments('[Brother Kesh] [main|thinking]: "Hm."'), [
  {
    type: "dialogue",
    speaker: "Brother Kesh",
    sprite: "thinking",
    partyType: "main",
    whisperTarget: undefined,
    content: "Hm.",
  },
]);
assert.deepEqual(segments("[Vyre Ashcombe] [thought] - Something doesn't sit right."), [
  {
    type: "dialogue",
    speaker: "Vyre Ashcombe",
    sprite: undefined,
    partyType: "thought",
    whisperTarget: undefined,
    content: "Something doesn't sit right.",
  },
]);

// A whisper keeps its target: the slot after the speaker is the line's type, not a command to strip.
assert.deepEqual(
  segments('The hall goes quiet.\n\n[Ser Aldric Vane] [whisper:Brother Kesh] [determined]: "The door."'),
  [
    {
      type: "narration",
      speaker: undefined,
      sprite: undefined,
      partyType: undefined,
      whisperTarget: undefined,
      content: "The hall goes quiet.",
    },
    {
      type: "dialogue",
      speaker: "Ser Aldric Vane",
      sprite: "determined",
      partyType: "whisper",
      whisperTarget: "Brother Kesh",
      content: "The door.",
    },
  ],
);
assert.match(parseGmTags('[Alice] [whisper:Bob] [calm]: "Quiet."').cleanContent, /\[whisper:Bob\]/);
// Anywhere else a whisper tag is still a command and is stripped, as are tags nobody taught.
assert.equal(stripGmTagsKeepReadables('She leans in. [whisper: character="Bob" text="secret"]'), "She leans in.");
assert.equal(stripGmTagsKeepReadables('[Alice] [whisper: to="Bob"]: hi'), "[Alice] : hi");
assert.equal(
  stripGmTagsKeepReadables("Rain falls. [weather: storm] [sound: thunder] [party_morale: low]"),
  "Rain falls.",
);

// Bounded work on runaway output: a long run of speaker-looking brackets is not rescanned.
const runaway = "[A] [whisper:B]".repeat(20_000);
const started = performance.now();
stripGmTagsKeepReadables(runaway);
parseGameNarrationSegments({ id: "runaway", content: `${runaway}\n${"[A] [main] ".repeat(20_000)}` });
assert.ok(performance.now() - started < 2_000, "speaker repair and whisper slots stay linear");

console.log("Drifted GM speaker lines are repaired, and a whisper keeps its target.");
