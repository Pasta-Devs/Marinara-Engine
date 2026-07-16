// ──────────────────────────────────────────────
// Importer: SillyTavern Chat (JSONL)
// ──────────────────────────────────────────────
import type { DB } from "../../db/connection.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createSpatialContextStorage } from "../storage/spatial-context.storage.js";
import { SPATIAL_CONTEXT_LIMITS, type ChatMode } from "@marinara-engine/shared";
import {
  latestTrustedTimestamp,
  normalizeTimestampOverrides,
  parseTrustedTimestamp,
  type TimestampOverrides,
} from "./import-timestamps.js";

interface STChatHeader {
  user_name?: string;
  character_name?: string;
  chat_metadata?: Record<string, unknown>;
}

interface STChatMessageExtra extends Record<string, unknown> {
  display_text?: string;
  type?: string;
  marinara_role?: string;
  marinara_character_id?: string | null;
  marinara_swipes?: unknown[];
}

interface STChatMessage {
  name?: string;
  is_user?: boolean;
  is_system?: boolean;
  role?: unknown;
  character_id?: unknown;
  send_date?: string;
  mes?: unknown;
  thinking?: unknown;
  reasoning?: unknown;
  reasoning_content?: unknown;
  swipes?: unknown;
  swipe_id?: unknown;
  extra?: STChatMessageExtra;
}

interface ParsedSTChatMessageInput {
  role: "system" | "user" | "assistant" | "narrator";
  characterId: string | null;
  content: string;
  parsedCreatedAt: string | null;
  extra?: Record<string, unknown>;
  activeSwipeIndex?: number;
  swipes?: Array<{
    index: number;
    content: string;
    extra?: Record<string, unknown>;
    createdAt?: string | null;
  }>;
}

export interface ImportSTChatOptions {
  /** Link chat to this character ID */
  characterId?: string | null;
  /** Multi-character override; takes precedence over characterId when provided */
  characterIds?: string[];
  /** Override mode (defaults to roleplay) */
  mode?: ChatMode;
  /** Explicitly set the chat name instead of deriving from header */
  chatName?: string;
  /** Optional imported branch/file label for branch UIs */
  branchName?: string;
  /** For group chats: map of speaker name → characterId */
  speakerMap?: Record<string, string>;
  /** Group ID to associate this chat with (for grouping branches) */
  groupId?: string | null;
  /** Persona to attach to the imported chat */
  personaId?: string | null;
  /** Connection to attach to the imported chat */
  connectionId?: string | null;
  /** Prompt preset to attach to the imported chat */
  promptPresetId?: string | null;
  /** Source file timestamps to preserve when trustworthy */
  timestampOverrides?: TimestampOverrides | null;
}

function normalizeTranscriptTimestamps(
  inputs: ParsedSTChatMessageInput[],
  fallbackStart?: TimestampOverrides | null,
): Array<ParsedSTChatMessageInput & { createdAt: string }> {
  // ST exports may contain identical or even backward send_date values.
  // Marinara sorts messages by createdAt, so make the imported transcript
  // strictly monotonic while preserving the source file's line order.
  const fallback = normalizeTimestampOverrides(fallbackStart);
  const firstParsedIndex = inputs.findIndex((input) => input.parsedCreatedAt);
  const firstParsedMs =
    firstParsedIndex >= 0 ? Date.parse(inputs[firstParsedIndex]!.parsedCreatedAt as string) : Number.NaN;
  const fallbackMs = Date.parse(fallback?.createdAt ?? fallback?.updatedAt ?? "");
  const nowMs = Date.now();

  let lastMs: number | null = null;

  return inputs.map((input, index) => {
    const parsedMs = input.parsedCreatedAt ? Date.parse(input.parsedCreatedAt) : Number.NaN;
    let candidateMs: number;

    if (Number.isFinite(parsedMs)) {
      candidateMs = parsedMs;
    } else if (lastMs !== null) {
      candidateMs = lastMs + 1;
    } else if (Number.isFinite(firstParsedMs)) {
      candidateMs = firstParsedMs - (firstParsedIndex - index);
    } else if (Number.isFinite(fallbackMs)) {
      candidateMs = fallbackMs + index;
    } else {
      candidateMs = nowMs + index;
    }

    if (lastMs !== null && candidateMs <= lastMs) {
      candidateMs = lastMs + 1;
    }

    lastMs = candidateMs;

    return {
      ...input,
      createdAt: new Date(candidateMs).toISOString(),
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeImportedRole(value: unknown): ParsedSTChatMessageInput["role"] | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "system":
    case "user":
    case "assistant":
    case "narrator":
      return normalized;
    default:
      return null;
  }
}

function normalizeImportedMode(value: unknown): ChatMode | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "conversation":
    case "roleplay":
    case "visual_novel":
    case "game":
      return normalized;
    default:
      return null;
  }
}

