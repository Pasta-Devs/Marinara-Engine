// ──────────────────────────────────────────────
// Avatar agents: streaming emotion classifier (lane: director)
// ──────────────────────────────────────────────
// Roleplay's expression source while a reply streams. Two tiers (AVATAR_CLASSIFIER_TIERS):
//   - keywords: the shared expression keyword list (classifyExpressionKeywords), instant and always there;
//   - local-model: a small multilingual emotion model (classifier/local-emotion-model.ts), run in a worker thread.
//     It downloads and loads only through prepareAvatarEmotionModel(), which the classify route calls for a
//     Roleplay chat that has 2D or 3D Avatars turned on; a classify request never downloads or loads anything, it
//     uses the model only once it is ready. It unloads after ten idle minutes and loads again from disk on the next
//     prepare. Lite installs, servers without onnxruntime-node's native binding (Termux) and machines with less than
//     3 GB of memory keep the keyword tier.
// When a keyword names an emotion, the model's scores are averaged with it: the model reads dialogue well but
// calls most narrated prose neutral, and explicit words ("tears", "laughs") are the strongest evidence there is.
// Each result also names the more specific feeling inside its emotion when one stands out (the model's strongest
// label of that emotion, or a keyword's), which a talking head with a face for it shows.
// Never an LLM, never LLM-written tags, never a Decision model: those run after generation and cannot follow the
// stream. Game mode uses the Game Master's per-line expressions and does not call this.
// User text is logged at debug level only; debug mode and DEBUG_AGENTS show counts, tiers and timings.
import { createHash } from "node:crypto";
import {
  AVATAR_EMOTIONS,
  AVATAR_FEELING_EMOTIONS,
  classifyExpressionKeywords,
  isAvatarExtraFeeling,
  type AvatarClassification,
  type AvatarClassifierTier,
  type AvatarClassifyRequest,
  type AvatarClassifyResponse,
  type AvatarEmotion,
  type AvatarExtraFeeling,
  type AvatarFeeling,
} from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import { logDebugOverride, logger } from "../../lib/logger.js";
import {
  AVATAR_EMOTION_MODEL_BYTES,
  AVATAR_EMOTION_MODEL_ID,
  downloadLocalEmotionModel,
  isLocalEmotionModelDownloaded,
  localEmotionModelUnsupportedReason,
  removeLocalEmotionModel,
  startLocalEmotionModel,
  type AvatarEmotionModel,
} from "./classifier/local-emotion-model.js";

export { AVATAR_EMOTION_MODEL_ID, type AvatarEmotionModel };

const IDLE_UNLOAD_MS = 10 * 60_000;
const LOAD_RETRY_MS = 10 * 60_000;
const CACHE_LIMIT = 512;

/** The model's own decision threshold per label, from thresholds.json at the pinned revision. A score at twice its
 *  threshold counts in full, so labels the model rarely fires are not drowned by `neutral`. Each label's emotion
 *  and how much of it the label carries are the shared AVATAR_FEELING_EMOTIONS. */
export const GO_EMOTION_THRESHOLDS: Readonly<Record<AvatarFeeling, number>> = {
  admiration: 0.4,
  amusement: 0.2,
  anger: 0.28,
  annoyance: 0.16,
  approval: 0.16,
  caring: 0.28,
  confusion: 0.16,
  curiosity: 0.26,
  desire: 0.3,
  disappointment: 0.16,
  disapproval: 0.2,
  disgust: 0.32,
  embarrassment: 0.2,
  excitement: 0.18,
  fear: 0.2,
  gratitude: 0.6,
  grief: 0.1,
  joy: 0.26,
  love: 0.5,
  nervousness: 0.62,
  optimism: 0.4,
  pride: 0.28,
  realization: 0.18,
  relief: 0.32,
  remorse: 0.14,
  sadness: 0.34,
  surprise: 0.2,
  neutral: 0.36,
};

/** The model's labels with a finite score, as known feelings. */
function modelFeelings(labelScores: Record<string, number>): Array<[AvatarFeeling, number]> {
  return Object.entries(labelScores).filter(
    (entry): entry is [AvatarFeeling, number] =>
      Object.hasOwn(GO_EMOTION_THRESHOLDS, entry[0]) && Number.isFinite(entry[1]),
  );
}

