export const SPRITE_DISPLAY_MODES = ["expressions", "full-body"] as const;

export type SpriteDisplayMode = (typeof SPRITE_DISPLAY_MODES)[number];

export const DEFAULT_SPRITE_DISPLAY_MODES: SpriteDisplayMode[] = ["expressions", "full-body"];
export const SPRITE_DISPLAY_SCALE_MIN = 0.05;
export const SPRITE_DISPLAY_SCALE_MAX = 2;
export const SPRITE_DISPLAY_SCALE_PERCENT_MIN = 5;
export const SPRITE_DISPLAY_SCALE_PERCENT_MAX = 200;
export const SPRITE_DISPLAY_OPACITY_MIN = 0.15;
export const SPRITE_DISPLAY_OPACITY_MAX = 1;
export const SPRITE_DISPLAY_OPACITY_PERCENT_MIN = 15;
export const SPRITE_DISPLAY_OPACITY_PERCENT_MAX = 100;

export function normalizeSpriteDisplayModes(value: unknown): SpriteDisplayMode[] {
  const rawModes = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const modes: SpriteDisplayMode[] = [];

  for (const mode of rawModes) {
    const normalized = mode === "fullBody" || mode === "full_body" ? "full-body" : mode;
    if (normalized === "expressions" && !modes.includes("expressions")) {
      modes.push("expressions");
    } else if (normalized === "full-body" && !modes.includes("full-body")) {
      modes.push("full-body");
    }
  }

  return modes.length > 0 ? modes : [...DEFAULT_SPRITE_DISPLAY_MODES];
}

export function hasSpriteDisplayMode(modes: readonly SpriteDisplayMode[], mode: SpriteDisplayMode): boolean {
  return modes.includes(mode);
}

export function isFullBodySpriteExpression(expression: string): boolean {
  return expression.toLowerCase().startsWith("full_");
}
