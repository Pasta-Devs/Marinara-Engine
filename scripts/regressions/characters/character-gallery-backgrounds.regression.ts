import assert from "node:assert/strict";

// The background library's Characters source: GET /api/characters/gallery/backgrounds lists every
// character's gallery pictures labeled "background" in one request, and the picker groups them by
// owner, the chat's own first, the rest A–Z.
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
const [{ buildApp }, { getDB }, { characters, characterImages }, { groupCharacterBackgrounds }] = await Promise.all([
  import("../../../packages/server/src/app.js"),
  import("../../../packages/server/src/db/connection.js"),
  import("../../../packages/server/src/db/schema/index.js"),
  import("../../../packages/client/src/lib/background-library.js"),
]);

const app = await buildApp();
try {
  await app.ready();
  const db = await getDB();
  const createdAt = "2026-01-01T00:00:00.000Z";
  await db.insert(characters).values([
    { id: "bg-juniper", data: JSON.stringify({ name: "Juniper" }), createdAt, updatedAt: createdAt },
    { id: "bg-orrin", data: JSON.stringify({ name: "Orrin" }), createdAt, updatedAt: createdAt },
  ]);
  const image = (id: string, characterId: string, customKind: string | null, customName: string | null) => ({
    id,
    characterId,
    filePath: `characters/${characterId}/${id} pic.png`,
    customKind,
    customName,
    createdAt,
  });
  await db
    .insert(characterImages)
    .values([
      image("bakery", "bg-juniper", "background", "{{char}}'s bakery"),
      image("selfie", "bg-juniper", null, null),
      image("smile", "bg-juniper", "emoji", "smile"),
      image("deck", "bg-orrin", "background", null),
    ]);

  const response = await app.inject({ method: "GET", url: "/api/characters/gallery/backgrounds" });
  assert.equal(response.statusCode, 200, response.body.slice(0, 200));
  const rows = (response.json() as Array<{ id: string; characterId: string; url: string; customName: string | null }>)
    .filter((row) => row.characterId.startsWith("bg-"))
    .sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(
    rows,
    [
      {
        id: "bakery",
        characterId: "bg-juniper",
        customName: "{{char}}'s bakery",
        url: "/api/characters/bg-juniper/gallery/file/bakery%20pic.png",
      },
      {
        id: "deck",
        characterId: "bg-orrin",
        customName: null,
        url: "/api/characters/bg-orrin/gallery/file/deck%20pic.png",
      },
    ],
    "only pictures labeled background come back, with a URL the gallery file route serves",
  );
} finally {
  await app.close();
}

const owner = (type: "character" | "persona", id: string, name: string) => ({ type, id, name });
const juniper = owner("character", "j", "Juniper");
const orrin = owner("character", "o", "Orrin");
const wren = owner("persona", "w", "Wren");
const bramble = owner("character", "b", "bramble");
const ansel = owner("character", "a", "Ansel");
const bg = (imageId: string, who: ReturnType<typeof owner>, title: string, places: string | null = title) => ({
  imageId,
  title,
  places,
  owner: who,
});
const chat = [
  bg("j1", orrin, "Deck"),
  bg("j2", juniper, "Bakery"),
  bg("w1", wren, "Attic"),
  bg("j3", orrin, "Harbour"),
];
const everyone = [
  bg("j1", orrin, "Deck"),
  bg("b1", bramble, "Den"),
  bg("a1", ansel, "Clinic"),
  bg("j2", juniper, "Bakery"),
];
const shape = (groups: ReturnType<typeof groupCharacterBackgrounds>) =>
  groups.map(
    (group) => `${group.owner.name}${group.inChat ? "*" : ""}:${group.backgrounds.map((b) => b.imageId).join(",")}`,
  );

assert.deepEqual(
  shape(groupCharacterBackgrounds(chat, [], "")),
  ["Orrin*:j1,j3", "Juniper*:j2", "Wren*:w1"],
  "the chat's owners keep chat order, each once, the persona included",
);
assert.deepEqual(
  shape(groupCharacterBackgrounds(chat, everyone, "")),
  ["Orrin*:j1,j3", "Juniper*:j2", "Wren*:w1", "Ansel:a1", "bramble:b1"],
  "everyone else follows A–Z, case-insensitive, and the chat's pictures are not repeated",
);
assert.deepEqual(
  shape(groupCharacterBackgrounds(chat, everyone, "jUNIPER")),
  ["Juniper*:j2"],
  "a search for an owner's name keeps all of their pictures",
);
assert.deepEqual(
  shape(groupCharacterBackgrounds(chat, everyone, "den")),
  ["bramble:b1"],
  "a search for a place keeps the matching pictures only",
);
assert.deepEqual(shape(groupCharacterBackgrounds([], [], "")), [], "no backgrounds, no groups");

console.log("character gallery backgrounds regression passed");
