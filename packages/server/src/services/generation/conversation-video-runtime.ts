import { readFileSync } from "node:fs";
import {
  extractLeadingThinkingBlocks,
  mergeBuiltInAgentSettings,
  normalizeVideoFirstFrame,
  parseAgentSettingsRecord,
  type GeneratedSceneVideo,
  type VideoReferenceImage,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { removeCopiedPromptGuidance } from "../image/image-prompt-compiler.js";
import { resolveGalleryImagePath } from "../image/gallery-image-path.js";
import {
  NAME_STOPWORDS,
  readPreferredCharacterReferenceImage,
  resolveIllustratorCharacterReferences,
  type IllustratorPersonaReference,
} from "../image/illustrator-references.js";
import { CONVERSATION_VIDEO, loadPrompt } from "../prompt-overrides/index.js";
import { createCharacterGalleryStorage } from "../storage/character-gallery.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createGalleryStorage } from "../storage/gallery.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import {
  ChatVideoError,
  generateAndSaveChatVideo,
  resolveChatVideoSetup,
  toVideoReferenceImage,
} from "../video/chat-video-generation.js";
import { excerptIllustrationPromptForVideo, formatRecentVideoContext } from "../video/prompt-context.js";
import { createAgentsStorage } from "../storage/agents.storage.js";
import { normalizeAgentContextSize } from "../agents/agent-executor.js";
import { resolveSceneVideoPrompt } from "../video/scene-video-prompt-review.js";
import { resolveBaseUrl } from "./connection-base-url.js";
import {
  handleConversationSelfieCommand,
  resolveConversationSelfieRequestedNames,
} from "./conversation-selfie-command-runtime.js";
import { appendVideoPromptInstructions } from "./image-prompt-instructions.js";
import { resolveIllustratorPromptRuntime, type IllustratorPromptConnection } from "./illustrator-prompt-runtime.js";

export interface ConversationVideoPreview {
  prompt: string;
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16";
  resolution: string | null;
  maxPromptLength: number | null;
  /** The selfie the clip starts from, when First frame makes one, so its prompt is reviewed too. */
  selfie: { prompt: string; negativePrompt: string; width: number; height: number } | null;
}

export interface ConversationVideoResult {
  video: GeneratedSceneVideo;
  characterName: string;
  /** What the clip started from. */
  firstFrame: "gallery" | "selfie" | "avatar" | "none";
}

const VIDEO_PROMPT_WRITER_MAX_TOKENS = 8_196;
const SELFIE_CONTEXT_MAX_CHARS = 2_000;
const PICTURE_PROMPT_MAX_CHARS = 1_500;
const UNCLOSED_THINKING_RE = /^<(?:think|thinking|reasoning)\b/iu;

type PromptCharacter = Parameters<typeof handleConversationSelfieCommand>[0]["charInfo"][number];
type ReadyFrame = {
  kind: ConversationVideoResult["firstFrame"];
  image: VideoReferenceImage | undefined;
  tag: string | null;
  path: string | null;
};
/** What a clip starts from, decided and checked before any paid call. A selfie is only taken after review. */
type FirstFramePlan =
  | (ReadyFrame & { kind: "gallery" | "avatar" | "none"; picturePrompt?: string })
  | { kind: "selfie"; avatarFallback: boolean };

/**
 * Whether this chat takes selfies: Generated Selfies on and a Selfie Connection set, the same test as the
 * Chat Settings drawer. With selfies off, the Selfie Connection is hidden there, so it must not be used here.
 */
export function conversationSelfiesAvailable(chatMeta: Record<string, unknown>): boolean {
  const toggles = parseRecord(chatMeta.conversationCommandToggles);
  return (
    chatMeta.characterCommands !== false &&
    toggles.selfie !== false &&
    typeof chatMeta.imageGenConnectionId === "string" &&
    chatMeta.imageGenConnectionId.trim().length > 0
  );
}

export async function generateConversationVideo(args: {
  db: DB;
  chatId: string;
  chatMeta: Record<string, unknown>;
  characterId: string;
  /** Every character in the chat, for the selfie first frame. */
  charInfo: PromptCharacter[];
  /** The chat's persona: a clip that names it is filed in the persona's gallery too. */
  persona?: IllustratorPersonaReference | null;
  /** The chat's own text connection (null for the built-in local model); the Prompt Model override wins. */
  promptConnection: IllustratorPromptConnection | null;
  promptConnectionId: string | null;
  context?: string | null;
  promptOverride?: string | null;
  /** A reviewed prompt for the selfie first frame. */
  selfiePromptOverride?: string | null;
  selfieNegativePromptOverride?: string | null;
  /** Animate this gallery image instead of using the chat's first-frame setting. */
  galleryImageId?: string | null;
  previewOnly?: boolean;
  queue?: boolean;
  debugMode?: boolean;
  serviceTier?: "flex" | "priority" | null;
  signal?: AbortSignal;
}): Promise<ConversationVideoPreview | ConversationVideoResult> {
  const debugOverrideEnabled = args.debugMode === true || isDebugAgentsEnabled();
  const connections = createConnectionsStorage(args.db);
  const characters = createCharactersStorage(args.db);
  const chats = createChatsStorage(args.db);

  const setup = await resolveChatVideoSetup(args.db, args.chatMeta);
  const { videoConn, runtime, durationSeconds, aspectRatio } = setup;

  const characterRow = await characters.getById(args.characterId, args.chatId);
  if (!characterRow) throw new ChatVideoError(404, "Character not found");
  const charData = parseRecord(characterRow.data);
  const extensions = parseRecord(charData.extensions);
  const characterName = typeof charData.name === "string" && charData.name.trim() ? charData.name.trim() : "character";

  // Settings and pictures are checked first, so a request that can't work fails before any paid call.
  const plan = await planFirstFrame({ ...args, characterName, avatarPath: characterRow.avatarPath ?? null });

  // A clip the user asks for (/video, the Gallery's Video button) has no context of its own: it reads the recent
  // conversation instead, as much of it as Illustrator reads for a picture (its Agent Budget). The video prompt and
  // a selfie first frame both use it, so the clip and its starting picture show the same moment.
  const names = new Map(args.charInfo.map((character) => [character.id, character.name]));
  const recent = args.context?.trim()
    ? ""
    : formatRecentVideoContext(await chats.listMessages(args.chatId), {
        count: await loadIllustratorContextSize(args.db),
        characterId: args.characterId,
        speaker: (message) =>
          message.role === "user"
            ? "User"
            : (names.get(typeof message.characterId === "string" ? message.characterId : "") ?? characterName),
      });
  // The selfie writer takes a short context; the end of the conversation is the moment the clip shows.
  const selfieContext =
    args.context?.trim() ||
    (recent ? `The latest moment of this conversation:\n${recent.slice(-SELFIE_CONTEXT_MAX_CHARS)}` : "");

  let prompt = args.promptOverride?.trim() ?? "";
  if (!prompt) {
    const promptRuntime = await resolveIllustratorPromptRuntime({
      chatMetadata: args.chatMeta,
      defaultConnection: args.promptConnection,
      defaultConnectionId: args.promptConnectionId,
      connections,
      resolveBaseUrl,
    });
    const appearance =
      (typeof extensions.appearance === "string" && extensions.appearance.trim()) ||
      (typeof charData.description === "string" ? charData.description.trim() : "");
    const system = await loadPrompt(createPromptOverridesStorage(args.db), CONVERSATION_VIDEO, {
      charName: characterName,
      appearance,
      personality: typeof charData.personality === "string" ? charData.personality.trim() : "",
      durationSeconds,
    });
    // An animated picture is the clip's first frame, so the writer continues that picture instead of a new scene.
    const picture = plan.kind === "gallery" && plan.picturePrompt ? plan.picturePrompt : "";
    const ownContext = args.context?.trim() ?? "";
    const parts = picture ? [`The clip starts from this picture:\n${picture}`] : [];
    if (ownContext) parts.push(`Context for the video message: ${ownContext}`);
    else if (recent) parts.push(`Recent conversation:\n${recent}`);
    if (picture) {
      parts.push(
        `Write a short video message from ${characterName} that brings this picture to life, continuing from it.`,
      );
    } else if (!ownContext) {
      parts.push(
        recent
          ? `Write a short video message from ${characterName} that shows the latest moment of this conversation.`
          : `Write a short video message from ${characterName} that fits the current conversation.`,
      );
    }
    const request = parts.join("\n\n");
    const user = appendVideoPromptInstructions(request, videoConn.videoPromptInstructions);
    logDebugOverride(debugOverrideEnabled, "[debug/conversation/video] prompt-builder system:\n%s", system);
    logDebugOverride(debugOverrideEnabled, "[debug/conversation/video] prompt-builder user:\n%s", user);
    const result = await promptRuntime.provider.chatComplete(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      {
        model: promptRuntime.model,
        ...(promptRuntime.suppressModelParameters
          ? {}
          : // Reasoning models spend part of this on thinking first; 1,200 left some with no answer at all.
            { temperature: 0.7, maxTokens: VIDEO_PROMPT_WRITER_MAX_TOKENS, serviceTier: args.serviceTier ?? null }),
        suppressModelParameters: promptRuntime.suppressModelParameters,
        signal: args.signal,
        enableCaching: promptRuntime.enableCaching,
        anthropicExtendedCacheTtl: promptRuntime.anthropicExtendedCacheTtl,
      },
    );
    // Some local models put their reasoning inline; an unclosed block means it never got to the answer.
    const answer = extractLeadingThinkingBlocks(result.content ?? "").content.trim();
    // A sentence of the connection's instructions the writer copied word for word is not video-model text.
    prompt = UNCLOSED_THINKING_RE.test(answer)
      ? ""
      : removeCopiedPromptGuidance(answer, [videoConn.videoPromptInstructions]);
    if (!prompt) {
      throw new ChatVideoError(
        502,
        result.finishReason === "length"
          ? "The Prompt Model used its whole response budget before writing the video prompt. Try a model that thinks less, or shorter Video Prompting Instructions."
          : "The Prompt Model returned an empty video prompt.",
      );
    }
  }
  // Matched once, from the writer's prompt; a reviewed prompt already carries the appearance lines.
  const shown = await resolveVideoCharacters({
    ...args,
    characterName,
    prompt,
    picturePrompt: plan.kind === "gallery" ? plan.picturePrompt : undefined,
  });
  if (!args.promptOverride?.trim() && args.chatMeta.selfieVideoIncludeCharacterAppearance === true) {
    if (shown.appearanceBlock) prompt = `${prompt}\n\n${shown.appearanceBlock}`;
  }
  prompt = resolveSceneVideoPrompt({
    generatedPrompt: prompt,
    promptOverride: args.promptOverride ?? undefined,
    maxPromptLength: runtime.promptLimits.finalPrompt,
  });
  logDebugOverride(debugOverrideEnabled, "[debug/conversation/video] final prompt:\n%s", prompt);

  const selfieArgs = { ...args, selfieContext };
  if (args.previewOnly) {
    // The selfie is reviewed with the clip, the same way /selfie is reviewed on its own.
    const selfie = plan.kind === "selfie" ? await previewSelfie(selfieArgs) : null;
    return {
      prompt,
      durationSeconds,
      aspectRatio,
      resolution: runtime.resolution ?? null,
      maxPromptLength: runtime.promptLimits.finalPrompt,
      selfie,
    };
  }

  const firstFrame: ReadyFrame =
    plan.kind !== "selfie"
      ? plan
      : await takeSelfieFrame(selfieArgs, plan.avatarFallback, () =>
          readAvatarFrame({ ...args, characterName, avatarPath: characterRow.avatarPath ?? null }),
        );
  const characterIds = shown.characterIds;

  const video = await generateAndSaveChatVideo(args.db, setup, {
    chatId: args.chatId,
    prompt,
    referenceImage: firstFrame.image,
    sourceTag: firstFrame.tag,
    sourcePath: firstFrame.path,
    characterIds,
    queue: args.queue,
    signal: args.signal,
    debugMode: args.debugMode,
  });
  logger.info("[conversation/video] %s sent video %s in chat %s", characterName, video.id, args.chatId);
  return { video, characterName, firstFrame: firstFrame.kind };
}

async function planFirstFrame(
  args: Parameters<typeof generateConversationVideo>[0] & { characterName: string; avatarPath: string | null },
): Promise<FirstFramePlan> {
  if (args.galleryImageId?.trim()) {
    const image = await createGalleryStorage(args.db).getById(args.galleryImageId.trim(), args.chatId);
    const path = image ? resolveGalleryImagePath(image) : null;
    if (!image || !path) throw new ChatVideoError(404, "Gallery image not found");
    return {
      kind: "gallery",
      image: await toVideoReferenceImage(readFileSync(path).toString("base64")),
      tag: `gallery:${image.id}`,
      path: `gallery/${image.filePath.replace(/\\/g, "/")}`,
      picturePrompt: excerptIllustrationPromptForVideo(image.prompt, PICTURE_PROMPT_MAX_CHARS),
    };
  }

  const mode = normalizeVideoFirstFrame(args.chatMeta.sceneVideoFirstFrame);
  if (mode === "prompt_only") {
    if (args.chatMeta.selfieVideoUseAvatarReferences !== true)
      return { kind: "none", image: undefined, tag: null, path: null };
    // With avatar references on for videos, a clip with no picture of its own starts from the avatar; without a
    // readable one it stays a prompt-only clip.
    return readAvatarFrame(args).catch(() => ({ kind: "none" as const, image: undefined, tag: null, path: null }));
  }
  const selfiesOn = conversationSelfiesAvailable(args.chatMeta);
  // Selfies off or no Selfie Connection is a setting to fix, not a failed request.
  if (mode === "picture" && !selfiesOn) {
    throw new ChatVideoError(
      400,
      "Turn on Generated Selfies and choose a Selfie Connection in Chat Settings, or pick another first frame.",
    );
  }
  if (mode === "picture" || (mode === "picture_or_avatar" && selfiesOn)) {
    return { kind: "selfie", avatarFallback: mode === "picture_or_avatar" };
  }
  return readAvatarFrame(args);
}

async function readAvatarFrame(
  args: Parameters<typeof generateConversationVideo>[0] & { characterName: string; avatarPath: string | null },
): Promise<ReadyFrame & { kind: "avatar" }> {
  const avatar = await readPreferredCharacterReferenceImage({
    characterId: args.characterId,
    avatarPath: args.avatarPath,
    characterGallery: createCharacterGalleryStorage(args.db),
  });
  const reference = avatar ? await toVideoReferenceImage(avatar.base64).catch(() => null) : null;
  if (!reference) {
    throw new ChatVideoError(
      400,
      `${args.characterName} needs a readable avatar or sprite to start a video from. Pick another first frame in Chat Settings.`,
    );
  }
  return { kind: "avatar", image: reference, tag: `avatar:${args.characterId}`, path: null };
}

/**
 * The characters a clip shows, by the same matching a selfie uses to file itself into character
 * galleries, and their appearance lines.
 */
async function resolveVideoCharacters(
  args: Parameters<typeof generateConversationVideo>[0] & {
    characterName: string;
    prompt: string;
    picturePrompt?: string;
  },
): Promise<{ characterIds: string[]; appearanceBlock: string | null }> {
  // What people say in the clip names no one it shows ("Hey Jamie!"), and an animated picture keeps its characters.
  const context = [args.context, args.picturePrompt].map((text) => withoutQuotedSpeech(text ?? "")).join("\n");
  const prompt = withoutQuotedSpeech(args.prompt);
  const mentioned = namesMentionedByPart(
    [context, prompt].join("\n"),
    [...args.charInfo, ...(args.persona ? [args.persona] : [])].map(({ id, name }) => ({ id, name })),
  );
  // The persona's appearance line joins only when the clip names them.
  const namedPersona = args.persona?.id && mentioned.has(args.persona.id) ? args.persona : null;
  const resolution = await resolveIllustratorCharacterReferences({
    charactersStore: createCharactersStorage(args.db),
    chatCharacters: args.charInfo.map((character) => ({
      id: character.id,
      name: character.name,
      avatarPath: character.avatarPath,
      appearance: character.appearance,
    })),
    persona: namedPersona,
    requestedNames: [
      ...resolveConversationSelfieRequestedNames({
        speakerName: args.characterName,
        chatCharacters: args.charInfo,
        commandContext: context,
        imagePrompt: prompt,
      }),
      ...args.charInfo.filter((character) => mentioned.has(character.id)).map((character) => character.name),
      ...(namedPersona ? [namedPersona.name] : []),
    ],
    // Names are matched above, by capitalised word, so a lowercase "rose" or "hazel" is not taken for a character.
    promptText: args.characterName,
    fallbackToChatCharacters: false,
    includeReferenceImages: false,
    maxReferences: 12,
  });
  // The persona is listed only when the clip names it, so it reaches the persona's gallery only when it is in it.
  const personaId = args.persona?.id && mentioned.has(args.persona.id) ? args.persona.id : null;
  return {
    characterIds: Array.from(
      new Set([args.characterId, ...resolution.characterIds, ...(personaId ? [personaId] : [])]),
    ),
    appearanceBlock: resolution.appearanceBlock,
  };
}

// Double quotes, curly quotes, guillemets and single quotes. A quote may wrap onto the next line but never crosses
// a blank line, so a stray quote mark (5'10") can't hide a whole paragraph of narration. A single quote opens only
// after a non-letter and closes only before one, so "Lena's" and "dogs'" are not quotes, while 'I'm here, Bob' is
// skipped whole.
const QUOTED_SPEECH_RE =
  /"(?:[^"\n]|\n(?!\s*\n))*"|\u201c(?:[^\u201d\n]|\n(?!\s*\n))*\u201d|\u00ab(?:[^\u00bb\n]|\n(?!\s*\n))*\u00bb|(?<![\p{L}\p{N}])['\u2018](?:[^'\u2018\u2019\n]|\n(?!\s*\n)|(?<=\p{L})['\u2019](?=\p{L}))*['\u2019](?![\p{L}\p{N}])/gu;

