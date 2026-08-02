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
    "Template that assembles the final image-generation prompt. Everything this produces is sent to the image model verbatim — no LLM pass runs after it. The default sends the visual idea, appearance notes, and character image habits, without the post text or your Noodle image instructions (those are given to the timeline model instead).",
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
      description: "Optional character appearance or description notes included by Noodle Settings.",
      example: "Character appearance notes:\nDottore's Appearance: tall, slim build, blue hair, red eyes, mask.",
    },
    {
      name: "characterPersonality",
      description: "The current posting character's personality and traits.",
      example: "precise, arrogant, intensely curious, impatient with staged sentimentality",
    },
    {
      name: "characterImageInstructions",
      description: "Opted-in image habits and preferences from the current posting character's card.",
      example: "Shares stark lab photography with cold lighting and deliberately clinical framing.",
    },
  ],
  defaultBuilder: (ctx) =>
    [
      ctx.draftPrompt.trim() || `A social-media-ready image posted by ${ctx.authorName}.`,
      ctx.characterDescription,
      // Bare values only: labels and "let these traits influence..." framing are instructions to a
      // language model, and nothing downstream re-reads this string — it goes to the image model.
      ctx.characterPersonality,
      ctx.characterImageInstructions,
    ]
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
