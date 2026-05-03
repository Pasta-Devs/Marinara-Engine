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
  appearance: string;
  charName: string;
  /**
   * Either an empty string (when the chat has no selfie tags) or
   * a leading-newline-prefixed line, e.g.
   * "\nAlways include these tags/modifiers in the prompt: masterpiece, best quality"
   */
  selfieTagsBlock: string;
}

export const CONVERSATION_SELFIE: PromptOverrideKeyDef<ConversationSelfieCtx> = {
  key: "conversation.selfie",
  description: "Meta-prompt that asks the chat LLM to write a selfie image prompt for the active character.",
  variables: [
    {
      name: "appearance",
      description: "Character appearance text.",
      example: "auburn hair, green eyes, leather jacket, mid-twenties, athletic build",
    },
    { name: "charName", description: "Character display name.", example: "Lyra" },
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
      `The character's appearance: ${ctx.appearance}`,
      `Character name: ${ctx.charName}`,
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
    charName: "Lyra",
    selfieTagsBlock: "\n\nAlways include these tags/modifiers in the prompt: masterpiece, best quality, sharp focus",
  },
};
