// ──────────────────────────────────────────────
// Avatar generation: the face layout a vision model reads from a sprite, and the rig built from it
// ──────────────────────────────────────────────
// The model answers with boxes and points (MESH_RIG_LAYOUT_SCHEMA_TEXT), which vision models place far
// more reliably than the 14-20 point outlines Mesh Avatar Studio asks a person or coding agent to trace.
// The answer is untrusted: it is parsed strictly, checked against the picture and against itself, and
// only then turned into a mesh-avatar version 1 rig (docs/rig-fields.md in shinshin86/mesh-avatar-studio,
// MIT) with the starting values that guide recommends.
import { z } from "zod";
import { tryParseJsonRecord } from "../../../lib/json-repair.js";

type Box = [number, number, number, number];
type Point = [number, number];

/** Picture size the runtime's painted mouth and the maker's mesh cells are calibrated for. */
export const MESH_RIG_REFERENCE_SIZE = 1254;

const finite = z.number().finite();
const box = z.tuple([finite, finite, finite, finite]);
const point = z.tuple([finite, finite]);

export const meshRigLayoutSchema = z
  .object({
    headBox: box,
    faceBox: box,
    eyes: z.array(z.object({ opening: box, region: box }).strict()).length(2),
    brows: z.array(box).length(2),
    nose: point,
    mouth: z.object({ left: point, right: point, box, bow: finite.optional() }).strict(),
    neck: point,
  })
  .strict();

export type MeshRigLayout = z.infer<typeof meshRigLayoutSchema>;

/** The `layoutSchema` template variable: the exact JSON shape the layer builder reads. */
export const MESH_RIG_LAYOUT_SCHEMA_TEXT = [
  '{"headBox":[x0,y0,x1,y1],"faceBox":[x0,y0,x1,y1],',
  '"eyes":[{"opening":[x0,y0,x1,y1],"region":[x0,y0,x1,y1]},{"opening":[x0,y0,x1,y1],"region":[x0,y0,x1,y1]}],',
  '"brows":[[x0,y0,x1,y1],[x0,y0,x1,y1]],"nose":[x,y],',
  '"mouth":{"left":[x,y],"right":[x,y],"box":[x0,y0,x1,y1]},"neck":[x,y]}',
  "",
  "All values are pixel coordinates in the picture you see: x grows to the right, y grows downward, (0,0) is the top-left corner. A box is [left, top, right, bottom].",
  "- headBox: the whole head including hair and anything worn on the head.",
  "- faceBox: the face from forehead to chin and cheek to cheek, without hair.",
  "- eyes: the eye on the picture's left first. opening: only the visible eye white and iris, inside the lashes. region: the eye with its lashes and lower lid line, a little larger than opening.",
  "- brows: the eyebrow on the picture's left first.",
  "- nose: the tip of the nose.",
  "- mouth: left and right are the corners of the lips; box surrounds the lips.",
  "- neck: the centre of the neck just below the chin.",
  "Faint grid lines every 50 pixels, labelled every 100, help you read positions; they are not part of the picture.",
].join("\n");

/** Pulls the JSON object out of a model answer (thinking blocks, code fences and chatter around it). */
export function extractLayoutJson(answer: string): Record<string, unknown> | null {
  const withoutThinking = answer.replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/giu, "");
  const start = withoutThinking.indexOf("{");
  const end = withoutThinking.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return tryParseJsonRecord(withoutThinking.slice(start, end + 1));
}

const boxWidth = (b: Box) => b[2] - b[0];
const boxHeight = (b: Box) => b[3] - b[1];
const boxCenter = (b: Box): Point => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
const insideBox = (p: Point, b: Box, slack = 0) =>
  p[0] >= b[0] - slack && p[0] <= b[2] + slack && p[1] >= b[1] - slack && p[1] <= b[3] + slack;
const containsBox = (outer: Box, inner: Box) =>
  inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3];
const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/** Parses and checks a layout against a picture of `width` x `height`. Returns the layout (eyes and
 *  brows put in left-to-right order) or plain reasons it can't be used. */
