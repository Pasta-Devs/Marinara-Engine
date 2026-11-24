// Character Tracker portraits: the automatic one for a new NPC and the manual redo from a portrait.
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import {
  DEFAULT_TRACKER_PORTRAIT_REWRITE_PROMPT,
  findImageStyleProfile,
  resolveTrackerPortraitRewriteSettings,
  type ImageGenRequest,
} from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import type { DB } from "../../db/connection.js";
import { logDebugOverride } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { resolveInside } from "../../utils/security.js";
import { npcAvatarSlug } from "../game/npc-avatar-utils.js";
import { resolveImageConnectionFallback } from "../generation/media-connection-fallback.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { generateImage } from "./image-generation.js";
import { resolveConnectionImageDefaults, resolveConnectionImageQuality } from "./image-generation-defaults.js";
import { loadImageGenerationUserSettings } from "./image-generation-settings.js";
import { compileImagePrompt } from "./image-prompt-compiler.js";
import { rewriteTrackerPortraitPrompt, type RewriteTrackerPortraitPromptArgs } from "./tracker-portrait-rewriter.js";

export interface TrackerPortraitCharacter {
  name: string;
  /** Optional card Image Appearance override tags, placed verbatim before `appearance`. */
  imageAppearance?: unknown;
  /** Raw tracker fields (or card fallback): anything but text is left out. */
  appearance?: unknown;
  outfit?: unknown;
  mood?: unknown;
}

const clause = (value: unknown) => (typeof value === "string" ? value : "").replace(/\s+/g, " ").trim();

/**
 * The portrait prompt: optional card override tags verbatim, tracked look, plus tracked outfit unless
 * `includeOutfit` is off. Keep complete tracked text; style compilation must not drop visual details.
 */
