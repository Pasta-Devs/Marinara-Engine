import type { LlmGateway } from "../../../capabilities/llm";
import type { StorageGateway } from "../../../capabilities/storage";
import type {
  BackgroundAssetInfo,
  GameAssetManifestEntry,
  VisualAssetGateway,
} from "../../../capabilities/visual-assets";
import { parseJsonArray, parseJsonObject } from "../../../core/json";
import { boolish } from "../../../generation/runtime-records";
import { parseGameJsonish } from "../../../shared/parsing-jsonish";
import { readString as stringValue } from "../../../shared/value-readers";
import type {
  SceneCreateRequest,
  SceneCreateResponse,
  SceneForkRequest,
  SceneForkResponse,
  SceneFullPlan,
  ScenePlanRequest,
  ScenePlanResponse,
} from "../../../contracts/types/scene";
import {
  copyTrackerSnapshotsForRebasedMessages,
  type TrackerSnapshotMessageRebase,
} from "../../../generation/tracker-snapshots";

type JsonRecord = Record<string, unknown>;

type RoleplaySceneCapabilities = {
  storage: StorageGateway;
  llm: LlmGateway;
  visuals?: VisualAssetGateway;
};

type StoredMessage = JsonRecord & {
  id?: string;
  role?: string;
  content?: string;
  characterId?: string | null;
};

type SceneParticipantContext = {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  appearance: string;
  backstory: string;
  firstMessage: string;
  exampleDialogue: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  tags: string[];
};

type ScenePlannerContext = {
  characters: SceneParticipantContext[];
  persona: SceneParticipantContext | null;
  backgrounds: string[];
};

const SCENE_GUIDELINES = [
  "Scene guidelines:",
  "- Treat this as a focused roleplay scene branched from the originating conversation.",
  "- Preserve character knowledge boundaries and relationship continuity from the origin chat.",
  "- The user controls their persona. Never decide their strategic choices or exact dialogue.",
  "- Keep narration in third person unless the origin chat or requested scene explicitly uses another POV.",
  "- Spoken dialogue must be wrapped in quotation marks. Do not leave spoken lines as bare prose.",
  "- First messages should establish the scene and then hand the next meaningful choice back to the user.",
  "- Continue naturally until the scene concludes or returns to the origin conversation.",
].join("\n");

export async function planRoleplayScene(
  capabilities: RoleplaySceneCapabilities,
  input: ScenePlanRequest,
): Promise<ScenePlanResponse> {
  const chat = await requireChat(capabilities.storage, input.chatId);
  const prompt = input.prompt.trim();
  const fallback = await fallbackScenePlan(capabilities.storage, input.chatId, prompt);
  const allowedCharacterIds = stringArray(chat.characterIds);
  const plannerContext = await buildScenePlannerContext(capabilities.storage, chat, capabilities.visuals);

  let connectionId: string;
  try {
    connectionId = await resolveConnectionId(capabilities.storage, chat, input.connectionId ?? null);
  } catch (error) {
    return {
      plan: fallback,
      error: `Used local scene planning because no LLM connection was available: ${errorMessage(error)}`,
    };
  }

  const history = (await messagesForChat(capabilities.storage, input.chatId))
    .slice(-20)
    .map((message) => {
      const role = stringValue(message.role) || "user";
      const content = stringValue(message.content).trim();
      return content ? `${role}: ${content}` : "";
    })
    .filter(Boolean)
    .join("\n\n");

  const requestText = prompt
    ? `Plan a complete roleplay scene based on this request: ${prompt}`
    : "Plan a complete roleplay scene that naturally follows the recent conversation.";

  try {
    const raw = await capabilities.llm.complete({
      connectionId,
      messages: [
        {
          role: "system",
          content: [
            "You are a scene planner for Marinara roleplay.",
            "Return only one JSON object with fields name, description, scenario, firstMessage, background, characterIds, systemPrompt, rating, relationshipHistory, and participationGuide.",
            "The name must start with Scene:. The rating must be sfw or nsfw. Use only character IDs from the provided list.",
            "The background must be null or one exact filename from the provided available backgrounds list. Never invent or rename backgrounds.",
            "Write firstMessage in the origin chat's narration style. If characters speak, use quotation marks.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `Available character IDs: ${allowedCharacterIds.join(", ")}`,
            "",
            "Selected character cards:",
            formatParticipantList(plannerContext.characters),
            "",
            "Active persona:",
            plannerContext.persona ? formatParticipant(plannerContext.persona) : "(none)",
            "",
            "Available backgrounds:",
            formatAvailableBackgrounds(plannerContext.backgrounds),
            "",
            "Recent conversation:",
            history || "(none)",
            "",
            requestText,
          ].join("\n"),
        },
      ],
      parameters: { temperature: 0.9, maxTokens: 4096 },
    });
    const parsed = parseObject(raw);
    if (Object.keys(parsed).length === 0) {
      return {
        plan: fallback,
        error: "The model did not return valid scene-plan JSON, so Marinara used a local fallback plan.",
      };
    }
    return { plan: sanitizeScenePlan(parsed, fallback, allowedCharacterIds, plannerContext.backgrounds) };
  } catch (error) {
    return {
      plan: fallback,
      error: `Scene planning used a local fallback after the LLM request failed: ${errorMessage(error)}`,
    };
  }
}

