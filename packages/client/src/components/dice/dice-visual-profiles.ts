export type DiceRollAxis = "flat-spin" | "corner-tumble" | "edge-tumble" | "long-axis-tumble";
export type DiceShadowKind = "round" | "cube" | "diamond" | "long-oval";
export type DiceSilhouetteMode = "stable" | "corner-flip" | "alternating-wide-thin";

export interface DiceVisualProfile {
  rollAxis: DiceRollAxis;
  shadow: DiceShadowKind;
  silhouette: DiceSilhouetteMode;
  impact: "soft" | "solid" | "sharp" | "hero";
}

const COIN_PROFILE: DiceVisualProfile = {
  rollAxis: "flat-spin",
  shadow: "round",
  silhouette: "stable",
  impact: "soft",
};

const CUBE_PROFILE: DiceVisualProfile = {
  rollAxis: "corner-tumble",
  shadow: "cube",
  silhouette: "corner-flip",
  impact: "solid",
};

const LONG_DIE_PROFILE: DiceVisualProfile = {
  rollAxis: "long-axis-tumble",
  shadow: "long-oval",
  silhouette: "alternating-wide-thin",
  impact: "solid",
};

const SHARP_DIE_PROFILE: DiceVisualProfile = {
  rollAxis: "edge-tumble",
  shadow: "diamond",
  silhouette: "corner-flip",
  impact: "sharp",
};

const HERO_D20_PROFILE: DiceVisualProfile = {
  rollAxis: "edge-tumble",
  shadow: "diamond",
  silhouette: "corner-flip",
  impact: "hero",
};

export function getDiceVisualProfile(sides: number, hero: boolean): DiceVisualProfile {
  if (sides === 2) return COIN_PROFILE;
  if (sides === 6) return CUBE_PROFILE;
  if (sides === 16) return LONG_DIE_PROFILE;
  if (sides === 20 && hero) return HERO_D20_PROFILE;
  if (sides === 4 || sides === 8 || sides === 10 || sides === 12 || sides === 20 || sides >= 30) return SHARP_DIE_PROFILE;
  return LONG_DIE_PROFILE;
}
