import type { PromptOverrideKeyDef } from "../types.js";

export interface CharactersReferenceSheetCtx extends Record<string, string | number | undefined> {
  name: string;
  appearance: string;
}

export interface CharactersLorebookCoverCtx extends Record<string, string | number | undefined> {
  name: string;
  appearance: string;
}

export const CHARACTERS_LOREBOOK_COVER: PromptOverrideKeyDef<CharactersLorebookCoverCtx> = {
  key: "characters.lorebookCover",
  label: "Lorebook Cover",
  description: "Cover illustration used by lorebook cover generation.",
  variables: [
    { name: "name", description: "Lorebook title.", example: "The Ashen Marches" },
    {
      name: "appearance",
      description: "What the cover should show.",
      example: "a ruined watchtower above a burning forest at dusk",
    },
  ],
  defaultBuilder: (ctx) =>
    [
      `Cover illustration for a fantasy lore compendium titled "${ctx.name}".`,
      `${ctx.appearance.replace(/[.\s]+$/, "")}.`,
      "Evocative scene or emblem, no text, no lettering.",
    ].join(" "),
  exampleContext: {
    name: "The Ashen Marches",
    appearance: "a ruined watchtower above a burning forest at dusk",
  },
};

export const CHARACTERS_REFERENCE_SHEET: PromptOverrideKeyDef<CharactersReferenceSheetCtx> = {
  key: "characters.referenceSheet",
  label: "Character Reference Sheet",
  description: "Production character reference sheet used by character and Persona gallery generation.",
  variables: [
    { name: "name", description: "Character or Persona name.", example: "Mira" },
    {
      name: "appearance",
      description: "Canonical appearance description.",
      example: "long brown hair, amber eyes, dark travel coat",
    },
  ],
  defaultBuilder: (ctx) =>
    [
      `Create a polished production character design sheet for ${ctx.name}.`,
      `Canonical appearance: ${ctx.appearance}.`,
      "Show multiple consistent views of the same character: one large full-body hero view, front and back turnaround views in neutral poses, close-up face and costume details, important accessories, and a compact color palette on a clean neutral background.",
      "Keep the same face, body proportions, hairstyle, outfit construction, colors, accessories, and distinguishing features in every view.",
      "Show only this character and keep every body view fully in frame.",
    ].join(" "),
  exampleContext: {
    name: "Mira",
    appearance: "long brown hair, amber eyes, dark travel coat",
  },
};

export interface CharactersGalleryBackgroundCtx extends Record<string, string | number | undefined> {
  name: string;
  appearance: string;
}

export interface CharactersStickerSheetCtx extends Record<string, string | number | undefined> {
  name: string;
  appearance: string;
  count: number;
  cols: number;
  rows: number;
  expressions: string;
}

/** A chat background for a character or Persona's gallery: the place, never the people. */
export const CHARACTERS_GALLERY_BACKGROUND: PromptOverrideKeyDef<CharactersGalleryBackgroundCtx> = {
  key: "characters.galleryBackground",
  label: "Character Gallery Background",
  description: "Chat background generated from a character or Persona gallery's Create with AI.",
  variables: [
    { name: "name", description: "Character or Persona the background belongs to.", example: "Mira" },
    {
      name: "appearance",
      description: "The place to paint, or the character's scenario and setting to pick a fitting place from.",
      example: "a cramped alchemy shop above a canal, shelves of glowing bottles, rain on the windows",
    },
  ],
  defaultBuilder: (ctx) =>
    [
      `Wide scenic background art of a location that belongs to ${ctx.name}'s story.`,
      `Scene and context: ${ctx.appearance.replace(/[.\s]+$/, "")}.`,
      "If the context describes people or events, paint only the place where they happen: a fitting, specific location with a clear sense of space, time of day and mood.",
      "Wide-angle environment, full-frame background, detailed but calm enough to sit behind chat messages, with the focal point away from the center.",
      "No people, no characters, no figures, no faces, no text, no lettering, no UI, no borders, no collage.",
    ].join(" "),
  exampleContext: {
    name: "Mira",
    appearance: "a cramped alchemy shop above a canal, shelves of glowing bottles, rain on the windows",
  },
};