export async function createRoleplayScene(
  storage: StorageGateway,
  input: SceneCreateRequest,
  visuals?: VisualAssetGateway,
): Promise<SceneCreateResponse> {
  const originChat = await requireChat(storage, input.originChatId);
  const originMeta = parseJsonObject(originChat.metadata);
  const plan = input.plan;
  const background = normalizeSceneBackground(plan.background, await availableBackgroundFilenames(storage, visuals));
  const originCharacterIds = stringArray(originChat.characterIds);
  const characterIds = plan.characterIds.length ? plan.characterIds : originCharacterIds;
  const sceneName = safeTitle(plan.name, "New Scene");
  const description = plan.description || "A new scene begins.";
  const firstMessage = plan.firstMessage || "The scene begins.";
  const connectionId = input.connectionId || stringValue(originChat.connectionId) || null;
  const sceneConversationContext = await buildSceneConversationContext(storage, input.originChatId);
  const inheritedActiveLorebookIds = [
    ...stringArray(originMeta.activeLorebookIds),
    ...stringArray(originChat.activeLorebookIds),
  ].filter((id, index, ids) => ids.indexOf(id) === index);
  const inheritedSceneOptions = sceneCarryoverOptions(originMeta);
  const sceneSystemPrompt = [plan.systemPrompt, SCENE_GUIDELINES].filter((part) => part.trim()).join("\n\n");

  const metadata: JsonRecord = {
    sceneOriginChatId: input.originChatId,
    sceneInitiatorCharId: input.initiatorCharId ?? null,
    sceneDescription: description,
    sceneScenario: plan.scenario ?? null,
    sceneBackground: background,
    sceneSystemPrompt: sceneSystemPrompt || null,
    sceneRelationshipHistory: plan.relationshipHistory ?? null,
    sceneConversationContext,
    activeLorebookIds: inheritedActiveLorebookIds,
    ...inheritedSceneOptions,
    sceneRating: plan.rating === "nsfw" ? "nsfw" : "sfw",
    sceneStatus: "active",
    enableMemoryRecall: true,
    ...(background ? { background } : {}),
  };

  const sceneChat = await storage.create<JsonRecord>("chats", {
    name: sceneName,
    mode: "roleplay",
    characterIds,
    groupId: originChat.groupId ?? null,
    folderId: originChat.folderId ?? null,
    personaId: originChat.personaId ?? null,
    promptPresetId: originChat.promptPresetId ?? null,
    connectionId,
    connectedChatId: input.originChatId,
    activeLorebookIds: inheritedActiveLorebookIds,
    metadata,
  });
  const sceneChatId = stringValue(sceneChat.id);
  if (!sceneChatId) throw new Error("Created scene chat has no id");

  await patchChatMetadata(storage, input.originChatId, {
    activeSceneChatId: sceneChatId,
    sceneBusyCharIds: characterIds,
  });
  await storage.update("chats", input.originChatId, { connectedChatId: sceneChatId });

  if (plan.participationGuide.trim()) {
    await createChatMessage(storage, sceneChatId, {
      role: "narrator",
      content: plan.participationGuide,
      characterId: null,
    });
  }
  const firstCharacterId = input.initiatorCharId || characterIds[0] || null;
  await createChatMessage(storage, sceneChatId, {
    role: "assistant",
    content: [description, "", firstMessage].join("\n"),
    characterId: firstCharacterId,
  });

  return {
    chatId: sceneChatId,
    chatName: stringValue(sceneChat.name) || sceneName,
    description,
    background,
  };
}

