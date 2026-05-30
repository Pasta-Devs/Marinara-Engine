import type { StorageGateway } from "../capabilities/storage";
import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmGateway } from "../capabilities/llm";
import {
  parseCharacterCommands,
  parseDirectMessageCommands,
  type CharacterCommand,
  type CreateCharacterCommand,
  type CreateLorebookCommand,
  type CreatePersonaCommand,
  type UpdateCharacterCommand,
  type UpdateLorebookCommand,
  type UpdatePersonaCommand,
} from "../modes/chat/commands/character-commands";
import { createRoleplayScene, planRoleplayScene } from "../modes/roleplay/scene/scene-service";
import { resolveConversationSelfieSystemPrompt } from "./prompt-overrides";
import {
  boolish,
  isRecord,
  newId,
  nowIso,
  parseArray,
  parseRecord,
  readString,
  stringArray,
  type JsonRecord,
} from "./runtime-records";

export type ConnectedCommandEvent =
  | { type: "cross_post"; data: JsonRecord }
  | { type: "assistant_action"; data: JsonRecord }
  | { type: "ooc_posted"; data: JsonRecord }
  | { type: "selfie"; data: JsonRecord }
  | { type: "selfie_error"; data: JsonRecord }
  | { type: "command_error"; data: JsonRecord }
  | { type: "scene_created"; data: JsonRecord };

export interface ConnectedCommandResult {
  displayContent: string;
  createdNotes: JsonRecord[];
  executedCommands: string[];
  events: ConnectedCommandEvent[];
  assistantAttachments: JsonRecord[];
  suppressAssistantMessage?: boolean;
}

type ImagePromptSettings = {
  includeAppearances?: boolean;
  format?: "descriptive" | "tags";
};

function parseData(row: JsonRecord | null | undefined): JsonRecord {
  const raw = row?.data;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as JsonRecord) : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as JsonRecord) : {};
}

function nameOf(row: JsonRecord): string {
  return readString(row.name) || readString(parseData(row).name);
}

function matchesName(row: JsonRecord, name: string): boolean {
  return nameOf(row).trim().toLowerCase() === name.trim().toLowerCase();
}

async function findByName(storage: StorageGateway, entity: string, name: string): Promise<JsonRecord | null> {
  const rows = await storage.list<JsonRecord>(entity);
  return rows.find((row) => matchesName(row, name)) ?? null;
}

async function findConversationChatByTarget(
  storage: StorageGateway,
  sourceChatId: string,
  target: string,
): Promise<JsonRecord | null> {
  const normalized = target.trim().toLowerCase();
  if (!normalized) return null;
  const rows = await storage.list<JsonRecord>("chats");
  return (
    rows.find((chat) => {
      if (readString(chat.id) === sourceChatId) return false;
      if (readString(chat.mode) !== "conversation") return false;
      const id = readString(chat.id).toLowerCase();
      const name = readString(chat.name).toLowerCase();
      return id === normalized || name.includes(normalized);
    }) ?? null
  );
}

function roleplayDirectMessageCommandsEnabled(chat: JsonRecord): boolean {
  const mode = readString(chat.mode || chat.chatMode);
  return mode === "roleplay" && boolish(parseRecord(chat.metadata).roleplayDmCommandsEnabled, false);
}

function parseConnectedCommands(chat: JsonRecord, content: string): {
  cleanContent: string;
  commands: CharacterCommand[];
  parseEvents: ConnectedCommandEvent[];
  strippedHiddenContent: boolean;
} {
  if (!roleplayDirectMessageCommandsEnabled(chat)) {
    const parsed = parseCharacterCommands(content);
    return {
      ...parsed,
      parseEvents: [],
      strippedHiddenContent: parsed.cleanContent !== content,
    };
  }

  const directMessages = parseDirectMessageCommands(content);
  const parsed = parseCharacterCommands(directMessages.cleanContent);
  const parseEvents: ConnectedCommandEvent[] =
    directMessages.invalidCommands > 0
      ? [
          {
            type: "command_error",
            data: {
              command: "dm",
              error: "Direct-message command must include both character and message.",
            },
          },
        ]
      : [];
  return {
    cleanContent: parsed.cleanContent,
    commands: [...parsed.commands, ...directMessages.commands],
    parseEvents,
    strippedHiddenContent: directMessages.cleanContent !== content || parsed.cleanContent !== directMessages.cleanContent,
  };
}

