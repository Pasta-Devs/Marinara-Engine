import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AdmZip from "adm-zip";
import { mmdPmx, mmdVmd } from "./fixtures/avatar-mmd-fixtures.js";

const directory = mkdtempSync(join(tmpdir(), "marinara-mmd-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const { findAvatarImporter } = await import("../../packages/server/src/services/avatars/formats/registry.js");
const { mmdImporter, checkedPmx, mmdTextureMime, buildMmdImport } =
  await import("../../packages/server/src/services/avatars/formats/mmd.js");
const { openZipArchive } = await import("../../packages/server/src/lib/zip-reader.js");
const { avatarConfigSchema, createAvatarConfig, characterDataSchema, isAvatarFilePath, AVATAR_MMD_METADATA_LIMITS } =
  await import("../../packages/shared/src/index.js");
const storage = await import("../../packages/server/src/services/avatars/storage.js");
const owner = { ownerType: "character", ownerId: "mmd-regression" } as const;
const input = (bytes: Uint8Array, filename = "fixture.pmx") => ({ owner, bytes, filename });
const zip = (files: [string, Buffer][]) => {
  const archive = new AdmZip();
  for (const [name, bytes] of files) archive.addFile(name, bytes);
  return archive.toBuffer();
};
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
  "base64",
);
const refuses = async (bytes: Uint8Array, filename = "fixture.pmx", message?: RegExp) => {
  await assert.rejects(mmdImporter.validate(input(bytes, filename)), message ?? /MMD|PMX|VMD|texture|archive|model/iu);
};
const renameZipEntry = (archive: Buffer, from: string, to: string) => {
  assert.equal(Buffer.byteLength(from), Buffer.byteLength(to));
  const renamed = Buffer.from(archive);
  for (let offset = renamed.indexOf(from); offset !== -1; offset = renamed.indexOf(from, offset + 1))
    Buffer.from(to).copy(renamed, offset);
  return renamed;
};

try {
  const pmx = mmdPmx();
  const modelImporter = findAvatarImporter({ filename: "fixture.pmx", head: pmx });
  assert.equal(modelImporter?.kind, "mmd", "the real avatar registry must import a PMX model");

  const motionImporter = findAvatarImporter({ filename: "idle.vmd", head: mmdVmd() });
  assert.equal(motionImporter?.kind, "mmd", "the real avatar registry must attach VMD motion to an MMD model");

  // Real native-parser roundtrip, both PMX encodings and compatible2.1. No model conversion/provider.
  const validated = await mmdImporter.validate(input(pmx));
  const imported = await buildMmdImport(validated, input(pmx), null);
  assert.equal(imported.kind, "mmd");
  assert.equal(imported.data.expressionMap.happy?.target, "笑い");
  assert.deepEqual(imported.data.expressionNames, ["笑い"]);
  assert.deepEqual(imported.files[0]!.bytes, mmdPmx({ encoding: "utf16le" }), "only text encoding changed");
  assert.deepEqual(
    checkedPmx(mmdPmx({ encoding: "utf16le" })).bytes,
    mmdPmx({ encoding: "utf16le" }),
    "native UTF16 PMX stays byte-identical",
  );
  assert.deepEqual(
    checkedPmx(mmdPmx({ version: 2.1 })).bytes,
    imported.files[0]!.bytes,
    "compatible2.1 becomes native-parser playable2.0",
  );
  const config = {
    ...createAvatarConfig(owner, new Date().toISOString()),
    activeKind: "mmd",
    kinds: { mmd: imported.data },
  };
  assert(avatarConfigSchema.safeParse(config).success);
  assert(
    avatarConfigSchema.safeParse({
      ...config,
      kinds: {
        mmd: {
          ...imported.data,
          expressionNames: Array.from(
            { length: AVATAR_MMD_METADATA_LIMITS.expressionNames },
            (_, index) => `face-${index}`,
          ),
        },
      },
    }).success,
  );
  for (const data of [
    {
      ...imported.data,
      expressionNames: Array.from(
        { length: AVATAR_MMD_METADATA_LIMITS.expressionNames + 1 },
        (_, index) => `face-${index}`,
      ),
    },
    {
      ...imported.data,
      texturePaths: Object.fromEntries(
        Array.from({ length: AVATAR_MMD_METADATA_LIMITS.textures + 1 }, (_, index) => [
          `face-${index}.png`,
          `mmd/texture-${index}.png`,
        ]),
      ),
    },
    {
      ...imported.data,
      texturePaths: { ["a".repeat(AVATAR_MMD_METADATA_LIMITS.textureReferenceChars + 1)]: "mmd/texture.png" },
    },
  ])
    assert(
      !avatarConfigSchema.safeParse({ ...config, kinds: { mmd: data } }).success,
      "saved MMD setup metadata is bounded",
    );
  const manyFaces = mmdPmx({ morphCount: 257, independentMorphs: true, morphNameAt: 256 });
  const boundedFaces = await buildMmdImport(await mmdImporter.validate(input(manyFaces)), input(manyFaces), null);
  assert.equal(boundedFaces.data.expressionNames?.length, AVATAR_MMD_METADATA_LIMITS.expressionNames);
  assert(!boundedFaces.data.expressionNames?.includes("笑い"));
  assert.equal(
    boundedFaces.data.expressionMap.happy?.target,
    "笑い",
    "a valid auto-bound face outside the offered catalogue is preserved",
  );
  assert(
    boundedFaces.warnings.some((warning) => warning.includes("256")),
    "the offered catalogue ceiling is disclosed",
  );
  assert.deepEqual(
    boundedFaces.files[0]!.bytes,
    checkedPmx(manyFaces).bytes,
    "the native morph model itself is not trimmed",
  );
  assert(isAvatarFilePath("mmd/model.pmx"));
  assert(!isAvatarFilePath("mmd/nested/model.pmx"));
  assert(
    !avatarConfigSchema.safeParse({
      ...config,
      kinds: { mmd: { ...imported.data, texturePaths: { skin: "vrm/model.vrm" } } },
    }).success,
  );

  // Count, index, flag, number and truncation checks happen on actual binary input.
  let vertexCount = 17;
  for (let i = 0; i < 4; i += 1) vertexCount += 4 + pmx.readUInt32LE(vertexCount);
  const corrupt = (offset: number, write: (bytes: Buffer, offset: number) => void) => {
    const bytes = Buffer.from(pmx);
    write(bytes, offset);
    return bytes;
  };
  await refuses(corrupt(vertexCount, (bytes, offset) => bytes.writeUInt32LE(0xffffffff, offset)));
  await refuses(corrupt(vertexCount + 4 + 3 * 38 + 4, (bytes, offset) => bytes.writeUInt8(3, offset)));
  await refuses(
    corrupt(vertexCount + 4 + 32, (bytes, offset) => bytes.writeUInt8(4, offset)),
    "fixture.pmx",
    /QDEF/u,
  );
  await refuses(corrupt(vertexCount + 4, (bytes, offset) => bytes.writeFloatLE(Number.NaN, offset)));
  await refuses(corrupt(4, (bytes, offset) => bytes.writeFloatLE(Number.NaN, offset)));
  await mmdImporter.validate(input(mmdPmx({ ikIterations: 40 })));
  await refuses(mmdPmx({ ikIterations: 0xffffffff }), "fixture.pmx", /IK iterations/u);
  await mmdImporter.validate(input(mmdPmx({ boneCount: 256, morphCount: 256 })));
  await refuses(mmdPmx({ boneCount: 257 }), "fixture.pmx", /bone hierarchy.*deep/u);
  await refuses(mmdPmx({ morphCount: 258 }), "fixture.pmx", /group morph hierarchy.*deep/u);
  await mmdImporter.validate(input(mmdPmx({ vertexCount: 100, morphCount: 100, sparseMorphs: true })));
  const sparse = mmdPmx({ vertexCount: 10_000, morphCount: 3_000, sparseMorphs: true });
  assert(sparse.length < 1024 * 1024, "small valid sparse records can imply a huge mandatory decoded allocation");
  const NativeParser = createRequire(new URL("../../packages/server/package.json", import.meta.url))("mmd-parser")
    .Parser as new () => {
    parsePmx(bytes: ArrayBuffer): { metadata: { vertexCount: number; morphCount: number } };
  };
  const nativeSparse = mmdPmx({ vertexCount: 10_000, morphCount: 3_000, sparseMorphs: true, encoding: "utf16le" });
  const sparseDecoded = new NativeParser().parsePmx(
    nativeSparse.buffer.slice(
      nativeSparse.byteOffset,
      nativeSparse.byteOffset + nativeSparse.byteLength,
    ) as ArrayBuffer,
  );
  assert.equal(sparseDecoded.metadata.vertexCount, 10_000);
  assert.equal(
    sparseDecoded.metadata.morphCount,
    3_000,
    "the native parser proves a complete valid layout without constructing GPU targets",
  );
  await refuses(sparse, "fixture.pmx", /decoded morph targets.*memory/u);
  for (const cut of [0, 4, 16, vertexCount + 2, pmx.length - 1]) await refuses(pmx.subarray(0, cut));
  const softbody = mmdPmx({ version: 2.1 });
  softbody.writeUInt32LE(1, softbody.length - 4);
  await refuses(softbody, "fixture.pmx", /soft bodies/u);
  const flip = Buffer.from(pmx);
  const morph = flip.indexOf(Buffer.from("笑い"));
  const morphType = morph + Buffer.byteLength("笑い") + 4 + Buffer.byteLength("happy") + 1;
  flip[morphType] = 9;
  await refuses(flip, "fixture.pmx", /flip or impulse/u);

  // Exact raw references survive, including Japanese and Windows separators. Contained sibling paths work.
  const textured = mmdPmx({ texture: "..\\textures\\肌.png" });
  const bundle = zip([
    ["model/avatar.pmx", textured],
    ["textures/肌.png", png],
  ]);
  const bundled = await mmdImporter.extract(
    await mmdImporter.validate(input(bundle, "model.zip")),
    input(bundle, "model.zip"),
  );
  assert.deepEqual(Object.keys(bundled.data.texturePaths), ["..\\textures\\肌.png"]);
  assert.match(bundled.data.texturePaths["..\\textures\\肌.png"]!, /^mmd\/texture-[a-f0-9]+\.png$/u);
  assert.equal(bundled.files.length, 2);

  // Finder resource forks are not extra models, motions or textures; all archive guards still apply.
  const cleanMacEntries: [string, Buffer][] = [
    ["model/avatar.pmx", textured],
    ["textures/肌.png", png],
    ["motions/idle.vmd", mmdVmd()],
  ];
  const metadata = Buffer.alloc(64, 7);
  const macEntries: [string, Buffer][] = [
    ...cleanMacEntries,
    ["__MACOSX/model/._avatar.pmx", metadata],
    ["__MACOSX/motions/._idle.vmd", metadata],
    ["model/._avatar.pmx", metadata],
    ["motions/._idle.vmd", metadata],
    ["__MACOSX/textures/._肌.png", metadata],
  ];
  const extractZip = async (bytes: Buffer) =>
    mmdImporter.extract(await mmdImporter.validate(input(bytes, "model.zip")), input(bytes, "model.zip"));
  const cleanMac = await extractZip(zip(cleanMacEntries));
  assert.deepEqual(await extractZip(zip(macEntries)), cleanMac, "real model, textures and VMD remain identical");
  await refuses(zip([...macEntries, ["second.pmx", pmx]]), "model.zip", /one PMX/u);
  await refuses(zip([...macEntries, ["second.vmd", mmdVmd()]]), "model.zip", /at most one VMD/u);
  await refuses(
    zip([
      ["__MACOSX/._avatar.pmx", pmx],
      ["._idle.vmd", mmdVmd()],
    ]),
    "model.zip",
    /one PMX/u,
  );
  const oversizedMetadata = zip(macEntries);
  const metadataName = "__MACOSX/textures/._肌.png";
  const metadataCentral = oversizedMetadata.lastIndexOf(Buffer.from(metadataName)) - 46;
  assert.equal(oversizedMetadata.readUInt32LE(metadataCentral), 0x02014b50);
  assert.equal(oversizedMetadata.readUInt16LE(metadataCentral + 10), 8);
  const metadataLocal = oversizedMetadata.readUInt32LE(metadataCentral + 42);
  oversizedMetadata.writeUInt32LE(storage.AVATAR_IMPORT_MAX_BYTES + 1, metadataCentral + 24);
  oversizedMetadata.writeUInt32LE(storage.AVATAR_IMPORT_MAX_BYTES + 1, metadataLocal + 22);
  assert(oversizedMetadata.length < 4096, "the declared-size control never allocates a large resource fork");
  assert.throws(
    () => openZipArchive(oversizedMetadata).getEntry(metadataName)!.read(storage.AVATAR_IMPORT_MAX_BYTES),
    /too large/u,
  );
  assert.deepEqual(await extractZip(oversizedMetadata), cleanMac, "metadata payload is neither read nor counted");
  for (const path of [
    "/__MACOSX/._avatar.pmx",
    "C:/__MACOSX/._avatar.pmx",
    "__MACOSX/../._avatar.pmx",
    "__MACOSX\\._avatar.pmx",
    "__MACOSX/._bad\0.pmx",
  ]) {
    const safe = "z".repeat(Buffer.byteLength(path));
    await refuses(
      renameZipEntry(zip([...cleanMacEntries, [safe, metadata]]), safe, path),
      "model.zip",
      /unsafe|local files/u,
    );
  }
  const firstMetadata = "__MACOSX/._a.pmx";
  for (const duplicateName of [firstMetadata, "__MACOSX/./._a.pmx"]) {
    const safe = "y".repeat(Buffer.byteLength(duplicateName));
    await refuses(
      renameZipEntry(zip([...cleanMacEntries, [firstMetadata, metadata], [safe, metadata]]), safe, duplicateName),
      "model.zip",
      /duplicate|more than once/u,
    );
  }
  const linkedMetadata = zip([...cleanMacEntries, [firstMetadata, metadata]]);
  const linkedMetadataCentral = linkedMetadata.lastIndexOf(Buffer.from(firstMetadata)) - 46;
  linkedMetadata.writeUInt32LE(0xa1ff0000, linkedMetadataCentral + 38);
  await refuses(linkedMetadata, "model.zip", /symbolic links/u);

  assert.equal(mmdTextureMime(png, "toon.sph"), "image/png", "sphere texture suffix can carry a raster");
  const largePng = Buffer.from(png);
  largePng.writeUInt32BE(50_000, 16);
  largePng.writeUInt32BE(50_000, 20);
  assert.equal(
    mmdTextureMime(largePng, "skin.png"),
    null,
    "hostile PNG dimensions cannot advertise a 10GB decoded texture",
  );
  await refuses(
    zip([
      ["model.pmx", mmdPmx({ texture: "skin.png" })],
      ["skin.png", largePng],
    ]),
    "model.zip",
    /raster/u,
  );
  const overLong = "a".repeat(AVATAR_MMD_METADATA_LIMITS.textureReferenceChars + 1) + ".png";
  const jpegHeader = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x20, 0x02]),
    Buffer.alloc(8192),
    Buffer.from([0xff, 0xc0, 0, 17, 8, 0, 1, 0, 1, 3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0]),
  ]);
  assert.equal(
    mmdTextureMime(jpegHeader, "skin.jpg"),
    "image/jpeg",
    "complete JPEG header dimensions can follow a large metadata block",
  );
  assert.equal(
    mmdTextureMime(jpegHeader.subarray(0, 4096), "skin.jpg", jpegHeader.length),
    "image/jpeg",
    "the serving sniff must not reject an imported JPEG merely because dimensions follow its short header",
  );
  await refuses(
    zip([
      ["model.pmx", mmdPmx({ texture: overLong })],
      [overLong, png],
    ]),
    "model.zip",
    /path.*long/u,
  );
  const names = Array.from({ length: AVATAR_MMD_METADATA_LIMITS.textures }, (_, index) => `skin-${index}.png`);
  await mmdImporter.validate(
    input(
      zip([["model.pmx", mmdPmx({ textures: names })], ...names.map((name): [string, Buffer] => [name, png])]),
      "model.zip",
    ),
  );
  const tooManyNames = [...names, "overflow.png"];
  await refuses(
    zip([
      ["model.pmx", mmdPmx({ textures: tooManyNames })],
      ...tooManyNames.map((name): [string, Buffer] => [name, png]),
    ]),
    "model.zip",
    /too many textures/u,
  );
  const decodedLimitPng = Buffer.from(png);
  decodedLimitPng.writeUInt32BE(8192, 16);
  decodedLimitPng.writeUInt32BE(8192, 20);
  assert.equal(
    mmdTextureMime(decodedLimitPng, "a.png"),
    "image/png",
    "each hostile-header control is within the individual decoded budget",
  );
  await refuses(
    zip([
      ["model.pmx", mmdPmx({ textures: ["a.png", "b.png"] })],
      ["a.png", decodedLimitPng],
      ["b.png", decodedLimitPng],
    ]),
    "model.zip",
    /pictures.*memory/u,
  );
  await refuses(mmdPmx({ texture: "skin.png" }), "avatar.pmx", /missing/u);
  for (const texture of [
    "/etc/passwd",
    "C:\\secret.png",
    "https://example.com/a.png",
    "../escape.png",
    "\\\\host\\share.png",
  ]) {
    await refuses(zip([["avatar.pmx", mmdPmx({ texture })]]), "model.zip");
  }
  for (const path of ["../avatar.pmx", "/avatar.pmx", "C:/avatar.pmx", "unsafe\\avatar.pmx"]) {
    // AdmZip sanitizes names when authoring; restore the hostile bytes in both ZIP headers.
    const safe = "x".repeat(Buffer.byteLength(path));
    const unsafe = zip([[safe, pmx]]);
    for (
      let offset = unsafe.indexOf(Buffer.from(safe));
      offset !== -1;
      offset = unsafe.indexOf(Buffer.from(safe), offset + 1)
    )
      Buffer.from(path).copy(unsafe, offset);
    await refuses(unsafe, "model.zip");
  }
  await refuses(
    zip([
      ["a.pmx", pmx],
      ["b.pmx", pmx],
    ]),
    "model.zip",
    /one PMX/u,
  );
  const duplicate = zip([
    ["a.pmx", pmx],
    ["b.pmx", pmx],
  ]);
  for (
    let offset = duplicate.indexOf(Buffer.from("b.pmx"));
    offset !== -1;
    offset = duplicate.indexOf(Buffer.from("b.pmx"), offset + 1)
  )
    Buffer.from("a.pmx").copy(duplicate, offset);
  await refuses(duplicate, "model.zip", /duplicate|more than once/u);
  const linked = zip([["a.pmx", pmx]]);
  const central = linked.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  linked.writeUInt32LE(0xa1ff0000, central + 38);
  await refuses(linked, "model.zip", /symbolic links/u);
  const crc = zip([["a.pmx", pmx]]);
  const local = crc.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  crc[local + 30 + crc.readUInt16LE(local + 26) + crc.readUInt16LE(local + 28)]! ^= 1;
  await refuses(crc, "model.zip");

  // Checked BMP/TGA delivery, including RLE bounds; no SVG/HTML disguised as texture data.
  const bmp = Buffer.alloc(70);
  bmp.write("BM");
  bmp.writeUInt32LE(70, 2);
  bmp.writeUInt32LE(54, 10);
  bmp.writeUInt32LE(40, 14);
  bmp.writeInt32LE(2, 18);
  bmp.writeInt32LE(2, 22);
  bmp.writeUInt16LE(1, 26);
  bmp.writeUInt16LE(24, 28);
  const tga = Buffer.alloc(30);
  tga[2] = 2;
  tga.writeUInt16LE(2, 12);
  tga.writeUInt16LE(2, 14);
  tga[16] = 24;
  assert.equal(mmdTextureMime(bmp, "skin.bmp"), "image/bmp");
  assert.equal(mmdTextureMime(bmp, "shine.spa"), "image/bmp");
  assert.equal(mmdTextureMime(tga, "skin.tga"), "image/x-tga");
  const badTga = Buffer.from(tga.subarray(0, 19));
  badTga[2] = 10;
  badTga[18] = 0xff;
  assert.equal(mmdTextureMime(badTga, "skin.tga"), null);
  assert.equal(mmdTextureMime(Buffer.from("<svg onload='alert(1)'/>"), "skin.png"), null);
  const hugeBmp = Buffer.from(bmp);
  hugeBmp.writeInt32LE(0x7fffffff, 18);
  assert.equal(mmdTextureMime(hugeBmp, "skin.bmp"), null);

  // A VMD attaches only after a real model exists; wrong-name/camera-only/truncated motions are refused.
  const motionInput = input(mmdVmd(), "idle.vmd");
  const motion = await mmdImporter.validate(motionInput);
  await assert.rejects(buildMmdImport(motion, motionInput, null), /model before/u);
  const mismatch = zip([
    ["a.pmx", mmdPmx({ boneName: "other" })],
    ["idle.vmd", mmdVmd()],
  ]);
  await assert.rejects(
    mmdImporter.extract(await mmdImporter.validate(input(mismatch, "model.zip")), input(mismatch, "model.zip")),
    /matching/u,
  );
  const motionBundle = zip([
    ["a.pmx", pmx],
    ["idle.vmd", mmdVmd()],
  ]);
  const animated = await mmdImporter.extract(
    await mmdImporter.validate(input(motionBundle, "model.zip")),
    input(motionBundle, "model.zip"),
  );
  assert.equal(animated.data.idleAnimation, "mmd/idle.vmd");
  assert.equal(animated.files.length, 2);
  const badMotion = mmdVmd();
  badMotion.writeUInt32LE(0xffffffff, 50);
  await refuses(badMotion, "idle.vmd");
  await refuses(mmdVmd().subarray(0, 90), "idle.vmd");
  const nonfiniteMotion = mmdVmd();
  nonfiniteMotion.writeFloatLE(Number.POSITIVE_INFINITY, 50 + 4 + 15 + 4);
  await refuses(nonfiniteMotion, "idle.vmd");

  // Storage uses the existing owner transaction and keeps resources when an idle motion is replaced.
  await storage.saveExtractedAvatar(owner, bundled);
  const before = await storage.readAvatarFile(owner, bundled.data.file);
  const attached = await buildMmdImport(motion, motionInput, bundled.data);
  await storage.saveExtractedAvatar(owner, attached);
  assert.deepEqual(await storage.readAvatarFile(owner, bundled.data.file), before);
  assert(await storage.readAvatarFile(owner, Object.values(bundled.data.texturePaths)[0]!));
  assert.equal((await storage.readAvatarConfig(owner))?.kinds.mmd?.idleAnimation, "mmd/idle.vmd");
  await refuses(Buffer.from("PMX broken"));
  assert.deepEqual(
    await storage.readAvatarFile(owner, bundled.data.file),
    before,
    "failed replacement leaves prior model intact",
  );

  // Extraction reads and saves are one owner transaction, including a held motion attachment.
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const order: string[] = [];
  const first = storage.saveExtractedAvatar(owner, async () => {
    const current = (await storage.readAvatarConfig(owner))!.kinds.mmd!;
    order.push("motion-read");
    enter();
    await held;
    return buildMmdImport(motion, motionInput, current);
  });
  await entered;
  const second = storage.saveExtractedAvatar(owner, async () => {
    order.push("face-read");
    const current = (await storage.readAvatarConfig(owner))!.kinds.mmd!;
    return {
      kind: "mmd",
      files: [],
      data: {
        ...current,
        expressionMap: { ...current.expressionMap, happy: { target: null, source: "user", confidence: 1 } },
      },
      detected: {},
      warnings: [],
    };
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(order, ["motion-read"], "second extraction waits for the owner transaction");
  release();
  await Promise.all([first, second]);
  assert.deepEqual(order, ["motion-read", "face-read"]);
  const raced = (await storage.readAvatarConfig(owner))!.kinds.mmd!;
  assert.equal(raced.expressionMap.happy?.target, null, "a later face edit is retained");
  assert.equal(raced.idleAnimation, "mmd/idle.vmd", "the later edit reads the attached motion");

  // Actual routes prove PMX/VMD and raster MIME separation, rejection after file tampering, and symlink containment.
  const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
  const Fastify = requireServer("fastify") as typeof import("fastify").default;
  const { avatarModelsRoutes } = await import("../../packages/server/src/routes/avatar-models.routes.js");
  const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
  const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
  const db = await getDB();
  const characters = createCharactersStorage(db);
  const character = await characters.create(characterDataSchema.parse({ name: "Synthetic MMD" }));
  const routeOwner = { ownerType: "character", ownerId: character.id } as const;
  await storage.saveExtractedAvatar(routeOwner, {
    ...bundled,
    files: [...bundled.files, { path: "mmd/skin.bmp", bytes: bmp }, { path: "mmd/skin.tga", bytes: tga }],
    data: { ...bundled.data, texturePaths: { ...bundled.data.texturePaths, bmp: "mmd/skin.bmp", tga: "mmd/skin.tga" } },
  });
  const app = Fastify();
  app.decorate("db", db);
  await app.register(avatarModelsRoutes, { prefix: "/api/avatar-models" });
  const base = `/api/avatar-models/character/${character.id}/files/`;
  assert.equal(
    (await app.inject({ method: "GET", url: `${base}mmd/model.pmx` })).headers["content-type"],
    "application/octet-stream",
  );
  for (const [name, mime] of [
    [Object.values(bundled.data.texturePaths)[0]!, "image/png"],
    ["mmd/skin.bmp", "image/bmp"],
    ["mmd/skin.tga", "image/x-tga"],
  ]) {
    const response = await app.inject({ method: "GET", url: base + name });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["content-type"], mime);
  }
  const bmpPath = storage.resolveAvatarFile(routeOwner, "mmd/skin.bmp");
  writeFileSync(bmpPath, "<script>not an image</script>");
  assert.equal((await app.inject({ method: "GET", url: base + "mmd/skin.bmp" })).statusCode, 404);
  rmSync(bmpPath);
  const outside = join(directory, "outside.bmp");
  writeFileSync(outside, bmp);
  symlinkSync(outside, bmpPath);
  assert.equal((await app.inject({ method: "GET", url: base + "mmd/skin.bmp" })).statusCode, 404);
  assert.deepEqual(readFileSync(outside), bmp);
  await app.close();
  closeDB();
  await storage.removeAvatarKind(owner, "mmd");
  assert.equal(await storage.readAvatarConfig(owner), null);
  console.log("MMD import/storage/route regressions passed (synthetic PMX/VMD; no real model/hardware claim).");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
