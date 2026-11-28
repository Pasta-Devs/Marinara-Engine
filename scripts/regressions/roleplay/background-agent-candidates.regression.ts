// Background agent candidates (Nov 2026): a gallery background labelled "dorm kitchen" lost to an
// unlabelled library file ("70c60b32-….jpg", a chateau) because gallery pictures were never listed and
// the agent was told to pick the closest match even when nothing fit. Now gallery pictures are listed by
// their places and description, unreadable unlabelled files are left out, the agent may answer null, and
// its gallery handle is turned into the gallery URL the chat stores.
import assert from "node:assert/strict";

const {
  backgroundAgentHandleFor,
  buildBackgroundAgentCandidates,
  isUntellingBackgroundName,
  loadGalleryBackgroundAgentCandidates,
  resolveBackgroundAgentChoice,
} = await import("../../../packages/server/src/services/generation/background-agent-candidates.js");
const { executeAgent } = await import("../../../packages/server/src/services/agents/agent-executor.js");
const { makeCapturingProvider, makeRegressionAgentConfig, makeRegressionAgentContext } =
  await import("../fixtures/prompt-helpers.js");

// ── File names that say nothing ──
for (const name of [
  "70c60b32-6b8c-4047-9b79-197df0a6e126.jpg",
  "70c60b32-6b8c-4047-9b79-123456789012.jpg",
  "8b64cacbc47f4a5a829d28daf7d80000.png",
  "IMG_2041.jpg",
  "background (3).png",
  "12345.webp",
  "HCAKrxU75lStT0KQ15sK.png",
]) {
  assert.equal(isUntellingBackgroundName(name), true, `${name} says nothing`);
}
for (const name of [
  "ancient_library.jpg",
  "generated-cramped-apartment-kitchen.png",
  "Black.jpg",
  "dorm kitchen.png",
]) {
  assert.equal(isUntellingBackgroundName(name), false, `${name} names a place`);
}

// ── Gallery pictures are candidates, by place and description ──
const gallery = await loadGalleryBackgroundAgentCandidates({
  characters: [{ id: "zion", name: "Zion" }],
  persona: { id: "alyssa", name: "Alyssa" },
  characterGallery: {
    async listByCharacterId() {
      return [
        { id: "kitchen", filePath: "characters/zion/k.png", customKind: "background", customName: "dorm kitchen" },
        {
          id: "bedroom",
          filePath: "characters/zion/b.png",
          customKind: "background",
          customName: "{{char}}'s bedroom, {{char}}'s room",
          description: "A dark bedroom with a big window.",
        },
        { id: "selfie", filePath: "characters/zion/s.png", customKind: "selfie", customName: "kitchen" },
        { id: "nothing", filePath: "characters/zion/n.png", customKind: "background", customName: "" },
      ];
    },
  },
  personaGallery: {
    async listByPersonaId() {
      return [
        { id: "pink", filePath: "personas/alyssa/p.png", customKind: "background", customName: "{{user}}'s bedroom" },
      ];
    },
  },
});
assert.deepEqual(
  gallery.map((item) => [item.filename, item.places]),
  [
    ["gallery:kitchen", ["dorm kitchen"]],
    ["gallery:bedroom", ["Zion's bedroom", "Zion's room"]],
    ["gallery:nothing", []],
    ["gallery:pink", ["Alyssa's bedroom"]],
  ],
  "only background pictures; {{char}}/{{user}} name the owner",
);
assert.equal(gallery[0]!.background, "/api/characters/zion/gallery/file/k.png");

