const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_FILE_HEADER = 0x02014b50;
const ZIP_LOCAL_FILE_HEADER = 0x04034b50;

function readUint16(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset]! |
    (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)
  ) >>> 0;
}

function findEndOfCentralDirectory(bytes: Uint8Array) {
  const minimumOffset = Math.max(0, bytes.length - 22 - 0xffff);
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset--) {
    if (readUint32(bytes, offset) === ZIP_END_OF_CENTRAL_DIRECTORY) return offset;
  }
  return -1;
}

export function isZipFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed";
}

export async function readTextFileFromZip(file: File, preferredPaths: string[]) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const endOffset = findEndOfCentralDirectory(bytes);
  if (endOffset < 0) throw new Error("Invalid zip file");

  const entryCount = readUint16(bytes, endOffset + 10);
  const centralDirectoryOffset = readUint32(bytes, endOffset + 16);
  const decoder = new TextDecoder();
  const preferred = new Set(preferredPaths.map((path) => path.toLowerCase()));
  let fallbackJsonEntry:
    | { localHeaderOffset: number; compressedSize: number; compressionMethod: number; filename: string }
    | null = null;

  let offset = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index++) {
    if (readUint32(bytes, offset) !== ZIP_CENTRAL_DIRECTORY_FILE_HEADER) {
      throw new Error("Invalid zip central directory");
    }

    const compressionMethod = readUint16(bytes, offset + 10);
    const compressedSize = readUint32(bytes, offset + 20);
    const filenameLength = readUint16(bytes, offset + 28);
    const extraLength = readUint16(bytes, offset + 30);
    const commentLength = readUint16(bytes, offset + 32);
    const localHeaderOffset = readUint32(bytes, offset + 42);
    const filename = decoder.decode(bytes.slice(offset + 46, offset + 46 + filenameLength));
    const normalizedName = filename.replace(/^\/+/, "").toLowerCase();
    const entry = { localHeaderOffset, compressedSize, compressionMethod, filename };

    if (preferred.has(normalizedName)) {
      return readZipTextEntry(bytes, entry);
    }
    if (!fallbackJsonEntry && normalizedName.endsWith(".json")) {
      fallbackJsonEntry = entry;
    }

    offset += 46 + filenameLength + extraLength + commentLength;
  }

  if (fallbackJsonEntry) return readZipTextEntry(bytes, fallbackJsonEntry);
  throw new Error("No JSON file found in zip");
}

function readZipTextEntry(
  bytes: Uint8Array,
  entry: { localHeaderOffset: number; compressedSize: number; compressionMethod: number; filename: string },
) {
  if (entry.compressionMethod !== 0) {
    throw new Error(`Zip entry ${entry.filename} is compressed; export it without compression before importing.`);
  }
  const headerOffset = entry.localHeaderOffset;
  if (readUint32(bytes, headerOffset) !== ZIP_LOCAL_FILE_HEADER) throw new Error("Invalid zip local file header");
  const filenameLength = readUint16(bytes, headerOffset + 26);
  const extraLength = readUint16(bytes, headerOffset + 28);
  const dataOffset = headerOffset + 30 + filenameLength + extraLength;
  const dataEnd = dataOffset + entry.compressedSize;
  if (dataEnd > bytes.length) throw new Error("Zip entry is truncated");
  return new TextDecoder().decode(bytes.slice(dataOffset, dataEnd));
}
