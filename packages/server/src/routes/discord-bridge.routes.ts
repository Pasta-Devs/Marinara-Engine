import type { FastifyInstance } from "fastify";
import { createHash } from "crypto";
import type {
  CharacterData,
  DiscordBridgeChatPresetOption,
  DiscordBridgeConnectionOption,
  DiscordBridgeEngineSyncItem,
  DiscordBridgeIngestDiscordMessageResponse,
  DiscordBridgeMessageDirection,
  DiscordBridgeMessageMapping,
  DiscordBridgePromptPresetOption,
  DiscordBridgeRoleplayDefaults,
  DiscordBridgeRoleplaySettings,
  MessageRole,
} from "@marinara-engine/shared";
import { PROFESSOR_MARI_ID } from "@marinara-engine/shared";
import {
  getDiscordBridgeChatContext,
  getDiscordBridgeSetupOptions,
} from "../services/discord-bridge/bridge-context.service.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createChatPresetsStorage } from "../services/storage/chat-presets.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createDiscordBridgeStorage } from "../services/storage/discord-bridge.storage.js";
import { createPromptsStorage } from "../services/storage/prompts.storage.js";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import type {
  UpsertMessageMappingInput,
  UpsertThreadBindingInput,
} from "../services/storage/discord-bridge.storage.js";
import { logger } from "../lib/logger.js";

const DISCORD_BRIDGE_ROLEPLAY_SETTINGS_KEY = "discordBridge.roleplaySettings";

