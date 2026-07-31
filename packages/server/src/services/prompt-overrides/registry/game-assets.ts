// ──────────────────────────────────────────────
// Registered prompt-override keys: game-mode
// asset generation (NPC portraits, location
// backgrounds, VN scene illustrations, and
// narration summarization for illustrations).
// ──────────────────────────────────────────────
import type { PromptOverrideKeyDef } from "../types.js";
import { GAME_VIDEO_PROMPT_TEMPLATE, GAME_VIDEO_PROMPT_TEMPLATE_VARIABLES } from "@marinara-engine/shared";
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

// ── World Maps location artwork ──

export interface MapsLocationArtworkCtx extends Record<string, string | number | undefined> {
  locationName: string;
  locationDescription: string;
  locationType: string;
  parentLocationName: string;
  parentLocationDescription: string;
  locationPath: string;
  locationPrompt: string;
  genre: string;
  genreLine: string;
  campaignArtStyle: string;
  campaignArtStyleLine: string;
  imageInstructions: string;
  imageInstructionsLine: string;
}

export const MAPS_LOCATION_ARTWORK: PromptOverrideKeyDef<MapsLocationArtworkCtx> = {
  key: "maps.locationArtwork",
  label: "Maps location artwork",
  description:
    "Automatic World Maps location and child-map artwork. Engine style profiles and global positive/negative image settings are applied after this template.",
  variables: [
    { name: "locationName", description: "The location name.", example: "Moonwell Floor" },
    {
      name: "locationDescription",
      description: "The location's public description from World Maps.",
      example: "A quiet tiled bath beneath blue crystals.",
    },
    { name: "locationType", description: "The configured Maps hierarchy type.", example: "Floor" },
    {
      name: "parentLocationName",
      description: "The direct parent location name, or empty for a root location.",
      example: "Ascendant Spire",
    },
    {
      name: "parentLocationDescription",
      description: "The direct parent's public description, or empty for a root location.",
      example: "A colossal shifting dungeon tower.",
    },
    {
      name: "locationPath",
      description: "The full Maps breadcrumb from root to this location.",
      example: "Asterreach > Ascendant Spire > Moonwell Floor",
    },
    {
      name: "locationPrompt",
      description: "The complete fallback prompt prepared by World Maps for this location.",
      example:
        "Wide establishing image of Moonwell Floor. A quiet tiled bath beneath blue crystals. Show the environment, architecture, lighting, palette, and stable landmarks clearly. No text.",
    },
    {
      name: "genre",
      description: "The raw Game genre text, or empty outside Game mode.",
      example: "Fantasy, Anime JRPG dungeon crawler",
    },
    {
      name: "genreLine",
      description: "The Game genre with terminal punctuation, or empty outside Game mode.",
      example: "Fantasy, Anime JRPG dungeon crawler.",
    },
    {
      name: "campaignArtStyle",
      description: "The raw campaign art style when Use campaign art style is on, otherwise empty.",
      example: "Luminous violet anime fantasy illustration",
    },
    {
      name: "campaignArtStyleLine",
      description: "A formatted campaign art-style line when enabled, otherwise empty.",
      example: "Campaign art style: Luminous violet anime fantasy illustration.",
    },
    {
      name: "imageInstructions",
      description: "The raw saved image instructions from Chat Settings, or empty.",
      example: "Use ornate brass machinery and deep blue reflections.",
    },
    {
      name: "imageInstructionsLine",
      description: "A formatted Chat Settings image-instructions line, or empty.",
      example: "User image instructions: Use ornate brass machinery and deep blue reflections.",
    },
  ],
  defaultBuilder: (ctx) =>
    [ctx.locationPrompt, ctx.genreLine, ctx.campaignArtStyleLine, ctx.imageInstructionsLine]
      .filter(Boolean)
      .join(" "),
  exampleContext: {
    locationName: "Moonwell Floor",
    locationDescription: "A quiet tiled bath beneath blue crystals.",
    locationType: "Floor",
    parentLocationName: "Ascendant Spire",
    parentLocationDescription: "A colossal shifting dungeon tower.",
    locationPath: "Asterreach > Ascendant Spire > Moonwell Floor",
    locationPrompt:
      "Wide establishing image of Moonwell Floor. A quiet tiled bath beneath blue crystals. Show the environment, architecture, lighting, palette, and stable landmarks clearly. No text.",
    genre: "Fantasy, Anime JRPG dungeon crawler",
    genreLine: "Fantasy, Anime JRPG dungeon crawler.",
    campaignArtStyle: "Luminous violet anime fantasy illustration",
    campaignArtStyleLine: "Campaign art style: Luminous violet anime fantasy illustration.",
    imageInstructions: "Use ornate brass machinery and deep blue reflections.",
    imageInstructionsLine: "User image instructions: Use ornate brass machinery and deep blue reflections.",
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
  finalVisibilityRuleLine: string;
  narrativePurposeLine: string;
  charactersLine: string;
  referenceHandlingLine: string;
  locationHandlingLine: string;
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
      description: "The exact illustrated moment written by the scene-analyzer, without visibility metadata.",
      example: "the moonlit duel finally ends — Korr falls to one knee, sword in the dirt",
    },
    {
      name: "finalVisibilityRuleLine",
      description: "Pre-formatted final visible-character constraint, or empty string.",
      example: "Final visibility rule: Only depict these named visible characters: Lyra, Korr.",
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
      description: "Pre-formatted character-reference instruction, or empty string when no character images are attached.",
      example:
        "Reference handling: attached character reference images are available. Use them to match faces, hair, build, colors, and distinctive features for the referenced characters.",
    },
    {
      name: "locationHandlingLine",
      description: "Pre-formatted location-reference instruction, or empty string when no location image is attached.",
      example:
        "Location handling: an attached location reference image is available. Use it to set the scene location.",
    },
    {
      name: "appearanceNotesBlock",
      description: "Pre-formatted matched character-card appearance notes, or empty string.",
      example: "Character appearance notes:\nLyra's Appearance: auburn hair, green eyes, leather jacket",
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
      ctx.finalVisibilityRuleLine,
      ctx.narrativePurposeLine,
      ctx.charactersLine,
      ctx.referenceHandlingLine,
      ctx.locationHandlingLine,
      ctx.appearanceNotesBlock,
      ctx.artDirectionLine,
      ctx.imagePromptInstructionsLine,
    ]
      .filter(Boolean)
      .join("\n"),
  exampleContext: {
    sceneTitleLine: "Lyra watching Korr fall after the moonlit duel.",
    scenePrompt: "the moonlit duel finally ends — Korr falls to one knee, sword in the dirt",
    finalVisibilityRuleLine: "Final visibility rule: Only depict these named visible characters: Lyra, Korr.",
    narrativePurposeLine: "Narrative purpose: duel climax — major story beat.",
    charactersLine: "Characters: Lyra, Korr.",
    referenceHandlingLine:
      "Reference handling: attached character reference images are available. Use them to match faces, hair, build, colors, and distinctive features for the referenced characters.",
    locationHandlingLine:
      "Location handling: an attached location reference image is available. Use it to set the scene location.",
    appearanceNotesBlock: "Character appearance notes:\nLyra's Appearance: auburn hair, green eyes, leather jacket",
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
  latestTurnBlock: string;
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
      name: "latestTurnBlock",
      description:
        "Pre-formatted <latest_gm_turn> block used as the primary scene source for Game backgrounds, or an empty string for other asset kinds.",
      example:
        "<latest_gm_turn>\nRain lashes the glass-roofed station while blue signal lamps flicker over the abandoned platforms.\n</latest_gm_turn>",
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
      "For location backgrounds, when a latest GM turn is provided, treat it as the primary source for the visible environment; use the deterministic draft only as supporting context.",
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
    latestTurnBlock: "",
    sourcePrompt: "Lyra, auburn hair, green eyes, centered portrait, polished anime VN art...",
    maxCharacters: 1400,
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