export function checkMeshRigLayout(
  value: unknown,
  width: number,
  height: number,
): { layout: MeshRigLayout; errors: [] } | { layout: null; errors: string[] } {
  const parsed = meshRigLayoutSchema.safeParse(value);
  if (!parsed.success) {
    return {
      layout: null,
      errors: parsed.error.issues.slice(0, 6).map((issue) => `${issue.path.join(".") || "answer"}: ${issue.message}`),
    };
  }
  const layout: MeshRigLayout = {
    ...parsed.data,
    eyes: [...parsed.data.eyes].sort((a, b) => boxCenter(a.opening)[0] - boxCenter(b.opening)[0]),
    brows: [...parsed.data.brows].sort((a, b) => boxCenter(a)[0] - boxCenter(b)[0]),
    // Bow is measured from the drawing after validation, never supplied by the vision model.
    mouth: { left: parsed.data.mouth.left, right: parsed.data.mouth.right, box: parsed.data.mouth.box },
  };
  const errors: string[] = [];
  const checkBox = (name: string, b: Box, min = 1) => {
    if (b[0] < 0 || b[1] < 0 || b[2] > width || b[3] > height) errors.push(`${name} is outside the picture`);
    if (boxWidth(b) < min || boxHeight(b) < min) errors.push(`${name} is empty or upside down`);
  };
  const checkPoint = (name: string, p: Point) => {
    if (p[0] < 0 || p[1] < 0 || p[0] > width || p[1] > height) errors.push(`${name} is outside the picture`);
  };
  checkBox("headBox", layout.headBox, 8);
  checkBox("faceBox", layout.faceBox, 8);
  layout.eyes.forEach((eye, index) => {
    checkBox(`eyes[${index}].opening`, eye.opening, 2);
    checkBox(`eyes[${index}].region`, eye.region, 4);
    if (!containsBox(eye.region, eye.opening)) errors.push(`eyes[${index}].region must contain its opening`);
    if (!insideBox(boxCenter(eye.opening), layout.faceBox)) errors.push(`eyes[${index}] must be inside faceBox`);
  });
  layout.brows.forEach((brow, index) => checkBox(`brows[${index}]`, brow, 1));
  checkPoint("nose", layout.nose);
  checkPoint("mouth.left", layout.mouth.left);
  checkPoint("mouth.right", layout.mouth.right);
  checkBox("mouth.box", layout.mouth.box, 1);
  checkPoint("neck", layout.neck);
  if (errors.length) return { layout: null, errors };

  const [eyeA, eyeB] = layout.eyes as [MeshRigLayout["eyes"][number], MeshRigLayout["eyes"][number]];
  const eyeLine = (boxCenter(eyeA.opening)[1] + boxCenter(eyeB.opening)[1]) / 2;
  const mouthCenter: Point = [
    (layout.mouth.left[0] + layout.mouth.right[0]) / 2,
    (layout.mouth.left[1] + layout.mouth.right[1]) / 2,
  ];
  if (overlaps(eyeA.region, eyeB.region)) errors.push("the two eye regions overlap");
  // Each eye is cut and filled pixel by pixel, so an eye the size of the face is refused as well as wrong.
  layout.eyes.forEach((eye, index) => {
    if (
      boxWidth(eye.region) > boxWidth(layout.faceBox) * 0.5 ||
      boxHeight(eye.region) > boxHeight(layout.faceBox) * 0.4
    )
      errors.push(`eyes[${index}].region is too big for faceBox`);
  });
  if (!insideBox(boxCenter(layout.faceBox), layout.headBox)) errors.push("faceBox must be inside headBox");
  layout.brows.forEach((brow, index) => {
    if (boxCenter(brow)[1] >= eyeLine) errors.push(`brows[${index}] must be above the eyes`);
  });
  if (layout.mouth.left[0] >= layout.mouth.right[0]) errors.push("mouth.left must be left of mouth.right");
  if (mouthCenter[1] <= eyeLine) errors.push("the mouth must be below the eyes");
  if (!insideBox(mouthCenter, layout.faceBox)) errors.push("the mouth must be inside faceBox");
  if (!insideBox(layout.nose, layout.faceBox)) errors.push("the nose must be inside faceBox");
  if (layout.neck[1] <= mouthCenter[1]) errors.push("neck must be below the mouth");
  return errors.length ? { layout: null, errors } : { layout, errors: [] };
}

