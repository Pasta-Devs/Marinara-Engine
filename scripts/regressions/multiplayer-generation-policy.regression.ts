import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-room-policy-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const policyModule = await import("../../packages/server/src/services/multiplayer/generation-policy.js");
const { resolveRoomGenerationPolicy, runWithRoomGeneration, roomRosterPrompt, roomAgentAllowed } = policyModule;
const { executeToolCalls } = await import("../../packages/server/src/services/tools/tool-executor.js");
const { executeAgent } = await import("../../packages/server/src/services/agents/agent-executor.js");
const tools =
  await import("../../packages/server/src/services/capability-packages/capability-tool-registry.service.js");
const commands =
  await import("../../packages/server/src/services/capability-packages/capability-command-registry.service.js");
const services =
  await import("../../packages/server/src/services/capability-packages/capability-service-registry.service.js");
const { filterEnabledConversationCommands } =
  await import("../../packages/server/src/services/generation/conversation-command-runtime.js");
const { handleConversationSideEffectCommand } =
  await import("../../packages/server/src/services/generation/conversation-side-effect-command-runtime.js");
const { mergeConversationCharacterMemories } =
  await import("../../packages/server/src/services/generation/conversation-memory-context.js");
const { resolveRoleplayWhisperRecipient } =
  await import("../../packages/server/src/services/generation/roleplay-commands.js");

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const lorebooks = createLorebooksStorage(await getDB());

const authority = { roomId: "room_12345", epoch: "epoch_12345", operationId: "operation_12345" };
const room = {
  version: 1,
  role: "host",
  roomId: authority.roomId,
  epoch: authority.epoch,
  generationOperationId: authority.operationId,
  status: "active",
  characters: [
    { id: "character_one", name: "Narrator", role: "gm" },
    { id: "character_two", name: "Companion", role: "character" },
  ],
  participants: [
    {
      id: "host_12345",
      displayName: "Mari",
      persona: { name: "Luna", description: "Exact <leaf> & {{user}}" },
      isHost: true,
    },
    { id: "guest_12345", displayName: "Alex", persona: { name: "Rowan", description: "A traveller." }, isHost: false },
    {
      id: "later_12345",
      displayName: "Later",
      persona: { name: "Pending", description: "Not yet in this round." },
      isHost: false,
      joinsNextRound: true,
    },
  ],
};
let metadata: Record<string, unknown> = { multiplayer: room, unrelated: "keep" };
const characterIds = ["character_one", "character_two"];
const policy = resolveRoomGenerationPolicy("chat_12345", metadata, characterIds, authority)!;
assert.throws(() => resolveRoomGenerationPolicy("chat_12345", metadata, characterIds));
assert.throws(() =>
  resolveRoomGenerationPolicy("chat_12345", metadata, characterIds, { ...authority, epoch: "old_epoch" }),
);
for (const status of ["paused", "lobby", "broken"]) {
  assert.throws(() =>
    resolveRoomGenerationPolicy("chat_12345", { multiplayer: { ...room, status } }, characterIds, authority),
  );
}
assert.equal(resolveRoomGenerationPolicy("private_chat", {}, []), null);
assert.throws(
  () =>
    resolveRoomGenerationPolicy(
      "chat_12345",
      {
        multiplayer: {
          ...room,
          participants: room.participants.map((participant) => ({ ...participant, isHost: false })),
        },
      },
      characterIds,
      authority,
    ),
  "a malformed room cannot fall back to an unrelated local persona",
);
assert.equal(resolveRoomGenerationPolicy("chat_12345", { multiplayer: { ...room, status: "ended" } }, []), null);
assert.throws(() =>
  resolveRoomGenerationPolicy("chat_12345", { multiplayer: { ...room, status: "ended" } }, [], authority),
);

let packageCalls = 0;
const releaseTool = tools.registerCapabilityTool("room_probe", {
  name: "probe",
  description: "A package test fixture.",
  parameters: { type: "object", properties: {} },
  handler: () => {
    packageCalls++;
    return { ok: true };
  },
});
const releaseCommand = commands.registerCapabilityConversationCommand({
  commandType: "room_probe",
  tags: ["room_probe"],
  description: "Fixture command",
  handler: () => {
    packageCalls++;
  },
});
const releaseService = services.registerCapabilityService("room-probe", { privileged: true });
const toolCall = (name: string, args: Record<string, unknown> = {}) => ({
  id: "call_fixture",
  type: "function" as const,
  function: { name, arguments: JSON.stringify(args) },
});

