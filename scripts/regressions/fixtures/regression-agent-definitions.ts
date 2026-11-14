// Replaces the built-in agent definitions with small stand-ins for the prompt regressions. Importing it swaps the
// definitions for the whole process, so in a shared batched process later files would see the stand-ins too.
import { replaceBuiltInAgentDefinitions } from "../../../packages/shared/src/index.js";
import { replaceBuiltInAgentDefinitions as replaceBuiltInAgentDefinitionsDist } from "../../../packages/shared/dist/index.js";

const REGRESSION_AGENT_IDS = [
  "about-me-keeper",
  "background",
  "card-evolution-auditor",
  "character-tracker",
  "combat",
  "continuity",
  "conversation-calls",
  "custom-tracker",
  "cyoa",
  "director",
  "echo-chamber",
  "eightball",
  "expression",
  "haptic",
  "html",
  "illustrator",
  "knowledge-retrieval",
  "knowledge-router",
  "lorebook-keeper",
  "persona-stats",
  "poker",
  "prose-guardian",
  "quest",
  "rock-paper-scissors",
  "spotify",
  "tic-tac-toe",
  "uno",
  "world-state",
  "chess",
] as const;
// The production Engine intentionally carries no optional agent definitions.
// Prompt regressions install a small synthetic registry so they exercise the
// generic pipeline without copying package-owned prompts back into the base.
export const regressionAgentDefinitions = REGRESSION_AGENT_IDS.map((id) => ({
  id,
  name: id === "html" ? "Immersive HTML" : id === "illustrator" ? "Illustrator" : id,
  description: id === "html" ? "Adds HTML/CSS/JS visual effects to AI messages." : `Regression fixture for ${id}`,
  phase: "post_processing" as const,
  enabledByDefault: false,
  category: "misc" as const,
  defaultTools: [],
  defaultPromptTemplate:
    id === "html"
      ? "You are Immersive HTML, a post-processing visual enhancer. Rewrite only the assistant response."
      : id === "illustrator"
        ? "Create an image-generation prompt for a visually important moment."
        : `Run the ${id} agent.`,
  ...(id === "html"
    ? {
        resultType: "text_rewrite" as const,
        defaultSettings: { resultType: "text_rewrite", contextSize: 5, maxTokens: 4096, holdForRewrite: true },
      }
    : {}),
  ...(id === "illustrator"
    ? {
        defaultSettings: { defaultPromptTemplateId: "default" },
        promptTemplates: [
          {
            id: "background",
            name: "Background",
            description: "Background-only plate.",
            promptTemplate: "Create a background-only prompt with no characters.",
          },
        ],
      }
    : {}),
}));
replaceBuiltInAgentDefinitions(regressionAgentDefinitions);
replaceBuiltInAgentDefinitionsDist(regressionAgentDefinitions);