export interface AvatarClassifierOptions {
  signal?: AbortSignal;
}

/** Downloads the model when it is missing and starts it; `onProgress` gets the bytes downloaded so far. */
export type AvatarEmotionModelLoader = (onProgress: (downloadedBytes: number) => void) => Promise<AvatarEmotionModel>;

/** What the avatar agents' pages show about the local model. */
export interface AvatarEmotionModelStatus {
  /** Why this server keeps the word list (Lite, no ONNX runtime, too little memory), or null. */
  unsupported: "lite" | "no-runtime" | "low-memory" | null;
  state: "not-downloaded" | "downloading" | "loading" | "downloaded" | "failed";
  downloadedBytes: number;
  totalBytes: number;
}

type ModelState =
  | { status: "idle" }
  | { status: "loading"; promise: Promise<AvatarEmotionModel | null> }
  | { status: "ready"; model: AvatarEmotionModel }
  | { status: "failed"; retryAt: number };

let modelState: ModelState = { status: "idle" };
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let testLoader: AvatarEmotionModelLoader | null = null;
/** Bumped by every prepare and every reset, so a stale load cannot report progress or become the model. */
let loadAttempt = 0;
let downloading = false;
let downloadedBytes = 0;
const cache = new Map<string, AvatarClassification>();

async function downloadAndStartLocalModel(onProgress: (downloadedBytes: number) => void) {
  if (!isLocalEmotionModelDownloaded()) {
    logger.info("[avatar-classify] Downloading the local emotion model %s", AVATAR_EMOTION_MODEL_ID);
    await downloadLocalEmotionModel(onProgress);
  }
  onProgress(AVATAR_EMOTION_MODEL_BYTES);
  const model = await startLocalEmotionModel((err) => {
    if (modelState.status !== "ready" || modelState.model !== model) return;
    modelState = { status: "idle" };
    logger.warn(err, "[avatar-classify] The local emotion model stopped; avatars use keywords until it loads again");
  });
  return model;
}

function unsupportedReason(): AvatarEmotionModelStatus["unsupported"] {
  if (!testLoader) return localEmotionModelUnsupportedReason();
  return process.env.MARINARA_LITE === "true" || process.env.MARINARA_LITE === "1" ? "lite" : null;
}

/** Whether this server can run the local model at all (it may still need downloading or loading). */
export function isAvatarEmotionModelSupported(): boolean {
  return unsupportedReason() === null;
}

export function avatarEmotionModelStatus(): AvatarEmotionModelStatus {
  let state: AvatarEmotionModelStatus["state"];
  if (modelState.status === "ready") state = "downloaded";
  else if (modelState.status === "loading") state = downloading ? "downloading" : "loading";
  else if (modelState.status === "failed") state = "failed";
  else state = !testLoader && isLocalEmotionModelDownloaded() ? "downloaded" : "not-downloaded";
  return {
    unsupported: unsupportedReason(),
    state,
    downloadedBytes: state === "downloaded" ? AVATAR_EMOTION_MODEL_BYTES : downloadedBytes,
    totalBytes: AVATAR_EMOTION_MODEL_BYTES,
  };
}

function scheduleIdleUnload() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (modelState.status !== "ready") return;
    const { model } = modelState;
    modelState = { status: "idle" };
    logger.info("[avatar-classify] Unloaded the local emotion model after %d idle minutes", IDLE_UNLOAD_MS / 60_000);
    void model.dispose().catch((err) => logger.warn(err, "[avatar-classify] Failed to unload the local emotion model"));
  }, IDLE_UNLOAD_MS);
  idleTimer.unref?.();
}

/** Downloads the local model when it is missing, starts it in its worker, and resolves once it is ready (or null
 *  when this server cannot run it, or a failed attempt is waiting to retry). The classify route's prepare request
 *  calls this for a Roleplay chat with an avatar agent on, and the Built-in model (emotions) page when the user
 *  presses Download; a classify request itself never does. `force` retries a failed attempt at once. */
