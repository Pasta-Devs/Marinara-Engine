// ──────────────────────────────────────────────
// Function Calling / Tool Use Types
// ──────────────────────────────────────────────

import { BUILT_IN_TOOL_MANIFESTS } from "./tool-registry.generated.js";

/** JSON Schema subset for tool parameter definitions. */
export interface ToolParameterSchema {
  type: "object" | "string" | "number" | "integer" | "boolean" | "array";
  description?: string;
  properties?: Record<string, ToolParameterProperty>;
  required?: string[];
  oneOf?: Array<{ required: string[] }>;
  additionalProperties?: boolean;
  items?: ToolParameterProperty;
}

export interface ToolParameterProperty {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  items?: ToolParameterProperty;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  multipleOf?: number;
}

/** Definition of a tool/function that an agent can call. */
export interface ToolDefinition {
  /** Unique tool name (e.g. "get_weather", "roll_dice") */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for the parameters */
  parameters: ToolParameterSchema;
}

/** A tool call made by the model during generation. */
export interface ToolCall {
  /** Server-assigned ID for tracking */
  id: string;
  /** Which tool to call */
  name: string;
  /** Parsed arguments */
  arguments: Record<string, unknown>;
}

/** Result of executing a tool call. */
export interface ToolResult {
  /** Matches the ToolCall id */
  toolCallId: string;
  /** Tool name for display */
  name: string;
  /** Stringified result */
  result: string;
  /** Whether execution succeeded */
  success: boolean;
}

/** A user-created custom function tool persisted in DB. */
export interface CustomTool {
  id: string;
  name: string;
  description: string;
  parametersSchema: ToolParameterSchema;
  executionType: "webhook" | "static" | "script";
  webhookUrl: string | null;
  staticResult: string | null;
  scriptBody: string | null;
  /** Whether execution receives server-side context that is not exposed in the LLM tool schema. */
  includeHiddenContext: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Extended AgentConfig with tool definitions. */
export interface AgentToolConfig {
  /** Tools this agent can use */
  tools: ToolDefinition[];
  /** How many tool calls are allowed per turn (0 = unlimited) */
  maxCallsPerTurn: number;
  /** Whether to allow parallel tool calls */
  parallelCalls: boolean;
}

/** Built-in tool definitions available to all agents. */
export const BUILT_IN_TOOLS: ToolDefinition[] = [...BUILT_IN_TOOL_MANIFESTS];
