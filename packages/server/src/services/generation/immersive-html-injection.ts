import { getDefaultAgentPrompt, isAgentConfigDeleted } from "@marinara-engine/shared";
import type { WrapFormat } from "@marinara-engine/shared";

type PromptMessage = {
  role: string;
  content: string;
};

type ImmersiveHtmlAgentConfig = {
  name?: string | null;
  promptTemplate?: string | null;
  settings?: unknown;
};

export type StaticAgentResultEventData = {
  agentType: string;
  agentName: string;
  resultType: "context_injection";
  data: { text: string };
  tokensUsed: 0;
  success: true;
  error: null;
  durationMs: 0;
};

function normalizeWrapFormat(value: unknown): WrapFormat {
  return value === "markdown" || value === "none" || value === "xml" ? value : "xml";
}

function formatImmersiveHtmlInjection(prompt: string, wrapFormat: WrapFormat): string {
  if (wrapFormat === "markdown") return `## Immersive HTML\n${prompt}`;
  if (wrapFormat === "xml") return `<immersive_html>\n${prompt}\n</immersive_html>`;
  return prompt;
}

function appendToLastUserMessage(messages: PromptMessage[], block: string): void {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]!;
    if (message.role === "user") {
      messages[index] = { ...message, content: `${message.content}\n\n${block}` };
      return;
    }
  }

  messages.push({ role: "user", content: block });
}

export async function applyImmersiveHtmlPromptInjection(args: {
  chatMode: string | null | undefined;
  enableAgents: boolean;
  activeAgentIds: readonly string[];
  wrapFormat: WrapFormat | string | null | undefined;
  messages: PromptMessage[];
  getHtmlAgentConfig: () => Promise<ImmersiveHtmlAgentConfig | null | undefined>;
}): Promise<StaticAgentResultEventData | null> {
  if (args.chatMode !== "roleplay") return null;
  if (!args.enableAgents || !args.activeAgentIds.includes("html")) return null;

  const htmlConfig = await args.getHtmlAgentConfig();
  if (htmlConfig?.settings && isAgentConfigDeleted(htmlConfig.settings)) return null;

  const htmlPrompt = (htmlConfig?.promptTemplate?.trim() || getDefaultAgentPrompt("html")).trim();
  if (!htmlPrompt) return null;

  appendToLastUserMessage(args.messages, formatImmersiveHtmlInjection(htmlPrompt, normalizeWrapFormat(args.wrapFormat)));

  return {
    agentType: "html",
    agentName: htmlConfig?.name?.trim() || "Immersive HTML",
    resultType: "context_injection",
    data: { text: "HTML formatting instructions injected into prompt" },
    tokensUsed: 0,
    success: true,
    error: null,
    durationMs: 0,
  };
}
