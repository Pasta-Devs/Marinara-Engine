import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { CapabilitySpriteRecord } from "../../../packages/shared/src/types/capability-runtime.js";

// #9574: features and packages use a character's saved sprites before they draw new art. One rule decides:
// the explicit choice, a saved sprite that shows the request, saved sprites to draw from, nothing.
const dataDir = process.env.DATA_DIR;
assert.ok(dataDir, "the regression runner provides a throwaway DATA_DIR");

const { findCharacterSprite, pickCharacterSpriteReferences, resolveCharacterSprite, readCharacterSprite } =
  await import("../../../packages/server/src/services/sprites/sprite-reuse.js");
const { createCapabilitySpriteHost } =
  await import("../../../packages/server/src/services/capability-packages/capability-sprites.service.js");

const record = (
  handle: string,
  folder: string | null = null,
  kind: CapabilitySpriteRecord["kind"] = handle.startsWith("full_") ? "full-body" : "expression",
): CapabilitySpriteRecord => {
  const name = handle.replace(/^full_/u, "");
  return { handle, kind, name, label: name, folder, url: `/x/${handle}.png`, mimeType: "image/png" };
};

const library = [
  record("neutral"),
  record("happy"),
  record("happy_formalwear"),
  record("angry_02"),
  record("happy_talk"),
  record("sad", "Winter coat"),
  record("neutral", "Winter coat"),
  record("full_idle"),
  record("full_wave"),
  record("full_idle_winter_coat"),
];

assert.deepEqual(findCharacterSprite(library, { kind: "expression", expression: "happy" }), {
  sprite: library[1],
  match: "exact",
});
assert.equal(
  findCharacterSprite(library, { kind: "expression", expression: "happy", outfit: "formalwear" })?.sprite.handle,
  "happy_formalwear",
  "a name facet is an outfit",
);
assert.equal(
  findCharacterSprite(library, { kind: "expression", expression: "sad", outfit: "winter coat" })?.sprite.folder,
  "Winter coat",
  "a folder named for the outfit is the outfit",
);
assert.equal(
  findCharacterSprite(library, { kind: "expression", expression: "happy", outfit: "winter coat" }),
  null,
  "the right face in another outfit is not a match: it is drawn with references",
);
assert.equal(findCharacterSprite(library, { kind: "expression", expression: "angry" })?.sprite.handle, "angry_02");
assert.equal(findCharacterSprite(library, { kind: "expression", expression: "surprised" }), null);
assert.deepEqual(
  findCharacterSprite(library, { kind: "full-body" }),
  { sprite: library[7], match: "default" },
  "no expression asked: the resting picture",
);
assert.equal(
  findCharacterSprite(library, { kind: "full-body", outfit: "winter coat" })?.sprite.handle,
  "full_idle_winter_coat",
);
assert.equal(findCharacterSprite(library, { kind: "full-body", expression: "wave" })?.sprite.handle, "full_wave");
assert.equal(
  findCharacterSprite([record("happy_talk"), record("happy_blink")], { kind: "expression", expression: "happy" }),
  null,
  "a PNGTuber talk or blink frame is never handed out as a face",
);

const refs = pickCharacterSpriteReferences(library, { kind: "expression", expression: "happy", outfit: "winter coat" });
assert.equal(refs[0]?.folder, "Winter coat", "the outfit's own resting face leads");
assert.ok(
  refs.some((entry) => entry.handle === "happy"),
  "the requested face in another outfit helps",
);
assert.ok(refs.length <= 4);
assert.equal(new Set(refs.map((entry) => entry.handle + entry.folder)).size, refs.length, "no picture twice");
assert.equal(pickCharacterSpriteReferences(library, { kind: "full-body" }, 1).length, 1);
assert.deepEqual(pickCharacterSpriteReferences([], { kind: "expression" }), []);

// The rule end to end, on a saved library.
const requireFromServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const sharp = requireFromServer("sharp");
const owner = randomUUID();
const directory = join(dataDir, "sprites", owner);
await mkdir(directory, { recursive: true });
const opaque = await sharp({ create: { width: 8, height: 8, channels: 4, background: "#336699ff" } })
  .png()
  .toBuffer();
const clear = await sharp({ create: { width: 8, height: 8, channels: 4, background: "#00000000" } })
  .png()
  .toBuffer();
await writeFile(join(directory, "neutral.png"), clear);
await writeFile(join(directory, "happy.png"), opaque);
await writeFile(join(directory, "full_idle.png"), opaque);
await writeFile(join(directory, "icon.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");

assert.deepEqual(
  (
    resolveCharacterSprite(owner, { kind: "expression", expression: "happy", selected: "neutral" }) as {
      source: string;
    }
  ).source,
  "selected",
  "an explicit choice wins while it exists",
);
const library2 = resolveCharacterSprite(owner, { kind: "expression", expression: "happy", selected: "gone" });
assert.equal(library2.source, "library");
assert.equal(library2.source === "library" && library2.sprite.handle, "happy");
const drawn = resolveCharacterSprite(owner, { kind: "expression", expression: "surprised", maxReferences: 2 });
assert.equal(drawn.source, "reference");
assert.deepEqual(
  drawn.source === "reference" && drawn.references.map((entry) => entry.handle),
  ["neutral", "full_idle"],
  "references: the resting face, then the resting full body; never an SVG",
);
assert.deepEqual(resolveCharacterSprite(randomUUID(), { kind: "expression" }), { source: "none" });

const read = await readCharacterSprite(owner, "neutral");
assert.equal(read?.mimeType, "image/png");
assert.equal(read?.transparent, true, "a see-through sprite says so");
assert.equal((await readCharacterSprite(owner, "happy"))?.transparent, false);
assert.equal(await readCharacterSprite(owner, "missing"), null);

const host = createCapabilitySpriteHost();
assert.equal((await host.list(owner)).length, 3, "the package host lists every picture an image model reads");
assert.equal((await host.resolve(owner, { kind: "full-body" })).source, "library");
await assert.rejects(host.resolve(owner, { kind: "pose" as never }), /kind must be/u);
await assert.rejects(host.list(""), /ownerId is required/u);
assert.deepEqual(await host.list("../escape"), [], "an owner id that leaves the sprite folder lists nothing");
