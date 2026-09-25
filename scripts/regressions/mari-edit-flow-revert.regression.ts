// #5721: Professor Mari's post-#4838 server-side authorization gate is REMOVED,
// and the hidden-reasoning disable now covers custom providers.
//
// Problem B: the gate required a verbatim user-message excerpt for every
// mutating command, so an intent-phrased request ("rework her personality to be
// more cynical") had its first, correct attempt discarded ("Mutation blocked
// before execution"), forced a typed approval, and made Mari regenerate the
// same edit into the review window - two generations and two confirmations for
// one change. #4838's intent-keyed prompt guidance plus the Keep/Restore
// review card is the intended contract; the memory system (#4851) is the
// per-user lever for people who want Mari less forward.
//
// Problem A: disableHiddenReasoning excluded custom providers, so a
// reasoning-capable model on a local OpenAI-compatible server (the reporter's
// Unsloth/gemma setup) did its substantive work - plans, questions - inside
// hidden reasoning and the visible JSON frame only alluded to it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");

const workspaceAgent = readSource("packages/server/src/services/professor-mari/workspace-agent.service.ts");

// ── The gate is gone ────────────────────────────────────────────────────────
assert.doesNotMatch(
  workspaceAgent,
  /Mutation blocked before execution/u,
  "the pre-execution authorization gate must stay removed (#5721)",
);
assert.doesNotMatch(workspaceAgent, /workspaceMutationAuthorizationIssue/u);
assert.doesNotMatch(workspaceAgent, /MUTATION_INTENT_PATTERNS/u);
assert.doesNotMatch(
  workspaceAgent,
  /`authorization` is required before ANY mutating command/u,
  "the prompt must no longer demand a verbatim authorization excerpt",
);
assert.doesNotMatch(workspaceAgent, /"authorization":\s*"verbatim/u);
assert.doesNotMatch(workspaceAgent, /mariPendingMutation(?:Categories|Signatures)/u);

// ── What replaces it stays ──────────────────────────────────────────────────
// #4838's intent-keyed read-only guidance is the behavioral contract.
assert.match(
  workspaceAgent,
  /What separates the two cases is intent, not grammar/u,
  "#4838's intent guidance must remain",
);
assert.match(workspaceAgent, /Default to read-only\./u);
// The self-declared approval pause (Mari asks first, commands deferred) survives.
assert.match(workspaceAgent, /awaitingAuthorization/u);
assert.match(workspaceAgent, /visibleTextRequestsUserApproval/u);
assert.match(workspaceAgent, /"authorization-accept"/u, "the Accept chip for Mari's own deferrals stays");
// Ordinary command validation still runs before execution.
assert.match(workspaceAgent, /const validationIssue = workspaceCommandValidationIssue\(command\);/u);

// ── Proactive preference memories (#5721 follow-through) ────────────────────
assert.match(
  workspaceAgent,
  /Proactive preference memories/u,
  "Mari must be told she may record repeated workflow mismatches",
);
assert.match(workspaceAgent, /"propose changes" means describing the changes in chat/u);

// ── Hidden-reasoning disable covers custom providers (#5721 Problem A) ──────
assert.match(
  workspaceAgent,
  /disableHiddenReasoning =[\s\S]{0,400}isLocalInferenceBaseUrl\(connection\.baseUrl \?\? ""\)/u,
  "LOCAL custom providers must be included in the reasoning disable",
);
// Remote custom endpoints stay excluded on purpose: the provider layer sends
// reasoning_effort:"none" ungated for generic custom providers, and strict
// remote gateways 400 on it.
const ipAllowlist = readSource("packages/server/src/middleware/ip-allowlist.ts");
assert.match(ipAllowlist, /export function isLocalInferenceBaseUrl/u);
// The provider layer's local-inference thinking disable is the mechanism that
// makes "none" effective for llama.cpp/vLLM-style servers - keep the pairing.
const openaiProvider = readSource("packages/server/src/services/llm/providers/openai.provider.ts");
assert.match(openaiProvider, /enforceLocalInferenceThinkingDisable/u);
assert.match(openaiProvider, /enable_thinking: false/u);

// ── The shared extras no longer advertise the retired fingerprints ──────────
const chatTypes = readSource("packages/shared/src/types/chat.ts");
assert.doesNotMatch(chatTypes, /mariPendingMutation(?:Categories|Signatures)/u);

console.log("Mari edit-flow revert regression passed.");
