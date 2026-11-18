import { allowsDefaultChatModel } from "../../services/llm/local-context-limit.js";
import {
  normalizeCustomEmojiSelection,
  shortGalleryDescription,
  normalizeTextForMatch,
  parseGroupedSpeakerSegments,
  type CustomEmojiSelectionPrefs,
  type GroupedSegment,
  type MessageReaction,
} from "@marinara-engine/shared";

import { join } from "node:path";

import { logger } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { resolveFlatMediaFile } from "../../utils/media-file-security.js";
import { resolveStoredGalleryFile } from "../../services/image/gallery-file-lifecycle.js";
import {
  recordVisionAssetPath,
  type ConversationAssetVisionCatalog,
} from "../../services/generation/conversation-emoji-vision.js";
import { cosineSimilarity } from "../../services/lorebook/embeddings.js";
import { isLocalEmbedderAvailable, localEmbed } from "../../services/local-embedder.js";
import type { MemoryRecallEmbeddingSource } from "../../services/memory-recall.js";
import { createLLMProvider } from "../../services/llm/provider-registry.js";
import { withConnectionFallbackProvider } from "../../services/llm/connection-fallback-provider.js";
import type { GenerationPromptMessage } from "../../services/generation/prompt-message-scope.js";
import type { createConnectionsStorage } from "../../services/storage/connections.storage.js";
import { appendToFirstSystemMessage, latestHistoryUserContent } from "./conversation-prompt-formatting.js";
import { resolveBaseUrl } from "./generate-route-utils.js";

type NamedAssetRow = {
  name?: unknown;
  filePath?: unknown;
  description?: unknown;
};

type GalleryAssetRow = {
  customKind?: unknown;
  customName?: unknown;
  filePath?: unknown;
  description?: unknown;
};

/** An emoji's or sticker's description by name, when it has one. */
export type AssetDescriber = (name: string) => string | undefined;

const noDescriptions: AssetDescriber = () => undefined;

/** The text the embedder compares with the message: the name in words, then the description. */
export function semanticAssetText(name: string, description: string | undefined): string {
  const words = name.replace(/_/g, " ");
  return description ? `${words}: ${description}` : words;
}

/** Keep the first description recorded for a name: callers record the responder's own, then the persona's, then global. */
function recordAssetDescription(descriptions: Map<string, string>, name: unknown, description: unknown) {
  if (typeof name !== "string" || !name || descriptions.has(name)) return;
  const text = shortGalleryDescription(typeof description === "string" ? description : null, 120);
  if (text) descriptions.set(name, text);
}

type ConversationCustomAssetStore = {
  list(): Promise<NamedAssetRow[]>;
};

type GalleryAssetStore = {
  listByPersonaId?(personaId: string): Promise<GalleryAssetRow[]>;
  listByCharacterId?(characterId: string): Promise<GalleryAssetRow[]>;
};

type ConversationAssetCharacter = {
  id: string;
  name: string;
};

/** Fisher-Yates shuffle (in place); used for random emoji selection. */
function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

/** Asset texts already embedded, by vector space; names and descriptions rarely change between messages. */
const assetVectorCache = new Map<string, number[]>();
const ASSET_VECTOR_CACHE_LIMIT = 4000;

/**
 * The message and the asset texts embedded with the Embeddings default (the message as a search, the assets as
 * documents, so model prefixes apply), reusing earlier asset vectors. Null when that source fails.
 */
async function embedWithSource(
  source: MemoryRecallEmbeddingSource,
  query: string,
  texts: string[],
): Promise<{ queryVector: number[]; vectors: number[][] } | null> {
  const space = source.cacheIdentity?.trim() || source.spaceId?.trim() || source.label;
  const keyOf = (text: string) => `${space}\u0000${text}`;
  const missing = [...new Set(texts.filter((text) => !assetVectorCache.has(keyOf(text))))];
  const [queryVectors, fresh] = await Promise.all([
    source.embed([query], undefined, "query"),
    missing.length > 0 ? source.embed(missing, undefined, "document") : Promise.resolve([] as number[][]),
  ]);
  if (!queryVectors?.[0] || !fresh || fresh.length !== missing.length) return null;
  missing.forEach((text, index) => {
    if (assetVectorCache.size >= ASSET_VECTOR_CACHE_LIMIT) {
      assetVectorCache.delete(assetVectorCache.keys().next().value!);
    }
    assetVectorCache.set(keyOf(text), fresh[index]!);
  });
  const vectors = texts.map((text) => assetVectorCache.get(keyOf(text)));
  if (vectors.some((vector) => !vector)) return null;
  return { queryVector: queryVectors[0], vectors: vectors as number[][] };
}

/**
 * Order emoji names by semantic relevance to `query`: with the Embeddings default when one is set, else (or when it
 * fails) with the bundled local embedder. Returns null when neither is available.
 */
