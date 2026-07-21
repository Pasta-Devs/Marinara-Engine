import { resolveGameSetupArtStylePrompt, type GameState } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import type { ResolvedAgent } from "../agents/agent-pipeline.js";
import { generateChatBackground } from "../game/game-asset-generation.js";
import { resolveConnectionImageDefaults } from "../image/image-generation-defaults.js";
import { loadImageGenerationUserSettings } from "../image/image-generation-settings.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { resolveImageConnectionFallback } from "./media-connection-fallback.js";

const ROLEPLAY_BACKGROUND_MODES = new Set(["roleplay", "visual_novel"]);
const BACKGROUND_PLAN_MAX_TOKENS = 1_200;
const BACKGROUND_PLAN_SYSTEM_PROMPT = [
  "You write one reusable, character-free scene background prompt for Marinara Roleplay.",
  "The first-stage Illustrator or a committed tracker update has already established that the scene entered a meaningfully new location. Do not reconsider that decision.",
  "Treat the current tracker location as authoritative when it is present. Otherwise infer the current location from the latest assistant response and recent context.",
  "Describe a single full-frame environment with a readable spatial layout: architecture or nature, important props, weather, time of day, lighting, atmosphere, and environmental storytelling.",
  "Keep the prompt style-neutral because Marinara applies the user's selected Image Style profile afterward.",
  "Do not include characters, people, crowds, portraits, dialogue, captions, signs with readable text, UI, panels, collages, watermarks, logos, or meta-instructions.",
  "Choose a concise concrete English location name using ordinary filename-safe words, such as enchanted forest or moonlit palace courtyard.",
  "Return valid JSON only, with no markdown:",
  '{"locationName":"short concrete location","prompt":"detailed background-only image prompt","tags":["3-8","useful","lowercase tags"],"reason":"brief scene-change reason"}',
].join("\n");

type ConnectionsStorage = ReturnType<typeof createConnectionsStorage>;

export type IllustratorBackgroundPlan = {
  locationName: string;
  prompt: string;
  tags: string[];
  reason: string;
};

export type GeneratedIllustratorBackground = IllustratorBackgroundPlan & {
  filename: string;
  url: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value !== "string") return {};
  const text = value
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeBackgroundTag(value: unknown): string {
  return readTrimmedString(value)
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 40);
}

function normalizeBackgroundTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(normalizeBackgroundTag).filter(Boolean))).slice(0, 8);
}

export function illustratorBackgroundGenerationEnabled(
  chatMode: unknown,
  chatMetadata: Record<string, unknown>,
): boolean {
  return (
    ROLEPLAY_BACKGROUND_MODES.has(String(chatMode ?? "")) && chatMetadata.illustratorAutoBackgroundsEnabled === true
  );
}

export function illustratorRequestedBackground(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  return value.trim().toLowerCase() === "yes" || value.trim().toLowerCase() === "true";
}

export function illustratorTrackerLocationChanged(previousLocation: unknown, currentLocation: unknown): boolean {
  const normalize = (value: unknown) => readTrimmedString(value).replace(/\s+/gu, " ").toLowerCase();
  const previous = normalize(previousLocation);
  const current = normalize(currentLocation);
  return current.length > 0 && current !== previous;
}

export function parseIllustratorBackgroundPlan(value: unknown): IllustratorBackgroundPlan | null {
  const record = parseRecord(value);
  const locationName = readTrimmedString(record.locationName ?? record.location ?? record.name).slice(0, 120);
  const prompt = readTrimmedString(record.prompt ?? record.description).slice(0, 5_000);
  if (!locationName || !prompt) return null;
  return {
    locationName,
    prompt,
    tags: normalizeBackgroundTags(record.tags),
    reason: readTrimmedString(record.reason).slice(0, 300),
  };
}

function trackerSummary(gameState: GameState | null): Record<string, unknown> | null {
  if (!gameState) return null;
  const fields = {
    date: gameState.date || undefined,
    time: gameState.time || undefined,
    location: gameState.location || undefined,
    weather: gameState.weather || undefined,
    temperature: gameState.temperature || undefined,
  };
  return Object.values(fields).some(Boolean) ? fields : null;
}

