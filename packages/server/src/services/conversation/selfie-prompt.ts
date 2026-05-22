import type { ConversationSelfieCtx } from "../prompt-overrides/index.js";
import { CONVERSATION_SELFIE, loadPrompt, renderTemplate } from "../prompt-overrides/index.js";
import type { PromptOverridesStorage } from "../storage/prompt-overrides.storage.js";

export async function resolveConversationSelfieSystemPrompt(input: {
  promptOverridesStorage: PromptOverridesStorage;
  chatPromptTemplate?: string | null;
  appearance: string;
  charName: string;
  selfieTagsBlock?: string;
}): Promise<string> {
  const promptContext: ConversationSelfieCtx = {
    appearance: input.appearance,
    charName: input.charName,
    selfieTagsBlock: input.selfieTagsBlock ?? "",
  };
  const chatPromptTemplate = input.chatPromptTemplate?.trim() ?? "";

  if (chatPromptTemplate) {
    return renderTemplate(
      chatPromptTemplate,
      promptContext,
      CONVERSATION_SELFIE.variables.map((variable) => variable.name),
    );
  }

  return loadPrompt(input.promptOverridesStorage, CONVERSATION_SELFIE, promptContext);
}