export function prepareAvatarEmotionModel(force = false): Promise<AvatarEmotionModel | null> {
  if (!isAvatarEmotionModelSupported()) return Promise.resolve(null);
  if (modelState.status === "ready") {
    scheduleIdleUnload();
    return Promise.resolve(modelState.model);
  }
  if (modelState.status === "loading") return modelState.promise;
  if (modelState.status === "failed" && !force && Date.now() < modelState.retryAt) return Promise.resolve(null);
  const startedAt = Date.now();
  logger.info("[avatar-classify] Preparing the local emotion model %s", AVATAR_EMOTION_MODEL_ID);
  // A load that was reset meanwhile (setAvatarEmotionModelLoaderForTests) must not overwrite the newer state.
  const attempt = ++loadAttempt;
  const current = () => attempt === loadAttempt;
  downloading = true;
  downloadedBytes = 0;
  const load = testLoader ?? downloadAndStartLocalModel;
  const promise: Promise<AvatarEmotionModel | null> = load((bytes) => {
    if (!current()) return;
    downloadedBytes = bytes;
    if (bytes >= AVATAR_EMOTION_MODEL_BYTES) downloading = false;
  }).then(
    (model) => {
      if (!current()) {
        void model.dispose().catch(() => {});
        return null;
      }
      downloading = false;
      modelState = { status: "ready", model };
      scheduleIdleUnload();
      logger.info("[avatar-classify] Local emotion model ready in %dms", Date.now() - startedAt);
      return model;
    },
    (err: unknown) => {
      if (!current()) return null;
      downloading = false;
      modelState = { status: "failed", retryAt: Date.now() + LOAD_RETRY_MS };
      logger.warn(err, "[avatar-classify] Local emotion model unavailable; avatars use keywords for now");
      return null;
    },
  );
  modelState = { status: "loading", promise };
  return promise;
}

function pickBest(scores: Record<AvatarEmotion, number>): AvatarClassification {
  let best: AvatarEmotion = "neutral";
  for (const emotion of AVATAR_EMOTIONS) if (scores[emotion] > scores[best]) best = emotion;
  return { emotion: best, weight: scores[best], scores };
}

/** Folds the model's 28 label scores into the six avatar emotions (summing to 1). Exported for the regression. */
export function avatarEmotionScoresFromModel(labelScores: Record<string, number>): Record<AvatarEmotion, number> {
  const scores = Object.fromEntries(AVATAR_EMOTIONS.map((emotion) => [emotion, 0])) as Record<AvatarEmotion, number>;
  for (const [label, score] of modelFeelings(labelScores)) {
    const { emotion, weight } = AVATAR_FEELING_EMOTIONS[label];
    scores[emotion] += Math.min(1, Math.max(0, score) / GO_EMOTION_THRESHOLDS[label] / 2) * weight;
  }
  const total = AVATAR_EMOTIONS.reduce((sum, emotion) => sum + scores[emotion], 0);
  if (total <= 0) return { ...scores, neutral: 1 };
  for (const emotion of AVATAR_EMOTIONS) scores[emotion] /= total;
  return scores;
}

/** The specific feeling the model reads inside `emotion`: that emotion's strongest label for its threshold, when it
 *  reaches the threshold and is not the emotion's plain label (joy, sadness...). Exported for the regression. */
export function avatarFeelingFromModel(
  labelScores: Record<string, number>,
  emotion: AvatarEmotion,
): AvatarExtraFeeling | null {
  let best: AvatarFeeling | null = null;
  let bestRatio = 0;
  for (const [label, score] of modelFeelings(labelScores)) {
    const ratio = score / GO_EMOTION_THRESHOLDS[label];
    if (AVATAR_FEELING_EMOTIONS[label].emotion === emotion && ratio > bestRatio) {
      best = label;
      bestRatio = ratio;
    }
  }
  return bestRatio >= 1 && isAvatarExtraFeeling(best) ? best : null;
}

/** The local-model answer for one text: the model's emotions, averaged with the keyword tier when a keyword
 *  names an emotion. */
export function blendAvatarEmotion(
  modelScores: Record<AvatarEmotion, number>,
  keywords: AvatarClassification,
): AvatarClassification {
  if (keywords.emotion === "neutral") return pickBest({ ...modelScores });
  const blended = Object.fromEntries(
    AVATAR_EMOTIONS.map((emotion) => [emotion, (modelScores[emotion] + keywords.scores[emotion]) / 2]),
  ) as Record<AvatarEmotion, number>;
  return pickBest(blended);
}

