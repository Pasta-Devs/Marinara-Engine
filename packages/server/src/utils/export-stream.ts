import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { crc32, createDeflateRaw } from "node:zlib";

/** A key written at a JSON slot: one lazily read value, or items read one at a time. Absent or empty parts are omitted. */
export type JsonSlotPart =
  { key: string; value: () => Promise<string | DataUrl | null> } | { key: string; items: AsyncIterable<unknown> };

/** A unique object key marking where streamed parts go; place it directly before another key. */
export function createJsonSlot(): string {
  return `\u0000slot-${randomUUID()}`;
}

// A multiple of 3, so the base64 of consecutive slices joins into the base64 of the whole file.
const DATA_URL_SLICE_BYTES = 48 * 1024;

/**
 * Image bytes that streamJsonWithSlot writes as a base64 data URL string one small slice at a time, so a
 * multi-megabyte picture never becomes a heap string, or JSON text, of its own size (#8917).
 */
export class DataUrl {
  constructor(
    readonly mimeType: string,
    readonly bytes: Buffer,
  ) {}

  /** The whole URL as one string, for documents that are built in memory anyway. */
  toString() {
    return `data:${this.mimeType};base64,${this.bytes.toString("base64")}`;
  }
}

/** Yield `JSON.stringify(value, null, space)` in pieces, with every DataUrl in it written as its URL string. */
function* jsonPieces(value: unknown, space: number): Generator<string> {
  const urls: DataUrl[] = [];
  const mark = createJsonSlot();
  const text = JSON.stringify(
    value,
    (_key, item: unknown) => {
      if (!(item instanceof DataUrl)) return item;
      urls.push(item);
      return mark;
    },
    space || undefined,
  );
  for (const [index, piece] of text.split(JSON.stringify(mark)).entries()) {
    yield piece;
    const url = urls[index];
    if (!url) continue;
    // The quoted prefix without its closing quote; base64 never needs JSON escaping.
    yield JSON.stringify(`data:${url.mimeType};base64,`).slice(0, -1);
    for (let start = 0; start < url.bytes.length; start += DATA_URL_SLICE_BYTES) {
      yield url.bytes.toString("base64", start, start + DATA_URL_SLICE_BYTES);
    }
    yield '"';
  }
}

/**
 * Yield exactly `JSON.stringify(value, null, space)` with each part written in place of `slot`, reading
 * parts only as the reader asks for them, so a large gallery is never held in memory at once (#7115).
 */
