// #7689: a character's locked name survives the Character Tracker. The user renamed the row a
// multi-person card ("Family survivors") had claimed to "Madeline" and locked the name; when the agent
// then reported her by name without her id, or with a cast id of its own, the lock (keyed by that id)
// stopped matching her row, and the next turn's card name replaced "Madeline" again. Runs the generate
// route's tracker steps.
import assert from "node:assert/strict";
import {
  applyTrackerFieldLocksToGameStatePatch,
  characterTrackerLockKey,
  isTrackerFieldLocked,
  type GameState,
  type PresentCharacter,
} from "../../packages/shared/src/index.js";
import {
  applyTrackerCharacterCardIdentity,
  buildTrackerCastCharacterId,
  preserveTrackerCharacterUiFields,
} from "../../packages/server/src/routes/generate/generate-route-utils.js";

const cards = [{ id: "family-card", name: "Family survivors" }];
const corrected = [
  { characterId: "family-card", name: "Madeline", mood: "Wary" },
  { characterId: "elise", name: "Elise", mood: "Playful" },
] as PresentCharacter[];
const nameLocks = { [characterTrackerLockKey(corrected[0], 0, "name")]: true };

/** One Character Tracker result applied the way the generate route applies it. */
function applyTurn(
  reported: Array<Record<string, unknown>>,
  previous: PresentCharacter[],
  fieldLocks = nameLocks,
  identityCards = cards,
) {
  const characters = structuredClone(reported);
  applyTrackerCharacterCardIdentity(characters, identityCards, { previousCharacters: previous as never });
  preserveTrackerCharacterUiFields(characters, previous as never);
  const state = { presentCharacters: previous, fieldLocks } as unknown as GameState;
  return applyTrackerFieldLocksToGameStatePatch({ presentCharacters: characters }, state)
    .presentCharacters as PresentCharacter[];
}

// The agent names her without her id: the name stays, and so does the id her lock is keyed by.
const named = applyTurn(
  [
    { name: "Madeline", mood: "Tired" },
    { name: "Elise", mood: "Cheerful" },
  ],
  corrected,
);
const { characterId, name, mood } = named[0]!;
assert.deepEqual({ characterId, name, mood }, { characterId: "family-card", name: "Madeline", mood: "Tired" });
assert.equal(isTrackerFieldLocked(nameLocks, characterTrackerLockKey(named[0], 0, "name")), true);
assert.equal(named[1]?.mood, "Cheerful");

// Next turn the agent falls back to the card's name, with or without the id: the lock still holds.
for (const reportedFirst of [{ name: "Family survivors" }, { characterId: "family-card", name: "Family survivors" }]) {
  const next = applyTurn([{ ...reportedFirst, mood: "Calm" }, { name: "Elise" }], named);
  assert.equal(next[0]?.name, "Madeline", JSON.stringify(reportedFirst));
  assert.equal(next[0]?.mood, "Calm", "unlocked fields still follow the agent");
}

// Without a lock the card's name comes back, so the lock is what keeps the correction.
assert.equal(applyTurn([{ name: "Family survivors" }, { name: "Elise" }], named, {})[0]?.name, "Family survivors");

// A row the agent reports with that id itself keeps it; the named row does not take a copy.
for (const reported of [
  [{ name: "Madeline" }, { characterId: "family-card", name: "Family survivors" }],
  [{ characterId: "family-card", name: "Family survivors" }, { name: "Madeline" }],
]) {
  const both = applyTurn(reported, corrected);
  const owner = both.filter((character) => character.characterId === "family-card");
  assert.equal(owner.length, 1);
  assert.equal(owner[0]?.name, "Madeline", "the ID-retaining row owns the locked name, whichever row arrives first");
  const later = applyTurn([{ name: "Family survivors" }, { name: "Elise" }], both);
  assert.equal(
    later.find((character) => character.characterId === "family-card")?.name,
    "Madeline",
    "the name lock remains with its ID-retaining row on the following turn",
  );
}

