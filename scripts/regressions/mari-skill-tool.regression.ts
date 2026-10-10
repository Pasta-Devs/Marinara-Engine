// The `skill` tool (PR 2) must pass the workspace-command validation gate and
// dispatch to commandSkill. A missing `skill` case in workspaceCommandValidationIssue
// made every skill call fail with "Unsupported workspace command: skill" before
// reaching the dispatcher.
import assert from "node:assert/strict";
import { ProfessorMariWorkspaceService } from "../../packages/server/src/services/professor-mari/workspace-agent.service.js";

const service = new ProfessorMariWorkspaceService({} as never);
const run = (args: Record<string, unknown>) =>
  (service as unknown as {
    executeWorkspaceCommand(
      command: { id: string; name: string; arguments: Record<string, unknown> },
      signal: AbortSignal,
      trace: unknown[],
      onEvent: () => void,
    ): Promise<{ output: string; success: boolean }>;
  }).executeWorkspaceCommand({ id: "cmd", name: "skill", arguments: args }, new AbortController().signal, [], () => undefined);

const builtIn = await run({ id: "read-docs" });
assert.equal(builtIn.success, true, `built-in skill fetch must dispatch, got: ${builtIn.output}`);
assert.match(builtIn.output, /^<skill id="read-docs" name="Read Docs" builtin="true">\n/);

const missingId = await run({});
assert.equal(missingId.success, false);
assert.match(missingId.output, /skill requires a non-empty id string/);

const unknown = await run({ id: "no-such-skill" });
assert.equal(unknown.success, true, "an unknown id still reaches commandSkill");
assert.match(unknown.output, /^Skill "no-such-skill" not found\.$/);

console.log("mari-skill-tool regression passed");