function withoutQuotedSpeech(text: string): string {
  return text.replace(QUOTED_SPEECH_RE, " ");
}

/**
 * The chat members (characters and persona) a clip's text names by a part of their name no one else in the chat
 * shares: "Lena" for "Dr. Lena Kowalski". Video prompts usually call people by first name, while the shared
 * matcher only takes a full name, which stays the rule for pictures. A part counts only when written with a
 * capital (or in a script without capitals), so "hazel eyes" or "the snow" name no one.
 */
function namesMentionedByPart(text: string, members: Array<{ id: string | null; name: string }>): Set<string | null> {
  const capitalised = new Set(
    text
      .normalize("NFKC")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word !== word.toLowerCase() || word === word.toUpperCase())
      .map((word) => word.toLowerCase()),
  );
  const parts = members.map(({ id, name }) => ({
    id,
    tokens: [
      ...new Set(
        name
          .normalize("NFKC")
          .toLowerCase()
          .split(/[^\p{L}\p{N}]+/u)
          .filter((token) => token.length >= 2 && !NAME_STOPWORDS.has(token)),
      ),
    ],
  }));
  const owners = new Map<string, number>();
  for (const { tokens } of parts) for (const token of tokens) owners.set(token, (owners.get(token) ?? 0) + 1);
  return new Set(
    parts
      .filter(({ tokens }) => tokens.some((token) => owners.get(token) === 1 && capitalised.has(token)))
      .map(({ id }) => id),
  );
}