/** The layout in another picture size (the model reads a scaled copy of the sprite). */
export function scaleMeshRigLayout(layout: MeshRigLayout, factor: number): MeshRigLayout {
  const b = (value: Box): Box => value.map((n) => n * factor) as Box;
  const p = (value: Point): Point => value.map((n) => n * factor) as Point;
  return {
    headBox: b(layout.headBox),
    faceBox: b(layout.faceBox),
    eyes: layout.eyes.map((eye) => ({ opening: b(eye.opening), region: b(eye.region) })),
    brows: layout.brows.map(b),
    nose: p(layout.nose),
    mouth: {
      left: p(layout.mouth.left),
      right: p(layout.mouth.right),
      box: b(layout.mouth.box),
      ...(layout.mouth.bow === undefined ? {} : { bow: layout.mouth.bow * factor }),
    },
    neck: p(layout.neck),
  };
}

// ── The rig ──

export interface MeshEllipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface MeshEye {
  opening: Point[];
  roi: Point[];
  x0: number;
  x1: number;
  top: number[];
  bot: number[];
}

/** mesh-avatar's `Rig` (version 1) without the optional hand, accessory, bun and strand groups. */
export interface MeshRig {
  version: 1;
  image: { width: number; height: number };
  head: MeshEllipse & {
    shiftX: number;
    shiftY: number;
    pivotX: number;
    pivotY: number;
    maxRoll: number;
    weightBand: Point;
    turnBand: Point;
  };
  body: {
    pivotX: number;
    pivotY: number;
    maxRoll: number;
    breathBand: Point;
    rollBand: Point;
    chest: MeshEllipse;
    shoulders: MeshEllipse[];
  };
  face: Record<"nose" | "mouth" | "eyeA" | "eyeB" | "earL" | "earR", MeshEllipse> & {
    brow: MeshEllipse & { band: Point };
    jaw: MeshEllipse & { band: Point };
  };
  eyes: MeshEye[];
  mouth: { cx: number; cy: number; angle: number; halfLen: number; bow: number; area: MeshEllipse & { angle: number } };
  cheeks: Point[];
  mesh: {
    baseCell: number;
    fine: { x0: number; x1: number; y0: number; y1: number; cell: number };
    handCell: number;
    tasselCell: number;
    eyeBallCell: number;
    eyeCell: number;
    spriteCell: number;
  };
  view: { padTop: number; padSide: number; gazeCenter?: Point };
}

/** The renderer samples each eye at this many columns (mesh-avatar's EYE_SAMPLES). */
export const EYE_SAMPLES = 24;

const round2 = (value: number) => Math.round(value * 100) / 100;

/** How round the eye outline is: lower is boxier. Drawn eyes, anime ones most of all, fill their box,
 *  and an outline that misses part of the iris leaves it showing when the eye closes. */
const EYE_OUTLINE_FULLNESS = 0.45;

/** An eye outline filling the opening box, from the outer corner along the upper lid and back along
 *  the lower lid. ponytail: a box-shaped guess, not a traced outline; tilted or narrowed eyes close a
 *  little off their real lid line. Upgrade: refine the outline from the eye-white pixels. */
export function almondEyeOutline(opening: Box, points = 18): Point[] {
  const [x0, y0, x1, y1] = opening;
  const cy = (y0 + y1) / 2;
  const half = (y1 - y0) / 2;
  const steps = Math.max(4, Math.floor(points / 2));
  const lid = (t: number) => half * Math.sin(Math.PI * t) ** EYE_OUTLINE_FULLNESS;
  const outline: Point[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    outline.push([round2(x0 + (x1 - x0) * t), round2(cy - lid(t))]);
  }
  for (let i = steps - 1; i >= 1; i -= 1) {
    const t = i / steps;
    outline.push([round2(x0 + (x1 - x0) * t), round2(cy + lid(t))]);
  }
  return outline;
}

function ellipseOutline(b: Box, points = 16): Point[] {
  const [cx, cy] = boxCenter(b);
  const rx = boxWidth(b) / 2;
  const ry = boxHeight(b) / 2;
  return Array.from({ length: points }, (_, i) => {
    const angle = Math.PI + (2 * Math.PI * i) / points;
    return [round2(cx + rx * Math.cos(angle)), round2(cy + ry * Math.sin(angle))] as Point;
  });
}

