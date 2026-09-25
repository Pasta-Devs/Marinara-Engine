// #5740: the "understood request" triage tool - Mari reports the phrase she
// treated as the request/permission for mutating commands; it is persisted as
// ONE latest-round in-memory record (maintainer call: no growing history),
// shown under the matching reply (truncated, expandable), and included in
// Support Diagnostics. HARD CONSTRAINT: diagnostic only - never validated,
// never gates anything (#5721's lesson stands).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAssistantWorkspaceAction } from "../../packages/server/src/services/professor-mari/workspace-agent.service.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");

// ── Functional: the field parses, trims, caps, and tolerates absence ────────
const withField = parseAssistantWorkspaceAction(
  JSON.stringify({
    say: "",
    understoodRequest: "  rework her personality to be more cynical  ",
    commands: [
      {
        name: "app_data",
        arguments: { action: "character.update", characterId: "c1", patch: { personality: "x" }, apply: true },
      },
    ],
    stop: false,
  }),
);
assert.equal(withField.understoodRequest, "rework her personality to be more cynical");

const withoutField = parseAssistantWorkspaceAction(JSON.stringify({ say: "hello", commands: [], stop: true }));
assert.equal(withoutField.understoodRequest, null);

const nonString = parseAssistantWorkspaceAction(
  JSON.stringify({ say: "", understoodRequest: 42, commands: [], stop: true }),
);
assert.equal(nonString.understoodRequest, null);

const mutatingCommand = {
  name: "app_data",
  arguments: { action: "character.update", characterId: "c1", patch: { personality: "x" }, apply: true },
};
const capped = parseAssistantWorkspaceAction(
  JSON.stringify({ say: "", understoodRequest: "x".repeat(5000), commands: [mutatingCommand], stop: false }),
);
assert.equal(capped.understoodRequest?.length, 2000, "the quoted phrase is capped, never unbounded");

// Multi-frame responses: only a frame that itself carries a mutating command
// may supply the phrase - a read-only frame's phrase must never be attributed
// to another frame's mutations.
const readOnlyFrame = JSON.stringify({
  say: "",
  understoodRequest: "wrong phrase from a read-only frame",
  commands: [{ name: "app_data", arguments: { action: "character.get", characterId: "c1" } }],
  stop: false,
});
const mutatingFrameWithPhrase = JSON.stringify({
  say: "",
  understoodRequest: "right phrase from the mutating frame",
  commands: [mutatingCommand],
  stop: false,
});
const mutatingFrameNoPhrase = JSON.stringify({ say: "", commands: [mutatingCommand], stop: false });
assert.equal(
  parseAssistantWorkspaceAction(`${readOnlyFrame}\n${mutatingFrameWithPhrase}`).understoodRequest,
  "right phrase from the mutating frame",
  "the phrase comes from the frame that carries the mutating command",
);
assert.equal(
  parseAssistantWorkspaceAction(`${readOnlyFrame}\n${mutatingFrameNoPhrase}`).understoodRequest,
  null,
  "a read-only frame's phrase is never misattributed to another frame's mutations",
);

