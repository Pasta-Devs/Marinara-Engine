import assert from "node:assert/strict";
import { getSlashCompletions, matchSlashCommand } from "../../packages/client/src/lib/slash-commands.js";
import { useConversationGamesStore } from "../../packages/client/src/stores/conversation-games.store.js";

const availability = {
  mode: "conversation" as const,
  availableCapabilityIds: new Set([
    "uno",
    "chess",
    "poker",
    "eightball",
    "tic-tac-toe",
    "rock-paper-scissors",
  ]),
  conversationGames: [
    { packageId: "uno", packageName: "UNO", command: "/uno", aliases: ["uno"] },
    { packageId: "chess", packageName: "Chess", command: "/chess", aliases: ["chess"] },
    { packageId: "poker", packageName: "Poker", command: "/poker", aliases: ["poker", "hold'em"] },
    {
      packageId: "eightball",
      packageName: "8-Ball Pool",
      command: "/8ball",
      aliases: ["8-ball", "eightball", "pool", "billiards"],
    },
    {
      packageId: "tic-tac-toe",
      packageName: "Tic-Tac-Toe",
      command: "/tictactoe",
      aliases: ["tic-tac-toe", "tic tac toe", "ttt"],
    },
    {
      packageId: "rock-paper-scissors",
      packageName: "Rock-Paper-Scissors",
      command: "/rps",
      aliases: ["rock paper scissors", "rock-paper-scissors", "rps"],
    },
  ],
};

for (const command of ["/uno", "/chess", "/poker", "/8ball", "/tictactoe", "/rps"]) {
  assert.ok(matchSlashCommand(command, availability), `${command} must be registered after its package is installed`);
}

const uno = matchSlashCommand("/uno", availability);
assert.equal(uno?.command.name, "uno", "An installed game's primary slash command must be registered");
await uno?.command.execute("", { chatId: "conversation-chat", mode: "conversation" } as never);
assert.deepEqual(useConversationGamesStore.getState().setup, {
  packageId: "uno",
  chatId: "conversation-chat",
});

const pool = matchSlashCommand("/pool", availability);
assert.equal(pool?.command.name, "8ball", "Single-token package aliases must become slash aliases");
const ttt = matchSlashCommand("/ttt", availability);
assert.equal(ttt?.command.name, "tictactoe", "Tic-Tac-Toe's short alias must open the installed game");
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

const sendCommand = matchSlashCommand('/send "A persona beat"', { mode: "roleplay" });
assert.ok(sendCommand, "/send must match slash command parsing");
assert.equal(sendCommand?.command.name, "send");
let createdRole: string | null = null;
let createdContent: string | null = null;
let createdCharacterId: string | null | undefined = "sentinel";
let generateCalls = 0;
const result = await sendCommand?.command.execute(sendCommand.args, {
  chatId: "test-chat",
  mode: "roleplay",
  createMessage: async (data: { role: string; content: string; characterId?: string | null }) => {
    createdRole = data.role;
    createdContent = data.content;
    createdCharacterId = data.characterId;
  },
  generate: async () => {
    generateCalls += 1;
  },
} as never);
assert.deepEqual(result, { handled: true });
assert.equal(createdRole, "user");
assert.equal(createdContent, "A persona beat");
assert.equal(createdCharacterId, null);
assert.equal(generateCalls, 0);

const emptySendResult = await sendCommand?.command.execute("   ", {
  chatId: "test-chat",
  mode: "roleplay",
  createMessage: async () => {},
  generate: async () => {},
} as never);
assert.deepEqual(emptySendResult, { handled: true, feedback: "Usage: /send <message>" });

console.info("Dynamic conversation game slash regressions passed.");