function messageDefaults(chatId: string, value: Record<string, unknown>): Record<string, unknown> {
  const content = readString(value.content);
  return {
    ...value,
    chatId,
    content,
    activeSwipeIndex: value.activeSwipeIndex ?? 0,
    extra: value.extra ?? {},
    swipes: value.swipes ?? [{ content }],
  };
}

async function connectedNoteStorageChatId(storage: StorageGateway, chat: JsonRecord): Promise<string> {
  const sourceChatId = readString(chat.id);
  const connectedChatId = readString(chat.connectedChatId).trim();
  const mode = readString(chat.mode || chat.chatMode);
  if (!sourceChatId || !connectedChatId || mode !== "conversation") return sourceChatId;
  const target = await storage.get<JsonRecord>("chats", connectedChatId).catch(() => null);
  const targetMode = readString(target?.mode || target?.chatMode);
  return target && (targetMode === "roleplay" || targetMode === "game")
    ? readString(target.id) || connectedChatId
    : sourceChatId;
}

async function persistNoteWrites(
  storage: StorageGateway,
  sourceChat: JsonRecord,
  writes: Array<{ chatId: string; note: JsonRecord }>,
): Promise<void> {
  const byChat = new Map<string, JsonRecord[]>();
  for (const write of writes) {
    if (!write.chatId) continue;
    byChat.set(write.chatId, [...(byChat.get(write.chatId) ?? []), write.note]);
  }
  for (const [chatId, notes] of byChat) {
    const baseChat =
      chatId === readString(sourceChat.id)
        ? sourceChat
        : await storage.get<JsonRecord>("chats", chatId).then((row) => (isRecord(row) ? row : null));
    if (!baseChat) continue;
    const existingNotes = parseArray(baseChat.notes).filter(
      (entry): entry is JsonRecord => !!entry && typeof entry === "object" && !Array.isArray(entry),
    );
    await storage.update("chats", chatId, { notes: [...existingNotes, ...notes] });
  }
}

export async function consumePendingConnectedInfluences(storage: StorageGateway, chat: JsonRecord): Promise<void> {
  const chatId = readString(chat.id).trim();
  const mode = readString(chat.mode || chat.chatMode);
  const meta = parseRecord(chat.metadata);
  if (!chatId || (mode !== "roleplay" && mode !== "game") || !readString(chat.connectedChatId).trim()) return;
  if (readString(meta.sceneStatus) === "active") return;
  const notes = parseArray(chat.notes).filter(isRecord);
  let changed = false;
  const consumedAt = nowIso();
  const next = notes.map((note) => {
    const targetChatId = readString(note.targetChatId).trim();
    const targetsThisChat = !targetChatId || targetChatId === chatId;
    if (readString(note.type) !== "influence" || boolish(note.consumed, false) || !targetsThisChat) return note;
    changed = true;
    return { ...note, consumed: true, consumedAt };
  });
  if (changed) await storage.update("chats", chatId, { notes: next });
}

function formatFetchedRow(type: string, row: JsonRecord, related: JsonRecord[] = []): string {
  if (type === "chat") {
    const messages = related
      .map((message) => `${readString(message.role, "message")}: ${readString(message.content)}`)
      .join("\n");
    return [`Chat: ${readString(row.name)}`, messages].filter(Boolean).join("\n\n");
  }
  if (type === "lorebook") {
    const entries = related
      .map((entry) => {
        const keys = stringArray(entry.keys).join(", ");
        return `- ${readString(entry.name)}${keys ? ` (${keys})` : ""}: ${readString(entry.content)}`;
      })
      .join("\n");
    return [`Lorebook: ${readString(row.name)}`, readString(row.description), entries].filter(Boolean).join("\n\n");
  }
  const data = parseData(row);
  return JSON.stringify({ id: row.id, name: nameOf(row), ...data }, null, 2);
}