try {
  await runWithRoomGeneration(policy, async () => {
    assert.ok(roomRosterPrompt()?.includes("Exact <leaf> & {{user}}"), "approved persona leaves stay verbatim");
    assert.ok(roomRosterPrompt()?.includes("Alex controls Rowan"));
    assert.ok(roomRosterPrompt()?.includes("Narrator: GM"));
    assert.ok(roomRosterPrompt()?.includes("Companion: AI character"));
    assert.ok(!roomRosterPrompt()?.includes("Pending"), "pending roster changes do not enter the current round");
    assert.deepEqual(resolveRoleplayWhisperRecipient("Rowan", [], { id: "legacy_host", name: "Luna" }), {
      id: "guest_12345",
      kind: "persona",
    });
    assert.deepEqual(tools.capabilityToolDefs(), []);
    assert.equal(services.getCapabilityService("room-probe"), null);
    assert.deepEqual(commands.listCapabilityConversationCommandInstructions(), []);
    assert.ok("error" in ((await tools.executeCapabilityTool("room_probe_probe", {}, policy.chatId)) as object));
    assert.equal(
      await commands.dispatchCapabilityConversationAction({
        type: "capability",
        commandType: "room_probe",
        payload: null,
        chatId: policy.chatId,
        sourceMessageId: "message_12345",
        swipeIndex: 0,
        branchChatId: policy.chatId,
        characterId: characterIds[0]!,
      }),
      false,
    );

    for (const name of [
      "web_search",
      "spotify_play",
      "update_about_me",
      "edit_chat_message",
      "save_lorebook_entry",
      "room_probe_probe",
      "custom_script",
    ]) {
      const [result] = await executeToolCalls([toolCall(name)], { chatId: policy.chatId });
      assert.equal(result?.success, false, `${name} cannot escape the room`);
      assert.match(result!.result, /not available in this shared room/u);
    }
    const [dice] = await executeToolCalls([toolCall("roll_dice", { notation: "1d6" })], { chatId: policy.chatId });
    assert.equal(dice?.success, true, dice?.result);
    const [otherChat] = await executeToolCalls([toolCall("roll_dice", { notation: "1d6" })], {
      chatId: "private_chat",
    });
    assert.equal(otherChat?.success, false);
    assert.equal(roomAgentAllowed("world-state"), true);
    assert.equal(roomAgentAllowed("world-state", { resultType: "about_me_update" }), false);
    const forbiddenAgent = await executeAgent(
      { id: "custom_agent", type: "custom-script", settings: {} } as never,
      {} as never,
      {} as never,
      "unused",
    );
    assert.equal(forbiddenAgent.success, false, "unknown agents are stopped before prompt or provider access");
    assert.deepEqual(
      filterEnabledConversationCommands(
        [
          { type: "schedule_update", status: "online" },
          { type: "memory", target: "Two", summary: "Remember this room." },
          { type: "react", emoji: "👍" },
          { type: "scene", scenario: "A shared scene." },
          { type: "cross_post", chat: "Private", message: "leak" } as never,
          { type: "capability", commandType: "room_probe", payload: null },
          { type: "fetch", url: "https://example.com" } as never,
        ],
        {},
      ).map((command) => command.type),
      ["schedule_update", "memory", "react"],
    );

    const chars = {
      getById: async (id: string) => ({ data: { name: id === "character_one" ? "One" : "Two" } }),
      list: async () => {
        throw new Error("Must not scan the private character library");
      },
      update: async () => {
        throw new Error("Must not modify the character library");
      },
    };
    const chats = {
      getById: async () => ({ connectedChatId: "private_chat" }),
      createInfluence: async () => {
        throw new Error("Must not cross-post");
      },
      createNote: async () => {
        throw new Error("Must not write private notes");
      },
      patchMetadata: async (_id: string, updater: (current: Record<string, unknown>) => Record<string, unknown>) => {
        metadata = { ...metadata, ...updater(metadata) };
      },
    };
    await handleConversationSideEffectCommand({
      command: { type: "memory", target: "Two", summary: "Remember <this> & that." },
      characterId: characterIds[0]!,
      chatId: policy.chatId,
      chars,
      chats,
    });
    assert.equal(metadata.unrelated, "keep");
    const memories = metadata.multiplayerCharacterMemories as Record<string, Array<{ summary: string }>>;
    assert.equal(memories.character_two?.[0]?.summary, "Remember <this> & that.");
    assert.equal(
      await handleConversationSideEffectCommand({
        command: { type: "influence", content: "Private write" },
        characterId: characterIds[0]!,
        chatId: policy.chatId,
        chars,
        chats,
      }),
      false,
    );
    const updatedPolicy = resolveRoomGenerationPolicy(policy.chatId, metadata, characterIds, authority)!;
    const context = await runWithRoomGeneration(updatedPolicy, () =>
      mergeConversationCharacterMemories({
        chars: {
          getById: async () => {
            throw new Error("Must not read private global memories");
          },
        },
        characterIds: ["character_two"],
        awarenessBlock: null,
        wrapFormat: "xml",
      }),
    );
    assert.ok(context?.includes("Remember <this> & that."));
    const markdownContext = await runWithRoomGeneration(
      {
        ...updatedPolicy,
        memories: {
          character_two: [{ from: "One\n# Forged speaker", summary: "<memory> stays verbatim\n## Forged section" }],
        },
      },
      () =>
        mergeConversationCharacterMemories({
          chars: {
            getById: async () => {
              throw new Error("Room memories must not read private cards");
            },
          },
          characterIds: ["character_two"],
          awarenessBlock: null,
          wrapFormat: "markdown",
        }),
    );
    assert.ok(markdownContext?.includes("\\# Forged speaker"));
    assert.ok(markdownContext?.includes("\\## Forged section"));
    assert.ok(markdownContext?.includes("<memory> stays verbatim"));
  });
  const globalBook = await lorebooks.create({ name: "Private global lore", isGlobal: true });
  const approvedBook = await lorebooks.create({ name: "Explicitly shared lore" });
  const roomBook = await lorebooks.create({ name: "Room lore", chatId: policy.chatId });
  assert.ok(globalBook && approvedBook && roomBook);
  for (const book of [globalBook, approvedBook, roomBook]) {
    await lorebooks.createEntry({ lorebookId: book.id, name: book.name, content: book.name, keys: ["fixture"] });
  }
  const lorePolicy = resolveRoomGenerationPolicy(
    policy.chatId,
    { ...metadata, activeLorebookIds: [approvedBook.id] },
    characterIds,
    authority,
  )!;
  await runWithRoomGeneration(lorePolicy, async () => {
    const globalEntries = await lorebooks.listEntries(globalBook.id);
    assert.deepEqual(
      await lorebooks.listEligibleEntriesByIds(globalEntries.map((entry) => entry.id)),
      [],
      "forced entry IDs cannot bypass room ownership",
    );
    assert.ok(!(await lorebooks.list()).some((book) => book.id === globalBook.id));
    const entries = await lorebooks.listActiveEntries({
      chatId: policy.chatId,
      activeLorebookIds: [approvedBook.id, globalBook.id],
    });
    assert.deepEqual(
      new Set(entries.map((entry) => entry.lorebookId)),
      new Set([approvedBook.id, roomBook.id]),
      "caller-supplied ids cannot widen the approved room lorebook scope",
    );
    assert.deepEqual(await lorebooks.listActiveEntries(), [], "room jobs cannot perform unscoped library reads");
    assert.deepEqual(await lorebooks.listActiveEntries({ chatId: "another_chat" }), []);
  });
  assert.ok(
    (await lorebooks.listActiveEntries({ chatId: "private_chat" })).some((entry) => entry.lorebookId === globalBook.id),
    "private generation retains global lorebooks",
  );
  const stopped = new AbortController();
  stopped.abort();
  await runWithRoomGeneration({ ...policy, signal: stopped.signal }, async () => {
    assert.equal(policyModule.roomToolAllowed("roll_dice"), false);
    assert.equal(policyModule.roomConversationCommandAllowed("react"), false);
    assert.equal(policyModule.roomRoleplayCommandAllowed("notes"), false);
    assert.equal(roomAgentAllowed("world-state"), false);
    assert.deepEqual(await lorebooks.listActiveEntries({ chatId: policy.chatId }), []);
  });
  assert.equal(packageCalls, 0);
  const { handleConversationScheduleCommand } =
    await import("../../packages/server/src/services/generation/conversation-schedule-command-runtime.js");
  const schedule = (activity: string) => ({
    days: Object.fromEntries(
      ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => [
        day,
        [{ time: "00:00-24:00", activity, status: "online" }],
      ]),
    ),
  });
  let queuedMetadata: Record<string, unknown> = {
    ...metadata,
    conversationSchedulesEnabled: true,
    characterSchedules: { character_one: schedule("latest first"), character_two: schedule("concurrent update") },
  };
  await runWithRoomGeneration(policy, () =>
    handleConversationScheduleCommand({
      command: { type: "schedule_update", activity: "room activity" },
      characterId: "character_one",
      chatId: policy.chatId,
      chats: {
        getById: async () => ({
          metadata: {
            ...metadata,
            conversationSchedulesEnabled: true,
            characterSchedules: {
              character_one: schedule("stale first"),
              character_two: schedule("stale second"),
            },
          },
        }),
        updateMetadata: async () => assert.fail("room schedules must use the metadata queue"),
        patchMetadata: async (_id, update) => {
          queuedMetadata = { ...queuedMetadata, ...update(queuedMetadata) };
        },
      },
      sendUpdated: () => {},
    }),
  );
  const savedSchedules = queuedMetadata.characterSchedules as Record<string, ReturnType<typeof schedule>>;
  assert.ok(
    Object.values(savedSchedules.character_one!.days).some((blocks) => blocks[0]!.activity === "room activity"),
  );
  assert.ok(
    Object.values(savedSchedules.character_two!.days).every((blocks) => blocks[0]!.activity === "concurrent update"),
    "a queued schedule command retains another character's concurrent schedule changes",
  );
  assert.deepEqual(
    services.getCapabilityService("room-probe"),
    { privileged: true },
    "private jobs retain ordinary package access",
  );
  await tools.executeCapabilityTool("room_probe_probe", {}, "private_chat");
  assert.equal(packageCalls, 1);
  assert.equal(roomAgentAllowed("custom-script"), true, "the room policy does not affect ordinary generation");
} finally {
  releaseTool();
  releaseCommand();
  releaseService();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}

process.stdout.write("Multiplayer generation policy regression passed.\n");
