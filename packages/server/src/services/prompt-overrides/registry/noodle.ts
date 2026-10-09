// ──────────────────────────────────────────────
// Registered prompt-override keys: Noodle social feed
// ──────────────────────────────────────────────
import type { PromptOverrideKeyDef } from "../types.js";
import { NOODLE_TIMELINE_BASE_DEFAULT_PROMPT, noodleTimelineVoiceDefaultText } from "../../noodle/noodle-prompt.js";

export interface NoodleImagePostCtx extends Record<string, string | number | undefined> {
  authorName: string;
  postContent: string;
  draftPrompt: string;
  userInstructions: string;
  characterDescription: string;
  characterImageInstructions: string;
  characterPersonality: string;
}

export const NOODLE_IMAGE_POST: PromptOverrideKeyDef<NoodleImagePostCtx> = {
  key: "noodle.imagePost",
  label: "Noodle Post Image",
  description:
    "Template that assembles the base image-generation prompt. When the selected image connection has image instructions, Marinara first tries to have an agent text model apply them; if rewriting is unavailable, the prompt is sent without them. The default sends the visual idea and appearance notes, without the post text, your Noodle image instructions (those are also given to the timeline model), or the character's personality and image habits (those are given to the agent text model).",
  variables: [
    { name: "authorName", description: "Display name of the Noodle account posting.", example: "Dottore" },
    {
      name: "postContent",
      description: "The Noodle post text, available for custom templates but omitted by the default image prompt.",
      example: "I left one meeting unattended for six minutes and returned to theatrical accusations.",
    },
    {
      name: "draftPrompt",
      description: "The timeline writer's initial image idea for this post.",
      example: 'Meme image: Dottore staring at a ruined lab bench, caption text "six minutes unsupervised" at the top',
    },
    {
      name: "userInstructions",
      description:
        "Noodle image instructions from Noodle Settings. These go to the timeline model when it writes the visual idea, so the default template no longer appends them to the image prompt. Still available for custom templates.",
      example:
        "Create either a social-media-ready character image or a meme. Mention build, clothing, appearance, pose, expression, setting, lighting, mood, composition, meme format, and short visible meme text when relevant.",
    },
    {
      name: "characterDescription",
      description:
        "Character appearance notes from Include descriptions in Noodle Settings. Empty in the prompt an agent text model rewrites, because that model gets them as character context instead.",
      example: "Character appearance notes:\nDottore's Appearance: tall, slim build, blue hair, red eyes, mask.",
    },
    {
      name: "characterPersonality",
      description:
        "The current posting character's personality and traits. These go to the agent text model that rewrites the image prompt, so the default template no longer adds them to the image prompt. Still available for custom templates.",
      example: "precise, arrogant, intensely curious, impatient with staged sentimentality",
    },
    {
      name: "characterImageInstructions",
      description:
        "Opted-in image habits and preferences from the current posting character's card. These go to the agent text model that rewrites the image prompt, so the default template no longer adds them to the image prompt. Still available for custom templates.",
      example: "Shares stark lab photography with cold lighting and deliberately clinical framing.",
    },
  ],
  // Picture content only. The poster's personality and image habits guide the model that rewrites
  // this prompt; pasted here they reached the image model as stray words (Pasta-Devs/Marinara-Agents#1278).
  defaultBuilder: (ctx) =>
    [ctx.draftPrompt.trim() || `A social-media-ready image posted by ${ctx.authorName}.`, ctx.characterDescription]
      .map((part) => part.trim())
      .filter(Boolean)
      .join("\n\n"),
  exampleContext: {
    authorName: "Dottore",
    postContent: "I left one meeting unattended for six minutes and returned to theatrical accusations.",
    draftPrompt:
      'Meme image: Dottore staring at a ruined lab bench, caption text "six minutes unsupervised" at the top',
    userInstructions:
      "Create either a social-media-ready character image or a meme. Mention build, clothing, appearance, pose, expression, setting, lighting, mood, composition, meme format, and short visible meme text when relevant.",
    characterDescription:
      "Character appearance notes:\nDottore's Appearance: tall, slim build, blue hair, red eyes, mask.",
    characterPersonality: "precise, arrogant, intensely curious, impatient with staged sentimentality",
    characterImageInstructions: "Shares stark lab photography with cold lighting and clinical framing.",
  },
};

export type NoodleTimelineBaseCtx = Record<string, string | number | undefined>;

export const NOODLE_TIMELINE_BASE: PromptOverrideKeyDef<NoodleTimelineBaseCtx> = {
  key: "noodle.timelineBase",
  label: "Noodle Timeline Prompt",
  description:
    "The editable base system prompt used for Noodle timeline refreshes. Timeline voice and tone instructions are appended after this prompt.",
  variables: [],
  defaultBuilder: () => NOODLE_TIMELINE_BASE_DEFAULT_PROMPT,
  exampleContext: {},
};

export interface NoodleTimelineVoiceCtx extends Record<string, string | number | undefined> {
  /** Mirrors the Noodle setting `enableEnhancedTimelineWriting` ("true"/"false"). Only affects the
   *  unedited default text — once a user customizes this override, their text always wins. */
  enhanced: string;
  allowRandomUsers?: string;
}

export const NOODLE_TIMELINE_VOICE: PromptOverrideKeyDef<NoodleTimelineVoiceCtx> = {
  key: "noodle.timelineVoice",
  label: "Noodle Timeline Voice & Tone",
  description:
    "Tone and creative-freedom instructions for Noodle timeline refreshes: how much personality/attitude each account's voice should carry, and how much accounts may banter, joke, or clash with each other. This text is appended after the editable Noodle Timeline Prompt.",
  variables: [],
  defaultBuilder: (ctx) => noodleTimelineVoiceDefaultText(ctx.enhanced === "true", ctx.allowRandomUsers !== "false"),
  exampleContext: { enhanced: "false", allowRandomUsers: "true" },
};