export async function discordBridgeRoutes(app: FastifyInstance) {
  const chatsStorage = createChatsStorage(app.db);
  const charactersStorage = createCharactersStorage(app.db);
  const appSettingsStorage = createAppSettingsStorage(app.db);
  const chatPresetsStorage = createChatPresetsStorage(app.db);
  const connectionsStorage = createConnectionsStorage(app.db);
  const promptsStorage = createPromptsStorage(app.db);
  const bridgeStorage = createDiscordBridgeStorage(app.db);
  const pendingDiscordIngestMessageIds = new Set<string>();

  app.get("/health", async () => {
    await bridgeStorage.listThreadBindings();
    return { ok: true, service: "discord-bridge" };
  });

  app.get("/setup-options", async () => {
    return getDiscordBridgeSetupOptions(chatsStorage, charactersStorage);
  });

  app.get("/connections", async () => {
    const connections = await connectionsStorage.list();
    const defaultConnection = await connectionsStorage.getDefault();
    return {
      connections: connections.map(toBridgeConnectionOption),
      defaultConnectionId: defaultConnection?.id ?? null,
    };
  });

  app.get("/prompt-presets", async () => {
    const presets = await promptsStorage.list();
    const defaultPreset = await promptsStorage.getDefault();
    return {
      presets: presets.map(toBridgePromptPresetOption),
      defaultPromptPresetId: defaultPreset?.id ?? null,
    };
  });

  app.get<{ Querystring: { mode?: string } }>("/chat-presets", async (req) => {
    await chatPresetsStorage.ensureDefaults();
    const mode = isSupportedChatPresetMode(req.query.mode) ? req.query.mode : undefined;
    const presets = mode ? await chatPresetsStorage.listByMode(mode) : await chatPresetsStorage.list();
    const activePreset = mode ? await chatPresetsStorage.getActive(mode) : null;
    return {
      presets: presets.map(toBridgeChatPresetOption),
      activePresetId: activePreset?.id ?? null,
    };
  });

  app.get("/roleplay-defaults", async () => {
    return resolveBridgeRoleplayDefaults();
  });

  app.patch<{
    Body: { connectionId?: unknown; promptPresetId?: unknown };
  }>("/roleplay-defaults", async (req, reply) => {
    const parsed = parseRoleplaySettingsBody(req.body);
    if ("error" in parsed) return reply.status(400).send({ error: parsed.error });

    if (parsed.input.connectionId && parsed.input.connectionId !== "random") {
      const connection = await connectionsStorage.getById(parsed.input.connectionId);
      if (!connection) return reply.status(404).send({ error: "Connection not found" });
    }

    if (parsed.input.promptPresetId) {
      const promptPreset = await promptsStorage.getById(parsed.input.promptPresetId);
      if (!promptPreset) return reply.status(404).send({ error: "Prompt preset not found" });
    }

    await saveBridgeRoleplaySettings(parsed.input);
    return resolveBridgeRoleplayDefaults();
  });

  async function resolveBridgeRoleplayDefaults(): Promise<DiscordBridgeRoleplayDefaults> {
    await chatPresetsStorage.ensureDefaults();
    const settings = await loadBridgeRoleplaySettings();
    const activePreset = await chatPresetsStorage.getActive("roleplay");
    const defaultConnection = await connectionsStorage.getDefault();

    let connectionId = settings.connectionId ?? activePreset?.settings.connectionId ?? defaultConnection?.id ?? null;
    let connection =
      connectionId && connectionId !== "random" ? await connectionsStorage.getById(connectionId) : null;
    if (connectionId && connectionId !== "random" && !connection) {
      connectionId = defaultConnection?.id ?? null;
      connection = connectionId ? await connectionsStorage.getById(connectionId) : null;
    }

    let promptPresetId =
      settings.promptPresetId ?? activePreset?.settings.promptPresetId ?? connection?.promptPresetId ?? null;
    let promptPreset = promptPresetId ? await promptsStorage.getById(promptPresetId) : null;
    if (promptPresetId && !promptPreset) {
      const defaultPromptPreset = await promptsStorage.getDefault();
      promptPresetId = defaultPromptPreset?.id ?? null;
      promptPreset = defaultPromptPreset ?? null;
    }

    return {
      connection: connection ? toBridgeConnectionOption(connection) : null,
      chatPreset: activePreset ? toBridgeChatPresetOption(activePreset) : null,
      promptPreset: promptPreset ? toBridgePromptPresetOption(promptPreset) : null,
      connectionId,
      promptPresetId,
      defaultParameters: parseNullableRecord(connection?.defaultParameters),
      settings,
    };
  }

  async function loadBridgeRoleplaySettings(): Promise<DiscordBridgeRoleplaySettings> {
    const raw = await appSettingsStorage.get(DISCORD_BRIDGE_ROLEPLAY_SETTINGS_KEY);
    if (!raw) return { connectionId: null, promptPresetId: null };

    try {
      const parsed = JSON.parse(raw) as Partial<DiscordBridgeRoleplaySettings>;
      return {
        connectionId: isValidOptionalSettingId(parsed.connectionId) ? parsed.connectionId : null,
        promptPresetId: isValidOptionalSettingId(parsed.promptPresetId) ? parsed.promptPresetId : null,
      };
    } catch {
      return { connectionId: null, promptPresetId: null };
    }
  }

  async function saveBridgeRoleplaySettings(settings: DiscordBridgeRoleplaySettings): Promise<void> {
    await appSettingsStorage.set(DISCORD_BRIDGE_ROLEPLAY_SETTINGS_KEY, JSON.stringify(settings));
  }

  app.get<{ Params: { chatId: string }; Querystring: { messageLimit?: string } }>(
    "/chats/:chatId/context",
    async (req, reply) => {
      const rawLimit = req.query.messageLimit;
      const messageLimit = rawLimit === undefined ? undefined : Number(rawLimit);
      const context = await getDiscordBridgeChatContext(chatsStorage, charactersStorage, req.params.chatId, {
        allMessages: rawLimit === "all",
        messageLimit: Number.isFinite(messageLimit) ? messageLimit : undefined,
      });
      if (!context) return reply.status(404).send({ error: "Chat not found" });
      return context;
    },
  );

  app.post<{
    Body: { name?: unknown; personaId?: unknown; characterIds?: unknown };
  }>("/roleplay-chats", async (req, reply) => {
    const parsed = parseCreateRoleplayChatBody(req.body);
    if ("error" in parsed) return reply.status(400).send({ error: parsed.error });

    for (const characterId of parsed.input.characterIds) {
      if (characterId === PROFESSOR_MARI_ID) {
        return reply.status(400).send({ error: "Professor Mari is only available from the Home screen." });
      }
      const character = await charactersStorage.getById(characterId);
      if (!character) return reply.status(404).send({ error: `Character not found: ${characterId}` });
    }

    if (parsed.input.personaId) {
      const persona = await charactersStorage.getPersona(parsed.input.personaId);
      if (!persona) return reply.status(404).send({ error: "Persona not found" });
    }

    const roleplayDefaults = await resolveBridgeRoleplayDefaults();
    const activePreset = roleplayDefaults.chatPreset;
    const connectionId = roleplayDefaults.connectionId;
    const promptPresetId = roleplayDefaults.promptPresetId;

    const chat = await chatsStorage.create({
      name: parsed.input.name,
      mode: "roleplay",
      characterIds: parsed.input.characterIds,
      groupId: null,
      personaId: parsed.input.personaId,
      promptPresetId,
      connectionId,
    });
    if (!chat) return reply.status(500).send({ error: "Failed to create roleplay chat" });

    const presetMetadata = parseRecord(activePreset?.settings.metadata);
    if (activePreset || Object.keys(presetMetadata).length > 0) {
      await chatsStorage.patchMetadata(chat.id, {
        ...presetMetadata,
        ...(activePreset ? { appliedChatPresetId: activePreset.id } : {}),
      });
    }

    if (roleplayDefaults.defaultParameters && Object.keys(roleplayDefaults.defaultParameters).length > 0) {
      await chatsStorage.patchMetadata(chat.id, { chatParameters: roleplayDefaults.defaultParameters });
    }

    const context = await getDiscordBridgeChatContext(chatsStorage, charactersStorage, chat.id, { messageLimit: 0 });
    if (!context) return reply.status(500).send({ error: "Failed to load created roleplay chat" });
    return { chat: context.chat };
  });

  app.get("/thread-bindings", async () => {
    return bridgeStorage.listThreadBindings();
  });

  app.get<{ Params: { threadId: string } }>("/thread-bindings/by-thread/:threadId", async (req, reply) => {
    const binding = await bridgeStorage.getThreadBindingByThreadId(req.params.threadId);
    if (!binding) return reply.status(404).send({ error: "Discord bridge thread binding not found" });
    return binding;
  });

  app.post<{
    Body: {
      guildId?: unknown;
      channelId?: unknown;
      threadId?: unknown;
      chatId?: unknown;
      chatName?: unknown;
      personaId?: unknown;
      characterIds?: unknown;
    };
  }>("/thread-bindings", async (req, reply) => {
    const parsed = parseThreadBindingBody(req.body);
    if ("error" in parsed) return reply.status(400).send({ error: parsed.error });

    const chat = await chatsStorage.getById(parsed.input.chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    return bridgeStorage.upsertThreadBinding(parsed.input);
  });

  app.get<{ Params: { threadId: string } }>("/thread-bindings/by-thread/:threadId/message-mappings", async (req, reply) => {
    const binding = await bridgeStorage.getThreadBindingByThreadId(req.params.threadId);
    if (!binding) return reply.status(404).send({ error: "Discord bridge thread binding not found" });
    return bridgeStorage.listMessageMappings(binding.id);
  });

  app.get<{ Params: { threadId: string; discordMessageId: string } }>(
    "/thread-bindings/by-thread/:threadId/message-mappings/by-discord-message/:discordMessageId",
    async (req, reply) => {
      const binding = await bridgeStorage.getThreadBindingByThreadId(req.params.threadId);
      if (!binding) return reply.status(404).send({ error: "Discord bridge thread binding not found" });

      const mapping = await bridgeStorage.getMessageMappingByDiscordMessageId(
        binding.id,
        req.params.discordMessageId,
      );
      if (!mapping) return reply.status(404).send({ error: "Discord bridge message mapping not found" });
      return mapping;
    },
  );

  app.post<{
    Params: { threadId: string };
    Body: { discordMessageId?: unknown; content?: unknown };
  }>("/thread-bindings/by-thread/:threadId/discord-messages", async (req, reply) => {
    const parsed = parseDiscordMessageIngestBody(req.body);
    if ("error" in parsed) return reply.status(400).send({ error: parsed.error });

    const binding = await bridgeStorage.getThreadBindingByThreadId(req.params.threadId);
    if (!binding) return reply.status(404).send({ error: "Discord bridge thread binding not found" });

    const existingMapping = await bridgeStorage.getMessageMappingByDiscordMessageId(
      binding.id,
      parsed.input.discordMessageId,
    );
    if (existingMapping) {
      const existingMessage = await chatsStorage.getMessage(existingMapping.marinaraMessageId);
      if (existingMessage) {
        return {
          message: {
            id: existingMessage.id,
            role: existingMessage.role,
            characterId: existingMessage.characterId ?? null,
            content: existingMessage.content,
            createdAt: existingMessage.createdAt,
          },
          mapping: existingMapping,
        } satisfies DiscordBridgeIngestDiscordMessageResponse;
      }
    }

    const created = await chatsStorage.createMessage({
      chatId: binding.chatId,
      role: "user",
      characterId: null,
      content: parsed.input.content,
    });
    if (!created) return reply.status(500).send({ error: "Failed to create Marinara message" });

    pendingDiscordIngestMessageIds.add(created.id);
    let mapping: DiscordBridgeMessageMapping;
    try {
      mapping = await bridgeStorage.upsertMessageMapping({
        bindingId: binding.id,
        marinaraMessageId: created.id,
        discordMessageIds: [parsed.input.discordMessageId],
        role: "user",
        direction: "discord_to_engine",
        contentHash: contentHash(parsed.input.content),
      });
    } catch (err) {
      try {
        await chatsStorage.removeMessage(created.id);
      } catch (cleanupErr) {
        logger.error(cleanupErr, "Failed to clean up Discord bridge message after mapping failure");
      }
      throw err;
    } finally {
      pendingDiscordIngestMessageIds.delete(created.id);
    }

    return {
      message: {
        id: created.id,
        role: created.role,
        characterId: created.characterId ?? null,
        content: created.content,
        createdAt: created.createdAt,
      },
      mapping,
    } satisfies DiscordBridgeIngestDiscordMessageResponse;
  });

  app.post<{
    Body: {
      bindingId?: unknown;
      marinaraMessageId?: unknown;
      discordMessageIds?: unknown;
      role?: unknown;
      direction?: unknown;
      contentHash?: unknown;
    };
  }>("/message-mappings", async (req, reply) => {
    const parsed = parseMessageMappingBody(req.body);
    if ("error" in parsed) return reply.status(400).send({ error: parsed.error });
    const binding = await bridgeStorage.getThreadBindingById(parsed.input.bindingId);
    if (!binding) return reply.status(404).send({ error: "Discord bridge thread binding not found" });
    const message = await chatsStorage.getMessage(parsed.input.marinaraMessageId);
    if (!message) return reply.status(404).send({ error: "Marinara message not found" });
    return bridgeStorage.upsertMessageMapping(parsed.input);
  });

  app.get<{ Querystring: { messageLimit?: string } }>("/engine-sync", async (req) => {
    const rawLimit = req.query.messageLimit;
    const messageLimit = rawLimit === undefined ? 100 : Number(rawLimit);
    const safeLimit = Number.isFinite(messageLimit) ? Math.max(1, Math.min(200, Math.floor(messageLimit))) : 100;
    const bindings = await bridgeStorage.listThreadBindings();
    const items: DiscordBridgeEngineSyncItem[] = [];

    for (const binding of bindings) {
      const context = await getDiscordBridgeChatContext(chatsStorage, charactersStorage, binding.chatId, {
        messageLimit: safeLimit,
      });
      if (!context) continue;

      const mappings = await bridgeStorage.listMessageMappings(binding.id);
      const mappingsByMessageId = new Map(mappings.map((mapping) => [mapping.marinaraMessageId, mapping]));

      for (const message of context.messages) {
        const hash = contentHash(message.content);
        const mapping = mappingsByMessageId.get(message.id) ?? null;
        if (pendingDiscordIngestMessageIds.has(message.id)) continue;
        if (!mapping) {
          items.push({ action: "create", binding, mapping: null, message, contentHash: hash });
          continue;
        }
        if (mapping.direction === "engine_to_discord" && mapping.contentHash !== hash) {
          items.push({ action: "update", binding, mapping, message, contentHash: hash });
        }
      }
    }

    return { items };
  });

  app.patch<{
    Params: { characterId: string };
    Body: { updates?: Array<{ field?: string; value?: unknown }> };
  }>("/characters/:characterId/fields", async (req, reply) => {
    const character = await charactersStorage.getById(req.params.characterId);
    if (!character) return reply.status(404).send({ error: "Character not found" });

    const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
    if (updates.length === 0) return reply.status(400).send({ error: "No field updates provided" });
    const textUpdates = parseTextFieldUpdates(updates, isSupportedCharacterField);
    if ("error" in textUpdates) return reply.status(400).send({ error: textUpdates.error });

    let currentData: CharacterData;
    try {
      currentData = JSON.parse(character.data) as CharacterData;
    } catch {
      return reply.status(500).send({ error: "Character data is not valid JSON" });
    }

    const nextData = { ...currentData };
    const nextExtensions = { ...(currentData.extensions ?? {}) };

    for (const update of textUpdates.updates) {
      if (isCharacterExtensionTextField(update.field)) {
        (nextExtensions as Record<string, unknown>)[update.field] = update.value;
        continue;
      }

      if (isCharacterTopLevelTextField(update.field)) {
        (nextData as Record<string, unknown>)[update.field] = update.value;
      }
    }

    nextData.extensions = nextExtensions;
    const updated = await charactersStorage.update(req.params.characterId, nextData, undefined, {
      versionSource: "discord-bridge",
      versionReason: "Discord bridge field edit",
      mergeExtensions: false,
    });
    if (!updated) return reply.status(404).send({ error: "Character not found" });
    return updated;
  });

  app.patch<{
    Params: { personaId: string };
    Body: { updates?: Array<{ field?: string; value?: unknown }> };
  }>("/personas/:personaId/fields", async (req, reply) => {
    const persona = await charactersStorage.getPersona(req.params.personaId);
    if (!persona) return reply.status(404).send({ error: "Persona not found" });

    const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
    if (updates.length === 0) return reply.status(400).send({ error: "No field updates provided" });
    const textUpdates = parseTextFieldUpdates(updates, isPersonaTextField);
    if ("error" in textUpdates) return reply.status(400).send({ error: textUpdates.error });

    const nextUpdates: Record<string, string> = {};
    for (const update of textUpdates.updates) {
      nextUpdates[update.field] = update.value;
    }

    const updated = await charactersStorage.updatePersona(req.params.personaId, nextUpdates);
    if (!updated) return reply.status(404).send({ error: "Persona not found" });
    return updated;
  });
}

const CHARACTER_TOP_LEVEL_TEXT_FIELDS = new Set<keyof CharacterData>([
  "name",
  "creator",
  "character_version",
  "creator_notes",
  "description",
  "personality",
  "scenario",
  "first_mes",
  "mes_example",
  "system_prompt",
  "post_history_instructions",
]);

const CHARACTER_EXTENSION_TEXT_FIELDS = new Set(["backstory", "appearance"]);

function isCharacterTopLevelTextField(field: string): field is keyof CharacterData {
  return CHARACTER_TOP_LEVEL_TEXT_FIELDS.has(field as keyof CharacterData);
}

function isCharacterExtensionTextField(field: string) {
  return CHARACTER_EXTENSION_TEXT_FIELDS.has(field);
}

const PERSONA_TEXT_FIELDS = new Set(["description", "personality", "backstory", "appearance", "scenario"]);

function isSupportedCharacterField(field: string) {
  return isCharacterTopLevelTextField(field) || isCharacterExtensionTextField(field);
}

function isPersonaTextField(field: string) {
  return PERSONA_TEXT_FIELDS.has(field);
}

function parseTextFieldUpdates(
  updates: Array<{ field?: string; value?: unknown }>,
  isSupportedField: (field: string) => boolean,
): { updates: Array<{ field: string; value: string }> } | { error: string } {
  const parsed: Array<{ field: string; value: string }> = [];
  for (const update of updates) {
    if (typeof update.field !== "string" || typeof update.value !== "string") {
      return { error: "Each field update requires a string field and value" };
    }
    if (!isSupportedField(update.field)) {
      return { error: `Unsupported field: ${update.field}` };
    }
    parsed.push({ field: update.field, value: update.value });
  }
  return { updates: parsed };
}

function toBoolean(value: unknown) {
  return value === true || value === "true";
}

function parseNullableRecord(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  return parseRecord(value);
}

function toBridgeConnectionOption(row: {
  id: string;
  name: string;
  provider: DiscordBridgeConnectionOption["provider"];
  baseUrl?: string | null;
  model?: string | null;
  maxContext?: number | null;
  isDefault?: unknown;
  useForRandom?: unknown;
  defaultForAgents?: unknown;
  defaultParameters?: unknown;
  promptPresetId?: string | null;
  updatedAt: string;
}): DiscordBridgeConnectionOption {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    baseUrl: row.baseUrl ?? "",
    model: row.model ?? "",
    maxContext: row.maxContext ?? 0,
    isDefault: toBoolean(row.isDefault),
    useForRandom: toBoolean(row.useForRandom),
    defaultForAgents: toBoolean(row.defaultForAgents),
    defaultParameters: parseNullableRecord(row.defaultParameters),
    promptPresetId: row.promptPresetId ?? null,
    updatedAt: row.updatedAt,
  };
}