function stickerGridLine(ctx: CharactersStickerSheetCtx): string {
  return `Lay out exactly ${ctx.count} separate ${ctx.count === 1 ? "image" : "images"} in an even ${ctx.cols} by ${ctx.rows} grid of equal square cells, reading left to right, top to bottom, in this order: ${ctx.expressions}.`;
}

/** A sheet the client cuts into one gallery sticker per cell. */
export const CHARACTERS_STICKER_SHEET: PromptOverrideKeyDef<CharactersStickerSheetCtx> = {
  key: "characters.stickerSheet",
  label: "Character Sticker Sheet",
  description:
    "Sticker sheet generated from a character or Persona gallery's Create with AI; each cell becomes its own sticker.",
  variables: [
    { name: "name", description: "Character or Persona name.", example: "Mira" },
    { name: "appearance", description: "Canonical appearance description.", example: "long brown hair, amber eyes" },
    { name: "count", description: "Number of stickers.", example: "9" },
    { name: "cols", description: "Grid columns.", example: "3" },
    { name: "rows", description: "Grid rows.", example: "3" },
    {
      name: "expressions",
      description: "Comma-separated sticker list in grid order.",
      example: "happy, laughing, sad, angry, surprised, love, thinking, sleepy, thumbs up",
    },
  ],
  defaultBuilder: (ctx) =>
    [
      `Create a sticker sheet of expressive chat stickers of ${ctx.name}.`,
      `Canonical appearance: ${ctx.appearance.replace(/[.\s]+$/, "")}.`,
      stickerGridLine(ctx),
      "Each sticker shows the same character, recognisable in every cell, as a cute, punchy chibi or upper-body pose that acts out its emotion with face, hands and a small prop or effect when it helps.",
      "Every sticker has a thick clean white outline, is centered in its own cell with generous empty space around it, and never touches or overlaps a neighbouring cell.",
      "Plain flat solid pure green (#00FF00) background everywhere, like a green screen, with no green in the stickers themselves; no grid lines, no frames, no shadows on the background, no text, no captions, no speech bubbles, no lettering.",
    ].join(" "),
  exampleContext: {
    name: "Mira",
    appearance: "long brown hair, amber eyes",
    count: 9,
    cols: 3,
    rows: 3,
    expressions: "happy, laughing, sad, angry, surprised, love, thinking, sleepy, thumbs up",
  },
};

/** An emoji sheet: small, face-first icons that read at 32px. */
export const CHARACTERS_EMOJI_SHEET: PromptOverrideKeyDef<CharactersStickerSheetCtx> = {
  key: "characters.emojiSheet",
  label: "Character Emoji Sheet",
  description:
    "Emoji sheet generated from a character or Persona gallery's Create with AI; each cell becomes its own custom emoji.",
  variables: CHARACTERS_STICKER_SHEET.variables,
  defaultBuilder: (ctx) =>
    [
      `Create a custom emoji sheet of ${ctx.name}'s face.`,
      `Canonical appearance: ${ctx.appearance.replace(/[.\s]+$/, "")}.`,
      stickerGridLine(ctx),
      "Each emoji is a simple, bold head-and-face icon of the same character with one exaggerated, instantly readable expression, designed to stay clear when shown very small.",
      "Bold shapes, strong outlines, few details, the head filling most of its cell and centered with a small even margin, never touching a neighbouring cell.",
      "Plain flat solid pure green (#00FF00) background everywhere, like a green screen, with no green in the emoji themselves; no grid lines, no frames, no text, no captions, no lettering.",
    ].join(" "),
  exampleContext: CHARACTERS_STICKER_SHEET.exampleContext,
};
