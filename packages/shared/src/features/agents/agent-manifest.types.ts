import type { AgentCategory, AgentPhase, AgentPromptTemplateOption } from "../../types/agent.js";
import type { ChatMode } from "../../types/chat.js";

export interface BuiltInAgentManifest {
  id: string;
  name: string;
  description: string;
  author?: string;
  phase: AgentPhase;
  enabledByDefault: boolean;
  defaultInjectAsSection?: boolean;
  category: AgentCategory;
  /** Hide this built-in from public agent library and chat agent pickers. */
  libraryHidden?: boolean;
  /** Keep legacy configs recognized, but never run this built-in in generation pipelines. */
  runtimeDisabled?: boolean;
  modeAllowlist?: readonly ChatMode[];
  defaultTools?: readonly string[];
  defaultSettings?: Record<string, unknown>;
  promptTemplates?: readonly AgentPromptTemplateOption[];
  runInterval?: number;
  /** Default prompt supplied by an installed package. Bundled compatibility manifests may omit it. */
  defaultPromptTemplate?: string;
  /** Feature entries use the Agents library for installation/activation but do not run through the LLM pipeline. */
  execution?: "pipeline" | "feature";
}
