// Plain GLB and FBX characters built in code, for the GLB/FBX avatar regression and e2e.
//   - plainGlb(): the Tripo-made VRM fixture (a textured, skinned Mixamo rig facing +Z) with its VRM extension
//     removed, plus four named blend shapes: viseme_aa (moves the whole model sideways, so a picture shows the
//     mouth opening), mouthSmile, eyeBlinkLeft and eyeBlinkRight.
//   - fbxRig(): a binary FBX 7.4 Mixamo skeleton in centimetres, facing -Z (its left arm on -X) with its arms in
//     an A-pose, three blend shape channels and, optionally, a texture whose picture isn't embedded.
//   - asciiFbxRig(): the same skeleton as an FBX 7.4 ASCII file.
import { tripoMadeVrm } from "./avatar-3d-fixtures.js";

const GLB_JSON = 0x4e4f534a;
const GLB_BIN = 0x004e4942;

function pad(bytes: Buffer, fill: number): Buffer {
  return Buffer.concat([bytes, Buffer.alloc((4 - (bytes.length % 4)) % 4, fill)]);
}

/** A GLB from its JSON and binary chunk. */
export function encodeGlb(json: unknown, bin: Buffer): Buffer {
  const jsonChunk = pad(Buffer.from(JSON.stringify(json), "utf8"), 0x20);
  const binChunk = pad(bin, 0);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  const chunkHeader = (length: number, type: number) => {
    const bytes = Buffer.alloc(8);
    bytes.writeUInt32LE(length, 0);
    bytes.writeUInt32LE(type, 4);
    return bytes;
  };
  return Buffer.concat([
    header,
    chunkHeader(jsonChunk.length, GLB_JSON),
    jsonChunk,
    chunkHeader(binChunk.length, GLB_BIN),
    binChunk,
  ]);
}

/** The JSON and binary chunk of a GLB. */
export function decodeGlb(glb: Buffer): { json: Record<string, any>; bin: Buffer } {
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8"));
  const binStart = 20 + jsonLength;
  const binLength = glb.readUInt32LE(binStart);
  return { json, bin: glb.subarray(binStart + 8, binStart + 8 + binLength) };
}

export const PLAIN_GLB_MORPHS = ["viseme_aa", "mouthSmile", "eyeBlinkLeft", "eyeBlinkRight"] as const;
/** How far viseme_aa moves the model sideways, in metres. */
export const PLAIN_GLB_MOUTH_SHIFT = 0.25;

export function plainGlb(): Buffer {
  const { json, bin } = decodeGlb(tripoMadeVrm());
  delete json.extensions;
  delete json.extensionsUsed;
  const count = json.accessors[json.meshes[0].primitives[0].attributes.POSITION].count as number;
  const chunks: Buffer[] = [pad(Buffer.from(bin), 0)];
  let offset = chunks[0]!.length;
  const targets = PLAIN_GLB_MORPHS.map((name) => {
    const deltas = new Float32Array(count * 3);
    if (name === "viseme_aa")
      for (let vertex = 0; vertex < count; vertex += 1) deltas[vertex * 3 + 2] = PLAIN_GLB_MOUTH_SHIFT;
    const bytes = Buffer.from(deltas.buffer);
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    const shift = name === "viseme_aa" ? PLAIN_GLB_MOUTH_SHIFT : 0;
    json.accessors.push({
      bufferView: json.bufferViews.length - 1,
      componentType: 5126,
      count,
      type: "VEC3",
      min: [0, 0, 0],
      max: [0, 0, shift],
    });
    chunks.push(bytes);
    offset += bytes.length;
    return { POSITION: json.accessors.length - 1 };
  });
  json.meshes[0].primitives[0].targets = targets;
  json.meshes[0].weights = PLAIN_GLB_MORPHS.map(() => 0);
  json.meshes[0].extras = { targetNames: [...PLAIN_GLB_MORPHS] };
  const body = Buffer.concat(chunks);
  json.buffers = [{ byteLength: body.length }];
  return encodeGlb(json, body);
}

/** A GLB whose skin joints have names no humanoid matcher knows. */
export function unnamedRigGlb(): Buffer {
  const { json, bin } = decodeGlb(plainGlb());
  json.nodes.forEach((node: { name?: string }, index: number) => {
    if (node.name?.startsWith("mixamorig:"))
      node.name = index === 1 ? "Bone" : `Bone.${String(index).padStart(3, "0")}`;
  });
  return encodeGlb(json, bin);
}

