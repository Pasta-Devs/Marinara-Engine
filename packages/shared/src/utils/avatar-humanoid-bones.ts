// ──────────────────────────────────────────────
// 3D avatars: match a plain rig's bone and blend shape names (GLB and FBX models)
// ──────────────────────────────────────────────
// A GLB or FBX model has no VRM humanoid table, so its bones are matched by name: Mixamo (`mixamorig:LeftArm`),
// Unity humanoid (`LeftUpperArm`), VRoid (`J_Bip_L_UpperArm`), 3ds Max Biped (`Bip01 L UpperArm`), Unreal
// (`upperarm_l`), Maya HumanIK (`Character1_LeftArm`), Character Creator (`CC_Base_L_Upperarm`), DAZ Genesis
// (`lShldrBend`) and Blender's `.L`/`.R` sides. The server refuses a model whose required bones can't be found;
// the browser matches the same names again to drive the bones through three-vrm's humanoid. Names are compared
// as words after any namespace (`Armature|`, `Rig:`), so three's sanitized node names (`mixamorigLeftArm`)
// match the file's own (`mixamorig:LeftArm`).

/** The VRM humanoid bones a plain rig can fill, named as VRM 1.0 (and three-vrm) name them. */
export const AVATAR_HUMANOID_BONES = [
  "hips",
  "spine",
  "chest",
  "upperChest",
  "neck",
  "head",
  "leftShoulder",
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightShoulder",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "leftToes",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
  "rightToes",
] as const;
export type AvatarHumanoidBone = (typeof AVATAR_HUMANOID_BONES)[number];

/** Longest bone name stored for a humanoid bone; a longer name is never matched. */
export const AVATAR_BONE_NAME_MAX_LENGTH = 256;

/** The bones the avatar's poses turn (the body, the head and the arms); a rig without one can't be animated. */
export const AVATAR_REQUIRED_HUMANOID_BONES = [
  "hips",
  "spine",
  "head",
  "leftUpperArm",
  "leftLowerArm",
  "rightUpperArm",
  "rightLowerArm",
] as const satisfies readonly AvatarHumanoidBone[];
export type AvatarRequiredHumanoidBone = (typeof AVATAR_REQUIRED_HUMANOID_BONES)[number];

export interface AvatarHumanoidBoneMatch {
  /** The rig's own bone name for each humanoid bone it has. */
  bones: Partial<Record<AvatarHumanoidBone, string>>;
  /** Required bones no name matched; empty when the rig can be animated. */
  missing: AvatarRequiredHumanoidBone[];
}

type Side = "left" | "right";
type SidedPart = "Shoulder" | "UpperArm" | "LowerArm" | "Hand" | "UpperLeg" | "LowerLeg" | "Foot" | "Toes";
type Part =
  | { kind: "hips" | "head" | "neck"; priority: number }
  | { kind: "torso"; rank: number }
  | { kind: "sided"; part: SidedPart; priority: number };

/** Words that only say which rig or exporter a bone comes from. A number right after one is part of it
 *  (`mixamorig1`, `Bip01`). */
const RIG_PREFIX_WORDS = new Set([
  "mixamorig",
  "character",
  "j",
  "bip",
  "biped",
  "valve",
  "c",
  "def",
  "cc",
  "base",
  "armature",
]);
/** Helper bones that only steer others (Rigify's ORG and MCH, IK and control bones) or end a chain. */
const HELPER_WORDS = new Set(["org", "mch", "ik", "fk", "ctrl", "ctl", "pole", "target", "end", "nub"]);
const SIDE_WORDS: ReadonlyMap<string, Side> = new Map([
  ["l", "left"],
  ["left", "left"],
  ["r", "right"],
  ["right", "right"],
]);

/** Each bone's words joined, as the naming schemes spell them; earlier names in a list win a tie. */
const PARTS: ReadonlyMap<string, Part> = new Map<string, Part>([
  ...(["hips", "hip", "pelvis"] as const).map((key, priority): [string, Part] => [key, { kind: "hips", priority }]),
  ["head", { kind: "head", priority: 0 }],
  ...(["neck", "necklower", "necktwist"] as const).map((key, priority): [string, Part] => [
    key,
    { kind: "neck", priority },
  ]),
  // The spine from the hips up: the first three found become spine, chest and upper chest.
  ...(
    [
      ["waist", 0],
      ["abdomen", 1],
      ["abdomenlower", 1],
      ["abdomenupper", 2],
      ["spine", 10],
      ["chest", 20],
      ["chestlower", 20],
      ["upperchest", 21],
      ["chestupper", 21],
    ] as const
  ).map(([key, rank]): [string, Part] => [key, { kind: "torso", rank }]),
  ...(
    [
      ["Shoulder", ["shoulder", "clavicle", "collar"]],
      ["UpperArm", ["upperarm", "arm", "shldrbend", "shldr"]],
      ["LowerArm", ["lowerarm", "forearm", "forearmbend", "elbow"]],
      ["Hand", ["hand", "wrist"]],
      ["UpperLeg", ["upperleg", "upleg", "thigh", "thighbend"]],
      ["LowerLeg", ["lowerleg", "leg", "calf", "shin", "knee"]],
      ["Foot", ["foot", "ankle"]],
      ["Toes", ["toes", "toe", "ball"]],
    ] as const
  ).flatMap(([part, keys]) => keys.map((key, priority): [string, Part] => [key, { kind: "sided", part, priority }])),
]);