// Once the card counts as several people, the engine gives her a cast id of her own. Her locked row
// still keeps the id her lock is keyed by, so the card's name cannot replace her on a later turn.
const eliseCast = { characterId: buildTrackerCastCharacterId("family-card", "Elise"), name: "Elise" };
const madelineCastId = buildTrackerCastCharacterId("family-card", "Madeline");
const elise = { name: "Elise" };
for (const [label, start, reported] of [
  [
    "Elise already has a cast id",
    [corrected[0]!, eliseCast],
    [{ characterId: "family-card", name: "Madeline" }, elise],
  ],
  [
    "the agent sends her cast id",
    [corrected[0]!, eliseCast],
    [{ characterId: madelineCastId, name: "Madeline" }, elise],
  ],
  [
    "the agent tags both with the card id",
    corrected,
    [
      { characterId: "family-card", name: "Madeline" },
      { characterId: "family-card", name: "Elise" },
    ],
  ],
] as Array<[string, PresentCharacter[], Array<Record<string, unknown>>]>) {
  const turn = applyTurn(reported, start);
  const madeline = turn.findIndex((character) => character.name === "Madeline");
  assert.equal(turn[madeline]?.characterId, "family-card", label);
  assert.equal(isTrackerFieldLocked(nameLocks, characterTrackerLockKey(turn[madeline], madeline, "name")), true, label);
  const later = applyTurn([{ name: "Family survivors" }, elise], turn);
  assert.deepEqual(
    later.map((character) => character.name),
    ["Madeline", "Elise"],
    label,
  );
}

// Sharing a name does not make two explicitly identified characters the same person.
const oldAlex = { characterId: "old-alex", name: "Alex", mood: "Wary" } as PresentCharacter;
const alexLock = { [characterTrackerLockKey(oldAlex, 0, "name")]: true };
const distinct = applyTurn([{ characterId: "new-alex", name: "Alex", mood: "Cheerful" }], [oldAlex], alexLock);
assert.deepEqual(
  distinct.map(({ characterId, name, mood }) => ({ characterId, name, mood })),
  [
    { characterId: "new-alex", name: "Alex", mood: "Cheerful" },
    { characterId: "old-alex", name: "Alex", mood: "Wary" },
  ],
  "an unrelated explicit ID stays distinct, and the old locked row is retained",
);

// An explicit ID reserves only its own row: a name-only report still finds another eligible namesake.
const namesakes = [
  { characterId: "alex-a", name: "Alex", mood: "Calm" },
  { characterId: "alex-b", name: "Alex", mood: "Wary" },
] as PresentCharacter[];
const namesakeLocks = {
  [characterTrackerLockKey(namesakes[0], 0, "name")]: true,
  [characterTrackerLockKey(namesakes[1], 1, "mood")]: true,
};
for (const ownerId of ["alex-a", buildTrackerCastCharacterId("alex-a", "Alex")]) {
  for (const explicitFirst of [false, true]) {
    const reported = [
      { name: "Alex", mood: "Changed" },
      { characterId: ownerId, name: "Alex", mood: "Other" },
    ];
    const expected = [
      { characterId: "alex-b", mood: "Wary" },
      { characterId: "alex-a", mood: "Other" },
    ];
    if (explicitFirst) {
      reported.reverse();
      expected.reverse();
    }
    const nameOnlyThenExplicit = applyTurn(reported, namesakes, namesakeLocks, [
      { id: "alex-a", name: "Alex" },
      { id: "alex-b", name: "Alex" },
    ]);
    assert.deepEqual(
      nameOnlyThenExplicit.map(({ characterId, mood }) => ({ characterId, mood })),
      expected,
      `the bare row matches the unreserved namesake while ${ownerId} keeps its own row (explicit first: ${explicitFirst})`,
    );
  }
}
const namesakeCast = applyTurn(
  [{ characterId: buildTrackerCastCharacterId("alex-b", "Alex"), name: "Alex", mood: "Changed" }],
  namesakes,
  namesakeLocks,
  [
    { id: "alex-a", name: "Alex" },
    { id: "alex-b", name: "Alex" },
  ],
);
assert.deepEqual(
  namesakeCast.map(({ characterId, mood }) => ({ characterId, mood })),
  [
    { characterId: "alex-b", mood: "Wary" },
    { characterId: "alex-a", mood: "Calm" },
  ],
  "a named cast alias matches its own namesake and retains the other locked row once",
);

console.log("tracker character name lock regression passed");
