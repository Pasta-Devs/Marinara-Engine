// Pinned place backgrounds (Nov 2026): a chat background pinned to a story place shows whenever the
// story is there. Names keep owners apart ("John's bedroom" vs "{{user}}'s bedroom"), World Maps places
// match by id (and cover their unpinned rooms), and the pinned picture still takes its weather version.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "bg-pins-"));
process.env.DATA_DIR = dataDir;
const bgDir = join(dataDir, "backgrounds");
mkdirSync(bgDir, { recursive: true });

const shared = await import("../../packages/shared/src/utils/location-backgrounds.js");
const { pinnedSceneBackground, pinnedBackgroundMetadataPatch, locationBackgroundPinsApply } =
  await import("../../packages/server/src/services/generation/location-background-pins.js");

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

// ── Server: only Roleplay chats with pins; the weather version shows when it already exists ──
const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
writeFileSync(join(bgDir, "john.png"), png);
writeFileSync(join(bgDir, "john--wx-rain.png"), png);
const meta = { [shared.LOCATION_BACKGROUND_PINS_KEY]: pins };
assert.equal(locationBackgroundPinsApply("roleplay", meta), true);
assert.equal(locationBackgroundPinsApply("game", meta), false, "Game Mode keeps its own scene backgrounds");
assert.equal(locationBackgroundPinsApply("roleplay", {}), false);

const dry = pinnedSceneBackground({
  chatMode: "roleplay",
  chatMetadata: meta,
  location: "John's bedroom",
  ...who,
  weather: "Heavy rain",
  weatherVersions: false,
});
assert.equal(dry?.filename, "john.png", "weather versions off: the pinned picture itself");
const wet = pinnedSceneBackground({
  chatMode: "roleplay",
  chatMetadata: meta,
  location: "John's bedroom",
  ...who,
  weather: "Heavy rain",
  weatherVersions: true,
});
assert.equal(wet?.filename, "john--wx-rain.png", "its rain version when the library has one");
const snowy = pinnedSceneBackground({
  chatMode: "roleplay",
  chatMetadata: meta,
  location: "John's bedroom",
  ...who,
  weather: "Snow",
  weatherVersions: true,
});
assert.equal(snowy?.filename, "john.png", "no snow version yet: the plain picture (the Illustrator may make one)");
assert.deepEqual(pinnedBackgroundMetadataPatch(wet!), {
  background: "john--wx-rain.png",
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

console.log("location-background-pins regression passed");
