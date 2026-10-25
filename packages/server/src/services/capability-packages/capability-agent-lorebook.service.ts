import { resolveMacros, type Lorebook, type LorebookEntry } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import {
  isMessageHiddenFromAI,
  parseExtra,
  parseGameStateRow,
  resolveActiveCharacterIds,
  resolveCharacterNameMap,
} from "../../routes/generate/generate-route-utils.js";
import { normalizeGenerationReplay } from "../../routes/generate/generation-replay.js";
import { normalizeAgentContextSize } from "../agents/agent-executor.js";
import { resolveChatUserIdentity } from "../chat-user-identity.js";
import { createAgentLorebookTriggerResolver } from "../generation/agent-lorebook-triggers.js";
import {
  buildLorebookScanMessagesWithGenerationGuide,
  normalizeStoredLorebookGenerationTriggers,
  resolveLorebookGenerationTriggers,
  resolveLorebookTokenBudget,
} from "../generation/lorebook-generation-runtime.js";
import { roleplayAgentsSeeWhispers, roleplayAgentText } from "../generation/roleplay-commands.js";
import { isMemoryRecallVectorizerAvailable, resolveMemoryRecallEmbeddingSource } from "../memory-recall-embedding.js";
import { cardPromptText } from "../prompt/card-text.js";
import {
  buildPromptMacroContext,
  normalizeChatMacroVariables,
  resolveCharacterMacroData,
  resolvePromptMessageMacros,
} from "../prompt/macro-context.js";
import { createAgentsStorage } from "../storage/agents.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createChatsStorage, parseCharacterIds } from "../storage/chats.storage.js";
import { createGameStateStorage } from "../storage/game-state.storage.js";
import { createLorebooksStorage } from "../storage/lorebooks.storage.js";

