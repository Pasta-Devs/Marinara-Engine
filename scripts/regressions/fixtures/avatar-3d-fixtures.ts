// A 3D avatar as the one-click Tripo generator saved it, for checking that such models keep loading after the
// generator was withdrawn (maintainer decision, 2026-10-19: Tripo models have no face rig). tripo-made-avatar.vrm
// was written once by that generator's converter (glb-to-vrm.ts, removed with it) from a Tripo-shaped model
// built in code, so no file from Tripo itself is committed: a body-only VRM 1.0 model named "Maukie" by
// "Tripo AI", with a Mixamo skeleton under an unmapped Root turned to face +Z, one skinned mesh with one plain
// PBR material whose normal, colour and metal/roughness maps are embedded 8×8 pictures, and no face shapes,
// jaw or eye bones. Each body part is a flat panel facing forward and moving with one bone, so a browser can see
// the colour and the motion. expressiveVrm() adds a face to it in code, for the voice and mood timeline.
import { readFileSync } from "node:fs";

export type Rgb = [number, number, number];

/** The colour map's one colour. */
export const TRIPO_MADE_VRM_COLOUR: Rgb = [200, 60, 40];

/** The model file, as the 3D Avatars page saved it. */
export function tripoMadeVrm(): Buffer {
  return readFileSync(new URL("./tripo-made-avatar.vrm", import.meta.url));
}

/** The same model with a face, built in code: VRM 1.0 preset expressions for the six feelings, the five mouth
 *  shapes and blinking. Feelings tint the material's glow (happy green, sad blue, angry red), so a picture shows
 *  them; mouth shapes and blinking move the texture, which is one colour, so they show nothing but still count as
 *  bound. */
export function expressiveVrm(): Buffer {
  const model = tripoMadeVrm();
  const jsonLength = model.readUInt32LE(12);
  const gltf = JSON.parse(model.subarray(20, 20 + jsonLength).toString("utf8"));
  const glow = (r: number, g: number, b: number) => ({
    materialColorBinds: [{ material: 0, type: "emissionColor", targetValue: [r, g, b] }],
  });
  const shift = { textureTransformBinds: [{ material: 0, scale: [1, 1], offset: [0.5, 0] }] };
  gltf.extensions.VRMC_vrm.expressions = {
    preset: {
      happy: glow(0, 1, 0),
      sad: glow(0, 0, 1),
      angry: glow(1, 0, 0),
      relaxed: glow(0, 0.5, 0.5),
      surprised: glow(1, 1, 0),
      aa: shift,
      ih: shift,
      ou: shift,
      ee: shift,
      oh: shift,
      blink: shift,
    },
  };
  let json = Buffer.from(JSON.stringify(gltf), "utf8");
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const rest = model.subarray(20 + jsonLength);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + json.length + rest.length, 8);
  header.writeUInt32LE(json.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, json, rest]);
}