async function rankEmojiNamesBySemantic(
  names: string[],
  query: string,
  boosted: ReadonlySet<string> = new Set(),
  describe: AssetDescriber = noDescriptions,
  embeddingSource: MemoryRecallEmbeddingSource | null = null,
): Promise<string[] | null> {
  if (names.length <= 1 || !query.trim()) return null;
  const texts = names.map((name) => semanticAssetText(name, describe(name)));
  let embedded: { queryVector: number[]; vectors: number[][] } | null = null;
  if (embeddingSource) {
    try {
      embedded = await embedWithSource(embeddingSource, query, texts);
    } catch (err) {
      logger.debug(err, "[custom-emoji] Embeddings default failed; using the bundled embedder");
    }
  }
  if (!embedded && !isLocalEmbedderAvailable()) return null;
  try {
    if (!embedded) {
      const vectors = await localEmbed([query, ...texts]);
      if (!vectors || vectors.length !== names.length + 1) return null;
      embedded = { queryVector: vectors[0]!, vectors: vectors.slice(1) };
    }
    const { queryVector, vectors } = embedded;
    return names
      .map((name, index) => ({
        name,
        score: cosineSimilarity(queryVector, vectors[index]!) + (boosted.has(name) ? OWN_ASSET_SEMANTIC_BOOST : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.name);
  } catch (err) {
    logger.debug(err, "[custom-emoji] semantic ranking failed; falling back to random");
    return null;
  }
}

/** Added to a character's own emoji or sticker score, so it wins a close call against a shared one. */
const OWN_ASSET_SEMANTIC_BOOST = 0.05;

/**
 * One responder, semantic mode: rank its own and the shared names as one pool (own ones slightly boosted), so the
 * offered list runs from best to worst fit. Null when the embedder is unavailable; the caller keeps own-first order.
 */
export async function rankCombinedAssetNames(
  ownNames: string[],
  sharedNames: string[],
  query: string,
  describe: AssetDescriber = noDescriptions,
  embeddingSource: MemoryRecallEmbeddingSource | null = null,
): Promise<string[] | null> {
  const pool = uniqueEmojiNames([...ownNames, ...sharedNames]);
  if (pool.length <= 1) return pool;
  return rankEmojiNamesBySemantic(pool, query, new Set(ownNames), describe, embeddingSource);
}

/** The names an advertisement offers, in its order (mirrors buildCustomEmojiAdvertisement's capping). */
export function listAdvertisedAssetNames(
  responders: { charId: string }[],
  orderedGlobal: string[],
  orderedOwnByChar: Map<string, string[]>,
  maxCount: number,
): string[] {
  if (responders.length === 1) {
    const merged = [...(orderedOwnByChar.get(responders[0]!.charId) ?? [])];
    for (const name of orderedGlobal) {
      if (merged.length >= maxCount) break;
      if (!merged.includes(name)) merged.push(name);
    }
    return merged.slice(0, maxCount);
  }
  const names = orderedGlobal.slice(0, maxCount);
  for (const responder of responders) {
    for (const name of (orderedOwnByChar.get(responder.charId) ?? []).slice(0, maxCount)) {
      if (!names.includes(name)) names.push(name);
    }
  }
  return names;
}

const CUSTOM_EMOJIS_ROOT = join(DATA_DIR, "custom-emojis");
const CUSTOM_STICKERS_ROOT = join(DATA_DIR, "custom-stickers");

function galleryAssetPath(filePath: unknown): string | null {
  return typeof filePath === "string" ? (resolveStoredGalleryFile(filePath)?.absolutePath ?? null) : null;
}

/** Order a pool of emoji names per the selection mode (does NOT cap; the formatter slices to maxCount). */
export async function orderEmojiNames(
  names: string[],
  prefs: CustomEmojiSelectionPrefs,
  query: string,
  describe: AssetDescriber = noDescriptions,
  embeddingSource: MemoryRecallEmbeddingSource | null = null,
): Promise<string[]> {
  if (names.length <= 1) return names;
  // Reached for random/semantic, and as the tool-call fallback path: rank semantically when possible.
  if (prefs.mode === "semantic" || prefs.mode === "tool-call") {
    const ranked = await rankEmojiNamesBySemantic(names, query, new Set(), describe, embeddingSource);
    if (ranked) return ranked;
  }
  return shuffleInPlace([...names]);
}

/**
 * Tool-call selection: one short auxiliary completion (on the chosen connection)
 * picks which candidate asset names fit the latest message. Returns the validated
 * picks (<= maxCount), or null on any failure so the caller can fall back to
 * semantic/random. Never throws: generation must not depend on it.
 */
export async function selectCustomAssetNamesByToolCall(
  assetLabel: string,
  tokenExample: string,
  candidates: string[],
  query: string,
  connectionId: string,
  connections: ReturnType<typeof createConnectionsStorage>,
  maxCount: number,
  describe: AssetDescriber = noDescriptions,
): Promise<string[] | null> {
  if (candidates.length === 0 || !query.trim()) return null;
  const described = candidates.some((name) => describe(name));
  const candidateList = described
    ? `\n${candidates.map((name) => (describe(name) ? `- ${name}: ${describe(name)}` : `- ${name}`)).join("\n")}`
    : ` ${candidates.join(", ")}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("custom-emoji tool-call timeout")), 5000);
  try {
    const conn = await connections.getWithKey(connectionId);
    if (!conn || (!conn.model && !allowsDefaultChatModel(conn))) return null;
    const fallbackConnection = await connections.getFallbackForAgents();
    const provider = withConnectionFallbackProvider({
      primary: createLLMProvider(
        conn.provider,
        resolveBaseUrl(conn),
        conn.apiKey,
        conn.maxContext,
        conn.openrouterProvider,
        conn.maxTokensOverride,
        conn.claudeFastMode === "true",
        conn.treatAsLocalEndpoint === "true",
        conn.defaultParameters,
      ),
      primaryConnectionId: conn.id,
      fallbackConnection,
      fallbackBaseUrl: fallbackConnection ? resolveBaseUrl(fallbackConnection) : "",
      category: "agents",
    });
    const result = await provider.chatComplete(
      [
        {
          role: "system",
          content:
            `You select which custom ${assetLabel}s fit the current moment in a chat. You receive a list of available ${assetLabel} names and the latest message. ` +
            `Reply with ONLY a comma-separated list of at most ${maxCount} names taken verbatim from the list (most fitting first), or "none". No other text. Do not include ${tokenExample} syntax.`,
        },
        {
          role: "user",
          content: `Available custom ${assetLabel}s:${candidateList}\n\nLatest message: "${query}"\n\nFitting ${assetLabel} names:`,
        },
      ],
      { model: conn.model, temperature: 0.3, maxTokens: 200, signal: controller.signal },
    );
    const text = (result.content ?? "").toLowerCase().trim();
    if (text.replace(/[^a-z0-9_]/g, "") === "none") return [];
    const candidateSet = new Set(candidates);
    const picked: string[] = [];
    for (const token of text.split(/[\s,]+/)) {
      const name = token.replace(/[^a-z0-9_]/g, "");
      if (name && candidateSet.has(name) && !picked.includes(name)) {
        picked.push(name);
        if (picked.length >= maxCount) break;
      }
    }
    return picked.length > 0 ? picked : null;
  } catch (err) {
    logger.debug(err, "[custom-%s] tool-call selection failed; falling back to semantic/random", assetLabel);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Order the shared and own pools for an advertisement. With one responder in semantic mode (or tool-call falling
 * back to it), own and shared names are ranked together, so the list runs best fit first across both.
 */
async function orderAdvertisedPools(
  responders: { charId: string }[],
  sharedNames: string[],
  ownByChar: Map<string, string[]>,
  prefs: CustomEmojiSelectionPrefs,
  query: string,
  describe: AssetDescriber,
  embeddingSource: MemoryRecallEmbeddingSource | null,
): Promise<{ orderedShared: string[]; orderedOwnByChar: Map<string, string[]> }> {
  if (responders.length === 1 && (prefs.mode === "semantic" || prefs.mode === "tool-call")) {
    const charId = responders[0]!.charId;
    const combined = await rankCombinedAssetNames(
      ownByChar.get(charId) ?? [],
      sharedNames,
      query,
      describe,
      embeddingSource,
    );
    if (combined) return { orderedShared: [], orderedOwnByChar: new Map([[charId, combined]]) };
  }
  const orderedShared = await orderEmojiNames(sharedNames, prefs, query, describe, embeddingSource);
  const orderedOwnByChar = new Map<string, string[]>();
  for (const [charId, names] of ownByChar) {
    orderedOwnByChar.set(charId, await orderEmojiNames(names, prefs, query, describe, embeddingSource));
  }
  return { orderedShared, orderedOwnByChar };
}

export function uniqueEmojiNames(names: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = typeof raw === "string" ? raw.trim() : "";
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}

export async function appendConversationCustomAssetAdvertisements(args: {
  chatMode: string;
  mentionedCharacterNames: string[] | undefined;
  promptTargetCharacterId: string | null | undefined;
  charInfo: ConversationAssetCharacter[];
  personaId: string | null | undefined;
  chatMeta: Record<string, unknown>;
  finalMessages: GenerationPromptMessage[];
  currentUserInputContent: () => string | undefined;
  customEmojisStore: ConversationCustomAssetStore;
  customStickersStore: ConversationCustomAssetStore;
  personaGallery: Required<Pick<GalleryAssetStore, "listByPersonaId">>;
  characterGallery: Required<Pick<GalleryAssetStore, "listByCharacterId">>;
  connections: ReturnType<typeof createConnectionsStorage>;
  conversationCustomEmojiUrlByName: Map<string, string>;
  /**
   * When set, the preset contains a {{replyRules}} macro: render the emoji/sticker
   * reply advertisements at that macro instead of appending them automatically
   * (parity with {{reactRules}}). Receives the combined block (empty string when
   * there are no advertisements, so the macro token is still stripped). #3438
   */
  replyRulesMacroPlacement?: (content: string) => void;
  /** Filled with every visible emoji and sticker file and the offered names, for the emoji vision sheet. */
  visionCatalog?: ConversationAssetVisionCatalog;
  /** The chat's Embeddings source (the app-wide default unless the chat picks one); semantic picks rank with it. */
  embeddingSource?: MemoryRecallEmbeddingSource | null;
}): Promise<void> {
  if (args.chatMode !== "conversation") return;

  const mentionedNames = new Set(
    (args.mentionedCharacterNames ?? [])
      .map((name: string) => normalizeTextForMatch(name))
      .filter((name: string) => name.length > 0),
  );
  const scopedResponders = args.promptTargetCharacterId
    ? args.charInfo.filter((character) => character.id === args.promptTargetCharacterId)
    : mentionedNames.size > 0
      ? args.charInfo.filter((character) => mentionedNames.has(normalizeTextForMatch(character.name)))
      : args.charInfo;
  const respondingConversationChars = (scopedResponders.length > 0 ? scopedResponders : args.charInfo).map(
    (character) => ({
      charId: character.id,
      name: character.name,
    }),
  );

  const [globalEmojiRows, globalStickerRows, personaAssetRows] = await Promise.all([
    args.customEmojisStore.list(),
    args.customStickersStore.list(),
    args.personaId ? args.personaGallery.listByPersonaId(args.personaId) : Promise.resolve([]),
  ]);
  for (const emoji of globalEmojiRows) {
    if (emoji.name && emoji.filePath) {
      args.conversationCustomEmojiUrlByName.set(
        buildConversationCustomEmojiKey("global", null, String(emoji.name)),
        buildGlobalCustomEmojiUrl(String(emoji.filePath)),
      );
    }
  }
  if (args.personaId) {
    for (const img of personaAssetRows) {
      if (img.customKind === "emoji" && img.customName && img.filePath) {
        args.conversationCustomEmojiUrlByName.set(
          buildConversationCustomEmojiKey("persona", args.personaId, String(img.customName)),
          buildPersonaGalleryEmojiUrl(args.personaId, getStoredFilename(String(img.filePath))),
        );
      }
    }
  }
  const personaEmojiNames = uniqueEmojiNames(
    personaAssetRows
      .filter((img) => img.customKind === "emoji" && img.customName)
      .map((img) => img.customName as string),
  );
  const personaStickerNames = uniqueEmojiNames(
    personaAssetRows
      .filter((img) => img.customKind === "sticker" && img.customName)
      .map((img) => img.customName as string),
  );
  const sharedEmojiNames = uniqueEmojiNames([
    ...personaEmojiNames,
    ...globalEmojiRows.map((emoji) => emoji.name as string),
  ]);
  const sharedStickerNames = uniqueEmojiNames([
    ...personaStickerNames,
    ...globalStickerRows.map((sticker) => sticker.name as string),
  ]);
  const ownEmojisByChar = new Map<string, string[]>();
  const ownStickersByChar = new Map<string, string[]>();
  const vision = args.visionCatalog;
  const characterAssetRowsById = new Map<string, GalleryAssetRow[]>();
  for (const info of respondingConversationChars) {
    const images = await args.characterGallery.listByCharacterId(info.charId);
    characterAssetRowsById.set(info.charId, images);
    if (vision) {
      for (const img of images) {
        if (!img.customName || (img.customKind !== "emoji" && img.customKind !== "sticker")) continue;
        recordVisionAssetPath(
          img.customKind === "emoji" ? vision.emojiPaths : vision.stickerPaths,
          String(img.customName),
          galleryAssetPath(img.filePath),
        );
      }
    }
    const emojiNames = uniqueEmojiNames(
      images.filter((img) => img.customKind === "emoji" && img.customName).map((img) => img.customName as string),
    );
    for (const img of images) {
      if (img.customKind === "emoji" && img.customName && img.filePath) {
        args.conversationCustomEmojiUrlByName.set(
          buildConversationCustomEmojiKey("character", info.charId, String(img.customName)),
          buildCharacterGalleryEmojiUrl(info.charId, getStoredFilename(String(img.filePath))),
        );
      }
    }
    const stickerNames = uniqueEmojiNames(
      images.filter((img) => img.customKind === "sticker" && img.customName).map((img) => img.customName as string),
    );
    if (emojiNames.length > 0) ownEmojisByChar.set(info.charId, emojiNames);
    if (stickerNames.length > 0) ownStickersByChar.set(info.charId, stickerNames);
  }

  if (vision) {
    for (const img of personaAssetRows) {
      if (!img.customName || (img.customKind !== "emoji" && img.customKind !== "sticker")) continue;
      recordVisionAssetPath(
        img.customKind === "emoji" ? vision.emojiPaths : vision.stickerPaths,
        String(img.customName),
        galleryAssetPath(img.filePath),
      );
    }
    for (const emoji of globalEmojiRows) {
      if (emoji.name) {
        recordVisionAssetPath(
          vision.emojiPaths,
          String(emoji.name),
          resolveFlatMediaFile(CUSTOM_EMOJIS_ROOT, emoji.filePath),
        );
      }
    }
    for (const sticker of globalStickerRows) {
      if (sticker.name) {
        recordVisionAssetPath(
          vision.stickerPaths,
          String(sticker.name),
          resolveFlatMediaFile(CUSTOM_STICKERS_ROOT, sticker.filePath),
        );
      }
    }
  }

  // Descriptions, first one per name: the responders' own, then the persona's, then global.
  const selectionPrefs = normalizeCustomEmojiSelection(args.chatMeta.customEmojiSelection);
  const emojiDescriptions = new Map<string, string>();
  const stickerDescriptions = new Map<string, string>();
  if (selectionPrefs.useDescriptions) {
    for (const rows of [...characterAssetRowsById.values(), personaAssetRows]) {
      for (const img of rows) {
        if (img.customKind === "emoji") recordAssetDescription(emojiDescriptions, img.customName, img.description);
        if (img.customKind === "sticker") recordAssetDescription(stickerDescriptions, img.customName, img.description);
      }
    }
    for (const emoji of globalEmojiRows) recordAssetDescription(emojiDescriptions, emoji.name, emoji.description);
    for (const sticker of globalStickerRows) {
      recordAssetDescription(stickerDescriptions, sticker.name, sticker.description);
    }
  }
  const describeEmoji: AssetDescriber = (name) => emojiDescriptions.get(name);
  const describeSticker: AssetDescriber = (name) => stickerDescriptions.get(name);
  // Ranking and the tool-call picker always use them; the prompt shows them only when asked, since each costs tokens.
  const showEmoji: AssetDescriber = selectionPrefs.showDescriptions ? describeEmoji : noDescriptions;
  const showSticker: AssetDescriber = selectionPrefs.showDescriptions ? describeSticker : noDescriptions;
  if (vision && selectionPrefs.showDescriptions) {
    vision.emojiDescriptions = emojiDescriptions;
    vision.stickerDescriptions = stickerDescriptions;
  }

  // A reaction written with a sticker's name (":hug:" for sticker:hug:) shows that sticker, unless an emoji owns it.
  const setStickerReactionUrl = (key: string, url: string) => {
    if (!args.conversationCustomEmojiUrlByName.has(key)) args.conversationCustomEmojiUrlByName.set(key, url);
  };
  const emojiNameSet = new Set<string>([
    ...globalEmojiRows.map((emoji) => String(emoji.name ?? "")),
    ...personaEmojiNames,
    ...[...ownEmojisByChar.values()].flat(),
  ]);
  for (const sticker of globalStickerRows) {
    if (sticker.name && sticker.filePath && !emojiNameSet.has(String(sticker.name))) {
      setStickerReactionUrl(
        buildConversationCustomEmojiKey("global", null, String(sticker.name)),
        buildGlobalCustomStickerUrl(String(sticker.filePath)),
      );
    }
  }
  if (args.personaId) {
    for (const img of personaAssetRows) {
      if (img.customKind === "sticker" && img.customName && img.filePath && !emojiNameSet.has(String(img.customName))) {
        setStickerReactionUrl(
          buildConversationCustomEmojiKey("persona", args.personaId, String(img.customName)),
          buildPersonaGalleryEmojiUrl(args.personaId, getStoredFilename(String(img.filePath))),
        );
      }
    }
  }
  for (const [charId, rows] of characterAssetRowsById) {
    for (const img of rows) {
      if (img.customKind === "sticker" && img.customName && img.filePath && !emojiNameSet.has(String(img.customName))) {
        setStickerReactionUrl(
          buildConversationCustomEmojiKey("character", charId, String(img.customName)),
          buildCharacterGalleryEmojiUrl(charId, getStoredFilename(String(img.filePath))),
        );
      }
    }
  }

  const assetQuery = latestHistoryUserContent(args.finalMessages) || args.currentUserInputContent() || "";

  // Built below, then either placed at a {{replyRules}} macro (parity with
  // {{reactRules}}) or appended to the first system message (#3438).
  let emojiAdvertisement: string | null = null;
  let stickerAdvertisement: string | null = null;

  if (sharedEmojiNames.length > 0 || ownEmojisByChar.size > 0) {
    const emojiPrefs = normalizeCustomEmojiSelection(args.chatMeta.customEmojiSelection);
    let toolSelectionHandled = false;

    if (emojiPrefs.mode === "tool-call" && emojiPrefs.toolConnectionId && respondingConversationChars.length === 1) {
      const responder = respondingConversationChars[0]!;
      const candidates = uniqueEmojiNames([...(ownEmojisByChar.get(responder.charId) ?? []), ...sharedEmojiNames]);
      const picked = await selectCustomAssetNamesByToolCall(
        "emoji",
        ":name:",
        candidates,
        assetQuery,
        emojiPrefs.toolConnectionId,
        args.connections,
        emojiPrefs.maxCount,
        describeEmoji,
      );
      if (picked !== null) {
        toolSelectionHandled = true;
        if (picked.length > 0) {
          emojiAdvertisement = buildCustomEmojiAdvertisement(
            respondingConversationChars,
            [],
            new Map([[responder.charId, picked]]),
            emojiPrefs.maxCount,
            showEmoji,
          );
          if (vision) vision.offeredEmojis = picked.slice(0, emojiPrefs.maxCount);
        }
      }
    }

    if (!toolSelectionHandled && !emojiAdvertisement) {
      const { orderedShared, orderedOwnByChar } = await orderAdvertisedPools(
        respondingConversationChars,
        sharedEmojiNames,
        ownEmojisByChar,
        emojiPrefs,
        assetQuery,
        describeEmoji,
        args.embeddingSource ?? null,
      );
      emojiAdvertisement = buildCustomEmojiAdvertisement(
        respondingConversationChars,
        orderedShared,
        orderedOwnByChar,
        emojiPrefs.maxCount,
        showEmoji,
      );
      if (vision) {
        vision.offeredEmojis = listAdvertisedAssetNames(
          respondingConversationChars,
          orderedShared,
          orderedOwnByChar,
          emojiPrefs.maxCount,
        );
      }
    }
  }

  if (sharedStickerNames.length > 0 || ownStickersByChar.size > 0) {
    const stickerPrefs = normalizeCustomEmojiSelection(args.chatMeta.customEmojiSelection);
    let toolSelectionHandled = false;

    if (
      stickerPrefs.mode === "tool-call" &&
      stickerPrefs.toolConnectionId &&
      respondingConversationChars.length === 1
    ) {
      const responder = respondingConversationChars[0]!;
      const candidates = uniqueEmojiNames([...(ownStickersByChar.get(responder.charId) ?? []), ...sharedStickerNames]);
      const picked = await selectCustomAssetNamesByToolCall(
        "sticker",
        "sticker:name:",
        candidates,
        assetQuery,
        stickerPrefs.toolConnectionId,
        args.connections,
        stickerPrefs.maxCount,
        describeSticker,
      );
      if (picked !== null) {
        toolSelectionHandled = true;
        if (picked.length > 0) {
          stickerAdvertisement = buildCustomStickerAdvertisement(
            respondingConversationChars,
            [],
            new Map([[responder.charId, picked]]),
            stickerPrefs.maxCount,
            showSticker,
          );
          if (vision) vision.offeredStickers = picked.slice(0, stickerPrefs.maxCount);
        }
      }
    }

    if (!toolSelectionHandled && !stickerAdvertisement) {
      const { orderedShared, orderedOwnByChar } = await orderAdvertisedPools(
        respondingConversationChars,
        sharedStickerNames,
        ownStickersByChar,
        stickerPrefs,
        assetQuery,
        describeSticker,
        args.embeddingSource ?? null,
      );
      stickerAdvertisement = buildCustomStickerAdvertisement(
        respondingConversationChars,
        orderedShared,
        orderedOwnByChar,
        stickerPrefs.maxCount,
        showSticker,
      );
      if (vision) {
        vision.offeredStickers = listAdvertisedAssetNames(
          respondingConversationChars,
          orderedShared,
          orderedOwnByChar,
          stickerPrefs.maxCount,
        );
      }
    }
  }

  // When the preset places a {{replyRules}} macro, render the emoji/sticker reply
  // advertisements there (suppressing the automatic append) — mirroring how
  // {{reactRules}} relocates the react-rules block (#3438). Otherwise keep the
  // historical behavior: append each advertisement to the first system message,
  // emoji then sticker.
  if (args.replyRulesMacroPlacement) {
    args.replyRulesMacroPlacement([emojiAdvertisement, stickerAdvertisement].filter(Boolean).join("\n\n"));
  } else {
    if (emojiAdvertisement) appendToFirstSystemMessage(args.finalMessages, emojiAdvertisement);
    if (stickerAdvertisement) appendToFirstSystemMessage(args.finalMessages, stickerAdvertisement);
  }
}

/**
 * The offered tokens after a label's colon: on one line when none has a description, else one per line with its
 * description, so the model knows what each shows.
 */
export function listAssetTokens(names: string[], token: (name: string) => string, describe: AssetDescriber): string {
  if (!names.some((name) => describe(name))) return ` ${names.map(token).join(" ")}`;
  return names
    .map((name) => {
      const description = describe(name);
      return description ? `\n- ${token(name)} (${description})` : `\n- ${token(name)}`;
    })
    .join("");
}

/**
 * Build the Conversation-mode system-prompt block that tells the responding
 * character(s) which custom emojis they may use (`:name:`).
 */
export function buildCustomEmojiAdvertisement(
  responders: { charId: string; name: string }[],
  orderedGlobal: string[],
  orderedOwnByChar: Map<string, string[]>,
  maxCount: number,
  describe: AssetDescriber = noDescriptions,
): string | null {
  const toTokens = (names: string[]) => listAssetTokens(names, (name) => `:${name}:`, describe);
  const lead =
    "You can use custom emojis in your reply by writing their name between colons, e.g. :name: — they render as small inline images. Use them only where they fit naturally; do not overuse them.";

  if (responders.length === 1) {
    const merged = [...(orderedOwnByChar.get(responders[0]!.charId) ?? [])];
    for (const name of orderedGlobal) {
      if (merged.length >= maxCount) break;
      if (!merged.includes(name)) merged.push(name);
    }
    const capped = merged.slice(0, maxCount);
    if (capped.length === 0) return null;
    return `${lead}\nBeyond the full standard emoji set, you may use these custom emojis:${toTokens(capped)}`;
  }

  const lines: string[] = [];
  const global = orderedGlobal.slice(0, maxCount);
  if (global.length > 0) lines.push(`Available to everyone:${toTokens(global)}`);
  for (const responder of responders) {
    const own = (orderedOwnByChar.get(responder.charId) ?? []).slice(0, maxCount);
    if (own.length > 0) lines.push(`${responder.name} also has:${toTokens(own)}`);
  }
  if (lines.length === 0) return null;
  return `${lead}\nBeyond the full standard emoji set, these custom emojis are available (use by typing :name:):\n${lines.join("\n")}`;
}

/**
 * Build the Conversation-mode system-prompt block telling the responding
 * character(s) which custom stickers they may send (`sticker:name:`, a block image).
 */
export function buildCustomStickerAdvertisement(
  responders: { charId: string; name: string }[],
  orderedGlobal: string[],
  orderedOwnByChar: Map<string, string[]>,
  maxCount: number,
  describe: AssetDescriber = noDescriptions,
): string | null {
  const toTokens = (names: string[]) => listAssetTokens(names, (name) => `sticker:${name}:`, describe);
  const lead =
    "You can send a sticker by writing its name as sticker:name: — it posts as a large block image on its own line. Send one only when it genuinely fits the moment, not in every message.";

  if (responders.length === 1) {
    const merged = [...(orderedOwnByChar.get(responders[0]!.charId) ?? [])];
    for (const name of orderedGlobal) {
      if (merged.length >= maxCount) break;
      if (!merged.includes(name)) merged.push(name);
    }
    const capped = merged.slice(0, maxCount);
    if (capped.length === 0) return null;
    return `${lead}\nAvailable stickers:${toTokens(capped)}`;
  }

  const lines: string[] = [];
  const global = orderedGlobal.slice(0, maxCount);
  if (global.length > 0) lines.push(`Available to everyone:${toTokens(global)}`);
  for (const responder of responders) {
    const own = (orderedOwnByChar.get(responder.charId) ?? []).slice(0, maxCount);
    if (own.length > 0) lines.push(`${responder.name} also has:${toTokens(own)}`);
  }
  if (lines.length === 0) return null;
  return `${lead}\nAvailable stickers (send by writing sticker:name:):\n${lines.join("\n")}`;
}

/** Single-line excerpt of a grouped segment's text for reaction attribution. */
function excerptSegmentText(lines: string[]): string {
  const text = lines.join(" ").replace(/\s+/g, " ").trim();
  const MAX = 80;
  const chars = Array.from(text);
  if (chars.length <= MAX) return text;
  return `${chars.slice(0, MAX).join("").trimEnd()}…`;
}

export const REACTION_ANNOTATION_CONTENT_CAP = 32_000;

function isAttributableGroup(group: GroupedSegment): boolean {
  return group.speaker != null && group.lines.some((line) => line.trim().length > 0);
}

/**
 * Annotate a prompt message with its reactions and return the new content.
 */
export function annotateContentWithReactions(
  promptContent: string,
  clientShapeContent: string,
  reactions: unknown,
  knownSpeakersByNorm: Map<string, string>,
  resolveReactorName: (reactorId: string) => string,
  leadingSpeaker?: string | null,
): string {
  if (!Array.isArray(reactions) || reactions.length === 0) return promptContent;
  const knownNames = new Set(knownSpeakersByNorm.keys());
  const clientGroups: GroupedSegment[] | null =
    clientShapeContent.length <= REACTION_ANNOTATION_CONTENT_CAP
      ? parseGroupedSpeakerSegments(clientShapeContent, knownNames, leadingSpeaker)
      : null;
  const promptGroups: GroupedSegment[] | null =
    promptContent.length <= REACTION_ANNOTATION_CONTENT_CAP
      ? parseGroupedSpeakerSegments(promptContent, knownNames, leadingSpeaker)
      : null;

  const promptGroupFor = (clientIndex: number): GroupedSegment | null => {
    if (!clientGroups || !promptGroups) return null;
    const target = clientGroups[clientIndex]!;
    const norm = normalizeTextForMatch(target.speaker!);
    const marker =
      target.lines
        .flatMap((chunk) => chunk.split("\n"))
        .map((line) => line.trim())
        .find((line) => line.length > 0) ?? "";
    if (!marker) return null;
    const sameSpeaker = promptGroups.filter(
      (g) => isAttributableGroup(g) && normalizeTextForMatch(g.speaker!) === norm,
    );
    if (sameSpeaker.length === 0) return null;
    let ordinal = 0;
    for (let i = 0; i < clientIndex; i++) {
      const g = clientGroups[i]!;
      if (isAttributableGroup(g) && normalizeTextForMatch(g.speaker!) === norm) ordinal++;
    }
    const hasMarkerLine = (g: GroupedSegment) =>
      g.lines.some((chunk) => chunk.split("\n").some((line) => line.trim() === marker));
    const ordinalPick = sameSpeaker[ordinal];
    if (ordinalPick && hasMarkerLine(ordinalPick)) return ordinalPick;
    let best: GroupedSegment | null = null;
    let bestDistance = Infinity;
    for (let ci = 0; ci < sameSpeaker.length; ci++) {
      const candidate = sameSpeaker[ci]!;
      if (!hasMarkerLine(candidate)) continue;
      const distance = Math.abs(ci - ordinal);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    return best;
  };

  type ResolvedNote =
    | { kind: "inline"; phrase: string; speakerNorm: string; group: GroupedSegment }
    | { kind: "end"; phrase: string; speakerNorm: string | null; text: string; staleTwinShape: boolean };
  const notes: ResolvedNote[] = [];
  for (const entry of reactions as Array<{
    emoji?: unknown;
    by?: unknown;
    segment?: unknown;
    segmentSpeaker?: unknown;
  }>) {
    const emoji = typeof entry.emoji === "string" ? entry.emoji : null;
    const reactors = Array.isArray(entry.by) ? entry.by.filter((id): id is string => typeof id === "string") : [];
    if (!emoji || reactors.length === 0) continue;
    const names = reactors.map(resolveReactorName);
    const who =
      names.length === 1
        ? names[0]!
        : names.length === 2
          ? `${names[0]} and ${names[1]}`
          : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    const phrase = `${who} reacted with ${emoji}`;

    const storedSpeaker =
      typeof entry.segmentSpeaker === "string" && entry.segmentSpeaker.trim() ? entry.segmentSpeaker : null;
    const wanted = storedSpeaker !== null ? normalizeTextForMatch(storedSpeaker) : null;
    const segIdx = typeof entry.segment === "number" && Number.isInteger(entry.segment) ? entry.segment : null;
    const seg =
      clientGroups && segIdx !== null && segIdx >= 0 && segIdx < clientGroups.length ? clientGroups[segIdx] : undefined;
    const segSpeakerNorm = seg?.speaker != null ? normalizeTextForMatch(seg.speaker) : null;
    const segAligned =
      seg !== undefined &&
      segSpeakerNorm !== null &&
      (wanted === null || segSpeakerNorm === wanted) &&
      isAttributableGroup(seg);

    if (segAligned) {
      const promptGroup = promptGroupFor(segIdx!);
      if (promptGroup) {
        notes.push({ kind: "inline", phrase, speakerNorm: segSpeakerNorm!, group: promptGroup });
        continue;
      }
      const canonical = knownSpeakersByNorm.get(segSpeakerNorm!);
      if (canonical) {
        notes.push({
          kind: "end",
          phrase,
          speakerNorm: segSpeakerNorm!,
          text: `${phrase} to ${canonical}'s part ("${excerptSegmentText(seg!.lines)}")`,
          staleTwinShape: false,
        });
        continue;
      }
    } else if (wanted !== null && clientGroups) {
      const speakerGroup = clientGroups.find(
        (g) => isAttributableGroup(g) && normalizeTextForMatch(g.speaker!) === wanted,
      );
      const canonical = speakerGroup ? knownSpeakersByNorm.get(wanted) : undefined;
      if (canonical) {
        notes.push({
          kind: "end",
          phrase,
          speakerNorm: wanted,
          text: `${phrase} to ${canonical}'s part`,
          staleTwinShape: true,
        });
        continue;
      }
    }
    notes.push({ kind: "end", phrase, speakerNorm: null, text: phrase, staleTwinShape: false });
  }

  const inlineByGroup = new Map<GroupedSegment, string[]>();
  const inlineKeys = new Set<string>();
  for (const note of notes) {
    if (note.kind !== "inline") continue;
    const lines = inlineByGroup.get(note.group) ?? [];
    if (!lines.includes(note.phrase)) lines.push(note.phrase);
    inlineByGroup.set(note.group, lines);
    inlineKeys.add(`${note.phrase}\u0000${note.speakerNorm}`);
  }
  const endParts: string[] = [];
  for (const note of notes) {
    if (note.kind !== "end") continue;
    if (note.staleTwinShape && note.speakerNorm !== null && inlineKeys.has(`${note.phrase}\u0000${note.speakerNorm}`)) {
      continue;
    }
    endParts.push(note.text);
  }

  let annotated = promptContent;
  const injections = [...inlineByGroup.entries()].sort((a, b) => b[0].end - a[0].end);
  for (const [group, lines] of injections) {
    const nextChar = annotated.charAt(group.end);
    const trailingBreak = nextChar && nextChar !== "\n" && nextChar !== "\r" ? "\n" : "";
    annotated = `${annotated.slice(0, group.end)}\n[${lines.join(", ")}]${trailingBreak}${annotated.slice(group.end)}`;
  }
  const uniqueEndParts = [...new Set(endParts)];
  if (uniqueEndParts.length > 0) annotated += `\n[${uniqueEndParts.join("; ")}]`;
  return annotated;
}