/** min / max y where the vertical line at x crosses the polygon (mesh-avatar-studio column_span). */
function columnSpan(poly: readonly Point[], x: number): [number, number] {
  const ys: number[] = [];
  for (let i = 0; i < poly.length; i += 1) {
    const [ax, ay] = poly[i]!;
    const [bx, by] = poly[(i + 1) % poly.length]!;
    if ((ax - x) * (bx - x) <= 0 && ax !== bx) ys.push(ay + ((by - ay) * (x - ax)) / (bx - ax));
  }
  if (ys.length < 2) throw new Error("An eye outline must cover every column it spans.");
  return [Math.min(...ys), Math.max(...ys)];
}

/** Upper and lower lid sampled at EYE_SAMPLES columns, the corners closed (mesh-avatar-studio eye_curves). */
export function eyeCurves(opening: readonly Point[]): Pick<MeshEye, "x0" | "x1" | "top" | "bot"> {
  const xs = opening.map((p) => p[0]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const top: number[] = [];
  const bot: number[] = [];
  for (let i = 0; i < EYE_SAMPLES; i += 1) {
    const x = x0 + (x1 - x0) * Math.min(Math.max(i / (EYE_SAMPLES - 1), 0.002), 0.998);
    const [t, b] = columnSpan(opening, x);
    top.push(round2(t));
    bot.push(round2(b));
  }
  for (const k of [0, EYE_SAMPLES - 1]) {
    top[k] = bot[k] = round2((top[k]! + bot[k]!) / 2);
  }
  return { x0, x1, top, bot };
}

const band = (start: number, end: number): Point => [round2(start), round2(Math.max(end, start + 1))];
const ellipse = (cx: number, cy: number, rx: number, ry: number): MeshEllipse => ({
  cx: round2(cx),
  cy: round2(cy),
  rx: round2(Math.max(1, rx)),
  ry: round2(Math.max(1, ry)),
});

/** A complete version 1 rig for a sprite of `width` x `height` from a checked layout in its pixels. */
export function deriveMeshRig(layout: MeshRigLayout, width: number, height: number): MeshRig {
  const face = layout.faceBox as Box;
  const head = layout.headBox as Box;
  const faceW = boxWidth(face);
  const faceH = boxHeight(face);
  const chin = face[3];
  const eyes = layout.eyes.map((eye) => {
    const opening = almondEyeOutline(eye.opening as Box);
    return { opening, roi: ellipseOutline(eye.region as Box), ...eyeCurves(opening) };
  });
  const [regionA, regionB] = layout.eyes.map((eye) => eye.region as Box) as [Box, Box];
  const eyeLine = (boxCenter(regionA)[1] + boxCenter(regionB)[1]) / 2;
  const [left, right] = [layout.mouth.left as Point, layout.mouth.right as Point];
  const mouthCx = (left[0] + right[0]) / 2;
  const mouthCy = (left[1] + right[1]) / 2;
  const angle = Math.atan2(right[1] - left[1], right[0] - left[0]);
  const halfLen = Math.max(1, Math.hypot(right[0] - left[0], right[1] - left[1]) / 2);
  const mouthBox = layout.mouth.box as Box;
  const browTop = Math.min(layout.brows[0]![1], layout.brows[1]![1]);
  const browBottom = Math.max(layout.brows[0]![3], layout.brows[1]![3]);
  const browLeft = Math.min(layout.brows[0]![0], layout.brows[1]![0]);
  const browRight = Math.max(layout.brows[0]![2], layout.brows[1]![2]);
  const browEnd = Math.min(Math.min(regionA[1], regionB[1]), browBottom + 0.04 * faceH);
  const neck = layout.neck as Point;
  const chestCy = chin + faceH;
  const lowEnd = Math.max(height, chestCy + 1);
  const scale = Math.max(0.5, Math.min(2, Math.min(width, height) / MESH_RIG_REFERENCE_SIZE));
  const cell = (value: number, minimum: number) => Math.max(minimum, Math.round(value * scale));
  const clampX = (value: number) => Math.round(Math.max(0, Math.min(width, value)));
  const clampY = (value: number) => Math.round(Math.max(0, Math.min(height, value)));
  const fine = {
    x0: clampX(head[0] - 0.05 * boxWidth(head)),
    x1: clampX(head[2] + 0.05 * boxWidth(head)),
    y0: clampY(head[1] - 0.05 * boxHeight(head)),
    y1: clampY(Math.max(head[3], chin) + 0.05 * boxHeight(head)),
    cell: cell(7, 3),
  };
  return {
    version: 1,
    image: { width, height },
    head: {
      ...ellipse(boxCenter(head)[0], eyeLine - 0.05 * faceH, (boxWidth(head) / 2) * 1.05, (boxHeight(head) / 2) * 1.05),
      shiftX: round2(0.035 * width),
      shiftY: round2(0.025 * height),
      pivotX: round2(neck[0]),
      pivotY: round2(neck[1]),
      maxRoll: 0.15,
      weightBand: band(chin, chin + 0.5 * faceH),
      turnBand: band(chin + 0.05 * faceH, chin + 0.85 * faceH),
    },
    body: {
      pivotX: round2(neck[0]),
      pivotY: round2(height * 1.3),
      maxRoll: 0.035,
      breathBand: band(Math.min(chestCy + 0.25 * faceH, lowEnd - 1), lowEnd),
      rollBand: band(Math.min(chestCy - 0.03 * faceH, lowEnd - 1), lowEnd),
      chest: ellipse(neck[0], chestCy, 0.65 * faceW, 0.65 * faceH),
      shoulders: [
        ellipse(neck[0] - faceW, chin + 0.55 * faceH, 0.4 * faceW, 0.3 * faceH),
        ellipse(neck[0] + faceW, chin + 0.55 * faceH, 0.4 * faceW, 0.3 * faceH),
      ],
    },
    face: {
      nose: ellipse(layout.nose[0], layout.nose[1], 0.11 * faceW, 0.11 * faceW),
      mouth: ellipse(mouthCx, mouthCy, halfLen * 1.5, Math.max(boxHeight(mouthBox), 0.08 * faceH)),
      eyeA: ellipse(...boxCenter(regionA), boxWidth(regionA) * 0.6, boxHeight(regionA) * 0.6),
      eyeB: ellipse(...boxCenter(regionB), boxWidth(regionB) * 0.6, boxHeight(regionB) * 0.6),
      earL: ellipse(face[0], eyeLine + 0.15 * faceH, 0.08 * faceW, 0.14 * faceH),
      earR: ellipse(face[2], eyeLine + 0.15 * faceH, 0.08 * faceW, 0.14 * faceH),
      brow: {
        ...ellipse(
          (browLeft + browRight) / 2,
          (browTop + browBottom) / 2,
          (browRight - browLeft) / 2,
          (browBottom - browTop) / 2 + 2,
        ),
        band: band(browBottom, browEnd),
      },
      jaw: {
        ...ellipse(mouthCx, chin - 0.05 * faceH, 0.25 * faceW, 0.18 * faceH),
        band: band(mouthCy + 0.01 * faceH, mouthCy + 0.1 * faceH),
      },
    },
    eyes,
    mouth: {
      cx: round2(mouthCx),
      cy: round2(mouthCy),
      angle: round2(angle * 1000) / 1000,
      halfLen: round2(halfLen),
      bow: round2(layout.mouth.bow ?? 0.1 * halfLen),
      area: {
        ...ellipse(
          boxCenter(mouthBox)[0],
          boxCenter(mouthBox)[1],
          halfLen * 1.6,
          Math.max(boxHeight(mouthBox) * 1.5, halfLen * 0.8),
        ),
        angle: round2(angle * 1000) / 1000,
      },
    },
    cheeks: [
      [round2(boxCenter(regionA)[0]), round2(regionA[3] + 0.06 * faceH)],
      [round2(boxCenter(regionB)[0]), round2(regionB[3] + 0.06 * faceH)],
    ],
    mesh: {
      baseCell: cell(14, 4),
      fine: fine.x0 < fine.x1 && fine.y0 < fine.y1 ? fine : { ...fine, x0: 0, x1: width, y0: 0, y1: height },
      handCell: 9,
      tasselCell: 6,
      eyeBallCell: 4,
      eyeCell: 3,
      spriteCell: 4,
    },
    view: {
      padTop: 0,
      padSide: 0,
      gazeCenter: [round2((boxCenter(regionA)[0] + boxCenter(regionB)[0]) / 2), round2(eyeLine)],
    },
  };
}
