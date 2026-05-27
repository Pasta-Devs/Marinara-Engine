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

export interface LlmEmbedRequest {
  connectionId?: string | null;
  connection?: Record<string, unknown> | null;
  model?: string | null;
  texts: string[];
}

export interface LlmChunk {
  type: "start" | "token" | "thinking" | "tool_call" | "usage" | "done" | "error";
  text?: string;
  data?: unknown;
  finishReason?: string;
  providerMetadata?: unknown;
}

export interface LlmGateway {
  embed(request: LlmEmbedRequest, signal?: AbortSignal): Promise<number[][] | null>;
  complete(request: LlmRequest, signal?: AbortSignal): Promise<string>;
  stream(request: LlmRequest, signal?: AbortSignal): AsyncGenerator<LlmChunk>;
  listModels(connectionId?: string | null): Promise<Array<{ id: string; name?: string; provider?: string }>>;
}
