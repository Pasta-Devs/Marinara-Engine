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
      `character expression sprite sheet source image, designed to be sliced into cells,`,
      `EXACTLY ${ctx.expressionCount} total portrait cells and every cell must be filled,`,
      `strict ${ctx.cols} columns by ${ctx.rows} rows grid, no extra rows, no extra columns, no extra panels,`,
      `${ctx.expressionCount} equally sized square cells arranged in one perfectly uniform grid,`,
      `solid white background, thin straight borders or clean gutters separating every cell,`,
      `same character in every cell, same outfit, same camera distance, same lighting, consistent art style,`,
      `expressions left-to-right top-to-bottom, one cell per expression, no duplicates and none missing: ${ctx.expressionList},`,
      `${ctx.appearance},`,
      `each cell shows one head-and-shoulders portrait with the requested facial expression, centered with no cropping,`,
      `do not make one large portrait, do not make a poster, comic page, collage, diagonal layout, or merged composition,`,
      `all cells same size, perfectly aligned, no overlapping, no merged cells, no blank cells,`,
      `the final image must stop after row ${ctx.rows}; do not draw bonus rows, bonus expressions, or extra characters,`,
      `no text, no labels, no numbers, no captions, no watermark`,
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
      `full-body character pose sprite sheet source image, designed to be sliced into cells,`,
      `EXACTLY ${ctx.poseCount} total pose cells and every cell must be filled,`,
      `strict ${ctx.cols} columns by ${ctx.rows} rows grid, no extra rows, no extra columns, no extra panels,`,
      `${ctx.poseCount} equally sized tall rectangular cells arranged in one perfectly uniform grid,`,
      `solid white background, thin straight borders or clean gutters separating every cell,`,
      `same character in every cell, same outfit, same proportions, same scale, consistent art style,`,
      `poses left-to-right top-to-bottom, one cell per pose, no duplicates and none missing: ${ctx.poseList},`,
      `${ctx.appearance},`,
      `each cell shows one complete full-body character from head to toe, centered upright, feet visible, no cropping,`,
      `leave enough whitespace around each full-body pose so feet, hair, weapons, and hands are fully visible inside that cell,`,
      `do not make one single large full-body image, do not make a poster, comic page, collage, diagonal layout, or merged composition,`,
      `all cells same size, perfectly aligned, no overlapping, no merged cells, no blank cells,`,
      `the final image must stop after row ${ctx.rows}; do not draw bonus rows, bonus poses, or extra characters,`,
      `no text, no labels, no numbers, no captions, no watermark`,
    ].join(" "),
  exampleContext: {
    cols: 2,
    rows: 3,
    poseCount: 6,
    poseList: "idle, walking, running, attacking, defending, casting",
    appearance: "auburn hair, green eyes, leather jacket",
  },
};