export async function concludeRoleplayScene(
  capabilities: RoleplaySceneCapabilities,
  input: { sceneChatId: string; connectionId?: string | null },
): Promise<{ summary: string; originChatId: string }> {
  const sceneChat = await requireChat(capabilities.storage, input.sceneChatId);
  const sceneMeta = parseJsonObject(sceneChat.metadata);
  const originChatId = stringValue(sceneMeta.sceneOriginChatId);
  if (!originChatId) throw new Error("Not a scene chat");
  const summary = await summarizeScene(capabilities, input.sceneChatId, input.connectionId ?? null);

  await createChatMessage(capabilities.storage, originChatId, {
    role: "narrator",
    content: formatSceneReturnMessage(sceneChat, summary),
  });
  await appendSceneMemory(capabilities.storage, originChatId, input.sceneChatId, summary);
  await writeCharacterSceneMemories(capabilities.storage, sceneChat, summary);
  await patchChatMetadata(capabilities.storage, input.sceneChatId, { sceneStatus: "concluded" });
  await cleanOriginScenePointers(capabilities.storage, originChatId);
  await capabilities.storage.update("chats", input.sceneChatId, { connectedChatId: null });
  return { summary, originChatId };
}

export async function abandonRoleplayScene(
  storage: StorageGateway,
  input: { sceneChatId: string },
): Promise<{ originChatId: string }> {
  const sceneChat = await requireChat(storage, input.sceneChatId);
  const sceneMeta = parseJsonObject(sceneChat.metadata);
  const originChatId = stringValue(sceneMeta.sceneOriginChatId);
  if (!originChatId) throw new Error("Not a scene chat");
  await rememberLastSceneOptions(storage, originChatId, sceneChat);
  await cleanOriginScenePointers(storage, originChatId);
  await deleteChatWithMessages(storage, input.sceneChatId);
  return { originChatId };
}

export async function forkRoleplayScene(storage: StorageGateway, input: SceneForkRequest): Promise<SceneForkResponse> {
  if (input.mode !== "clone" && input.mode !== "convert") {
    throw new Error("mode must be clone or convert");
  }
  if (input.mode === "convert" && input.upToMessageId) {
    throw new Error("Convert cannot be limited to a message");
  }
  const sceneChat = await requireChat(storage, input.sceneChatId);
  const sceneMeta = parseJsonObject(sceneChat.metadata);
  const originChatId = stringValue(sceneMeta.sceneOriginChatId) || null;
  const baseName = stringValue(sceneChat.name) || "Scene";
  const sourceMessages = chronologicalMessages(await messagesForChat(storage, input.sceneChatId));
  if (input.upToMessageId && !sourceMessages.some((message) => stringValue(message.id) === input.upToMessageId)) {
    throw new Error("Message is not part of this scene");
  }
  const forkChat = await storage.create<JsonRecord>("chats", {
    name: `${baseName} ${input.mode === "clone" ? "Clone" : "Converted"}`,
    mode: "roleplay",
    characterIds: stringArray(sceneChat.characterIds),
    groupId: sceneChat.groupId ?? null,
    folderId: sceneChat.folderId ?? null,
    personaId: sceneChat.personaId ?? null,
    promptPresetId: sceneChat.promptPresetId ?? null,
    connectionId: sceneChat.connectionId ?? null,
    metadata: forkMetadata(sceneMeta),
  });
  const forkChatId = stringValue(forkChat.id);
  if (!forkChatId) throw new Error("Created fork chat has no id");

  if (input.includePreSceneSummary !== false) {
    const continuity = buildForkContinuityMessage(sceneMeta);
    if (continuity) {
      await createChatMessage(storage, forkChatId, {
        role: "narrator",
        content: continuity,
        extra: { hiddenFromUser: true, isSceneContinuity: true },
      });
    }
  }

  let skippedGuide = false;
  const trackerMessageRebases: TrackerSnapshotMessageRebase[] = [];
  for (const message of sourceMessages) {
    const sourceMessageId = stringValue(message.id).trim();
    const stopAfterThis = input.upToMessageId && sourceMessageId === input.upToMessageId;
    if (input.includeParticipationGuide === false && !skippedGuide && message.role === "narrator") {
      skippedGuide = true;
      if (stopAfterThis) break;
      continue;
    }
    const copy = { ...message };
    delete copy.id;
    copy.chatId = forkChatId;
    const created = await storage.create<JsonRecord>("messages", copy);
    const targetMessageId = stringValue(created.id).trim();
    if (sourceMessageId && targetMessageId) {
      trackerMessageRebases.push({
        sourceMessageId,
        targetMessageId,
        role: created.role ?? copy.role,
        activeSwipeIndex: created.activeSwipeIndex ?? copy.activeSwipeIndex,
        swipeCount: created.swipeCount ?? copy.swipeCount,
      });
    }
    if (stopAfterThis) break;
  }
  const visibleTrackerSnapshot = await copyTrackerSnapshotsForRebasedMessages(
    storage,
    input.sceneChatId,
    forkChatId,
    trackerMessageRebases,
  );
  if (visibleTrackerSnapshot) {
    await storage.update("chats", forkChatId, { gameState: visibleTrackerSnapshot as unknown as JsonRecord });
  }

  if (input.mode === "convert") {
    if (originChatId) await cleanOriginScenePointers(storage, originChatId);
    await deleteChatWithMessages(storage, input.sceneChatId);
  }

  return { chatId: forkChatId, originChatId, mode: input.mode };
}

