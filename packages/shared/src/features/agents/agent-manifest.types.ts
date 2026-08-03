import type { AgentCategory, AgentPhase, AgentPromptTemplateOption } from "../../types/agent.js";
import type { ChatMode } from "../../types/chat.js";

export interface BuiltInAgentManifest {
  id: string;
  /** Downloaded package that owns this agent. Present for runtime package definitions. */
  packageId?: string;
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
  /**
   * Feature entries provide their own package UI/runtime. Host entries use the
   * normal Agent editor, but are orchestrated by a dedicated Engine workflow
   * instead of the generic LLM pipeline.
   */
  execution?: "pipeline" | "feature" | "host";
}
