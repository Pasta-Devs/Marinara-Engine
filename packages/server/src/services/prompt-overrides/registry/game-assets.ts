// ──────────────────────────────────────────────
// Registered prompt-override keys: game-mode
// asset generation (NPC portraits, location
// backgrounds, VN scene illustrations, and
// narration summarization for illustrations).
// ──────────────────────────────────────────────
import type { PromptOverrideKeyDef } from "../types.js";
import {
  GAME_VIDEO_PROMPT_TEMPLATE,
  GAME_VIDEO_PROMPT_TEMPLATE_VARIABLES,
  GAME_STORYBOARD_PROMPT_TEMPLATE_VARIABLES,
  GAME_STORYBOARD_STILL_PROMPT_TEMPLATE,
} from "@marinara-engine/shared";
import { renderTemplate } from "../template.js";

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
  description: "Location background image prompt for reusable Roleplay/Game scene backgrounds.",
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
    `${ctx.sceneDescription}. ${ctx.styleLine} SD/Illustrious tags: scenery, environment, wide shot, landscape, full-frame background, background-only location art. Wide-angle landscape, detailed environment, readable spatial layout, single full-frame background, no foreground characters, no main characters, no named characters, no posed character focus. Small distant crowds, shopkeepers, silhouettes, or background figures are allowed only when they make the location feel lived-in. No text, no UI, no panels, no collage, game background art, high quality`,
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
  description: "Game scene illustration prompt (rare, story-defining moments only).",
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
      ctx.sceneTitleLine,
      `Scene moment: ${ctx.scenePrompt}`,
      ctx.narrativePurposeLine,
      ctx.charactersLine,
      ctx.referenceHandlingLine,
      ctx.appearanceNotesBlock,
      ctx.artDirectionLine,
      ctx.imagePromptInstructionsLine,
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

// ── Narration summarizer (completed turn -> illustration prompt) ──

export interface GameNarrationSummarizerCtx extends Record<string, string | number | undefined> {
  gameContextBlock: string;
  currentIllustrationRequestJson: string;
  completedTurnNarration: string;
}

export const GAME_NARRATION_SUMMARIZER: PromptOverrideKeyDef<GameNarrationSummarizerCtx> = {
  key: "game.narrationSummarizer",
  description:
    "Game Mode narration summarizer instructions used before scene illustrations are turned into image prompts.",
  variables: [
    {
      name: "gameContextBlock",
      description:
        "Pre-formatted <game_context> block with state, location, weather, world, style, and user image notes.",
      example:
        "<game_context>\nMode: exploration\nLocation: moonlit graveyard with crumbling tombstones\nWeather: cold rain\nArt style: Watercolor fantasy illustration\n</game_context>",
    },
    {
      name: "currentIllustrationRequestJson",
      description: "JSON for the scene-analyzer's current illustration request before narration summarization.",
      example:
        '{\n  "title": "Lyra watching Korr fall",\n  "prompt": "the moonlit duel finally ends",\n  "characters": ["Lyra", "Korr"],\n  "reason": "duel climax",\n  "slug": "moonlit-duel"\n}',
    },
    {
      name: "completedTurnNarration",
      description:
        "The completed turn narration and dialogue after GM command tags are stripped and long turns are compacted.",
      example:
        "Korr drops to one knee in the rain, his sword biting into the mud. Lyra stands over him, shaking but unblinking, while shattered moonlight catches on the wet stones.",
    },
  ],
  defaultBuilder: () =>
    [
      "You are Marinara's Game Mode narration summarizer for the Illustrator.",
      "Read the completed turn narration and dialogue, then convert it into one concise image-generation prompt.",
      "Focus on the single strongest visible moment from the full turn: who is present, what they are doing, expressions, pose, composition, lighting, setting, mood, and player POV.",
      "Do not quote dialogue in the image prompt; translate spoken lines into visible expression, action, and relationship tension.",
      "Do not invent unseen characters, UI, text, captions, speech bubbles, watermarks, or logos.",
      "The player protagonist should not be visible unless the narration explicitly requires hands, arms, or body.",
      "Return strict JSON only with keys: title, prompt, characters, reason, slug.",
    ].join("\n"),
  exampleContext: {
    gameContextBlock:
      "<game_context>\nMode: exploration\nLocation: moonlit graveyard with crumbling tombstones\nWeather: cold rain\nArt style: Watercolor fantasy illustration\n</game_context>",
    currentIllustrationRequestJson:
      '{\n  "title": "Lyra watching Korr fall",\n  "prompt": "the moonlit duel finally ends",\n  "characters": ["Lyra", "Korr"],\n  "reason": "duel climax",\n  "slug": "moonlit-duel"\n}',
    completedTurnNarration:
      "Korr drops to one knee in the rain, his sword biting into the mud. Lyra stands over him, shaking but unblinking, while shattered moonlight catches on the wet stones.",
  },
};