export function addMessageReactor(
  reactions: unknown,
  emoji: string,
  reactor: string,
  imageUrl: string | null,
  target?: { segment: number; speaker: string | null } | null,
): MessageReaction[] {
  const current = Array.isArray(reactions) ? (reactions as MessageReaction[]) : [];
  const targetSegment = target?.segment ?? null;
  const targetSpeakerNorm = target?.speaker != null ? normalizeTextForMatch(target.speaker) : null;
  const index = current.findIndex((r) => {
    if (r.emoji !== emoji) return false;
    if ((r.segment ?? null) !== targetSegment) return false;
    if (targetSegment === null) return true;
    if (r.segmentSpeaker === undefined) return true;
    return (r.segmentSpeaker != null ? normalizeTextForMatch(r.segmentSpeaker) : null) === targetSpeakerNorm;
  });
  if (index === -1) {
    const entry: MessageReaction = { emoji, by: [reactor] };
    if (imageUrl) entry.imageUrl = imageUrl;
    if (target) {
      entry.segment = target.segment;
      entry.segmentSpeaker = target.speaker ?? null;
    }
    return [...current, entry];
  }
  const entry = current[index]!;
  if (entry.by.includes(reactor)) return current;
  const next = [...current];
  next[index] = { ...entry, by: [...entry.by, reactor], ...(imageUrl && !entry.imageUrl ? { imageUrl } : {}) };
  return next;
}

export function buildGlobalCustomStickerUrl(filePath: string): string {
  return `/api/custom-stickers/file/${encodeURIComponent(filePath)}`;
}

export function buildGlobalCustomEmojiUrl(filePath: string): string {
  return `/api/custom-emojis/file/${encodeURIComponent(filePath)}`;
}

export function buildConversationCustomEmojiKey(
  scope: "global" | "persona" | "character",
  scopeId: string | null,
  name: string,
): string {
  return scopeId ? `${scope}:${scopeId}:${name}` : `${scope}:${name}`;
}

export function getStoredFilename(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}

export function buildCharacterGalleryEmojiUrl(characterId: string, filename: string): string {
  return `/api/characters/${encodeURIComponent(characterId)}/gallery/file/${encodeURIComponent(filename)}`;
}

export function buildPersonaGalleryEmojiUrl(personaId: string, filename: string): string {
  return `/api/characters/personas/${encodeURIComponent(personaId)}/gallery/file/${encodeURIComponent(filename)}`;
}
