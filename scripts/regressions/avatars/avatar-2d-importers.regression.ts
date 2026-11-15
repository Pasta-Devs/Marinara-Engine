/**
 * The 2D avatar importers treat files as hostile and turn honest ones into playable avatars:
 *   - a PNGTuber Plus `.save` becomes one layer set per distinct costume, flattened at rest with Godot's
 *     parent offsets, relative z-order, talk/blink visibility, clipping and costume switches; costume names
 *     map to feelings where they can, broken or hostile saves are refused with a plain message, and nested
 *     clipping costs what its pictures cost;
 *   - a `.mavatar` is read with the strict ZIP reader, checked against the format's version 1 rules, and
 *     repacked so that mesh-avatar 0.1.1's own unpackAvatar and validateAvatarFiles accept it; an archive
 *     that unpacks past the upload cap, or a rig too dense to play, is refused.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PNGTUBER_PLUS_DEFAULT_SAVE,
  meshAvatarFiles,
  paintPng,
  plusSave,
  plusSprite,
  sharp,
  solid,
  zipFiles,
} from "../fixtures/avatar-2d-fixtures.js";

const { avatarKindDataSchema, isAvatarFilePath } = await import("../../../packages/shared/src/index.js");
const { bindPngtuberCostumes, pngtuberImporter, PNGTUBER_MAX_OUTPUT_SIDE } =
  await import("../../../packages/server/src/services/avatars/formats/pngtuber.js");
const { mavatarImporter, countMeshAvatarGridPoints, MESH_AVATAR_MAX_GRID_POINTS } =
  await import("../../../packages/server/src/services/avatars/formats/mavatar.js");
const { findAvatarImporter } = await import("../../../packages/server/src/services/avatars/formats/registry.js");
const meshAvatar = await import("../../../packages/client/node_modules/mesh-avatar/dist/index.js");

const owner = { ownerType: "character", ownerId: "fixture" } as const;
const head = (bytes: Uint8Array) => bytes.subarray(0, 64 * 1024);

async function importFile(
  importer: typeof pngtuberImporter | typeof mavatarImporter,
  filename: string,
  bytes: Uint8Array,
) {
  const input = { owner, filename, bytes };
  assert.equal(findAvatarImporter({ filename, head: head(bytes) }), importer, `${filename} is claimed by its importer`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return importer.extract((await importer.validate(input)) as any, input);
}

async function refused(
  importer: { validate: (input: never) => Promise<unknown>; extract: (v: never, input: never) => Promise<unknown> },
  filename: string,
  bytes: Uint8Array,
  pattern: RegExp,
  label: string,
) {
  const input = { owner, filename, bytes } as never;
  await assert.rejects(
    async () => importer.extract((await importer.validate(input)) as never, input),
    (error: Error & { code?: string }) => {
      assert.equal(error.name, "AvatarImportError", `${label}: refused with an import error, not ${error.message}`);
      assert.equal(error.code, "invalid-file", label);
      assert.match(error.message, pattern, label);
      return true;
    },
    label,
  );
}

async function pixel(png: Uint8Array, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(Buffer.from(png)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const offset = (y * info.width + x) * 4;
  return [...data.subarray(offset, offset + 4)];
}

// ── PNGTuber Plus ──

const RED = [200, 30, 30, 255];
const GREEN = [30, 200, 30, 255];
const BLUE = [30, 30, 200, 255];
const BODY = [220, 220, 220, 255];
const body = await paintPng(40, 40, solid(220, 220, 220));
const mouth = (color: number[]) => paintPng(10, 4, solid(color[0]!, color[1]!, color[2]!));
const eyes = (color: number[]) => paintPng(20, 4, solid(color[0]!, color[1]!, color[2]!));
const twoFrames = await paintPng(20, 10, (x) => (x < 10 ? [10, 10, 10, 255] : [250, 250, 0, 255]));

const save = plusSave([
  plusSprite(100, body, { zindex: -1 }),
  // Children sit relative to their parent's origin (the body's centre).
  plusSprite(101, await mouth(RED), {
    parentId: 100,
    pos: "Vector2(0, 10)",
    showTalk: 1,
    path: "C:/a/mouth closed.png",
  }),
  plusSprite(102, await mouth(GREEN), {
    parentId: 100,
    pos: "Vector2(0, 10)",
    showTalk: 2,
    path: "C:/a/mouth open.png",
  }),
  plusSprite(103, await eyes(BLUE), { parentId: 100, pos: "Vector2(0, -8)", showBlink: 1 }),
  plusSprite(104, await eyes(RED), { parentId: 100, pos: "Vector2(0, -8)", showBlink: 2 }),
  // Only costume 2 shows this sprite, and its name says how the costume feels.
  plusSprite(105, await paintPng(6, 6, solid(250, 120, 160)), {
    parentId: 100,
    pos: "Vector2(-12, 2)",
    costumeLayers: "[0, 1, 0, 0, 0, 0, 0, 0, 0, 0]",
    path: "/home/me/pngtuber/Happy blush.png",
  }),
  // Saved without a picture: older PNGTuber Plus kept only the path on the author's disk.
  plusSprite(106, null, { parentId: 100 }),
  // A two-frame sprite sheet shows its first (dark) frame.
  plusSprite(107, twoFrames, { parentId: 100, pos: "Vector2(14, 14)", frames: 2, zindex: 2 }),
]);

assert.equal(
  pngtuberImporter.detect({ filename: "Avatar.SAVE", head: new TextEncoder().encode('\uFEFF \n{"0":') }),
  true,
);
assert.equal(pngtuberImporter.detect({ filename: "avatar.json", head: save }), false, "only .save files");
assert.equal(pngtuberImporter.detect({ filename: "game.save", head: new Uint8Array([0, 1, 2]) }), false, "only JSON");

const plus = await importFile(pngtuberImporter, "avatar.save", save);
assert.equal(plus.kind, "pngtuber");
assert.deepEqual(Object.keys(plus.data.layers), ["costume_1", "costume_2"], "costumes 3-10 equal costume 1");
const costume1 = plus.data.layers.costume_1!;
for (const key of ["base", "mouthOpen", "eyesClosed", "eyesClosedMouthOpen"] as const) {
  assert.equal(costume1[key]?.source, "file", `costume 1 has a ${key} picture`);
}
const files = new Map(plus.files.map((file) => [file.path, file.bytes]));
for (const path of files.keys()) assert.ok(isAvatarFilePath(path) && path.startsWith("pngtuber/"), `${path} is stored`);
const picture = (ref: { source: string; path?: string } | undefined) => files.get((ref as { path: string }).path)!;
const meta = await sharp(Buffer.from(picture(costume1.base))).metadata();
assert.deepEqual([meta.width, meta.height], [40, 40], "the canvas is the costumes' bounding box");
// Body centre is (20, 20); the mouth (10 x 4) is centred at (20, 30), the eyes (20 x 4) at (20, 12).
assert.deepEqual(await pixel(picture(costume1.base), 20, 30), RED, "quiet: the closed mouth shows");
assert.deepEqual(await pixel(picture(costume1.mouthOpen), 20, 30), GREEN, "talking: the open mouth shows");
assert.deepEqual(await pixel(picture(costume1.base), 20, 12), BLUE, "eyes open");
assert.deepEqual(await pixel(picture(costume1.eyesClosed), 20, 12), RED, "blinking: the closed eyes show");
assert.deepEqual(await pixel(picture(costume1.eyesClosed), 20, 30), RED, "blinking keeps the closed mouth");
assert.deepEqual(await pixel(picture(costume1.eyesClosedMouthOpen), 20, 30), GREEN);
assert.deepEqual(await pixel(picture(costume1.base), 20, 2), BODY, "the body is under its children (z -1)");
assert.deepEqual(await pixel(picture(costume1.base), 32, 34), [10, 10, 10, 255], "first animation frame only");
assert.deepEqual(await pixel(picture(costume1.base), 8, 22), BODY, "costume 1 hides the costume 2 sprite");
assert.deepEqual(await pixel(picture(plus.data.layers.costume_2!.base), 8, 22), [250, 120, 160, 255]);
assert.deepEqual(plus.data.expressionMap.happy, { target: "costume_2", source: "name-match", confidence: 1 });
assert.deepEqual(plus.data.expressionMap.neutral, { target: "costume_1", source: "preset", confidence: 1 });
assert.deepEqual(plus.data.expressionMap.angry, { target: null, source: "missing", confidence: 0 });
assert.deepEqual(
  plus.data.feelingMap,
  { embarrassment: { target: "costume_2", source: "name-match", confidence: 0.8 } },
  "a costume's own picture names a more specific feeling too (Happy blush)",
);
assert.equal(plus.data.source, "pngtuber-plus");
assert.ok(
  plus.warnings.some((warning) => /no picture saved/u.test(warning)),
  "skipped layers are reported",
);
assert.ok(
  plus.warnings.some((warning) => /first frame/u.test(warning)),
  "animated layers are reported",
);
assert.ok(avatarKindDataSchema.safeParse({ pngtuber: plus.data }).success, "the result is a valid PNGTuber setup");
{
  // Costumes by the names of their own pictures: a costume that only an extra feeling names is not left over.
  const shared = { sprite: { name: "body" } };
  const costume = (number: number, name: string) => ({
    number,
    members: [shared, { sprite: { name } }],
    hasTalk: false,
    hasBlink: false,
  });
  const costumes = [costume(1, "eyes"), costume(2, "happy eyes"), costume(3, "grateful eyes"), costume(4, "fear eyes")];
  const bound = bindPngtuberCostumes(costumes as never);
  assert.equal(bound.expressionMap.happy?.target, "costume_2", "the plain happy picture wins the main face");
  assert.deepEqual(bound.feelingMap, {
    gratitude: { target: "costume_3", source: "name-match", confidence: 0.8 },
    fear: { target: "costume_4", source: "name-match", confidence: 1 },
  });
  assert.equal(bound.unbound, 0, "every costume shows some feeling, so the import doesn't warn");
}

// A clipping sprite (`clipped`) shows its children only inside its own picture.
const clip = await importFile(
  pngtuberImporter,
  "clip.save",
  plusSave([
    plusSprite(1, await paintPng(20, 20, (x) => (x < 10 ? [100, 100, 100, 255] : [0, 0, 0, 0])), { clipped: true }),
    plusSprite(2, await paintPng(20, 20, solid(0, 0, 250)), { parentId: 1, pos: "Vector2(2, 0)" }),
    plusSprite(3, await paintPng(4, 4, solid(0, 250, 0)), { pos: "Vector2(30, 0)" }),
  ]),
);
const clipped = new Map(clip.files.map((file) => [file.path, file.bytes])).get(
  (clip.data.layers.costume_1!.base as { path: string }).path,
)!;
assert.deepEqual(await pixel(clipped, 5, 10), [0, 0, 250, 255], "the child shows over the clipping picture");
assert.equal((await pixel(clipped, 16, 10))[3], 0, "the child is cut away outside the clipping picture");
assert.equal(clip.data.layers.costume_1!.mouthOpen, undefined, "no talk sprites, no talk variant");

// A save spread far apart is scaled down rather than refused.
const spread = await importFile(
  pngtuberImporter,
  "spread.save",
  plusSave([plusSprite(1, body), plusSprite(2, body, { pos: "Vector2(6000, 0)" })]),
);
const spreadMeta = await sharp(Buffer.from(spread.files[0]!.bytes)).metadata();
assert.ok(spreadMeta.width! <= PNGTUBER_MAX_OUTPUT_SIDE, "the flattened picture fits the output side");
assert.ok(spread.warnings.some((warning) => /scaled down/u.test(warning)));

// A deep chain of clipping sprites on a large canvas costs what its own pictures cost, not a full-canvas pass
// per level (which took about 0.12 s per level on a 2048 px canvas, so this save took half a minute).
{
  const dot = await paintPng(1, 1, solid(10, 10, 10));
  const sprites = [plusSprite(0, dot), plusSprite(1, dot, { pos: "Vector2(2040, 2040)" })];
  for (let id = 2; id < 250; id += 1)
    sprites.push(plusSprite(id, dot, { clipped: true, parentId: id > 2 ? id - 1 : 0 }));
  const started = performance.now();
  const chain = await importFile(pngtuberImporter, "chain.save", plusSave(sprites));
  const seconds = (performance.now() - started) / 1000;
  const chainMeta = await sharp(Buffer.from(chain.files[0]!.bytes)).metadata();
  assert.ok(chainMeta.width! > 2000 && chainMeta.width! <= PNGTUBER_MAX_OUTPUT_SIDE, "the canvas is large");
  assert.ok(seconds < 8, `248 nested clipping sprites import quickly (${seconds.toFixed(2)} s)`);
}

// A loop of parent links is cut instead of hanging the import.
const loop = await importFile(
  pngtuberImporter,
  "loop.save",
  plusSave([plusSprite(1, body, { parentId: 2 }), plusSprite(2, body, { parentId: 1 })]),
);
assert.ok(
  loop.warnings.some((warning) => /linked to a layer/u.test(warning)),
  "the cut link is reported",
);

const notASave = /isn't a PNGTuber Plus avatar save/u;
const damaged = /damaged/u;
const encode = (text: string) => new TextEncoder().encode(text);
await refused(pngtuberImporter, "a.save", encode("{not json"), notASave, "not JSON");
await refused(pngtuberImporter, "a.save", encode("[1, 2]"), notASave, "an array");
await refused(pngtuberImporter, "a.save", encode("{}"), notASave, "no sprites");
await refused(pngtuberImporter, "a.save", encode('{"0": 5}'), notASave, "a sprite that is not an object");
await refused(
  pngtuberImporter,
  "a.save",
  plusSave([plusSprite(1, body, { showTalk: 7 })]),
  damaged,
  "an unknown talk rule",
);
await refused(
  pngtuberImporter,
  "a.save",
  plusSave([plusSprite(1, body, { pos: "Vector2(1e999, 0)" })]),
  damaged,
  "an infinite position",
);
await refused(
  pngtuberImporter,
  "a.save",
  plusSave([plusSprite(1, body, { pos: "process.exit()" })]),
  damaged,
  "not a vector",
);
await refused(
  pngtuberImporter,
  "a.save",
  plusSave([plusSprite(1, body, { costumeLayers: "[1, x]" })]),
  damaged,
  "bad costumes",
);
await refused(pngtuberImporter, "a.save", plusSave([plusSprite(1, body, { frames: 0 })]), damaged, "zero frames");
await refused(
  pngtuberImporter,
  "a.save",
  plusSave([plusSprite(1, body), plusSprite(1, body)]),
  damaged,
  "a repeated id",
);
await refused(
  pngtuberImporter,
  "a.save",
  plusSave([{ ...plusSprite(1, null), imageData: "%%%" }]),
  damaged,
  "bad base64",
);
await refused(
  pngtuberImporter,
  "a.save",
  plusSave([plusSprite(1, Buffer.from("GIF89a not a png"))]),
  damaged,
  "a picture that is not a PNG",
);
const hugeHeader = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]),
  Buffer.from("IHDR"),
  Buffer.from([0, 0, 0x4e, 0x20, 0, 0, 0x4e, 0x20, 8, 6, 0, 0, 0]),
]);
await refused(pngtuberImporter, "a.save", plusSave([plusSprite(1, hugeHeader)]), /too large to open/u, "a decode bomb");
await refused(pngtuberImporter, "a.save", plusSave([plusSprite(1, null)]), /no pictures inside it/u, "pictureless");
await refused(
  pngtuberImporter,
  "a.save",
  plusSave(Array.from({ length: 513 }, (_, index) => plusSprite(index, null))),
  /more than 512 layers/u,
  "too many sprites",
);

// PNGTuber Plus's own default avatar (a real save): one costume, flattened with its talk and blink layers.
const realSave = new Uint8Array(readFileSync(PNGTUBER_PLUS_DEFAULT_SAVE));
const real = await importFile(pngtuberImporter, "defaultAvatar.save", realSave);
assert.deepEqual(Object.keys(real.data.layers), ["costume_1"]);
assert.deepEqual(real.warnings, [], "nothing in PNGTuber Plus's own save is skipped");
assert.deepEqual(real.data.expressionMap.neutral, { target: "costume_1", source: "preset", confidence: 1 });
const realPictures = new Map(real.files.map((file) => [file.path, Buffer.from(file.bytes)]));
const realSet = real.data.layers.costume_1!;
const realVariants = [realSet.base, realSet.mouthOpen, realSet.eyesClosed, realSet.eyesClosedMouthOpen].map((ref) =>
  realPictures.get((ref as { path: string }).path)!,
);
assert.equal(new Set(realVariants.map((png) => png.toString("base64"))).size, 4, "four different pictures");
for (const png of realVariants) {
  const size = await sharp(png).metadata();
  assert.deepEqual([size.width, size.height], [385, 440], "every variant shares the avatar's bounding box");
}

// ── mesh-avatar ──

const meshFiles = await meshAvatarFiles();
const stored = zipFiles(meshFiles);
assert.equal(mavatarImporter.detect({ filename: "Model.MAVATAR", head: stored }), true);
assert.equal(mavatarImporter.detect({ filename: "model.zip", head: stored }), false, "only .mavatar files");
assert.equal(mavatarImporter.detect({ filename: "model.mavatar", head: encode("{}") }), false, "only ZIPs");

async function storedArchive(result: Awaited<ReturnType<typeof importFile>>) {
  assert.equal(result.kind, "mesh-avatar");
  assert.equal(result.files.length, 1);
  const [file] = result.files;
  assert.ok(isAvatarFilePath(file!.path) && file!.path.startsWith("mesh-avatar/") && file!.path.endsWith(".mavatar"));
  assert.equal((result.data as { file: string }).file, file!.path);
  assert.ok(avatarKindDataSchema.safeParse({ "mesh-avatar": result.data }).success, "the result is a valid setup");
  // The stored copy is what the browser runtime opens: its own unpack and validation must accept it.
  const unpacked = meshAvatar.unpackAvatar(file!.bytes) as Record<string, Uint8Array>;
  assert.deepEqual(meshAvatar.validateAvatarFiles(unpacked), [], "mesh-avatar 0.1.1 accepts the stored archive");
  return unpacked;
}

const plain = await importFile(mavatarImporter, "model.mavatar", stored);
const plainFiles = await storedArchive(plain);
assert.deepEqual(Object.keys(plainFiles).sort(), [...meshFiles.keys()].sort());
assert.deepEqual(plain.detected.happy, { target: "happy", source: "preset", confidence: 1 });
assert.deepEqual(plain.detected.aa, { target: "a", source: "preset", confidence: 0.6 }, "no drawn mouth");
assert.deepEqual(plain.detected.blink, { target: "eyes_closed", source: "preset", confidence: 0.6 });
assert.ok(plain.warnings.some((warning) => /no drawn mouth or eye shapes/u.test(warning)));

// A re-zipped (deflated) archive with extra files imports; the stored copy keeps only what the player reads.
const extras = new Map(await meshAvatarFiles({ sprites: true }));
extras.set("source.png", await paintPng(4, 4, solid(1, 2, 3)));
extras.set("notes/readme.txt", Buffer.from("hello"));
const drawn = await importFile(mavatarImporter, "drawn.mavatar", zipFiles(extras, { deflate: true }));
const drawnFiles = await storedArchive(drawn);
assert.equal("source.png" in drawnFiles || "notes/readme.txt" in drawnFiles, false, "unread files are dropped");
assert.ok("built/sprites/mouth_a.png" in drawnFiles, "drawn sprites are kept");
assert.deepEqual(drawn.detected.aa, { target: "a", source: "preset", confidence: 1 }, "a drawn mouth");
assert.deepEqual(drawn.detected.blink, { target: "eyes_closed", source: "preset", confidence: 1 }, "drawn closed eyes");
assert.deepEqual(drawn.warnings, []);
assert.notEqual(drawn.files[0]!.path, plain.files[0]!.path, "a different file gets a different name");

const meshRefusal = async (
  label: string,
  change: (files: Map<string, Buffer>) => void | Promise<void>,
  pattern = /damaged|isn't a mesh avatar/u,
) => {
  const files = new Map(meshFiles);
  await change(files);
  await refused(mavatarImporter, "bad.mavatar", zipFiles(files), pattern, label);
};
const editJson = (name: string, edit: (value: Record<string, unknown>) => void) => (files: Map<string, Buffer>) => {
  const value = JSON.parse(files.get(name)!.toString());
  edit(value);
  files.set(name, Buffer.from(JSON.stringify(value)));
};
await refused(mavatarImporter, "bad.mavatar", encode("PK\u0003\u0004 not really"), /can't be read/u, "not a ZIP");
await meshRefusal("no manifest", (files) => void files.delete("avatar.json"), /isn't a mesh avatar/u);
await meshRefusal("no rig", (files) => void files.delete("rig.json"), /isn't a mesh avatar/u);
await meshRefusal(
  "another format",
  editJson("avatar.json", (value) => (value.format = "live2d")),
  /isn't a mesh avatar/u,
);
await meshRefusal(
  "a newer rig",
  editJson("rig.json", (value) => (value.version = 2)),
);
await meshRefusal(
  "an eye with no width",
  editJson("rig.json", (value) => ((value.eyes as { x1: number }[])[0]!.x1 = 0)),
);
await meshRefusal(
  "a negative head",
  editJson("rig.json", (value) => ((value.head as { rx: number }).rx = -1)),
);
await meshRefusal(
  "a size mismatch",
  editJson("built/layers.json", (value) => (value.size = [64, 64])),
);
await meshRefusal(
  "eyes that disagree",
  editJson("built/layers.json", (value) => ((value.eyes as { x0: number }[])[1]!.x0 = 1)),
);
await meshRefusal(
  "a layer outside the image",
  editJson("built/layers.json", (value) => ((value.layers as Record<string, number[]>).eye0_ball = [120, 150, 20, 12])),
);
await meshRefusal(
  "an unsafe layer name",
  editJson("built/layers.json", (value) => ((value.layers as Record<string, number[]>)["../x"] = [0, 0, 1, 1])),
);
await meshRefusal("a missing layer picture", (files) => void files.delete("built/eye1_lash.png"));
await meshRefusal("a layer that is not a PNG", (files) => void files.set("built/eye0_ball.png", Buffer.from("GIF89a")));
await meshRefusal("a picture bigger than the image", async (files) => {
  files.set("built/base.png", await paintPng(129, 160, solid(0, 0, 0)));
});
// A rig whose mesh would have millions of points is refused, however small the file: the player moves every
// point on each frame, so it would freeze the chat. A rig at Studio's example cell sizes is far below the cap.
await meshRefusal(
  "a 4096 px rig with 1 px cells",
  (files) => {
    editJson("rig.json", (value) => {
      value.image = { width: 4096, height: 4096 };
      (value.mesh as { baseCell: number }).baseCell = 1;
    })(files);
    editJson("built/layers.json", (value) => (value.size = [4096, 4096]))(files);
  },
  /too detailed/u,
);
{
  const studioRig = {
    image: { width: 2048, height: 2048 },
    mesh: {
      baseCell: 14,
      fine: { x0: 400, x1: 1600, y0: 100, y1: 1500, cell: 7 },
      handCell: 9,
      tasselCell: 6,
      eyeBallCell: 4,
      eyeCell: 3,
      spriteCell: 4,
    },
  };
  const eyeRects = new Map(
    [0, 1].flatMap((eye) =>
      ["ball", "low", "crease", "lash"].map((part) => [`eye${eye}_${part}`, [800 + eye * 300, 700, 160, 90]] as const),
    ),
  );
  const points = countMeshAvatarGridPoints(
    studioRig as never,
    eyeRects as never,
    new Map([["mouth_a", [950, 1000, 120, 60]]]) as never,
  );
  assert.ok(points > 20_000 && points < MESH_AVATAR_MAX_GRID_POINTS / 4, `a Studio-sized rig has ${points} points`);
}

// The unpacked files share the upload cap: a deflated archive whose PNGs are padded past it is refused before
// it is held in memory or stored, even though each file alone is under the per-file cap.
{
  const padded = new Map(meshFiles);
  const padding = Buffer.alloc(129 * 1024 * 1024);
  for (const name of ["built/base.png", "built/hairmask.png"]) {
    padded.set(name, Buffer.concat([padded.get(name)!, padding]));
  }
  const upload = zipFiles(padded, { deflate: true });
  assert.ok(upload.length < 2 * 1024 * 1024, "the upload itself is small");
  await refused(
    mavatarImporter,
    "padded.mavatar",
    upload,
    /too large once unpacked/u,
    "an archive that inflates past the cap",
  );
}

// ZIP writers clean names like "../../", so the climbing name is patched into the local and central records.
const climbing = zipFiles(new Map([...meshFiles, ["zz/escape.json", Buffer.from("{}")]]));
for (let at = climbing.indexOf("zz/escape.json"); at >= 0; at = climbing.indexOf("zz/escape.json", at)) {
  climbing.write("../escape.json", at);
}
await refused(mavatarImporter, "bad.mavatar", climbing, /damaged/u, "an entry that climbs out");
const tampered = Buffer.from(stored);
const nameAt = tampered.indexOf(Buffer.from("avatar.json"));
tampered[nameAt] = "x".charCodeAt(0);
await refused(mavatarImporter, "bad.mavatar", tampered, /can't be read/u, "records that disagree");

console.log("avatar 2D importers regression passed");
