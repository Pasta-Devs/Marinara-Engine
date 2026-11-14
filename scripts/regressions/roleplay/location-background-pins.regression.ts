// Pinned place backgrounds (Nov 2026): a chat background pinned to a story place shows whenever the
// story is there. Names keep owners apart ("John's bedroom" vs "{{user}}'s bedroom"), World Maps places
// match by id (and cover their unpinned rooms), and gallery backgrounds with places follow their owner.
import assert from "node:assert/strict";

const shared = await import("../../../packages/shared/src/utils/location-backgrounds.js");
const { pinnedSceneBackground, pinnedBackgroundMetadataPatch, locationBackgroundPinsApply } =
  await import("../../../packages/server/src/services/generation/location-background-pins.js");

const pins = [
  { id: "john", names: ["John's bedroom", "John's room"], background: "john.png" },
  { id: "mine", names: ["{{user}}'s bedroom"], background: "mine.png" },
  { id: "any", names: ["bedroom"], background: "any-bedroom.png" },
  { id: "living", names: ["living room", "lounge"], background: "living.png" },
  { id: "house", names: [], placeId: "house", background: "house.png" },
  { id: "attic", names: [], placeId: "attic", background: "attic.png" },
  { id: "empty", names: ["kitchen"], background: "" },
];
const who = { userName: "Alyssa", characterNames: ["John"] };
const pick = (location: string | null, extra: Record<string, unknown> = {}) =>
  shared.resolveLocationBackgroundPin(pins, { ...who, location, ...extra })?.pin.id ?? null;

// ── Names, owners and wording ──
assert.equal(pick("John's bedroom, Smith House"), "john");
assert.equal(pick("JOHN’S BEDROOM"), "john", "curly apostrophe and case don't matter");
assert.equal(pick("Smith House, John's room"), "john", "other wordings match");
assert.equal(pick("Alyssa's bedroom"), "mine", "{{user}} is the persona name");
assert.equal(pick("guest bedroom"), "any", "a plain name fills in for bedrooms nobody pinned");
assert.equal(pick("Johnson's bedroom"), "any", "whole words only: Johnson is not John");
assert.equal(pick("the lounge by the stairs"), "living");
assert.equal(pick("kitchen"), null, "a pin without a picture never matches");
assert.equal(pick("the bedroomette"), null, "whole words only");
assert.equal(
  pick("Smith House, John's rented bedroom by the stairs"),
  "john",
  "a word or two in between still matches",
);
assert.equal(pick("John's old guest bedroom"), "john", "two words in between");
assert.equal(pick("John's house, the big sunny guest bedroom"), "any", "too far apart: not John's");
assert.equal(pick("John's house, Mara's bedroom"), "any", "a gapped name never reaches across a comma");
assert.equal(pick("John's house Mara's bedroom"), "any", "nor across someone written as Mara's");
assert.equal(pick("John's rented bedroom"), "john", "while plain words in between still match");
assert.equal(
  pick("John's house Mara's bedroom", { characterNames: ["John", "Mara"] }),
  "any",
  "nor across another owner",
);
assert.equal(
  shared.resolveLocationBackgroundPin(
    [
      { id: "gapped", names: ["John's bedroom"], background: "john.png" },
      { id: "exact", names: ["guest bedroom"], background: "guest.png" },
    ],
    { ...who, location: "John's guest bedroom" },
  )?.pin.id,
  "exact",
  "an exact name beats a gapped one of the same size",
);
assert.equal(pick(null), null);
assert.equal(
  shared.resolveLocationBackgroundPin(pins, { location: "Alyssa's bedroom", characterNames: ["John"] })?.pin.id,
  "any",
  "{{user}} pins wait for a persona name",
);
assert.equal(
  shared.resolveLocationBackgroundPin([{ id: "c", names: ["{{char}}'s den"], background: "den.png" }], {
    location: "Mara's den",
    characterNames: ["John", "Mara"],
  })?.pin.id,
  "c",
  "{{char}} tries each character of the chat",
);

// ── "my ..." belongs to whoever wrote the message ──
const both = { userName: "Alyssa", characterNames: ["John", "Mara"] };
const said = (location: string, speakerName: string | null, characterNames = both.characterNames) =>
  shared.resolveLocationBackgroundPin(pins, { ...both, characterNames, location, speakerName })?.pin.id ?? null;
assert.equal(said("my bedroom", "John"), "john", "John's 'my bedroom' is John's bedroom");
assert.equal(said("Smith House, my room", "John"), "john");
assert.equal(said("my bedroom", "Alyssa"), "mine", "the user's 'my bedroom' is the persona's");
assert.equal(said("your bedroom", "John"), "mine", "John's 'your bedroom' is the user's");
assert.equal(said("your bedroom", "Alyssa", ["John"]), "john", "the user's 'your' is the only character's");
assert.equal(said("your bedroom", "Alyssa"), "any", "with two characters 'your' stays unknown");
assert.equal(said("my bedroom", null), "any", "no speaker: read as written");
assert.equal(said("John's bedroom", "Mara"), "john", "a named owner beats the speaker");
assert.equal(said("Myrtle's study", "John"), null, "only the whole word 'my'");

