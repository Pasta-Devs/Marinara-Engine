export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  images?: string[];
  tool_call_id?: string;
  tool_calls?: unknown;
}

export interface LlmToolDefinition {
  name: string;
  description?: string;
  parameters?: unknown;
}

export interface LlmRequest {
  connectionId?: string | null;
  provider?: string | null;
  model?: string | null;
  messages: LlmMessage[];
  parameters?: Record<string, unknown>;
  tools?: LlmToolDefinition[];
}

export interface LlmEmbeddingRequest {
  texts: string[];
  connectionId?: string | null;
  model?: string | null;
}

export interface LlmChunk {
  type: "start" | "token" | "thinking" | "tool_call" | "usage" | "done" | "error";
  text?: string;
  data?: unknown;
  finishReason?: string;
  providerMetadata?: unknown;
}

export interface LlmGateway {
  complete(request: LlmRequest, signal?: AbortSignal): Promise<string>;
  stream(request: LlmRequest, signal?: AbortSignal): AsyncGenerator<LlmChunk>;
  listModels(connectionId?: string | null): Promise<Array<{ id: string; name?: string; provider?: string }>>;
  embed?(request: LlmEmbeddingRequest, signal?: AbortSignal): Promise<number[][] | null>;
}