async function fetchCommandContext(storage: StorageGateway, command: Extract<CharacterCommand, { type: "fetch" }>) {
  const entity =
    command.fetchType === "character"
      ? "characters"
      : command.fetchType === "persona"
        ? "personas"
        : command.fetchType === "lorebook"
          ? "lorebooks"
          : command.fetchType === "preset"
            ? "prompts"
            : "chats";
  const row = await findByName(storage, entity, command.name);
  if (!row) return null;
  const related =
    command.fetchType === "chat"
      ? await storage.list<JsonRecord>("messages", { filters: { chatId: readString(row.id) }, limit: 30 })
      : command.fetchType === "lorebook"
        ? await storage.list<JsonRecord>("lorebook-entries", { filters: { lorebookId: readString(row.id) } })
        : [];
  return {
    key: `${command.fetchType}:${readString(row.id) || command.name}`,
    label: `${command.fetchType} ${nameOf(row) || command.name}`,
    content: formatFetchedRow(command.fetchType, row, related),
  };
}

function activeCharacterId(chat: JsonRecord): string | null {
  return stringArray(chat.characterIds)[0] ?? null;
}

function parseSelfieSize(value: unknown): { width: number; height: number } {
  const text = readString(value).trim();
  const match = text.match(/^(\d{2,5})x(\d{2,5})$/i);
  if (!match) return { width: 512, height: 768 };
  return {
    width: Math.max(64, Math.min(4096, Number(match[1]))),
    height: Math.max(64, Math.min(4096, Number(match[2]))),
  };
}

function imageExtension(mimeType: string): string {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  return "png";
}

function selfieTagsBlock(positive: string): string {
  return positive ? `\n\nAlways include these tags or modifiers: ${positive}` : "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function promptContainsTag(prompt: string, tag: string): boolean {
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escapeRegExp(tag)}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(prompt);
}

function appendMissingPositiveTags(prompt: string, positive: string): string {
  const basePrompt = prompt.trim();
  const tags = positive
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (!basePrompt || tags.length === 0) return basePrompt;

  const missing = tags.filter((tag) => !promptContainsTag(basePrompt, tag));
  return missing.length > 0 ? `${basePrompt}, ${missing.join(", ")}` : basePrompt;
}

async function buildSelfiePrompt(args: {
  storage: StorageGateway;
  llm?: LlmGateway;
  llmConnectionId?: string | null;
  chat: JsonRecord;
  commandContext?: string;
  characterId: string | null;
  imagePromptSettings?: ImagePromptSettings;
}): Promise<{ prompt: string; characterName: string }> {
  const character = args.characterId ? await args.storage.get<JsonRecord>("characters", args.characterId) : null;
  const data = parseData(character ?? undefined);
  const characterName = nameOf(character ?? {}) || readString(data.name, "character") || "character";
  const includeAppearances = args.imagePromptSettings?.includeAppearances !== false;
  const promptFormat = args.imagePromptSettings?.format === "tags" ? "tags" : "descriptive";
  const appearance = includeAppearances
    ? readString(parseRecord(data.extensions).appearance).trim() ||
      readString(data.appearance).trim() ||
      readString(data.description).trim()
    : "";
  const metadata = parseRecord(args.chat.metadata);
  const positive = readString(metadata.selfiePositivePrompt).trim() || stringArray(metadata.selfieTags).join(", ");
  const template = readString(metadata.selfiePrompt).trim();
  const systemPrompt = await resolveConversationSelfieSystemPrompt({
    storage: args.storage,
    chatPromptTemplate: template,
    appearance,
    charName: characterName,
    selfieTagsBlock: selfieTagsBlock(positive),
  });
  const formatInstruction =
    promptFormat === "tags"
      ? "Write the final image prompt as concise comma-separated image tags. Put the subject, outfit, expression, pose, camera, and quality tags first."
      : "Write the final image prompt as a clear natural-language description suitable for an image model.";
  const userPrompt = args.commandContext
    ? `Context for the selfie: ${args.commandContext}`
    : `Generate a casual selfie of ${characterName} based on the current conversation context.`;

  let prompt = "";
  if (args.llm && args.llmConnectionId) {
    prompt = (
      await args.llm.complete({
        connectionId: args.llmConnectionId,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              `Character: ${characterName}`,
              appearance ? `Appearance: ${appearance}` : "",
              positive ? `Required image tags: ${positive}` : "",
              formatInstruction,
              userPrompt,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        parameters: { temperature: 0.7, maxTokens: 800 },
      })
    ).trim();
    if (prompt && positive) prompt = appendMissingPositiveTags(prompt, positive);
  }
  if (!prompt) {
    prompt = [
      `selfie of ${characterName}`,
      appearance,
      args.commandContext,
      promptFormat === "tags"
        ? "selfie, casual camera angle, expressive face, detailed lighting"
        : "casual camera angle, expressive face, detailed lighting",
      positive,
    ]
      .filter((part) => readString(part).trim())
      .join(", ");
  }
  return { prompt, characterName };
}

