// Capability API 1.820: a package sets a busy/alert signal per chat through the agent store's `setPackageActivity`;
// Agent activity's icon spins while one is busy and shows its dot on an alert, only for that chat.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectPackageAlert, selectPackageBusy, useAgentStore } from "../../packages/client/src/stores/agent.store.ts";

const agents = () => useAgentStore.getState();
const busy = (chatId: string) => selectPackageBusy(agents(), chatId);
const alert = (chatId: string) => selectPackageAlert(agents(), chatId);

assert.deepEqual(agents().packageActivity, {}, "no signal before a package reports one");

agents().setPackageActivity("pkg-a", "chat-1", { busy: true });
assert.deepEqual(agents().packageActivity, { "chat-1": { "pkg-a": { busy: true, alert: false } } });
assert.ok(busy("chat-1") && !alert("chat-1"), "a busy package spins the icon, with no dot");
assert.ok(!busy("chat-2") && !alert("chat-2"), "another chat shows nothing");

agents().setPackageActivity("pkg-a", "chat-1", { alert: true });
assert.deepEqual(
  agents().packageActivity["chat-1"]?.["pkg-a"],
  { busy: true, alert: true },
  "a patch keeps what it omits",
);

agents().setPackageActivity("pkg-b", "chat-2", { alert: true });
agents().setPackageActivity("pkg-a", "chat-1", { busy: false });
assert.ok(!busy("chat-1") && alert("chat-1"), "the alert stays after the work ends");
assert.ok(alert("chat-2"), "a second chat's signal is separate");

const before = agents().packageActivity;
agents().setPackageActivity("pkg-a", "chat-1", { alert: true });
assert.equal(agents().packageActivity, before, "an unchanged signal does not update the store");

agents().setPackageActivity("pkg-a", "chat-1", { alert: false });
assert.deepEqual(
  agents().packageActivity,
  { "chat-2": { "pkg-b": { busy: false, alert: true } } },
  "both false removes the entry",
);
assert.ok(!busy("chat-1") && !alert("chat-1") && alert("chat-2"), "other chats' entries are unaffected");

agents().setPackageActivity("pkg-a", "chat-2", { busy: true });
agents().setPackageActivity("pkg-b", "chat-2", { alert: false });
assert.ok(busy("chat-2") && !alert("chat-2"), "a chat's signal is any of its packages'");
agents().setPackageActivity("pkg-a", "chat-2", {});
assert.ok(busy("chat-2"), "an empty patch changes nothing");

agents().setPackageActivity("pkg-a", "chat-2", undefined as never);
assert.ok(busy("chat-2"), "a missing patch changes nothing and does not throw");
agents().setPackageActivity("pkg-a", "chat-2", { busy: "yes" as unknown as boolean });
assert.ok(!busy("chat-2"), "only a real true counts, a package cannot set a truthy string");

agents().setPackageActivity("pkg-a", "chat-2", { busy: true });
agents().resetForChatChange();
assert.ok(busy("chat-2"), "changing chats leaves the package's signal to the package");
agents().reset();
assert.deepEqual(agents().packageActivity, {}, "reset() clears every signal");

// The icon and the menu read it.
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const icon = read("packages/client/src/components/agents/AgentActivityIcon.tsx");
assert.match(
  icon,
  /processingChatIds\.includes\(chatId\) \|\| selectPackageBusy\(s, chatId\)/u,
  "a busy package spins it",
);
assert.match(icon, /\(failed > 0 \|\| alerting\) && \(/u, "an alert shows the dot");
assert.match(
  read("packages/client/src/components/chat/RoleplayHUDActionsMenu.tsx"),
  /packageSignalsActivity \|\|/u,
  "a busy or alerting package counts as activity in the panel",
);
const docs = read("docs/development/optional-agent-packages.md");
assert.match(
  docs,
  /stores\.agent\.getState\(\)\.setPackageActivity\(/u,
  "the docs call it where the Engine exposes it",
);

console.log("agent package activity regression passed");