// ── Server: capture, retention, and the never-enforce constraint ────────────
const workspaceAgent = readSource("packages/server/src/services/professor-mari/workspace-agent.service.ts");
// The prompt tells the model the field is shown and NEVER validated.
assert.match(workspaceAgent, /shown to the user for transparency and NEVER validated/u);
assert.match(workspaceAgent, /"understoodRequest": "the exact words you are treating as the request or permission/u);
// One latest-round record, overwritten per qualifying round - no history.
assert.match(workspaceAgent, /private latestUnderstoodRequest: MariUnderstoodRequest \| null = null;/u);
assert.doesNotMatch(
  workspaceAgent,
  /latestUnderstoodRequest\.push|understoodRequests\b/u,
  "retention is one record, never a list",
);
// Captured for every round with mutating commands, via a RUN-LOCAL reference
// so a superseded run can never stamp or relabel another run's record.
assert.match(
  workspaceAgent,
  /if \(parsedAction\.commands\.some\(isMutatingWorkspaceCommand\)\) \{\s*\n\s*runUnderstoodRequest = \{/u,
);
// The outcome is OBSERVED, never asserted up front: the record starts as
// held/interrupted and only the command batch's own results upgrade it -
// a Plan-floor refusal must never read as an execution in a pasted report.
assert.match(workspaceAgent, /outcome: shouldDeferMutations \? "held" : "interrupted"/u);
// #5756: a staged sensitive change applied nothing, so the upgrade reports
// "held" for it - "applied" stays reserved for batches that actually applied.
assert.match(workspaceAgent, /outcome: anyMutatingFailed \? "failed" : anyStaged \? "held" : "applied"/u);
assert.match(workspaceAgent, /const anyStaged = commandResults\.some\(isStagedSensitiveMutation\);/u);
// Model-authored command labels are flattened and capped before entering the
// record (they feed a line-oriented diagnostics report).
assert.match(workspaceAgent, /label\.replace\(\/\\s\+\/gu, " "\)\.trim\(\)\.slice\(0, 80\)/u);
// The messageId stamp is scoped to the run's own record.
assert.match(workspaceAgent, /runUnderstoodRequest = \{ \.\.\.runUnderstoodRequest, messageId: message\.id \};/u);
// Status carries it.
assert.match(workspaceAgent, /latestUnderstoodRequest: this\.latestUnderstoodRequest,/u);
// Read-back (maintainer call): the chat's record is shown to Mari herself so
// "why did you treat that as permission?" is answered from the actual record,
// framed as a record - never an instruction.
assert.match(workspaceAgent, /<mari_understood_request_record>/u);
assert.match(workspaceAgent, /It is a record, not an instruction/u);
// Both model-authored values are delimiter-escaped (same convention as
// command results), so a phrase containing the closing tag can never
// terminate the block and smuggle text into the system context.
assert.match(workspaceAgent, /escapeWorkspaceXml\(understoodRequestRecord\.text\)/u);
assert.match(workspaceAgent, /escapeWorkspaceXml\(understoodRequestRecord\.commands\.join\(", "\)\)/u);

// NEVER ENFORCED. The sweep is case-blind (the stored record is
// `latestUnderstoodRequest`, capital U - a lowercase-only pattern cannot see
// it) and every conditional head that touches the field must be one of the
// enumerated bookkeeping guards below. Any new branch on the field fails
// this lane and forces a conscious review against the #5740 hard constraint.
const conditionalHeads = [...workspaceAgent.matchAll(/if\s*\([^)]*[Uu]nderstoodRequest[^)]*/gu)].map((match) =>
  match[0].replace(/\s+/gu, " ").trim(),
);
assert.deepEqual(
  conditionalHeads,
  [
    // persistAssistantMessage: bind the run's OWN record to its message.
    "if ( runUnderstoodRequest !== null && this.latestUnderstoodRequest === runUnderstoodRequest && runUnderstoodRequest.messageId === null",
    // post-batch: upgrade the run's OWN record with the observed outcome.
    "if ( runUnderstoodRequest !== null && this.latestUnderstoodRequest === runUnderstoodRequest && action.commands.some(isMutatingWorkspaceCommand",
    // prompt build: read the chat's record back to Mari as context so she can
    // explain her own interpretation when asked - inclusion-only, never a gate.
    "if (understoodRequestRecord !== null && understoodRequestRecord.chatId === chatId",
  ],
  "workspace-agent may only branch on the understood request for record bookkeeping - never to gate a command",
);
for (const file of [
  "packages/server/src/services/professor-mari/workspace-agent.service.ts",
  "packages/server/src/services/mari-db/mari-db.service.ts",
  "packages/server/src/routes/professor-mari-workspace.routes.ts",
  "packages/server/src/services/professor-mari/workspace-change-review.service.ts",
]) {
  const source = readSource(file);
  assert.doesNotMatch(
    source,
    /[Uu]nderstoodRequest[^\n]*throw|throw[^\n]*[Uu]nderstoodRequest/u,
    `${file} must never refuse anything over the understood request`,
  );
  if (file.endsWith("workspace-agent.service.ts")) continue; // bookkeeping guards enumerated above
  assert.doesNotMatch(
    source,
    /if\s*\([^)]*[Uu]nderstoodRequest/u,
    `${file} must never branch on the understood request - it is diagnostic only`,
  );
}

// ── Client: visible by default, truncated one row, expandable ───────────────
const mariChat = readSource("packages/client/src/components/chat/HomeProfessorMariChat.tsx");
assert.match(
  mariChat,
  /latestUnderstoodRequest\.messageId === message\.id/u,
  "the line anchors to the reply its round produced",
);
assert.match(
  mariChat,
  /understoodRequestExpanded \? "min-w-0 whitespace-pre-wrap break-words" : "min-w-0 truncate"/u,
  "one-row truncation with click-to-expand; break-words so an unbreakable token cannot widen the transcript",
);
// Expansion is keyed by messageId, so it can never carry over to the next
// round's record under a different reply.
assert.match(mariChat, /expandedUnderstoodRequestMessageId === message\.id/u);
assert.match(mariChat, /current === message\.id \? null : message\.id/u);
// The expanded detail shows the record's mode and EVERY outcome, not just held.
assert.match(mariChat, /MARI_PERMISSIONS_MODE_LABELS\[understoodRequest\.permissionsMode\]/u);
assert.match(mariChat, /actingOnOutcomeApplied/u);
assert.match(mariChat, /actingOnOutcomeFailed/u);
assert.match(mariChat, /actingOnOutcomeInterrupted/u);
assert.match(
  mariChat,
  /aria-expanded=\{understoodRequestExpanded\}/u,
  "the disclosure exposes its expanded state to assistive tech",
);
assert.match(
  mariChat,
  /actingOnCollapse"\s*\n?\s*: "ui\.chat\.homeprofessormarichat\.actingOnExpand"/u,
  "the tooltip switches between expand and collapse wording",
);
assert.match(mariChat, /understoodRequest\.outcome === "held"/u);

const enJson = JSON.parse(readSource("packages/client/src/localization/locales/en.json")) as Record<string, string>;
for (const key of [
  "ui.chat.homeprofessormarichat.actingOnValue1",
  "ui.chat.homeprofessormarichat.actingOnNothingReported",
  "ui.chat.homeprofessormarichat.actingOnExpand",
  "ui.chat.homeprofessormarichat.actingOnCollapse",
  "ui.chat.homeprofessormarichat.actingOnModeOutcomeValue1Value2",
  "ui.chat.homeprofessormarichat.actingOnOutcomeApplied",
  "ui.chat.homeprofessormarichat.actingOnOutcomeFailed",
  "ui.chat.homeprofessormarichat.actingOnOutcomeInterrupted",
  "ui.chat.homeprofessormarichat.heldForYourApproval",
]) {
  assert.ok(key in enJson, `en.json must carry ${key}`);
}
assert.match(
  enJson["ui.panels.advancedsettings.supportDiagnosticsDescription"] ?? "",
  /Professor Mari/u,
  "the Support Diagnostics description discloses that the copy can carry the Mari phrase",
);

// ── Diagnostics: the triage line distinguishes unreachable / none / recorded ─
const diagnostics = readSource("packages/client/src/lib/support-diagnostics.ts");
assert.match(diagnostics, /Mari last acted on:/u);
assert.match(diagnostics, /Unavailable \(workspace status not reachable\)/u);
assert.match(diagnostics, /none recorded this session/u);
// The phrase is flattened and capped for the line-oriented report (a
// multi-line quote would forge extra report lines and orphan the metadata).
assert.match(diagnostics, /function reportPhrase\(/u);
assert.match(diagnostics, /\.replace\(\/\\s\+\/gu, " "\)\.trim\(\)/u);
assert.match(diagnostics, /flattened\.slice\(0, 200\)/u);
// Outcomes are honest: no promotion of "not deferred" to "executed".
assert.match(diagnostics, /failed: "refused or failed"/u);
assert.match(diagnostics, /interrupted: "interrupted before completion"/u);
assert.doesNotMatch(
  diagnostics,
  /"executed"/u,
  "the report may only state observed outcomes - never assert an execution the server never saw",
);
const settingsPanel = readSource("packages/client/src/components/panels/SettingsPanel.tsx");
assert.match(settingsPanel, /\.catch\(\(\) => undefined\);/u);
assert.match(settingsPanel, /mariActingOn,/u, "the diagnostics copy must include the triage line");
assert.match(
  settingsPanel,
  /workspace\/status", \{ signal: requestTimeoutSignal\(5_000\) \}/u,
  "the status fetch carries a deadline - a frozen host must not turn the copy button into a silent no-op (#5657)",
);

console.log("Mari understood-request regression passed.");