type SelfieArgs = Parameters<typeof generateConversationVideo>[0] & { selfieContext: string };

/** Take the selfie the clip starts from; with the avatar fallback, a failed selfie uses the avatar instead. */
async function takeSelfieFrame(
  args: SelfieArgs,
  avatarFallback: boolean,
  readAvatar: () => Promise<ReadyFrame>,
): Promise<ReadyFrame> {
  try {
    const galleryId = await runSelfie(args, false);
    const image = galleryId ? await createGalleryStorage(args.db).getById(galleryId, args.chatId) : null;
    const path = image ? resolveGalleryImagePath(image) : null;
    if (!image || !path) throw new ChatVideoError(502, "The selfie for this video could not be saved.");
    return {
      kind: "selfie",
      image: await toVideoReferenceImage(readFileSync(path).toString("base64")),
      tag: `gallery:${image.id}`,
      path: `gallery/${image.filePath.replace(/\\/g, "/")}`,
    };
  } catch (err) {
    if (!avatarFallback || args.signal?.aborted) throw err;
    logger.warn(err, "[conversation/video] Selfie first frame failed; using the avatar instead");
    return readAvatar();
  }
}

/** The selfie's prompt, written the way it will be drawn, for the prompt review. Null when none could be written. */
async function previewSelfie(args: SelfieArgs): Promise<ConversationVideoPreview["selfie"]> {
  let preview: ConversationVideoPreview["selfie"] = null;
  await runSelfie(args, true, (selfie) => {
    preview = selfie;
  }).catch((err) => {
    logger.warn(err, "[conversation/video] Selfie prompt preview failed");
  });
  return preview;
}

