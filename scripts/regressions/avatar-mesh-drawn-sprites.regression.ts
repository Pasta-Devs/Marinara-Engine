/** Complete drawn mesh sprites use aligned crops and never publish a partial set. Synthetic art only. */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-mesh-drawn-sprites-"));
process.env.DATA_DIR = dataDir;
process.env.LOG_LEVEL = "silent";

const { getSharp } = await import("../../packages/server/src/services/image/sharp-runtime.js");
const { meshDrawnFaceFixture } = await import("./fixtures/mesh-drawn-face.js");
const { deriveMeshRig, checkMeshRigLayout } =
  await import("../../packages/server/src/services/avatars/generation/mesh-rig-layout.js");
const { addMeshAvatarDrawnSprites, buildMeshAvatarLayers, MESH_DRAWN_PICTURE_KEYS, packMeshAvatar } =
  await import("../../packages/server/src/services/avatars/generation/mesh-layer-builder.js");
const { readMeshAvatarArchive } = await import("../../packages/server/src/services/avatars/formats/mavatar.js");
const runtime = await import(
  new URL("../../packages/client/node_modules/mesh-avatar/dist/index.js", import.meta.url).href
);
const sharp = await getSharp();

try {
  const { source, pictures, layout } = await meshDrawnFaceFixture();
  assert.deepEqual(checkMeshRigLayout(layout, source.width, source.height).errors, []);
  const rig = deriveMeshRig(layout, source.width, source.height);
  const built = await buildMeshAvatarLayers(source, rig);
  const before = [...built.files].map(([path, bytes]) => [path, Buffer.from(bytes)] as const);
  const assertUntouched = () => {
    assert.deepEqual([...built.files], before, "a draft build never mutates the original file map or its PNGs");
    assert.equal(
      [...built.files.keys()].some((path) => path.startsWith("built/sprites/")),
      false,
    );
  };

  const drawn = await addMeshAvatarDrawnSprites(source, rig, built, pictures);
  assert.notEqual(drawn.files, built.files);
  assertUntouched();
  for (const [path, bytes] of before) assert.deepEqual(drawn.files.get(path), bytes, `${path} stays unchanged`);
  const manifest = JSON.parse(drawn.files.get("built/sprites/sprites.json")!.toString()) as {
    version: number;
    build: string;
    layers: Record<string, [number, number, number, number]>;
  };
  const expected = [
    "mouth_a",
    "mouth_i",
    "mouth_o",
    "mouth_a_half",
    "eyes_closed_0",
    "eyes_closed_1",
    "eyes_half_0",
    "eyes_half_1",
    "eyes_smile_0",
    "eyes_smile_1",
  ];
  assert.equal(manifest.version, 1);
  assert.ok(manifest.build);
  assert.deepEqual(Object.keys(manifest.layers).sort(), expected.sort(), "the runtime gets all ten keys");
  assert.equal(drawn.files.size, built.files.size + 11, "ten PNGs plus their manifest");

  for (const [name, [left, top, width, height]] of Object.entries(manifest.layers)) {
    assert.ok(Number.isInteger(left) && Number.isInteger(top) && width > 0 && height > 0);
    assert.ok(left >= 0 && top >= 0 && left + width <= source.width && top + height <= source.height);
    const key = name.replace(/_[01]$/u, "") as (typeof MESH_DRAWN_PICTURE_KEYS)[number];
    const png = drawn.files.get(`built/sprites/${name}.png`)!;
    const metadata = await sharp(png).metadata();
    assert.deepEqual([metadata.width, metadata.height], [width, height], `${name} matches its rectangle`);
    const actual = await sharp(png).ensureAlpha().raw().toBuffer();
    const aligned = await sharp(pictures[key]).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer();
    let transparentSkin = false;
    for (let pixel = 0; pixel < actual.length; pixel += 4) {
      if (actual[pixel + 3]) {
        assert.deepEqual(
          actual.subarray(pixel, pixel + 3),
          aligned.subarray(pixel, pixel + 3),
          `${name} keeps aligned RGB at its absolute crop offset`,
        );
      } else if (aligned[pixel + 3]) transparentSkin = true;
    }
    assert.ok(transparentSkin, `${name} leaves unchanged surrounding skin transparent under runtime blush`);
    if (name.endsWith("_0")) assert.ok(left + width <= 120, `${name} cannot paint the other eye`);
    if (name.endsWith("_1")) assert.ok(left >= 120, `${name} cannot paint the other eye`);
  }
  const sourcePixels = await sharp(source.png).ensureAlpha().raw().toBuffer();
  const halfPixels = await sharp(pictures.eyes_half).ensureAlpha().raw().toBuffer();
  for (const [index, x] of [90, 150].entries()) {
    const name = `eyes_half_${index}`;
    const [left, top] = manifest.layers[name]!;
    const reconstructed = await sharp(built.files.get("built/base.png")!)
      .composite([
        {
          input: drawn.files.get(`built/sprites/${name}.png`)!,
          left,
          top,
        },
      ])
      .ensureAlpha()
      .raw()
      .toBuffer();
    const at = (112 * source.width + x) * 4;
    assert.deepEqual(
      halfPixels.subarray(at, at + 4),
      sourcePixels.subarray(at, at + 4),
      "this iris core is unchanged by the half-eye picture",
    );
    assert.deepEqual(
      reconstructed.subarray(at, at + 4),
      halfPixels.subarray(at, at + 4),
      "the half-eye sprite retains an unchanged iris after open-eye layers are hidden",
    );
  }
  const mouth = manifest.layers.mouth_a!;
  assert.ok(
    mouth[1] < layout.mouth.box[1] && mouth[1] + mouth[3] > layout.mouth.box[3],
    "the open mouth is not clipped to the small rest-mouth box",
  );
  const patch = await sharp(built.files.get("built/base.png")!)
    .composite([
      {
        input: drawn.files.get("built/sprites/mouth_a.png")!,
        left: mouth[0],
        top: mouth[1],
      },
    ])
    .ensureAlpha()
    .raw()
    .toBuffer();
  const mouthOpen = await sharp(pictures.mouth_a).ensureAlpha().raw().toBuffer();
  for (const [x, y] of [
    [108, 168],
    [120, 170],
    [120, 180],
  ]) {
    const at = (y! * source.width + x!) * 4;
    assert.deepEqual(
      patch.subarray(at, at + 4),
      mouthOpen.subarray(at, at + 4),
      "the patch covers the old lip and keeps the drawn open mouth",
    );
  }

  const files = new Map(drawn.files);
  files.set("rig.json", Buffer.from(JSON.stringify(rig)));
  files.set("avatar.json", Buffer.from(JSON.stringify({ format: "mesh-avatar", version: 1, name: "Synthetic face" })));
  const archive = packMeshAvatar(files);
  assert.deepEqual(
    runtime.validateAvatarFiles(runtime.unpackAvatar(archive)),
    [],
    "mesh-avatar 0.1.1 accepts the complete archive",
  );
  const checked = readMeshAvatarArchive(archive);
  assert.deepEqual([...checked.sprites].sort(), expected);
  assert.deepEqual(checked.warnings, []);

  const missing = { ...pictures };
  delete (missing as Partial<typeof pictures>).mouth_i;
  await assert.rejects(addMeshAvatarDrawnSprites(source, rig, built, missing), /mouth_i is missing/u);
  assertUntouched();
  // This last picture fails after earlier pictures were encoded; none may leak into the original build.
  await assert.rejects(
    addMeshAvatarDrawnSprites(source, rig, built, { ...pictures, eyes_smile: Buffer.from("not a PNG") }),
    /eyes_smile is not a readable picture/u,
  );
  assertUntouched();
  const wrongSize = await sharp(pictures.eyes_smile).resize(120, 150).png().toBuffer();
  await assert.rejects(
    addMeshAvatarDrawnSprites(source, rig, built, { ...pictures, eyes_smile: wrongSize }),
    /not aligned to the base picture's size/u,
  );
  assertUntouched();
  await assert.rejects(
    addMeshAvatarDrawnSprites(source, rig, built, { ...pictures, mouth_i: source.png }),
    /no changed mouth/u,
  );
  assertUntouched();

  const cancelled = new AbortController();
  cancelled.abort(new Error("already cancelled"));
  await assert.rejects(addMeshAvatarDrawnSprites(source, rig, built, pictures, cancelled.signal), /already cancelled/u);
  const during = new AbortController();
  const pending = addMeshAvatarDrawnSprites(source, rig, built, pictures, during.signal);
  setImmediate(() => during.abort(new Error("cancelled during pixel work")));
  await assert.rejects(pending, /cancelled during pixel work/u);
  assertUntouched();
  process.stdout.write("Mesh drawn sprites regression passed.\n");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
