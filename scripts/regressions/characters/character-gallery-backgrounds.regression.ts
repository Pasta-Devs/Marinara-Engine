import assert from "node:assert/strict";
import { buildChatImageGenerationRecord } from "../../../packages/shared/src/utils/chat-image-generation.js";
import { galleryImageUploadForm } from "../../../packages/client/src/lib/gallery-image-upload.js";
import { saveGalleryCreation } from "../../../packages/client/src/lib/gallery-create-save.js";
import { runNamedCases } from "../fixtures/named-cases.js";
import type { TFunction } from "i18next";

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

await runNamedCases([
  {
    name: "generated background save carries the original prompt and generation record to the upload",
    run: async () => {
      const generation = buildChatImageGenerationRecord({
        prompt: "A quiet bakery at dawn",
        negativePrompt: "people",
        connectionId: "original-image-connection",
        seed: 123456,
      });
      let sent: FormData | undefined;
      await saveGalleryCreation(
        {
          kind: "background",
          dataUrl: "data:image/png;base64,aW1hZ2U=",
          prompt: "A quiet bakery at dawn",
          generation,
          provider: "image_generation",
          model: "nai-diffusion-5-full",
          width: 1216,
          height: 832,
        },
        {
          fileStem: "bakery",
          upload: async (input) => {
            assert.ok(!Array.isArray(input), "generated saves must carry metadata alongside their files");
            sent = galleryImageUploadForm(input.files[0]!, input);
            return [{ id: "saved-background" }];
          },
          tag: async () => undefined,
          saveCharacterSheet: async () => assert.fail("background must not save as a character sheet"),
          localizeUi: ((key: string) => key) as TFunction,
        },
      );
      assert.ok(sent);
      assert.equal(sent.get("prompt"), "A quiet bakery at dawn");
      assert.deepEqual(JSON.parse(String(sent.get("generation"))), generation);
      assert.equal(sent.get("model"), "nai-diffusion-5-full");
      assert.equal(sent.get("width"), "1216");
      assert.equal(sent.get("height"), "832");
      assert.equal([...sent.keys()].at(-1), "file", "metadata is available before the file stream starts");
      const file = sent.get("file") as File;
      assert.equal(file.name, "bakery-background.png");
      assert.equal(await file.text(), "image");
    },
  },
  {
    name: "character sheet saves pass generation metadata through the editor's save callback",
    run: async () => {
      const generation = buildChatImageGenerationRecord({ prompt: "Character sheet", seed: 0 });
      let saved = false;
      await saveGalleryCreation(
        { kind: "character-sheet", dataUrl: "data:image/png;base64,aW1hZ2U=", prompt: "Character sheet", generation },
        {
          fileStem: "sheet",
          upload: async () => assert.fail("character sheets use the editor's save path"),
          tag: async () => undefined,
          saveCharacterSheet: async (dataUrl, metadata) => {
            assert.equal(dataUrl, "data:image/png;base64,aW1hZ2U=");
            assert.equal(metadata?.prompt, "Character sheet");
            assert.deepEqual(metadata?.generation, generation);
            saved = true;
          },
          localizeUi: ((key: string) => key) as TFunction,
        },
      );
      assert.equal(saved, true);
    },
  },
  {
    name: "ordinary uploads keep a file-only multipart request and existing JSON records are not double encoded",
    run: () => {
      const file = new File(["image"], "uploaded.png", { type: "image/png" });
      assert.deepEqual([...galleryImageUploadForm(file).keys()], ["file"]);
      const generation = JSON.stringify(buildChatImageGenerationRecord({ prompt: "Existing prompt" }));
      assert.equal(galleryImageUploadForm(file, { generation }).get("generation"), generation);
    },
  },
]);

console.log("character gallery backgrounds regression passed");