const library = [
  { filename: "70c60b32-6b8c-4047-9b79-197df0a6e126.jpg", tags: [] },
  { filename: "1c2757c3-4557-419f-a8bd-8de5ffd388d2.jpg", tags: ["palace", "hallway"] },
  { filename: "castle_cliff.jpg", tags: ["castle"] },
  { filename: "castle_cliff--wx-rain.jpg", tags: [] },
  { filename: "d990ed36-66d8-4dc5-96c6-912c04c75b62.jpg", tags: [] },
];
const { candidates, leftOut } = buildBackgroundAgentCandidates({
  library,
  gallery,
  chatMetadata: {
    locationBackgroundPins: [
      { id: "pin", names: ["the old study"], background: "d990ed36-66d8-4dc5-96c6-912c04c75b62.jpg" },
      { id: "gallery-pin", names: ["the attic"], background: "/api/characters/zion/gallery/file/n.png" },
    ],
  },
});
assert.deepEqual(leftOut, ["70c60b32-6b8c-4047-9b79-197df0a6e126.jpg"], "unlabelled random names are left out");
assert.deepEqual(
  candidates.map((item) => item.filename),
  [
    "gallery:kitchen",
    "gallery:bedroom",
    "gallery:nothing",
    "gallery:pink",
    "1c2757c3-4557-419f-a8bd-8de5ffd388d2.jpg",
    "castle_cliff.jpg",
    "d990ed36-66d8-4dc5-96c6-912c04c75b62.jpg",
  ],
  "tags label a random name; a pinned place labels one too (library or gallery); weather versions stay out",
);
assert.deepEqual(candidates.find((item) => item.filename === "gallery:nothing")!.places, ["the attic"]);
assert.equal(
  buildBackgroundAgentCandidates({ library: [], gallery }).candidates.some(
    (item) => item.filename === "gallery:nothing",
  ),
  false,
  "a gallery background with no places, no description and no pin has nothing to be picked by",
);
assert.deepEqual(candidates.at(-1)!.places, ["the old study"]);

// ── Answers: handles become what the chat stores; anything else is dropped ──
assert.equal(resolveBackgroundAgentChoice("gallery:kitchen", candidates), "/api/characters/zion/gallery/file/k.png");
assert.equal(resolveBackgroundAgentChoice("`Castle_Cliff.jpg`", candidates), "castle_cliff.jpg");
assert.equal(resolveBackgroundAgentChoice("70c60b32-6b8c-4047-9b79-197df0a6e126.jpg", candidates), null);
assert.equal(resolveBackgroundAgentChoice("null", candidates), null);
assert.equal(resolveBackgroundAgentChoice("kitchen.png", candidates), null);
assert.equal(backgroundAgentHandleFor("/api/characters/zion/gallery/file/k.png", candidates), "gallery:kitchen");
assert.equal(backgroundAgentHandleFor("castle_cliff.jpg", candidates), "castle_cliff.jpg");

// ── The prompt shows places, owners and the host rules ──
const capture = makeCapturingProvider('{"chosen":"gallery:kitchen","reason":"kitchen scene"}');
const result = await executeAgent(
  makeRegressionAgentConfig({ type: "background", name: "Background" }) as any,
  makeRegressionAgentContext({
    recentMessages: [{ role: "assistant", content: "Alyssa walks to the kettle in the kitchen." }],
    memory: {
      _availableBackgrounds: candidates,
      _unlabelledBackgroundsLeftOut: leftOut.length,
      _currentBackground: "castle_cliff.jpg",
    },
  }),
  capture.provider as any,
  "regression-model",
);
const prompt = capture.calls[0]!.map((message: { content: string }) => message.content).join("\n");
assert.match(prompt, /- gallery:kitchen \[source: Zion's gallery\] \[shows the place: dorm kitchen\]/u);
assert.match(prompt, /\[looks like: A dark bedroom with a big window\.\]/u);
assert.match(
  prompt,
  /return \{"chosen": null\}: keeping the current background is better than showing the wrong place/u,
);
assert.match(prompt, /1 library picture\(s\) with no tags and an unreadable file name are not listed/u);
assert.doesNotMatch(prompt, /70c60b32/u, "the unlabelled chateau is never offered");
assert.equal((result.data as { chosen?: string }).chosen, "gallery:kitchen", "the route resolves the handle");

console.log("background agent candidates: ok");
