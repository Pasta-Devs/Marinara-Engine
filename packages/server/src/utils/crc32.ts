import zlib from "node:zlib";

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

// Node's zlib.crc32 (native, Node 22.2+) is many times faster than the table loop on big backups. It takes and
// returns finished values, so convert from and back to the running state.
const nativeCrc32 = (zlib as { crc32?: (data: Uint8Array, value?: number) => number }).crc32;

export function updateCrc32State(state: number, chunk: Uint8Array): number {
  if (nativeCrc32) return (nativeCrc32(chunk, (state ^ 0xffffffff) >>> 0) ^ 0xffffffff) >>> 0;
  let crc = state >>> 0;
  for (const byte of chunk) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return crc >>> 0;
}

export function finishCrc32(state: number): number {
  return (state ^ 0xffffffff) >>> 0;
}

export function crc32Buffer(buffer: Uint8Array): number {
  return finishCrc32(updateCrc32State(0xffffffff, buffer));
}