function cacheKey(tier: AvatarClassifierTier, text: string): string {
  return `${tier}:${createHash("sha1").update(text).digest("base64url")}`;
}

function remember(key: string, result: AvatarClassification) {
  cache.delete(key);
  cache.set(key, result);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
}

function recall(key: string): AvatarClassification | undefined {
  const hit = cache.get(key);
  if (hit) remember(key, hit);
  return hit;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("Classification aborted");
}

export async function classifyAvatarEmotions(
  request: AvatarClassifyRequest,
  options: AvatarClassifierOptions = {},
): Promise<AvatarClassifyResponse> {
  const startedAt = performance.now();
  const debug = request.debugMode === true || isDebugAgentsEnabled();
  // Never a download or a load here: only prepareAvatarEmotionModel() does that, for a chat with an avatar agent on.
  const model = request.tier !== "keywords" && modelState.status === "ready" ? modelState.model : null;
  const tier: AvatarClassifierTier = model ? "local-model" : "keywords";
  const results: AvatarClassification[] = [];
  let cached = 0;
  let failure: unknown = null;
  let failed = 0;
  for (const text of request.texts) {
    throwIfAborted(options.signal);
    const key = cacheKey(tier, text);
    const hit = recall(key);
    if (hit) {
      cached += 1;
      results.push(hit);
      continue;
    }
    const keywords = classifyExpressionKeywords(text);
    let result = keywords;
    let answered = true;
    if (model) {
      try {
        const labelScores = await model.classify(text);
        result = blendAvatarEmotion(avatarEmotionScoresFromModel(labelScores), keywords);
        // A keyword's feeling is the plainer evidence, when it belongs to the emotion the blend chose.
        result.feeling =
          keywords.feeling && AVATAR_FEELING_EMOTIONS[keywords.feeling].emotion === result.emotion
            ? keywords.feeling
            : avatarFeelingFromModel(labelScores, result.emotion);
      } catch (err) {
        // Not cached: the next request for this text asks the model again.
        answered = false;
        failure ??= err;
        failed += 1;
      }
    }
    if (answered) remember(key, result);
    results.push(result);
  }
  if (failed > 0) {
    logger.warn(
      failure,
      "[avatar-classify] The local emotion model failed on %d text(s); using keywords for them",
      failed,
    );
  }
  if (model) scheduleIdleUnload();
  const latencyMs = Math.round(performance.now() - startedAt);
  logDebugOverride(
    debug,
    "[avatar-classify] %d text(s), %d cached, tier %s in %dms: %s",
    results.length,
    cached,
    tier,
    latencyMs,
    results
      .map((result) => `${result.emotion}${result.feeling ? `/${result.feeling}` : ""}:${result.weight.toFixed(2)}`)
      .join(" "),
  );
  logger.debug({ texts: request.texts }, "[avatar-classify] Classified texts");
  return { results, tier, model: model ? AVATAR_EMOTION_MODEL_ID : null, latencyMs };
}

/** True while the model downloads or starts: its files are being written or read. */
export function isAvatarEmotionModelLoading(): boolean {
  return modelState.status === "loading";
}

/**
 * Unloads the model and deletes its files; avatars use keywords until it is downloaded again.
 * Refused while a download or load is running (the route answers 409): nothing stops that
 * download, and it would write the files back after they were deleted.
 */
export async function removeAvatarEmotionModel(): Promise<void> {
  if (isAvatarEmotionModelLoading()) throw new Error("The emotion model is downloading or starting");
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  const ready = modelState.status === "ready" ? modelState.model : null;
  modelState = { status: "idle" };
  loadAttempt += 1;
  downloading = false;
  downloadedBytes = 0;
  if (ready) await ready.dispose().catch(() => {});
  if (!testLoader) removeLocalEmotionModel();
}

/** Regression hook: swaps the model loader (null restores the real one) and forgets the loaded model and cache. */
export async function setAvatarEmotionModelLoaderForTests(loader: AvatarEmotionModelLoader | null) {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  if (modelState.status === "ready") await modelState.model.dispose();
  modelState = { status: "idle" };
  loadAttempt += 1;
  downloading = false;
  downloadedBytes = 0;
  cache.clear();
  testLoader = loader;
}
