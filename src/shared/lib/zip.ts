// Minimal ZIP writer using stored entries (no compression). Useful in Tauri
// paths where the old Node server ZIP endpoint is not available.

export type StoredZipFile = {
  name: string;
  data: string | Uint8Array;
};

const encoder = new TextEncoder();

let crcTable: Uint32Array | null = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimestamp(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function header(size: number, write: (view: DataView) => void): Uint8Array {
  const bytes = new Uint8Array(size);
  write(new DataView(bytes.buffer));
  return bytes;
}

function normalizeZipName(name: string): string {
  const cleaned = name
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.replace(/[^a-zA-Z0-9._ -]+/g, "_").trim())
    .filter(Boolean)
    .join("/");
  return cleaned || "file.txt";
}

function uniqueZipName(name: string, used: Set<string>): string {
  const normalized = normalizeZipName(name);
  if (!used.has(normalized)) {
    used.add(normalized);
    return normalized;
  }
  const dot = normalized.lastIndexOf(".");
  const base = dot > 0 ? normalized.slice(0, dot) : normalized;
  const ext = dot > 0 ? normalized.slice(dot) : "";
  let index = 2;
  while (used.has(`${base}-${index}${ext}`)) index += 1;
  const next = `${base}-${index}${ext}`;
  used.add(next);
  return next;
}

function concat(chunks: Uint8Array[], totalLength: number): Uint8Array {
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function createStoredZip(files: StoredZipFile[]): Blob {
  const timestamp = dosTimestamp();
  const chunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  const usedNames = new Set<string>();
  let offset = 0;

  for (const file of files) {
    const name = uniqueZipName(file.name, usedNames);
    const nameBytes = encoder.encode(name);
    const dataBytes = typeof file.data === "string" ? encoder.encode(file.data) : file.data;
    const crc = crc32(dataBytes);

    const localHeader = header(30, (view) => {
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, timestamp.time, true);
      view.setUint16(12, timestamp.day, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, dataBytes.length, true);
      view.setUint32(22, dataBytes.length, true);
      view.setUint16(26, nameBytes.length, true);
      view.setUint16(28, 0, true);
    });

    chunks.push(localHeader, nameBytes, dataBytes);

    const centralHeader = header(46, (view) => {
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, timestamp.time, true);
      view.setUint16(14, timestamp.day, true);
      view.setUint32(16, crc, true);
      view.setUint32(20, dataBytes.length, true);
      view.setUint32(24, dataBytes.length, true);
      view.setUint16(28, nameBytes.length, true);
      view.setUint16(30, 0, true);
      view.setUint16(32, 0, true);
      view.setUint16(34, 0, true);
      view.setUint16(36, 0, true);
      view.setUint32(38, 0, true);
      view.setUint32(42, offset, true);
    });
    centralChunks.push(centralHeader, nameBytes);

    offset += localHeader.length + nameBytes.length + dataBytes.length;
  }

  const centralOffset = offset;
  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = header(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, files.length, true);
    view.setUint16(10, files.length, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, centralOffset, true);
    view.setUint16(20, 0, true);
  });

  const totalLength = centralOffset + centralSize + end.length;
  const bytes = concat([...chunks, ...centralChunks, end], totalLength);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: "application/zip" });
}
