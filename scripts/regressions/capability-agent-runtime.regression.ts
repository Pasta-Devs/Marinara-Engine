import assert from "node:assert/strict";
import type { AgentContext, AgentResult } from "../../packages/shared/src/index.js";
import type { AgentExecConfig } from "../../packages/server/src/services/agents/agent-executor.js";
import {
  assertCapabilityAgentRuntimeServiceRegistration,
  finalizeCapabilityAgentResults,
  prepareCapabilityAgentContexts,
} from "../../packages/server/src/services/capability-packages/capability-agent-runtime.service.js";
import {
  registerCapabilityService,
  resetCapabilityServices,
} from "../../packages/server/src/services/capability-packages/capability-service-registry.service.js";
import { withDeadline } from "../../packages/server/src/services/capability-packages/capability-prompt-context.service.js";

const agent = {
  id: "memory-nag-config",
  type: "memory-nag",
  name: "Memory Nag",
  phase: "post_processing",
  connectionId: null,
  settings: {},
} as AgentExecConfig;
const context = {
  chatId: "chat-1",
  chatMode: "roleplay",
  recentMessages: [],
  mainResponse: "Pierro asks about the promise.",
  gameState: null,
  characters: [],
  memory: {},
} as AgentContext;
const result: AgentResult = {
  agentId: agent.id,
  agentType: agent.type,
  type: "memory_nag",
  data: { memoryIds: ["promise"] },
  tokensUsed: 1,
  durationMs: 1,
  success: true,
  error: null,
};

resetCapabilityServices();
assert.doesNotThrow(() =>
  assertCapabilityAgentRuntimeServiceRegistration("memory-nag", ["agent-runtime"], "agent-runtime:memory-nag"),
);
assert.throws(
  () => assertCapabilityAgentRuntimeServiceRegistration("other-package", ["agent-runtime"], "agent-runtime:memory-nag"),
  /cannot register an agent runtime for another package/,
);
assert.throws(
  () => assertCapabilityAgentRuntimeServiceRegistration("memory-nag", [], "agent-runtime:memory-nag"),
  /must declare the "agent-runtime" permission/,
);
const release = registerCapabilityService("agent-runtime:memory-nag", {
  prepareContext: () => ({ candidates: [{ id: "promise" }] }),
  finalizeResult: ({ result: input }: { result: AgentResult }) => ({
    ...input,
    data: { nags_needed: true, memoryIds: ["promise"] },
  }),
});

const prepared = await prepareCapabilityAgentContexts([agent], context);
assert.deepEqual(prepared.memory._capabilityAgentContexts, {
  "memory-nag": { candidates: [{ id: "promise" }] },
});
const finalized = await finalizeCapabilityAgentResults([result], [agent], prepared);
assert.deepEqual(finalized[0]?.data, { nags_needed: true, memoryIds: ["promise"] });
await assert.rejects(withDeadline(new Promise(() => undefined), "agent-runtime regression", 5), /exceeded 5ms/);

release();
resetCapabilityServices();
console.info("Capability agent runtime regression passed");