async function generateSelfie(args: {
  storage: StorageGateway;
  integrations: IntegrationGateway | undefined;
  llm?: LlmGateway;
  llmConnectionId?: string | null;
  chat: JsonRecord;
  command: Extract<CharacterCommand, { type: "selfie" }>;
  events: ConnectedCommandEvent[];
  assistantAttachments: JsonRecord[];
  imagePromptSettings?: ImagePromptSettings;
}): Promise<boolean> {
  const metadata = parseRecord(args.chat.metadata);
  const imageConnectionId = readString(metadata.imageGenConnectionId).trim();
  const characterId = activeCharacterId(args.chat);
  if (!imageConnectionId) {
    eventsPushSelfieError(args.events, characterId, "No image generation connection configured for this chat.");
    return false;
  }
  if (!args.integrations?.image) {
    eventsPushSelfieError(args.events, characterId, "Image generation is not available.");
    return false;
  }

  try {
    const { prompt, characterName } = await buildSelfiePrompt({
      storage: args.storage,
      llm: args.llm,
      llmConnectionId: args.llmConnectionId,
      chat: args.chat,
      commandContext: args.command.context,
      characterId,
      imagePromptSettings: args.imagePromptSettings,
    });
    const negativePrompt = readString(metadata.selfieNegativePrompt).trim();
    const size = parseSelfieSize(metadata.selfieResolution);
    const image = await args.integrations.image.generate<{
      base64?: string;
      mimeType?: string;
      image?: string;
      provider?: string;
      model?: string;
    }>({
      connectionId: imageConnectionId,
      kind: "selfie",
      reviewId: `selfie:${readString(args.chat.id)}:${characterId ?? "active"}`,
      reviewTitle: `Selfie: ${characterName}`,
      prompt,
      negativePrompt: negativePrompt || undefined,
      width: size.width,
      height: size.height,
    });
    const mimeType = image.mimeType || "image/png";
    const base64 = readString(image.base64).trim();
    const imageUrl = readString(image.image).trim() || (base64 ? `data:${mimeType};base64,${base64}` : "");
    if (!imageUrl) throw new Error("Image provider returned no image data.");

    const gallery = await args.storage.create<JsonRecord>("gallery", {
      chatId: readString(args.chat.id),
      filePath: `selfie_${characterName.toLowerCase().replace(/\s+/g, "_")}.${imageExtension(mimeType)}`,
      filename: `selfie_${characterName.toLowerCase().replace(/\s+/g, "_")}.${imageExtension(mimeType)}`,
      url: imageUrl,
      prompt,
      provider: image.provider ?? "image_generation",
      model: image.model ?? null,
      width: size.width,
      height: size.height,
    });
    const attachment = {
      type: "image",
      url: imageUrl,
      filename: `selfie_${characterName.toLowerCase().replace(/\s+/g, "_")}.${imageExtension(mimeType)}`,
      prompt,
      galleryId: readString(gallery.id) || null,
    };
    args.assistantAttachments.push(attachment);
    args.events.push({
      type: "selfie",
      data: {
        characterId,
        characterName,
        imageUrl,
        prompt,
        galleryId: readString(gallery.id) || null,
      },
    });
    return true;
  } catch (error) {
    eventsPushSelfieError(
      args.events,
      characterId,
      error instanceof Error ? error.message : "Image generation failed.",
    );
    return false;
  }
}