export function buildIllustratorBackgroundPlanUserPrompt(args: {
  chatName?: string | null;
  currentBackground?: string | null;
  assistantResponse: string;
  decisionReason?: string;
  gameState: GameState | null;
  recentMessages: Array<{ role: string; content: string; gameState?: GameState | null }>;
}): string {
  const trackedLocations = args.recentMessages
    .map((message) => readTrimmedString(message.gameState?.location))
    .filter(Boolean);
  const previousTrackedLocations = trackedLocations
    .filter((location, index) => trackedLocations.lastIndexOf(location) === index)
    .slice(-3);
  const recentContext = args.recentMessages
    .slice(-6)
    .map((message) => `${message.role}: ${message.content.replace(/\s+/gu, " ").trim().slice(0, 1_500)}`)
    .filter((line) => !line.endsWith(": "))
    .join("\n");
  const currentTrackerSummary = trackerSummary(args.gameState);
  return [
    args.chatName ? `Chat: ${args.chatName}` : "",
    args.currentBackground
      ? `Currently active background: ${args.currentBackground}`
      : "Currently active background: none",
    currentTrackerSummary ? `Current tracker state: ${JSON.stringify(currentTrackerSummary)}` : "",
    previousTrackedLocations.length > 0
      ? `Recent committed tracker locations: ${previousTrackedLocations.join(" -> ")}`
      : "",
    args.decisionReason ? `First-stage Illustrator reason: ${args.decisionReason}` : "",
    `Latest assistant scene:\n${args.assistantResponse.trim().slice(0, 8_000)}`,
    recentContext ? `Recent context:\n${recentContext}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function writeIllustratorBackgroundPlan(args: {
  illustratorAgent: ResolvedAgent;
  chatName?: string | null;
  currentBackground?: string | null;
  assistantResponse: string;
  decisionReason?: string;
  gameState: GameState | null;
  recentMessages: Array<{ role: string; content: string; gameState?: GameState | null }>;
  signal?: AbortSignal;
  debugLog?: (message: string, ...args: unknown[]) => void;
}): Promise<IllustratorBackgroundPlan> {
  const userPrompt = buildIllustratorBackgroundPlanUserPrompt(args);
  args.debugLog?.("[debug/illustrator/background-prompt] system:\n%s", BACKGROUND_PLAN_SYSTEM_PROMPT);
  args.debugLog?.("[debug/illustrator/background-prompt] user:\n%s", userPrompt);

  const callPromptWriter = async (messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) =>
    args.illustratorAgent.provider.chatComplete(messages, {
      model: args.illustratorAgent.model,
      temperature: 0.35,
      maxTokens: Math.min(
        BACKGROUND_PLAN_MAX_TOKENS,
        args.illustratorAgent.maxOutputTokens && args.illustratorAgent.maxOutputTokens > 0
          ? args.illustratorAgent.maxOutputTokens
          : BACKGROUND_PLAN_MAX_TOKENS,
      ),
      enableCaching: args.illustratorAgent.enableCaching,
      anthropicExtendedCacheTtl: args.illustratorAgent.anthropicExtendedCacheTtl,
      cachingAtDepth: args.illustratorAgent.cachingAtDepth,
      customParameters: args.illustratorAgent.customParameters,
      signal: args.signal,
    });

  const messages = [
    { role: "system" as const, content: BACKGROUND_PLAN_SYSTEM_PROMPT },
    { role: "user" as const, content: userPrompt },
  ];
  let response = await callPromptWriter(messages);
  let raw = response.content ?? "";
  let plan = parseIllustratorBackgroundPlan(raw);
  if (!plan && !args.signal?.aborted) {
    logger.warn("[illustrator-background] Prompt writer returned invalid JSON; retrying once");
    response = await callPromptWriter([
      ...messages,
      { role: "assistant", content: raw.slice(0, 5_000) },
      {
        role: "user",
        content:
          "Return the requested JSON object now. locationName and prompt must both be non-empty strings; tags must be an array of useful lowercase strings.",
      },
    ]);
    raw = response.content ?? "";
    plan = parseIllustratorBackgroundPlan(raw);
  }
  if (!plan) throw new Error("Illustrator returned an invalid background prompt plan.");
  args.debugLog?.("[debug/illustrator/background-prompt] plan:\n%s", JSON.stringify(plan, null, 2));
  return plan;
}

async function resolveIllustratorImageConnection(
  connections: ConnectionsStorage,
  illustratorAgent: ResolvedAgent,
  chatMetadata: Record<string, unknown>,
) {
  const configuredId =
    readTrimmedString(chatMetadata.gameImageConnectionId) ||
    readTrimmedString(illustratorAgent.settings.imageConnectionId);
  let connection = configuredId ? await connections.getWithKey(configuredId) : null;
  if (configuredId && !connection) {
    logger.warn(
      "[illustrator-background] Image connection %s could not be resolved; falling back to the default Images connection",
      configuredId,
    );
  }
  connection ??= await connections.getDefaultForImageGeneration();
  if (!connection) {
    throw new Error(
      "No image generation connection is set on Illustrator or under Settings -> Connections -> Defaults -> Images.",
    );
  }
  return connection;
}

export async function generateIllustratorSceneBackground(args: {
  db: DB;
  chatId: string;
  chatName?: string | null;
  chatMode: "roleplay" | "visual_novel";
  chatMetadata: Record<string, unknown>;
  illustratorAgent: ResolvedAgent;
  assistantResponse: string;
  decisionReason?: string;
  gameState: GameState | null;
  recentMessages: Array<{ role: string; content: string; gameState?: GameState | null }>;
  signal?: AbortSignal;
  debugLog?: (message: string, ...args: unknown[]) => void;
}): Promise<GeneratedIllustratorBackground> {
  const connections = createConnectionsStorage(args.db);
  const imageConnection = await resolveIllustratorImageConnection(
    connections,
    args.illustratorAgent,
    args.chatMetadata,
  );
  const imageSettings = await loadImageGenerationUserSettings(args.db);
  const imageFallback = await resolveImageConnectionFallback(connections, imageConnection.id);
  const setupConfig = isRecord(args.chatMetadata.gameSetupConfig) ? args.chatMetadata.gameSetupConfig : {};
  const styleProfileId =
    readTrimmedString(setupConfig.imageStyleProfileId) ||
    readTrimmedString(args.chatMetadata.imageStyleProfileId) ||
    imageSettings.styleProfiles.defaultProfileId ||
    null;
  const plan = await writeIllustratorBackgroundPlan(args);
  const filename = await generateChatBackground({
    chatId: args.chatId,
    locationSlug: plan.locationName,
    sceneDescription: plan.prompt,
    genre: readTrimmedString(setupConfig.genre) || undefined,
    setting: readTrimmedString(setupConfig.setting) || undefined,
    currentLocation: args.gameState?.location ?? null,
    currentWeather: args.gameState?.weather ?? null,
    currentTimeOfDay: args.gameState?.time ?? null,
    worldOverview: readTrimmedString(args.chatMetadata.gameWorldOverview) || null,
    artStyle: resolveGameSetupArtStylePrompt(setupConfig) || undefined,
    reason: plan.reason || args.decisionReason,
    tags: plan.tags,
    sourceMode: args.chatMode,
    imgModel: imageConnection.model || "",
    imgBaseUrl: imageConnection.baseUrl || "https://image.pollinations.ai",
    imgApiKey: imageConnection.apiKey || "",
    imgSource: imageConnection.imageGenerationSource || imageConnection.model || "",
    imgService: imageConnection.imageService || imageConnection.imageGenerationSource || "",
    imgEndpointId: imageConnection.imageEndpointId || undefined,
    imgComfyWorkflow: imageConnection.comfyuiWorkflow || undefined,
    imgDefaults: resolveConnectionImageDefaults(imageConnection),
    imgFallback: imageFallback,
    styleProfiles: imageSettings.styleProfiles,
    styleProfileId,
    promptOverridesStorage: createPromptOverridesStorage(args.db),
    size: imageSettings.background,
    debugLog: args.debugLog,
    force: false,
    signal: args.signal,
  });
  if (!filename) throw new Error("Background image generation failed. Check the Illustrator image connection.");
  return {
    ...plan,
    filename,
    url: `/api/backgrounds/file/${encodeURIComponent(filename)}`,
  };
}