// ── World Maps places ──
const places = [
  { id: "house", name: "Smith House", parentId: null },
  { id: "hall", name: "Hallway", parentId: "house" },
  { id: "attic", name: "Attic", parentId: "house" },
];
assert.equal(pick("Hallway", { placeId: "attic", places }), "attic", "the exact map place wins");
assert.equal(pick("John's bedroom", { placeId: "hall", places }), "john", "a name beats the building around it");
assert.equal(pick("Hallway", { placeId: "hall", places }), "house", "a pinned building covers its unpinned rooms");
assert.equal(pick(null, { placeId: "nowhere", places }), null);

// ── Normalizing what chat metadata holds ──
assert.deepEqual(
  shared.normalizeLocationBackgroundPins([
    { id: "a", names: [" Den ", "Den", ""], background: "den.png" },
    { id: "a", names: ["dupe"], background: "x.png" },
    "junk",
    { names: ["no id"], background: "x.png" },
  ]),
  [{ id: "a", names: ["Den"], placeId: null, background: "den.png" }],
);
assert.deepEqual(shared.splitLocationBackgroundNames("John's room, the den;  den ,"), [
  "John's room",
  "the den",
  "den",
]);
assert.equal(shared.normalizeLocationText("Café de l'Ours — Johns' cabin"), "cafe de l ours johns cabin");

// ── Server: only Roleplay chats with pins ──
const meta = { [shared.LOCATION_BACKGROUND_PINS_KEY]: pins };
assert.equal(locationBackgroundPinsApply("roleplay", meta), true);
assert.equal(locationBackgroundPinsApply("game", meta), false, "Game Mode keeps its own scene backgrounds");
assert.equal(locationBackgroundPinsApply("roleplay", {}), false);

const shown = pinnedSceneBackground({
  chatMode: "roleplay",
  chatMetadata: meta,
  location: "John's bedroom",
  ...who,
});
assert.equal(shown?.filename, "john.png");
assert.deepEqual(pinnedBackgroundMetadataPatch(shown!), {
  background: "john.png",
  [shared.LOCATION_BACKGROUND_PIN_SHOWN_KEY]: "john",
});
assert.equal(
  pinnedSceneBackground({
    chatMode: "roleplay",
    chatMetadata: meta,
    location: "Smith House hallway",
    projection: {
      currentLocationId: "hall",
      breadcrumb: [
        { id: "house", name: "Smith House" },
        { id: "hall", name: "Hallway" },
      ],
    } as never,
    ...who,
  })?.match.pin.id,
  "house",
  "the server walks the World Maps breadcrumb up to a pinned building",
);

// ── Gallery backgrounds follow their character into every chat ──
const johnGallery = shared.galleryBackgroundPins({ type: "character", id: "j1", name: "John" }, [
  {
    id: "g1",
    url: "/api/characters/j1/gallery/file/den.png",
    customKind: "background",
    customName: "{{char}}'s den, the den",
  },
  { id: "g2", url: "/api/characters/j1/gallery/file/x.png", customKind: "background", customName: "" },
  { id: "g3", url: "/api/characters/j1/gallery/file/e.png", customKind: "emoji", customName: "wave" },
]);
assert.deepEqual(
  johnGallery,
  [
    {
      id: "gallery:g1",
      names: ["John's den", "the den"],
      placeId: null,
      background: "/api/characters/j1/gallery/file/den.png",
    },
  ],
  "only backgrounds that name places; {{char}} is the gallery's owner",
);
assert.equal(
  shared.galleryBackgroundUrl("persona", "p 1", "personas/p 1/my room.png"),
  "/api/characters/personas/p 1/gallery/file/my%20room.png",
);
const withGallery = pinnedSceneBackground({
  chatMode: "roleplay",
  chatMetadata: {},
  location: "John's den",
  ...who,
  galleryPins: johnGallery,
});
assert.equal(withGallery?.match.pin.id, "gallery:g1", "a gallery background works without any chat pins");
assert.equal(withGallery?.filename, "/api/characters/j1/gallery/file/den.png", "gallery pictures keep their URL");
const tie = pinnedSceneBackground({
  chatMode: "roleplay",
  chatMetadata: {
    [shared.LOCATION_BACKGROUND_PINS_KEY]: [{ id: "own", names: ["John's den"], background: "mine.png" }],
  },
  location: "John's den",
  ...who,
  galleryPins: johnGallery,
});
assert.equal(tie?.match.pin.id, "own", "the chat's own pin wins a tie with a gallery picture");
const fullChat = Array.from({ length: shared.LOCATION_BACKGROUND_PIN_LIMIT }, (_, index) => ({
  id: `own-${index}`,
  names: [`room ${index}`],
  background: `room-${index}.png`,
}));
assert.equal(
  shared.resolveLocationBackgroundPin([...fullChat, ...johnGallery], { ...who, location: "John's den" })?.pin.id,
  "gallery:g1",
  "gallery pins still count when the chat has its full 100 pins",
);
assert.equal(
  pinnedSceneBackground({ chatMode: "game", chatMetadata: {}, location: "John's den", galleryPins: johnGallery }),
  null,
  "Game Mode keeps its own scene backgrounds",
);

console.log("location-background-pins regression passed");
