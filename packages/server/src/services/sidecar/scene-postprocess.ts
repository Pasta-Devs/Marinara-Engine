// ──────────────────────────────────────────────
// Sidecar — Scene Post-Processing
//
// Fuzzy-matches the raw model output (which may
// contain prose descriptions instead of exact
// asset tags) against the available asset lists,
// normalizes expression labels, and filters
// widget updates to valid IDs.
// ──────────────────────────────────────────────

import type {
  DirectionCommand,
  SceneAnalysis,
  SceneIllustrationRequest,
  SceneSegmentEffect,
  SceneSpotifyTrackCandidate,
  SceneSpotifyTrackSelection,
} from "@marinara-engine/shared";
import { normalizeLocationKind, normalizeMusicGenre, normalizeMusicIntensity } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";

const VALID_DIRECTION_EFFECTS = new Set<DirectionCommand["effect"]>([
  "fade_from_black",
  "fade_to_black",
  "flash",
  "screen_shake",
  "blur",
  "vignette",
  "letterbox",
  "color_grade",
  "focus",
  "pulse",
  "slow_zoom",
  "impact_zoom",
  "tilt",
  "desaturate",
  "chromatic_aberration",
  "film_grain",
  "rain_streaks",
  "spotlight",
]);

const VALID_DIRECTION_TARGETS = new Set<NonNullable<DirectionCommand["target"]>>(["background", "content", "all"]);
const VALID_SCENE_TIME_OF_DAY = new Set(["dawn", "morning", "afternoon", "evening", "night", "midnight"]);

function normalizeSceneTimeOfDay(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "null") return null;
  if (normalized === "noon" || normalized === "midday") return "afternoon";
  return VALID_SCENE_TIME_OF_DAY.has(normalized) ? normalized : null;
}

function sanitizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  return trimmed;
}

function sanitizeIllustration(raw: unknown): SceneIllustrationRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const prompt = sanitizeString(value.prompt);
  if (!prompt || prompt.length < 40) return null;

  const segmentRaw = value.segment;
  const segment =
    typeof segmentRaw === "number" && Number.isFinite(segmentRaw) && segmentRaw >= 0
      ? Math.floor(segmentRaw)
      : undefined;
  const characters = Array.isArray(value.characters)
    ? value.characters
        .map((character) => sanitizeString(character))
        .filter((character): character is string => !!character)
        .slice(0, 6)
    : undefined;
  const reason = sanitizeString(value.reason)?.slice(0, 300);
  const slug = sanitizeString(value.slug)
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return {
    prompt: prompt.slice(0, 1200),
    ...(segment !== undefined ? { segment } : {}),
    ...(characters?.length ? { characters } : {}),
    ...(reason ? { reason } : {}),
    ...(slug ? { slug } : {}),
  };
}

function sanitizeSpotifyTrack(
  raw: unknown,
  candidates: SceneSpotifyTrackCandidate[] | undefined,
): SceneSpotifyTrackSelection | null {
  if (!candidates?.length) return null;
  if (!raw || raw === "null") return null;

  const uri =
    typeof raw === "string"
      ? sanitizeString(raw)
      : raw && typeof raw === "object"
        ? sanitizeString((raw as Record<string, unknown>).uri)
        : null;
  if (!uri) return null;

  const candidate = candidates.find((track) => track.uri === uri);
  if (!candidate) {
    logger.debug(`[postprocess] spotifyTrack: "${uri}" → null (not in candidate list)`);
    return null;
  }

  return {
    uri: candidate.uri,
    name: candidate.name,
    artist: candidate.artist,
    album: candidate.album ?? null,
  };
}

function normalizeDirection(direction: DirectionCommand): DirectionCommand | null {
  if (!VALID_DIRECTION_EFFECTS.has(direction.effect)) return null;

  const normalized: DirectionCommand = { effect: direction.effect };

  if (typeof direction.duration === "number" && Number.isFinite(direction.duration) && direction.duration > 0) {
    normalized.duration = Math.min(direction.duration, 30);
  }

  if (typeof direction.intensity === "number" && Number.isFinite(direction.intensity)) {
    normalized.intensity = Math.max(0, Math.min(1, direction.intensity));
  }

  if (direction.target && VALID_DIRECTION_TARGETS.has(direction.target)) {
    normalized.target = direction.target;
  }

  if (direction.params && typeof direction.params === "object") {
    const params = Object.fromEntries(
      Object.entries(direction.params).filter(([, value]) => typeof value === "string" && value.trim().length > 0),
    );
    if (Object.keys(params).length > 0) {
      normalized.params = params;
    }
  }

  return normalized;
}

// ── Tag fuzzy-matching ──

/** Score how well a prose description matches an asset tag by keyword overlap. */
function tagScore(prose: string, tag: string): number {
  const words = prose
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const parts = tag
    .toLowerCase()
    .split(/[:\-_]+/)
    .filter((p) => p.length > 1);

  let score = 0;
  for (const part of parts) {
    for (const word of words) {
      if (part.includes(word) || word.includes(part)) {
        score++;
        break;
      }
    }
  }
  return score;
}

