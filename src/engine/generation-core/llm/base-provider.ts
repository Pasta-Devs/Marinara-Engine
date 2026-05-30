export interface ChatMessage {
  role: string;
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: LLMToolCall[];
  contextKind?: string;
  [key: string]: unknown;
}

export interface ChatCompleteOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  onToken?: (chunk: string) => void;
  signal?: AbortSignal;
  [key: string]: unknown;
}

interface LLMUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  [key: string]: unknown;
}

export interface ChatCompleteResult {
  content?: string;
  toolCalls?: LLMToolCall[];
  usage?: LLMUsage;
  finishReason?: string | null;
  providerMetadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LLMToolDefinition {
  name: string;
  description?: string;
  parameters?: unknown;
}

export interface LLMToolCall {
  id?: string;
  name: string;
  arguments: string;
  function: {
    name: string;
    arguments: string;
  };
  [key: string]: unknown;
}

export interface BaseLLMProvider {
  maxTokensOverrideValue: number | null;
  chatComplete(messages: ChatMessage[], options: ChatCompleteOptions): Promise<ChatCompleteResult>;
}
