// Cleaning up Conversation replies: timestamps, reply envelopes and doubled speaker names are stripped, a repeated
// reply is spotted, and character commands are read from a reply, per speaker too.
import assert from "node:assert/strict";
import {
  parseCharacterCommands,
  parseCharacterCommandsBySpeaker,
} from "../../../packages/server/src/services/conversation/character-commands.js";
import {
  collapseDuplicateConversationSpeakerPrefixes,
  isRepeatedConversationResponse,
  stripConversationPromptTimestamps,
  stripConversationResponseEnvelope,
} from "../../../packages/server/src/services/conversation/transcript-sanitize.js";

const professorMariAboutMeCommands = parseCharacterCommands(
  '[update_character: name="Luna", about_me="fate dealer. tea hoarder. 🔮"]\n' +
    '[update_persona: name="Alex Storm", about_me=""]',
).commands;
assert.deepEqual(professorMariAboutMeCommands[0], {
  type: "update_character",
  name: "Luna",
  aboutMe: "fate dealer. tea hoarder. 🔮",
});
assert.deepEqual(professorMariAboutMeCommands[1], {
  type: "update_persona",
  name: "Alex Storm",
  aboutMe: "",
});
const strictCharacterNumberCommands = parseCharacterCommands(
  '[create_character: name="Decimal", talkativeness=0.5]\n' +
    '[create_character: name="Not Decimal", talkativeness=0x5]',
).commands;
assert.equal(strictCharacterNumberCommands[0]?.type, "create_character");
assert.equal(
  strictCharacterNumberCommands[0]?.type === "create_character"
    ? strictCharacterNumberCommands[0].talkativeness
    : undefined,
  0.5,
);
assert.equal(strictCharacterNumberCommands[1]?.type, "create_character");
assert.equal(
  strictCharacterNumberCommands[1]?.type === "create_character"
    ? strictCharacterNumberCommands[1].talkativeness
    : undefined,
  undefined,
  "Non-decimal separators must not be accepted as character numeric parameters",
);
assert.equal(stripConversationPromptTimestamps("[11.07 15:53] Character: Hello!"), "Character: Hello!");
assert.equal(
  isRepeatedConversationResponse(
    [
      {
        role: "assistant",
        characterId: "dottore",
        content: "The experiment remains stable after every measured interval.",
      },
      {
        role: "assistant",
        characterId: "dottore",
        content: "A different observation separates the two matching responses.",
      },
    ],
    "dottore",
    "The experiment remains stable after every measured interval.",
  ),
  true,
);
assert.equal(
  stripConversationResponseEnvelope("[11.07 15:53] Character: Hello!", { speakerName: "Character" }),
  "Hello!",
);
assert.equal(
  stripConversationResponseEnvelope("[11.07 15:53] Character: Hello!", {
    speakerName: "Character",
    preserveSpeakerPrefix: true,
  }),
  "Character: Hello!",
);
assert.equal(
  collapseDuplicateConversationSpeakerPrefixes(
    "Dottore: Dottore: The procedure is complete.\nPantalone: Pantalone: At what cost?",
    ["Dottore", " Pantalone ", "Dottore"],
  ),
  "Dottore: The procedure is complete.\nPantalone: At what cost?",
);
assert.equal(
  stripConversationResponseEnvelope("Dottore: Dottore: The procedure is complete.", {
    speakerName: "Dottore",
    speakerNames: ["Dottore", "Pantalone"],
  }),
  "The procedure is complete.",
);
assert.deepEqual(
  parseCharacterCommandsBySpeaker(
    "Char1:\nNothing to run.\nChar2:\r\n[selfie]",
    [
      { id: "char-1", name: "Char1" },
      { id: "char-2", name: "Char2" },
    ],
    "char-1",
  ).commandCharacterIds,
  ["char-2"],
  "Commands beneath a newline-delimited speaker label must retain the same character attribution as the UI bubble",
);
assert.deepEqual(
  parseCharacterCommandsBySpeaker(
    "[selfie]\nChar1:\nChar2:\nVisible reply.",
    [
      { id: "char-1", name: "Char1" },
      { id: "char-2", name: "Char2" },
    ],
    "char-1",
  ).commandCharacterIds,
  ["char-2"],
  "A leading command must skip an empty named segment and follow the first visible speaker section",
);
