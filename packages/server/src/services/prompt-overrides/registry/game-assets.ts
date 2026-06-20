// ──────────────────────────────────────────────
// Registered prompt-override keys: game-mode
// asset generation (NPC portraits, location
// backgrounds, VN scene illustrations).
// ──────────────────────────────────────────────
import type { PromptOverrideKeyDef } from "../types.js";

// ── NPC portrait ──
//
// The original builder has three small conditionals (whether the
// description is non-empty, whether the subject is non-human, whether
// art style is set). Conditional logic stays at the call site, which
// pre-computes the lines and passes them as variables. The default
// builder concatenates lines and drops empty ones via filter(Boolean).

export interface GameNpcPortraitCtx extends Record<string, string | number | undefined> {
  npcName: string;
  appearanceLine: string;
  nonHumanRule: string;
  artStyleLine: string;
  compositionRule: string;
}

export const GAME_NPC_PORTRAIT: PromptOverrideKeyDef<GameNpcPortraitCtx> = {
  key: "game.npcPortrait",
  description: "NPC portrait image prompt (in-game, when an NPC is introduced or recruited).",
  variables: [
    { name: "npcName", description: "Display name of the NPC.", example: "Lyra" },
    {
      name: "appearanceLine",
      description: "Pre-formatted appearance line, or empty string when no description exists.",
      example: "Canonical visual description from the current game: auburn hair, green eyes, leather jacket.",
    },
    {
      name: "nonHumanRule",
      description: "Pre-computed line guarding human vs non-human depiction (one of two strings).",
      example:
        "Unless the description explicitly says otherwise, depict this NPC as a human or humanoid person. Do not infer an animal species from the name, mood, speech verbs, or setting.",
    },
    {
      name: "artStyleLine",
      description: "Pre-formatted art style line, or empty string when the game has no art style set.",
      example: "Art style: Watercolor fantasy illustration, soft edges, warm palette, Ghibli-inspired.",
    },
    {
      name: "compositionRule",
      description: "Pre-computed composition instruction (humanoid avatar vs creature portrait).",
      example:
        "Use a centered human/humanoid avatar composition: face and shoulders, readable expression, clear outfit cues.",
    },
  ],
  defaultBuilder: (ctx) =>
    [
      ctx.appearanceLine,
      ctx.nonHumanRule,
      ctx.artStyleLine,
      ctx.compositionRule,
      `SD/Illustrious tags: solo, single character, portrait, upper body, centered composition, clean readable avatar.`,
      `Single subject only, one portrait, one face, one frame. High quality game avatar, clear readable design.`,
      `Avoid text, letters, captions, UI, watermarks, logos, signatures, speech bubbles, split panels, collage, contact sheet, multiple portraits, duplicated faces, and four-image grids.`,
    ]
      .filter(Boolean)
      .join(" "),
  exampleContext: {
    npcName: "Lyra",
    appearanceLine: "Canonical visual description from the current game: auburn hair, green eyes, leather jacket.",
    nonHumanRule:
      "Unless the description explicitly says otherwise, depict this NPC as a human or humanoid person. Do not infer an animal species from the name, mood, speech verbs, or setting.",
    artStyleLine: "Art style: Watercolor fantasy illustration, soft edges, warm palette, Ghibli-inspired.",
    compositionRule:
      "Use a centered human/humanoid avatar composition: face and shoulders, readable expression, clear outfit cues.",
  },
};

// ── Location background ──

export interface GameBackgroundCtx extends Record<string, string | number | undefined> {
  sceneDescription: string;
  styleLine: string;
}

export const GAME_BACKGROUND: PromptOverrideKeyDef<GameBackgroundCtx> = {
  key: "game.background",
  description: "Location background image prompt (in-game, on first visit to a new place).",
  variables: [
    {
      name: "sceneDescription",
      description: "GM/scene-analyzer description of the location.",
      example: "moonlit graveyard with crumbling tombstones",
    },
    {
      name: "styleLine",
      description: "Pre-formatted style line (artStyle + genre + setting), or empty string when nothing is set.",
      example:
        "Style: Watercolor fantasy illustration, soft edges, warm palette, Ghibli-inspired, fantasy, medieval kingdom.",
    },
  ],
  defaultBuilder: (ctx) =>
    `${ctx.sceneDescription}. ${ctx.styleLine} SD/Illustrious tags: scenery, environment, wide shot, landscape, full-frame background, no humans. Wide-angle landscape, detailed environment, single full-frame background, scenery only, no characters, no text, no UI, no panels, no collage, game background art, high quality`,
  exampleContext: {
    sceneDescription: "moonlit graveyard with crumbling tombstones",
    styleLine:
      "Style: Watercolor fantasy illustration, soft edges, warm palette, Ghibli-inspired, fantasy, medieval kingdom.",
  },
};

