// ──────────────────────────────────────────────
// Registered prompt-override keys: conversation-
// mode features (selfies, etc.)
// ──────────────────────────────────────────────
import type { PromptOverrideKeyDef } from "../types.js";

// ── Selfie wrapper ──
//
// The text LLM is asked to write the actual image prompt; this is the
// system prompt that drives that meta-step. The conditional "include
// these tags" line is pre-computed at the call site.

export interface ConversationSelfieCtx extends Record<string, string | number | undefined> {
  /** The character's own appearance text, from the card. Always present when the card has any. */
  appearance: string;
  /**
   * The card's Image Appearance Override (#7053), when one is enabled and non-empty
   * (#7243). Empty otherwise, and the block falls away — the same way `personality`
   * and `characterImageInstructions` do.
   *
   * Kept separate from `appearance` on purpose. Folding it in left the prompt-builder
   * with a bare override (for a ComfyUI LoRA user, one unexplained token) and no
   * visual context, so it discarded the token and invented a look.
   */
  imageAppearance: string;
  charName: string;
  characterImageInstructions: string;
  personality: string;
  /**
   * Chat-level selfie tags to append to the meta-prompt. Currently always ""
   * at runtime — none of the call sites (resolveConversationSelfieSystemPrompt
   * callers) populate this field.
   */
  selfieTagsBlock: string;
}

/** Label of the default builder's override line; the override value follows it. */
export const SELFIE_OVERRIDE_LINE_LABEL =
  "Image appearance override — this MUST appear in your prompt exactly as written, character for character: ";

/**
 * The default builder's override block as it appears in a template copied from the
 * editor. Exported so such templates can drop it when a card has no override (see
 * `resolveConversationSelfieSystemPrompt`).
 */
export const SELFIE_OVERRIDE_INSTRUCTION_LINES = [
  `${SELFIE_OVERRIDE_LINE_LABEL}\${imageAppearance}`,
  `Do not reword, reorder, translate, or omit any part of the override above, even if a tag is not a word you recognize. It may be a LoRA trigger or another identifier the image model needs verbatim.`,
  `If this prompt describes the character anywhere else, treat that as background information: use it to fill in visual details the override does not cover, such as build, clothing and expression. Never contradict the override with it, and do not repeat or paraphrase any tag the override already contains.`,
] as const;

export const CONVERSATION_SELFIE: PromptOverrideKeyDef<ConversationSelfieCtx> = {
  key: "conversation.selfie",
  description: "Meta-prompt that asks the chat LLM to write a selfie image prompt for the active character.",
  variables: [
    {
      name: "appearance",
      description: "Character appearance text.",
      example: "auburn hair, green eyes, leather jacket, mid-twenties, athletic build",
    },
    {
      name: "imageAppearance",
      description:
        "The card's Image Appearance Override, when one is enabled and filled in. Empty otherwise. Must be reproduced in the prompt exactly as written.",
      example: "savvyphoto, 1girl, silver hair, red eyes",
    },
    { name: "charName", description: "Character display name.", example: "Lyra" },
    {
      name: "personality",
      description: "Character personality and traits that should influence the selfie naturally.",
      example: "reserved, observant, fascinated by old architecture",
    },
    {
      name: "characterImageInstructions",
      description: "Optional character-specific image quality, subject, camera, and composition instructions.",
      example: "Uses grainy 35mm film and prefers candid, imperfect framing.",
    },
    {
      name: "selfieTagsBlock",
      description:
        "Pre-formatted block listing chat-level selfie tags. Empty when none, otherwise begins with two newlines to preserve the blank line above.",
      example: "\n\nAlways include these tags/modifiers in the prompt: masterpiece, best quality, sharp focus",
    },
  ],
  defaultBuilder: (ctx) =>
    [
      `You are an image prompt generator. Create a concise, detailed image generation prompt for a selfie photo.`,
      // Emitted only when the card actually has appearance text, so a card with none
      // never produces a dangling "The character's appearance:" line.
      ...(ctx.appearance ? [`The character's appearance: ${ctx.appearance}`] : []),
      // #7243: the override is authoritative and must survive the rewrite verbatim —
      // a LoRA trigger has no visual meaning, so a model left to interpret it drops
      // it. The instruction sits next to the override so the two cannot drift apart,
      // and the whole block falls away when no override is set.
      ...(ctx.imageAppearance
        ? [`${SELFIE_OVERRIDE_LINE_LABEL}${ctx.imageAppearance}`, ...SELFIE_OVERRIDE_INSTRUCTION_LINES.slice(1)]
        : []),
      `Character name: ${ctx.charName}`,
      ...(ctx.personality
        ? [
            `Character personality and traits: ${ctx.personality}`,
            `Let those traits naturally affect the subject, expression, quality, camera habits, and composition.`,
          ]
        : []),
      ...(ctx.characterImageInstructions
        ? [`Character-specific image instructions: ${ctx.characterImageInstructions}`]
        : []),
      ``,
      `Generate a prompt that describes a selfie photo of this character. Include:`,
      `- Physical appearance details (face, hair, eyes, skin)`,
      `- What they're wearing`,
      `- Expression and pose (selfie angle)`,
      `- Setting/background from context`,
      `- Lighting and mood`,
      ``,
      `Infer the appropriate art style from the character. For example, anime/game characters should use anime/illustration style, realistic characters should use photorealistic style. Match the style to the character's origin.${ctx.selfieTagsBlock}`,
      `Output ONLY the prompt text, nothing else.`,
    ].join("\n"),
  exampleContext: {
    appearance: "auburn hair, green eyes, leather jacket, mid-twenties, athletic build",
    // Deliberately NON-empty. The editor rebuilds the editable default by
    // string-replacing each example value back into its `${token}` form, so a
    // variable whose example is empty renders no block and can never appear in the
    // template box or the rendered preview — and "Reset to Default" would hand the
    // user a template that silently drops the override. Keep every example here
    // non-empty and distinct from the others.
    imageAppearance: "savvyphoto, 1girl, silver hair, red eyes",
    charName: "Lyra",
    personality: "reserved, observant, fascinated by old architecture",
    characterImageInstructions: "Uses grainy 35mm film and prefers candid, imperfect framing.",
    selfieTagsBlock: "\n\nAlways include these tags/modifiers in the prompt: masterpiece, best quality, sharp focus",
  },
};
