// ──────────────────────────────────────────────
// Avatar renderer: plain GLB and FBX models (lane: 3D)
// ──────────────────────────────────────────────
// three's GLTFLoader or FBXLoader loads the stored model; the bones the importer matched by name
// (GlbFbxAvatarData.bones) become three-vrm's humanoid and the bound blend shapes become its expressions, so the
// shared VRM renderer poses, blinks and lip-syncs the model exactly as it does a VRM. Before the humanoid is
// built, the arms are straightened out sideways (VRM poses start from a T-pose, many models rest in an A-pose);
// afterwards the model is turned to face the camera, scaled to a person's size and centred.
import { Group, Quaternion, Vector3, type Mesh, type Object3D } from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import {
  VRMCore,
  VRMExpression,
  VRMExpressionManager,
  VRMExpressionMorphTargetBind,
  VRMHumanoid,
  VRMUtils,
  type VRMHumanBones,
  type VRMMeta,
} from "@pixiv/three-vrm";
import {
  AVATAR_EXPRESSION_SLOTS,
  AVATAR_HUMANOID_BONES,
  AVATAR_REQUIRED_HUMANOID_BONES,
  avatarMorphSidelessName,
  type AvatarExpressionMap,
  type AvatarHumanoidBone,
  type AvatarOwnerRef,
  type GlbFbxAvatarData,
} from "@marinara-engine/shared";
import type { AvatarRenderer } from "../../contract";
import {
  createHumanoidAvatarRenderer,
  embeddedOnlyLoadingManager,
  fetchStoredModel,
  loadStoredGltf,
  type HumanoidModelSource,
  type LoadedHumanoidModel,
} from "../vrm/vrm-renderer";

/** An FBX picture outside the file draws white instead of black (the importer warns about it). */
const WHITE_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==";
/** Hips to head bone, in metres, for a model of any unit (an FBX from Mixamo is in centimetres). */
const HIPS_TO_HEAD = 0.5;
const META: VRMMeta = { metaVersion: "1", name: "", authors: [], licenseUrl: "" };

const worldA = new Vector3();
const worldB = new Vector3();
const turn = new Quaternion();
const parentTurn = new Quaternion();

/** The model's objects for each stored bone name: bones before other nodes, the first of each name. */
function findBones(
  root: Object3D,
  bones: GlbFbxAvatarData["bones"],
  originalName: (object: Object3D) => string | undefined,
): Partial<Record<AvatarHumanoidBone, Object3D>> {
  const byName = new Map<string, Object3D>();
  const others = new Map<string, Object3D>();
  root.traverse((object) => {
    const name = originalName(object) ?? object.name;
    const list = (object as { isBone?: boolean }).isBone ? byName : others;
    if (name && !list.has(name)) list.set(name, object);
  });
  const found: Partial<Record<AvatarHumanoidBone, Object3D>> = {};
  for (const bone of AVATAR_HUMANOID_BONES) {
    const name = bones[bone];
    const object = name ? (byName.get(name) ?? others.get(name)) : undefined;
    if (object) found[bone] = object;
  }
  return found;
}

/** Turns `bone` in world space so the direction from it to `child` becomes `goal`. */
function aimBone(bone: Object3D, child: Object3D | undefined, goal: Vector3): void {
  if (!child) return;
  const from = child.getWorldPosition(worldA).sub(bone.getWorldPosition(worldB));
  if (from.lengthSq() === 0) return;
  turn.setFromUnitVectors(from.normalize(), goal);
  parentTurn.identity();
  bone.parent?.getWorldQuaternion(parentTurn);
  // world' = turn × world; local' = parent⁻¹ × world'.
  bone.quaternion.premultiply(parentTurn).premultiply(turn).premultiply(parentTurn.invert());
  bone.updateMatrixWorld(true);
}

/** Straightens both arms out sideways (a T-pose, which VRM poses start from) and says which way the model
 *  faces: 1 when its left arm is on +X (it faces +Z, the camera), -1 when it faces away. */
function restInTPose(nodes: Partial<Record<AvatarHumanoidBone, Object3D>>): 1 | -1 {
  const left = nodes.leftUpperArm!.getWorldPosition(worldA).x;
  const right = nodes.rightUpperArm!.getWorldPosition(worldB).x;
  const facing = left >= right ? 1 : -1;
  for (const [side, sign] of [
    ["left", 1],
    ["right", -1],
  ] as const) {
    const goal = new Vector3(sign * facing, 0, 0);
    aimBone(nodes[`${side}UpperArm`]!, nodes[`${side}LowerArm`], goal);
    aimBone(nodes[`${side}LowerArm`]!, nodes[`${side}Hand`], goal);
  }
  return facing;
}

/** One expression per bound blend shape: every mesh's morph of that name, or of a left and right pair that
 *  share it (`eyeBlink` moves `eyeBlinkLeft` and `eyeBlinkRight`). Names no mesh has are left out. */
