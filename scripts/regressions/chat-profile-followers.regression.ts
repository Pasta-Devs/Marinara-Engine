// Saving a settings profile can update the other chats that use it (#7409), and a profile never
// carries one chat's running state (macro variables, disabled members, multiplayer room, …) to another.
// Updating other chats sets only the listed Chat Settings (CHAT_PROFILE_FOLLOWER_SYNC_KEYS), as picking
// the profile again by hand would, and leaves every other key of those chats as it was, while applying
// a profile by hand still carries every setting it carried before.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CHAT_PROFILE_FOLLOWER_SYNC_KEYS,
  TRANSLATOR_DEFAULTS_SETTINGS_KEY,
  chatFollowsChatPreset,
  getChatTranslationConfig,
  isRoleplayCommandAllowed,
  isRoleplayCommandEnabled,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-chat-profile-followers-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { chatPresetsRoutes } = await import("../../packages/server/src/routes/chat-presets.routes.js");
const { createChatPresetsStorage } = await import("../../packages/server/src/services/storage/chat-presets.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { chats } = await import("../../packages/server/src/db/schema/chats.js");
const { chatPresets } = await import("../../packages/server/src/db/schema/chat-presets.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(chatPresetsRoutes, { prefix: "/api/chat-presets" });
const presets = createChatPresetsStorage(db);

type Row = {
  id: string;
  connectionId: string | null;
  promptPresetId: string | null;
  metadata: string;
  updatedAt: string;
};
const readRow = async (id: string) => ((await db.select().from(chats).where(eq(chats.id, id))) as Row[])[0]!;
const readMeta = async (id: string) => JSON.parse((await readRow(id)).metadata) as Record<string, unknown>;
const writeRow = (id: string, values: Partial<Row> & { metadata?: Record<string, unknown> }) =>
  db
    .update(chats)
    .set({ ...values, ...(values.metadata && { metadata: JSON.stringify(values.metadata) }) })
    .where(eq(chats.id, id));
const createChat = async (name: string, mode: "roleplay" | "conversation" = "roleplay") => {
  const response = await app.inject({ method: "POST", url: "/api/chats", payload: { name, mode, characterIds: [] } });
  assert.equal(response.statusCode, 200);
  return response.json().id as string;
};
const followersUrl = (id: string) => `/api/chat-presets/${id}/apply-to-followers`;

// Running state that belongs to one chat. Saving must drop it; applying must keep the target's own.
const runningState = (tag: string) => ({
  macroVariables: { counter: tag },
  inactiveCharacterIds: [`muted-${tag}`],
  advancedMemoryState: { status: "idle", sourceFingerprint: `fp-${tag}` },
  intentCooldowns: { [`char-${tag}`]: { checkin: "2026-10-11T00:00:00.000Z" } },
  autonomousDailyBudget: { date: "2026-10-11", counts: { [`char-${tag}`]: 2 } },
  conversationCharacterStatuses: { [`char-${tag}`]: { status: "online", activity: tag } },
  conversationStatusOverrides: { [`char-${tag}`]: { status: "busy" } },
  conversationAboutMeOverrides: { [`char-${tag}`]: `about ${tag}` },
  advancedMemoryRosterChanges: [{ characterId: `char-${tag}`, action: "joined", afterMessageId: `msg-${tag}` }],
  encounterActive: tag === "follower",
  archivedCharacterSnapshots: { [`char-${tag}`]: { name: `Removed ${tag}` } },
  conversationSummaryFailures: { [`range-${tag}`]: 2 },
  spriteExpressions: { [`char-${tag}`]: "happy" },
  roleplayDmThread: true,
  dmOriginChatId: `origin-${tag}`,
  dmOriginChatName: `Origin ${tag}`,
  dmOriginMessageId: `origin-msg-${tag}`,
  dmSourceUserMessageId: `origin-user-${tag}`,
  dmTargetCharacterId: `char-${tag}`,
  decisionTimers: { [`statement-${tag}`]: { stickyLeft: 2 } },
  spatialSharedWorldLink: { version: 1, worldId: `world-${tag}`, linkedAt: "2026-10-11T00:00:00.000Z" },
  pixelforge: { save: `save-${tag}` },
  pixelforgeCorruptExcerpt: `damaged ${tag}`,
  trackerFeaturedCharacterKeys: [`char-${tag}`],
  conversationSetupComplete: tag === "source",
  // Not on the exclusion list: every multiplayer room key stays out of profiles by its prefix.
  multiplayerFutureState: { room: `room-${tag}` },
});
// Keys a profile saves and an explicit apply sets, but a chat keeps when the profile updates it,
// because they are not in the follower list: its own story choices, notes, who may use narrator-only
// commands (they need the chat's own narrator), Noodle's permission to use its messages, and state a
// package keeps.
const ownChoices = (tag: string) => ({
  background: `${tag}-scene.png`,
  excludedLorebookIds: [`global-lore-${tag}`],
  roleplayCommandNarratorId: `narrator-char-${tag}`,
  lorebookKeeperTargetLorebookId: `story-lore-${tag}`,
  knowledgeAgentSources: {
    "knowledge-retrieval": { sourceLorebookIds: [`kb-${tag}`], sourceFileIds: [`file-${tag}`] },
  },
  hideSummarisedMessages: tag === "source",
  authorNotes: `Notes for ${tag}`,
  authorNotesDepth: tag === "source" ? 2 : 6,
  someFuturePackageState: { owner: tag },
  roleplayRollAudience: tag === "source" ? "narrator" : "all",
  roleplayDocumentAudience: tag === "source" ? "narrator" : "all",
  roleplayWhisperAudience: tag === "source" ? "narrator" : "all",
  roleplayCombatAudience: tag === "source" ? "narrator" : "all",
  noodleTimelineContextEnabled: tag === "source",
});
// Chat Settings a profile update copies to its other chats.
const sharedSettings = (tag: string) => ({
  contextMessageLimit: tag === "source" ? 40 : 15,
  roleplayCommandsEnabled: tag === "source",
  roleplayCommandToggles: { roll: tag === "source", document: tag === "source", whisper: tag === "source" },
  sceneVideoConnectionId: `video-connection-${tag}`,
  sceneVideoFirstFrame: tag === "source" ? "prompt_only" : "avatar",
  summaryConnectionId: `summary-connection-${tag}`,
  translationProvider: tag === "source" ? "deepl" : "google",
  windowLayout: { version: 1, windows: { [`window-${tag}`]: { x: 1 } } },
});
// Keys only the follower has. They are not on the follower list, so the follower keeps them.
const followerOnly = {
  roleplayDisplayStyle: "visual-novel",
  impersonatePrompt: "Write as me.",
};
// Chat Settings only the follower changed. The saving chat left them at their defaults, so the profile
// has no value for them and the follower goes back to the defaults, as picking the profile again does.
const followerOnlySettings = {
  summaryMaxTokens: 640,
  translationDisplayOnly: true,
};
// Older names of listed settings, still read when the new name is missing. They go too, so the
// follower's old DM switch and translation language cannot come back.
const followerOlderNames = {
  roleplayDmCommandsEnabled: true,
  translationTargetLang: "de",
  translationPrompt: "Translate like a poet.",
};
// Image captioning without a value uses the chat's own connection's defaults, so like Advanced
// Parameters it reaches only chats on the profile's connection.
const captioning = (tag: string) =>
  tag === "source"
    ? { imageCaptioningEnabled: true }
    : { imageCaptioningEnabled: false, imageCaptioningConnectionId: "captioner-follower" };
const ownKeys = Object.keys(ownChoices("x"));
// Advanced Parameters are edited against the chat's connection, so they reach only chats on the
// profile's connection. OpenRouter routing would make another provider reject every request.
const chatParameters = (tag: string) => ({
  temperature: tag === "source" ? 1.1 : 0.4,
  customParameters: { provider: { order: [`provider-${tag}`] } },
});
// Agents set up for one chat (knowledge sources, a target lorebook, sprite characters) stay on or off
// as each chat has them; the other agents follow the profile.
const agents = {
  source: ["agent-source", "knowledge-retrieval", "expression"],
  follower: ["agent-follower", "lorebook-keeper", "knowledge-router"],
  synced: ["agent-source", "lorebook-keeper", "knowledge-router"],
};
// Their prompt templates stay each chat's own too; the other agents' templates follow the profile.
const templates = {
  source: { "agent-source": "source-template", "knowledge-retrieval": "kr-source", expression: "expr-source" },
  follower: { "agent-follower": "follower-template", "lorebook-keeper": "keeper-strict", expression: "expr-subtle" },
  synced: { "agent-source": "source-template", "lorebook-keeper": "keeper-strict", expression: "expr-subtle" },
};
// Advanced Memory settings are shared, but its knowledge anchors and narrator belong to one chat.
const memory = (tag: string, enabled: boolean) => ({
  enabled,
  maxContextTokens: enabled ? 12000 : 65000,
  knowledgeStarts: { [`char-${tag}`]: `msg-${tag}` },
  knowledgeConfirmed: true,
  narratorCharacterId: `narrator-${tag}`,
});
const memoryChatKeys = ["knowledgeStarts", "knowledgeConfirmed", "narratorCharacterId"];
const runningKeys = Object.keys(runningState("x"));

try {
  // The shared rule both the dialog count and the server use.
  assert.equal(chatFollowsChatPreset({ appliedChatPresetId: "p" }, "p"), true);
  assert.equal(chatFollowsChatPreset({ appliedChatPresetId: "q" }, "p"), false);
  assert.equal(chatFollowsChatPreset(null, "p"), false);
  assert.equal(chatFollowsChatPreset({ appliedChatPresetId: "p", multiplayer: { role: "guest" } }, "p"), false);
  assert.equal(chatFollowsChatPreset({ appliedChatPresetId: "p", multiplayerSetup: true }, "p"), false);

  const profile = (await presets.create({ name: "Shared", mode: "roleplay", settings: {} }))!;
  const other = (await presets.create({ name: "Other", mode: "roleplay", settings: {} }))!;
  const source = await createChat("Source");
  const follower = await createChat("Follower");
  const room = await createChat("Hosted room");
  const guest = await createChat("Joined room");
  const elsewhere = await createChat("Uses another profile");
  const otherMode = await createChat("Conversation", "conversation");
  for (const id of [source, follower, room, guest]) {
    const applied = await app.inject({ method: "POST", url: `/api/chat-presets/${profile.id}/apply/${id}` });
    assert.equal(applied.statusCode, 200);
  }
  assert.equal(
    (await app.inject({ method: "POST", url: `/api/chat-presets/${other.id}/apply/${elsewhere}` })).statusCode,
    200,
  );

  // Each chat has its own connection, prompt preset, running state and a tweak to a profile setting.
  await writeRow(follower, {
    connectionId: "follower-connection",
    promptPresetId: "follower-prompt",
    metadata: {
      ...(await readMeta(follower)),
      ...runningState("follower"),
      ...ownChoices("follower"),
      ...sharedSettings("follower"),
      ...followerOnly,
      ...followerOnlySettings,
      ...followerOlderNames,
      ...captioning("follower"),
      chatParameters: chatParameters("follower"),
      activeAgentIds: agents.follower,
      agentPromptTemplateIds: templates.follower,
      advancedMemory: memory("follower", false),
      enableAgents: true,
    },
  });
  const hostedRoom = { version: 1, role: "host", roomId: "room-1", status: "active" };
  await writeRow(room, {
    metadata: { ...(await readMeta(room)), multiplayer: hostedRoom, enableAgents: true, contextMessageLimit: 222 },
  });
  await writeRow(guest, {
    metadata: { ...(await readMeta(guest)), multiplayer: { version: 1, role: "guest", roomId: "room-2" } },
  });
  await writeRow(elsewhere, { metadata: { ...(await readMeta(elsewhere)), contextMessageLimit: 333 } });
  await writeRow(otherMode, { metadata: { ...(await readMeta(otherMode)), appliedChatPresetId: profile.id } });

  // Save the profile from the source chat, the way the Save button snapshots it.
  const sourceMeta = {
    ...(await readMeta(source)),
    ...runningState("source"),
    ...ownChoices("source"),
    ...sharedSettings("source"),
    ...captioning("source"),
    chatParameters: chatParameters("source"),
    activeAgentIds: agents.source,
    agentPromptTemplateIds: templates.source,
    advancedMemory: memory("source", true),
    multiplayerSetup: false,
    multiplayerGameSetup: { preferences: "source" },
    enableAgents: false,
  };
  const saved = await app.inject({
    method: "PUT",
    url: `/api/chat-presets/${profile.id}/settings`,
    payload: { connectionId: "source-connection", promptPresetId: "source-prompt", metadata: sourceMeta },
  });
  assert.equal(saved.statusCode, 200);
  const savedMeta = saved.json().settings.metadata as Record<string, unknown>;
  for (const [key, value] of Object.entries(sharedSettings("source"))) {
    assert.deepEqual(savedMeta[key], value, `the profile saves ${key}`);
  }
  for (const key of Object.keys({ ...followerOnly, ...followerOnlySettings, ...followerOlderNames })) {
    assert.equal(key in savedMeta, false, `the profile has no ${key}`);
  }
  assert.deepEqual(savedMeta.chatParameters, chatParameters("source"), "the profile saves Advanced Parameters");
  assert.deepEqual(savedMeta.activeAgentIds, agents.source, "the profile saves every agent");
  for (const key of [...runningKeys, "multiplayerSetup", "multiplayerGameSetup"]) {
    assert.equal(key in savedMeta, false, `saving a profile leaves out the chat's own ${key}`);
  }
  for (const [key, value] of Object.entries(ownChoices("source"))) {
    assert.deepEqual(savedMeta[key], value, `saving a profile keeps the chat's ${key}`);
  }
  const savedMemory = savedMeta.advancedMemory as Record<string, unknown>;
  assert.equal(savedMemory.enabled, true, "the profile keeps the Advanced Memory settings");
  for (const key of memoryChatKeys) assert.equal(key in savedMemory, false, `the profile leaves out ${key}`);

  const before = new Map(
    await Promise.all([source, room, guest, elsewhere, otherMode].map(async (id) => [id, await readRow(id)] as const)),
  );
  const followerBefore = await readRow(follower);
  // A translator setting the profile has no value for gets the app's translator default, as applying does.
  await createAppSettingsStorage(db).set(TRANSLATOR_DEFAULTS_SETTINGS_KEY, JSON.stringify({ translateInput: true }));
  const response = await app.inject({
    method: "POST",
    url: followersUrl(profile.id),
    payload: { exceptChatId: source },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    response.json(),
    { updated: 1, chatIds: [follower], failed: 0 },
    "only the plain follower is updated",
  );

  const updated = await readRow(follower);
  const updatedMeta = JSON.parse(updated.metadata) as Record<string, unknown>;
  for (const [key, value] of Object.entries(sharedSettings("source"))) {
    assert.deepEqual(updatedMeta[key], value, `the follower gets the profile's ${key}`);
  }
  assert.equal(updatedMeta.enableAgents, false, "the follower's own tweak to a profile setting is replaced");
  assert.deepEqual(
    updatedMeta.chatParameters,
    chatParameters("follower"),
    "a follower on another connection keeps its own Advanced Parameters",
  );
  assert.deepEqual(
    updatedMeta.activeAgentIds,
    agents.synced,
    "the follower gets the profile's agents but keeps its own agents that need setup",
  );
  assert.deepEqual(
    updatedMeta.agentPromptTemplateIds,
    templates.synced,
    "the follower gets the profile's prompt templates but keeps its own for agents that need setup",
  );
  for (const [key, value] of Object.entries(followerOnly)) {
    assert.deepEqual(updatedMeta[key], value, `the follower keeps its ${key}, which is not a listed setting`);
  }
  for (const key of Object.keys({ ...followerOnlySettings, ...followerOlderNames })) {
    assert.equal(key in updatedMeta, false, `the follower's own ${key} goes back to the default the saving chat uses`);
  }
  assert.equal(isRoleplayCommandEnabled(updatedMeta, "dm"), false, "DM commands stay off, as in the saving chat");
  assert.equal(
    getChatTranslationConfig(follower, updatedMeta).inputTargetLanguage,
    "en",
    "the follower's old translation language does not come back",
  );
  assert.deepEqual(
    Object.fromEntries(Object.keys(captioning("follower")).map((key) => [key, updatedMeta[key]])),
    captioning("follower"),
    "a follower on another connection keeps its own image captioning",
  );
  assert.equal(updatedMeta.translateInput, true, "the follower gets the app's translator default");
  assert.equal(updatedMeta.appliedChatPresetId, profile.id);
  for (const key of runningKeys) {
    assert.deepEqual(
      updatedMeta[key],
      runningState("follower")[key as keyof ReturnType<typeof runningState>],
      `the follower keeps its own ${key}`,
    );
  }
  for (const [key, value] of Object.entries(ownChoices("follower"))) {
    assert.deepEqual(updatedMeta[key], value, `the follower keeps its own ${key}`);
  }
  // char-follower is not the follower's narrator, so copying "narrator only" would turn these off for it.
  for (const key of ["roll", "document", "whisper"] as const) {
    assert.equal(
      isRoleplayCommandAllowed(updatedMeta, key, "char-follower"),
      true,
      `the follower's ${key} command stays open to its characters`,
    );
  }
  assert.deepEqual(
    updatedMeta.advancedMemory,
    { ...memory("follower", false), enabled: true, maxContextTokens: 12000 },
    "the follower gets the memory settings but keeps its own knowledge anchors and narrator",
  );
  assert.equal(updated.connectionId, "follower-connection", "the follower keeps its connection");
  assert.equal(updated.promptPresetId, "follower-prompt", "the follower keeps its prompt preset");
  assert.equal(updated.updatedAt, followerBefore.updatedAt, "a background update does not reorder recent chats");
  for (const [id, row] of before) {
    assert.deepEqual(await readRow(id), row, "the saved chat, rooms, other profiles and other modes stay unchanged");
  }

  // On the profile's connection, the follower gets the profile's Advanced Parameters too.
  await writeRow(follower, { connectionId: "source-connection" });
  assert.deepEqual(await presets.applyToFollowers(profile.id, source), { chatIds: [follower], failed: 0 });
  const sameConnectionMeta = await readMeta(follower);
  assert.deepEqual(sameConnectionMeta.chatParameters, chatParameters("source"), "same connection, same parameters");
  assert.equal(sameConnectionMeta.imageCaptioningEnabled, true, "and the same image captioning");
  assert.equal(
    "imageCaptioningConnectionId" in sameConnectionMeta,
    false,
    "a captioning connection the profile leaves to the connection goes back to that connection's default",
  );
  assert.deepEqual(
    sameConnectionMeta.activeAgentIds,
    agents.synced,
    "agents that need setup still stay the chat's own",
  );
  assert.deepEqual(sameConnectionMeta.agentPromptTemplateIds, templates.synced, "and so do their prompt templates");
  await writeRow(follower, { connectionId: "follower-connection" });

  // A chat that left the profile after the scan is skipped inside its own queue.
  assert.equal(await presets.applyToChat(profile.id, elsewhere, { asFollower: true }), null);
  assert.deepEqual(await readRow(elsewhere), before.get(elsewhere));

  // Applying a profile by hand still sets the connection and prompt preset, and keeps running state.
  const applied = await app.inject({ method: "POST", url: `/api/chat-presets/${profile.id}/apply/${follower}` });
  assert.equal(applied.statusCode, 200);
  assert.equal(applied.json().connectionId, "source-connection");
  assert.equal(applied.json().promptPresetId, "source-prompt");
  const appliedMeta = JSON.parse(applied.json().metadata) as Record<string, unknown>;
  assert.deepEqual(appliedMeta.macroVariables, { counter: "follower" }, "applying keeps the chat's macro variables");
  assert.deepEqual(appliedMeta.inactiveCharacterIds, ["muted-follower"]);
  for (const key of runningKeys) {
    assert.deepEqual(
      appliedMeta[key],
      runningState("follower")[key as keyof ReturnType<typeof runningState>],
      `applying a profile by hand keeps the chat's own ${key}`,
    );
  }
  for (const [key, value] of Object.entries(ownChoices("source"))) {
    assert.deepEqual(appliedMeta[key], value, `applying a profile by hand sets its ${key}, as before`);
  }
  assert.equal(appliedMeta.sceneVideoConnectionId, "video-connection-source", "applying sets the video connection");
  assert.equal(appliedMeta.sceneVideoFirstFrame, "prompt_only", "applying sets the video first frame");
  assert.deepEqual(
    appliedMeta.chatParameters,
    chatParameters("source"),
    "applying sets the parameters with the connection",
  );
  assert.deepEqual(appliedMeta.activeAgentIds, agents.source, "applying a profile by hand sets every agent, as before");
  assert.deepEqual(appliedMeta.agentPromptTemplateIds, templates.source, "and every prompt template");
  assert.deepEqual(
    appliedMeta.advancedMemory,
    { ...memory("follower", false), enabled: true, maxContextTokens: 12000 },
    "applying a profile by hand keeps the chat's own knowledge anchors and narrator",
  );
  // On the profile's connection, Save and update gives each listed setting what picking the profile
  // again gives it (#7409), apart from the agents each chat sets up. (Schedules the profile has no
  // value for stay each chat's own; see the Conversation part below.)
  for (const key of CHAT_PROFILE_FOLLOWER_SYNC_KEYS) {
    if (key === "activeAgentIds" || key === "agentPromptTemplateIds") continue;
    assert.equal(key in sameConnectionMeta, key in appliedMeta, `Save and update and applying agree on ${key}`);
    assert.deepEqual(sameConnectionMeta[key], appliedMeta[key], `Save and update and applying agree on ${key}`);
  }

  // A starred profile gives a new chat its background and turned-off lorebooks, as before.
  await presets.setActive(profile.id);
  const active = await app.inject({ method: "GET", url: "/api/chat-presets/active/roleplay" });
  assert.equal(active.json().settings.metadata.background, "source-scene.png");
  const newChat = await createChat("New chat");
  await app.inject({ method: "POST", url: `/api/chat-presets/${profile.id}/apply/${newChat}` });
  const newChatMeta = await readMeta(newChat);
  assert.equal(newChatMeta.background, "source-scene.png");
  assert.deepEqual(newChatMeta.excludedLorebookIds, ["global-lore-source"]);

  // A profile saved before this change still applies its background and turned-off lorebooks,
  // while the running state it holds stays out.
  const ts = new Date().toISOString();
  await db.insert(chatPresets).values({
    id: "old-profile",
    name: "Old",
    mode: "roleplay",
    isDefault: "false",
    isActive: "false",
    settings: JSON.stringify({
      metadata: { background: "old-scene.png", excludedLorebookIds: ["lb-old"], macroVariables: { old: "1" } },
    }),
    createdAt: ts,
    updatedAt: ts,
  });
  const oldApplied = await app.inject({ method: "POST", url: `/api/chat-presets/old-profile/apply/${newChat}` });
  const oldAppliedMeta = JSON.parse(oldApplied.json().metadata) as Record<string, unknown>;
  assert.equal(oldAppliedMeta.background, "old-scene.png");
  assert.deepEqual(oldAppliedMeta.excludedLorebookIds, ["lb-old"]);
  assert.equal("macroVariables" in oldAppliedMeta, false, "an old profile's macro variables stay out");
  assert.equal(
    oldAppliedMeta.sceneVideoConnectionId,
    "video-connection-source",
    "a profile saved without a video connection leaves the chat's own",
  );
  assert.equal(
    oldAppliedMeta.sceneVideoFirstFrame,
    "prompt_only",
    "a profile saved without a video first frame leaves the chat's own",
  );
  const roomApplied = await app.inject({ method: "POST", url: `/api/chat-presets/${profile.id}/apply/${room}` });
  assert.deepEqual(JSON.parse(roomApplied.json().metadata).multiplayer, hostedRoom, "applying keeps a room");

  // A Conversation follower keeps its prompt preset, so it keeps its own custom prompt text too.
  const convoProfile = (await presets.create({ name: "Convo", mode: "conversation", settings: {} }))!;
  const convoSource = await createChat("Pirate source", "conversation");
  const presetFollower = await createChat("Uses a prompt preset", "conversation");
  const customFollower = await createChat("Has its own prompt", "conversation");
  for (const id of [convoSource, presetFollower, customFollower]) {
    await app.inject({ method: "POST", url: `/api/chat-presets/${convoProfile.id}/apply/${id}` });
  }
  await writeRow(presetFollower, { promptPresetId: "preset-x" });
  await writeRow(customFollower, {
    metadata: {
      ...(await readMeta(customFollower)),
      customSystemPrompt: "You are a librarian.",
      someFuturePackageState: { owner: "librarian" },
      authorNotes: "Quiet library.",
      // Switched off by hand. Without a value, schedules would run again from the characters' cards.
      conversationSchedulesEnabled: false,
    },
  });
  await app.inject({
    method: "PUT",
    url: `/api/chat-presets/${convoProfile.id}/settings`,
    payload: {
      metadata: {
        ...(await readMeta(convoSource)),
        ...ownChoices("source"),
        customSystemPrompt: "You are a pirate.",
        contextMessageLimit: 77,
      },
    },
  });

  const presetFollowerBefore = await readMeta(presetFollower);
  // One chat failing to update is counted, and the others are still updated.
  const realApply = presets.applyToChat;
  presets.applyToChat = async (presetId, chatId, options) => {
    if (chatId === customFollower) throw new Error("disk full");
    return realApply(presetId, chatId, options);
  };
  assert.deepEqual(await presets.applyToFollowers(convoProfile.id, convoSource), {
    chatIds: [presetFollower],
    failed: 1,
  });
  presets.applyToChat = realApply;
  const convoResponse = await app.inject({
    method: "POST",
    url: followersUrl(convoProfile.id),
    payload: { exceptChatId: convoSource },
  });
  assert.equal(convoResponse.json().updated, 2);
  assert.equal(convoResponse.json().failed, 0);
  const presetFollowerRow = await readRow(presetFollower);
  const presetFollowerMeta = JSON.parse(presetFollowerRow.metadata) as Record<string, unknown>;
  assert.equal(presetFollowerRow.promptPresetId, "preset-x");
  assert.equal(presetFollowerMeta.contextMessageLimit, 77);
  assert.equal(presetFollowerMeta.customSystemPrompt ?? null, null, "the profile's custom prompt does not override X");
  for (const key of ownKeys) {
    assert.equal(key in presetFollowerMeta, key in presetFollowerBefore, `a follower without its own ${key} gets none`);
    assert.deepEqual(presetFollowerMeta[key], presetFollowerBefore[key]);
  }
  const customFollowerMeta = await readMeta(customFollower);
  assert.equal(customFollowerMeta.contextMessageLimit, 77);
  assert.equal(customFollowerMeta.customSystemPrompt, "You are a librarian.", "a follower keeps its own prompt");
  assert.deepEqual(
    customFollowerMeta.someFuturePackageState,
    { owner: "librarian" },
    "unknown keys stay the chat's own",
  );
  assert.equal(customFollowerMeta.authorNotes, "Quiet library.", "a follower keeps its own Author's Note");
  assert.equal(
    customFollowerMeta.conversationSchedulesEnabled,
    false,
    "a profile with no schedule choice leaves a chat's schedules off",
  );
  assert.equal("conversationSchedulesEnabled" in presetFollowerMeta, false, "and a chat without a choice gets none");
  // A profile that has a schedule choice gives it to its other chats.
  await app.inject({
    method: "PUT",
    url: `/api/chat-presets/${convoProfile.id}/settings`,
    payload: { metadata: { ...(await readMeta(convoSource)), conversationSchedulesEnabled: true } },
  });
  assert.equal((await presets.applyToFollowers(convoProfile.id, convoSource)).chatIds.length, 2);
  assert.equal((await readMeta(customFollower)).conversationSchedulesEnabled, true, "the profile's schedule choice");
  assert.equal((await readMeta(presetFollower)).conversationSchedulesEnabled, true);

  // An empty agent list runs no agents, so a profile whose only agents need setup turns a chat's other
  // agents off. Settings the profile has no value for go back to their defaults, except the window
  // layout and video connection, which profiles saved before they held them leave as the chat's own.
  const setupProfile = (await presets.create({ name: "Setup agents", mode: "roleplay", settings: {} }))!;
  const plainAgents = await createChat("Director only");
  const keptAgents = await createChat("Has Expressions");
  for (const [id, activeAgentIds] of [
    [plainAgents, ["director"]],
    [keptAgents, ["director", "expression"]],
  ] as const) {
    await app.inject({ method: "POST", url: `/api/chat-presets/${setupProfile.id}/apply/${id}` });
    await writeRow(id, {
      metadata: {
        ...(await readMeta(id)),
        activeAgentIds,
        agentPromptTemplateIds: { director: "director-own", expression: "expr-own" },
        customAgentImageSettings: { "custom-painter": { connectionId: "own-image" } },
        contextMessageLimit: 9,
        windowLayout: { version: 1, windows: { own: { x: 2 } } },
        sceneVideoConnectionId: "own-video",
      },
    });
  }
  await app.inject({
    method: "PUT",
    url: `/api/chat-presets/${setupProfile.id}/settings`,
    payload: { metadata: { activeAgentIds: ["knowledge-retrieval"] } },
  });
  assert.equal((await presets.applyToFollowers(setupProfile.id, null)).chatIds.length, 2);
  const plainAgentsMeta = await readMeta(plainAgents);
  assert.deepEqual(plainAgentsMeta.activeAgentIds, [], "Director is off, as in the profile");
  assert.deepEqual((await readMeta(keptAgents)).activeAgentIds, ["expression"], "the chat keeps its own Expressions");
  assert.equal("contextMessageLimit" in plainAgentsMeta, false, "the chat's own context limit goes back to none");
  assert.deepEqual(plainAgentsMeta.windowLayout, { version: 1, windows: { own: { x: 2 } } });
  assert.equal(plainAgentsMeta.sceneVideoConnectionId, "own-video");
  assert.deepEqual(
    plainAgentsMeta.agentPromptTemplateIds,
    { director: "director-own", expression: "expr-own" },
    "a profile without prompt templates leaves the chat's own, as applying it by hand does",
  );
  assert.deepEqual(
    plainAgentsMeta.customAgentImageSettings,
    { "custom-painter": { connectionId: "own-image" } },
    "and so does a profile without custom agent image settings",
  );

  const defaultProfile = (await presets.getDefault("roleplay"))!;
  assert.equal(
    (await app.inject({ method: "POST", url: followersUrl(defaultProfile.id), payload: {} })).statusCode,
    400,
  );
  assert.equal((await app.inject({ method: "POST", url: followersUrl("missing"), payload: {} })).statusCode, 404);
  console.info("Settings profile follower updates and running-state exclusions passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
