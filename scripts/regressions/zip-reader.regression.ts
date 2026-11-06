// Archives Marinara did not create are read strictly: honest archives from common tools read exactly as
// before, self-contradictory or unsupported ones are refused with a plain message, every read names a
// byte limit, and each outside-archive entry point goes through the strict reader.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { devNull, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { crc32, deflateRawSync } from "node:zlib";
import type { ZipEntryBudget } from "../../packages/server/src/lib/zip-reader.js";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const dataDir = process.env.DATA_DIR!;
assert.ok(dataDir, "the regression runner provides a throwaway DATA_DIR");

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const serverRequire = createRequire(join(repositoryRoot, "packages/server/package.json"));
const AdmZip = serverRequire("adm-zip") as new (input?: Buffer) => {
  addFile(name: string, data: Buffer): void;
  toBuffer(): Buffer;
  getEntries(): Array<{ entryName: string; isDirectory: boolean; getData(): Buffer }>;
};
const { openZipArchive, ZipArchiveError } = await import("../../packages/server/src/lib/zip-reader.js");
const { streamZip } = await import("../../packages/server/src/utils/export-stream.js");

const U32_MAX = 0xffffffff;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const icon = Buffer.concat([PNG_SIGNATURE, Buffer.from("fixture icon bytes")]);

// ── A small writer for fixtures, with the record offsets a case needs to edit one field. ──

type Fixture = {
  name: string;
  data: Buffer;
  method?: 0 | 8;
  descriptor?: "signed" | "unsigned" | "zip64";
  zip64?: boolean;
  /** Point the central record here instead of writing a local record for this entry. */
  localAt?: number;
  /** Name bytes written without the UTF-8 flag, as legacy tools do. */
  rawName?: Buffer;
};

function pack(...fields: Array<[2 | 4 | 8, number]>): Buffer {
  const out = Buffer.alloc(fields.reduce((total, [width]) => total + width, 0));
  let offset = 0;
  for (const [width, value] of fields) {
    if (width === 2) out.writeUInt16LE(value, offset);
    else if (width === 4) out.writeUInt32LE(value, offset);
    else out.writeBigUInt64LE(BigInt(value), offset);
    offset += width;
  }
  return out;
}

function prepare(fixture: Fixture) {
  const method = fixture.method ?? 8;
  return {
    ...fixture,
    method,
    nameBytes: fixture.rawName ?? Buffer.from(fixture.name, "utf8"),
    nameFlag: fixture.rawName ? 0 : 0x0800,
    body: method === 8 ? deflateRawSync(fixture.data) : fixture.data,
    crc: crc32(fixture.data),
  };
}

function localRecord(fixture: Fixture): Buffer {
  const entry = prepare(fixture);
  const streamed = entry.descriptor !== undefined;
  const extra = entry.zip64
    ? Buffer.concat([pack([2, 1], [2, 16]), pack([8, entry.data.length], [8, entry.body.length])])
    : Buffer.alloc(0);
  const sizes = streamed ? [0, 0] : entry.zip64 ? [U32_MAX, U32_MAX] : [entry.body.length, entry.data.length];
  const header = pack(
    [4, 0x04034b50],
    [2, entry.zip64 ? 45 : 20],
    [2, entry.nameFlag | (streamed ? 0x0008 : 0)],
    [2, entry.method],
    [2, 0],
    [2, 0x5c21],
    [4, streamed ? 0 : entry.crc],
    [4, sizes[0]!],
    [4, sizes[1]!],
    [2, entry.nameBytes.length],
    [2, extra.length],
  );
  const descriptor =
    entry.descriptor === "signed"
      ? pack([4, 0x08074b50], [4, entry.crc], [4, entry.body.length], [4, entry.data.length])
      : entry.descriptor === "unsigned"
        ? pack([4, entry.crc], [4, entry.body.length], [4, entry.data.length])
        : entry.descriptor === "zip64"
          ? pack([4, 0x08074b50], [4, entry.crc], [8, entry.body.length], [8, entry.data.length])
          : Buffer.alloc(0);
  return Buffer.concat([header, entry.nameBytes, extra, entry.body, descriptor]);
}

function centralRecord(fixture: Fixture, offset: number): Buffer {
  const entry = prepare(fixture);
  const extra = entry.zip64
    ? Buffer.concat([pack([2, 1], [2, 24]), pack([8, entry.data.length], [8, entry.body.length], [8, offset])])
    : Buffer.alloc(0);
  const header = pack(
    [4, 0x02014b50],
    [2, 0x031e],
    [2, entry.zip64 ? 45 : 20],
    [2, entry.nameFlag | (entry.descriptor ? 0x0008 : 0)],
    [2, entry.method],
    [2, 0],
    [2, 0x5c21],
    [4, entry.crc],
    [4, entry.zip64 ? U32_MAX : entry.body.length],
    [4, entry.zip64 ? U32_MAX : entry.data.length],
    [2, entry.nameBytes.length],
    [2, extra.length],
    [2, 0],
    [2, 0],
    [2, 0],
    [4, (entry.name.endsWith("/") ? 0o040755 : 0o100644) * 0x10000],
    [4, entry.zip64 ? U32_MAX : offset],
  );
  return Buffer.concat([header, entry.nameBytes, extra]);
}