function buildExpressions(root: Object3D, map: AvatarExpressionMap): VRMExpressionManager {
  const meshes: Mesh[] = [];
  root.traverse((object) => {
    if ((object as Mesh).isMesh && (object as Mesh).morphTargetDictionary) meshes.push(object as Mesh);
  });
  const manager = new VRMExpressionManager();
  const names = new Set(AVATAR_EXPRESSION_SLOTS.flatMap((slot) => map[slot]?.target ?? []));
  for (const name of names) {
    const expression = new VRMExpression(name);
    for (const mesh of meshes) {
      const dictionary = mesh.morphTargetDictionary!;
      const exact = dictionary[name];
      const indices =
        exact !== undefined
          ? [exact]
          : Object.entries(dictionary).flatMap(([key, index]) =>
              avatarMorphSidelessName(key) === name ? [index] : [],
            );
      for (const index of indices) {
        expression.addBind(new VRMExpressionMorphTargetBind({ primitives: [mesh], index, weight: 1 }));
      }
    }
    if (expression.binds.length > 0) manager.registerExpression(expression);
  }
  return manager;
}

/** Builds a humanoid model from a loaded GLB or FBX scene and the stored bone names. */
export function buildGlbFbxModel(
  loaded: Object3D,
  data: Pick<GlbFbxAvatarData, "bones" | "expressionMap">,
  originalName: (object: Object3D) => string | undefined,
): LoadedHumanoidModel {
  // A fresh root at rest: three-vrm measures the bones in world space, which is this root's space.
  const root = new Group();
  root.add(loaded);
  root.updateMatrixWorld(true);
  const nodes = findBones(root, data.bones, originalName);
  const missing = AVATAR_REQUIRED_HUMANOID_BONES.filter((bone) => !nodes[bone]);
  if (missing.length > 0) {
    throw new Error(`This model has no ${missing.join(", ")} bone any more. Import it again.`);
  }
  const hipsToHead = nodes.head!.getWorldPosition(worldA).y - nodes.hips!.getWorldPosition(worldB).y;
  if (!(hipsToHead > 0)) throw new Error("This model's head isn't above its hips, so it can't stand up.");
  const facing = restInTPose(nodes);
  const humanoid = new VRMHumanoid(
    Object.fromEntries(Object.entries(nodes).map(([bone, node]) => [bone, { node }])) as VRMHumanBones,
  );
  root.add(humanoid.normalizedHumanBonesRoot);
  // Face the camera, at a person's size, centred: the root carries the model and its normalized bones alike.
  if (facing < 0) root.rotation.y = Math.PI;
  root.scale.setScalar(HIPS_TO_HEAD / hipsToHead);
  root.updateMatrixWorld(true);
  const hips = nodes.hips!.getWorldPosition(worldA);
  root.position.set(-hips.x, 0, -hips.z);
  root.updateMatrixWorld(true);
  const model = new VRMCore({
    scene: root,
    meta: META,
    humanoid,
    expressionManager: buildExpressions(root, data.expressionMap),
  });
  return { model, mirror: facing, expressionMap: data.expressionMap, idleAnimation: null };
}

/** Loads a stored GLB or FBX model and builds its humanoid, as the stage does. */
export async function loadGlbFbxModel(
  owner: AvatarOwnerRef,
  data: GlbFbxAvatarData,
  signal: AbortSignal,
): Promise<LoadedHumanoidModel> {
  let scene: Object3D;
  let originalName: (object: Object3D) => string | undefined;
  if (data.format === "glb") {
    const gltf = await loadStoredGltf(owner, data.file, signal);
    const nodes = (gltf.parser.json as { nodes?: Array<{ name?: unknown }> }).nodes ?? [];
    scene = gltf.scene;
    originalName = (object) => {
      const index = gltf.parser.associations.get(object)?.nodes;
      const name = index === undefined ? undefined : nodes[index]?.name;
      return typeof name === "string" ? name : undefined;
    };
  } else {
    const bytes = await fetchStoredModel(owner, data.file, signal);
    scene = new FBXLoader(embeddedOnlyLoadingManager(WHITE_PIXEL)).parse(bytes, "");
    originalName = (object) => object.userData.originalName as string | undefined;
  }
  try {
    return buildGlbFbxModel(scene, data, originalName);
  } catch (error) {
    VRMUtils.deepDispose(scene);
    throw error;
  }
}

const GLB_FBX_SOURCE: HumanoidModelSource = {
  kind: "glb-fbx",
  load(options, signal) {
    const data = options.config.kinds["glb-fbx"];
    if (!data) return Promise.reject(new Error("This avatar has no GLB or FBX model set up."));
    return loadGlbFbxModel(options.owner, data, signal);
  },
};

export function createAvatarRenderer(): AvatarRenderer {
  return createHumanoidAvatarRenderer(GLB_FBX_SOURCE);
}