// ── Dynamic image prompt director (draft prompt -> provider prompt) ──

export interface GameImagePromptDirectorCtx extends Record<string, string | number | undefined> {
  kindLabel: string;
  gameContextBlock: string;
  assetContextBlock: string;
  sourcePrompt: string;
  maxCharacters: number;
}

export const GAME_IMAGE_PROMPT_DIRECTOR: PromptOverrideKeyDef<GameImagePromptDirectorCtx> = {
  key: "game.imagePromptDirector",
  description:
    "Game Mode Prompt Director instructions that rewrite generated NPC portrait, background, and scene illustration prompts before image generation.",
  variables: [
    { name: "kindLabel", description: "Human-readable asset kind.", example: "NPC portrait" },
    {
      name: "gameContextBlock",
      description: "Pre-formatted <game_context> block with setting, current state, and art direction.",
      example:
        "<game_context>\nGenre: fantasy\nSetting: snowy alchemy fortress\nArt style: polished anime VN art\n</game_context>",
    },
    {
      name: "assetContextBlock",
      description: "Pre-formatted <asset_context> block describing the specific asset request.",
      example: "<asset_context>\nNPC: Lyra\nAppearance: auburn hair, green eyes, leather jacket\n</asset_context>",
    },
    {
      name: "sourcePrompt",
      description: "The deterministic draft prompt generated by Marinara before LLM rewriting.",
      example: "Lyra, auburn hair, green eyes, centered portrait...",
    },
    { name: "maxCharacters", description: "Maximum length for the returned positive prompt.", example: "1400" },
  ],
  defaultBuilder: (ctx) =>
    [
      "You are Marinara's Game Mode Image Prompt Director.",
      `Rewrite the provided draft into one optimized positive image-generation prompt for this ${ctx.kindLabel}.`,
      "Preserve canonical identity, setting, composition, art style, user instructions, and all important visual facts.",
      "For NPC portraits, the Appearance / Required canonical NPC visual profile lines are mandatory subject identity; carry those physical traits into the final prompt before adding style polish.",
      "Make the prompt concrete and provider-friendly: subject, pose/action, expression, camera/composition, setting, lighting, mood, materials, and style tags when useful.",
      "Do not add captions, dialogue text, UI, logos, watermarks, speech bubbles, manga SFX text, split panels, collage/contact-sheet language, or unrelated characters.",
      "Do not include a negative prompt. Do not mention hidden reasoning, policies, or that you rewrote the prompt.",
      `Keep the prompt under ${ctx.maxCharacters} characters.`,
      'Return strict JSON only: {"prompt":"positive prompt text"}.',
    ].join("\n"),
  exampleContext: {
    kindLabel: "NPC portrait",
    gameContextBlock:
      "<game_context>\nGenre: fantasy\nSetting: snowy alchemy fortress\nArt style: polished anime VN art\n</game_context>",
    assetContextBlock:
      "<asset_context>\nNPC: Lyra\nAppearance: auburn hair, green eyes, leather jacket\n</asset_context>",
    sourcePrompt: "Lyra, auburn hair, green eyes, centered portrait, polished anime VN art...",
    maxCharacters: 1400,
  },
};

// ── Turn storyboard directors (GM narration -> illustration or animation storyboard) ──

export interface GameStoryboardIllustratorCtx extends Record<string, string | number | undefined> {
  gameContextBlock: string;
  sourceSectionsBlock: string;
  sourceNarration: string;
  keyframeCount: number;
  durationSeconds: number;
  aspectRatio: string;
}