const INTERNAL_EXTRA_KEYS = new Set([
  "cachedPrompt",
  "chatCompletionsReasoning",
  "chatSummaryFingerprint",
  "contextInjections",
  "conversationCommandContent",
  "encryptedReasoning",
  "geminiParts",
  "generationInfo",
  "generationReplay",
  "lorebookScan",
]);

function normalizeImportedExtra(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};

  const extra = { ...raw };
  const displayText = typeof extra.display_text === "string" ? extra.display_text : null;
  delete extra.display_text;
  delete extra.marinara_role;
  delete extra.marinara_character_id;
  delete extra.marinara_swipes;
  for (const key of INTERNAL_EXTRA_KEYS) {
    delete extra[key];
  }

  if (typeof extra.displayText !== "string" && displayText) {
    extra.displayText = displayText;
  }

  return extra;
}

function normalizeImportedThinking(raw: unknown): string | null {
  return typeof raw === "string" && raw.trim().length > 0 ? raw : null;
}

function normalizeSwipeContents(raw: unknown, fallbackContent: string): string[] {
  if (!Array.isArray(raw)) return [fallbackContent];

  const swipes = raw.filter((swipe): swipe is string => typeof swipe === "string");
  return swipes.length > 0 ? swipes : [fallbackContent];
}

function normalizeSwipeIndex(raw: unknown, swipeCount: number): number {
  const numeric = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  if (!Number.isInteger(numeric) || numeric < 0 || numeric >= swipeCount) return 0;
  return numeric;
}

function normalizeMarinaraSwipeMetadata(extra: STChatMessageExtra | undefined) {
  const rawSwipes = Array.isArray(extra?.marinara_swipes) ? extra.marinara_swipes : [];
  const byIndex = new Map<
    number,
    {
      extra: Record<string, unknown>;
      createdAt: string | null;
    }
  >();

  for (const rawSwipe of rawSwipes) {
    if (!isRecord(rawSwipe)) continue;
    const index = typeof rawSwipe.index === "number" && Number.isInteger(rawSwipe.index) ? rawSwipe.index : null;
    if (index === null || index < 0) continue;
    const createdAt = parseTrustedTimestamp(
      typeof rawSwipe.created_at === "string"
        ? rawSwipe.created_at
        : typeof rawSwipe.createdAt === "string"
          ? rawSwipe.createdAt
          : undefined,
    );
    byIndex.set(index, {
      extra: normalizeImportedExtra(rawSwipe.extra),
      createdAt,
    });
  }

  return byIndex;
}

function sanitizeImportedMarinaraMetadata(
  metadata: Record<string, unknown>,
  localGameId: string,
): Record<string, unknown> {
  const sanitized = { ...metadata };

  // These are source-chat pointers. Keeping them after import can make the new
  // branch/session operate on the exported campaign or an already-closed scene.
  delete sanitized.activeSceneChatId;
  delete sanitized.sceneOriginChatId;
  delete sanitized.sceneStatus;

  if (typeof sanitized.gameId === "string" && sanitized.gameId.trim().length > 0) {
    sanitized.gameId = localGameId;
  }

  return sanitized;
}

/**
 * Import a SillyTavern JSONL chat file.
 *
 * Format: Line 0 = header JSON, lines 1+ = message JSON per line.
 */