function buildZip(fixtures: Fixture[], options: { zip64End?: boolean; comment?: string } = {}) {
  const records: Buffer[] = [];
  const localOffsets: number[] = [];
  let offset = 0;
  for (const fixture of fixtures) {
    if (fixture.localAt !== undefined) {
      localOffsets.push(fixture.localAt);
      continue;
    }
    const record = localRecord(fixture);
    localOffsets.push(offset);
    records.push(record);
    offset += record.length;
  }
  const directoryOffset = offset;
  const centralOffsets: number[] = [];
  const central = fixtures.map((fixture, index) => {
    centralOffsets.push(offset);
    const record = centralRecord(fixture, localOffsets[index]!);
    offset += record.length;
    return record;
  });
  const directorySize = offset - directoryOffset;
  const comment = Buffer.from(options.comment ?? "", "utf8");
  const zip64 = options.zip64End
    ? Buffer.concat([
        pack([4, 0x06064b50], [8, 44], [2, 45], [2, 45], [4, 0], [4, 0]),
        pack([8, fixtures.length], [8, fixtures.length], [8, directorySize], [8, directoryOffset]),
        pack([4, 0x07064b50], [4, 0], [8, offset], [4, 1]),
      ])
    : Buffer.alloc(0);
  const end = options.zip64End
    ? pack([4, 0x06054b50], [2, 0], [2, 0], [2, 0xffff], [2, 0xffff], [4, U32_MAX], [4, U32_MAX], [2, comment.length])
    : pack(
        [4, 0x06054b50],
        [2, 0],
        [2, 0],
        [2, fixtures.length],
        [2, fixtures.length],
        [4, directorySize],
        [4, directoryOffset],
        [2, comment.length],
      );
  const bytes = Buffer.concat([...records, ...central, zip64, end, comment]);
  return { bytes, localOffsets, centralOffsets, directoryOffset, endOffset: offset + zip64.length };
}

function edited(bytes: Buffer, edit: (copy: Buffer) => void): Buffer {
  const copy = Buffer.from(bytes);
  edit(copy);
  return copy;
}

// ── How the strict reader and the reader the Engine used before see an archive. ──

function readStrict(bytes: Buffer) {
  return openZipArchive(bytes)
    .getEntries()
    .map((entry) => [entry.entryName, entry.read(Number.MAX_SAFE_INTEGER).toString("base64")]);
}

function readBefore(bytes: Buffer) {
  return new AdmZip(bytes)
    .getEntries()
    .map((entry) => [entry.entryName, entry.isDirectory ? "" : entry.getData().toString("base64")]);
}

const corpus: string[] = [];
function assertReadsAsBefore(bytes: Buffer, label: string) {
  const before = readBefore(bytes);
  assert.ok(before.length > 0, `${label}: the fixture has entries`);
  assert.deepEqual(readStrict(bytes), before, `${label}: reads byte-identically to the previous reader`);
  corpus.push(`${label} (${before.length})`);
}

function assertRefused(bytes: Buffer, message: RegExp, label: string, budget?: ZipEntryBudget) {
  assert.throws(
    () => openZipArchive(bytes, budget),
    (error: unknown) => error instanceof ZipArchiveError && message.test(error.message),
    label,
  );
}

function assertReadRefused(bytes: Buffer, name: string, maxBytes: number, message: RegExp, label: string) {
  const entry = openZipArchive(bytes).getEntry(name);
  assert.ok(entry, `${label}: the entry is listed`);
  assert.throws(
    () => entry.read(maxBytes),
    (error: unknown) => error instanceof ZipArchiveError && message.test(error.message),
    label,
  );
}

const text = Buffer.from("Marinara reads this archive.\n".repeat(64));
const binary = Buffer.from(Array.from({ length: 70_000 }, (_, index) => (index * 7919) % 251));
const honest: Fixture[] = [
  { name: "folder/", data: Buffer.alloc(0), method: 0 },
  { name: "folder/deflated.txt", data: text },
  { name: "folder/stored.bin", data: binary, method: 0 },
  { name: "empty-stored.txt", data: Buffer.alloc(0), method: 0 },
  { name: "empty-deflated.txt", data: Buffer.alloc(0) },
  { name: "ünïcødé/名前.json", data: Buffer.from('{"ok":true}') },
];

// ── Honest archives are accepted and read exactly as before. ──

assertReadsAsBefore(buildZip(honest).bytes, "classic archive");
assertReadsAsBefore(buildZip(honest, { comment: "archive comment" }).bytes, "archive comment");
for (const descriptor of ["signed", "unsigned", "zip64"] as const) {
  assertReadsAsBefore(
    buildZip(honest.map((fixture) => ({ ...fixture, descriptor }))).bytes,
    `${descriptor} data descriptors`,
  );
}
assertReadsAsBefore(
  buildZip(
    honest.map((fixture) => ({ ...fixture, zip64: true })),
    { zip64End: true },
  ).bytes,
  "ZIP64 records and extra fields",
);
assertReadsAsBefore(
  buildZip(
    honest.map((fixture) => ({ ...fixture, zip64: true, descriptor: "zip64" })),
    { zip64End: true },
  ).bytes,
  "ZIP64 with data descriptors",
);
const sharedFlag = buildZip([
  { name: "flagged.txt", data: text },
  { name: "next.txt", data: binary },
]);
assertReadsAsBefore(
  edited(sharedFlag.bytes, (copy) => {
    copy.writeUInt16LE(copy.readUInt16LE(sharedFlag.localOffsets[0]! + 6) | 0x0008, sharedFlag.localOffsets[0]! + 6);
  }),
  "descriptor flag without a descriptor",
);
const sequential = new AdmZip();
for (const fixture of honest) if (!fixture.name.endsWith("/")) sequential.addFile(fixture.name, fixture.data);
assertReadsAsBefore(sequential.toBuffer(), "Marinara in-memory exports");
const streamed: Buffer[] = [];
for await (const chunk of streamZip(
  (async function* () {
    for (const fixture of honest) {
      if (fixture.name.endsWith("/")) continue;
      yield {
        name: fixture.name,
        content: (async function* () {
          yield fixture.data;
        })(),
      };
    }
  })(),
)) {
  streamed.push(chunk);
}
assertReadsAsBefore(Buffer.concat(streamed), "Marinara streamed exports");
/** The archive followed by zero bytes up to a whole number of blocks, as libarchive writes to a pipe. */
function blockPadded(bytes: Buffer, block = 10_240) {
  return Buffer.concat([bytes, Buffer.alloc(block - (bytes.length % block))]);
}
assertReadsAsBefore(blockPadded(buildZip(honest).bytes), "zero padding after the end record");
assertReadsAsBefore(blockPadded(buildZip(honest, { comment: "archive comment" }).bytes, 512), "comment, then padding");
assertReadsAsBefore(Buffer.concat([buildZip(honest).bytes, Buffer.from("\r\n")]), "a line break after the archive");

