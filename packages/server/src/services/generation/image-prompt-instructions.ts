import { normalizeImagePromptInstructions } from "@marinara-engine/shared";

export function appendImagePromptInstructions(prompt: string, instructions: unknown): string {
  const normalizedInstructions = normalizeImagePromptInstructions(instructions);
  return normalizedInstructions
    ? `${prompt}\n\n<image_prompting_instructions>\nApply these image-backend instructions when writing the provider-ready prompt. They are instructions, not text to copy into the prompt:\n${normalizedInstructions}\n</image_prompting_instructions>`
    : prompt;
}