function eventsPushSelfieError(events: ConnectedCommandEvent[], characterId: string | null, error: string): void {
  events.push({ type: "selfie_error", data: { characterId, error } });
}

function eventsPushCommandError(events: ConnectedCommandEvent[], command: string, error: string): void {
  events.push({ type: "command_error", data: { command, error } });
}

async function createSceneFromCommand(args: {
  storage: StorageGateway;
  llm?: LlmGateway;
  chat: JsonRecord;
  command: Extract<CharacterCommand, { type: "scene" }>;
  events: ConnectedCommandEvent[];
  llmConnectionId?: string | null;
}): Promise<boolean> {
  if (!args.llm) return false;
  const chatId = readString(args.chat.id);
  const planResult = await planRoleplayScene(
    { storage: args.storage, llm: args.llm },
    {
      chatId,
      prompt: [args.command.scenario, args.command.plan].filter(Boolean).join("\n\n"),
      connectionId: args.llmConnectionId ?? null,
    },
  );
  if (!planResult.plan) return false;
  const plan = {
    ...planResult.plan,
    background: args.command.background || planResult.plan.background,
  };
  const created = await createRoleplayScene(args.storage, {
    originChatId: chatId,
    initiatorCharId: activeCharacterId(args.chat),
    plan,
    connectionId: args.llmConnectionId ?? null,
  });
  args.events.push({
    type: "scene_created",
    data: {
      chatId: created.chatId,
      chatName: created.chatName,
      originChatId: chatId,
      background: created.background,
    },
  });
  return true;
}

async function applyScheduleUpdate(
  storage: StorageGateway,
  chat: JsonRecord,
  command: Extract<CharacterCommand, { type: "schedule_update" }>,
): Promise<boolean> {
  const characterId = activeCharacterId(chat);
  const chatId = readString(chat.id);
  const metadata = parseRecord(chat.metadata);
  const schedules = parseRecord(metadata.characterSchedules);
  const update = {
    status: command.status ?? "online",
    activity: command.activity ?? "",
    duration: command.duration ?? "",
    updatedAt: nowIso(),
  };
  if (characterId) schedules[characterId] = update;
  await storage.patchChatMetadata(chatId, { characterSchedules: schedules });
  if (characterId) {
    const row = await storage.get<JsonRecord>("characters", characterId);
    if (row?.id) {
      await storage.update("characters", characterId, {
        conversationStatus: update.status,
        conversationActivity: update.activity,
      });
    }
  }
  return true;
}

function characterDataFromCreate(command: CreateCharacterCommand): JsonRecord {
  return {
    name: command.name,
    description: command.description ?? "",
    personality: command.personality ?? "",
    first_mes: command.firstMessage ?? "",
    scenario: command.scenario ?? "",
    backstory: command.backstory ?? "",
    appearance: command.appearance ?? "",
    mes_example: command.mesExample ?? "",
    creator_notes: command.creatorNotes ?? "",
    system_prompt: command.systemPrompt ?? "",
    post_history_instructions: command.postHistoryInstructions ?? "",
    creator: command.creator ?? "",
    character_version: command.characterVersion ?? "1.0",
    tags: command.tags ?? [],
    alternate_greetings: command.alternateGreetings ?? [],
    extensions: {
      altDescriptions: [],
      ...(command.talkativeness != null ? { talkativeness: command.talkativeness } : {}),
      ...(command.depthPrompt ? { depth_prompt: command.depthPrompt } : {}),
      ...(command.depthPromptDepth != null ? { depth_prompt_depth: command.depthPromptDepth } : {}),
      ...(command.depthPromptRole ? { depth_prompt_role: command.depthPromptRole } : {}),
    },
    character_book: null,
  };
}

