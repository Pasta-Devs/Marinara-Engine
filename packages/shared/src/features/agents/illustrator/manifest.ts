import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

const illustratorOutputFormat = `Return valid JSON only:
{
  "shouldGenerate": boolean,
  "reason": "why generate or why not",
  "prompt": "detailed prompt if shouldGenerate is true",
  "negativePrompt": "what to avoid",
  "style": "visual style",
  "aspectRatio": "landscape|portrait|square",
  "characters": ["visible character name"]
}`;

const baseDecisionRules = `Anchor the decision to <assistant_response>, the latest assistant turn. Use recent context only for continuity.
Generate only for a visually important moment: dramatic action, key emotion, major reveal, transformation, important location, or newly described character. If not worth illustrating, set shouldGenerate false and keep prompt empty.
Describe every visible character/persona directly in the prompt. The image model has no memory. Put all visible names in characters.`;

function createIllustratorPrompt(style: string, rules: string): string {
  return `${baseDecisionRules}
Style target: ${style}
Rules: ${rules}
No prose outside the JSON.
${illustratorOutputFormat}`;
}

const standardNegativePrompt =
  "watermark, logo, signature, UI, subtitles, captions, malformed hands, extra limbs, blurry, low quality";
const textPositiveNegativePrompt =
  "watermark, logo, signature, UI chrome, unreadable text, broken lettering, malformed speech bubbles, blurry, low quality";

export const illustratorAgentManifest = {
  id: "illustrator",
  name: "Illustrator",
  description: "Generates image prompts for key scenes (requires image generation API).",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  defaultTools: [],
  defaultSettings: {
    defaultPromptTemplateName: "Illustration",
    defaultPromptTemplateDescription: "Polished single-scene illustration for important visual beats.",
    useAvatarReferences: false,
    includeCharacterAppearance: false,
  },
  promptTemplates: [
    {
      id: "comic-page",
      name: "Comic Page",
      description: "Panelled comic page with dialogue, captions, and SFX.",
      promptTemplate: createIllustratorPrompt(
        "colored comic page, 2-6 panels, cinematic panel flow, expressive speech bubbles, captions, and SFX lettering",
        `Build the prompt as a complete comic page. Include panel count, panel composition, camera framing, mood, lighting, and action flow.
The prompt must include a short readable text plan: dialogue bubbles for spoken lines, captions for narration/reaction beats, and SFX lettering for action. Draw text from the scene and keep it brief.
Use the negativePrompt: ${textPositiveNegativePrompt}.`,
      ),
    },
    {
      id: "colored-manga",
      name: "Colored Manga",
      description: "Colored manga scene with stylized dialogue and SFX.",
      promptTemplate: createIllustratorPrompt(
        "colored manga, dynamic panel-inspired composition, cell shading, flat color, screentone texture, manga speech bubbles and SFX",
        `Build the prompt as a vivid colored manga illustration or page beat. Include expressive poses, panel-like staging, speed lines, impact frames, screentones, and dramatic lighting.
The prompt must include a short readable text plan: manga dialogue bubbles for spoken lines, captions for narration/reaction beats, and SFX for action. Use text from the scene.
Use the negativePrompt: ${textPositiveNegativePrompt}.`,
      ),
    },
    {
      id: "bw-manga",
      name: "B&W Manga",
      description: "Black-and-white manga with dialogue, SFX, inks, and screentones.",
      promptTemplate: createIllustratorPrompt(
        "black-and-white manga page, inked line art, screentones, heavy blacks, speed lines, speech bubbles, and hand-lettered SFX",
        `Build the prompt as a B&W manga beat with strong line weight, screentone shading, dramatic shadows, panel language, and crisp silhouettes.
The prompt must include a short readable text plan: dialogue bubbles for spoken lines, captions for narration/reaction beats, and SFX for action. Use text from the scene.
Use the negativePrompt: ${textPositiveNegativePrompt}, color painting, full-color render.`,
      ),
    },
    {
      id: "background",
      name: "Background",
      description: "Environment or establishing-shot background without characters.",
      promptTemplate: createIllustratorPrompt(
        "polished environment background, establishing shot, visual novel/game background quality",
        `Generate a background-only prompt for the current important location or atmosphere. Focus on architecture, nature, props, weather, lighting, time of day, mood, and readable spatial layout.
Do not include characters, portraits, crowds, dialogue, captions, SFX, UI, or signs unless the sign is essential to the location. Return characters as [].
Use the negativePrompt: ${standardNegativePrompt}, people, character, portrait, crowd.`,
      ),
    },
    {
      id: "selfie",
      name: "Selfie",
      description: "In-character selfie or casual portrait prompt.",
      promptTemplate: createIllustratorPrompt(
        "in-character selfie, casual portrait, phone camera framing, intimate social snapshot",
        `Generate a portrait/selfie prompt for the character who would naturally take or send it in the latest moment. Include camera angle, expression, pose, outfit, environment hints, lighting, and phone/selfie framing when appropriate.
Do not include speech bubbles, captions, manga SFX, UI, watermark, logo, or meta-instructions.
Use portrait aspect ratio unless the scene clearly needs another framing. Use the negativePrompt: ${standardNegativePrompt}.`,
      ),
    },
  ],
  runInterval: 5,
} satisfies BuiltInAgentManifest;
