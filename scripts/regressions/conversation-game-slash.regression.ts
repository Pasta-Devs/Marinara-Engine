import assert from "node:assert/strict";
import { getSlashCompletions, matchSlashCommand } from "../../packages/client/src/lib/slash-commands.js";
import { useConversationGamesStore } from "../../packages/client/src/stores/conversation-games.store.js";

const availability = {
  mode: "conversation" as const,
  availableCapabilityIds: new Set(["uno", "eightball"]),
  conversationGames: [
    { packageId: "uno", packageName: "UNO", command: "/uno", aliases: ["uno"] },
    {
      packageId: "eightball",
      packageName: "8-Ball Pool",
      command: "/8ball",
      aliases: ["8-ball", "eightball", "pool", "billiards"],
    },
  ],
};

const uno = matchSlashCommand("/uno", availability);
assert.equal(uno?.command.name, "uno", "An installed game's primary slash command must be registered");
await uno?.command.execute("", { chatId: "conversation-chat", mode: "conversation" } as never);
assert.deepEqual(useConversationGamesStore.getState().setup, {
  packageId: "uno",
  chatId: "conversation-chat",
});

const pool = matchSlashCommand("/pool", availability);
assert.equal(pool?.command.name, "8ball", "Single-token package aliases must become slash aliases");
assert.equal(
  getSlashCompletions("/un", availability).some((command) => command.name === "uno"),
  true,
  "Installed game commands must appear in slash autocomplete",
);
assert.equal(
  matchSlashCommand("/uno", { ...availability, mode: "roleplay" }),
  null,
  "Conversation game commands must remain unavailable in Roleplay chats",
);
assert.equal(
  matchSlashCommand("/uno", { mode: "conversation", availableCapabilityIds: new Set(), conversationGames: [] }),
  null,
  "Uninstalled games must not contribute slash commands",
);

console.info("Dynamic conversation game slash regressions passed.");