// ── FBX ──

type FbxProperty = { L: bigint } | { S: string | Buffer } | { D: number } | { I: number };
interface FbxNode {
  name: string;
  properties?: FbxProperty[];
  children?: FbxNode[];
}

const FBX_BINARY_HEADER = Buffer.concat([Buffer.from("Kaydara FBX Binary  \0", "latin1"), Buffer.from([0x1a, 0x00])]);

function encodeProperty(property: FbxProperty): Buffer {
  if ("L" in property) {
    const bytes = Buffer.alloc(9);
    bytes.write("L", 0, "latin1");
    bytes.writeBigInt64LE(property.L, 1);
    return bytes;
  }
  if ("D" in property) {
    const bytes = Buffer.alloc(9);
    bytes.write("D", 0, "latin1");
    bytes.writeDoubleLE(property.D, 1);
    return bytes;
  }
  if ("I" in property) {
    const bytes = Buffer.alloc(5);
    bytes.write("I", 0, "latin1");
    bytes.writeInt32LE(property.I, 1);
    return bytes;
  }
  const value = typeof property.S === "string" ? Buffer.from(property.S, "utf8") : property.S;
  const head = Buffer.alloc(5);
  head.write("S", 0, "latin1");
  head.writeUInt32LE(value.length, 1);
  return Buffer.concat([head, value]);
}

/** One FBX 7.4 node record (32-bit offsets), its children and their closing null record. */
function encodeNode(node: FbxNode, offset: number): Buffer {
  const properties = Buffer.concat((node.properties ?? []).map(encodeProperty));
  const name = Buffer.from(node.name, "latin1");
  const headerLength = 13 + name.length;
  const parts: Buffer[] = [];
  let at = offset + headerLength + properties.length;
  for (const child of node.children ?? []) {
    const encoded = encodeNode(child, at);
    parts.push(encoded);
    at += encoded.length;
  }
  if (node.children?.length) {
    parts.push(Buffer.alloc(13));
    at += 13;
  }
  const header = Buffer.alloc(13);
  header.writeUInt32LE(at, 0);
  header.writeUInt32LE(node.properties?.length ?? 0, 4);
  header.writeUInt32LE(properties.length, 8);
  header.writeUInt8(name.length, 12);
  return Buffer.concat([header, name, properties, ...parts]);
}

function encodeFbx(nodes: FbxNode[], version: number): Buffer {
  const version32 = Buffer.alloc(4);
  version32.writeUInt32LE(version, 0);
  const parts: Buffer[] = [FBX_BINARY_HEADER, version32];
  let offset = FBX_BINARY_HEADER.length + 4;
  for (const node of nodes) {
    const encoded = encodeNode(node, offset);
    parts.push(encoded);
    offset += encoded.length;
  }
  // The top-level null record, then a footer long enough for three's end-of-content check.
  return Buffer.concat([...parts, Buffer.alloc(13), Buffer.alloc(176)]);
}

const objectName = (name: string, className: string) =>
  Buffer.concat([Buffer.from(name, "utf8"), Buffer.from([0, 1]), Buffer.from(className, "latin1")]);

/** Mixamo bones in centimetres: name, parent, translation from the parent. The model faces -Z, so its left
 *  side is on -X, and its forearms hang 45° down (an A-pose). */
