// Character Tracker portraits: the automatic one for a new NPC and the manual redo from a portrait.
import { existsSync, mkdirSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import type { ImageGenRequest } from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import type { DB } from "../../db/connection.js";
import { logDebugOverride } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { assertInsideDir } from "../../utils/security.js";
import { npcAvatarSlug } from "../game/npc-avatar-utils.js";
import { resolveImageConnectionFallback } from "../generation/media-connection-fallback.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { generateImage } from "./image-generation.js";
import { resolveConnectionImageDefaults, resolveConnectionImageQuality } from "./image-generation-defaults.js";
import { loadImageGenerationUserSettings } from "./image-generation-settings.js";
import { compileImagePrompt } from "./image-prompt-compiler.js";

export interface TrackerPortraitCharacter {
  name: string;
  /** Raw tracker fields: anything but text is left out. */
  appearance?: unknown;
  outfit?: unknown;
}

const clause = (value: unknown) => (typeof value === "string" ? value : "").replace(/\s+/g, " ").trim();

/**
 * The portrait prompt: the tracked look, plus the tracked outfit unless `includeOutfit` is off.
 * Keep the complete tracked text; style compilation must not choose which visual details survive.
 */
export function buildTrackerPortraitPrompt(character: TrackerPortraitCharacter, includeOutfit: boolean): string {
  const name = clause(character.name) || "Character";
  const appearance = clause(character.appearance);
  const outfit = includeOutfit ? clause(character.outfit) : "";
  return [
    `Portrait of ${name}.`,
    appearance,
    outfit,
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

/** Portrait files being made right now, so one character never gets two paid requests at once. */
const portraitsInProgress = new Set<string>();

const savedFileStamp = (path: string) => {
  if (!existsSync(path)) return null;
  const { mtimeMs, size } = statSync(path);
  return `${mtimeMs}:${size}`;
};

/**
 * Generates the portrait and saves it over the old one only after the image arrives, and only if
 * nothing else (such as an upload) saved that portrait meanwhile. Returns its URL path.
 */
export async function generateTrackerPortrait(args: {
  db: DB;
  connectionId: string;
  chatId: string;
  styleProfileId: string | null;
  character: TrackerPortraitCharacter;
  includeOutfit: boolean;
  debugMode?: boolean;
  onFallback?: ImageGenRequest["onFallback"];
}): Promise<string> {
  const safeName = npcAvatarSlug(args.character.name);
  if (!safeName) throw new Error("Invalid character name");
  const npcRoot = join(DATA_DIR, "avatars", "npc");
  const npcDir = assertInsideDir(npcRoot, join(npcRoot, args.chatId));
  const portraitFile = join(npcDir, `${safeName}.png`);
  if (portraitsInProgress.has(portraitFile)) {
    throw new TrackerPortraitConflictError("A portrait for this character is already being made.");
  }
  portraitsInProgress.add(portraitFile);
  try {
    const savedBefore = savedFileStamp(portraitFile);
    const connections = createConnectionsStorage(args.db);
    const connection = await connections.getWithKey(args.connectionId);
    if (!connection) throw new Error("Image connection not found");
    const model = connection.model || "";
    const imageDefaults = resolveConnectionImageDefaults(connection);
    const imageSettings = await loadImageGenerationUserSettings(args.db);
    const compiled = compileImagePrompt({
      kind: "portrait",
      prompt: buildTrackerPortraitPrompt(args.character, args.includeOutfit),
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
    if (savedFileStamp(portraitFile) !== savedBefore) {
      throw new TrackerPortraitConflictError(
        "A newer portrait was saved while this one was being made, so it was kept.",
      );
    }
    if (!existsSync(npcDir)) mkdirSync(npcDir, { recursive: true });
    writeFileSync(portraitFile, Buffer.from(image.base64, "base64"));
    return `/api/avatars/npc/${args.chatId}/${safeName}.png`;
  } finally {
    portraitsInProgress.delete(portraitFile);
  }
}