async function summarizeScene(
  capabilities: RoleplaySceneCapabilities,
  sceneChatId: string,
  connectionOverride?: string | null,
): Promise<string> {
  const sceneChat = await requireChat(capabilities.storage, sceneChatId);
  const sceneMeta = parseJsonObject(sceneChat.metadata);
  const plannerContext = await buildScenePlannerContext(capabilities.storage, sceneChat, capabilities.visuals);
  const messages = await messagesForChat(capabilities.storage, sceneChatId);
  const transcript = messages
    .map((message) => {
      const role = stringValue(message.role) || "user";
      const content = stringValue(message.content).trim();
      return content ? `${role}: ${content}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
  const fallback = transcript
    ? `Scene summary: ${transcript.slice(0, 1200)}`
    : "The scene ended before any substantial roleplay occurred.";

  try {
    const connectionId = await resolveConnectionId(capabilities.storage, sceneChat, connectionOverride ?? null);
    const summary = await capabilities.llm.complete({
      connectionId,
      messages: [
        {
          role: "system",
          content: [
            "Summarize the completed roleplay scene in concise third-person prose.",
            "Ground the summary in the scene premise, participating characters, active persona, and relationship continuity.",
            "Capture concrete outcomes, emotional shifts, promises, conflicts, reveals, and unresolved hooks. Do not invent events not present in the transcript.",
            "Return only the summary.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "Scene metadata:",
            formatSceneSummaryMetadata(sceneChat, sceneMeta),
            "",
            "Selected character cards:",
            formatParticipantList(plannerContext.characters),
            "",
            "Active persona:",
            plannerContext.persona ? formatParticipant(plannerContext.persona) : "(none)",
            "",
            "Transcript:",
            transcript || "(none)",
          ].join("\n"),
        },
      ],
      parameters: { temperature: 0.7, maxTokens: 800 },
    });
    return summary.trim() || fallback;
  } catch {
    return fallback;
  }
}

async function fallbackScenePlan(storage: StorageGateway, chatId: string, prompt: string): Promise<SceneFullPlan> {
  const chat = await requireChat(storage, chatId);
  const characterIds = stringArray(chat.characterIds);
  const history = (await messagesForChat(storage, chatId))
    .slice(-8)
    .map((message) => {
      const role = stringValue(message.role) || "user";
      const content = stringValue(message.content).trim();
      return content ? `${role}: ${content}` : "";
    })
    .filter(Boolean)
    .join("\n");
  const premise =
    prompt ||
    history.split(/\r?\n/).filter(Boolean).at(-1) ||
    "A focused roleplay scene continues from the current conversation.";
  return {
    name: safeTitle(premise, "New Scene"),
    description: `The scene opens around this premise: ${premise}`,
    scenario: history
      ? `Use the recent conversation as continuity and develop this premise: ${premise}\n\nRecent context:\n${history}`
      : premise,
    firstMessage: `The moment settles into focus. ${premise}`,
    background: null,
    characterIds,
    systemPrompt:
      "Write immersive roleplay prose with consistent point of view, clear character agency, and continuity from the originating conversation.",
    rating: "sfw",
    relationshipHistory: history,
    participationGuide: "Play the scene naturally and respond as your character would.",
  };
}

async function buildScenePlannerContext(
  storage: StorageGateway,
  chat: JsonRecord,
  visuals?: VisualAssetGateway,
): Promise<ScenePlannerContext> {
  const characterIds = stringArray(chat.characterIds);
  const [characters, persona, backgrounds] = await Promise.all([
    loadParticipantContexts(storage, "characters", characterIds),
    loadActivePersonaContext(storage, chat),
    availableBackgroundFilenames(storage, visuals),
  ]);
  return { characters, persona, backgrounds };
}

async function loadParticipantContexts(
  storage: StorageGateway,
  entity: "characters" | "personas",
  ids: string[],
): Promise<SceneParticipantContext[]> {
  const rows = await Promise.all(ids.map((id) => storage.get<JsonRecord>(entity, id).catch(() => null)));
  return rows
    .map((row, index) => (isRecord(row) ? participantContext(row, ids[index] ?? "") : null))
    .filter((participant): participant is SceneParticipantContext => participant !== null);
}

async function loadActivePersonaContext(
  storage: StorageGateway,
  chat: JsonRecord,
): Promise<SceneParticipantContext | null> {
  const personaId = stringValue(chat.personaId).trim();
  if (personaId) {
    const persona = await storage.get<JsonRecord>("personas", personaId).catch(() => null);
    return isRecord(persona) ? participantContext(persona, personaId) : null;
  }
  const personas = await storage.list<JsonRecord>("personas").catch(() => []);
  const activePersona = personas.find(
    (persona) => persona.isActive === true || stringValue(persona.isActive) === "true",
  );
  return isRecord(activePersona) ? participantContext(activePersona, stringValue(activePersona.id).trim()) : null;
}

function participantContext(row: JsonRecord, fallbackId: string): SceneParticipantContext {
  const data = contextData(row);
  const id = stringValue(row.id).trim() || fallbackId;
  return {
    id,
    name: compactPromptText(data.name || row.name || id || "Unknown", 120),
    description: compactPromptText(data.description || row.description, 1200),
    personality: compactPromptText(data.personality || row.personality, 900),
    scenario: compactPromptText(data.scenario || row.scenario, 900),
    appearance: compactPromptText(data.appearance || row.appearance, 900),
    backstory: compactPromptText(data.backstory || data.comment || row.backstory || row.comment, 900),
    firstMessage: compactPromptText(data.first_mes || data.firstMessage || row.first_mes || row.firstMessage, 600),
    exampleDialogue: compactPromptText(
      data.mes_example || data.exampleDialogue || row.mes_example || row.exampleDialogue,
      900,
    ),
    systemPrompt: compactPromptText(
      data.system_prompt || data.systemPrompt || row.system_prompt || row.systemPrompt,
      900,
    ),
    postHistoryInstructions: compactPromptText(
      data.post_history_instructions ||
        data.postHistoryInstructions ||
        row.post_history_instructions ||
        row.postHistoryInstructions,
      900,
    ),
    tags: uniqueStrings([...stringArray(data.tags), ...stringArray(row.tags)]).slice(0, 12),
  };
}

function contextData(row: JsonRecord): JsonRecord {
  const data = characterData(row);
  return Object.keys(data).length > 0 ? data : row;
}

async function availableBackgroundFilenames(storage: StorageGateway, visuals?: VisualAssetGateway): Promise<string[]> {
  const filenames: string[] = [];
  if (visuals) {
    const backgrounds = await visuals.listBackgrounds().catch(() => []);
    filenames.push(...backgrounds.map(backgroundFilenameFromUserAsset).filter((name): name is string => !!name));
    if (visuals.gameAssetsManifest) {
      const manifest = await visuals.gameAssetsManifest().catch(() => null);
      const gameBackgrounds = manifest?.byCategory?.backgrounds;
      if (Array.isArray(gameBackgrounds)) {
        filenames.push(
          ...gameBackgrounds.map(backgroundFilenameFromGameAsset).filter((name): name is string => !!name),
        );
      }
    }
  }
  const metadataRows = await storage.list<JsonRecord>("background-metadata").catch(() => []);
  filenames.push(...metadataRows.map(backgroundFilenameFromUserAsset).filter((name): name is string => !!name));
  return uniqueStrings(filenames);
}

function backgroundFilenameFromUserAsset(background: BackgroundAssetInfo | JsonRecord): string | null {
  const filename =
    stringValue(background.filename).trim() ||
    stringValue(background.name).trim() ||
    stringValue(background.path).trim() ||
    stringValue(background.id).trim();
  return filename || null;
}

function backgroundFilenameFromGameAsset(asset: GameAssetManifestEntry): string | null {
  const path = stringValue(asset.path).trim();
  if (!path || path.startsWith("__user_bg__/")) return null;
  return `gameAsset:${path}`;
}

function normalizeSceneBackground(value: unknown, availableBackgrounds: string[]): string | null {
  const background = stringValue(value).trim();
  if (!background) return null;
  const lower = background.toLowerCase();
  if (lower === "null" || lower === "none" || lower === "undefined") return null;
  return availableBackgrounds.includes(background) ? background : null;
}

function formatParticipantList(participants: SceneParticipantContext[]): string {
  if (participants.length === 0) return "(none)";
  return participants
    .map((participant, index) => `Participant ${index + 1}:\n${formatParticipant(participant)}`)
    .join("\n\n");
}

function formatParticipant(participant: SceneParticipantContext): string {
  const lines = [`id: ${participant.id}`, `name: ${participant.name || "(unnamed)"}`];
  appendLabeledLine(lines, "description", participant.description);
  appendLabeledLine(lines, "personality", participant.personality);
  appendLabeledLine(lines, "appearance", participant.appearance);
  appendLabeledLine(lines, "backstory", participant.backstory);
  appendLabeledLine(lines, "scenario", participant.scenario);
  appendLabeledLine(lines, "first_message", participant.firstMessage);
  appendLabeledLine(lines, "example_dialogue", participant.exampleDialogue);
  appendLabeledLine(lines, "system_prompt", participant.systemPrompt);
  appendLabeledLine(lines, "post_history_instructions", participant.postHistoryInstructions);
  if (participant.tags.length > 0) appendLabeledLine(lines, "tags", participant.tags.join(", "));
  return lines.join("\n");
}

function formatAvailableBackgrounds(backgrounds: string[]): string {
  if (backgrounds.length === 0) return "(none available; use null)";
  return backgrounds.map((background) => `- ${background}`).join("\n");
}

function formatSceneSummaryMetadata(sceneChat: JsonRecord, sceneMeta: JsonRecord): string {
  const lines: string[] = [];
  appendLabeledLine(lines, "name", stringValue(sceneChat.name));
  appendLabeledLine(lines, "date", new Date().toISOString().slice(0, 10));
  appendLabeledLine(lines, "description", stringValue(sceneMeta.sceneDescription));
  appendLabeledLine(lines, "scenario", stringValue(sceneMeta.sceneScenario));
  appendLabeledLine(lines, "background", stringValue(sceneMeta.sceneBackground || sceneMeta.background));
  appendLabeledLine(lines, "rating", stringValue(sceneMeta.sceneRating));
  appendLabeledLine(lines, "relationship_history", stringValue(sceneMeta.sceneRelationshipHistory));
  appendLabeledLine(lines, "origin_conversation_context", stringValue(sceneMeta.sceneConversationContext));
  return lines.length > 0 ? lines.join("\n") : "(none)";
}

function appendLabeledLine(lines: string[], label: string, value: string): void {
  const text = value.trim();
  if (text) lines.push(`${label}: ${text}`);
}

function compactPromptText(value: unknown, limit: number): string {
  const text = stringValue(value).replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 3).trimEnd()}...` : text;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = value.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function sanitizeScenePlan(
  parsed: JsonRecord,
  fallback: SceneFullPlan,
  allowedCharacterIds: string[],
  availableBackgrounds: string[],
): SceneFullPlan {
  const requestedIds = stringArray(parsed.characterIds);
  const characterIds =
    requestedIds.length === 0
      ? fallback.characterIds
      : allowedCharacterIds.length === 0
        ? requestedIds
        : requestedIds.filter((id) => allowedCharacterIds.includes(id));
  return {
    name: safeTitle(stringValue(parsed.name) || fallback.name, "New Scene"),
    description: stringValue(parsed.description) || fallback.description,
    scenario: stringValue(parsed.scenario) || fallback.scenario,
    firstMessage: stringValue(parsed.firstMessage) || fallback.firstMessage,
    background: normalizeSceneBackground(parsed.background, availableBackgrounds),
    characterIds,
    systemPrompt: stringValue(parsed.systemPrompt) || fallback.systemPrompt,
    rating: parsed.rating === "nsfw" ? "nsfw" : "sfw",
    relationshipHistory: stringValue(parsed.relationshipHistory) || fallback.relationshipHistory,
    participationGuide: stringValue(parsed.participationGuide) || fallback.participationGuide,
  };
}

function safeTitle(value: string, fallback: string): string {
  const title = (value.trim() || fallback)
    .replace(/[\r\n\t]/g, " ")
    .split(/\s+/)
    .join(" ")
    .slice(0, 60);
  return title.startsWith("Scene:") ? title : `Scene: ${title}`;
}

async function requireChat(storage: StorageGateway, chatId: string): Promise<JsonRecord> {
  const chat = await storage.get<JsonRecord>("chats", chatId);
  if (!chat) throw new Error("Chat not found");
  return chat;
}

async function messagesForChat(storage: StorageGateway, chatId: string): Promise<StoredMessage[]> {
  const rows = await storage.listChatMessages<unknown>(chatId);
  return Array.isArray(rows) ? rows.filter(isRecord) : [];
}

function chronologicalMessages(messages: StoredMessage[]): StoredMessage[] {
  return [...messages].sort((a, b) => {
    const aTime = Date.parse(stringValue(a.createdAt));
    const bTime = Date.parse(stringValue(b.createdAt));
    if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime - bTime;
    return stringValue(a.id).localeCompare(stringValue(b.id));
  });
}

async function createChatMessage(storage: StorageGateway, chatId: string, message: JsonRecord): Promise<void> {
  await storage.createChatMessage(chatId, message);
}

async function patchChatMetadata(storage: StorageGateway, chatId: string, patch: JsonRecord): Promise<void> {
  await storage.patchChatMetadata(chatId, patch);
}

async function buildSceneConversationContext(storage: StorageGateway, originChatId: string): Promise<string> {
  return (await messagesForChat(storage, originChatId))
    .slice(-24)
    .map((message) => {
      const role = stringValue(message.role) || "message";
      const content = stringValue(message.content).trim();
      return content ? `${role}: ${content}` : "";
    })
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12000);
}

function formatSceneReturnMessage(sceneChat: JsonRecord, summary: string): string {
  const sceneName = stringValue(sceneChat.name).trim() || "the scene";
  return [`The scene "${sceneName.replace(/^Scene:\s*/i, "")}" concluded.`, "", summary.trim()].join("\n");
}

function characterData(row: JsonRecord): JsonRecord {
  const raw = row.data;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return isRecord(raw) ? raw : {};
}

async function writeCharacterSceneMemories(
  storage: StorageGateway,
  sceneChat: JsonRecord,
  summary: string,
): Promise<void> {
  const sceneName =
    stringValue(sceneChat.name)
      .replace(/^Scene:\s*/i, "")
      .trim() || "Scene";
  const createdAt = new Date().toISOString();
  const summaryLine = `[Scene on ${createdAt.slice(0, 10)}: ${sceneName}] ${summary.trim()}`;
  for (const characterId of stringArray(sceneChat.characterIds)) {
    const row = await storage.get<JsonRecord>("characters", characterId);
    if (!isRecord(row)) continue;
    const data = characterData(row);
    const extensions = isRecord(data.extensions) ? { ...data.extensions } : {};
    const previous = Array.isArray(extensions.characterMemories) ? extensions.characterMemories : [];
    extensions.characterMemories = [
      ...previous.filter((memory) => {
        const record = parseJsonObject(memory);
        return stringValue(record.sceneChatId) !== stringValue(sceneChat.id);
      }),
      {
        from: sceneName,
        fromCharId: null,
        sceneChatId: stringValue(sceneChat.id),
        summary: summaryLine,
        createdAt,
      },
    ].slice(-100);
    await storage.update("characters", characterId, { data: { ...data, extensions } });
  }
}

async function appendSceneMemory(
  storage: StorageGateway,
  originChatId: string,
  sceneChatId: string,
  summary: string,
): Promise<void> {
  const originChat = await requireChat(storage, originChatId);
  const originMeta = parseJsonObject(originChat.metadata);
  const sceneChat = await requireChat(storage, sceneChatId);
  const previous = Array.isArray(originMeta.roleplaySceneHistory) ? originMeta.roleplaySceneHistory : [];
  const next = [
    ...previous.filter((entry) => parseJsonObject(entry).sceneChatId !== sceneChatId),
    {
      sceneChatId,
      concludedAt: new Date().toISOString(),
      summary,
    },
  ].slice(-20);
  await patchChatMetadata(storage, originChatId, {
    roleplaySceneHistory: next,
    lastRoleplaySceneSummary: summary,
    lastRoleplaySceneOptions: sceneCarryoverOptions(parseJsonObject(sceneChat.metadata)),
  });
}

async function rememberLastSceneOptions(
  storage: StorageGateway,
  originChatId: string,
  sceneChat: JsonRecord,
): Promise<void> {
  await patchChatMetadata(storage, originChatId, {
    lastRoleplaySceneOptions: sceneCarryoverOptions(parseJsonObject(sceneChat.metadata)),
  });
}

async function cleanOriginScenePointers(storage: StorageGateway, originChatId: string): Promise<void> {
  await patchChatMetadata(storage, originChatId, {
    activeSceneChatId: null,
    sceneBusyCharIds: null,
  });
  await storage.update("chats", originChatId, { connectedChatId: null });
}

async function deleteChatWithMessages(storage: StorageGateway, chatId: string): Promise<void> {
  for (const message of await messagesForChat(storage, chatId)) {
    if (message.id) {
      await storage.deleteChatMessage(message.id);
    }
  }
  await storage.delete("chats", chatId);
}

function forkMetadata(sceneMeta: JsonRecord): JsonRecord {
  const excluded = new Set([
    "sceneOriginChatId",
    "sceneInitiatorCharId",
    "sceneDescription",
    "sceneScenario",
    "sceneSystemPrompt",
    "sceneRating",
    "sceneStatus",
    "sceneConversationContext",
    "sceneRelationshipHistory",
    "sceneBackground",
    "activeSceneChatId",
    "sceneBusyCharIds",
  ]);
  return Object.fromEntries(
    Object.entries(sceneMeta).filter(([key]) => !excluded.has(key) && !key.startsWith("scene")),
  );
}

function buildForkContinuityMessage(sceneMeta: JsonRecord): string | null {
  const lines: string[] = [];
  const context = stringValue(sceneMeta.sceneConversationContext).trim();
  const relationship = stringValue(sceneMeta.sceneRelationshipHistory).trim();
  const scenario = stringValue(sceneMeta.sceneScenario).trim();
  if (context) lines.push("Origin conversation context:", context);
  if (relationship) lines.push("Relationship history:", relationship);
  if (scenario) lines.push("Scene premise:", scenario);
  if (!lines.length) return null;
  return ["Hidden continuity carried from the original scene branch.", "", ...lines].join("\n");
}

async function resolveConnectionId(
  storage: StorageGateway,
  chat: JsonRecord,
  override?: string | null,
): Promise<string> {
  if (override?.trim()) return override.trim();
  const chatConnectionId = stringValue(chat.connectionId).trim();
  const connections = await storage.list<JsonRecord>("connections");
  if (chatConnectionId === "random") {
    const pool = connections.filter((connection) => boolish(connection.useForRandom, false));
    const selected = pool[Math.floor(Math.random() * pool.length)];
    if (!selected?.id) throw new Error("No connections marked for the random pool");
    return stringValue(selected.id);
  }
  if (chatConnectionId) return chatConnectionId;
  const selected =
    connections.find((connection) => boolish(connection.isDefault, false) || boolish(connection.default, false)) ??
    connections[0];
  const id = stringValue(selected?.id);
  if (!id) throw new Error("No connection configured");
  return id;
}

function copyOptional(source: JsonRecord, keys: string[]): JsonRecord {
  return Object.fromEntries(keys.filter((key) => key in source).map((key) => [key, source[key]]));
}

const SCENE_CARRYOVER_METADATA_KEYS = [
  "agentOverrides",
  "enableTools",
  "expressionAvatarsEnabled",
  "spriteSide",
  "spotifySourceType",
  "spotifyPlaylistId",
  "spotifyPlaylistName",
  "spotifyArtist",
  "spotifyVolume",
  "spotifyMood",
] as const;

function sceneCarryoverSource(originMeta: JsonRecord): JsonRecord {
  const lastSceneOptions = parseJsonObject(originMeta.lastRoleplaySceneOptions);
  return Object.keys(lastSceneOptions).length > 0 ? lastSceneOptions : originMeta;
}

function sceneCarryoverOptions(originMeta: JsonRecord): JsonRecord {
  const source = sceneCarryoverSource(originMeta);
  const options = copyOptional(source, [...SCENE_CARRYOVER_METADATA_KEYS]);
  const activeAgentIds = stringArray(source.activeAgentIds);
  const activeToolIds = stringArray(source.activeToolIds);
  if (activeAgentIds.length > 0) {
    options.activeAgentIds = activeAgentIds;
  }
  if (source.enableTools === false) {
    options.enableTools = false;
  } else if (activeToolIds.length > 0) {
    options.activeToolIds = activeToolIds;
    options.enableTools = true;
  } else if (typeof source.enableTools === "boolean") {
    options.enableTools = source.enableTools;
  }
  return options;
}

function parseObject(raw: string): JsonRecord {
  try {
    const parsed = parseGameJsonish(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stringArray(value: unknown): string[] {
  return parseJsonArray<string>(value).filter((item) => typeof item === "string" && item.trim().length > 0);
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "Unknown error");
}
