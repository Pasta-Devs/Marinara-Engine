/**
 * 3D Avatars (GLB and FBX, #8620):
 *   - bone names from Mixamo, Unity, VRoid, Blender, Unreal, 3ds Max Biped, Maya HumanIK, Character Creator,
 *     DAZ and Source rigs map to the humanoid bones, helper and finger bones never do, three's sanitized names
 *     match the file's own, and a rig the poses can't drive is detected;
 *   - left and right blend shapes that only come in pairs get one shared name;
 *   - the importer reads a plain GLB's JSON chunk and a binary or ASCII FBX's object names, binds faces and
 *     mouth shapes to blend shapes, warns about FBX textures left outside the file, and refuses VRMs, unmatched
 *     rigs, old FBX versions and files that aren't what they say in plain words;
 *   - the import route stores and serves GLB and FBX models with checked content types;
 *   - the stage's own loaders (three's GLTFLoader and FBXLoader, run here in Node) find the stored bones, pose
 *     them through three-vrm's humanoid, move blend shapes for faces, mouth and blink (one name moving a pair),
 *     straighten an A-pose, turn a model that faces away and scale a centimetre rig to a person's size.
 * Models are synthetic (fixtures/avatar-glb-fbx-fixtures.ts).
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-avatar-glb-fbx-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const {
  avatarConfigSchema,
  createAvatarConfig,
  matchAvatarHumanoidBones,
  pairedAvatarMorphNames,
  characterDataSchema,
} = await import("../../packages/shared/src/index.js");
const { glbFbxImporter, GLB_MODEL_FILE, FBX_MODEL_FILE } =
  await import("../../packages/server/src/services/avatars/formats/glb-fbx.js");
const { vrmImporter } = await import("../../packages/server/src/services/avatars/formats/vrm.js");
const { findAvatarImporter } = await import("../../packages/server/src/services/avatars/formats/registry.js");
const { plainGlb, unnamedRigGlb, fbxRig, asciiFbxRig, PLAIN_GLB_MORPHS, decodeGlb } =
  await import("./fixtures/avatar-glb-fbx-fixtures.js");
const { tripoMadeVrm } = await import("./fixtures/avatar-3d-fixtures.js");

const owner = { ownerType: "character", ownerId: "char_1" } as const;
const input = (bytes: Uint8Array, filename = "model.glb") => ({ owner, filename, bytes });
async function refused(bytes: Uint8Array, filename: string, code: string, message: RegExp, label: string) {
  await assert.rejects(
    glbFbxImporter.validate(input(bytes, filename)),
    (error: { code?: string; message?: string }) => {
      assert.equal(error.code, code, label);
      assert.match(error.message ?? "", message, label);
      return true;
    },
  );
}

// ── Bone names → humanoid bones ──
const BODY = ["hips", "spine", "head", "leftUpperArm", "leftLowerArm", "rightUpperArm", "rightLowerArm"] as const;
const rigs: Record<string, { names: string[]; expect: Record<string, string> }> = {
  Mixamo: {
    names: [
      "mixamorig:Hips",
      "mixamorig:Spine",
      "mixamorig:Spine1",
      "mixamorig:Spine2",
      "mixamorig:Neck",
      "mixamorig:Head",
      "mixamorig:HeadTop_End",
      "mixamorig:LeftShoulder",
      "mixamorig:LeftArm",
      "mixamorig:LeftForeArm",
      "mixamorig:LeftHand",
      "mixamorig:LeftHandThumb1",
      "mixamorig:RightArm",
      "mixamorig:RightForeArm",
      "mixamorig:LeftUpLeg",
      "mixamorig:LeftLeg",
      "mixamorig:LeftFoot",
      "mixamorig:LeftToeBase",
      "mixamorig:LeftToe_End",
    ],
    expect: {
      hips: "mixamorig:Hips",
      spine: "mixamorig:Spine",
      chest: "mixamorig:Spine1",
      upperChest: "mixamorig:Spine2",
      neck: "mixamorig:Neck",
      head: "mixamorig:Head",
      leftShoulder: "mixamorig:LeftShoulder",
      leftUpperArm: "mixamorig:LeftArm",
      leftLowerArm: "mixamorig:LeftForeArm",
      leftHand: "mixamorig:LeftHand",
      rightUpperArm: "mixamorig:RightArm",
      leftUpperLeg: "mixamorig:LeftUpLeg",
      leftLowerLeg: "mixamorig:LeftLeg",
      leftFoot: "mixamorig:LeftFoot",
      leftToes: "mixamorig:LeftToeBase",
    },
  },
  // three drops the colon from node names; a second Mixamo rig in one file is mixamorig1.
  "Mixamo, as three names it": {
    names: ["mixamorig1Hips", "mixamorig1Spine", "mixamorig1Head", "mixamorig1LeftArm", "mixamorig1LeftForeArm"],
    expect: { hips: "mixamorig1Hips", head: "mixamorig1Head", leftLowerArm: "mixamorig1LeftForeArm" },
  },
  VRoid: {
    names: [
      "J_Bip_C_Hips",
      "J_Bip_C_Spine",
      "J_Bip_C_Chest",
      "J_Bip_C_UpperChest",
      "J_Bip_C_Neck",
      "J_Bip_C_Head",
      "J_Bip_L_UpperArm",
      "J_Bip_L_LowerArm",
      "J_Bip_R_UpperArm",
      "J_Bip_R_LowerArm",
      "J_Bip_L_ToeBase",
      "J_Sec_L_Bust1",
      "J_Adj_L_FaceEye",
      "J_Bip_L_Index1",
    ],
    expect: { upperChest: "J_Bip_C_UpperChest", rightLowerArm: "J_Bip_R_LowerArm", leftToes: "J_Bip_L_ToeBase" },
  },
  "Unity humanoid": {
    names: ["Hips", "Spine", "Chest", "UpperChest", "Neck", "Head", "LeftUpperArm", "LeftLowerArm", "RightUpperArm"],
    expect: { chest: "Chest", leftUpperArm: "LeftUpperArm", leftLowerArm: "LeftLowerArm" },
  },
  "Blender, with the armature's name": {
    names: [
      "Armature|hips",
      "Armature|spine",
      "Armature|head",
      "Armature|upper_arm.L",
      "Armature|upper_arm.L.001",
      "Armature|forearm.L",
      "Armature|upper_arm.R",
      "Armature|forearm.R",
      "Armature|thigh.L",
      "Armature|shin.L",
      "Armature|DEF-upper_arm.L",
      "Armature|MCH-forearm_ik.L",
    ],
    expect: {
      leftUpperArm: "Armature|upper_arm.L",
      rightLowerArm: "Armature|forearm.R",
      leftLowerLeg: "Armature|shin.L",
    },
  },
  "Unreal mannequin": {
    names: [
      "root",
      "pelvis",
      "spine_01",
      "spine_02",
      "spine_03",
      "clavicle_l",
      "upperarm_l",
      "upperarm_twist_01_l",
      "lowerarm_l",
      "upperarm_r",
      "lowerarm_r",
      "neck_01",
      "head",
      "thigh_l",
      "calf_l",
      "ball_l",
      "ik_foot_root",
    ],
    expect: {
      hips: "pelvis",
      spine: "spine_01",
      upperChest: "spine_03",
      leftShoulder: "clavicle_l",
      leftUpperArm: "upperarm_l",
      leftLowerLeg: "calf_l",
      leftToes: "ball_l",
    },
  },
  "3ds Max Biped": {
    names: [
      "Bip01",
      "Bip01 Pelvis",
      "Bip01 Spine",
      "Bip01 Spine1",
      "Bip01 Head",
      "Bip01 L Clavicle",
      "Bip01 L UpperArm",
      "Bip01 L Forearm",
      "Bip01 R UpperArm",
      "Bip01 R Forearm",
      "Bip01 L Thigh",
      "Bip01 L Calf",
    ],
    expect: {
      hips: "Bip01 Pelvis",
      chest: "Bip01 Spine1",
      leftShoulder: "Bip01 L Clavicle",
      leftUpperLeg: "Bip01 L Thigh",
    },
  },
  "Maya HumanIK": {
    names: ["Character1_Hips", "Character1_Spine", "Character1_Head", "Character1_LeftArm", "Character1_LeftForeArm"],
    expect: { hips: "Character1_Hips", leftUpperArm: "Character1_LeftArm" },
  },
  "Character Creator": {
    names: [
      "CC_Base_BoneRoot",
      "CC_Base_Hip",
      "CC_Base_Pelvis",
      "CC_Base_Waist",
      "CC_Base_Spine01",
      "CC_Base_NeckTwist01",
      "CC_Base_NeckTwist02",
      "CC_Base_Head",
      "CC_Base_L_Upperarm",
      "CC_Base_L_UpperarmTwist01",
      "CC_Base_L_Forearm",
    ],
    expect: {
      hips: "CC_Base_Hip",
      spine: "CC_Base_Waist",
      neck: "CC_Base_NeckTwist01",
      leftUpperArm: "CC_Base_L_Upperarm",
    },
  },
  "DAZ Genesis": {
    names: [
      "hip",
      "pelvis",
      "abdomenLower",
      "chestUpper",
      "neckLower",
      "head",
      "lCollar",
      "lShldrBend",
      "lShldrTwist",
      "lForearmBend",
      "rShldrBend",
      "lThighBend",
      "lShin",
    ],
    expect: {
      hips: "hip",
      leftShoulder: "lCollar",
      leftUpperArm: "lShldrBend",
      leftLowerArm: "lForearmBend",
      leftLowerLeg: "lShin",
    },
  },
  "Source engine": {
    names: [
      "ValveBiped.Bip01_Pelvis",
      "ValveBiped.Bip01_Spine",
      "ValveBiped.Bip01_Head1",
      "ValveBiped.Bip01_L_UpperArm",
      "ValveBiped.Bip01_L_Forearm",
    ],
    expect: {
      hips: "ValveBiped.Bip01_Pelvis",
      head: "ValveBiped.Bip01_Head1",
      leftLowerArm: "ValveBiped.Bip01_L_Forearm",
    },
  },
};
for (const [rig, { names, expect }] of Object.entries(rigs)) {
  const { bones } = matchAvatarHumanoidBones(names);
  for (const [bone, name] of Object.entries(expect)) assert.equal(bones[bone as never], name, `${rig}: ${bone}`);
  // Helper, twist, finger and end bones never stand in for a body bone (Character Creator's neck is NeckTwist).
  for (const name of Object.values(bones)) {
    const helper = /End|Thumb|Index|(?<!Neck)Twist|twist_|ik_|MCH|DEF|\.001|Bust|FaceEye|BoneRoot/u;
    assert.doesNotMatch(name!, helper, `${rig}: ${name}`);
  }
}
assert.deepEqual(matchAvatarHumanoidBones(rigs.Mixamo!.names).missing, []);
assert.deepEqual(
  matchAvatarHumanoidBones(["Bone", "Bone.001", "Cube"]).missing,
  [...BODY],
  "a generic rig is unmatched",
);
assert.deepEqual(
  matchAvatarHumanoidBones(["Root", "Spine", "Head", "Tail", "FrontLeg.L", "FrontLeg.R"]).missing,
  ["hips", "leftUpperArm", "leftLowerArm", "rightUpperArm", "rightLowerArm"],
  "a four-legged rig has no arms to pose",
);
assert.equal(matchAvatarHumanoidBones([`${"x".repeat(300)}Hips`]).bones.hips, undefined, "an overlong name is skipped");
assert.equal(matchAvatarHumanoidBones(["LeftRightArm"]).bones.leftUpperArm, undefined, "two sides in one name");

// ── Blend shape pairs ──
assert.deepEqual(pairedAvatarMorphNames(["eyeBlinkLeft", "eyeBlinkRight", "jawOpen"]), ["eyeBlink"]);
assert.deepEqual(pairedAvatarMorphNames(["Blink_L", "Blink_R", "Wink_L"]), ["Blink"], "one side alone is no pair");
assert.deepEqual(pairedAvatarMorphNames(["blink", "blink_L", "blink_R"]), [], "a name the model has isn't added");

// ── Import: GLB ──
const glb = plainGlb();
const glbValidated = await glbFbxImporter.validate(input(glb));
const glbImport = await glbFbxImporter.extract(glbValidated, input(glb));
assert.equal(glbImport.kind, "glb-fbx");
assert.deepEqual(
  glbImport.files.map((file) => file.path),
  [GLB_MODEL_FILE],
);
const glbData = glbImport.data;
assert.equal(glbData.format, "glb");
assert.equal(glbData.bones.hips, "mixamorig:Hips", "the GLB's own node names, from its skin's joints");
assert.equal(glbData.bones.leftUpperArm, "mixamorig:LeftArm");
assert.equal(glbData.bones.upperChest, "mixamorig:Spine2");
assert.deepEqual(glbData.expressionNames, [...PLAIN_GLB_MORPHS, "eyeBlink"]);
assert.equal(glbData.expressionMap.aa?.target, "viseme_aa", "an Oculus viseme is the open mouth");
assert.equal(glbData.expressionMap.happy?.target, "mouthSmile", "a smiling mouth is happy when nothing says happy");
assert.equal(glbData.expressionMap.blink?.target, "eyeBlink", "ARKit's eye pair blinks together");
assert.equal(glbData.expressionMap.sad?.source, "missing");
assert.deepEqual(glbImport.warnings, [
  "Some faces or mouth shapes have no matching blend shape. You can pick them in setup.",
]);
const stored = {
  ...createAvatarConfig(owner, new Date().toISOString()),
  activeKind: "glb-fbx",
  kinds: { "glb-fbx": glbData },
};
assert.ok(avatarConfigSchema.safeParse(stored).success, "the import fits avatar.json");
assert.equal(
  avatarConfigSchema.safeParse({ ...stored, kinds: { "glb-fbx": { ...glbData, format: "fbx" } } }).success,
  false,
  "a file's extension must match its format",
);
assert.equal(
  avatarConfigSchema.safeParse({ ...stored, kinds: { "glb-fbx": { ...glbData, bones: { tail: "Tail" } } } }).success,
  false,
  "only humanoid bones are stored",
);

await refused(
  tripoMadeVrm(),
  "model.glb",
  "unsupported-format",
  /This is a VRM model\. Import it as a VRM model/u,
  "a VRM named .glb",
);
await refused(
  unnamedRigGlb(),
  "model.glb",
  "invalid-file",
  /can't be matched to a human body: it has no hips, spine, head, left upper arm, left lower arm, right upper arm or right lower arm bone/u,
  "a rig whose bones say nothing",
);
{
  const { json, bin } = decodeGlb(glb);
  const { encodeGlb } = await import("./fixtures/avatar-glb-fbx-fixtures.js");
  await refused(
    encodeGlb({ asset: { version: "2.0" }, scenes: [{ nodes: [] }], scene: 0 }, Buffer.alloc(0)),
    "model.glb",
    "invalid-file",
    /no skeleton, so it can't move/u,
    "a model with no nodes",
  );
  await refused(
    encodeGlb({ ...json, images: [{ uri: "https://example.com/skin.png" }] }, bin),
    "model.glb",
    "unsupported-format",
    /points to files outside itself\. Export it again as a single \.glb file/u,
    "a picture the browser would fetch from elsewhere",
  );
  await refused(
    encodeGlb({ ...json, extensionsUsed: ["KHR_draco_mesh_compression"] }, bin),
    "model.glb",
    "unsupported-format",
    /compression avatars can't load \(Draco\)/u,
    "Draco",
  );
}
await refused(
  Buffer.from("These are notes, not a model at all."),
  "model.glb",
  "unsupported-format",
  /isn't a GLB or FBX file/u,
  "text",
);

// ── Import: FBX ──
for (const [label, bytes] of [
  ["binary FBX", fbxRig()],
  ["ASCII FBX", asciiFbxRig()],
] as const) {
  const validated = await glbFbxImporter.validate(input(bytes, "Character.fbx"));
  const imported = await glbFbxImporter.extract(validated, input(bytes, "Character.fbx"));
  assert.equal(imported.data.file, FBX_MODEL_FILE, label);
  assert.equal(imported.data.format, "fbx", label);
  for (const bone of BODY) assert.ok(imported.data.bones[bone], `${label}: ${bone}`);
  assert.equal(imported.data.bones.head, "mixamorig:Head", `${label}: the FBX's own names, with the colon`);
  assert.equal(imported.data.bones.leftLowerArm, "mixamorig:LeftForeArm", label);
  assert.deepEqual(imported.data.expressionNames, ["Fcl_MTH_A", "eyeBlink_L", "eyeBlink_R", "eyeBlink"], label);
  assert.equal(imported.data.expressionMap.aa?.target, "Fcl_MTH_A", `${label}: a VRoid FBX mouth`);
  assert.equal(imported.data.expressionMap.blink?.target, "eyeBlink", label);
  assert.ok(!imported.warnings.some((warning) => /textures/u.test(warning)), `${label}: no textures to warn about`);
}
{
  const imported = await glbFbxImporter.extract(
    await glbFbxImporter.validate(input(fbxRig({ texture: true }), "a.fbx")),
    input(fbxRig({ texture: true }), "a.fbx"),
  );
  assert.ok(
    imported.warnings.includes(
      "This model's textures aren't inside the FBX file, so it shows without them. Export it again with Embed Media (or Embed Textures) turned on.",
    ),
  );
}
await refused(
  fbxRig({ version: 6100 }),
  "old.fbx",
  "unsupported-format",
  /too old \(version 6100\)\. Export it again as FBX 2014/u,
  "FBX 6",
);
await refused(
  Buffer.from("PK\u0003\u0004zip"),
  "model.fbx",
  "unsupported-format",
  /isn't an FBX model avatars can read/u,
  "not an FBX",
);
// A hostile file can't keep the import busy: every `\0\x01Model` counts toward the limit, named or not.
{
  const binary = fbxRig().subarray(0, 27);
  await refused(
    Buffer.concat([binary, Buffer.from("\0\u0001Model".repeat(30_000), "latin1")]),
    "many.fbx",
    "invalid-file",
    /far more parts than any avatar needs/u,
    "bare object markers",
  );
  // ASCII indentation never crosses a line end, so a long run of blank lines is read once, not once per line.
  const started = performance.now();
  await refused(
    Buffer.from(`; FBX 7.4.0 project file\nFBXHeaderExtension:  {\n\tFBXVersion: 7400\n}\n${"\n".repeat(200_000)}`),
    "blank.fbx",
    "invalid-file",
    /no skeleton/u,
    "blank lines",
  );
  assert.ok(performance.now() - started < 2000, "blank lines are scanned in linear time");
}

// ── Which importer claims a file ──
const head = (bytes: Uint8Array) => bytes.subarray(0, 64 * 1024);
assert.equal(findAvatarImporter({ filename: "model.glb", head: head(glb) }, "glb-fbx"), glbFbxImporter);
assert.equal(findAvatarImporter({ filename: "model.fbx", head: head(fbxRig()) }), glbFbxImporter);
assert.equal(
  findAvatarImporter({ filename: "model.vrm", head: head(glb) }, "glb-fbx"),
  null,
  "a .vrm is not a plain GLB",
);
assert.equal(findAvatarImporter({ filename: "model.glb", head: head(glb) }), vrmImporter, "no kind: the VRM importer");
await assert.rejects(
  vrmImporter.validate(input(glb)),
  /plain 3D model, not a VRM\. Import it as a GLB or FBX model instead/u,
  "and it says where a plain model goes",
);

// ── The import route stores and serves both formats ──
{
  const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
  const Fastify = requireServer("fastify") as typeof import("fastify").default;
  const multipart = requireServer("@fastify/multipart") as typeof import("@fastify/multipart").default;
  const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
  const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
  const { avatarModelsRoutes } = await import("../../packages/server/src/routes/avatar-models.routes.js");
  const { avatarOwnerDir } = await import("../../packages/server/src/services/avatars/storage.js");
  const db = await getDB();
  const app = Fastify();
  app.decorate("db", db);
  await app.register(multipart, { limits: { fileSize: 256 * 1024 * 1024 } });
  await app.register(avatarModelsRoutes, { prefix: "/api/avatar-models" });
  await app.ready();
  const upload = (kind: string, name: string, bytes: Buffer) => {
    const boundary = "----avatar-glb-fbx-regression";
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\n${kind}\r\n`),
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
      ),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return { payload, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
  };
  try {
    const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Rigged" }));
    assert(character);
    const base = `/api/avatar-models/character/${character.id}`;
    const characterOwner = { ownerType: "character", ownerId: character.id } as const;
    const glbResponse = await app.inject({
      method: "POST",
      url: `${base}/import`,
      ...upload("glb-fbx", "Hero.glb", glb),
    });
    assert.equal(glbResponse.statusCode, 200, glbResponse.body);
    assert.equal(glbResponse.json().config.activeKind, "glb-fbx");
    const served = await app.inject({ method: "GET", url: `${base}/files/glb-fbx/model.glb` });
    assert.equal(served.statusCode, 200);
    assert.equal(served.headers["content-type"], "model/gltf-binary");
    assert.equal(served.rawPayload.length, glb.length);
    const folder = join(avatarOwnerDir(characterOwner), "glb-fbx");
    writeFileSync(join(folder, "fake.glb"), "<script>alert(1)</script>");
    writeFileSync(join(folder, "fake.fbx"), "<script>alert(1)</script>");
    for (const fake of ["fake.glb", "fake.fbx"]) {
      assert.equal((await app.inject({ method: "GET", url: `${base}/files/glb-fbx/${fake}` })).statusCode, 404, fake);
    }
    const unmatched = await app.inject({
      method: "POST",
      url: `${base}/import`,
      ...upload("glb-fbx", "Blob.glb", unnamedRigGlb()),
    });
    assert.equal(unmatched.statusCode, 400);
    assert.match(unmatched.json().error, /can't be matched to a human body/u, "the refusal reaches setup as it is");
    const fbxResponse = await app.inject({
      method: "POST",
      url: `${base}/import`,
      ...upload("glb-fbx", "Hero.fbx", fbxRig()),
    });
    assert.equal(fbxResponse.statusCode, 200, fbxResponse.body);
    assert.equal(fbxResponse.json().config.kinds["glb-fbx"].file, FBX_MODEL_FILE);
    const fbxServed = await app.inject({ method: "GET", url: `${base}/files/glb-fbx/model.fbx` });
    assert.equal(fbxServed.statusCode, 200);
    assert.equal(fbxServed.headers["content-type"], "application/octet-stream");
    assert.equal(existsSync(join(folder, "model.glb")), false, "the replaced GLB is removed");
  } finally {
    await app.close();
    await closeDB();
  }
}

// ── The stage's loaders build a humanoid from the stored names ──
{
  const { loadGlbFbxModel, buildGlbFbxModel } =
    await import("../../packages/client/src/features/avatars/renderers/glb-fbx/glb-fbx-renderer.js");
  const motion = await import("../../packages/client/src/features/avatars/renderers/vrm/vrm-motion.js");
  const requireClient = createRequire(new URL("../../packages/client/package.json", import.meta.url));
  const { FBXLoader } = await import(requireClient.resolve("three/addons/loaders/FBXLoader.js"));
  type Point = { x: number; y: number; z: number; sub(other: Point): Point; normalize(): Point };
  type Bone = {
    name: string;
    position: { clone(): Point };
    quaternion: { clone(): { angleTo(other: unknown): number } };
    getWorldPosition<T>(target: T): T;
    getWorldQuaternion<T>(target: T): T;
  };
  type Model = {
    humanoid: {
      getRawBoneNode(bone: string): Bone | null;
      getNormalizedBoneNode(bone: string): { rotation: { set(x: number, y: number, z: number): void } } | null;
    };
    expressionManager?: { getExpression(name: string): unknown; setValue(name: string, weight: number): void };
    update(dt: number): void;
    scene: { traverse(visit: (object: Record<string, any>) => void): void };
  };
  // Vectors come from the model's own three, so no second copy of three loads.
  const world = (bone: Bone) => bone.getWorldPosition(bone.position.clone());
  const at = (model: Model, bone: string) => world(model.humanoid.getRawBoneNode(bone)!);
  const armDirection = (model: Model, side: "left" | "right") =>
    at(model, `${side}LowerArm`)
      .sub(at(model, `${side}UpperArm`))
      .normalize();
  const idle = { emotion: "neutral", emotionWeight: 0, viseme: null, mouthOpen: 0, state: "idle" } as const;
  const headTurns = (model: Model) => {
    const head = model.humanoid.getRawBoneNode("head")!;
    const state = motion.createIdleMotionState();
    const turn = (step: number) => {
      const pose = motion.computeBodyPose(state, step / 30, idle, true, 1 / 30, true);
      for (const bone of motion.POSE_BONES) model.humanoid.getNormalizedBoneNode(bone)?.rotation.set(...pose[bone]);
      model.update(1 / 30);
      return head.getWorldQuaternion(head.quaternion.clone());
    };
    const start = turn(0);
    let most = 0;
    for (let step = 1; step <= 90; step += 1) most = Math.max(most, start.angleTo(turn(step)));
    return most;
  };

  // GLB, through the API as the stage loads it. Pictures load as images (Node plays the browser's img).
  class PageImage extends EventTarget {
    crossOrigin: string | null = null;
    set src(_url: string) {
      setTimeout(() => this.dispatchEvent(new Event("load")));
    }
  }
  const realFetch = globalThis.fetch;
  Object.assign(globalThis, {
    self: globalThis,
    document: { createElementNS: () => new PageImage() },
  });
  globalThis.fetch = (async () => new Response(glb)) as typeof fetch;
  try {
    const loaded = await loadGlbFbxModel(owner, glbData, new AbortController().signal);
    const model = loaded.model as unknown as Model;
    assert.equal(loaded.mirror, 1, "the fixture faces the camera");
    assert.equal(model.humanoid.getRawBoneNode("head")!.name, "mixamorigHead", "the stored name finds three's node");
    for (const bone of BODY) assert.ok(model.humanoid.getRawBoneNode(bone), `GLB: ${bone}`);
    assert.ok(at(model, "leftUpperArm").x > at(model, "rightUpperArm").x, "its left arm is on the camera's right");
    assert.ok(Math.abs(at(model, "head").y - at(model, "hips").y - 0.5) < 1e-6, "a person's size");
    assert.ok(Math.abs(at(model, "hips").x) < 1e-6 && Math.abs(at(model, "hips").z) < 1e-6, "centred");
    assert.ok(headTurns(model) > 0.03, "the idle pose turns the head through three-vrm's normalized bones");

    const meshes: Array<{ morphTargetDictionary: Record<string, number>; morphTargetInfluences: number[] }> = [];
    model.scene.traverse((object) => {
      if (object.isMesh && object.morphTargetDictionary) meshes.push(object as never);
    });
    assert.equal(meshes.length, 1);
    const [mesh] = meshes;
    const expressions = model.expressionManager!;
    for (const name of ["viseme_aa", "mouthSmile", "eyeBlink"]) assert.ok(expressions.getExpression(name), name);
    assert.equal(expressions.getExpression("sad"), null, "an unbound face has no expression");
    expressions.setValue("viseme_aa", 0.75);
    expressions.setValue("eyeBlink", 1);
    model.update(0);
    assert.equal(mesh!.morphTargetInfluences[mesh!.morphTargetDictionary.viseme_aa!], 0.75, "the mouth opens");
    assert.equal(mesh!.morphTargetInfluences[mesh!.morphTargetDictionary.eyeBlinkLeft!], 1, "the left eye closes");
    assert.equal(mesh!.morphTargetInfluences[mesh!.morphTargetDictionary.eyeBlinkRight!], 1, "and so does the right");
    assert.equal(mesh!.morphTargetInfluences[mesh!.morphTargetDictionary.mouthSmile!], 0);

    await assert.rejects(
      loadGlbFbxModel(
        owner,
        { ...glbData, bones: { ...glbData.bones, head: "mixamorig:Missing" } },
        new AbortController().signal,
      ),
      /This model has no head bone any more\. Import it again\./u,
      "a stored bone the file no longer has",
    );
  } finally {
    globalThis.fetch = realFetch;
  }

  // FBX: a centimetre rig facing away, in an A-pose.
  const fbx = fbxRig();
  const fbxData = (
    await glbFbxImporter.extract(await glbFbxImporter.validate(input(fbx, "a.fbx")), input(fbx, "a.fbx"))
  ).data;
  const group = new FBXLoader().parse(fbx.buffer.slice(fbx.byteOffset, fbx.byteOffset + fbx.byteLength), "");
  const before = (name: string) => {
    let found: Bone | null = null;
    group.updateMatrixWorld(true);
    group.traverse((object: { userData: { originalName?: string } }) => {
      if (!found && object.userData.originalName === name) found = object as never;
    });
    return world(found!);
  };
  const restDrop = before("mixamorig:LeftForeArm").sub(before("mixamorig:LeftArm")).normalize().y;
  assert.ok(restDrop < -0.6, "the fixture's arms hang in an A-pose");
  assert.ok(before("mixamorig:LeftArm").x < before("mixamorig:RightArm").x, "and it faces away");
  const built = buildGlbFbxModel(
    group,
    fbxData,
    (object: { userData: { originalName?: string } }) => object.userData.originalName,
  );
  const model = built.model as unknown as Model;
  assert.equal(built.mirror, -1, "a model facing -Z flips its poses, like VRM 0.x");
  assert.ok(at(model, "leftUpperArm").x > at(model, "rightUpperArm").x, "and is turned to face the camera");
  assert.ok(Math.abs(at(model, "head").y - at(model, "hips").y - 0.5) < 1e-6, "centimetres become a person's size");
  for (const side of ["left", "right"] as const) {
    assert.ok(Math.abs(armDirection(model, side).y) < 1e-6, `${side} arm straightened out to a T-pose`);
  }
  assert.ok(headTurns(model) > 0.03, "the FBX head turns too");
  assert.equal(model.expressionManager?.getExpression("Fcl_MTH_A") ?? null, null, "no mesh, so no blend shapes bind");
  // Arms down from the T-pose: the posed left hand hangs below its shoulder.
  const pose = motion.computeBodyPose(motion.createIdleMotionState(), 0, idle, false, 0);
  for (const bone of motion.POSE_BONES) {
    const [x, y, z] = pose[bone];
    model.humanoid.getNormalizedBoneNode(bone)?.rotation.set(x * built.mirror, y, z * built.mirror);
  }
  model.update(0);
  assert.ok(armDirection(model, "left").y < -0.8, "the resting pose lowers the arms, mirrored for a model facing -Z");
  assert.ok(armDirection(model, "right").y < -0.8);
}

rmSync(dir, { recursive: true, force: true });
console.log("avatar GLB/FBX regression passed");