// Names without the UTF-8 flag read as UTF-8 when valid, else as the CP932 that Japanese Windows tools write. The
// 0x5C trail bytes of 表 and ソ are not path separators, and two such names no longer collapse into one.
assert.deepEqual(
  openZipArchive(
    buildZip([
      { name: "表情/ソ.png", rawName: Buffer.from("955c8fee2f835c2e706e67", "hex"), data: icon },
      { name: "髪.png", rawName: Buffer.from("94af2e706e67", "hex"), data: icon },
      { name: "肌.png", rawName: Buffer.from("94a72e706e67", "hex"), data: icon },
      { name: "utf8/肌.png", rawName: Buffer.from("utf8/肌.png"), data: icon },
    ]).bytes,
  )
    .getEntries()
    .map((entry) => [entry.entryName, entry.isDirectory]),
  [
    ["表情/ソ.png", false],
    ["髪.png", false],
    ["肌.png", false],
    ["utf8/肌.png", false],
  ],
);

// ── Archives from the tools available here. ──

const { PACKAGE_ARCHIVE_BUDGET, validatePackageArchiveEntries } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { parseCustomAgentRepositoryContents } =
  await import("../../packages/server/src/services/agents/custom-agent-repositories.service.js");

const scratch = mkdtempSync(join(tmpdir(), "marinara-zip-reader-"));
try {
  const isolatedGit = { ...process.env, GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: "1" };
  const repositoryDirectory = join(scratch, "repository");
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", repositoryDirectory, ...args], { env: isolatedGit, maxBuffer: 64 * 1024 * 1024 });
  mkdirSync(join(repositoryDirectory, "rulesets"), { recursive: true });
  const agentDefinition = {
    id: "archive-reader-check",
    name: "Archive Reader Check",
    description: "Reads a repository archive.",
    category: "writer",
    phase: "post_processing",
    enabledByDefault: false,
    defaultPromptTemplate: "Check the archive.",
  };
  writeFileSync(join(repositoryDirectory, "agents.json"), JSON.stringify([agentDefinition], null, 2));
  writeFileSync(join(repositoryDirectory, "rulesets", "sample.json"), JSON.stringify({ id: "sample" }));
  writeFileSync(join(repositoryDirectory, "large.bin"), binary);
  writeFileSync(join(repositoryDirectory, "README.md"), text);
  execFileSync("git", ["init", "-q", repositoryDirectory], { env: isolatedGit });
  git("add", ".");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-q", "-m", "fixture");
  const githubArchive = git(
    "-c",
    "core.bigFileThreshold=1k",
    "archive",
    "--format=zip",
    "--prefix=example-main/",
    "HEAD",
  );
  assertReadsAsBefore(githubArchive, "git archive with streamed files");
  assertReadsAsBefore(git("archive", "--format=zip", "-0", "--prefix=example-main/", "HEAD"), "git archive, stored");

  const python = ["python3", "python"].find((command) => spawnSync(command, ["--version"]).status === 0);
  if (python) {
    const script = String.raw`
import base64, io, json, sys, zipfile
class Unseekable(io.RawIOBase):
    def __init__(self):
        self.chunks = []
    def writable(self):
        return True
    def write(self, data):
        self.chunks.append(bytes(data))
        return len(data)
    def value(self):
        return b"".join(self.chunks)
text = b"Marinara reads this archive.\n" * 64
binary = bytes((index * 7919) % 251 for index in range(70000))
def fill(archive, force_zip64=False):
    archive.writestr(zipfile.ZipInfo("folder/"), b"")
    for name, data, method in [("folder/deflated.txt", text, zipfile.ZIP_DEFLATED), ("folder/stored.bin", binary, zipfile.ZIP_STORED), ("empty.txt", b"", zipfile.ZIP_DEFLATED), ("ünicode/名前.json", b"{}", zipfile.ZIP_DEFLATED)]:
        info = zipfile.ZipInfo(name)
        info.compress_type = method
        with archive.open(info, "w", force_zip64=force_zip64) as handle:
            handle.write(data)
out = {}
for label, target, force in [("seekable", io.BytesIO, False), ("seekable-zip64", io.BytesIO, True), ("streamed", Unseekable, False), ("streamed-zip64", Unseekable, True)]:
    sink = target()
    with zipfile.ZipFile(sink, "w") as archive:
        fill(archive, force)
    out[label] = base64.b64encode(sink.getvalue() if hasattr(sink, "getvalue") else sink.value()).decode()
many = io.BytesIO()
with zipfile.ZipFile(many, "w", zipfile.ZIP_STORED) as archive:
    for index in range(65536):
        archive.writestr("entries/%05d.txt" % index, b"x")
out["zip64-entry-count"] = base64.b64encode(many.getvalue()).decode()
sys.stdout.write(json.dumps(out))
`;
    const archives = JSON.parse(
      execFileSync(python, ["-I", "-c", script], { maxBuffer: 64 * 1024 * 1024 }).toString("utf8"),
    ) as Record<string, string>;
    for (const [label, encoded] of Object.entries(archives)) {
      assertReadsAsBefore(Buffer.from(encoded, "base64"), `Python zipfile ${label}`);
    }
    const counted = Buffer.from(archives["zip64-entry-count"]!, "base64");
    assert.equal(counted.readUInt16LE(counted.length - 12), 0xffff, "the entry count lives in the ZIP64 record");
  } else {
    assert.ok(!process.env.CI, "CI provides Python for the compatibility corpus");
    console.info("Python is not installed; its archives were skipped.");
  }

  if (spawnSync("zip", ["-v"]).status === 0) {
    const tree = join(scratch, "tree");
    mkdirSync(join(tree, "folder"), { recursive: true });
    writeFileSync(join(tree, "folder", "deflated.txt"), text);
    writeFileSync(join(tree, "folder", "binary.bin"), binary);
    writeFileSync(join(tree, "empty.txt"), "");
    const infoZip = (name: string, ...flags: string[]) => {
      execFileSync("zip", ["-q", "-r", "-X", ...flags, join(scratch, name), "."], { cwd: tree });
      return readFileSync(join(scratch, name));
    };
    assertReadsAsBefore(infoZip("plain.zip"), "Info-ZIP");
    assertReadsAsBefore(infoZip("zip64.zip", "-fz"), "Info-ZIP forced ZIP64");
    assertReadsAsBefore(execFileSync("zip", ["-q", "-", "-"], { input: text }), "Info-ZIP streamed from a pipe");
  } else {
    console.info("Info-ZIP is not installed; its archives were skipped.");
  }

  // libarchive is the tar on macOS and Windows; written to a pipe, its ZIP is padded to whole blocks.
  const libarchiveTar = ["bsdtar", "tar"].find((command) =>
    /libarchive/u.test(spawnSync(command, ["--version"]).stdout?.toString() ?? ""),
  );
  if (libarchiveTar) {
    const repositoryFiles = ["agents.json", "rulesets", "large.bin", "README.md"].map((file) => `repository/${file}`);
    const libarchive = (...flags: string[]) =>
      execFileSync(libarchiveTar, ["--format", "zip", ...flags, "-cf", "-", ...repositoryFiles], {
        cwd: scratch,
        maxBuffer: 64 * 1024 * 1024,
      });
    for (const [label, flags] of [
      ["libarchive written to a pipe", []],
      ["libarchive written to a pipe, stored", ["--options", "zip:compression=store"]],
      ["libarchive written to a pipe, ZIP64", ["--options", "zip:zip64"]],
    ] as const) {
      const piped = libarchive(...flags);
      assertReadsAsBefore(piped, label);
      assert.deepEqual(
        parseCustomAgentRepositoryContents(piped).definitions.map((definition) => definition.id),
        [agentDefinition.id],
        `${label}: a repository archive is imported`,
      );
    }
  } else {
    console.info("libarchive's tar is not installed; its archives were skipped.");
  }

  let jszipPath: string | null = null;
  try {
    jszipPath = createRequire(join(repositoryRoot, "package.json")).resolve("jszip");
  } catch {
    console.info("JSZip is not installed; its archives were skipped.");
  }
  if (jszipPath) {
    const JSZip = createRequire(join(repositoryRoot, "package.json"))(jszipPath) as new () => {
      file(name: string, data: Buffer): void;
      folder(name: string): unknown;
      generateAsync(options: Record<string, unknown>): Promise<Buffer>;
    };
    for (const streamFiles of [false, true]) {
      const archive = new JSZip();
      archive.folder("folder");
      archive.file("folder/deflated.txt", text);
      archive.file("folder/binary.bin", binary);
      archive.file("empty.txt", Buffer.alloc(0));
      assertReadsAsBefore(
        await archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE", streamFiles }),
        `JSZip${streamFiles ? " streamed" : ""}`,
      );
    }
  }

  // ── Self-contradictory or unsupported archives are refused. ──

  const base = buildZip([
    { name: "first.txt", data: text },
    { name: "second.bin", data: binary, method: 0 },
  ]);
  assertRefused(Buffer.from("not an archive"), /not a readable ZIP archive/, "a file without an end record");
  assertRefused(
    Buffer.concat([base.bytes, Buffer.from("trailing")]),
    /not a readable ZIP archive/,
    "bytes after the end record",
  );
  const innerEnd = pack([4, 0x06054b50], [2, 0], [2, 0], [2, 0], [2, 0], [4, 0], [4, 0], [2, 0]);
  assertRefused(
    edited(Buffer.concat([base.bytes, innerEnd]), (copy) => copy.writeUInt16LE(innerEnd.length, base.endOffset + 20)),
    /more than one end record/,
    "two end records that both close the file",
  );
  assertRefused(
    blockPadded(
      edited(Buffer.concat([base.bytes, innerEnd]), (copy) => copy.writeUInt16LE(innerEnd.length, base.endOffset + 20)),
    ),
    /more than one end record/,
    "two end records that are both followed only by padding",
  );
  const innerToEnd = edited(innerEnd, (copy) => copy.writeUInt16LE(256, 20));
  assertRefused(
    Buffer.concat([
      edited(Buffer.concat([base.bytes, innerToEnd]), (copy) =>
        copy.writeUInt16LE(innerToEnd.length, base.endOffset + 20),
      ),
      Buffer.alloc(256),
    ]),
    /more than one end record/,
    "an end record that closes the file and another followed only by padding",
  );
  assertRefused(
    Buffer.concat([base.bytes, Buffer.from("trailing"), Buffer.alloc(64)]),
    /not a readable ZIP archive/,
    "other bytes between the end record and the padding",
  );
  assertRefused(
    edited(base.bytes, (copy) => copy.writeUInt16LE(1, base.endOffset + 4)),
    /Split or multi-part/,
    "an end record on another disk",
  );
  assertRefused(
    edited(base.bytes, (copy) => copy.writeUInt16LE(1, base.centralOffsets[1]! + 34)),
    /Split or multi-part/,
    "an entry that starts on another disk",
  );
  assertRefused(
    edited(base.bytes, (copy) => copy.writeUInt32LE(copy.readUInt32LE(base.endOffset + 12) + 1, base.endOffset + 12)),
    /file list is damaged/,
    "a central directory that does not fit before the end record",
  );
  const padded = buildZip([{ name: "first.txt", data: text }]);
  assertRefused(
    Buffer.concat([
      padded.bytes.subarray(0, padded.endOffset),
      Buffer.alloc(4),
      edited(padded.bytes.subarray(padded.endOffset), (copy) => copy.writeUInt32LE(copy.readUInt32LE(12) + 4, 12)),
    ]),
    /file list is damaged/,
    "a central directory that does not fill its stated size",
  );
  assertRefused(
    edited(base.bytes, (copy) =>
      copy.writeUInt32LE(copy.readUInt32LE(base.centralOffsets[1]! + 42) + 1, base.centralOffsets[1]! + 42),
    ),
    /does not match its contents at "second.bin"/,
    "a local header that is not where the central directory says",
  );
  assertRefused(
    edited(base.bytes, (copy) => (copy[base.localOffsets[0]! + 30] = "F".charCodeAt(0))),
    /does not match its contents at "first.txt"/,
    "a local header with a different name",
  );
  assertRefused(
    edited(base.bytes, (copy) => copy.writeUInt16LE(0, base.localOffsets[0]! + 8)),
    /does not match its contents at "first.txt"/,
    "a local header with a different compression method",
  );
  const inner = { name: "inner.txt", data: text, method: 0 as const };
  assertRefused(
    buildZip([
      { name: "outer.bin", data: localRecord(inner), method: 0 },
      { ...inner, localAt: 30 + "outer.bin".length },
    ]).bytes,
    /overlap/,
    "entries whose data regions overlap",
  );
  assertRefused(
    edited(base.bytes, (copy) => copy.writeUInt32LE(binary.length - 1, base.centralOffsets[1]! + 24)),
    /two different sizes for "second.bin"/,
    "a stored entry whose two sizes disagree",
  );
  const described = buildZip([{ name: "first.txt", data: text, descriptor: "signed" }]);
  assertRefused(
    edited(described.bytes, (copy) => copy.writeUInt32LE(0, described.directoryOffset - 4)),
    /does not match its contents at "first.txt"/,
    "a data descriptor that disagrees with the central directory",
  );
  const sixtyFour = buildZip([{ name: "first.txt", data: text, zip64: true }], { zip64End: true });
  assertRefused(
    edited(sixtyFour.bytes, (copy) => copy.writeUInt16LE(2, sixtyFour.endOffset + 10)),
    /end record is damaged/,
    "classic and ZIP64 end records that disagree",
  );
  assertRefused(
    buildZip([
      { name: "same.txt", data: text },
      { name: "same.txt", data: binary },
    ]).bytes,
    /lists "same.txt" more than once/,
    "a file listed twice",
  );
  const encryptedFlag = (copy: Buffer) => {
    for (const offset of [base.localOffsets[0]! + 6, base.centralOffsets[0]! + 8]) {
      copy.writeUInt16LE(copy.readUInt16LE(offset) | 0x0001, offset);
    }
  };
  assertReadRefused(
    edited(base.bytes, encryptedFlag),
    "first.txt",
    Number.MAX_SAFE_INTEGER,
    /encrypted/,
    "an encrypted entry",
  );
  assertReadRefused(
    edited(base.bytes, (copy) => {
      copy.writeUInt16LE(12, base.localOffsets[0]! + 8);
      copy.writeUInt16LE(12, base.centralOffsets[0]! + 10);
    }),
    "first.txt",
    Number.MAX_SAFE_INTEGER,
    /compression method that is not supported/,
    "an unsupported compression method",
  );
  assert.deepEqual(
    openZipArchive(edited(base.bytes, encryptedFlag)).getEntry("second.bin")!.read(binary.length),
    binary,
    "an unsupported entry blocks only its own read",
  );

  // ── Every read names a limit; an entry over it is refused before it is read. ──

  const firstEntry = openZipArchive(base.bytes).getEntry("first.txt")!;
  assert.equal(firstEntry.size, text.length);
  assert.deepEqual(firstEntry.read(text.length), text, "a read at exactly the declared size succeeds");
  assert.throws(() => firstEntry.read(text.length - 1), /"first.txt" is too large/);
  assert.throws(() => firstEntry.read(Number.NaN), RangeError, "a read without a usable limit is a programming error");
  const unreadable = buildZip([{ name: "declared.bin", data: Buffer.from([0xff, 0xff, 0xff, 0xff]), method: 0 }]);
  const overDeclared = edited(unreadable.bytes, (copy) => {
    copy.writeUInt16LE(8, unreadable.localOffsets[0]! + 8);
    copy.writeUInt16LE(8, unreadable.centralOffsets[0]! + 10);
    copy.writeUInt32LE(1_000_000, unreadable.centralOffsets[0]! + 24);
  });
  assertReadRefused(overDeclared, "declared.bin", 999_999, /is too large/, "a declared size over the limit, unread");
  assertReadRefused(overDeclared, "declared.bin", 1_000_000, /is damaged/, "the same entry within the limit is read");

  // ── Results must match the declared length and CRC-32. ──

  const withCrc = (bytes: Buffer, layout: typeof base, index: number, crc: number) =>
    edited(bytes, (copy) => {
      copy.writeUInt32LE(crc, layout.localOffsets[index]! + 14);
      copy.writeUInt32LE(crc, layout.centralOffsets[index]! + 16);
    });
  assertReadRefused(
    withCrc(base.bytes, base, 0, (crc32(text) ^ 1) >>> 0),
    "first.txt",
    text.length,
    /is damaged/,
    "a deflated CRC-32 mismatch",
  );
  assertReadRefused(
    withCrc(base.bytes, base, 1, (crc32(binary) ^ 1) >>> 0),
    "second.bin",
    binary.length,
    /is damaged/,
    "a stored CRC-32 mismatch",
  );
  const resized = (size: number) =>
    edited(base.bytes, (copy) => copy.writeUInt32LE(size, base.centralOffsets[0]! + 24));
  assertReadRefused(
    resized(text.length - 1),
    "first.txt",
    text.length,
    /is damaged/,
    "inflation stops at a smaller declared size",
  );
  assertReadRefused(
    resized(text.length + 1),
    "first.txt",
    text.length + 1,
    /is damaged/,
    "a shorter result than declared",
  );

  // ── A caller's entry limit is checked before the file list is read. ──

  const crowded = buildZip(Array.from({ length: 9 }, (_, index) => ({ name: `entry-${index}.txt`, data: text })));
  const crowdedDamaged = edited(crowded.bytes, (copy) => copy.writeUInt32LE(0, crowded.centralOffsets[0]!));
  const budget = { maxEntries: 8, tooManyEntries: "This caller allows eight files" };
  assertRefused(crowdedDamaged, /file list is damaged/, "a damaged file list is refused");
  assertRefused(crowded.bytes, /^This caller allows eight files$/, "an archive over the entry limit", budget);
  assertRefused(
    crowdedDamaged,
    /^This caller allows eight files$/,
    "the entry limit comes before the file list",
    budget,
  );
  assert.equal(
    openZipArchive(crowded.bytes, { ...budget, maxEntries: 9 }).getEntries().length,
    9,
    "an archive within the entry limit opens",
  );

  // ── Opening an archive indexes its file list; entries are built when a caller asks for them. ──

  setFlagsFromString("--expose-gc");
  const collectGarbage = runInNewContext("gc") as () => void;
  const longList = buildZip(
    Array.from({ length: 0xffff }, (_, index) => ({
      name: `e/${index.toString(36).padStart(4, "0")}`,
      data: Buffer.alloc(0),
      method: 0 as const,
    })),
  ).bytes;
  collectGarbage();
  const heapBefore = process.memoryUsage().heapUsed;
  const indexed = openZipArchive(longList);
  collectGarbage();
  const heapHeld = process.memoryUsage().heapUsed - heapBefore;
  assert.ok(
    heapHeld < longList.length,
    `the index of a long file list takes less memory than the archive (${heapHeld} of ${longList.length} bytes)`,
  );
  assert.equal(indexed.getEntry("e/0000")?.entryName, "e/0000");
  assert.equal(indexed.getEntries().length, 0xffff);

  // ── Entry points: Agent packages and custom Agent repositories. ──

  const packageArchive = buildZip([
    { name: "manifest.json", data: Buffer.from("{}") },
    { name: "assets/", data: Buffer.alloc(0), method: 0 },
    { name: "assets/icon.png", data: icon, descriptor: "signed" },
  ]).bytes;
  assert.deepEqual(
    validatePackageArchiveEntries(openZipArchive(packageArchive)).map((entry) => [entry.entryName, entry.size]),
    [
      ["manifest.json", 2],
      ["assets/icon.png", icon.length],
    ],
  );
  const overlapping = buildZip([
    { name: "example-main/outer.bin", data: localRecord({ ...inner, name: "example-main/agents.json" }), method: 0 },
    { ...inner, name: "example-main/agents.json", localAt: 30 + "example-main/outer.bin".length },
  ]).bytes;
  const repository = parseCustomAgentRepositoryContents(githubArchive);
  assert.deepEqual(
    repository.definitions.map((definition) => definition.id),
    [agentDefinition.id],
  );
  assert.deepEqual(repository.rulesets, [{ file: "sample.json", text: JSON.stringify({ id: "sample" }) }]);
  assert.throws(() => parseCustomAgentRepositoryContents(overlapping), ZipArchiveError);
  assert.deepEqual(
    parseCustomAgentRepositoryContents(blockPadded(githubArchive)),
    repository,
    "a padded repository archive is imported",
  );
  assert.deepEqual(
    validatePackageArchiveEntries(openZipArchive(blockPadded(packageArchive), PACKAGE_ARCHIVE_BUDGET)).map(
      (entry) => entry.entryName,
    ),
    ["manifest.json", "assets/icon.png"],
    "a padded package archive is read",
  );
  const overLimit = buildZip(
    Array.from({ length: PACKAGE_ARCHIVE_BUDGET.maxEntries + 1 }, (_, index) => ({
      name: `example-main/${index}.txt`,
      data: Buffer.alloc(0),
      method: 0 as const,
    })),
  );
  assert.throws(
    () =>
      parseCustomAgentRepositoryContents(
        edited(overLimit.bytes, (copy) => copy.writeUInt32LE(0, overLimit.centralOffsets[0]!)),
      ),
    /Package contains too many files/u,
    "a repository archive over the entry limit is refused before its file list is read",
  );

  const sources = Object.fromEntries(
    [
      "packages/server/src/services/capability-packages/package-manager.service.ts",
      "packages/server/src/services/agents/custom-agent-repositories.service.ts",
      "packages/server/src/services/import/st-character.importer.ts",
      "packages/server/src/routes/import.routes.ts",
    ].map((path) => [path.split("/").at(-1)!, readFileSync(join(repositoryRoot, path), "utf8")]),
  );
  for (const [file, source] of Object.entries(sources)) {
    assert.doesNotMatch(
      source,
      /adm-zip|AdmZip|getData\(/u,
      `${file} reads outside archives only through the strict reader`,
    );
    assert.match(source, /openZipArchive\(/u, `${file} opens outside archives with the strict reader`);
  }
  const install = sources["package-manager.service.ts"]!.match(
    /async function installCatalogPackage[\s\S]*?\n\}\n/u,
  )?.[0];
  assert.ok(install, "the package install path stays discoverable");
  assert.match(
    install,
    /openZipArchive\(archive, PACKAGE_ARCHIVE_BUDGET\)[\s\S]*?validatePackageArchiveEntries\(zip\)/u,
  );
  assert.match(
    sources["custom-agent-repositories.service.ts"]!,
    /openZipArchive\(archive, PACKAGE_ARCHIVE_BUDGET\)[\s\S]*?validatePackageArchiveEntries\(zip, MAX_EXPANDED_BYTES\)/u,
    "a repository archive is opened with the package entry limit",
  );
  assert.match(install, /manifestEntry\.size > MAX_MANIFEST_BYTES[\s\S]*?manifestEntry\.read\(MAX_MANIFEST_BYTES\)/u);
  assert.match(install, /item\.size !== declaration\.bytes[\s\S]*?item\.read\(declaration\.bytes\)/u);

  // ── Entry points: .charx cards, read up to the import upload limit. ──

  const { IMPORT_BODY_LIMIT_BYTES } =
    await import("../../packages/server/src/services/import/st-character.importer.js");
  assert.equal(IMPORT_BODY_LIMIT_BYTES, 256 * 1024 * 1024, "the import upload limit is unchanged");
  const importer = sources["st-character.importer.ts"]!;
  assert.equal(
    importer.match(/\.read\(/gu)?.length,
    importer.match(/\.read\(IMPORT_BODY_LIMIT_BYTES\)/gu)?.length,
    "every .charx read uses the upload limit",
  );
  assert.match(
    sources["import.routes.ts"]!,
    /IMPORT_BODY_LIMIT_BYTES,[\s\S]*?\} from "\.\.\/services\/import\/st-character\.importer\.js"/u,
    "the routes take their upload limit from the same constant",
  );
  assert.doesNotMatch(sources["import.routes.ts"]!, /const IMPORT_BODY_LIMIT_BYTES\b/u);

  const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
  const { default: multipart } = await import("../../packages/server/node_modules/@fastify/multipart/index.js");
  const { closeDB, getDB } = await import("../../packages/server/src/db/connection.js");
  const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
  const { charactersRoutes } = await import("../../packages/server/src/routes/characters.routes.js");
  const { importRoutes } = await import("../../packages/server/src/routes/import.routes.js");
  const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
  const db = await getDB();
  const app = Fastify();
  app.decorate("db", db);
  app.setErrorHandler(errorHandler);
  await app.register(multipart);
  await app.register(charactersRoutes, { prefix: "/api/characters" });
  await app.register(importRoutes, { prefix: "/api/import" });
  const upload = (url: string, field: string, filename: string, bytes: Buffer) => {
    const boundary = "marinara-zip-reader";
    return app.inject({
      method: "POST",
      url,
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\n` +
            "Content-Type: application/octet-stream\r\n\r\n",
        ),
        bytes,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    });
  };
  const characters = createCharactersStorage(db);
  const avatarBytes = async (id: string) => {
    const avatarPath = (await characters.getById(id))?.avatarPath;
    assert.ok(avatarPath, "the imported character has an avatar");
    return readFileSync(join(dataDir, "avatars", avatarPath.split("/").at(-1)!));
  };
  try {
    const card = {
      spec: "chara_card_v3",
      spec_version: "3.0",
      data: {
        name: "Archive Card",
        description: "Read from a .charx.",
        assets: [{ type: "icon", name: "main", uri: "embeded://assets/icon/images/main.png", ext: "png" }],
      },
    };
    const charx = buildZip([
      { name: "card.json", data: Buffer.from(JSON.stringify(card)) },
      { name: "assets/icon/images/main.png", data: icon, method: 0 },
    ]);
    const imported = await upload("/api/import/st-character", "file", "Archive Card.charx", charx.bytes);
    assert.equal(imported.statusCode, 200, imported.body);
    assert.equal(imported.json().success, true, imported.body);
    assert.deepEqual(await avatarBytes(imported.json().characterId), icon, "the .charx icon is imported");
    const inspect = async (bytes: Buffer) => {
      const response = await upload("/api/import/st-character/inspect", "files", "card.charx", bytes);
      assert.equal(response.statusCode, 200, response.body);
      return response.json().results[0] as { success: boolean; name?: string; error?: string };
    };
    const preview = await inspect(charx.bytes);
    assert.deepEqual([preview.success, preview.name], [true, "Archive Card"], "a .charx is inspected");
    const paddedPreview = await inspect(blockPadded(charx.bytes));
    assert.deepEqual(
      [paddedPreview.success, paddedPreview.name],
      [true, "Archive Card"],
      "a padded .charx is inspected",
    );
    const declaredCard = (size: number) =>
      edited(charx.bytes, (copy) => copy.writeUInt32LE(size, charx.centralOffsets[0]! + 24));
    assert.match(
      (await inspect(declaredCard(IMPORT_BODY_LIMIT_BYTES + 1))).error ?? "",
      /"card.json" is too large/,
      "a card declared over the upload limit is refused unread",
    );
    assert.match(
      (await inspect(declaredCard(IMPORT_BODY_LIMIT_BYTES))).error ?? "",
      /"card.json" is damaged/,
      "a card declared at the upload limit is within the limit",
    );
    assert.match(
      (await inspect(edited(charx.bytes, (copy) => copy.writeUInt16LE(0, charx.localOffsets[0]! + 8)))).error ?? "",
      /does not match its contents/,
      "a self-contradictory .charx is refused",
    );

    // ── Entry points: .marinara packages, from Marinara's own export. ──

    const exported = await app.inject({ method: "GET", url: `/api/characters/${imported.json().characterId}/export` });
    assert.equal(exported.statusCode, 200, exported.body);
    const envelope = JSON.parse(exported.body) as { data: Record<string, unknown> };
    delete envelope.data.avatar;
    const packageChunks: Buffer[] = [];
    for await (const chunk of streamZip(
      (async function* () {
        for (const [name, data] of [
          ["data.json", Buffer.from(JSON.stringify(envelope))],
          ["avatar.png", icon],
        ] as const) {
          yield {
            name,
            content: (async function* () {
              yield data;
            })(),
          };
        }
      })(),
    )) {
      packageChunks.push(chunk);
    }
    const marinaraPackage = Buffer.concat(packageChunks);
    assertReadsAsBefore(marinaraPackage, "Marinara .marinara package");
    const packaged = await upload("/api/import/marinara-package", "file", "Archive Card.marinara", marinaraPackage);
    assert.equal(packaged.statusCode, 200, packaged.body);
    assert.equal(packaged.json().success, true, packaged.body);
    assert.deepEqual(await avatarBytes(packaged.json().id), icon, "the package avatar is imported");

    const nativeLayout = buildZip([
      { name: "data.json", data: Buffer.from(JSON.stringify(envelope)) },
      { name: "avatar.png", data: icon, method: 0 },
    ]);
    const packageResponse = async (bytes: Buffer) => {
      const response = await upload("/api/import/marinara-package", "file", "package.marinara", bytes);
      return [response.statusCode, response.json().error] as const;
    };
    assert.deepEqual(
      await packageResponse(
        buildZip([
          { name: "outer.bin", data: localRecord({ ...inner, name: "data.json" }), method: 0 },
          { ...inner, name: "data.json", localAt: 30 + "outer.bin".length },
        ]).bytes,
      ),
      [400, "Could not read .marinara package"],
    );
    assert.deepEqual(
      await packageResponse(withCrc(nativeLayout.bytes, nativeLayout, 0, 0)),
      [400, "data.json is not valid JSON"],
      "a damaged data.json keeps its existing message",
    );
    assert.deepEqual(
      await packageResponse(
        edited(nativeLayout.bytes, (copy) =>
          copy.writeUInt32LE(256 * 1024 * 1024 + 1, nativeLayout.centralOffsets[0]! + 24),
        ),
      ),
      [413, ".marinara package entry is too large"],
      "the existing per-entry limit still applies",
    );
    assert.deepEqual(
      await packageResponse(crowded.bytes),
      [400, ".marinara package has too many entries"],
      "the existing entry limit keeps its message",
    );
    assert.deepEqual(
      await packageResponse(crowdedDamaged),
      [400, ".marinara package has too many entries"],
      "the entry limit is checked before the file list is read",
    );
    const paddedPackage = await upload(
      "/api/import/marinara-package",
      "file",
      "Archive Card.marinara",
      blockPadded(marinaraPackage),
    );
    assert.equal(paddedPackage.statusCode, 200, paddedPackage.body);
    assert.equal(paddedPackage.json().success, true, "a padded .marinara package is imported");
  } finally {
    await app.close();
    await closeDB();
  }
  console.info(`Strict archive reader regressions passed. Compatibility corpus: ${corpus.join(", ")}.`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
