// #7949: a structured-tool error is the documentation a small model reads at the moment it is
// wrong. Every message must name the action, echo what arrived, and say where the value goes.
import assert from "node:assert/strict";
import {
  badEnum,
  describeReceived,
  needArg,
  unknownActionMessage,
} from "../../../packages/server/src/services/mari-db/tool-error.js";

const message = (run: () => void): string => {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "";
};

// A required field: action, field, what arrived, where it belongs.
assert.match(
  message(() =>
    needArg("character.create", "name", { received: undefined, shape: 'Send {"action":"character.create"}.' }),
  ),
  /character\.create needs a non-empty "name" \(none was sent\)/,
);
assert.match(
  message(() => needArg("lorebook.addEntry", "lorebookId", { aliases: ["id"], received: "" })),
  /needs a non-empty "lorebookId" or "id" \(an empty string was sent\)/,
);

// An unknown action: echo it, suggest a near miss, list the valid set; no invented suggestion.
assert.match(
  unknownActionMessage("lorebook", "gets", ["get", "list"]),
  /Unknown lorebook action "gets"\. Did you mean "get"\?/,
);
assert.doesNotMatch(unknownActionMessage("lorebook", "delete", ["get"]), /Did you mean/u);
// A huge name is cut before it is compared or echoed.
assert.match(unknownActionMessage("lorebook", "x".repeat(300_000), ["get"]), /Unknown lorebook action "x{80}…"\./u);

// An enum: names the field, the set, and what arrived.
assert.match(
  message(() => badEnum("role", ["system", "user"], "assistant")),
  /"role" must be one of system, user \(got "assistant"\)/,
);

// describeReceived never dumps a payload.
assert.equal(describeReceived(42), "got 42");
assert.match(describeReceived({ a: 1 }), /got an object with keys a/u);

// The workspace gate runs before every tool call: it names the top-level key, echoes what
// arrived and shows one valid call, so "non-empty string" is never read as a formatting complaint.
const { workspaceCommandValidationIssue } =
  await import("../../../packages/server/src/services/professor-mari/workspace-agent.service.js");
const gate = (name: string, args: Record<string, unknown>) =>
  workspaceCommandValidationIssue({ name, arguments: args } as Parameters<typeof workspaceCommandValidationIssue>[0]) ??
  "";
assert.match(
  gate("write", { path: "notes.md", content: 42 }),
  /write needs a top-level "content" string; it may be empty \(got 42\)\. Example: \{"path"/u,
);
assert.match(
  gate("app_data", {}),
  /app_data needs a non-empty top-level "action" string \(none was sent\)\. Example: \{"action":"character\.get"/u,
);
assert.equal(gate("read", { path: "notes.md" }), "");

console.log("structured tool error messages passed");
