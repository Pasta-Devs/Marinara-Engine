import assert from "node:assert/strict";
import { PROFESSOR_MARI_ID } from "../../../packages/shared/src/constants/defaults.js";
import {
  sanitizeMariGuidedPlan,
  sanitizeMariSuggestionChips,
} from "../../../packages/shared/src/types/professor-mari-workspace.js";
import { useAgentStore } from "../../../packages/client/src/stores/agent.store.ts";

const malformed = sanitizeMariSuggestionChips([
  { label: "missing prompt" },
  { prompt: "missing label" },
  { label: "valid", prompt: "send", entity: "unknown", tone: "DANGER" },
  { id: "duplicate", label: "one", prompt: "one" },
  { id: "duplicate", label: "two", prompt: "two" },
]);
assert.deepEqual(malformed, [
  { id: "suggestion-1", label: "valid", prompt: "send", tone: "danger" },
  { id: "duplicate", label: "one", prompt: "one" },
  { id: "suggestion-3", label: "two", prompt: "two" },
]);

const plan = sanitizeMariGuidedPlan([
  { fieldKey: "name", question: "Name?", chips: [{ label: "A", prompt: "A" }] },
  { fieldKey: "style", question: "Style?", chips: [{ label: "B", prompt: "B" }] },
]);
const store = useAgentStore.getState();
store.setMariPlan("mari-chat", plan);
assert.equal(useAgentStore.getState().mariPlanCursor, 0);
assert.equal(useAgentStore.getState().recordMariPlanAnswer("name", "A"), "advanced");
assert.equal(useAgentStore.getState().mariPlanCursor, 1);
assert.equal(useAgentStore.getState().recordMariPlanAnswer("style", "B"), "complete");
assert.deepEqual(useAgentStore.getState().mariPlanAnswers, { name: "A", style: "B" });
useAgentStore.getState().setMariChips("mari-chat", [{ id: "chip", label: "x", prompt: "x" }]);
useAgentStore.getState().resetForChatChange();
assert.equal(useAgentStore.getState().mariChipsChatId, null);
assert.equal(useAgentStore.getState().mariPlanChatId, null);
assert.equal(useAgentStore.getState().mariPlanCursor, 0);

const shouldShowMariSuggestions = (characterIds: string[], enabled: boolean) =>
  enabled && characterIds.includes(PROFESSOR_MARI_ID);
assert.equal(
  shouldShowMariSuggestions([PROFESSOR_MARI_ID], true),
  true,
  "Mari suggestions use the built-in character gate",
);
assert.equal(shouldShowMariSuggestions(["ordinary-character"], true), false, "non-Mari chats stay isolated");
assert.equal(shouldShowMariSuggestions([PROFESSOR_MARI_ID], false), false, "disabled suggestions stay gated");

console.log("Professor Mari suggestion and plan regressions passed.");