export const FBX_RIG_BONES: ReadonlyArray<readonly [string, string | null, readonly [number, number, number]]> = [
  ["mixamorig:Hips", null, [0, 100, 0]],
  ["mixamorig:Spine", "mixamorig:Hips", [0, 10, 0]],
  ["mixamorig:Spine1", "mixamorig:Spine", [0, 10, 0]],
  ["mixamorig:Spine2", "mixamorig:Spine1", [0, 10, 0]],
  ["mixamorig:Neck", "mixamorig:Spine2", [0, 15, 0]],
  ["mixamorig:Head", "mixamorig:Neck", [0, 10, 0]],
  ["mixamorig:HeadTop_End", "mixamorig:Head", [0, 20, 0]],
  ...(["Left", "Right"] as const).flatMap((side) => {
    const x = side === "Left" ? -1 : 1;
    const bone = (part: string) => `mixamorig:${side}${part}`;
    return [
      [bone("Shoulder"), "mixamorig:Spine2", [x * 5, 10, 0]],
      [bone("Arm"), bone("Shoulder"), [x * 10, 0, 0]],
      [bone("ForeArm"), bone("Arm"), [x * 17.7, -17.7, 0]],
      [bone("Hand"), bone("ForeArm"), [x * 17.7, -17.7, 0]],
      [bone("UpLeg"), "mixamorig:Hips", [x * 10, -5, 0]],
      [bone("Leg"), bone("UpLeg"), [0, -45, 0]],
      [bone("Foot"), bone("Leg"), [0, -45, 0]],
    ] as const;
  }),
];
export const FBX_RIG_MORPHS = ["Fcl_MTH_A", "eyeBlink_L", "eyeBlink_R"] as const;

export function fbxRig({ version = 7400, texture = false }: { version?: number; texture?: boolean } = {}): Buffer {
  const id = (index: number) => BigInt(1000 + index);
  const models: FbxNode[] = FBX_RIG_BONES.map(([name, , [x, y, z]], index) => ({
    name: "Model",
    properties: [{ L: id(index) }, { S: objectName(name, "Model") }, { S: "LimbNode" }],
    children: [
      { name: "Version", properties: [{ I: 232 }] },
      {
        name: "Properties70",
        children: [
          {
            name: "P",
            properties: [
              { S: "Lcl Translation" },
              { S: "Lcl Translation" },
              { S: "" },
              { S: "A" },
              { D: x },
              { D: y },
              { D: z },
            ],
          },
        ],
      },
    ],
  }));
  const deformers: FbxNode[] = FBX_RIG_MORPHS.map((name, index) => ({
    name: "Deformer",
    properties: [{ L: id(500 + index) }, { S: objectName(name, "SubDeformer") }, { S: "BlendShapeChannel" }],
    children: [{ name: "Version", properties: [{ I: 100 }] }],
  }));
  const textures: FbxNode[] = texture
    ? [
        {
          name: "Texture",
          properties: [{ L: id(900) }, { S: objectName("Skin", "Texture") }, { S: "" }],
          children: [{ name: "RelativeFilename", properties: [{ S: "textures/skin.png" }] }],
        },
      ]
    : [];
  const byName = new Map(FBX_RIG_BONES.map(([name], index) => [name, index]));
  const connections: FbxNode[] = FBX_RIG_BONES.map(([, parent], index) => ({
    name: "C",
    properties: [{ S: "OO" }, { L: id(index) }, { L: parent === null ? 0n : id(byName.get(parent)!) }],
  }));
  return encodeFbx(
    [
      { name: "FBXHeaderExtension", children: [{ name: "FBXVersion", properties: [{ I: version }] }] },
      { name: "Objects", children: [...models, ...deformers, ...textures] },
      { name: "Connections", children: connections },
    ],
    version,
  );
}

export function asciiFbxRig(): Buffer {
  const lines = ["; FBX 7.4.0 project file", "FBXHeaderExtension:  {", "\tFBXVersion: 7400", "}", "Objects:  {"];
  FBX_RIG_BONES.forEach(([name, , [x, y, z]], index) => {
    lines.push(
      `\tModel: ${1000 + index}, "Model::${name}", "LimbNode" {`,
      "\t\tVersion: 232",
      "\t\tProperties70:  {",
      `\t\t\tP: "Lcl Translation", "Lcl Translation", "", "A",${x},${y},${z}`,
      "\t\t}",
      "\t}",
    );
  });
  FBX_RIG_MORPHS.forEach((name, index) => {
    lines.push(`\tDeformer: ${1500 + index}, "SubDeformer::${name}", "BlendShapeChannel" {`, "\t\tVersion: 100", "\t}");
  });
  lines.push("}", "Connections:  {");
  const byName = new Map(FBX_RIG_BONES.map(([name], index) => [name, index]));
  FBX_RIG_BONES.forEach(([, parent], index) => {
    lines.push(`\tC: "OO",${1000 + index},${parent === null ? 0 : 1000 + byName.get(parent)!}`);
  });
  lines.push("}", "");
  return Buffer.from(lines.join("\n"), "utf8");
}
