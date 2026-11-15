import assert from "node:assert/strict";
import type { LLMToolDefinition } from "../../../packages/shared/src/types/generation-integration.js";
import {
  cutPendingRoll,
  isRoleplayRollEnabled,
  rollActivityFromToolResult,
  rollResultFollowUp,
  textualRollToolCall,
  withRoleplayRollSchema,
} from "../../../packages/server/src/services/generation/roleplay-rolls.js";

// Pins the roleplay roll helpers moved out of generate.routes.ts and tool-rounds.ts (#7573).

// isRoleplayRollEnabled: Rolls command decides when on; otherwise the resolved roll_dice tool does.
{
  const rollsOn = { roleplayCommandsEnabled: true, roleplayCommandToggles: { roll: true } };
  const narratorOnly = { ...rollsOn, roleplayRollAudience: "narrator", roleplayCommandNarratorId: "narrator" };
  const base = {
    chatMode: "roleplay",
    impersonate: false,
    chatMeta: rollsOn as Record<string, unknown>,
    callerId: null as string | null,
    resolvedToolNames: new Set<string>(),
  };
  assert.equal(isRoleplayRollEnabled(base), true, "the Rolls command enables rolls without the tool");
  assert.equal(isRoleplayRollEnabled({ ...base, chatMode: "game" }), false);
  assert.equal(isRoleplayRollEnabled({ ...base, impersonate: true }), false);
  assert.equal(isRoleplayRollEnabled({ ...base, impersonate: undefined }), true);
  assert.equal(isRoleplayRollEnabled({ ...base, chatMeta: narratorOnly }), false, "narrator-only needs the narrator");
  assert.equal(isRoleplayRollEnabled({ ...base, chatMeta: narratorOnly, callerId: "narrator" }), true);
  assert.equal(
    isRoleplayRollEnabled({ ...base, chatMeta: narratorOnly, resolvedToolNames: new Set(["roll_dice"]) }),
    false,
    "while the command is on, an attached tool does not bypass it",
  );
  assert.equal(isRoleplayRollEnabled({ ...base, chatMeta: {} }), false);
  assert.equal(isRoleplayRollEnabled({ ...base, chatMeta: {}, resolvedToolNames: new Set(["roll_dice"]) }), true);
}

// withRoleplayRollSchema: roll_dice gains the participant enum and attribute, `character` is required.
{
  const roll: LLMToolDefinition = {
    type: "function",
    function: {
      name: "roll_dice",
      description: "Roll",
      parameters: { type: "object", properties: { notation: { type: "string" } }, required: ["notation"] },
    },
  };
  const other: LLMToolDefinition = {
    type: "function",
    function: { name: "search_lorebook", description: "Search", parameters: { type: "object", properties: {} } },
  };
  const [rolled, untouched] = withRoleplayRollSchema([roll, other], [{ name: "Alice" }, { name: "Bob" }])!;
  assert.equal(untouched, other, "other tools pass through as they are");
  const params = rolled!.function.parameters as { properties: Record<string, any>; required: string[] };
  assert.deepEqual(Object.keys(params.properties), ["notation", "character", "attribute"]);
  assert.deepEqual(params.properties.character.enum, ["Alice", "Bob"]);
  assert.equal(params.properties.attribute.type, "string");
  assert.deepEqual(params.required, ["notation", "character"]);
  assert.deepEqual(roll.function.parameters.required, ["notation"], "the shared definition is not mutated");
  const noRequired = withRoleplayRollSchema([{ ...roll, function: { ...roll.function, parameters: {} } }], [])!;
  assert.deepEqual((noRequired[0]!.function.parameters as { required: string[] }).required, ["character"]);
  assert.equal(withRoleplayRollSchema(undefined, []), undefined);
}

// textualRollToolCall: the reply keeps the raw command up to `end`, the model gets only the prose before `start`.
{
  const content =
    'I try the lock. [roll: notation="1d20+3", reason="Need 15", character="Alice", dc="15"] A made-up outcome.';
  const roll = textualRollToolCall(content, () => "call-1")!;
  assert.equal(roll.promptContent, "I try the lock. ");
  assert.equal(roll.start, "I try the lock. ".length);
  assert.equal(content.slice(0, roll.end), content.slice(0, content.indexOf(" A made-up")));
  assert.equal(content.slice(roll.start, roll.end).startsWith("[roll:"), true);
  assert.equal(content.slice(roll.start, roll.end).endsWith("]"), true);
  assert.equal(roll.call.id, "call-1");
  assert.equal(roll.call.type, "function");
  assert.equal(roll.call.function.name, "roll_dice");
  assert.deepEqual(JSON.parse(roll.call.function.arguments), {
    notation: "1d20+3",
    reason: "Need 15",
    character: "Alice",
    dc: 15,
  });
  let ids = 0;
  assert.equal(
    textualRollToolCall("Plain prose.", () => String(++ids)),
    null,
  );
  assert.equal(ids, 0, "no id is drawn without a roll");
}

// rollActivityFromToolResult: textual rolls keep their raw text, native ones show the call.
{
  const call = {
    id: "c1",
    type: "function" as const,
    function: { name: "roll_dice", arguments: '{"notation":"1d6","reason":"luck","modifier":2,"character":5}' },
  };
  const ok = { toolCallId: "c1", name: "roll_dice", result: '{"total":4}', success: true };
  assert.deepEqual(rollActivityFromToolResult(call, ok, undefined), {
    command: { type: "roll", notation: "1d6", reason: "luck", modifier: 2 },
    raw: 'roll_dice({"notation":"1d6","reason":"luck","modifier":2,"character":5})',
    result: '{"total":4}',
  });
  assert.equal(rollActivityFromToolResult(call, ok, '[roll: notation="1d6"]').raw, '[roll: notation="1d6"]');
  const bad = { ...call, function: { ...call.function, arguments: "{oops" } };
  const failed = { ...ok, result: '{"error":"bad"}', success: false };
  assert.deepEqual(rollActivityFromToolResult(bad, failed, undefined), {
    command: { type: "roll", notation: "", reason: "" },
    raw: "roll_dice({oops)",
    error: '{"error":"bad"}',
  });
}

// rollResultFollowUp: "No further rolls" only on the last round.
{
  const tr = { toolCallId: "c1", name: "roll_dice", result: '{"total":4}', success: true };
  const middle = rollResultFollowUp(tr, false);
  assert.equal(
    middle,
    'The engine resolved your roll request:\n{"total":4}\nContinue the same reply from the interruption. Use this result; do not repeat the preceding narration or reroll this action.',
  );
  assert.equal(rollResultFollowUp(tr, true), `${middle} No further rolls are available this turn.`);
}

// cutPendingRoll: the final follow-up is cut at its first roll; no roll means no cut.
{
  assert.equal(cutPendingRoll('The end. [roll: notation="1d6", reason="more"] Then more.'), "The end. ");
  assert.equal(cutPendingRoll('[roll: notation="1d6", reason="more"]'), "");
  assert.equal(cutPendingRoll("The end."), null);
  assert.equal(cutPendingRoll(""), null);
}

console.info("Roleplay roll helpers regression passed.");
