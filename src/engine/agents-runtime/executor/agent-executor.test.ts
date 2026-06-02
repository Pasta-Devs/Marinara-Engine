import { describe, expect, it } from "vitest";

import type { AgentContext } from "../../contracts/types/agent";
import type {
  BaseLLMProvider,
  ChatCompleteOptions,
  ChatCompleteResult,
  ChatMessage,
} from "../../generation-core/llm/base-provider";
import { executeAgent, type AgentExecConfig } from "./agent-executor";

class CapturingProvider implements BaseLLMProvider {
  maxTokensOverrideValue = null;
  messages: ChatMessage[] = [];

  async chatComplete(messages: ChatMessage[], _options: ChatCompleteOptions): Promise<ChatCompleteResult> {
    this.messages = messages;
    return {
      content: JSON.stringify({
        editedText: "unchanged",
        changes: [],
      }),
    };
  }
}

function createAgentContext(mainResponse: string): AgentContext {
  return {
    chatId: "chat-1",
    chatMode: "roleplay",
    recentMessages: [
      { role: "user", content: "Keep her blue coat consistent." },
      { role: "assistant", content: mainResponse, characterId: "char-1" },
    ],
    mainResponse,
    mainResponseCharacterId: "char-1",
    gameState: null,
    characters: [{ id: "char-1", name: "Mira", description: "Mira wears a blue coat." }],
    persona: null,
    memory: {},
    activatedLorebookEntries: null,
    writableLorebookIds: null,
    chatSummary: null,
    streaming: false,
  };
}

const editorConfig: AgentExecConfig = {
  id: "editor-1",
  type: "editor",
  name: "Consistency Editor",
  phase: "post_processing",
  promptTemplate: "",
  connectionId: null,
  settings: {},
};

describe("executeAgent", () => {
  it("preserves HTML-heavy main responses for the consistency editor prompt", async () => {
    const provider = new CapturingProvider();
    const htmlResponse = [
      `<section class="social-card" data-theme="neon">`,
      `<style>.social-card { color: #7dd3fc; }</style>`,
      `<p style="font-weight: 700">She is safe now.</p>`,
      `</section>`,
    ].join("");

    await executeAgent(editorConfig, createAgentContext(htmlResponse), provider, "test-model");

    const prompt = provider.messages.map((message) => message.content).join("\n\n");
    expect(prompt).toContain(`<assistant_response>`);
    expect(prompt).toContain(`<section class="social-card" data-theme="neon">`);
    expect(prompt).toContain(`<style>.social-card { color: #7dd3fc; }</style>`);
    expect(prompt).toContain(`<p style="font-weight: 700">She is safe now.</p>`);
  });
});
