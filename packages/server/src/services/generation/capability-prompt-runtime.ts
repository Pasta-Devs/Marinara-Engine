import type { DB } from "../../db/connection.js";
import {
  collectCapabilityPromptContext,
  type CapabilityPromptContextRequest,
} from "../capability-packages/capability-prompt-context.service.js";
import { collectRoleplayEventContext } from "../capability-packages/capability-roleplay-events.service.js";
import { replaceRuntimeAgentSection, type RuntimeAgentSectionTokens } from "./runtime-agent-sections.js";

/** The same read-only package placement for generation and Peek Prompt. */
export async function injectCapabilityContexts(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  request: CapabilityPromptContextRequest,
  db: DB,
  sectionTokens: ReadonlyMap<string, RuntimeAgentSectionTokens>,
) {
  const promptContext = await collectCapabilityPromptContext(request);
  const blocks = promptContext.packageBlocks.flatMap((block) => {
    const tokens = sectionTokens.get(block.packageId);
    return tokens && replaceRuntimeAgentSection(messages, tokens, block.text) ? [] : [block.text];
  });
  const eventBlock = await collectRoleplayEventContext(db, request.chatId, request.targetCharacterIds ?? []);
  if (eventBlock) blocks.push(eventBlock);
  if (blocks.length > 0) {
    const context = blocks.join("\n\n");
    const systemMessage = messages.find((message) => message.role === "system");
    if (systemMessage) systemMessage.content += "\n\n" + context;
    else messages.unshift({ role: "system", content: context });
  }
  return promptContext;
}
