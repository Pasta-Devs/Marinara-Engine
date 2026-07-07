export type DiceShapeKind = "coin" | "tetra" | "cube" | "diamond" | "kite" | "dodeca" | "crystal" | "icosa" | "medallion";

export interface DiceShapeDefinition {
  kind: DiceShapeKind;
  body: string;
  face: string;
  highlight: string;
  shadow: string;
  facets: string[];
  renderMode?: "text" | "pips" | "coin";
  labelY: number;
  valueY: number;
  valueSize: number;
}

const SHAPES: Record<DiceShapeKind, DiceShapeDefinition> = {
  coin: {
    kind: "coin",
    // Face-on coin view: circular front face + visible bottom rim for depth
    body: "M50 14 C70 14 84 28 84 44 L84 52 C84 68 70 82 50 82 C30 82 16 68 16 52 L16 44 C16 28 30 14 50 14 Z",
    face: "M50 14 C70 14 84 28 84 44 C84 60 70 74 50 74 C30 74 16 60 16 44 C16 28 30 14 50 14 Z",
    highlight: "M28 26 C36 16 64 16 72 26 C64 22 36 22 28 26 Z",
    shadow: "M16 52 C16 68 30 82 50 82 C70 82 84 68 84 52 C84 60 70 74 50 74 C30 74 16 60 16 52 Z",
    facets: ["M50 22 C62 22 74 32 74 44 C74 56 62 66 50 66 C38 66 26 56 26 44 C26 32 38 22 50 22 Z"],
    renderMode: "coin",
    labelY: 36,
    valueY: 56,
    valueSize: 13,
  },
  tetra: {
    kind: "tetra",
    body: "M50 7 94 88H6L50 7Z",
    face: "M50 14 81 84H19L50 14Z",
    highlight: "M50 7 19 84 6 88 50 7Z",
    shadow: "M50 14 94 88 81 84 50 14Z",
    facets: ["M50 14 50 84", "M19 84 81 84", "M50 14 6 88", "M50 14 94 88"],
    labelY: 60,
    valueY: 74,
    valueSize: 17,
  },
  cube: {
    kind: "cube",
    // 3/4 view: front face (pips) + top-edge strip + right-edge strip
    body: "M22 12 90 12 90 80 82 88 14 88 14 20 Z",
    face: "M14 20 82 20 82 88 14 88 Z",
    highlight: "M22 12 90 12 82 20 14 20 Z",
    shadow: "M90 12 90 80 82 88 82 20 Z",
    facets: ["M14 20 82 20", "M82 20 82 88"],
    renderMode: "pips",
    labelY: 50,
    valueY: 64,
    valueSize: 17,
  },
  diamond: {
    kind: "diamond",
    // D8 octahedron: triangular top face is the "up face"
    body: "M50 5 89 49 50 95 11 49 Z",
    face: "M50 16 80 49 20 49 Z",
    highlight: "M50 5 11 49 20 49 50 16 Z",
    shadow: "M11 49 89 49 50 95 Z",
    facets: ["M11 49 89 49", "M50 5 50 95", "M11 49 50 95", "M89 49 50 95"],
    labelY: 32,
    valueY: 44,
    valueSize: 18,
  },
  kite: {
    kind: "kite",
    // D10 pentagonal trapezohedron: kite/diamond face is the "up face"
    body: "M50 4 82 19 92 50 72 88 50 96 28 88 8 50 18 19 50 4Z",
    face: "M50 15 76 48 50 82 24 48 Z",
    highlight: "M50 4 18 19 24 48 50 15 Z",
    shadow: "M50 82 72 88 50 96 28 88 Z",
    facets: [
      "M50 4 50 15", "M82 19 76 48", "M18 19 24 48",
      "M92 50 76 48", "M8 50 24 48", "M50 82 50 96",
    ],
    labelY: 36,
    valueY: 55,
    valueSize: 18,
  },
  dodeca: {
    kind: "dodeca",
    // D12 dodecahedron: regular pentagon face is the "up face"
    body: "M50 7 78 17 94 43 87 73 64 92H36L13 73 6 43 22 17 50 7Z",
    face: "M50 22 77 41 67 73 33 73 23 41 Z",
    highlight: "M50 7 22 17 23 41 50 22 Z",
    shadow: "M33 73 67 73 64 92 36 92 Z",
    facets: [
      "M50 7 50 22", "M22 17 23 41", "M78 17 77 41",
      "M13 73 33 73", "M87 73 67 73", "M36 92 33 73", "M64 92 67 73",
    ],
    labelY: 40,
    valueY: 57,
    valueSize: 18,
  },
  crystal: {
    kind: "crystal",
    // D16 (non-standard): octagonal face, expanded for two-digit values
    body: "M50 3 77 16 92 50 76 84 50 97 24 84 8 50 23 16 50 3Z",
    face: "M50 15 68 27 76 50 65 74 50 84 35 74 24 50 32 27 50 15Z",
    highlight: "M50 3 23 16 32 27 50 15 Z",
    shadow: "M65 74 76 84 50 97 50 84 65 74Z",
    facets: [
      "M50 3 50 15", "M23 16 32 27", "M77 16 68 27",
      "M8 50 24 50", "M92 50 76 50",
      "M24 84 35 74", "M76 84 65 74",
      "M32 27 68 27", "M35 74 65 74",
    ],
    labelY: 40,
    valueY: 60,
    valueSize: 19,
  },
  icosa: {
    kind: "icosa",
    // D20 icosahedron: central equilateral triangle is the "up face"
    // Face expanded to h=48/base=56 (ratio 0.857 ≈ equilateral 0.866) for readable values
    body: "M50 5 83 18 96 50 75 86 50 96 25 86 4 50 17 18 50 5Z",
    face: "M50 15 78 63 22 63 Z",
    highlight: "M50 5 83 18 96 50 78 63 50 15 Z",
    shadow: "M22 63 78 63 75 86 50 96 25 86 4 50 Z",
    facets: [
      "M50 15 78 63", "M78 63 22 63", "M22 63 50 15",
      "M50 5 83 18", "M83 18 96 50", "M96 50 75 86",
      "M4 50 17 18", "M17 18 50 5", "M25 86 4 50",
    ],
    labelY: 39,
    valueY: 52,
    valueSize: 19,
  },
  medallion: {
    kind: "medallion",
    // D30/D100: large polygonal face with room for three-digit values
    body: "M50 6 80 16 95 42 88 74 64 94H36L12 74 5 42 20 16 50 6Z",
    face: "M50 20 70 28 81 47 75 68 60 81H40L25 68 19 47 30 28 50 20Z",
    highlight: "M50 6 20 16 30 28 50 20 Z",
    shadow: "M60 81 88 74 64 94 36 94 12 74 40 81 Z",
    facets: [
      "M50 6 50 20", "M20 16 30 28", "M80 16 70 28",
      "M5 42 19 47", "M95 42 81 47",
      "M12 74 25 68", "M88 74 75 68",
      "M36 94 40 81", "M64 94 60 81",
    ],
    labelY: 40,
    valueY: 58,
    valueSize: 18,
  },
};

export function getDiceShape(sides: number): DiceShapeDefinition {
  if (sides === 2) return SHAPES.coin;
  if (sides === 4) return SHAPES.tetra;
  if (sides === 6) return SHAPES.cube;
  if (sides === 8) return SHAPES.diamond;
  if (sides === 10) return SHAPES.kite;
  if (sides === 12) return SHAPES.dodeca;
  if (sides === 16) return SHAPES.crystal;
  if (sides === 20) return SHAPES.icosa;
  if (sides >= 30 || sides === 100) return SHAPES.medallion;
  return SHAPES.crystal;
}

export function getFaceLabel(sides: number, value: number): string {
  if (sides === 2) return value === 1 ? "Heads" : "Tails";
  return String(value);
}