// ── Scene illustration (VN POV CG) ──
//
// Most lines are conditional on whether characters/references/art-style
// were provided. Pre-computed at the call site, joined with newlines,
// empty lines dropped.

export interface GameSceneIllustrationCtx extends Record<string, string | number | undefined> {
  sceneTitleLine: string;
  scenePrompt: string;
  narrativePurposeLine: string;
  charactersLine: string;
  referenceHandlingLine: string;
  appearanceNotesBlock: string;
  artDirectionLine: string;
  imagePromptInstructionsLine: string;
}

export const GAME_SCENE_ILLUSTRATION: PromptOverrideKeyDef<GameSceneIllustrationCtx> = {
  key: "game.sceneIllustration",
  description: "VN-style first-person POV CG illustration prompt (rare, story-defining moments only).",
  variables: [
    {
      name: "sceneTitleLine",
      description: "Pre-formatted visual subject sentence without a metadata label, or empty string.",
      example: "Lyra watching Korr fall after the moonlit duel.",
    },
    {
      name: "scenePrompt",
      description: "The exact illustrated moment, written by the scene-analyzer.",
      example: "the moonlit duel finally ends — Korr falls to one knee, sword in the dirt",
    },
    {
      name: "narrativePurposeLine",
      description: "Pre-formatted narrative reason line, or empty string.",
      example: "Narrative purpose: duel climax — major story beat.",
    },
    {
      name: "charactersLine",
      description: "Pre-formatted visible-characters line, or empty string.",
      example: "Characters: Lyra, Korr.",
    },
    {
      name: "referenceHandlingLine",
      description: "Pre-formatted reference-image instruction, or empty string when no references attached.",
      example:
        "Reference handling: attached character reference images are available. Use them to match faces, hair, build, colors, and distinctive features for the referenced characters.",
    },
    {
      name: "appearanceNotesBlock",
      description: "Pre-formatted appearance notes for visible characters without a reference, or empty string.",
      example:
        "Appearance notes for visible characters without an attached reference image:\n- Lyra: auburn hair, green eyes, leather jacket",
    },
    {
      name: "artDirectionLine",
      description: "Pre-formatted art direction line, or empty string.",
      example:
        "Art direction: Watercolor fantasy illustration, soft edges, warm palette, Ghibli-inspired, fantasy, medieval kingdom.",
    },
    {
      name: "imagePromptInstructionsLine",
      description: "Pre-formatted user image instructions line from chat settings, or empty string.",
      example: "User image instructions: Dottore's mask fully covers his eyes; do not render visible eyes behind it.",
    },
  ],
  defaultBuilder: (ctx) =>
    [
      "Image type: polished visual novel/game scene CG for one important current beat, not a selfie, comic page, manga panel, or background-only plate.",
      "Camera / POV: first-person view from the player protagonist's eyes. Do not show the protagonist except hands or arms when the moment explicitly requires them.",
      ctx.sceneTitleLine,
      `Scene moment: ${ctx.scenePrompt}`,
      ctx.narrativePurposeLine,
      ctx.charactersLine,
      ctx.referenceHandlingLine,
      ctx.appearanceNotesBlock,
      ctx.artDirectionLine,
      ctx.imagePromptInstructionsLine,
      "SD/Illustrious tags: visual novel CG, game CG, cinematic composition, full-frame single scene, dramatic lighting, clear focal point.",
      "Composition: cinematic 16:9 visual novel/game CG, one full-frame illustration, emotionally specific staging, clear focal point, high-quality finished scene art.",
      "Avoid: UI, subtitles, captions, speech bubbles, dialogue lettering, manga SFX, watermarks, logos, signatures, split panels, collage, contact sheet, character sheet, four-image grid, duplicated faces, and unrelated characters.",
    ]
      .filter(Boolean)
      .join("\n"),
  exampleContext: {
    sceneTitleLine: "Lyra watching Korr fall after the moonlit duel.",
    scenePrompt: "the moonlit duel finally ends — Korr falls to one knee, sword in the dirt",
    narrativePurposeLine: "Narrative purpose: duel climax — major story beat.",
    charactersLine: "Characters: Lyra, Korr.",
    referenceHandlingLine:
      "Reference handling: attached character reference images are available. Use them to match faces, hair, build, colors, and distinctive features for the referenced characters.",
    appearanceNotesBlock:
      "Appearance notes for visible characters without an attached reference image:\n- Lyra: auburn hair, green eyes, leather jacket",
    artDirectionLine:
      "Art direction: Watercolor fantasy illustration, soft edges, warm palette, Ghibli-inspired, fantasy, medieval kingdom.",
    imagePromptInstructionsLine:
      "User image instructions: Dottore's mask fully covers his eyes; do not render visible eyes behind it.",
  },
};
