import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import {
  MAX_NOVELAI_ZIP_OUTPUT_BYTES,
  extractFirstFileFromZip,
} from "../../packages/server/src/services/image/image-generation.js";

type ZipFixtureOptions = {
  method?: 0 | 8;
  declaredCompressedSize?: number;
  declaredUncompressedSize?: number;
  compressedData?: Buffer;
};

function createSingleFileZip(data: Buffer, options: ZipFixtureOptions = {}): Buffer {
  const method = options.method ?? 8;
  const filename = Buffer.from("image.png", "utf8");
  const compressed = options.compressedData ?? (method === 8 ? deflateRawSync(data) : data);
  const compressedSize = options.declaredCompressedSize ?? compressed.length;
  const uncompressedSize = options.declaredUncompressedSize ?? data.length;

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(method, 8);
  localHeader.writeUInt32LE(compressedSize >>> 0, 18);
  localHeader.writeUInt32LE(uncompressedSize >>> 0, 22);
  localHeader.writeUInt16LE(filename.length, 26);

  const centralDirectoryOffset = localHeader.length + filename.length + compressed.length;
  const centralDirectory = Buffer.alloc(46);
  centralDirectory.writeUInt32LE(0x02014b50, 0);
  centralDirectory.writeUInt16LE(20, 4);
  centralDirectory.writeUInt16LE(20, 6);
  centralDirectory.writeUInt16LE(method, 10);
  centralDirectory.writeUInt32LE(compressedSize >>> 0, 20);
  centralDirectory.writeUInt32LE(uncompressedSize >>> 0, 24);
  centralDirectory.writeUInt16LE(filename.length, 28);
  centralDirectory.writeUInt32LE(0, 42);

  const centralDirectorySize = centralDirectory.length + filename.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralDirectorySize, 12);
  end.writeUInt32LE(centralDirectoryOffset, 16);

  return Buffer.concat([
    localHeader,
    filename,
    compressed,
    centralDirectory,
    filename,
    end,
  ]);
}

const image = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ...Buffer.from("NovelAI ZIP regression", "utf8"),
]);

assert.deepEqual(
  Buffer.from(extractFirstFileFromZip(createSingleFileZip(image), 1024) ?? []),
  image,
  "normal DEFLATE responses must still decode",
);
assert.deepEqual(
  Buffer.from(extractFirstFileFromZip(createSingleFileZip(image, { method: 0 }), 1024) ?? []),
  image,
  "normal stored responses must still decode",
);

assert.equal(
  extractFirstFileFromZip(
    createSingleFileZip(Buffer.from("x"), {
      compressedData: Buffer.from([0xff]),
      declaredUncompressedSize: 65,
    }),
    64,
  ),
  null,
  "declared output above the provider cap must be rejected",
);
assert.equal(
  extractFirstFileFromZip(
    createSingleFileZip(Buffer.alloc(128, 0x41), {
      declaredUncompressedSize: 32,
    }),
    64,
  ),
  null,
  "compressed data that expands past its declared/capped length must be rejected",
);
assert.equal(
  extractFirstFileFromZip(
    createSingleFileZip(Buffer.alloc(16, 0x42), {
      declaredUncompressedSize: 32,
    }),
    64,
  ),
  null,
  "actual and declared output lengths must match",
);
assert.equal(
  extractFirstFileFromZip(
    createSingleFileZip(Buffer.from("x"), {
      declaredUncompressedSize: 0x8000_0000,
    }),
    64,
  ),
  null,
  "ZIP sizes must be parsed as unsigned values before comparison",
);

const truncated = createSingleFileZip(image).subarray(0, 20);
assert.equal(extractFirstFileFromZip(truncated, 1024), null);
assert.equal(extractFirstFileFromZip(Buffer.from("not a zip"), 1024), null);
assert.equal(extractFirstFileFromZip(createSingleFileZip(image), 0), null);
assert.equal(MAX_NOVELAI_ZIP_OUTPUT_BYTES, 64 * 1024 * 1024);

console.info("NovelAI ZIP security regressions passed.");
