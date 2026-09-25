import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string): string {
  return readFileSync(new URL(`../../packages/client/src/${path}`, import.meta.url), "utf8");
}

const fields: Record<string, string[]> = {
  "components/characters/CharacterEditor.tsx": [
    "formData.description",
    "formData.first_mes",
    "value",
    "formData.mes_example",
    "formData.system_prompt",
    "formData.post_history_instructions",
    "depthPrompt.prompt",
  ],
  "components/presets/PresetEditor.tsx": ["conversationPrompt", "gamePrompt", "local"],
  "components/agents/AgentEditor.tsx": ["localPrompt", "option.promptTemplate"],
  "features/chat-settings/sections/ConversationPromptSection.tsx": ["draft"],
  "features/chat-settings/sections/GameExtraPromptSection.tsx": ["draft"],
  "features/chat-settings/sections/ImpersonatePromptTemplateField.tsx": ["displayedPromptTemplate"],
  "components/chat/ChatRoleplayPanels.tsx": ["notes"],
};

for (const [path, values] of Object.entries(fields)) {
  const text = source(path);
  for (const value of values) {
    assert.ok(
      text.includes(`showTokenCount\n`) &&
        new RegExp(`showTokenCount\\s+value=\\{${value.replaceAll(".", "\\.")}\\}`).test(text),
      `${path}: ${value} must opt in to the shared token counter`,
    );
  }
}

const macroTextarea = source("components/ui/MacroTextarea.tsx");
assert.match(macroTextarea, /showTokenCount = false/u, "ordinary MacroTextarea fields must remain unchanged");
assert.match(macroTextarea, /estimateTextTokens\(value\)/u);
assert.match(macroTextarea, /estimateTextTokens\(localValue\)/u, "expanded prompt editors must count their live draft");
assert.match(macroTextarea, /tokenCountFooter\?: ReactNode/u);
assert.match(
  macroTextarea,
  /flex flex-wrap items-center gap-x-3 gap-y-1[\s\S]*\{tokenCountFooter\}[\s\S]*ml-auto shrink-0/u,
  "optional footer controls must share a row with the trailing token count",
);
const presetEditor = source("components/presets/PresetEditor.tsx");
assert.equal((presetEditor.match(/tokenCountFooter=\{positionControls\}/gu) ?? []).length, 2);
assert.match(presetEditor, /!hasContentTextarea && positionControls/u, "generated markers must keep position controls");
for (const path of [
  "components/characters/CharacterEditor.tsx",
  "components/chat/ChatRoleplayPanels.tsx",
  "features/chat-settings/sections/ImpersonatePromptTemplateField.tsx",
  "components/agents/AgentEditor.tsx",
]) {
  assert.match(source(path), /tokenCountFooter=\{/u, `${path}: existing footer content must share the token row`);
}
assert.match(
  source("components/agents/AgentEditor.tsx"),
  /\{promptTemplateHelp\}[\s\S]*estimateTextTokens\(defaultPrompt \|\| ""\)/u,
  "the read-only agent default must also show its help beside the token count",
);
assert.doesNotMatch(
  source("components/characters/CharacterEditor.tsx"),
  /\{(?:formData\.description|value)\.length\}/u,
);
assert.match(
  source("features/chat-settings/sections/TranslationSection.tsx"),
  /estimateTextTokens\(customPrompt \|\| DEFAULT_TRANSLATION_SYSTEM_PROMPT\)/u,
);
assert.match(source("components/panels/settings/PromptOverridesEditor.tsx"), /estimateTextTokens\(draft\)/u);

for (const path of [
  "components/chat/ChatInput.tsx",
  "components/chat/ConversationInput.tsx",
  "components/game/GameInput.tsx",
]) {
  assert.doesNotMatch(source(path), /showTokenCount/u, "user message composers are outside this change");
}
