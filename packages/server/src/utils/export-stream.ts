import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { crc32, createDeflateRaw } from "node:zlib";

/** A key written at a JSON slot: one lazily read value, or items read one at a time. Absent or empty parts are omitted. */
export type JsonSlotPart =
  { key: string; value: () => Promise<string | null> } | { key: string; items: AsyncIterable<unknown> };

/** A unique object key marking where streamed parts go; place it directly before another key. */
export function createJsonSlot(): string {
  return `\u0000slot-${randomUUID()}`;
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
      if (partValue) yield `${JSON.stringify(part.key)}${colon}${JSON.stringify(partValue)}${separator}`;
      continue;
    }
    let open = false;
    for await (const item of part.items) {
      const json = JSON.stringify(item, null, space || undefined);
      yield `${open ? "," : `${JSON.stringify(part.key)}${colon}[`}${itemBreak}${space ? json.replaceAll("\n", itemBreak) : json}`;
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
