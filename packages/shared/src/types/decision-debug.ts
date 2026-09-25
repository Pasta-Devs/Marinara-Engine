/** Diagnostics for an explicit Peek Prompt inspection or isolated live decision test. */
export type DecisionDebugStatus =
  "ready" | "evaluated" | "cached" | "held" | "deferred" | "unavailable" | "unanswered" | "dropped";

export interface DecisionDebugResult {
  statement: string;
  kind: "noul" | "choice";
  options?: string[];
  status: DecisionDebugStatus;
  /** Present only for a model score, never for a timer or a word-only yes/no answer. */
  probability?: number;
  threshold?: number;
  yes?: boolean;
  choice?: string;
  binary?: boolean;
  error?: string;
}

export interface DecisionDebugRequest {
  protocol: "system_one" | "chat_logprobs";
  /** The actual JSON request body. Authentication headers and URLs are never included. */
  body: Record<string, unknown>;
  results?: Array<{ id: string; probability?: number; yes?: boolean; choice?: string; binary?: boolean }>;
  error?: string;
  latencyMs?: number;
}

export interface DecisionDebugReport {
  mode: "inspect" | "run";
  createdAt: string;
  turnId: string | null;
  model: string | null;
  results: DecisionDebugResult[];
  requests: DecisionDebugRequest[];
}

export interface DecisionDebugPreview {
  prompt: {
    messages: Array<{ role: string; content: string }>;
    decisionDebug: DecisionDebugReport;
    decisions?: { unanswered: string[]; dropped?: string[]; decisionModelSet: boolean };
  };
  parameters: Record<string, unknown>;
}