function characterDataPatch(data: JsonRecord, command: UpdateCharacterCommand): JsonRecord {
  const next: JsonRecord = { ...data, name: command.name || readString(data.name) };
  const fieldMap: Array<[keyof UpdateCharacterCommand, string]> = [
    ["description", "description"],
    ["personality", "personality"],
    ["firstMessage", "first_mes"],
    ["scenario", "scenario"],
    ["backstory", "backstory"],
    ["appearance", "appearance"],
    ["mesExample", "mes_example"],
    ["creatorNotes", "creator_notes"],
    ["systemPrompt", "system_prompt"],
    ["postHistoryInstructions", "post_history_instructions"],
    ["creator", "creator"],
    ["characterVersion", "character_version"],
    ["world", "world"],
  ];
  for (const [from, to] of fieldMap) {
    if (command[from] !== undefined) next[to] = command[from];
  }
  if (command.tags !== undefined) next.tags = command.tags;
  if (command.alternateGreetings !== undefined) next.alternate_greetings = command.alternateGreetings;
  if (command.fav !== undefined) next.fav = command.fav;
  const extensions = {
    ...(data.extensions && typeof data.extensions === "object" && !Array.isArray(data.extensions)
      ? (data.extensions as JsonRecord)
      : {}),
  };
  if (command.talkativeness !== undefined) extensions.talkativeness = command.talkativeness;
  if (command.depthPrompt !== undefined) extensions.depth_prompt = command.depthPrompt;
  if (command.depthPromptDepth !== undefined) extensions.depth_prompt_depth = command.depthPromptDepth;
  if (command.depthPromptRole !== undefined) extensions.depth_prompt_role = command.depthPromptRole;
  next.extensions = extensions;
  return next;
}

function personaPatch(command: CreatePersonaCommand | UpdatePersonaCommand): JsonRecord {
  return {
    name: command.name,
    ...(command.description !== undefined ? { description: command.description } : {}),
    ...(command.personality !== undefined ? { personality: command.personality } : {}),
    ...(command.appearance !== undefined ? { appearance: command.appearance } : {}),
    ...("scenario" in command && command.scenario !== undefined ? { scenario: command.scenario } : {}),
    ...("backstory" in command && command.backstory !== undefined ? { backstory: command.backstory } : {}),
  };
}

async function createLorebookEntries(
  storage: StorageGateway,
  lorebookId: string,
  command: CreateLorebookCommand | UpdateLorebookCommand,
) {
  if (!command.entries?.length) return;
  for (const entry of command.entries) {
    await storage.create("lorebook-entries", {
      lorebookId,
      name: entry.name,
      content: entry.content ?? entry.description ?? "",
      keys: entry.keys ?? [],
      secondaryKeys: entry.secondaryKeys ?? [],
      enabled: true,
      constant: entry.constant ?? false,
      selective: entry.selective ?? false,
      tag: entry.tag ?? "",
      order: 0,
    });
  }
}

