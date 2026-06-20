import type { CharacterPromptInfo } from "./character-prompt-context.js";

type GenerationPromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function injectSceneContextMessages({
  messages,
  chatMetadata,
  charInfo,
  personaName,
}: {
  messages: GenerationPromptMessage[];
  chatMetadata: Record<string, unknown>;
  charInfo: CharacterPromptInfo[];
  personaName: string;
}): void {
  const charNames = charInfo.map((character) => character.name);
  const isGroup = charNames.length > 1;

  const roleText = isGroup
    ? [
        `<role>`,
        `You are ${charNames.join(", ")}; real and autonomous people, roleplaying with the user called ${personaName} in a scene.`,
        `</role>`,
      ].join("\n")
    : [
        `<role>`,
        `You are ${charNames[0] ?? "the character"}, a real and autonomous person, roleplaying with the user called ${personaName} in a scene.`,
        `</role>`,
      ].join("\n");

  const sceneScenario = chatMetadata.sceneScenario as string | undefined;
  const scenarioText = sceneScenario ? [`<scenario>`, sceneScenario, `</scenario>`].join("\n") : "";

  const sceneConvoCtx = chatMetadata.sceneConversationContext as string | undefined;
  const sceneRelHistory = chatMetadata.sceneRelationshipHistory as string | undefined;
  const awarenessLines: string[] = [];
  if (sceneRelHistory) {
    awarenessLines.push(`## Relationship History`, sceneRelHistory, ``);
  }
  if (sceneConvoCtx) {
    awarenessLines.push(
      `## Conversation Context`,
      `The following is a transcript of the conversation that led up to this scene:`,
      sceneConvoCtx,
    );
  }
  const awarenessText = awarenessLines.length > 0 ? [`<awareness>`, ...awarenessLines, `</awareness>`].join("\n") : "";

  const sceneSystemPrompt = chatMetadata.sceneSystemPrompt as string | undefined;
  const sceneSysText = sceneSystemPrompt
    ? [`<scene_instructions>`, sceneSystemPrompt, `</scene_instructions>`].join("\n")
    : "";

  const outputFormatText = [
    `<output_format>`,
    `When you respond in the conversation:`,
    `- Think about it first and internalize your instructions.`,
    `- Continue directly with new content from the final line of the last message. You don't have to address everything from it; this is a creative freeform piece, so prioritize organic flow. Favor characterizations driven by the chat history over the static character descriptions. Explicit content is allowed, no plot armor. Don't play for ${personaName}.`,
    `- The response length should be flexible, based on the current scene. During a conversation between you and the user, you have two options:`,
    `  (1) ONLY respond with a dialogue line plus an optional dialogue tag/action beat, and stop, creating space for a dynamic back-and-forth.`,
    `  (2) Continue into a longer response provided the conversation is concluded, interrupted, includes a longer monologue, or an exchange between multiple NPCs.`,
    `In action, when the user's agency is high, keep it concise (up to 150 words), and leave room for user input. In case you'd like to progress, for instance, in scene transitions, establishing shots, and plot developments, build content (unlimited, above 150 words), but allow the user to react to it. Never end on handover cues; finish naturally.`,
    `- No GPTisms/AI Slop. BAN and NEVER output generic structures (such as "if X, then Y", or "not X, but Y"), and literature clichés (NO: "physical punches," "practiced things," "predatory instincts," "mechanical precisions," or "jaws working"). Combat them with the human touch.`,
    `- Describe what DOES happen, rather than what doesn't (for example, go for "remains still" instead of "doesn't move"). Mention what occurs, or show the consequences of happenings ("the water sits untouched" instead of "isn't being drunk").`,
    `- CRITICAL! Do not repeat, echo, parrot, or restate distinctive words, phrases, and dialogues. When reacting to speech, show interpretation or response, NOT repetition.`,
    `EXAMPLE: "Are you even listening?"`,
    `BAD: "Listening?"`,
    `GOOD: A flat look. "What type of question is that?"`,
    `</output_format>`,
  ].join("\n");

  const sceneBlocks = [roleText, awarenessText, scenarioText, sceneSysText, outputFormatText]
    .filter(Boolean)
    .join("\n\n");
  if (!sceneBlocks) return;

  const firstSysIdx = messages.findIndex((message) => message.role === "system");
  if (firstSysIdx >= 0) {
    messages.splice(firstSysIdx + 1, 0, { role: "system", content: sceneBlocks });
  } else {
    messages.unshift({ role: "system", content: sceneBlocks });
  }
}