export async function importSTChat(jsonlContent: string, db: DB, opts?: ImportSTChatOptions) {
  const storage = createChatsStorage(db);
  const lines = jsonlContent.split("\n").filter((l) => l.trim());

  if (lines.length < 2) {
    return { error: "Invalid JSONL: too few lines" };
  }

  // Parse header
  const header = JSON.parse(lines[0]!) as STChatHeader;
  const characterName = header.character_name ?? "Unknown";
  const userName = header.user_name ?? "User";
  const headerMetadata = isRecord(header.chat_metadata) ? header.chat_metadata : {};
  const marinaraMetadata = isRecord(headerMetadata.marinara_metadata) ? headerMetadata.marinara_metadata : {};
  const importedSpatialHistory = Array.isArray(marinaraMetadata.spatialContextHistory)
    ? marinaraMetadata.spatialContextHistory
    : [];
  const importedBranchName =
    opts?.branchName ??
    (typeof headerMetadata.branchName === "string"
      ? headerMetadata.branchName
      : typeof marinaraMetadata.branchName === "string"
        ? marinaraMetadata.branchName
        : null);
  const importedMode =
    opts?.mode ??
    normalizeImportedMode(headerMetadata.mode) ??
    normalizeImportedMode(marinaraMetadata.mode) ??
    "roleplay";

  // Build characterIds array. Caller-supplied list wins so an import-into-group
  // can fully inherit the existing chat's roster instead of being limited to a
  // single matched character.
  const characterIds: string[] = [];
  if (opts?.characterIds?.length) {
    for (const cid of opts.characterIds) {
      if (cid && !characterIds.includes(cid)) characterIds.push(cid);
    }
  } else if (opts?.characterId) {
    characterIds.push(opts.characterId);
  }
  // For group chats, collect all unique character IDs from speakerMap
  if (opts?.speakerMap) {
    for (const cid of Object.values(opts.speakerMap)) {
      if (cid && !characterIds.includes(cid)) characterIds.push(cid);
    }
  }

  const messageTimestamps: string[] = [];
  const parsedMsgInputs: ParsedSTChatMessageInput[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const stMsg = JSON.parse(lines[i]!) as STChatMessage;

      const role =
        normalizeImportedRole(stMsg.role) ??
        normalizeImportedRole(stMsg.extra?.marinara_role) ??
        normalizeImportedRole(stMsg.extra?.type) ??
        (stMsg.is_user ? "user" : stMsg.is_system ? "system" : "assistant");
      const rawContent = typeof stMsg.mes === "string" ? stMsg.mes : "";
      const messageExtra = normalizeImportedExtra(stMsg.extra);
      const exportedThinking =
        normalizeImportedThinking(stMsg.thinking) ??
        normalizeImportedThinking(stMsg.reasoning) ??
        normalizeImportedThinking(stMsg.reasoning_content);
      if (exportedThinking && typeof messageExtra.thinking !== "string") {
        messageExtra.thinking = exportedThinking;
      }
      const storedMessageExtra = Object.keys(messageExtra).length > 0 ? messageExtra : undefined;
      const swipeContents = normalizeSwipeContents(stMsg.swipes, rawContent);
      const activeSwipeIndex = normalizeSwipeIndex(stMsg.swipe_id, swipeContents.length);
      // Marinara exports store the currently displayed message in `mes`.
      // Older/broken exports could leave `swipes[swipe_id]` stale after a manual
      // edit, so prefer `mes` for the active swipe while preserving alternates.
      swipeContents[activeSwipeIndex] = rawContent;
      const content = swipeContents[activeSwipeIndex] ?? rawContent;
      const swipeMetadata = normalizeMarinaraSwipeMetadata(stMsg.extra);
      const swipes = swipeContents.map((swipeContent, index) => {
        const storedSwipe = swipeMetadata.get(index);
        const swipeExtra =
          index === activeSwipeIndex
            ? { ...(storedSwipe?.extra ?? {}), ...(storedMessageExtra ?? {}) }
            : (storedSwipe?.extra ?? {});
        return {
          index,
          content: swipeContent,
          extra: swipeExtra,
          createdAt: storedSwipe?.createdAt ?? null,
        };
      });

      // Resolve character ID for this message
      let messageCharacterId: string | null = null;
      if (role === "assistant") {
        const exportedCharacterId =
          typeof stMsg.character_id === "string"
            ? stMsg.character_id
            : typeof stMsg.extra?.marinara_character_id === "string"
              ? stMsg.extra.marinara_character_id
              : null;
        if (opts?.speakerMap && stMsg.name) {
          // Group chat: look up speaker
          messageCharacterId = exportedCharacterId ?? opts.speakerMap[stMsg.name] ?? opts?.characterId ?? null;
        } else {
          messageCharacterId = exportedCharacterId ?? opts?.characterId ?? null;
        }
      }

      const createdAt = parseTrustedTimestamp(stMsg.send_date);

      parsedMsgInputs.push({
        role,
        characterId: messageCharacterId,
        content,
        parsedCreatedAt: createdAt,
        extra: storedMessageExtra,
        activeSwipeIndex,
        swipes,
      });
    } catch {
      // Skip malformed lines
    }
  }

  const msgInputs = normalizeTranscriptTimestamps(parsedMsgInputs, opts?.timestampOverrides).map(
    ({ parsedCreatedAt, ...input }) => {
      messageTimestamps.push(input.createdAt);
      return input;
    },
  );

  const latestMessageTimestamp = latestTrustedTimestamp(messageTimestamps);
  const chatTimestamps = normalizeTimestampOverrides({
    createdAt: opts?.timestampOverrides?.createdAt ?? latestMessageTimestamp ?? null,
    updatedAt:
      latestMessageTimestamp ?? opts?.timestampOverrides?.updatedAt ?? opts?.timestampOverrides?.createdAt ?? null,
  });

  const chat = await storage.create(
    {
      name: opts?.chatName ?? `${characterName} (imported)`,
      mode: importedMode,
      characterIds,
      groupId: opts?.groupId ?? null,
      personaId: opts?.personaId ?? null,
      promptPresetId: opts?.promptPresetId ?? null,
      connectionId: opts?.connectionId ?? null,
    },
    chatTimestamps,
  );

  if (!chat) return { error: "Failed to create chat" };

  // Preserve an imported branch/file label separately from the main thread/chat name.
  if (Object.keys(marinaraMetadata).length > 0 || importedBranchName) {
    const existingMetadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
    const importedMetadata = sanitizeImportedMarinaraMetadata(
      marinaraMetadata,
      opts?.groupId ?? chat.groupId ?? chat.id,
    );
    delete importedMetadata.spatialContextHistory;
    await storage.patchMetadata(
      chat.id,
      {
        ...existingMetadata,
        ...importedMetadata,
        ...(importedBranchName ? { branchName: importedBranchName } : {}),
      },
      { touchUpdatedAt: false },
    );
  }

  const importedMessageIds = await storage.createMessagesBatch(chat.id, msgInputs, chatTimestamps);
  const spatialStorage = createSpatialContextStorage();
  for (const candidate of importedSpatialHistory) {
    if (!isRecord(candidate)) continue;
    const messageIndex = candidate.messageIndex;
    const swipeIndex = candidate.swipeIndex;
    const definitionRevision = candidate.definitionRevision;
    const currentLocationId = candidate.currentLocationId;
    if (
      !Number.isSafeInteger(messageIndex) ||
      typeof messageIndex !== "number" ||
      messageIndex < -1 ||
      !Number.isSafeInteger(swipeIndex) ||
      typeof swipeIndex !== "number" ||
      swipeIndex < 0 ||
      !Number.isSafeInteger(definitionRevision) ||
      typeof definitionRevision !== "number" ||
      definitionRevision < 0 ||
      (currentLocationId !== null &&
        (typeof currentLocationId !== "string" ||
          currentLocationId.length === 0 ||
          currentLocationId.length > SPATIAL_CONTEXT_LIMITS.maxIdLength ||
          currentLocationId !== currentLocationId.trim()))
    ) {
      continue;
    }
    if (messageIndex === -1 && swipeIndex !== 0) continue;
    if (messageIndex >= 0 && !msgInputs[messageIndex]?.swipes?.some((swipe) => swipe.index === swipeIndex)) continue;
    const messageId = messageIndex === -1 ? "" : importedMessageIds[messageIndex];
    if (messageId === undefined) continue;
    await spatialStorage.replaceAtAnchor({
      chatId: chat.id,
      messageId,
      swipeIndex,
      currentLocationId,
      definitionRevision,
      source: "branch_copy",
      transitionCommandId: null,
      transitionPayloadHash: null,
    });
  }

  return {
    success: true,
    chatId: chat.id,
    characterName,
    userName,
    messagesImported: msgInputs.length,
  };
}
