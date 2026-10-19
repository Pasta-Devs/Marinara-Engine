// A generated 3D avatar built in code (no Tripo file is committed), shaped like a real Tripo model after the
// Engine's conversion: a Mixamo skeleton under an unmapped Root, facing +X until glb-to-vrm turns it, one
// skinned mesh with one plain PBR material whose normal, colour and metal/roughness maps are embedded pictures
// in Tripo's order, and no face shapes, jaw or eye bones. Each body part is a flat panel facing forward and
// moving with one bone, so a browser can see the colour and the motion.
import {
  convertRiggedGlbToVrm,
  writeGlb,
} from "../../../packages/server/src/services/avatars/generation/glb-to-vrm.js";
import { sharp } from "./avatar-2d-fixtures.js";

export type Rgb = [number, number, number];
type V3 = [number, number, number];

/** Joint positions in a T-pose, facing +Z (left is +X). */
const T_POSE: Record<string, V3> = {
  Hips: [0, 0.95, 0],
  Spine: [0, 1.05, 0],
  Spine1: [0, 1.17, 0],
  Spine2: [0, 1.29, 0],
  Neck: [0, 1.45, 0],
  Head: [0, 1.55, 0],
  LeftShoulder: [0.06, 1.4, 0],
  LeftArm: [0.16, 1.4, 0],
  LeftForeArm: [0.42, 1.4, 0],
  LeftHand: [0.66, 1.4, 0],
  LeftUpLeg: [0.1, 0.9, 0],
  LeftLeg: [0.1, 0.5, 0],
  LeftFoot: [0.1, 0.08, 0],
  LeftToeBase: [0.1, 0.02, 0.12],
};
for (const [name, [x, y, z]] of Object.entries({ ...T_POSE })) {
  if (name.startsWith("Left")) T_POSE[name.replace("Left", "Right")] = [-x, y, z];
}
const PARENTS: Record<string, string> = {
  Spine: "Hips",
  Spine1: "Spine",
  Spine2: "Spine1",
  Neck: "Spine2",
  Head: "Neck",
};
for (const side of ["Left", "Right"]) {
  Object.assign(PARENTS, {
    [`${side}Shoulder`]: "Spine2",
    [`${side}Arm`]: `${side}Shoulder`,
    [`${side}ForeArm`]: `${side}Arm`,
    [`${side}Hand`]: `${side}ForeArm`,
    [`${side}UpLeg`]: "Hips",
    [`${side}Leg`]: `${side}UpLeg`,
    [`${side}Foot`]: `${side}Leg`,
    [`${side}ToeBase`]: `${side}Foot`,
  });
}
const JOINTS = Object.keys(T_POSE);
/** Front-facing panels [joint, left, right, bottom, top], each moving rigidly with its joint. */
const PANELS: ReadonlyArray<[string, number, number, number, number]> = [
  ["Head", -0.1, 0.1, 1.5, 1.78],
  ["Spine1", -0.16, 0.16, 0.9, 1.46],
  ["LeftArm", 0.16, 0.68, 1.36, 1.44],
  ["RightArm", -0.68, -0.16, 1.36, 1.44],
  ["LeftUpLeg", 0.04, 0.16, 0, 0.9],
  ["RightUpLeg", -0.16, -0.04, 0, 0.9],
];

const picture = (colour: Rgb, format: "png" | "jpeg"): Promise<Buffer> =>
  sharp({ create: { width: 8, height: 8, channels: 3, background: { r: colour[0], g: colour[1], b: colour[2] } } })
    [format]()
    .toBuffer();

