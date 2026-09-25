import assert from "node:assert/strict";
import { readEncodedImageDimensions } from "../../packages/client/src/lib/chat-attachment-images.js";

type Endian = "II" | "MM";

function exifApp1(orientation: number, endian: Endian): number[] {
  const le = endian === "II";
  const u16 = (value: number) => (le ? [value & 0xff, value >> 8] : [value >> 8, value & 0xff]);
  const u32 = (value: number) =>
    le
      ? [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, value >>> 24]
      : [value >>> 24, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
  const tiff = [
    ...(le ? [0x49, 0x49] : [0x4d, 0x4d]),
    ...u16(0x002a),
    ...u32(8),
    ...u16(1),
    ...u16(0x0112),
    ...u16(3),
    ...u32(1),
    ...u16(orientation),
    ...u16(0),
    ...u32(0),
  ];
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const length = payload.length + 2;
  return [0xff, 0xe1, length >> 8, length & 0xff, ...payload];
}

function sof0(width: number, height: number): number[] {
  // Baseline frame header: length 17, precision 8, height, width, 3 components.
  return [
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x03,
    0x01,
    0x22,
    0x00,
    0x02,
    0x11,
    0x01,
    0x03,
    0x11,
    0x01,
  ];
}

function jpeg(segments: number[][]): Uint8Array {
  return new Uint8Array([0xff, 0xd8, ...segments.flat(), 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);
}

const landscapeFrame = sof0(3000, 2000);

assert.deepEqual(
  readEncodedImageDimensions(jpeg([landscapeFrame])),
  { width: 3000, height: 2000 },
  "a JPEG without Exif keeps its frame size",
);

for (const endian of ["II", "MM"] as const) {
  assert.deepEqual(
    readEncodedImageDimensions(jpeg([exifApp1(1, endian), landscapeFrame])),
    { width: 3000, height: 2000 },
    `orientation 1 (${endian}) keeps the frame size`,
  );
  assert.deepEqual(
    readEncodedImageDimensions(jpeg([exifApp1(3, endian), landscapeFrame])),
    { width: 3000, height: 2000 },
    `orientation 3 (${endian}) is a 180-degree turn and keeps the frame size`,
  );
  for (const orientation of [5, 6, 7, 8]) {
    assert.deepEqual(
      readEncodedImageDimensions(jpeg([exifApp1(orientation, endian), landscapeFrame])),
      { width: 2000, height: 3000 },
      `orientation ${orientation} (${endian}) swaps width and height, matching the decoded bitmap`,
    );
  }
}

// A non-Exif APP1 (e.g. XMP) before the Exif segment is ignored rather than misread.
const xmpApp1 = [0xff, 0xe1, 0x00, 0x08, 0x68, 0x74, 0x74, 0x70, 0x3a, 0x2f];
assert.deepEqual(
  readEncodedImageDimensions(jpeg([xmpApp1, exifApp1(6, "II"), landscapeFrame])),
  { width: 2000, height: 3000 },
  "an XMP APP1 ahead of the Exif segment does not hide the orientation",
);

// A truncated Exif segment never throws and falls back to the frame size.
const truncated = exifApp1(6, "II").slice(0, 16);
truncated[2] = 0x00;
truncated[3] = truncated.length - 2;
assert.deepEqual(
  readEncodedImageDimensions(jpeg([truncated, landscapeFrame])),
  { width: 3000, height: 2000 },
  "a truncated Exif segment is ignored",
);

// Other formats are untouched.
const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x06,
  0x40, 0x00, 0x00, 0x01, 0x90, 0x08, 0x02, 0x00, 0x00, 0x00,
]);
assert.deepEqual(readEncodedImageDimensions(png), { width: 1600, height: 400 }, "PNG header parsing is unchanged");

console.log("chat-attachment-exif-orientation regression passed");