/** The host supplies packageId: a package cannot select another agent or an arbitrary source book. */
export async function resolvePackageAgentLorebookEntries(
  db: DB,
  packageId: string,
  { chatId, signal }: { chatId: string; signal?: AbortSignal },
): Promise<Array<{ id: string; name?: string; content: string }>> {
  signal?.throwIfAborted();
  const chats = createChatsStorage(db);
  const chat = await chats.getById(chatId);
  if (!chat) throw new Error("Chat not found");
  const metadata = parseExtra(chat.metadata);
  const attachments = metadata.agentLorebookAttachments;
  const attachment =
    attachments && typeof attachments === "object" && !Array.isArray(attachments)
      ? (attachments as Record<string, unknown>)[packageId]
      : null;
  if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) return [];
  const selected = attachment as Record<string, unknown>;
  if (selected.enabled !== true || typeof selected.lorebookId !== "string" || !selected.lorebookId.trim()) return [];

  const characters = createCharactersStorage(db);
  const roster = parseCharacterIds(chat.characterIds);
  const characterIds = resolveActiveCharacterIds(roster, metadata, { mode: chat.mode, allowEmpty: true });
  const tags = new Set<string>();
  for (const id of characterIds) {
    const card = await characters.getById(id);
    const data = parseExtra(card?.data);
    if (Array.isArray(data.tags)) for (const tag of data.tags) if (typeof tag === "string") tags.add(tag);
  }
  const persona = await resolveChatUserIdentity(characters, {
    id: chat.id,
    mode: chat.mode,
    personaId: chat.personaId,
    personaCharacterId: chat.personaCharacterId,
  });
  const allMessages = await chats.listMessages(chatId);
  const config = await createAgentsStorage(db).getByType(packageId);
  const contextSize = normalizeAgentContextSize(parseExtra(config?.settings).contextSize);
  const agentMessages: typeof allMessages = [];
  let lastTurn: (typeof allMessages)[number] | undefined;
  let priorTurn: (typeof allMessages)[number] | undefined;
  let lastInput: string | undefined;
  for (let index = allMessages.length - 1; index >= 0; index--) {
    const message = allMessages[index]!;
    if (chat.mode === "game" || !isMessageHiddenFromAI(message)) {
      if (message.role === "user" || message.role === "assistant") {
        if (!lastTurn) lastTurn = message;
        else if (!priorTurn) priorTurn = message;
      }
      if (lastInput === undefined && message.role === "user") lastInput = message.content;
      if (agentMessages.length < contextSize) agentMessages.push(message);
    }
    if (parseExtra(message.extra).isConversationStart) break;
    if (agentMessages.length === contextSize && lastInput !== undefined && priorTurn) break;
  }
  agentMessages.reverse();
  const replay = normalizeGenerationReplay(parseExtra(lastTurn?.extra).generationReplay);
  const storedTriggers: unknown = parseExtra(lastTurn?.extra).lorebookGenerationTriggers;
  const savedTriggers = normalizeStoredLorebookGenerationTriggers(storedTriggers, chat.mode);
  // Legacy group replies and continuations can have identical rows. Older input supplies macros,
  // not proof of this turn's intent; retain the adjacent-turn fallback for that history.
  const generationTriggers =
    savedTriggers ??
    resolveLorebookGenerationTriggers(
      {
        ...replay,
        userMessage:
          replay?.userMessage ??
          (lastTurn?.role === "user" ? lastTurn.content : priorTurn?.role === "user" ? priorTurn.content : null),
        regenerateMessageId:
          lastTurn?.role === "assistant" && (lastTurn.activeSwipeIndex ?? 0) > 0 ? lastTurn.id : null,
      },
      chat.mode,
    );
  const books = createLorebooksStorage(db);
  const sourceEntries = (await books.listEntriesByLorebooks([
    selected.lorebookId.trim(),
  ])) as unknown as LorebookEntry[];
  const macros = await buildPromptMacroContext({
    db,
    chatId,
    characterIds,
    personaName: persona?.name ?? "User",
    personaDescription: cardPromptText(persona?.description),
    personaFields: persona
      ? {
          example: cardPromptText(persona.mesExample),
          personality: cardPromptText(persona.personality),
          scenario: cardPromptText(persona.scenario),
          backstory: cardPromptText(persona.backstory),
          appearance: cardPromptText(persona.appearance),
        }
      : {},
    variables: {},
    localVariables: { ...normalizeChatMacroVariables(metadata.macroVariables) },
    lastInput,
    macroSources: [...agentMessages.map((message) => message.content), ...sourceEntries.map((entry) => entry.content)],
  });
  const profiles = await resolveCharacterMacroData(db, characterIds, chatId);
  const whisperNames = roleplayAgentsSeeWhispers(chat.mode, metadata)
    ? new Map([
        ...(await resolveCharacterNameMap(roster, (id) => characters.getById(id))),
        [persona?.id ?? "user", persona?.name ?? "User"],
      ])
    : null;
  const messages = resolvePromptMessageMacros(
    agentMessages.map((message) => ({
      ...message,
      characterId: message.characterId ?? undefined,
      content: roleplayAgentText(message.content, message, whisperNames),
    })),
    macros,
    profiles.profilesById,
  );
  const scanMessages = messages.map((message) => ({
    role:
      message.role === "user"
        ? ("user" as const)
        : message.role === "system"
          ? ("system" as const)
          : ("assistant" as const),
    content: message.content,
  }));
  const supplementalScanMessages = buildLorebookScanMessagesWithGenerationGuide([], replay ?? {}, (value) =>
    resolveMacros(value, macros, { trimResult: false }),
  );
  let embeddingSource: Awaited<ReturnType<typeof resolveMemoryRecallEmbeddingSource>> | null = null;
  let vectorizerAvailable = false;
  try {
    embeddingSource = await resolveMemoryRecallEmbeddingSource(db, {
      chatMetadata: metadata,
      connectionId: chat.connectionId,
    });
    vectorizerAvailable =
      embeddingSource !== null ||
      (await isMemoryRecallVectorizerAvailable(db, { chatMetadata: metadata, connectionId: chat.connectionId }));
  } catch (error) {
    signal?.throwIfAborted();
    logger.warn(error, "[capability] Embedding source unavailable for agent %s; using keyword matching", packageId);
  }
  const snapshot = await createGameStateStorage(db).getLatestCommitted(chatId);
  const resolved = await createAgentLorebookTriggerResolver({
    agents: [
      {
        id: packageId,
        contextSize,
        source: "manual",
        sourceLorebookIds: [selected.lorebookId.trim()],
      },
    ],
    activeCharacterIds: characterIds,
    activeCharacterTags: [...tags],
    embeddingSource,
    entryStateOverrides:
      (metadata.entryStateOverrides as Record<string, { enabled?: boolean; ephemeral?: number | null }>) ?? {},
    filterSourceLorebookIds: async (ids) => ids,
    gameState: snapshot ? { ...parseGameStateRow(snapshot) } : null,
    generationTriggers,
    supplementalScanMessages,
    listEntriesByLorebookIds: async (ids) =>
      sourceEntries.filter((entry) => ids.includes(entry.lorebookId)) as LorebookEntry[],
    listLorebooks: async () => (await books.list()) as unknown as Lorebook[],
    resolveContent: (value) => resolveMacros(value, macros, { trimResult: false }),
    tokenBudget: resolveLorebookTokenBudget(metadata),
    vectorizerAvailable,
    signal,
  })(scanMessages);
  signal?.throwIfAborted();
  return (resolved[packageId] ?? []).map(({ id, name, content }) => ({
    id,
    ...(typeof name === "string" ? { name } : {}),
    content,
  }));
}
