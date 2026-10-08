import type { ConversationSelfieCtx } from "../prompt-overrides/index.js";
import { CONVERSATION_SELFIE, loadPrompt, renderTemplate } from "../prompt-overrides/index.js";
import { SELFIE_OVERRIDE_INSTRUCTION_LINES } from "../prompt-overrides/registry/conversation.js";
import type { PromptOverridesStorage } from "../storage/prompt-overrides.storage.js";

export async function resolveConversationSelfieSystemPrompt(input: {
  promptOverridesStorage: PromptOverridesStorage;
  chatPromptTemplate?: string | null;
  appearance: string;
  /** Enabled image-prompt appearance override, empty when the card has none (#7243). */
  imageAppearance?: string;
  charName: string;
  characterImageInstructions?: string;
  personality?: string;
  selfieTagsBlock?: string;
}): Promise<string> {
  const promptContext: ConversationSelfieCtx = {
    appearance: input.appearance,
    imageAppearance: input.imageAppearance?.trim() ?? "",
    charName: input.charName,
    characterImageInstructions: input.characterImageInstructions?.trim() ?? "",
    personality: input.personality?.trim() ?? "",
    selfieTagsBlock: input.selfieTagsBlock ?? "",
  };
  const declared = CONVERSATION_SELFIE.variables.map((variable) => variable.name);

  const renderCustom = (template: string): string => {
    // #7258: custom templates saved before `${imageAppearance}` existed only reference
    // `${appearance}`, which used to carry the override. Keep that meaning for them so
    // their override (e.g. a LoRA trigger) is not silently dropped.
    if (!template.includes("${imageAppearance}")) {
      const ctx = promptContext.imageAppearance
        ? { ...promptContext, appearance: promptContext.imageAppearance }
        : promptContext;
      return renderTemplate(template, ctx, declared);
    }
    // A template copied from the default holds the override block as plain text. With no
    // override on the card, drop exactly those default lines, as the default builder does.
    // User-written lines are kept; their `${imageAppearance}` just renders empty.
    if (!promptContext.imageAppearance) {
      const blockLines = new Set<string>(SELFIE_OVERRIDE_INSTRUCTION_LINES);
      template = template
        .split("\n")
        .filter((line) => !blockLines.has(line.trim()))
        .join("\n");
    }
    return renderTemplate(template, promptContext, declared);
  };

  const chatPromptTemplate = input.chatPromptTemplate?.trim() ?? "";
  if (chatPromptTemplate) return renderCustom(chatPromptTemplate);

  return loadPrompt(input.promptOverridesStorage, CONVERSATION_SELFIE, promptContext, renderCustom);
}