/** A Tripo-like rigged GLB, as the generation run downloads it. */
export async function tripoLikeGlb(colour: Rgb): Promise<Buffer> {
  // Tripo's models face +X: the converter turns them to face +Z.
  const turn = ([x, y, z]: V3): V3 => [z, y, -x];
  const nodes: Array<Record<string, unknown>> = [{ name: "Root", children: [] as number[] }];
  for (const name of JOINTS) nodes.push({ name: `mixamorig:${name}`, children: [] as number[] });
  const nodeOf = (name: string) => JOINTS.indexOf(name) + 1;
  for (const name of JOINTS) {
    const parent = PARENTS[name];
    (nodes[parent ? nodeOf(parent) : 0]!.children as number[]).push(nodeOf(name));
    const at = turn(T_POSE[name]!);
    const from = parent ? turn(T_POSE[parent]!) : ([0, 0, 0] as V3);
    nodes[nodeOf(name)]!.translation = [at[0] - from[0], at[1] - from[1], at[2] - from[2]];
  }
  // Skin joint i is node i (Root, then the Mixamo joints).
  const skinJoints = nodes.map((_, index) => index);

  const positions: number[] = [];
  const normals: number[] = [];
  const jointIds: number[] = [];
  const weights: number[] = [];
  for (const [joint, left, right, bottom, top] of PANELS) {
    const corners: V3[] = [
      [left, bottom, 0.08],
      [right, bottom, 0.08],
      [right, top, 0.08],
      [left, bottom, 0.08],
      [right, top, 0.08],
      [left, top, 0.08],
    ];
    for (const corner of corners) {
      positions.push(...turn(corner));
      normals.push(...turn([0, 0, 1]));
      jointIds.push(nodeOf(joint), 0, 0, 0);
      weights.push(1, 0, 0, 0);
    }
  }
  const vertexCount = positions.length / 3;
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positions.length; index += 1) {
    min[index % 3] = Math.min(min[index % 3]!, positions[index]!);
    max[index % 3] = Math.max(max[index % 3]!, positions[index]!);
  }
  const inverseBind = skinJoints.flatMap((node) => {
    const at = node === 0 ? ([0, 0, 0] as V3) : turn(T_POSE[JOINTS[node - 1]!]!);
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -at[0], -at[1], -at[2], 1];
  });

  const chunks: Buffer[] = [];
  const bufferViews: Array<Record<string, unknown>> = [];
  let offset = 0;
  const view = (bytes: Buffer, target?: number) => {
    const padded = Buffer.concat([bytes, Buffer.alloc((4 - (bytes.length % 4)) % 4)]);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target ? { target } : {}) });
    chunks.push(padded);
    offset += padded.length;
    return bufferViews.length - 1;
  };
  const f32 = (values: number[]) => Buffer.from(new Float32Array(values).buffer);
  const u16 = (values: number[]) => Buffer.from(new Uint16Array(values).buffer);
  const accessors = [
    { bufferView: view(f32(positions), 34962), componentType: 5126, count: vertexCount, type: "VEC3", min, max },
    { bufferView: view(f32(normals), 34962), componentType: 5126, count: vertexCount, type: "VEC3" },
    {
      bufferView: view(f32(Array(vertexCount * 2).fill(0.5)), 34962),
      componentType: 5126,
      count: vertexCount,
      type: "VEC2",
    },
    { bufferView: view(u16(jointIds), 34962), componentType: 5123, count: vertexCount, type: "VEC4" },
    { bufferView: view(f32(weights), 34962), componentType: 5126, count: vertexCount, type: "VEC4" },
    { bufferView: view(f32(inverseBind)), componentType: 5126, count: skinJoints.length, type: "MAT4" },
  ];
  // Tripo's order: normal map (PNG), colour map and occlusion/roughness/metal map (JPEG).
  const images = [
    { bufferView: view(await picture([128, 128, 255], "png")), mimeType: "image/png", name: "NormalGL" },
    { bufferView: view(await picture(colour, "jpeg")), mimeType: "image/jpeg", name: "Color" },
    { bufferView: view(await picture([255, 200, 0], "jpeg")), mimeType: "image/jpeg", name: "ORM" },
  ];

  const meshNode = nodes.length;
  nodes.push({ name: "tripo_node", mesh: 0, skin: 0 });
  nodes.push({ name: "Armature", children: [meshNode, 0] });
  const json = {
    asset: { version: "2.0", generator: "tripo-like regression fixture" },
    scene: 0,
    scenes: [{ name: "Scene", nodes: [nodes.length - 1] }],
    nodes,
    skins: [{ joints: skinJoints, inverseBindMatrices: 5 }],
    meshes: [
      {
        primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2, JOINTS_0: 3, WEIGHTS_0: 4 }, material: 0 }],
      },
    ],
    accessors,
    materials: [
      {
        name: "tripo_material",
        normalTexture: { index: 0 },
        pbrMetallicRoughness: { baseColorTexture: { index: 1 }, metallicRoughnessTexture: { index: 2 } },
      },
    ],
    samplers: [{ magFilter: 9729, minFilter: 9987 }],
    textures: images.map((_, source) => ({ sampler: 0, source })),
    images,
    bufferViews,
    buffers: [{ byteLength: offset }],
  };
  return writeGlb(json, Buffer.concat(chunks));
}

/** The model as the 3D Avatars page saves it: a body-only VRM 1.0 file with no expressions. */
export async function generatedVrm(colour: Rgb): Promise<Buffer> {
  return convertRiggedGlbToVrm(await tripoLikeGlb(colour), { name: "Maukie" }).vrm;
}
