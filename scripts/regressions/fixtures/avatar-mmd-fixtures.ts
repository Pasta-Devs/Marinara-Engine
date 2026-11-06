// Source-authored PMX/VMD fixtures: one triangle, a bone and a smile morph. No third-party model assets.
import { Buffer } from "node:buffer";

function writer(encoding: BufferEncoding = "utf8") {
  const parts: Buffer[] = [];
  const bytes = (value: Uint8Array) => parts.push(Buffer.from(value));
  const number = (size: number, write: (part: Buffer) => void) => {
    const part = Buffer.alloc(size);
    write(part);
    parts.push(part);
  };
  const i32 = (value: number) => number(4, (part) => part.writeInt32LE(value));
  return {
    bytes,
    u8: (value: number) => number(1, (part) => part.writeUInt8(value)),
    i8: (value: number) => number(1, (part) => part.writeInt8(value)),
    i16: (value: number) => number(2, (part) => part.writeInt16LE(value)),
    u16: (value: number) => number(2, (part) => part.writeUInt16LE(value)),
    i32,
    u32: (value: number) => number(4, (part) => part.writeUInt32LE(value)),
    floats: (...values: number[]) => values.forEach((value) => number(4, (part) => part.writeFloatLE(value))),
    text: (value: string) => {
      const data = Buffer.from(value, encoding);
      i32(data.length);
      bytes(data);
    },
    fixed: (value: string, size: number) => {
      const data = Buffer.alloc(size);
      data.write(value, "ascii");
      bytes(data);
    },
    finish: () => Buffer.concat(parts),
  };
}

/** A PMX2.0 model, optionally referring to a texture bundled beside it. */
export function mmdPmx({
  texture = "",
  morphName = "笑い",
  encoding = "utf8",
  version = 2,
  boneName = "center",
  ikIterations,
  boneCount = 1,
  morphCount = 1,
  vertexCount = 3,
  sparseMorphs = false,
  toonTexture = false,
  independentMorphs = false,
  morphNameAt = 0,
  textures,
}: {
  texture?: string;
  morphName?: string;
  encoding?: "utf8" | "utf16le";
  version?: number;
  boneName?: string;
  ikIterations?: number;
  boneCount?: number;
  morphCount?: number;
  vertexCount?: number;
  sparseMorphs?: boolean;
  toonTexture?: boolean;
  independentMorphs?: boolean;
  morphNameAt?: number;
  textures?: string[];
} = {}): Buffer {
  const w = writer(encoding);
  const boneSize = boneCount > 127 ? 2 : 1;
  const morphSize = morphCount > 127 ? 2 : 1;
  const vertexSize = vertexCount > 255 ? 2 : 1;
  const textureNames = textures ?? (texture ? [texture] : []);
  const textureSize = textureNames.length > 127 ? 2 : 1;
  const textureIndex = (index: number) => (textureSize === 1 ? w.i8(index) : w.i16(index));
  const boneIndex = (index: number) => (boneSize === 1 ? w.i8(index) : w.i16(index));
  const morphIndex = (index: number) => (morphSize === 1 ? w.i8(index) : w.i16(index));
  const vertexIndex = (index: number) => (vertexSize === 1 ? w.u8(index) : w.u16(index));
  w.bytes(Buffer.from("PMX "));
  w.floats(version);
  w.u8(8);
  w.bytes(new Uint8Array([encoding === "utf8" ? 1 : 0, 0, vertexSize, textureSize, 1, boneSize, morphSize, 1]));
  for (const value of ["Fixture", "Fixture", "Source-authored regression model", ""]) w.text(value);
  w.i32(vertexCount);
  const triangle = [
    [-0.5, 0, 0, 0],
    [0.5, 0, 1, 0],
    [0, 2, 0.5, 1],
  ];
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const [x, y, u, v] = triangle[vertex % 3]!;
    w.floats(x!, y!, 0, 0, 0, 1, u!, v!);
    w.u8(0); // BDEF1, entirely attached to the center bone.
    boneIndex(0);
    w.floats(1);
  }
  w.i32(3);
  for (const index of [0, 1, 2]) vertexIndex(index);
  w.i32(textureNames.length);
  for (const name of textureNames) w.text(name);
  w.i32(1);
  w.text("surface");
  w.text("surface");
  w.floats(0.6, 0.3, 0.8, 1, 0, 0, 0, 1, 0.3, 0.2, 0.4);
  w.u8(1); // Double-sided.
  w.floats(0, 0, 0, 1, 0);
  textureIndex(textureNames.length ? 0 : -1);
  textureIndex(-1);
  w.u8(0);
  w.u8(toonTexture ? 0 : 1); // An uploaded texture, or shared toon texture0.
  if (toonTexture) textureIndex(0);
  else w.u8(0);
  w.text("");
  w.i32(3);
  w.i32(boneCount);
  for (let bone = 0; bone < boneCount; bone += 1) {
    w.text(bone === 0 ? boneName : `bone-${bone}`);
    w.text("center");
    w.floats(0, 0, 0);
    boneIndex(bone - 1);
    w.i32(0);
    w.u16(ikIterations === undefined ? 0 : 0x20);
    w.floats(0, 1, 0);
    if (ikIterations !== undefined) {
      boneIndex(0);
      w.u32(ikIterations);
      w.floats(0.5);
      w.i32(1);
      boneIndex(0);
      w.u8(0);
    }
  }
  w.i32(morphCount);
  w.text(morphNameAt === 0 ? morphName : "face-0");
  w.text(morphNameAt === 0 ? "happy" : "");
  w.u8(2);
  w.u8(1); // Vertex morph.
  w.i32(1);
  vertexIndex(2);
  w.floats(0.25, 0, 0);
  for (let morph = 1; morph < morphCount; morph += 1) {
    w.text(morphNameAt === morph ? morphName : `group-${morph}`);
    w.text("");
    w.u8(2);
    w.u8(sparseMorphs || independentMorphs ? 1 : 0);
    w.i32(sparseMorphs && !independentMorphs ? 0 : 1);
    if (independentMorphs) {
      vertexIndex(2);
      w.floats(0.25, 0, 0);
    } else if (!sparseMorphs) {
      morphIndex(morph - 1);
      w.floats(1);
    }
  }
  w.i32(0); // Display frames.
  w.i32(0); // Rigid bodies.
  w.i32(0); // Joints.
  if (version > 2) w.i32(0); // No PMX2.1 soft bodies.
  return w.finish();
}

/** One-second VMD bone motion; the second frame shifts the triangle horizontally. */
export function mmdVmd(): Buffer {
  const w = writer();
  w.fixed("Vocaloid Motion Data 0002", 30);
  w.fixed("Fixture", 20);
  w.u32(2);
  for (const frame of [0, 30]) {
    w.fixed("center", 15);
    w.u32(frame);
    w.floats(frame ? 0.3 : 0, 0, 0, 0, 0, 0, 1);
    w.bytes(new Uint8Array(64).fill(20));
  }
  for (let section = 0; section < 5; section += 1) w.u32(0);
  return w.finish();
}
