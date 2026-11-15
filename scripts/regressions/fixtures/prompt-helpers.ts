// Small builders shared by the prompt regressions in several area folders.
import { type AgentContext } from "../../../packages/shared/src/index.js";
import { type AssemblerInput } from "../../../packages/server/src/services/prompt/index.js";

type RegressionPromptSection = AssemblerInput["sections"][number];

export function makeCapturingProvider(response: string) {
  const calls: any[][] = [];
  const callOptions: any[] = [];
  return {
    calls,
    callOptions,
    provider: {
      maxTokensOverrideValue: null,
      async chatComplete(messages: any[], options: any) {
        calls.push(messages);
        callOptions.push(options);
        return {
          content: response,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
      },
    },
  };
}

export function makeRegressionAgentContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    chatId: "chat-agent-output-format",
    chatMode: "roleplay",
    recentMessages: [
      { role: "user", content: "Check the street behind us." },
      { role: "assistant", content: "The street is quiet, but the rain keeps falling." },
    ],
    mainResponse: null,
    gameState: null,
    characters: [{ id: "char-dottore", name: "Dottore", description: "A precise researcher." }],
    persona: { name: "Mari", description: "The active user persona." },
    memory: {},
    writableLorebookIds: null,
    chatSummary: null,
    wrapFormat: "markdown",
    streaming: false,
    ...overrides,
  };
}

export function makeRegressionAgentConfig(overrides: Record<string, unknown> = {}) {
  const type = typeof overrides.type === "string" ? overrides.type : "background";
  const name = typeof overrides.name === "string" ? overrides.name : "Background";
  const settings =
    overrides.settings && typeof overrides.settings === "object" && !Array.isArray(overrides.settings)
      ? (overrides.settings as Record<string, unknown>)
      : {};
  return {
    id: `builtin:${type}`,
    type,
    name,
    isCustomAgent: false,
    phase: "post_processing",
    promptTemplate: 'Return JSON: {"chosen": null}',
    connectionId: null,
    ...overrides,
    settings: {
      contextSize: 5,
      maxTokens: 256,
      resultType: "background_change",
      ...settings,
    },
  };
}

export function promptSection(
  overrides: Pick<RegressionPromptSection, "id" | "identifier" | "name"> & Partial<RegressionPromptSection>,
): RegressionPromptSection {
  return {
    presetId: "preset-regression",
    content: "",
    role: "system",
    enabled: "true",
    isMarker: "false",
    groupId: null,
    markerConfig: null,
    injectionPosition: "ordered",
    injectionDepth: 0,
    injectionOrder: 0,
    forbidOverrides: "false",
    skipWrap: "false",
    ...overrides,
  };
}