export const GAME_STORYBOARD_ILLUSTRATION_DIRECTOR: PromptOverrideKeyDef<GameStoryboardIllustratorCtx> = {
  key: "game.storyboardIllustrationDirector",
  label: "Game Mode Storyboard Illustrator",
  description:
    "Game Mode storyboard illustrator instructions that split one GM turn narration into keyframe image prompts.",
  variables: [
    {
      name: "gameContextBlock",
      description: "Pre-formatted context block with mode, location, weather, world, style, and image instructions.",
      example:
        "<game_context>\nMode: exploration\nLocation: moonlit graveyard\nWeather: cold rain\nArt style: manga ink and watercolor\n</game_context>",
    },
    {
      name: "sourceNarration",
      description: "The stripped GM narration for one completed Game Mode turn.",
      example: "Korr drops to one knee in the rain while Lyra steadies herself over the fallen blade.",
    },
    {
      name: "sourceSectionsBlock",
      description: "Pre-formatted <turn_sections> block with stable narration section indices from the reader UI.",
      example:
        '<turn_sections>\n<section index="0" kind="narration">Korr drops to one knee.</section>\n<section index="1" kind="dialogue" speaker="Lyra">Stay down.</section>\n</turn_sections>',
    },
    { name: "keyframeCount", description: "Target number of storyboard frames.", example: "4" },
    {
      name: "durationSeconds",
      description: "Unused for illustration-only planning; present for template compatibility.",
      example: "6",
    },
    { name: "aspectRatio", description: "Output aspect ratio.", example: "16:9" },
  ],
  defaultBuilder: (ctx) =>
    renderTemplate(GAME_STORYBOARD_STILL_PROMPT_TEMPLATE, ctx, GAME_STORYBOARD_PROMPT_TEMPLATE_VARIABLES),
  exampleContext: {
    gameContextBlock:
      "<game_context>\nMode: exploration\nLocation: moonlit graveyard\nWeather: cold rain\nArt style: manga ink and watercolor\n</game_context>",
    sourceSectionsBlock:
      '<turn_sections>\n<section index="0" kind="narration">Korr drops to one knee in the rain.</section>\n<section index="1" kind="dialogue" speaker="Lyra">Stay down.</section>\n</turn_sections>',
    sourceNarration: "Korr drops to one knee in the rain while Lyra steadies herself over the fallen blade.",
    keyframeCount: 4,
    durationSeconds: 6,
    aspectRatio: "16:9",
  },
};

// ── Game video prompt (scene illustration -> animated clip) ──

export interface GameVideoCtx extends Record<string, string | number | undefined> {
  sceneTitle: string;
  narrationSummary: string;
  illustrationPrompt: string;
  charactersLine: string;
  settingLine: string;
  artStyleLine: string;
  durationSeconds: number;
  aspectRatio: string;
  sourceIllustrationLine: string;
}

export const GAME_VIDEO: PromptOverrideKeyDef<GameVideoCtx> = {
  key: "game.video",
  legacyKeys: ["game.omniVideo"],
  description: "Game video prompt for animating a generated Game Mode or Gallery illustration.",
  variables: [
    { name: "sceneTitle", description: "Short scene title or visual subject.", example: "Moonlit duel aftermath" },
    {
      name: "narrationSummary",
      description: "Compact story beat from the latest visible scene narration.",
      example: "Korr kneels in the rain as Lyra steadies herself over the fallen blade.",
    },
    {
      name: "illustrationPrompt",
      description: "Excerpt from the prompt used for the source scene illustration.",
      example: "Visual novel CG, moonlit graveyard, rain, dramatic duel aftermath...",
    },
    {
      name: "charactersLine",
      description: "Raw visible character names or short continuity instruction.",
      example: "Lyra, Korr.",
    },
    {
      name: "settingLine",
      description: "Raw setting/location details.",
      example: "moonlit graveyard, cold rain, broken tombstones.",
    },
    {
      name: "artStyleLine",
      description: "Raw art style details.",
      example: "watercolor fantasy illustration, soft edges, warm palette.",
    },
    { name: "durationSeconds", description: "Requested video duration in seconds.", example: "10" },
    { name: "aspectRatio", description: "Requested video aspect ratio.", example: "16:9" },
    {
      name: "sourceIllustrationLine",
      description: "Pre-formatted reminder that the provided image is the first frame/reference.",
      example: "Use the provided scene illustration as the first frame/reference image.",
    },
  ],
  defaultBuilder: (ctx) => renderTemplate(GAME_VIDEO_PROMPT_TEMPLATE, ctx, GAME_VIDEO_PROMPT_TEMPLATE_VARIABLES),
  exampleContext: {
    sceneTitle: "Moonlit duel aftermath",
    narrationSummary: "Korr kneels in the rain as Lyra steadies herself over the fallen blade.",
    illustrationPrompt: "Visual novel CG, moonlit graveyard, rain, dramatic duel aftermath.",
    charactersLine: "Lyra, Korr.",
    settingLine: "moonlit graveyard, cold rain, broken tombstones.",
    artStyleLine: "watercolor fantasy illustration, soft edges, warm palette.",
    durationSeconds: 10,
    aspectRatio: "16:9",
    sourceIllustrationLine: "Use the provided scene illustration as the first frame/reference image.",
  },
};