/** Find the best-matching tag for a prose description. */
function bestMatch(prose: string, tags: string[]): string | null {
  if (!tags.length) return null;
  let best: string | null = null;
  let bestScore = 0;
  for (const tag of tags) {
    const s = tagScore(prose, tag);
    if (s > bestScore) {
      bestScore = s;
      best = tag;
    }
  }
  return best;
}

// ── Public API ──

export interface PostProcessContext {
  availableBackgrounds: string[];
  availableSfx: string[];
  useSpotifyMusic?: boolean;
  generateSoundEffects?: boolean;
  generateMusic?: boolean;
  availableSpotifyTracks?: SceneSpotifyTrackCandidate[];
  validWidgetIds: Set<string>;
  characterNames: string[];
  canGenerateBackgrounds?: boolean;
}

/**
 * Post-process a single segment's per-beat effects:
 * fuzzy-match SFX and normalize generated background tags.
 */
function postProcessSegment(seg: SceneSegmentEffect, ctx: PostProcessContext): SceneSegmentEffect {
  const out = { ...seg };

  // Background — fuzzy-match or synthesise generated tag
  if (out.background && out.background !== "null") {
    if (!ctx.availableBackgrounds.includes(out.background)) {
      if (out.background.startsWith("backgrounds:generated:") && ctx.canGenerateBackgrounds) {
        // Already valid generated format
      } else {
        const matched = bestMatch(out.background, ctx.availableBackgrounds);
        if (matched) {
          logger.debug(`[postprocess] seg[${seg.segment}] bg: "${out.background}" → "${matched}"`);
          out.background = matched;
        } else if (ctx.canGenerateBackgrounds) {
          const slug = out.background
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 50);
          const gen = `backgrounds:generated:${slug}`;
          logger.debug(`[postprocess] seg[${seg.segment}] bg: "${out.background}" → "${gen}" (no tag match)`);
          out.background = gen;
        } else {
          logger.debug(`[postprocess] seg[${seg.segment}] bg: "${out.background}" → dropped (generation unavailable)`);
          out.background = undefined;
        }
      }
    }
  } else {
    out.background = undefined;
  }

  // SFX
  if (out.sfx?.length) {
    if (ctx.generateSoundEffects) {
      out.sfx = Array.from(
        new Set(out.sfx.map((item) => sanitizeGeneratedAudioPrompt(item)).filter((item): item is string => !!item)),
      ).slice(0, 3);
    } else {
      const matched: string[] = [];
      for (const item of out.sfx) {
        if (ctx.availableSfx.includes(item)) {
          matched.push(item);
        } else {
          const m = bestMatch(item, ctx.availableSfx);
          if (m && !matched.includes(m)) {
            logger.debug(`[postprocess] seg[${seg.segment}] sfx: "${item}" → "${m}"`);
            matched.push(m);
          } else {
            logger.debug(`[postprocess] seg[${seg.segment}] sfx: "${item}" → dropped`);
          }
        }
      }
      out.sfx = matched;
    }
  }
  out.music =
    ctx.generateMusic && !ctx.useSpotifyMusic ? (sanitizeGeneratedAudioPrompt(out.music) ?? undefined) : undefined;

  // Widget Updates
  const outWithWidgets = out as SceneSegmentEffect & { widgetUpdates?: Array<{ widgetId?: string }> };
  if (outWithWidgets.widgetUpdates?.length) {
    const before = outWithWidgets.widgetUpdates.length;
    outWithWidgets.widgetUpdates = outWithWidgets.widgetUpdates.filter((wu) =>
      wu.widgetId ? ctx.validWidgetIds.has(wu.widgetId) : false,
    );
    if (outWithWidgets.widgetUpdates.length !== before) {
      logger.debug(
        `[postprocess] seg[${seg.segment}] widgets: ${before} → ${outWithWidgets.widgetUpdates.length} (invalid IDs removed)`,
      );
    }
  }

  // Cinematic directions
  if (out.directions?.length) {
    out.directions = out.directions
      .map((direction) => normalizeDirection(direction))
      .filter((direction): direction is DirectionCommand => !!direction)
      .slice(0, 1);
  }

  return out;
}

function thinSegmentDirections(segments: SceneSegmentEffect[]): SceneSegmentEffect[] {
  let lastDirectionSegment = -999;
  return segments.map((segment) => {
    if (!segment.directions?.length) return segment;
    if (segment.segment - lastDirectionSegment < 3) {
      return { ...segment, directions: undefined };
    }
    lastDirectionSegment = segment.segment;
    return segment;
  });
}

