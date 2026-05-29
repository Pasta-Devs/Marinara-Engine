export type ConnectionProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "cohere"
  | "openrouter"
  | "xai"
  | "custom"
  | "image_generation"
  | string;

export interface ConnectionRow {
  [key: string]: unknown;
  id: string;
  name: string;
  provider: ConnectionProvider;
  model?: string | null;
  baseUrl?: string | null;
  useForRandom?: string | boolean | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  warning?: boolean;
  message: string;
  latencyMs: number;
  modelName?: string | null;
  code?: string;
  error?: string;
  details?: unknown;
}