export function buildTrackerPortraitPrompt(
  character: TrackerPortraitCharacter,
  includeOutfit: boolean,
  options: { referenceLine?: string | null } = {},
): string {
  const name = clause(character.name) || "Character";
  const imageAppearance = clause(character.imageAppearance);
  const appearance = clause(character.appearance);
  // Skip exact duplication when Look matches the override, while preserving extra scene details.
  const extraAppearance =
    appearance && (!imageAppearance || appearance.toLowerCase() !== imageAppearance.toLowerCase()) ? appearance : "";
  const outfit = includeOutfit ? clause(character.outfit) : "";
  const referenceLine = clause(options.referenceLine);
  return [
    `Portrait of ${name}.`,
    imageAppearance,
    extraAppearance,
    outfit,
    referenceLine,
    "Character portrait, head and shoulders, detailed face, high quality",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The chat's image style: the game setup's choice first, then the chat's. */
export function trackerPortraitStyleProfileId(chatMeta: Record<string, unknown>): string | null {
  const setup = chatMeta.gameSetupConfig as Record<string, unknown> | undefined;
  const id = setup?.imageStyleProfileId ?? chatMeta.imageStyleProfileId;
  return typeof id === "string" ? id : null;
}

/** Refuses a portrait: one for this character is already being made, or a newer one was saved meanwhile. */
export class TrackerPortraitConflictError extends Error {}

/** Character keys currently generating a portrait, so one character never gets two paid requests at once. */
const portraitsInProgress = new Set<string>();

const savedFileStamp = (path: string) => {
  if (!existsSync(path)) return null;
  const { mtimeMs, size } = statSync(path);
  return `${mtimeMs}:${size}`;
};

export interface TrackerPortraitRewriteOption {
  enabled: boolean;
  prompt?: string;
  chatConnectionId?: string | null;
  illustratorPromptConnectionId?: string | null;
}

/** Builds the `rewritePrompt` option for `generateTrackerPortrait` from Character Tracker settings and chat state. */
export function trackerPortraitRewriteOption(
  trackerSettings: Record<string, unknown> | null | undefined,
  chatMeta: Record<string, unknown> | null | undefined,
  chatConnectionId: unknown,
): TrackerPortraitRewriteOption {
  const illustratorPromptConnectionId =
    typeof chatMeta?.illustratorPromptConnectionId === "string" ? chatMeta.illustratorPromptConnectionId : null;
  return {
    ...resolveTrackerPortraitRewriteSettings(trackerSettings),
    chatConnectionId: typeof chatConnectionId === "string" ? chatConnectionId : null,
    illustratorPromptConnectionId,
  };
}

/**
 * Generates the portrait and saves it on disk only after the image arrives. Returns its URL path.
 * When `uniqueFilename` is true, writes an immutable per-scene file so earlier swipes/branches stay intact;
 * otherwise overwrites `<safeName>.png` unless something else (such as an upload) saved it meanwhile.
 */
export async function generateTrackerPortrait(args: {
  db: DB;
  connectionId: string;
  chatId: string;
  styleProfileId: string | null;
  character: TrackerPortraitCharacter;
  includeOutfit: boolean;
  uniqueFilename?: boolean;
  referenceImage?: string;
  referenceLine?: string | null;
  rewritePrompt?: TrackerPortraitRewriteOption;
  rewriteFn?: (args: RewriteTrackerPortraitPromptArgs) => Promise<string | null>;
  debugMode?: boolean;
  onFallback?: ImageGenRequest["onFallback"];
}): Promise<string> {
  const safeName = npcAvatarSlug(args.character.name);
  if (!safeName) throw new Error("Invalid character name");
  const npcRoot = join(DATA_DIR, "avatars", "npc");
  const npcDir = resolveInside(npcRoot, args.chatId);
  const lockKey = `${npcDir}:${safeName}`;
  const filename = args.uniqueFilename ? `scene-${safeName}-${randomUUID().slice(0, 8)}.png` : `${safeName}.png`;
  const portraitFile = resolveInside(npcDir, filename);
  if (portraitsInProgress.has(lockKey)) {
    throw new TrackerPortraitConflictError("A portrait for this character is already being made.");
  }
  portraitsInProgress.add(lockKey);
  try {
    const savedBefore = args.uniqueFilename ? null : savedFileStamp(portraitFile);
    const connections = createConnectionsStorage(args.db);
    const connection = await connections.getWithKey(args.connectionId);
    if (!connection) throw new Error("Image connection not found");
    const model = connection.model || "";
    const imageDefaults = resolveConnectionImageDefaults(connection);
    const imageSettings = await loadImageGenerationUserSettings(args.db);
    const resolvedStyleProfile = findImageStyleProfile(
      imageSettings.styleProfiles,
      args.styleProfileId || imageDefaults?.styleProfileId || imageSettings.styleProfiles.defaultProfileId,
    );

    let promptToCompile: string | null = null;
    if (args.rewritePrompt?.enabled) {
      const rewriter = args.rewriteFn ?? rewriteTrackerPortraitPrompt;
      const rewritten = await rewriter({
        db: args.db,
        chatConnectionId: args.rewritePrompt.chatConnectionId ?? null,
        illustratorPromptConnectionId: args.rewritePrompt.illustratorPromptConnectionId ?? null,
        systemPrompt: args.rewritePrompt.prompt || DEFAULT_TRACKER_PORTRAIT_REWRITE_PROMPT,
        character: args.character,
        includeOutfit: args.includeOutfit,
        promptMode: resolvedStyleProfile.promptMode,
        portraitTags: resolvedStyleProfile.subjectTags.portrait ?? "",
        imagePromptInstructions: connection.imagePromptInstructions,
        debugMode: args.debugMode,
      });
      if (rewritten) {
        promptToCompile = [rewritten, clause(args.referenceLine)].filter(Boolean).join("\n");
      }
    }

    const compiled = compileImagePrompt({
      kind: "portrait",
      prompt:
        promptToCompile ??
        buildTrackerPortraitPrompt(args.character, args.includeOutfit, { referenceLine: args.referenceLine }),
      styleProfiles: imageSettings.styleProfiles,
      styleProfileId: args.styleProfileId,
      imageDefaults,
    });
    const debugOverrideEnabled = args.debugMode === true || isDebugAgentsEnabled();
    logDebugOverride(debugOverrideEnabled, "[debug/character-tracker/portrait] prompt:\n%s", compiled.prompt);
    if (compiled.negativePrompt) {
      logDebugOverride(
        debugOverrideEnabled,
        "[debug/character-tracker/portrait] negative prompt:\n%s",
        compiled.negativePrompt,
      );
    }
    const image = await generateImage(
      model,
      connection.baseUrl || "https://image.pollinations.ai",
      connection.apiKey || "",
      connection.imageService || (connection as { imageGenerationSource?: string }).imageGenerationSource || model,
      {
        prompt: compiled.prompt,
        negativePrompt: compiled.negativePrompt || undefined,
        model,
        width: imageSettings.portrait.width,
        height: imageSettings.portrait.height,
        ...(args.referenceImage ? { referenceImages: [args.referenceImage] } : {}),
        imageEndpointId: connection.imageEndpointId || undefined,
        comfyWorkflow: connection.comfyuiWorkflow || undefined,
        imageDefaults,
        quality: resolveConnectionImageQuality(connection),
        debugMode: args.debugMode,
        preserveProviderOutput: true,
        fallback: await resolveImageConnectionFallback(connections, connection.id),
        onFallback: args.onFallback,
      },
    );
    if (!args.uniqueFilename && savedFileStamp(portraitFile) !== savedBefore) {
      throw new TrackerPortraitConflictError(
        "A newer portrait was saved while this one was being made, so it was kept.",
      );
    }
    if (!existsSync(npcDir)) mkdirSync(npcDir, { recursive: true });
    writeFileSync(portraitFile, Buffer.from(image.base64, "base64"));
    return `/api/avatars/npc/${args.chatId}/${filename}`;
  } finally {
    portraitsInProgress.delete(lockKey);
  }
}
