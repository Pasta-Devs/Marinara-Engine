import { LOCAL_SIDECAR_CONNECTION_ID } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { resolveIllustratorPromptRuntime } from "../generation/illustrator-prompt-runtime.js";
import { removeCopiedPromptGuidance } from "../image/image-prompt-compiler.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { ChatVideoError, type resolveChatVideoSetup } from "./chat-video-generation.js";
import { compactVideoPromptText } from "./prompt-context.js";
import { buildRoleplayVideoDirectionMessages, resolveRoleplayVideoDirection } from "./roleplay-video-direction.js";

/** Room for a model that thinks before answering, as the Conversation video writer has. */
const ROLEPLAY_CLIP_WRITER_MAX_TOKENS = 8_192;

type RoleplayClipChat = {
  id: string;
  name?: string | null;
  connectionId?: string | null;
};

/** The setting line a Roleplay video director gets: the chat's scenario, scene instructions and background. */
export function buildRoleplayVideoSettingLine(
  chat: { name?: string | null },
  meta: Record<string, unknown>,
  maxPartLength: number,
): string {
  const parts = [meta.groupScenarioText, meta.scenario, meta.sceneInstructions, meta.background, chat.name]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
  const setting = Array.from(new Set(parts.map((part) => compactVideoPromptText(part, maxPartLength)).filter(Boolean)));
  return setting.length ? setting.join("; ") : "Current roleplay scene";
}

/**
 * The video prompt for a Roleplay clip, written by the chat's Prompt Model with a Roleplay video director and the
 * video connection's Video Prompting Instructions, which decide its format. With a picture the Gallery animation
 * director continues it; without one the Clip Director describes the scene. Every Roleplay clip that has no prompt
 * written to those instructions yet goes through here.
 */
export async function writeRoleplayClipDirection(
  db: DB,
  args: {
    chat: RoleplayClipChat;
    meta: Record<string, unknown>;
    setup: Pick<
      Awaited<ReturnType<typeof resolveChatVideoSetup>>,
      "videoConn" | "runtime" | "durationSeconds" | "aspectRatio"
    >;
    /** The recent messages (and any requested clip) the clip shows. */
    sourceExchange: string;
    /** The picture the clip starts from, when there is one. */
    referenceImagePrompt?: string;
    characterNames: string[];
    /** Attach Card Appearance for videos: the people's appearance details to build in (formatVideoAppearanceDetails). */
    appearanceDetails?: string;
    withoutPicture: boolean;
    debugMode?: boolean;
    signal?: AbortSignal;
  },
): Promise<string> {
  const connections = createConnectionsStorage(db);
  const defaultConnection =
    args.chat.connectionId && args.chat.connectionId !== LOCAL_SIDECAR_CONNECTION_ID
      ? await connections.getWithKey(args.chat.connectionId)
      : null;
  let promptRuntime;
  try {
    promptRuntime = await resolveIllustratorPromptRuntime({
      chatMetadata: args.meta,
      defaultConnection,
      defaultConnectionId: args.chat.connectionId ?? null,
      connections,
      resolveBaseUrl,
    });
  } catch (err) {
    logger.warn(err, "[roleplay-clip-writer] Prompt Model is unavailable for chat %s", args.chat.id);
    throw new ChatVideoError(400, "Choose a text Prompt Model or main chat connection before making a Roleplay clip.");
  }
  const { videoConn, runtime } = args.setup;
  const messages = await buildRoleplayVideoDirectionMessages(createPromptOverridesStorage(db), {
    durationSeconds: args.setup.durationSeconds,
    aspectRatio: args.setup.aspectRatio,
    sourceExchange: args.sourceExchange,
    referenceImagePrompt: args.referenceImagePrompt ?? "",
    characterNames: args.characterNames,
    setting: buildRoleplayVideoSettingLine(args.chat, args.meta, runtime.promptLimits.artStyle),
    videoPromptInstructions: videoConn.videoPromptInstructions,
    withoutPicture: args.withoutPicture,
    appearanceDetails: args.appearanceDetails,
  });
  const debug = args.debugMode === true || isDebugAgentsEnabled();
  logDebugOverride(
    debug,
    "[debug/roleplay-clip-writer] system:\n%s\nuser:\n%s",
    messages[0].content,
    messages[1].content,
  );
  let finishReason: string | null | undefined;
  let prompt = "";
  try {
    const result = await promptRuntime.provider.chatComplete(messages, {
      model: promptRuntime.model,
      ...(promptRuntime.suppressModelParameters
        ? {}
        : { temperature: 0.5, maxTokens: ROLEPLAY_CLIP_WRITER_MAX_TOKENS }),
      suppressModelParameters: promptRuntime.suppressModelParameters,
      signal: args.signal,
      enableCaching: promptRuntime.enableCaching,
      anthropicExtendedCacheTtl: promptRuntime.anthropicExtendedCacheTtl,
    });
    finishReason = result.finishReason;
    // A sentence of the connection's instructions the writer copied word for word is not video-model text.
    prompt = removeCopiedPromptGuidance(
      resolveRoleplayVideoDirection(
        result.content,
        runtime.promptLimits.finalPrompt,
        videoConn.videoPromptInstructions,
      ),
      [videoConn.videoPromptInstructions],
    );
  } catch (err) {
    // A Stop is a cancellation, not a failed plan.
    if (args.signal?.aborted) throw err;
    logger.warn(err, "[roleplay-clip-writer] Failed to write a clip for chat %s", args.chat.id);
    throw new ChatVideoError(
      502,
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : "The Roleplay animation Prompt Model failed to plan this clip.",
    );
  }
  if (!prompt) {
    throw new ChatVideoError(
      502,
      finishReason === "length"
        ? "The Roleplay animation Prompt Model used its whole response budget before writing the clip. Try a model that thinks less, or shorter Video Prompting Instructions."
        : "The Roleplay animation Prompt Model returned an empty direction.",
    );
  }
  logDebugOverride(debug, "[debug/roleplay-clip-writer] prompt:\n%s", prompt);
  return prompt;
}
