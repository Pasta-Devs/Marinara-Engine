// ──────────────────────────────────────────────
// Registered prompt-override keys: sprite generation
//
// Sprite-sheet generation is a 4-way switch in
// sprites.routes.ts. Each branch is its own
// override key so users can customise them
// independently.
// ──────────────────────────────────────────────
import type { PromptOverrideKeyDef } from "../types.js";

// ── Multi-cell expression sheet ──

export interface SpritesExpressionSheetCtx extends Record<string, string | number | undefined> {
  cols: number;
  rows: number;
  expressionCount: number;
  expressionList: string;
  appearance: string;
}

export const SPRITES_EXPRESSION_SHEET: PromptOverrideKeyDef<SpritesExpressionSheetCtx> = {
  key: "sprites.expressionSheet",
  description: "Multi-cell character expression sprite sheet (the default sprite-generation flow).",
  variables: [
    { name: "cols", description: "Columns in the grid.", example: "2" },
    { name: "rows", description: "Rows in the grid.", example: "3" },
    { name: "expressionCount", description: "Total cells (cols × rows).", example: "6" },
    {
      name: "expressionList",
      description: "Expression labels in left-to-right top-to-bottom order, comma-separated.",
      example: "neutral, happy, sad, angry, surprised, embarrassed",
    },
    {
      name: "appearance",
      description: "Character appearance description.",
      example: "auburn hair, green eyes, leather jacket",
    },
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

// ── Single portrait (1×1, head & shoulders) ──
//
// Used both for explicit 1×1 portrait requests and as the GPT-Image
// fallback path that generates expressions one at a time. Same prompt
// shape, same variables — one key serves both call sites.

export interface SpritesSinglePortraitCtx extends Record<string, string | number | undefined> {
  appearance: string;
  expression: string;
}

export const SPRITES_SINGLE_PORTRAIT: PromptOverrideKeyDef<SpritesSinglePortraitCtx> = {
  key: "sprites.singlePortrait",
  description: "Single head-and-shoulders portrait sprite (1×1, also used per-expression for GPT-Image models).",
  variables: [
    {
      name: "appearance",
      description: "Character appearance description.",
      example: "auburn hair, green eyes, leather jacket",
    },
    { name: "expression", description: "Facial expression for this single image.", example: "neutral" },
  ],
  defaultBuilder: (ctx) =>
    [
      `single character portrait sprite, one character only,`,
      `head and shoulders portrait, centered in frame, no cropping,`,
      `solid white studio background,`,
      `${ctx.appearance},`,
      `facial expression: ${ctx.expression},`,
      `anime/game sprite style, consistent character design,`,
      `no grid, no panel borders, no text, no labels, no watermark`,
    ].join(" "),
  exampleContext: {
    appearance: "auburn hair, green eyes, leather jacket",
    expression: "neutral",
  },
};

// ── Single full-body sprite (1×1) ──

export interface SpritesSingleFullBodyCtx extends Record<string, string | number | undefined> {
  appearance: string;
  pose: string;
}

export const SPRITES_SINGLE_FULL_BODY: PromptOverrideKeyDef<SpritesSingleFullBodyCtx> = {
  key: "sprites.singleFullBody",
  description: "Single full-body character sprite, one pose.",
  variables: [
    {
      name: "appearance",
      description: "Character appearance description.",
      example: "auburn hair, green eyes, leather jacket",
    },
    { name: "pose", description: "Pose or action for this image.", example: "idle" },
  ],
  defaultBuilder: (ctx) =>
    [
      `single full-body character sprite, one character only,`,
      `entire body visible from head to toe, centered in frame, no cropping,`,
      `solid white studio background,`,
      `${ctx.appearance},`,
      `pose/action: ${ctx.pose},`,
      `anime/game sprite style, consistent character design,`,
      `no grid, no panel borders, no text, no labels, no watermark`,
    ].join(" "),
  exampleContext: {
    appearance: "auburn hair, green eyes, leather jacket",
    pose: "idle",
  },
};

// ── Multi-cell full-body pose sheet ──

export interface SpritesFullBodySheetCtx extends Record<string, string | number | undefined> {
  cols: number;
  rows: number;
  poseCount: number;
  poseList: string;
  appearance: string;
}

export const SPRITES_FULL_BODY_SHEET: PromptOverrideKeyDef<SpritesFullBodySheetCtx> = {
  key: "sprites.fullBodySheet",
  description: "Multi-cell full-body pose sprite sheet (e.g. idle, walk, run, attack).",
  variables: [
    { name: "cols", description: "Columns in the grid.", example: "2" },
    { name: "rows", description: "Rows in the grid.", example: "3" },
    { name: "poseCount", description: "Total cells (cols × rows).", example: "6" },
    {
      name: "poseList",
      description: "Pose labels in left-to-right top-to-bottom order.",
      example: "idle, walking, running, attacking, defending, casting",
    },
    {
      name: "appearance",
      description: "Character appearance description.",
      example: "auburn hair, green eyes, leather jacket",
    },
  ],
  defaultBuilder: (ctx) =>
    [
      `full-body character sprite sheet with EXACTLY ${ctx.poseCount} total pose cells,`,
      `strict ${ctx.cols} columns by ${ctx.rows} rows grid, no extra rows, no extra columns, no extra panels,`,
      `${ctx.poseCount} equally sized tall cells arranged in a perfectly uniform grid,`,
      `solid white background, thin straight lines separating each cell,`,
      `same character in every cell, consistent art style and outfit,`,
      `poses left-to-right top-to-bottom: ${ctx.poseList},`,
      `${ctx.appearance},`,
      `each cell shows the entire body from head to toe, centered, no cropping,`,
      `leave enough whitespace around each full-body pose so feet, hair, weapons, and hands are fully visible,`,
      `all cells same size, perfectly aligned, no overlapping, no merged cells,`,
      `the final image must stop after the ${ctx.rows} row; do not draw a bonus row or bonus poses,`,
      `no text, no labels, no numbers`,
    ].join(" "),
  exampleContext: {
    cols: 2,
    rows: 3,
    poseCount: 6,
    poseList: "idle, walking, running, attacking, defending, casting",
    appearance: "auburn hair, green eyes, leather jacket",
  },
};
