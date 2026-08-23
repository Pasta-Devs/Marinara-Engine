import {
  findImageStyleProfile,
  resolveGameSetupArtStylePrompt,
  type GameState,
  type ImageStyleProfileSettings,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import type { ResolvedAgent } from "../agents/agent-pipeline.js";
import { normalizeAgentContextSize } from "../agents/agent-executor.js";
import {
  buildBackgroundProviderPrompt,
  generateChatBackground,
  type ChatBackgroundGenRequest,
} from "../game/game-asset-generation.js";
import { resolveConnectionImageDefaults, resolveConnectionImageQuality } from "../image/image-generation-defaults.js";
import { loadImageGenerationUserSettings } from "../image/image-generation-settings.js";
import { resolveImagePromptReviewSize } from "../image/image-prompt-review.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { resolveImageConnectionFallback } from "./media-connection-fallback.js";

const ROLEPLAY_BACKGROUND_MODES = new Set(["roleplay"]);
const BACKGROUND_PLAN_MAX_TOKENS = 1_200;
const BACKGROUND_PLAN_SYSTEM_PROMPT = [
  "You write one reusable, character-free scene background prompt for Marinara Roleplay.",
  "The first-stage Illustrator or a committed tracker update has already established that the scene entered a meaningfully new location. Do not reconsider that decision.",
  "Treat the current tracker location as authoritative when it is present. Otherwise infer the current location from the latest assistant response and recent context.",
  "Describe a single full-frame environment with a readable spatial layout: architecture or nature, important props, weather, time of day, lighting, atmosphere, and environmental storytelling.",
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

type IllustratorSceneBackgroundArgs = {
  db: DB;
  chatId: string;
  chatName?: string | null;
  chatMode: "roleplay" | "game";
  chatMetadata: Record<string, unknown>;
  currentBackground: string | null;
  illustratorAgent: ResolvedAgent;
  assistantResponse: string;
  decisionReason?: string;
  gameState: GameState | null;
  recentMessages: Array<{ role: string; content: string; gameState?: GameState | null }>;
  signal?: AbortSignal;
  debugLog?: (message: string, ...args: unknown[]) => void;
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

export function buildIllustratorBackgroundPlanSystemPrompt(styleInstruction?: string): string {
  return [
    BACKGROUND_PLAN_SYSTEM_PROMPT,
    styleInstruction?.trim()
      ? `Visual style instruction for the image prompt you write: ${styleInstruction.trim()}`
      : "No visual style profile is selected. Keep the prompt style-neutral.",
  ].join("\n");
}

async function writeIllustratorBackgroundPlan(args: {
  illustratorAgent: ResolvedAgent;
  chatName?: string | null;
  currentBackground?: string | null;
  assistantResponse: string;
  decisionReason?: string;
  gameState: GameState | null;
  recentMessages: Array<{ role: string; content: string; gameState?: GameState | null }>;
  styleInstruction?: string;
  signal?: AbortSignal;
  debugLog?: (message: string, ...args: unknown[]) => void;
}): Promise<IllustratorBackgroundPlan> {
  const recentMessages = args.recentMessages.slice(
    -normalizeAgentContextSize(args.illustratorAgent.settings.contextSize),
  );
  const userPrompt = buildIllustratorBackgroundPlanUserPrompt({ ...args, recentMessages });
  const systemPrompt = buildIllustratorBackgroundPlanSystemPrompt(args.styleInstruction);
  args.debugLog?.("[debug/illustrator/background-prompt] system:\n%s", systemPrompt);
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
    { role: "system" as const, content: systemPrompt },
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

export function resolveIllustratorImageConnectionId(
  chatMode: unknown,
  chatMetadata: Record<string, unknown>,
  agentImageConnectionId: unknown,
): string {
  return (
    readTrimmedString(
      chatMode === "game" ? chatMetadata.gameImageConnectionId : chatMetadata.illustratorImageConnectionId,
    ) || readTrimmedString(agentImageConnectionId)
  );
}

/** Resolve the shared Illustrator style precedence used by manual illustrations and scene backgrounds. */
export function resolveIllustratorStyleProfile(
  setupConfig: Record<string, unknown>,
  chatMetadata: Record<string, unknown>,
  connectionStyleProfileId: unknown,
  styleProfiles: ImageStyleProfileSettings,
): { styleProfileId: string | null; styleInstruction: string } {
  const styleProfileId =
    readTrimmedString(setupConfig.imageStyleProfileId) ||
    readTrimmedString(chatMetadata.imageStyleProfileId) ||
    readTrimmedString(connectionStyleProfileId) ||
    styleProfiles.defaultProfileId ||
    null;
  return {
    styleProfileId,
    styleInstruction: findImageStyleProfile(styleProfiles, styleProfileId).styleText.trim(),
  };
}

export async function resolveIllustratorPromptStyle(args: {
  db: DB;
  connections?: ConnectionsStorage;
  illustratorAgent: ResolvedAgent;
  chatMode: unknown;
  chatMetadata: Record<string, unknown>;
}): Promise<{ styleProfileId: string | null; styleInstruction: string }> {
  const connections = args.connections ?? createConnectionsStorage(args.db);
  const configuredImageConnectionId = resolveIllustratorImageConnectionId(
    args.chatMode,
    args.chatMetadata,
    args.illustratorAgent.settings.imageConnectionId,
  );
  const imageConnection =
    (configuredImageConnectionId ? await connections.getWithKey(configuredImageConnectionId) : null) ??
    (await connections.getDefaultForImageGeneration());
  const imageDefaults = imageConnection ? resolveConnectionImageDefaults(imageConnection) : null;
  const imageSettings = await loadImageGenerationUserSettings(args.db);
  const setupConfig = isRecord(args.chatMetadata.gameSetupConfig) ? args.chatMetadata.gameSetupConfig : {};
  return resolveIllustratorStyleProfile(
    setupConfig,
    args.chatMetadata,
    imageDefaults?.styleProfileId,
    imageSettings.styleProfiles,
  );
}

async function resolveIllustratorImageConnection(
  connections: ConnectionsStorage,
  illustratorAgent: ResolvedAgent,
  chatMode: "roleplay" | "game",
  chatMetadata: Record<string, unknown>,
) {
  const configuredId = resolveIllustratorImageConnectionId(
    chatMode,
    chatMetadata,
    illustratorAgent.settings.imageConnectionId,
  );
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

async function prepareIllustratorSceneBackground(
  args: IllustratorSceneBackgroundArgs,
  planOverride?: IllustratorBackgroundPlan,
) {
  const connections = createConnectionsStorage(args.db);
  const imageConnection = await resolveIllustratorImageConnection(
    connections,
    args.illustratorAgent,
    args.chatMode,
    args.chatMetadata,
  );
  const imageSettings = await loadImageGenerationUserSettings(args.db);
  const imageFallback = await resolveImageConnectionFallback(connections, imageConnection.id);
  const imageDefaults = resolveConnectionImageDefaults(imageConnection);
  const setupConfig = isRecord(args.chatMetadata.gameSetupConfig) ? args.chatMetadata.gameSetupConfig : {};
  const { styleProfileId, styleInstruction } = resolveIllustratorStyleProfile(
    setupConfig,
    args.chatMetadata,
    imageDefaults?.styleProfileId,
    imageSettings.styleProfiles,
  );
  const plan = planOverride ?? (await writeIllustratorBackgroundPlan({ ...args, styleInstruction }));
  const request: ChatBackgroundGenRequest = {
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
    imgDefaults: imageDefaults,
    imgQuality: resolveConnectionImageQuality(imageConnection),
    imgFallback: imageFallback,
    styleProfiles: imageSettings.styleProfiles,
    styleProfileId,
    promptOverridesStorage: createPromptOverridesStorage(args.db),
    size: imageSettings.background,
    preserveFullScenePrompt: true,
    providerReadyPrompt: true,
    omitProfileStyleText: true,
    omitProfileSubjectTags: true,
    debugLog: args.debugLog,
    signal: args.signal,
  };
  return { imageConnection, imageDefaults, imageSettings, plan, request };
}

export async function previewIllustratorSceneBackground(args: IllustratorSceneBackgroundArgs) {
  const prepared = await prepareIllustratorSceneBackground(args);
  const compiled = await buildBackgroundProviderPrompt(prepared.request);
  const size = resolveImagePromptReviewSize({
    connection: prepared.imageConnection,
    prompt: compiled.prompt,
    width: prepared.imageSettings.background.width,
    height: prepared.imageSettings.background.height,
    imageDefaults: prepared.imageDefaults,
  });
  return { plan: prepared.plan, ...compiled, ...size };
}

export async function generateIllustratorSceneBackground(
  args: IllustratorSceneBackgroundArgs & {
    /** Manual Gallery requests always render again, even when this location slug already exists. */
    force?: boolean;
    planOverride?: IllustratorBackgroundPlan;
    promptOverride?: string;
    negativePromptOverride?: string;
  },
): Promise<GeneratedIllustratorBackground> {
  const { plan, request } = await prepareIllustratorSceneBackground(args, args.planOverride);
  const filename = await generateChatBackground({
    ...request,
    promptOverride: args.promptOverride,
    negativePromptOverride: args.negativePromptOverride,
    force: args.force === true,
  });
  if (!filename) throw new Error("Background image generation failed. Check the Illustrator image connection.");
  return {
    ...plan,
    filename,
    url: `/api/backgrounds/file/${encodeURIComponent(filename)}`,
  };
}
