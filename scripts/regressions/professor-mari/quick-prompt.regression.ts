import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { professorMariQuickPromptSchema } from "../../../packages/server/src/routes/professor-mari-quick.routes.js";

const parsed = professorMariQuickPromptSchema.parse({
  message: "Explain this field",
  context: {
    source: "command-center",
    capability: "explain",
    field: "Description",
    fieldId: "character.description",
  },
});
assert.equal(parsed.message, "Explain this field");
assert.equal(parsed.context?.fieldId, "character.description");
assert.throws(() => professorMariQuickPromptSchema.parse({ message: "x", attachments: [] }));
assert.throws(() => professorMariQuickPromptSchema.parse({ message: "x".repeat(4_001) }));

const serviceSource = readFileSync(
  new URL("../../../packages/server/src/services/professor-mari/workspace-agent.service.ts", import.meta.url),
  "utf8",
);
const quickMethod = serviceSource.slice(
  serviceSource.indexOf("async quickPrompt("),
  serviceSource.indexOf("async prompt("),
);
assert.equal(quickMethod.match(/provider\.chatComplete\(/gu)?.length, 1, "Quick Mari has one provider request site");
assert.equal(quickMethod.includes("executeWorkspaceCommandBatch"), false, "Quick Mari has no tool loop");
assert.equal(quickMethod.includes("createChatsStorage"), false, "Quick Mari has no chat history");

console.log("Professor Mari quick-prompt regression checks passed.");