function toBridgePromptPresetOption(row: {
  id: string;
  name: string;
  description?: string | null;
  isDefault?: unknown;
  author?: string | null;
  parameters?: unknown;
  updatedAt: string;
}): DiscordBridgePromptPresetOption {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    isDefault: toBoolean(row.isDefault),
    author: row.author ?? "",
    parameters: parseRecord(row.parameters),
    updatedAt: row.updatedAt,
  };
}

function toBridgeChatPresetOption(row: {
  id: string;
  name: string;
  mode: DiscordBridgeChatPresetOption["mode"];
  isDefault: boolean;
  isActive: boolean;
  settings: DiscordBridgeChatPresetOption["settings"];
  updatedAt: string;
}): DiscordBridgeChatPresetOption {
  return {
    id: row.id,
    name: row.name,
    mode: row.mode,
    isDefault: row.isDefault,
    isActive: row.isActive,
    settings: row.settings,
    updatedAt: row.updatedAt,
  };
}

function isSupportedChatPresetMode(value: unknown): value is DiscordBridgeChatPresetOption["mode"] {
  return value === "conversation" || value === "roleplay" || value === "visual_novel";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidOptionalSettingId(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value);
}

function parseStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => isNonEmptyString(item)) : [];
}

function parseRecord(value: unknown) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function contentHash(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function parseThreadBindingBody(body: {
  guildId?: unknown;
  channelId?: unknown;
  threadId?: unknown;
  chatId?: unknown;
  chatName?: unknown;
  personaId?: unknown;
  characterIds?: unknown;
}): { input: UpsertThreadBindingInput } | { error: string } {
  if (
    !isNonEmptyString(body.guildId) ||
    !isNonEmptyString(body.channelId) ||
    !isNonEmptyString(body.threadId) ||
    !isNonEmptyString(body.chatId) ||
    !isNonEmptyString(body.chatName)
  ) {
    return { error: "guildId, channelId, threadId, chatId, and chatName are required strings" };
  }

  return {
    input: {
      guildId: body.guildId,
      channelId: body.channelId,
      threadId: body.threadId,
      chatId: body.chatId,
      chatName: body.chatName,
      personaId: isNonEmptyString(body.personaId) ? body.personaId : null,
      characterIds: parseStringList(body.characterIds),
    },
  };
}

function parseCreateRoleplayChatBody(body: {
  name?: unknown;
  personaId?: unknown;
  characterIds?: unknown;
}): { input: { name: string; personaId: string | null; characterIds: string[] } } | { error: string } {
  if (!isNonEmptyString(body.name)) {
    return { error: "name is required" };
  }

  const name = body.name.trim();
  if (name.length > 200) return { error: "name must be 200 characters or less" };

  const characterIds = parseStringList(body.characterIds);
  if (characterIds.length === 0) return { error: "At least one character is required" };

  return {
    input: {
      name,
      personaId: isNonEmptyString(body.personaId) ? body.personaId : null,
      characterIds,
    },
  };
}

function parseRoleplaySettingsBody(body: {
  connectionId?: unknown;
  promptPresetId?: unknown;
}): { input: DiscordBridgeRoleplaySettings } | { error: string } {
  if (!isValidOptionalSettingId(body.connectionId) || !isValidOptionalSettingId(body.promptPresetId)) {
    return { error: "connectionId and promptPresetId must be strings or null" };
  }

  return {
    input: {
      connectionId: body.connectionId,
      promptPresetId: body.promptPresetId,
    },
  };
}

function parseDiscordMessageIngestBody(body: {
  discordMessageId?: unknown;
  content?: unknown;
}): { input: { discordMessageId: string; content: string } } | { error: string } {
  if (!isNonEmptyString(body.discordMessageId) || !isNonEmptyString(body.content)) {
    return { error: "discordMessageId and content are required strings" };
  }

  return {
    input: {
      discordMessageId: body.discordMessageId,
      content: body.content.trim(),
    },
  };
}

function isSupportedMessageRole(value: unknown): value is MessageRole {
  return typeof value === "string" && ["user", "assistant", "system", "narrator"].includes(value);
}

function isSupportedMessageDirection(value: unknown): value is DiscordBridgeMessageDirection {
  return typeof value === "string" && ["discord_to_engine", "engine_to_discord"].includes(value);
}

function parseMessageMappingBody(body: {
  bindingId?: unknown;
  marinaraMessageId?: unknown;
  discordMessageIds?: unknown;
  role?: unknown;
  direction?: unknown;
  contentHash?: unknown;
}): { input: UpsertMessageMappingInput } | { error: string } {
  if (
    !isNonEmptyString(body.bindingId) ||
    !isNonEmptyString(body.marinaraMessageId) ||
    !isNonEmptyString(body.contentHash)
  ) {
    return { error: "bindingId, marinaraMessageId, and contentHash are required strings" };
  }

  if (!isSupportedMessageRole(body.role)) {
    return { error: "role must be user, assistant, system, or narrator" };
  }

  if (!isSupportedMessageDirection(body.direction)) {
    return { error: "direction must be discord_to_engine or engine_to_discord" };
  }

  const discordMessageIds = parseStringList(body.discordMessageIds);
  if (discordMessageIds.length === 0) {
    return { error: "discordMessageIds must include at least one Discord message ID" };
  }

  return {
    input: {
      bindingId: body.bindingId,
      marinaraMessageId: body.marinaraMessageId,
      discordMessageIds,
      role: body.role,
      direction: body.direction,
      contentHash: body.contentHash,
    },
  };
}