async function executeCommand(
  storage: StorageGateway,
  integrations: IntegrationGateway | undefined,
  llm: LlmGateway | undefined,
  llmConnectionId: string | null | undefined,
  chat: JsonRecord,
  command: CharacterCommand,
  createdNotes: JsonRecord[],
  pendingNoteWrites: Array<{ chatId: string; note: JsonRecord }>,
  events: ConnectedCommandEvent[],
  assistantAttachments: JsonRecord[],
  visibleContent: string,
  imagePromptSettings?: ImagePromptSettings,
): Promise<{ name: string; suppressSourceMessage?: boolean } | null> {
  const chatId = readString(chat.id);
  switch (command.type) {
    case "note":
    case "influence": {
      const storageChatId = await connectedNoteStorageChatId(storage, chat);
      const targetChatId = storageChatId && storageChatId !== chatId ? storageChatId : null;
      const note = {
        id: newId(command.type),
        type: command.type,
        content: command.content,
        sourceChatId: chatId,
        targetChatId,
        ...(command.type === "influence" ? { consumed: false } : {}),
        createdAt: nowIso(),
      };
      createdNotes.push(note);
      pendingNoteWrites.push({ chatId: storageChatId || chatId, note });
      return { name: command.type };
    }
    case "memory": {
      const note = {
        id: newId("memory"),
        type: "memory",
        content: `${command.target}: ${command.summary}`,
        sourceChatId: chatId,
        targetChatId: null,
        createdAt: nowIso(),
      };
      createdNotes.push(note);
      pendingNoteWrites.push({ chatId, note });
      return { name: "memory" };
    }
    case "haptic":
      if (integrations) {
        await integrations.haptic.command({
          action: command.action,
          intensity: command.intensity,
          duration: command.duration,
        });
        return { name: "haptic" };
      }
      eventsPushCommandError(events, command.type, "Haptic integration is not connected.");
      return null;
    case "spotify":
      if (integrations) {
        const search = await integrations.spotify.searchTracks<{ tracks?: Array<{ uri?: string }> }>({
          query: `${command.title} ${command.artist}`,
          limit: 1,
        });
        const track = search.tracks?.find((item) => item.uri);
        if (track) await integrations.spotify.playTrack({ track });
        return { name: "spotify" };
      }
      eventsPushCommandError(events, command.type, "Spotify integration is not connected.");
      return null;
    case "create_persona":
      await storage.create("personas", personaPatch(command));
      return { name: "create_persona" };
    case "update_persona": {
      const row = await findByName(storage, "personas", command.name);
      if (!row?.id) return null;
      await storage.update("personas", readString(row.id), personaPatch(command));
      return { name: "update_persona" };
    }
    case "create_character":
      await storage.create("characters", { name: command.name, data: characterDataFromCreate(command) });
      return { name: "create_character" };
    case "update_character": {
      const row = await findByName(storage, "characters", command.name);
      if (!row?.id) return null;
      await storage.update("characters", readString(row.id), {
        name: command.name,
        data: characterDataPatch(parseData(row), command),
      });
      return { name: "update_character" };
    }
    case "create_lorebook": {
      const lorebook = await storage.create<JsonRecord>("lorebooks", {
        name: command.name,
        description: command.description ?? "",
        category: command.category ?? "uncategorized",
        tags: command.tags ?? [],
      });
      await createLorebookEntries(storage, readString(lorebook.id), command);
      return { name: "create_lorebook" };
    }
    case "update_lorebook": {
      const row = await findByName(storage, "lorebooks", command.name);
      if (!row?.id) return null;
      const lorebookId = readString(row.id);
      await storage.update("lorebooks", lorebookId, {
        ...(command.newName ? { name: command.newName } : {}),
        ...(command.description !== undefined ? { description: command.description } : {}),
        ...(command.category !== undefined ? { category: command.category } : {}),
        ...(command.tags !== undefined ? { tags: command.tags } : {}),
      });
      await createLorebookEntries(storage, lorebookId, command);
      return { name: "update_lorebook" };
    }
    case "create_chat": {
      const character = await findByName(storage, "characters", command.character);
      await storage.create("chats", {
        name: command.character,
        mode: command.mode ?? "conversation",
        characterIds: character?.id ? [readString(character.id)] : [],
        folderId: chat.folderId ?? null,
        metadata: {},
      });
      return { name: "create_chat" };
    }
    case "cross_post": {
      const target = await findConversationChatByTarget(storage, chatId, command.target);
      const content = visibleContent.trim();
      if (!target?.id || !content) return null;
      const targetChatId = readString(target.id);
      await storage.createChatMessage(
        targetChatId,
        messageDefaults(targetChatId, {
          role: "assistant",
          characterId: stringArray(chat.characterIds)[0] ?? null,
          content,
        }),
      );
      events.push({
        type: "cross_post",
        data: {
          targetChatId,
          targetChatName: readString(target.name),
          sourceChatId: chatId,
          characterId: stringArray(chat.characterIds)[0] ?? null,
        },
      });
      return { name: "cross_post", suppressSourceMessage: true };
    }
    case "navigate":
      events.push({
        type: "assistant_action",
        data: { action: "navigate", panel: command.panel, tab: command.tab ?? null },
      });
      return { name: "navigate" };
    case "fetch": {
      const fetched = await fetchCommandContext(storage, command);
      if (!fetched || !chatId) return null;
      const metadata = parseRecord(chat.metadata);
      const mariContext = parseRecord(metadata.mariContext);
      mariContext[fetched.key] = fetched.content;
      await storage.patchChatMetadata(chatId, { mariContext });
      events.push({
        type: "assistant_action",
        data: {
          action: "data_fetched",
          key: fetched.key,
          label: fetched.label,
          content: fetched.content,
        },
      });
      return { name: "fetch" };
    }
    case "dm": {
      const character = await findByName(storage, "characters", command.character);
      const characterId = readString(character?.id);
      if (!character || !characterId) {
        eventsPushCommandError(
          events,
          command.type,
          `No character named "${command.character}" was found for the direct-message command.`,
        );
        return null;
      }
      let targetChat =
        (await storage.list<JsonRecord>("chats")).find((candidate) => {
          const ids = stringArray(candidate.characterIds);
          return readString(candidate.mode) === "conversation" && ids.includes(characterId);
        }) ?? null;
      const createdChat = !targetChat;
      if (!targetChat) {
        const characterName = nameOf(character) || command.character;
        targetChat = await storage.create<JsonRecord>("chats", {
          name: characterName,
          mode: "conversation",
          characterIds: [characterId],
          folderId: chat.folderId ?? null,
          metadata: {},
        });
      }
      const targetChatId = readString(targetChat.id);
      if (!targetChatId) {
        eventsPushCommandError(events, command.type, "Could not resolve a conversation for the direct-message command.");
        return null;
      }
      const targetChatName = readString(targetChat.name) || nameOf(character) || command.character;
      await storage.createChatMessage(
        targetChatId,
        messageDefaults(targetChatId, {
          role: "assistant",
          characterId,
          content: command.message,
        }),
      );
      events.push({
        type: "ooc_posted",
        data: { chatId: targetChatId, chatName: targetChatName, count: 1, createdChat },
      });
      return { name: "dm", suppressSourceMessage: !visibleContent.trim() };
    }
    case "schedule_update":
      return (await applyScheduleUpdate(storage, chat, command)) ? { name: "schedule_update" } : null;
    case "selfie":
      return (await generateSelfie({
        storage,
        integrations,
        llm,
        llmConnectionId,
        chat,
        command,
        events,
        assistantAttachments,
        imagePromptSettings,
      }))
        ? { name: "selfie" }
        : null;
    case "scene":
      return (await createSceneFromCommand({ storage, llm, chat, command, events, llmConnectionId }))
        ? { name: "scene" }
        : null;
  }
}

