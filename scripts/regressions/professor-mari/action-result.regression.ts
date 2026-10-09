import assert from "node:assert/strict";

import type { MariDbCommandResult } from "@marinara-engine/shared";
import {
  buildMariWorkspaceActionResult,
  parseAssistantWorkspaceAction,
  answerEndsWithQuestion,
  scrubInternalNames,
} from "../../../packages/server/src/services/professor-mari/workspace-agent.service.js";
import { normalizeCommandCenterSessionState } from "../../../packages/client/src/lib/command-center.js";

function result(table: string, action: "insert" | "update" | "replace"): MariDbCommandResult {
  return {
    ok: true,
    mode: "apply",
    command: "app_data",
    summary: {
      matchedRows: 1,
      affectedRows: 1,
      insertedRows: action === "insert" ? 1 : 0,
      updatedRows: action === "update" ? 1 : 0,
      replacedRows: action === "replace" ? 1 : 0,
      deletedRows: 0,
      affectedTables: { [table]: 1 },
      preview: [
        {
          table,
          id: `${table}-id`,
          action,
          before: action === "insert" ? null : { id: `${table}-id`, name: "Old", description: "Before" },
          after: { id: `${table}-id`, name: "New", description: "After" },
        },
      ],
      truncated: false,
    },
    approval: { status: "pending", id: "review-id" },
  };
}

for (const [table, kind] of [
  ["characters", "character"],
  ["personas", "persona"],
  ["lorebooks", "lorebook"],
  ["prompt_presets", "preset"],
] as const) {
  const actionResult = buildMariWorkspaceActionResult(`${kind}.update`, result(table, "update"));
  assert.equal(actionResult?.resource.kind, kind);
  assert.equal(actionResult?.resource.id, `${table}-id`);
  assert.equal(actionResult?.reviewId, "review-id");
  assert.deepEqual(actionResult?.changedFields, ["name", "description"]);
}

const created = buildMariWorkspaceActionResult("character.create", result("characters", "insert"));
assert.equal(created?.status, "created");
assert.equal(created?.summary, "Created character “New”.");

const presetSection = result("prompt_sections", "update");
presetSection.summary!.preview[0]!.after!.presetId = "parent-preset-id";
const presetSectionResult = buildMariWorkspaceActionResult("preset.updateSection", presetSection);
assert.equal(presetSectionResult?.status, "updated");
assert.equal(presetSectionResult?.resource.kind, "preset");
assert.equal(presetSectionResult?.resource.id, "parent-preset-id");

const dryRun = { ...result("characters", "insert"), mode: "dry-run" as const };
assert.equal(buildMariWorkspaceActionResult("character.create", dryRun), null);
assert.equal(buildMariWorkspaceActionResult("theme.create", result("themes", "insert")), null);

const parsedAction = parseAssistantWorkspaceAction(
  JSON.stringify({
    say: "I updated Luna.",
    commands: [{ name: "app_data", arguments: { action: "character.update" } }],
    stop: true,
  }),
);
assert.equal(parsedAction.protocolValid, true, "structured action output remains valid");
assert.equal(parsedAction.commands[0]?.name, "app_data", "app-data action calls are retained");

const malformedAction = parseAssistantWorkspaceAction('<delete_everything>{"action":"delete"}</delete_everything>');
assert.equal(malformedAction.protocolValid, false, "unknown action tools are rejected");
assert.equal(malformedAction.commands.length, 0, "rejected action tools cannot reach execution");

// Slice 70: her visible words never carry internal tool, action or apply-flag names; commands stay raw.
const toolNamesAction = parseAssistantWorkspaceAction(
  JSON.stringify({
    say: "I check replies with `chat.diagnose`, search the docs (docs_search / docs_read), and never run an apply:false preview.",
    commands: [{ name: "app_data", arguments: { action: "chat.diagnose", chatId: "c1" } }],
    suggestions: [{ label: "Run lorebook.testScan", prompt: "Run lorebook.testScan", detail: "via app_data" }],
    stop: false,
  }),
);
assert.equal(
  toolNamesAction.visibleText,
  "I check replies with the chat checkup, search the docs, and never run a dry-run preview.",
  "visible text names no tool, action or flag",
);
assert.equal(toolNamesAction.suggestions[0]?.label, "Run lorebook test scan", "chip labels name no action");
assert.equal(toolNamesAction.suggestions[0]?.detail, "via app data", "chip details name no tool");
assert.equal(toolNamesAction.suggestions[0]?.prompt, "Run lorebook.testScan", "the chip prompt to Mari stays raw");
assert.equal(toolNamesAction.commands[0]?.arguments.action, "chat.diagnose", "command arguments stay raw");
assert.equal(
  scrubInternalNames("Open character.json; marinara.ui.registerContribution stays."),
  "Open character.json; marinara.ui.registerContribution stays.",
  "file names and extension APIs are not action names",
);

// Slice 70: an answer that ends on a question gets one chips-only round when it carries no chips.
assert.equal(answerEndsWithQuestion("1. Tone\n2. Backstory\n\nWant me to apply all five, or pick specific ones?"), true);
assert.equal(answerEndsWithQuestion('What direction do you want? **Give me the vibe?**'), true, "markdown after the ?");
assert.equal(answerEndsWithQuestion("What's the vibe? Tell me what you want changed."), true, "an ask before the end");
assert.equal(
  answerEndsWithQuestion("Why does he forget?\n\n42 messages were not sent.\n- Budget: 8,000\n- Needed: 9,800"),
  false,
  "only the end counts",
);
assert.equal(answerEndsWithQuestion("- Darker\n- Funnier\n\nYour swamp, your call."), true, "options, then your call");
assert.equal(answerEndsWithQuestion("Done."), false);
assert.equal(answerEndsWithQuestion('Or say "all of it" and I\'ll give him the full treatment.'), true, "an offer to answer");

const session = normalizeCommandCenterSessionState({
  query: "find Luna",
  activeResultId: "character:luna",
  mariReturnResultId: "character:luna",
});
assert.equal(session.query, "find Luna", "the Mari return keeps the search query");
assert.equal(session.activeResultId, "character:luna", "the selected result remains selected");
assert.equal(session.mariReturnResultId, "character:luna", "the return result is persisted in the session contract");

console.log("Professor Mari action-result regression checks passed.");
