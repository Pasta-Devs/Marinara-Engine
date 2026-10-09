// #7322: Agent activity's icon turns into a spinner while the chat's agents work and shows a steady dot
// after one fails. The dot stays until Agent activity has been on screen or the failures clear (a new
// reply, a retry, a chat change), and seeing it never drops the failures Retry needs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AgentFailure } from "../../packages/client/src/lib/agent-failures.ts";
import { selectUnseenAgentFailureCount, useAgentStore } from "../../packages/client/src/stores/agent.store.ts";

const agents = () => useAgentStore.getState();
const dot = (chatId: string) => selectUnseenAgentFailureCount(agents(), chatId);
const failure = (agentType: string): AgentFailure => ({
  agentType,
  agentName: agentType,
  error: "Provider call failed",
  reasonLabel: null,
  retryTarget: null,
});

assert.equal(dot("chat-a"), 0, "no dot before an agent fails");

agents().setFailedAgentFailures([failure("world-state")], "chat-a");
assert.equal(dot("chat-a"), 1, "a failed agent shows the dot");
assert.equal(dot("chat-b"), 0, "another chat's failure shows no dot");

agents().markFailedAgentsSeen("chat-b");
assert.equal(dot("chat-a"), 1, "Agent activity of another chat does not clear this chat's dot");

agents().markFailedAgentsSeen("chat-a");
assert.equal(dot("chat-a"), 0, "opening Agent activity clears the dot");
assert.deepEqual(agents().failedAgentTypes, ["world-state"], "the failures stay for Retry");

agents().setFailedAgentFailures([failure("world-state"), failure("illustrator")], "chat-a");
assert.equal(dot("chat-a"), 2, "a later failure shows the dot again");

agents().clearFailedAgentTypes("chat-a");
assert.equal(dot("chat-a"), 0, "a new reply or retry clears the dot with the failures, as the old badge did");

agents().setFailedAgentTypes(["character-tracker"]);
assert.equal(dot("chat-a"), 1, "failures without a chat show in every chat, like the Retry list");
agents().resetForChatChange();
assert.equal(dot("chat-a"), 0, "changing chats clears the dot");

// Every Agent activity icon gets the status, and the dot holds the theme accent steady.
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
for (const [path, icon] of [
  ["packages/client/src/components/chat/ChatSettingsDrawer.tsx", "Activity"],
  ["packages/client/src/components/chat/RoleplayTrackerWindow.tsx", "ListChecks"],
  ["packages/client/src/features/tracker-panel/components/TrackerAgentActivitySection.tsx", "Sparkles"],
] as const) {
  assert.match(
    read(path),
    new RegExp(`icon=\\{withAgentActivityStatus\\((?:chat\\.id|chatId), <${icon} `, "u"),
    `${path} shows the Agent activity status on its icon`,
  );
}
const icon = read("packages/client/src/components/agents/AgentActivityIcon.tsx");
assert.match(icon, /<Loader2[^>]*animate-spin/u, "running agents turn the icon into a spinner");
assert.match(icon, /bg-\[var\(--marinara-app-accent-static\)\]/u, "the failure dot uses the steady accent");
assert.doesNotMatch(icon, /var\(--(?:primary|destructive)\)|animate-pulse/u, "the failure dot never pulses");
assert.match(
  read("packages/client/src/components/agents/AgentActivitySection.tsx"),
  /IntersectionObserver[\s\S]*?isIntersecting[\s\S]*?markFailedAgentsSeen\(chatId\)/u,
  "Agent activity on screen marks the failures seen",
);

console.log("agent activity status regression passed");