export async function persistConnectedCommandTags(
  storage: StorageGateway,
  chat: JsonRecord,
  content: string,
  integrations?: IntegrationGateway,
  llm?: LlmGateway,
  llmConnectionId?: string | null,
  imagePromptSettings?: ImagePromptSettings,
): Promise<ConnectedCommandResult> {
  const createdNotes: JsonRecord[] = [];
  const pendingNoteWrites: Array<{ chatId: string; note: JsonRecord }> = [];
  const parsed = parseConnectedCommands(chat, content);
  const executedCommands: string[] = [];
  const events: ConnectedCommandEvent[] = [...parsed.parseEvents];
  const assistantAttachments: JsonRecord[] = [];
  let suppressAssistantMessage = false;

  for (const command of parsed.commands) {
    try {
      const executed = await executeCommand(
        storage,
        integrations,
        llm,
        llmConnectionId,
        chat,
        command,
        createdNotes,
        pendingNoteWrites,
        events,
        assistantAttachments,
        parsed.cleanContent,
        imagePromptSettings,
      );
      if (executed) {
        executedCommands.push(executed.name);
        suppressAssistantMessage = suppressAssistantMessage || executed.suppressSourceMessage === true;
      }
    } catch (error) {
      eventsPushCommandError(
        events,
        command.type,
        error instanceof Error ? error.message : "Command execution failed.",
      );
    }
  }

  if (pendingNoteWrites.length > 0) {
    await persistNoteWrites(storage, chat, pendingNoteWrites);
  }

  const hasVisibleSourceOutput = parsed.cleanContent.trim().length > 0 || assistantAttachments.length > 0;
  const suppressEmptyHiddenCommandSource =
    !hasVisibleSourceOutput && parsed.strippedHiddenContent && content.trim().length > 0;

  return {
    displayContent: parsed.cleanContent,
    createdNotes,
    executedCommands,
    events,
    assistantAttachments,
    suppressAssistantMessage: suppressAssistantMessage || suppressEmptyHiddenCommandSource,
  };
}
