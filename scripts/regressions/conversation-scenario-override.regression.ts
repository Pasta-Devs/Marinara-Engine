import assert from "node:assert/strict";
import { resolveMacros } from "../../packages/shared/src/index.js";

// Conversation mode never runs the preset assembler, so the identity fallback must honor the
// chat's scenario override the same way the preset character marker does.
const { injectIdentityFallbackMessages } =
  await import("../../packages/server/src/services/generation/character-prompt-context.js");

const character = {
  id: "char-1",
  name: "Mara",
  description: "A sailor.",
  personality: "",
  scenario: "CARD_SCENARIO on the docks.",
  systemPrompt: "",
  backstory: "",
  appearance: "",
  mesExample: "",
  postHistoryInstructions: "",
};

function run(groupScenarioOverrideText: string | null) {
  const macroCtx = { user: "User", char: "Mara", characters: ["Mara"], variables: {} };
  const messages = [{ role: "system" as const, content: "You are Mara chatting with User." }];
  injectIdentityFallbackMessages({
    messages,
    charInfo: [character] as never,
    promptTargetCharacterId: null,
    promptMacroContext: macroCtx as never,
    wrapFormat: "xml",
    personaName: "User",
    personaDescription: "",
    personaFields: {},
    resolvePromptMacros: (value: string) => resolveMacros(value, macroCtx as never),
    isConversation: true,
    groupScenarioOverrideText,
  });
  return messages.map((message) => message.content).join("\n");
}

const withOverride = run("PREMISE rain at Saltmere.");
assert.equal(withOverride.match(/PREMISE rain at Saltmere\./g)?.length, 1);
assert.doesNotMatch(withOverride, /CARD_SCENARIO/);
assert.match(withOverride, /A sailor\./);

const withoutOverride = run(null);
assert.equal(withoutOverride.match(/CARD_SCENARIO on the docks\./g)?.length, 1);
assert.doesNotMatch(withoutOverride, /PREMISE/);
