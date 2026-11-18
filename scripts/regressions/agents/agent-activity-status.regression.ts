// #7322: Agent activity's icon turns into a spinner while the chat's agents work and shows a steady dot
// after one fails. The dot stays until Agent activity has been on screen or the failures clear (a new
// reply, a retry, a chat change), and seeing it never drops the failures Retry needs. Each agent run is tracked on its
// own, so an old reply's agents finishing leaves a newer reply's agents shown as busy.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AgentFailure } from "../../../packages/client/src/lib/agent-failures.ts";
import { selectUnseenAgentFailureCount, useAgentStore } from "../../../packages/client/src/stores/agent.store.ts";

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
const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
for (const [path, icon] of [
  ["packages/client/src/features/chat-settings/ChatSettingsDrawer.tsx", "Activity"],
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
assert.match(icon, /<Spinner\b/u, "running agents turn the icon into a spinner");
assert.match(icon, /bg-\[var\(--marinara-app-accent-static\)\]/u, "the failure dot uses the steady accent");
assert.doesNotMatch(icon, /var\(--(?:primary|destructive)\)|animate-pulse/u, "the failure dot never pulses");
assert.match(
  read("packages/client/src/components/agents/AgentActivitySection.tsx"),
  /IntersectionObserver[\s\S]*?isIntersecting[\s\S]*?markFailedAgentsSeen\(chatId\)/u,
  "Agent activity on screen marks the failures seen",
);

// An old reply's agents can still run when the next reply's agents start. Each run is tracked on its own, so the old
// one finishing leaves the chat busy until the newer one finishes too.
agents().setProcessingRun("old-tail", true, "tail-chat");
agents().setProcessingRun("new-reply", true, "tail-chat");
agents().setProcessingRun("old-tail", false, "tail-chat");
assert.ok(agents().processingChatIds.includes("tail-chat"), "the newer run keeps the chat busy");
agents().setProcessingRun("new-reply", false, "tail-chat");
assert.equal(agents().processingChatIds.includes("tail-chat"), false, "the chat is idle once both runs finish");
// The composer is released once the reply is saved, and each generation ends only its own agent run.
const generateHook = read("packages/client/src/hooks/use-generate.ts");
assert.match(generateHook, /case "assistant_message_ready":[\s\S]{0,1600}setAbortController\(params\.chatId, null\)/u);
assert.match(generateHook, /setProcessingRun\(agentProcessingRunId, false, params\.chatId\)/u);
// Clear Trackers, shared by every Agent activity section, also clears the reply's saved CYOA choices.
assert.match(
  read("packages/client/src/hooks/use-agent-activity.ts"),
  /latestAssistantMessage[\s\S]{0,240}extra: \{ cyoaChoices: \[\] \}/u,
  "clearing Roleplay tracker state must also clear the persisted active CYOA prompt",
);

console.log("agent activity status regression passed");
