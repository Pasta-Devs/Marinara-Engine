// Synthetic face and seven whole-face changes, drawn from SVG. No private or licensed artwork.
import { getSharp } from "../../../packages/server/src/services/image/sharp-runtime.js";
import {
  MESH_DRAWN_PICTURE_KEYS,
  type MeshDrawnPictureKey,
  type MeshLayerSource,
} from "../../../packages/server/src/services/avatars/generation/mesh-layer-builder.js";
import type { MeshRigLayout } from "../../../packages/server/src/services/avatars/generation/mesh-rig-layout.js";

const WIDTH = 240;
const HEIGHT = 300;

function svg(key?: MeshDrawnPictureKey): Buffer {
  const eye = (cx: number) => {
    if (key === "eyes_closed")
      return `<path d="M${cx - 13} 114 Q${cx} 121 ${cx + 13} 114" fill="none" stroke="#292026" stroke-width="3"/>`;
    if (key === "eyes_smile")
      return `<path d="M${cx - 13} 115 Q${cx} 103 ${cx + 13} 115" fill="none" stroke="#292026" stroke-width="3"/>`;
    const half = key === "eyes_half";
    return `<ellipse cx="${cx}" cy="112" rx="12" ry="${half ? 3 : 7}" fill="#fbf7f2"/><ellipse cx="${cx}" cy="112" rx="4" ry="${half ? 2 : 6}" fill="#426a9e"/><path d="M${cx - 14} ${half ? 110 : 111} Q${cx} ${half ? 108 : 100} ${cx + 14} ${half ? 110 : 111}" fill="none" stroke="#292026" stroke-width="3"/>`;
  };
  const mouths: Record<string, string> = {
    mouth_a: '<ellipse cx="120" cy="170" rx="11" ry="13" fill="#6d2934"/>',
    mouth_i:
      '<rect x="105" y="164" width="30" height="9" rx="4" fill="#6d2934"/><path d="M108 166 H132" stroke="#f1e6d9" stroke-width="3"/>',
    mouth_o: '<ellipse cx="120" cy="169" rx="6" ry="11" fill="#6d2934"/>',
    mouth_a_half: '<ellipse cx="120" cy="169" rx="10" ry="6" fill="#6d2934"/>',
  };
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <path d="M20 300 L45 237 Q120 210 195 237 L220 300 Z" fill="#35577b"/>
    <rect x="105" y="190" width="30" height="54" fill="#edc8aa"/>
    <ellipse cx="120" cy="100" rx="80" ry="90" fill="#493326"/>
    <ellipse cx="120" cy="130" rx="65" ry="83" fill="#edc8aa"/>
    <path d="M74 90 H103 M137 90 H166" stroke="#4d312b" stroke-width="4"/>
    ${eye(90)}${eye(150)}
    <path d="M119 135 L116 145 L122 145" fill="none" stroke="#c39275" stroke-width="2"/>
    ${key && mouths[key] ? mouths[key] : '<path d="M108 168 Q120 172 132 168" fill="none" stroke="#9e505a" stroke-width="2"/>'}
    <path d="M105 250 L120 260 L135 250" fill="none" stroke="#c4a060" stroke-width="4"/>
  </svg>`);
}

export async function meshDrawnFaceFixture(): Promise<{
  source: MeshLayerSource;
  pictures: Record<MeshDrawnPictureKey, Buffer>;
  layout: MeshRigLayout;
}> {
  const sharp = await getSharp();
  const png = await sharp(svg()).png().toBuffer();
  const pictures = Object.fromEntries(
    await Promise.all(MESH_DRAWN_PICTURE_KEYS.map(async (key) => [key, await sharp(svg(key)).png().toBuffer()])),
  ) as Record<MeshDrawnPictureKey, Buffer>;
  return {
    source: { png, width: WIDTH, height: HEIGHT },
    pictures,
    layout: {
      headBox: [38, 8, 202, 218],
      faceBox: [54, 44, 186, 214],
      eyes: [
        { opening: [78, 105, 102, 119], region: [73, 98, 107, 124] },
        { opening: [138, 105, 162, 119], region: [133, 98, 167, 124] },
      ],
      brows: [
        [72, 86, 104, 94],
        [136, 86, 168, 94],
      ],
      nose: [120, 140],
      mouth: { left: [108, 168], right: [132, 168], box: [106, 165, 134, 174] },
      neck: [120, 225],
    },
  };
}
