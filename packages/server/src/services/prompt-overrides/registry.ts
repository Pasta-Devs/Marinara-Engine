// ──────────────────────────────────────────────
// Prompt Override Registry
//
// Each entry registers ONE overridable prompt:
//  - the stable key
//  - the variables it interpolates (UI hints)
//  - the canonical default builder
//  - an example context for previews
//
// Adding a key here is half of exposing a prompt;
// the other half is calling loadPrompt(key, ctx)
// at the call site.
// ──────────────────────────────────────────────

export interface PromptVariable {
  name: string;
  description: string;
  example?: string;
}

export interface PromptOverrideKeyDef<TCtx extends Record<string, string | number | undefined>> {
  key: string;
  description: string;
  variables: readonly PromptVariable[];
  /** The hardcoded behavior used when no override exists or when an override fails. */
  defaultBuilder: (ctx: TCtx) => string;
  /** Realistic example values used to preview the default text in the UI. */
  exampleContext: TCtx;
}

// ── Sprite expression sheet ──
//
// The multi-cell ("strict NxM grid") branch of
// POST /api/sprites/generate-sheet. Other sprite
// branches (single portrait, full-body sheet,
// per-expression GPT-Image fallback) remain
// hardcoded for now and can be registered later.

export interface SpritesExpressionSheetCtx extends Record<string, string | number | undefined> {
  cols: number;
  rows: number;
  expressionCount: number;
  expressionList: string;
  appearance: string;
}

export const SPRITES_EXPRESSION_SHEET: PromptOverrideKeyDef<SpritesExpressionSheetCtx> = {
  key: "sprites.expressionSheet",
  description: "Image prompt for the multi-cell character expression sprite sheet.",
  variables: [
    { name: "cols", description: "Columns in the grid.", example: "2" },
    { name: "rows", description: "Rows in the grid.", example: "3" },
    { name: "expressionCount", description: "Total cells (cols × rows).", example: "6" },
    {
      name: "expressionList",
      description: "Expression labels in left-to-right top-to-bottom order, comma-separated.",
      example: "neutral, happy, sad, angry, surprised, embarrassed",
    },
    { name: "appearance", description: "Character appearance description.", example: "auburn hair, green eyes, leather jacket" },
  ],
  defaultBuilder: (ctx) =>
    [
      `character expression sheet with EXACTLY ${ctx.expressionCount} total portrait cells,`,
      `strict ${ctx.cols} columns by ${ctx.rows} rows grid, no extra rows, no extra columns, no extra panels,`,
      `${ctx.expressionCount} equally sized square cells arranged in a perfectly uniform grid,`,
      `solid white background, thin straight lines separating each cell,`,
      `same character in every cell, consistent art style,`,
      `expressions left-to-right top-to-bottom: ${ctx.expressionList},`,
      `${ctx.appearance},`,
      `each cell shows head and shoulders portrait with a different facial expression,`,
      `all cells same size, perfectly aligned, no overlapping, no merged cells,`,
      `the final image must stop after the ${ctx.rows} row; do not draw a fourth row or bonus expressions,`,
      `no text, no labels, no numbers`,
    ].join(" "),
  exampleContext: {
    cols: 2,
    rows: 3,
    expressionCount: 6,
    expressionList: "neutral, happy, sad, angry, surprised, embarrassed",
    appearance: "auburn hair, green eyes, leather jacket",
  },
};

// ── Registry ──

export const PROMPT_OVERRIDE_REGISTRY = [SPRITES_EXPRESSION_SHEET] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyKeyDef = PromptOverrideKeyDef<any>;

const REGISTRY_BY_KEY: ReadonlyMap<string, AnyKeyDef> = new Map(
  PROMPT_OVERRIDE_REGISTRY.map((def) => [def.key, def as AnyKeyDef]),
);

export function getPromptOverrideDef(key: string): AnyKeyDef | undefined {
  return REGISTRY_BY_KEY.get(key);
}

export function listPromptOverrideKeys(): string[] {
  return PROMPT_OVERRIDE_REGISTRY.map((def) => def.key);
}