/** Run the chat's selfie pipeline for one image; returns its gallery id, or null for a preview. */
async function runSelfie(
  args: SelfieArgs,
  previewOnly: boolean,
  onPreview?: (selfie: NonNullable<ConversationVideoPreview["selfie"]>) => void,
): Promise<string | null> {
  let galleryId: string | null = null;
  let error: string | null = null;
  await handleConversationSelfieCommand({
    command: { type: "selfie", context: args.selfieContext || undefined },
    characterId: args.characterId,
    chatId: args.chatId,
    messageId: null,
    chatMeta: { ...args.chatMeta, illustratorImagesPerGeneration: 1 },
    charInfo: args.charInfo,
    persona: null,
    // The selfie runtime resolves the Prompt Model the same way; a chat with neither reports it as a selfie error.
    promptConnection: args.promptConnection as IllustratorPromptConnection,
    promptConnectionId: args.promptConnectionId ?? "",
    debugMode: args.debugMode,
    serviceTier: args.serviceTier ?? null,
    db: args.db,
    chars: createCharactersStorage(args.db),
    chats: createChatsStorage(args.db),
    connections: createConnectionsStorage(args.db),
    signal: args.signal,
    queue: args.queue ?? true,
    previewOnly,
    onPreview,
    promptOverride: args.selfiePromptOverride,
    negativePromptOverride: args.selfieNegativePromptOverride,
    sendEvent: (event) => {
      const data = parseRecord(event.data);
      if (event.type === "selfie" && typeof data.galleryId === "string") galleryId ??= data.galleryId;
      if (event.type === "selfie_error") error = typeof data.error === "string" ? data.error : "Selfie failed";
    },
  });
  if (error) throw new ChatVideoError(502, error);
  if (!previewOnly && !galleryId) throw new ChatVideoError(502, "The selfie for this video could not be made.");
  return galleryId;
}

function parseRecord(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, any>) : {};
  } catch {
    return {};
  }
}

/** How many recent messages Illustrator reads for a picture (its Agent Budget context size); videos read as many. */
export async function loadIllustratorContextSize(db: DB): Promise<number> {
  const illustrator = await createAgentsStorage(db)
    .getByType("illustrator")
    .catch(() => null);
  return normalizeAgentContextSize(
    mergeBuiltInAgentSettings("illustrator", parseAgentSettingsRecord(illustrator?.settings)).contextSize,
  );
}