/** Lower-case words of a bone name: split at separators, at camelCase and between letters and digits. */
export function avatarBoneNameWords(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2")
    .replace(/([A-Za-z])(\d)/gu, "$1 $2")
    .replace(/(\d)([A-Za-z])/gu, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
}

interface ReadBone {
  part: Part;
  side: Side | null;
  index: number;
}

/** What one bone name says: its part, its side and its number (`Spine1`, `Head1`, `upper_arm.L.001`), or null. */
function readBoneName(name: string): ReadBone | null {
  let side: Side | null = null;
  let index: number | null = null;
  let afterPrefix = false;
  const words: string[] = [];
  // A namespace names the file or the rig, never the bone: `Armature|Hips`, `Rig:Hips`.
  const local = name.slice(Math.max(name.lastIndexOf(":"), name.lastIndexOf("|")) + 1);
  for (const word of avatarBoneNameWords(local)) {
    if (/^\d+$/u.test(word)) {
      if (!afterPrefix) {
        if (index !== null) return null;
        index = Number(word);
      }
      afterPrefix = false;
      continue;
    }
    afterPrefix = RIG_PREFIX_WORDS.has(word);
    if (afterPrefix) continue;
    if (HELPER_WORDS.has(word)) return null;
    const wordSide = SIDE_WORDS.get(word);
    if (wordSide) {
      if (side && side !== wordSide) return null;
      side = wordSide;
      continue;
    }
    // A number belongs at the end of a name (`spine_01`), never between its words.
    if (index !== null) return null;
    words.push(word);
  }
  let key = words.join("");
  let part = PARTS.get(key);
  if (!part && side === null) {
    // A side written into the word itself: `leftarm`, `upperarml`.
    const affixed = /^(left|right)(.+)$/u.exec(key) ?? /^(.+?)(left|right|l|r)$/u.exec(key);
    if (affixed) {
      const [, first, second] = affixed as unknown as [string, string, string];
      const [rest, sideWord] = SIDE_WORDS.has(first) ? [second, first] : [first, second];
      const sided = PARTS.get(rest);
      if (sided?.kind === "sided") {
        key = rest;
        part = sided;
        side = SIDE_WORDS.get(sideWord) ?? null;
      }
    }
  }
  if (!part || (part.kind === "sided") !== (side !== null)) return null;
  return { part, side, index: index ?? 0 };
}

/** Matches a rig's bone names to humanoid bones. Each humanoid bone takes the best-named match, the lowest
 *  number first and the earlier name on a tie; the spine's segments, ordered from the hips up, become spine,
 *  chest and upper chest. */
export function matchAvatarHumanoidBones(names: readonly string[]): AvatarHumanoidBoneMatch {
  const best = new Map<AvatarHumanoidBone, { name: string; score: number }>();
  const torso: Array<{ name: string; score: number; order: number }> = [];
  const offer = (bone: AvatarHumanoidBone, name: string, score: number) => {
    const current = best.get(bone);
    if (!current || score < current.score) best.set(bone, { name, score });
  };
  names.forEach((name, order) => {
    const read = name.length <= AVATAR_BONE_NAME_MAX_LENGTH ? readBoneName(name) : null;
    if (!read) return;
    const { part, side, index } = read;
    if (part.kind === "torso") torso.push({ name, score: part.rank + index, order });
    else offer(part.kind === "sided" ? `${side!}${part.part}` : part.kind, name, part.priority * 1000 + index);
  });
  torso.sort((left, right) => left.score - right.score || left.order - right.order);
  (["spine", "chest", "upperChest"] as const).forEach((bone, position) => {
    const segment = torso[position];
    if (segment) best.set(bone, segment);
  });
  const bones: Partial<Record<AvatarHumanoidBone, string>> = {};
  for (const bone of AVATAR_HUMANOID_BONES) {
    const match = best.get(bone);
    if (match) bones[bone] = match.name;
  }
  return { bones, missing: AVATAR_REQUIRED_HUMANOID_BONES.filter((bone) => !bones[bone]) };
}

// ── Blend shapes ──

const MORPH_SIDE_RE = /^(.+?)(?:[._ -]?(?:Left|Right|left|right|LEFT|RIGHT)|[._ -][LRlr])$/u;

/** A blend shape name without its side (`eyeBlinkLeft` → `eyeBlink`, `Blink_L` → `Blink`), or null. */
export function avatarMorphSidelessName(name: string): string | null {
  return MORPH_SIDE_RE.exec(name)?.[1] ?? null;
}

/** Names for left and right blend shapes that only come in pairs (ARKit's `eyeBlinkLeft` and `eyeBlinkRight`
 *  become `eyeBlink`), so one face slot can move both. A name the model already has is never added. */
export function pairedAvatarMorphNames(names: readonly string[]): string[] {
  const known = new Set(names);
  const sides = new Map<string, Set<string>>();
  for (const name of names) {
    const base = avatarMorphSidelessName(name);
    if (!base || known.has(base)) continue;
    const side = /left|[._ -]l$/iu.test(name.slice(base.length)) ? "left" : "right";
    sides.set(base, (sides.get(base) ?? new Set()).add(side));
  }
  return [...sides].filter(([, found]) => found.size === 2).map(([base]) => base);
}