function capCombinedDirections(result: SceneAnalysis): SceneAnalysis {
  let remaining = 2;
  if (result.directions?.length) {
    result.directions = result.directions.slice(0, remaining);
    remaining -= result.directions.length;
  }
  if (result.segmentEffects?.length) {
    result.segmentEffects = result.segmentEffects.map((segment) => {
      if (!segment.directions?.length) return segment;
      if (remaining <= 0) return { ...segment, directions: undefined };
      const directions = segment.directions.slice(0, remaining);
      remaining -= directions.length;
      return { ...segment, directions };
    });
  }
  return result;
}

/**
 * Clean up the raw model output so every field uses real asset tags,
 * valid direction values, and canonical background tags.
 */
export function postProcessSceneResult(raw: SceneAnalysis, ctx: PostProcessContext): SceneAnalysis {
  const result = { ...raw };
  const rawRecord = raw as unknown as Record<string, unknown>;

  // ── Sanitize string "null" → actual null (grammar sometimes emits the string) ──
  if (result.background === "null") result.background = null;
  if (result.weather === "null") result.weather = null;
  result.timeOfDay = normalizeSceneTimeOfDay(rawRecord.timeOfDay);
  result.music =
    ctx.generateMusic && !ctx.useSpotifyMusic ? sanitizeGeneratedAudioPrompt(rawRecord.music) : null;
  result.ambient = null;
  if (ctx.useSpotifyMusic || ctx.generateMusic) {
    result.musicGenre = null;
    result.musicIntensity = null;
  } else {
    result.musicGenre = normalizeMusicGenre(rawRecord.musicGenre);
    result.musicIntensity = normalizeMusicIntensity(rawRecord.musicIntensity);
  }
  result.locationKind = normalizeLocationKind(rawRecord.locationKind);
  result.spotifyTrack = ctx.useSpotifyMusic
    ? sanitizeSpotifyTrack(rawRecord.spotifyTrack, ctx.availableSpotifyTracks)
    : null;

  // ── Background ──
  if (result.background && !ctx.availableBackgrounds.includes(result.background)) {
    // If the model already output a backgrounds:generated:* tag, leave it as-is
    if (result.background.startsWith("backgrounds:generated:") && ctx.canGenerateBackgrounds) {
      // Already valid generated format — no change needed
    } else {
      const matched = bestMatch(result.background, ctx.availableBackgrounds);
      if (matched) {
        logger.debug(`[postprocess] bg: "${result.background}" → "${matched}"`);
        result.background = matched;
      } else if (ctx.canGenerateBackgrounds) {
        // Synthesise a generated-background slug the client can render
        const slug = result.background
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 50);
        const gen = `backgrounds:generated:${slug}`;
        logger.debug(`[postprocess] bg: "${result.background}" → "${gen}" (no tag match)`);
        result.background = gen;
      } else {
        logger.debug(`[postprocess] bg: "${result.background}" → null (generation unavailable)`);
        result.background = null;
      }
    }
  }

  // Music and ambient file tags are scored deterministically by scoreMusic/scoreAmbient.
  // Scene analysis only provides compact hints: musicGenre, musicIntensity, locationKind.

  // ── Weather — map non-visual values to visual equivalents ──
  if (result.weather) {
    const weatherMap: Record<string, string> = {
      cold: "frost",
      hot: "clear",
      freezing: "frost",
    };
    const mapped = weatherMap[result.weather.toLowerCase()];
    if (mapped) {
      logger.debug(`[postprocess] weather: "${result.weather}" → "${mapped}"`);
      result.weather = mapped;
    }
  }

  // ── Top-level widget updates — now handled by the GM model, not sidecar ──
  // Clear any stale widgetUpdates the sidecar might still produce
  const resultWithWidgets = result as SceneAnalysis & { widgetUpdates?: unknown[] };
  if (resultWithWidgets.widgetUpdates?.length) {
    logger.debug(
      `[postprocess] Ignoring ${resultWithWidgets.widgetUpdates.length} sidecar widgetUpdates (GM handles widgets now)`,
    );
    resultWithWidgets.widgetUpdates = [];
  }

  // ── Cinematic directions ──
  if (result.directions?.length) {
    const before = result.directions.length;
    result.directions = result.directions
      .map((direction) => normalizeDirection(direction))
      .filter((direction): direction is DirectionCommand => !!direction)
      .slice(0, 2);
    if (result.directions.length !== before) {
      logger.debug(`[postprocess] directions: ${before} → ${result.directions.length} (invalid entries removed)`);
    }
  }

  // ── Segment Effects (per-beat) ──
  if (result.segmentEffects?.length) {
    result.segmentEffects = thinSegmentDirections(result.segmentEffects.map((seg) => postProcessSegment(seg, ctx)));
  }

  capCombinedDirections(result);

  result.illustration = sanitizeIllustration((result as unknown as Record<string, unknown>).illustration);

  return result;
}

function sanitizeGeneratedAudioPrompt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const prompt = value.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
  return prompt && prompt.toLowerCase() !== "null" ? prompt : null;
}
