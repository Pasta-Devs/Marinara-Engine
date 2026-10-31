import assert from "node:assert/strict";
import {
  parseGameNarrationSegments,
  repairGameSpeakerLine,
  stripGmTagsKeepReadables,
} from "../../packages/shared/src/utils/game-narration-text.js";
import { parseGmTags } from "../../packages/shared/src/utils/game-tag-parser.js";
import { applySegmentEdits } from "../../packages/server/src/services/game/segment-edits.js";
import { truncateMessageContentAtSegment } from "../../packages/client/src/lib/narration-truncation.js";

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
  // The speaker written as a markdown link (DeepSeek, playtest 2026-10-26): the link's target is a slot.
  [
    '[Thistle](/whisper:Brannagh) [main] [scared]: "Did you hear that?"',
    '[Thistle] [whisper:Brannagh] [scared]: "Did you hear that?"',
  ],
  ['[Thistle](main): "Over here."', '[Thistle] [main]: "Over here."'],
  ['[Thistle](https://example.com) [main] [calm]: "Hi."', '[Thistle] [main] [calm]: "Hi."'],
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
  "See [the old map](https://example.com/map) - it is torn.",
  "[the old map](https://example.com/map): torn at the fold.",
  "[Thistle](/whisper:Brannagh) [main] [scared] backs away.",
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

// A link-shaped speaker shows as the character's whisper, not as raw brackets.
assert.deepEqual(segments('[Thistle](/whisper:Brannagh) [main] [scared]: "Did you hear that?"'), [
  {
    type: "dialogue",
    speaker: "Thistle",
    sprite: "scared",
    partyType: "whisper",
    whisperTarget: "Brannagh",
    content: "Did you hear that?",
  },
]);

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

// Segment edits and the Interrupt cut count the beats the screen shows, drifted lines included.
for (const drifted of [
  "[Vyre Ashcombe] [thought] - Something doesn't sit right.",
  '[Vyre Ashcombe] [main] [side] [disgusted]: "Charming."',
  '[Brother Kesh] [main|thinking]: "Hm."',
  '[music: calm] [Vyre Ashcombe] [main] [side] [disgusted]: "Charming."',
  '[Thistle](/whisper:Brannagh) [main] [scared]: "Did you hear that?"',
]) {
  const raw = `The hall goes quiet.\n${drifted}\nRain on the roof.\n\n[Brother Kesh] [main] [calm]: "Let it be."\nThe fire dies.`;
  const screen = parseGameNarrationSegments({ id: "m", content: raw });
  assert.equal(screen.length, 5, drifted);
  const driftedAt = 1;
  assert.equal(screen.at(driftedAt)!.type, "dialogue", drifted);
  // An edit at the screen's index lands on the drifted line, and a delete there removes only it.
  const edited = applySegmentEdits(raw, { [driftedAt]: { content: "EDITED" } });
  const editedScreen = parseGameNarrationSegments({ id: "m", content: edited });
  assert.equal(editedScreen.length, 5, drifted);
  assert.equal(editedScreen.at(driftedAt)!.content, "EDITED", drifted);
  assert.equal(editedScreen.at(driftedAt)!.speaker, screen.at(driftedAt)!.speaker, drifted);
  const deleted = parseGameNarrationSegments({ id: "m", content: applySegmentEdits(raw, {}, new Set([driftedAt])) });
  assert.deepEqual(
    deleted.map((segment) => segment.content),
    screen.filter((_, index) => index !== driftedAt).map((segment) => segment.content),
    drifted,
  );
  // Cutting after each beat keeps exactly the beats up to it, as a prefix of the raw text.
  screen.forEach((segment, index) => {
    const cut = truncateMessageContentAtSegment(raw, index);
    assert.ok(raw.startsWith(cut), drifted);
    const kept = parseGameNarrationSegments({ id: "m", content: cut });
    assert.equal(kept.length, index + 1, `${drifted} cut at ${index}`);
    assert.equal(kept.at(-1)!.content, segment.content, `${drifted} cut at ${index}`);
  });
}

// Bounded work on runaway output: a long run of speaker-looking brackets is not rescanned.
const runaway = "[A] [whisper:B]".repeat(20_000);
const started = performance.now();
stripGmTagsKeepReadables(runaway);
parseGameNarrationSegments({ id: "runaway", content: `${runaway}\n${"[A] [main] ".repeat(20_000)}` });
assert.ok(performance.now() - started < 2_000, "speaker repair and whisper slots stay linear");

console.log("Drifted GM speaker lines are repaired, and a whisper keeps its target.");