export async function* streamJsonWithSlot(
  value: unknown,
  slot: string,
  parts: JsonSlotPart[],
  space = 0,
): AsyncGenerator<string> {
  const text = JSON.stringify(value, null, space || undefined);
  const colon = space ? ": " : ":";
  const slotToken = `${JSON.stringify(slot)}${colon}0`;
  const slotStart = text.indexOf(slotToken);
  const nextKey = text.indexOf('"', slotStart + slotToken.length);
  if (slotStart < 0 || nextKey < 0) throw new Error("JSON export slot must sit before another key");
  // The slot's own separator ("," or ",\n" plus indentation) follows every written part.
  const separator = text.slice(slotStart + slotToken.length, nextKey);
  const indent = space ? text.slice(text.lastIndexOf("\n", slotStart) + 1, slotStart) : "";
  const itemBreak = space ? `\n${indent}${" ".repeat(space)}` : "";

  yield text.slice(0, slotStart);
  for (const part of parts) {
    if ("value" in part) {
      const partValue = await part.value();
      if (!partValue) continue;
      yield `${JSON.stringify(part.key)}${colon}`;
      yield* jsonPieces(partValue, 0);
      yield separator;
      continue;
    }
    let open = false;
    for await (const item of part.items) {
      yield `${open ? "," : `${JSON.stringify(part.key)}${colon}[`}${itemBreak}`;
      for (const piece of jsonPieces(item, space)) yield space ? piece.replaceAll("\n", itemBreak) : piece;
      open = true;
    }
    if (open) yield `${space ? `\n${indent}` : ""}]${separator}`;
  }
  yield text.slice(nextKey);
}

/** A byte stream that pulls the next chunk only after the previous one drained (backpressure). */
export function toByteStream(chunks: AsyncIterable<string | Buffer>): Readable {
  return Readable.from(chunks, { objectMode: false });
}

function dosDateTime(date: Date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = date.getDate() | ((date.getMonth() + 1) << 5) | ((Math.max(1980, date.getFullYear()) - 1980) << 9);
  return { time, day };
}

const ZIP32_LIMIT = 0xffffffff;
// Bit 3: CRC and sizes follow the data; bit 11: UTF-8 names. Entries are DEFLATE-compressed, like the
// adm-zip archives these exports used to build in memory.
const ZIP_FLAGS = 0x0808;
const ZIP_DEFLATE = 8;

/**
 * Stream a ZIP whose entries are generated and compressed one at a time.
 * ponytail: ZIP32 only, so an archive past 4 GB fails; reuse the backup writer's ZIP64 support if that is reached.
 */
export async function* streamZip(
  entries: AsyncIterable<{ name: string; content: AsyncIterable<string | Buffer> }>,
): AsyncGenerator<Buffer> {
  const { time, day } = dosDateTime(new Date());
  const records: Array<{ name: Buffer; crc: number; size: number; compressedSize: number; offset: number }> = [];
  let offset = 0;
  for await (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(ZIP_FLAGS, 6);
    header.writeUInt16LE(ZIP_DEFLATE, 8);
    header.writeUInt16LE(time, 10);
    header.writeUInt16LE(day, 12);
    header.writeUInt16LE(name.length, 26);
    const record = { name, crc: 0, size: 0, compressedSize: 0, offset };
    yield Buffer.concat([header, name]);

    const deflate = createDeflateRaw();
    const compressing = pipeline(
      Readable.from(
        (async function* () {
          for await (const chunk of entry.content) {
            const bytes = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
            record.crc = crc32(bytes, record.crc);
            record.size += bytes.length;
            yield bytes;
          }
        })(),
        { objectMode: false },
      ),
      deflate,
    );
    // A failure ends the loop below by destroying the deflate stream; it is rethrown after it.
    compressing.catch(() => undefined);
    for await (const compressed of deflate as AsyncIterable<Buffer>) {
      record.compressedSize += compressed.length;
      yield compressed;
    }
    await compressing;

    const descriptor = Buffer.alloc(16);
    descriptor.writeUInt32LE(0x08074b50, 0);
    descriptor.writeUInt32LE(record.crc, 4);
    descriptor.writeUInt32LE(record.compressedSize, 8);
    descriptor.writeUInt32LE(record.size, 12);
    yield descriptor;
    offset += header.length + name.length + record.compressedSize + descriptor.length;
    if (offset > ZIP32_LIMIT || record.size > ZIP32_LIMIT) throw new Error("Export archive is larger than 4 GB");
    records.push(record);
  }
  const directoryOffset = offset;
  for (const record of records) {
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(ZIP_FLAGS, 8);
    header.writeUInt16LE(ZIP_DEFLATE, 10);
    header.writeUInt16LE(time, 12);
    header.writeUInt16LE(day, 14);
    header.writeUInt32LE(record.crc, 16);
    header.writeUInt32LE(record.compressedSize, 20);
    header.writeUInt32LE(record.size, 24);
    header.writeUInt16LE(record.name.length, 28);
    header.writeUInt32LE(record.offset, 42);
    offset += header.length + record.name.length;
    yield Buffer.concat([header, record.name]);
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(records.length, 8);
  end.writeUInt16LE(records.length, 10);
  end.writeUInt32LE(offset - directoryOffset, 12);
  end.writeUInt32LE(directoryOffset, 16);
  yield end;
}

/** Reserve a file name in one archive: a repeated name gets " (2)", " (3)" … instead of replacing an earlier file. */
export function uniqueExportName(used: Set<string>, stem: string, extension: string): string {
  let name = `${stem}.${extension}`;
  for (let copy = 2; used.has(name.toLowerCase()); copy++) name = `${stem} (${copy}).${extension}`;
  used.add(name.toLowerCase());
  return name;
}

/** Stream one bulk export ZIP, reading each file only as it is written; repeated names get a number. */
export function streamExportZip(
  files: AsyncIterable<{ stem: string; extension: string; content: AsyncIterable<string> }>,
): Readable {
  return toByteStream(
    streamZip(
      (async function* () {
        const used = new Set<string>();
        for await (const file of files) {
          yield { name: uniqueExportName(used, file.stem, file.extension), content: file.content };
        }
      })(),
    ),
  );
}

export async function* singleChunk(text: string) {
  yield text;
}
