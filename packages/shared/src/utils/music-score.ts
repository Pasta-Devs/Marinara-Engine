// ──────────────────────────────────────────────
// Game Audio Score — Rule-Based Selectors
//
// Music uses two structured formats:
// - music:<state>:<genre>:<intensity>:<filename>   (the bundled/state library)
// - music:area:<slug>:<filename>                   (context tracks, #5161)
//   music:tier:<tier>:<filename>
//
// Context tracks are persistent per-place / per-encounter-tier compositions;
// when one matches the current context it wins outright and the CURRENT track
// is kept if it already belongs to that context — music changes when context
// changes, never per turn. The state library remains the universal fallback.
//
// Scene analysis provides compact direction fields (genre, intensity,
// location kind); the server/client pick actual asset tags deterministically.
// ──────────────────────────────────────────────

import type { GameActiveState } from "../types/game.js";

export const MUSIC_GENRES = [
  "fantasy",
  "horror",
  "romance",
  "mystery",
  "scifi",
  "modern",
  "slice_of_life",
  "adventure",
  "drama",
  "custom",
] as const;
export type MusicGenre = (typeof MUSIC_GENRES)[number];

export const MUSIC_INTENSITIES = ["calm", "tense", "intense"] as const;
export type MusicIntensity = (typeof MUSIC_INTENSITIES)[number];

export const LOCATION_KINDS = ["interior", "exterior", "underground", "urban", "nature"] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

export const MUSIC_ENEMY_TIERS = ["common", "miniboss", "boss", "special"] as const;
export type MusicEnemyTier = (typeof MUSIC_ENEMY_TIERS)[number];

export interface MusicScoreInput {
  state: GameActiveState;
  /** Small tie-breaker only. Main music selection comes from musicGenre/musicIntensity. */
  weather?: string | null;
  /** Small tie-breaker only. Main music selection comes from musicGenre/musicIntensity. */
  timeOfDay?: string | null;
  musicGenre?: MusicGenre | string | null;
  musicIntensity?: MusicIntensity | string | null;
  /** Stable slug of the current area (the same slug backgrounds key on).
   *  Outside combat, a matching `music:area:<slug>:*` track wins outright. */
  locationSlug?: string | null;
  /** Encounter tier while in combat; a matching `music:tier:<tier>:*` track wins outright. */
  enemyTier?: MusicEnemyTier | string | null;
  currentMusic?: string | null;
  recentMusic?: string[] | null;
  availableMusic: string[];
}

export interface AmbientScoreInput {
  state: GameActiveState;
  weather?: string | null;
  timeOfDay?: string | null;
  locationKind?: LocationKind | string | null;
  currentAmbient?: string | null;
  availableAmbient: string[];
  /** LLM-selected background tag — fallback only when locationKind is missing. */
  background?: string | null;
}

type ParsedMusicTag = {
  tag: string;
  state: GameActiveState;
  genre: MusicGenre;
  intensity: MusicIntensity;
  keywords: string[];
};

const GAME_STATES = new Set<GameActiveState>(["exploration", "dialogue", "combat", "travel_rest"]);
const MUSIC_GENRE_SET = new Set<string>(MUSIC_GENRES);
const MUSIC_INTENSITY_SET = new Set<string>(MUSIC_INTENSITIES);
const LOCATION_KIND_SET = new Set<string>(LOCATION_KINDS);
const MUSIC_ENEMY_TIER_SET = new Set<string>(MUSIC_ENEMY_TIERS);

const ENEMY_TIER_ALIASES: Record<string, MusicEnemyTier> = {
  elite: "miniboss",
  mini_boss: "miniboss",
  "mini-boss": "miniboss",
  final_boss: "boss",
  finalboss: "boss",
  unique: "special",
  legendary: "special",
};

export function normalizeMusicEnemyTier(value: string | null | undefined): MusicEnemyTier | null {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (MUSIC_ENEMY_TIER_SET.has(normalized)) return normalized as MusicEnemyTier;
  return ENEMY_TIER_ALIASES[normalized] ?? null;
}

/** Canonical area key for context music. The style follows the background
 *  slug conventions, but the key is its OWN namespace (music/area/<slug>) —
 *  nothing joins it to background slugs, whose generators use their own
 *  slugification and may differ on accented or very long names.
 *  Input is length-capped before any regex work and dash runs are trimmed
 *  with linear scans, never anchored `-+` patterns — location strings arrive
 *  from request payloads, and CodeQL rightly flags polynomial regexes on
 *  uncontrolled input (the class this repo scrubbed in #5067). */
export function musicAreaSlug(value: string | null | undefined): string | null {
  // Only the first 60 slug chars ever matter; 200 source chars is generous
  // headroom for leading punctuation while keeping regex input bounded.
  const collapsed = (value ?? "")
    .slice(0, 200)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  let start = 0;
  let end = collapsed.length;
  while (start < end && collapsed.charCodeAt(start) === 45 /* '-' */) start++;
  while (end > start && collapsed.charCodeAt(end - 1) === 45) end--;
  let slug = collapsed.slice(start, end).slice(0, 60);
  // The 60-char cut can land on a dash; retrim the tail the same way.
  let tail = slug.length;
  while (tail > 0 && slug.charCodeAt(tail - 1) === 45) tail--;
  slug = slug.slice(0, tail);
  if (slug) return slug;
  // Non-Latin location names (CJK, Cyrillic, …) strip to nothing; a stable
  // hash keeps the area axis alive for them instead of silently disabling it.
  const source = (value ?? "").slice(0, 200).trim().toLowerCase();
  if (!source) return null;
  let h = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    h ^= source.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `x${(h >>> 0).toString(36)}`;
}

const INTENSITY_RANK: Record<MusicIntensity, number> = {
  calm: 0,
  tense: 1,
  intense: 2,
};

const STATE_DEFAULT_INTENSITY: Record<GameActiveState, MusicIntensity> = {
  exploration: "tense",
  dialogue: "calm",
  combat: "intense",
  travel_rest: "calm",
};

const WEATHER_INTENSITY: Record<string, MusicIntensity> = {
  storm: "intense",
  stormy: "intense",
  blizzard: "intense",
  sandstorm: "intense",
  fog: "tense",
  foggy: "tense",
  rain: "tense",
  rainy: "tense",
  heavy_rain: "tense",
  frost: "tense",
  snowy: "tense",
};

const TIME_INTENSITY: Record<string, MusicIntensity> = {
  evening: "tense",
  night: "tense",
  midnight: "tense",
};

const WEATHER_KEYWORDS: Record<string, string[]> = {
  clear: ["clear", "sun", "light", "warm"],
  cloudy: ["cloud", "overcast"],
  fog: ["fog", "mist"],
  foggy: ["fog", "mist"],
  rainy: ["rain", "storm"],
  rain: ["rain", "storm"],
  stormy: ["storm", "thunder"],
  storm: ["storm", "thunder"],
  snowy: ["snow", "frost", "ice"],
  snow: ["snow", "frost", "ice"],
  frost: ["snow", "frost", "ice"],
  windy: ["wind"],
  wind: ["wind"],
};

const TIME_KEYWORDS: Record<string, string[]> = {
  dawn: ["dawn", "morning", "light"],
  morning: ["morning", "light"],
  noon: ["day", "light"],
  afternoon: ["day", "light"],
  evening: ["evening", "dusk"],
  night: ["night", "dark"],
  midnight: ["night", "midnight", "dark"],
};

// Weather → preferred ambient keywords
const WEATHER_AMBIENT: Record<string, string[]> = {
  clear: ["birds", "wind", "water"],
  cloudy: ["wind"],
  overcast: ["wind", "eerie"],
  rain: ["rain"],
  rainy: ["rain"],
  heavy_rain: ["rain", "howling"],
  storm: ["rain", "thunder", "howling"],
  stormy: ["rain", "thunder", "howling"],
  snow: ["wind", "howling"],
  snowy: ["wind", "howling"],
  blizzard: ["wind", "howling"],
  frost: ["wind", "howling"],
  fog: ["eerie", "wind"],
  foggy: ["eerie", "wind"],
  wind: ["wind", "howling"],
  windy: ["wind", "howling"],
  hail: ["rain", "wind"],
  sandstorm: ["wind", "howling"],
  heat_wave: ["birds"],
};

// Time → preferred ambient keywords
const TIME_AMBIENT: Record<string, string[]> = {
  dawn: ["birds"],
  morning: ["birds"],
  noon: [],
  afternoon: [],
  evening: ["crickets"],
  night: ["crickets", "eerie"],
  midnight: ["eerie", "crickets"],
};

// State → preferred ambient keywords
const STATE_AMBIENT: Record<GameActiveState, string[]> = {
  exploration: ["nature", "birds", "wind", "water", "river"],
  dialogue: ["crowd", "murmur", "interior"],
  combat: ["wind", "rain"],
  travel_rest: ["rain-on-roof", "river", "water", "birds"],
};

const LOCATION_AMBIENT: Record<LocationKind, string[]> = {
  interior: ["interior", "rain-on-roof", "eerie", "dungeon", "murmur"],
  exterior: ["nature", "wind", "birds", "water", "river"],
  underground: ["dungeon", "cave", "eerie", "water", "drip"],
  urban: ["urban", "crowd", "murmur", "commotion"],
  nature: ["nature", "birds", "wind", "water", "river", "crickets"],
};

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function normalizeToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return normalized && normalized !== "null" ? normalized : null;
}

export function normalizeMusicGenre(value: unknown): MusicGenre | null {
  const normalized = normalizeToken(value);
  if (!normalized) return null;

  const aliases: Record<string, MusicGenre> = {
    sci_fi: "scifi",
    science_fiction: "scifi",
    slice: "slice_of_life",
    slice_of_life: "slice_of_life",
    sliceoflife: "slice_of_life",
    everyday: "slice_of_life",
    cozy: "slice_of_life",
  };

  if (aliases[normalized]) return aliases[normalized];
  return MUSIC_GENRE_SET.has(normalized) ? (normalized as MusicGenre) : null;
}

export function normalizeMusicIntensity(value: unknown): MusicIntensity | null {
  const normalized = normalizeToken(value);
  if (!normalized) return null;

  const aliases: Record<string, MusicIntensity> = {
    low: "calm",
    soft: "calm",
    peaceful: "calm",
    rest: "calm",
    medium: "tense",
    suspense: "tense",
    suspenseful: "tense",
    dramatic: "tense",
    high: "intense",
    action: "intense",
    climax: "intense",
    combat: "intense",
    urgent: "intense",
  };

  if (aliases[normalized]) return aliases[normalized];
  return MUSIC_INTENSITY_SET.has(normalized) ? (normalized as MusicIntensity) : null;
}

export function normalizeLocationKind(value: unknown): LocationKind | null {
  const normalized = normalizeToken(value);
  if (!normalized) return null;

  const aliases: Record<string, LocationKind> = {
    indoors: "interior",
    inside: "interior",
    room: "interior",
    dungeon: "underground",
    cave: "underground",
    city: "urban",
    town: "urban",
    street: "urban",
    outdoors: "exterior",
    outside: "exterior",
    wilderness: "nature",
    forest: "nature",
  };

  if (aliases[normalized]) return aliases[normalized];
  return LOCATION_KIND_SET.has(normalized) ? (normalized as LocationKind) : null;
}

type ParsedContextMusicTag = { tag: string; axis: "area" | "tier"; key: string };

/** Context tracks (#5161): music:area:<slug>:<name> and music:tier:<tier>:<name>. */
function parseContextMusicTag(tag: string): ParsedContextMusicTag | null {
  const parts = tag.split(":");
  if (parts.length < 4 || parts[0] !== "music") return null;
  const axis = parts[1];
  const key = parts[2]?.toLowerCase();
  if (!key) return null;
  if (axis === "area") return { tag, axis: "area", key };
  // Case-insensitive like area keys: a user-created music/tier/Boss folder
  // must not be silently unselectable.
  if (axis === "tier" && MUSIC_ENEMY_TIER_SET.has(key)) return { tag, axis: "tier", key };
  return null;
}

/** True for #5161 context tracks (music:area:* / music:tier:*). Used by the
 *  client to keep context tags OUT of the recent-music anti-repeat history —
 *  a kept area theme would otherwise fill the whole window and disable the
 *  legacy pool's rotation memory. */
export function isContextMusicTag(tag: string): boolean {
  return parseContextMusicTag(tag) !== null;
}

/** Stability contract for context tracks: keep the current track whenever it
 *  still belongs to the selected context; otherwise prefer a variant that
 *  hasn't just played. */
function pickContextTrack(tags: string[], currentMusic?: string | null, recentMusic?: string[] | null): string {
  if (currentMusic && tags.includes(currentMusic)) return currentMusic;
  const recent = new Set(recentMusic ?? []);
  const fresh = tags.filter((tag) => !recent.has(tag));
  return pickRandom(fresh.length ? fresh : tags);
}

function parseMusicTag(tag: string): ParsedMusicTag | null {
  const parts = tag.split(":");
  if (parts.length < 5 || parts[0] !== "music") return null;

  const state = parts[1] as GameActiveState | undefined;
  if (!state || !GAME_STATES.has(state)) return null;

  const genre = normalizeMusicGenre(parts[2]);
  const intensity = normalizeMusicIntensity(parts[3]);
  if (!genre || !intensity) return null;

  const keywords = parts
    .slice(2)
    .join(":")
    .toLowerCase()
    .split(/[:\-_]+/)
    .filter((part) => part.length > 1);

  return { tag, state, genre, intensity, keywords };
}

function inferMusicIntensity(
  state: GameActiveState,
  weather?: string | null,
  timeOfDay?: string | null,
): MusicIntensity {
  const weatherIntensity = weather ? WEATHER_INTENSITY[weather.toLowerCase()] : null;
  if (weatherIntensity && INTENSITY_RANK[weatherIntensity] > INTENSITY_RANK[STATE_DEFAULT_INTENSITY[state]]) {
    return weatherIntensity;
  }

  const timeIntensity = timeOfDay ? TIME_INTENSITY[timeOfDay.toLowerCase()] : null;
  if (timeIntensity && INTENSITY_RANK[timeIntensity] > INTENSITY_RANK[STATE_DEFAULT_INTENSITY[state]]) {
    return timeIntensity;
  }

  return STATE_DEFAULT_INTENSITY[state];
}

function musicAccentScore(candidate: ParsedMusicTag, weather?: string | null, timeOfDay?: string | null): number {
  const keywords = new Set<string>();
  for (const keyword of weather ? (WEATHER_KEYWORDS[weather.toLowerCase()] ?? []) : []) {
    keywords.add(keyword);
  }
  for (const keyword of timeOfDay ? (TIME_KEYWORDS[timeOfDay.toLowerCase()] ?? []) : []) {
    keywords.add(keyword);
  }
  if (!keywords.size) return 0;

  let score = 0;
  for (const keyword of keywords) {
    if (candidate.keywords.some((part) => part.includes(keyword) || keyword.includes(part))) score += 1;
  }
  return Math.min(score, 2);
}

function scoreStructuredMusic(
  candidate: ParsedMusicTag,
  desiredGenre: MusicGenre | null,
  desiredIntensity: MusicIntensity,
  hasExactGenre: boolean,
  weather?: string | null,
  timeOfDay?: string | null,
): number {
  let score = 10;

  if (desiredGenre) {
    if (candidate.genre === desiredGenre) {
      score += 12;
    } else if (candidate.genre === "custom") {
      score += 2;
    } else if (hasExactGenre) {
      score -= 4;
    }
  }

  const distance = Math.abs(INTENSITY_RANK[candidate.intensity] - INTENSITY_RANK[desiredIntensity]);
  score += distance === 0 ? 8 : distance === 1 ? 3 : -4;
  score += musicAccentScore(candidate, weather, timeOfDay);

  return score;
}

/**
 * Pick the best music tag for the current game context.
 * Returns `null` only when there is no music or no structured candidates for this state.
 * Since #5161 the keep-current contract applies everywhere: the current track is
 * KEPT while it still fits the context (context set membership, or a legacy score
 * within one point of the best), and rotation happens only when the context — the
 * area, the encounter tier, or the state/genre/intensity — actually moved.
 */
export function scoreMusic(input: MusicScoreInput): string | null {
  const { state, weather, timeOfDay, currentMusic, recentMusic, availableMusic } = input;
  if (!availableMusic.length) return null;

  // Context tracks win outright (#5161): tier tracks during combat, area
  // tracks everywhere else. The state library below never sees these tags
  // (parseMusicTag rejects them), and they never leak across contexts.
  const contextTags = availableMusic
    .map((tag) => parseContextMusicTag(tag))
    .filter((candidate): candidate is ParsedContextMusicTag => !!candidate);
  if (state === "combat") {
    const tier = normalizeMusicEnemyTier(typeof input.enemyTier === "string" ? input.enemyTier : null);
    if (tier) {
      const tierTags = contextTags
        .filter((candidate) => candidate.axis === "tier" && candidate.key === tier)
        .map((candidate) => candidate.tag);
      if (tierTags.length) return pickContextTrack(tierTags, currentMusic, recentMusic);
    }
  } else {
    const slug = (input.locationSlug ?? "").trim().toLowerCase();
    if (slug) {
      const areaTags = contextTags
        .filter((candidate) => candidate.axis === "area" && candidate.key === slug)
        .map((candidate) => candidate.tag);
      if (areaTags.length) return pickContextTrack(areaTags, currentMusic, recentMusic);
    }
  }

  const desiredGenre = normalizeMusicGenre(input.musicGenre);
  const desiredIntensity =
    normalizeMusicIntensity(input.musicIntensity) ?? inferMusicIntensity(state, weather, timeOfDay);

  const candidates = availableMusic
    .map((tag) => parseMusicTag(tag))
    .filter((candidate): candidate is ParsedMusicTag => !!candidate && candidate.state === state);
  if (!candidates.length) return null;

  const hasExactGenre = desiredGenre ? candidates.some((candidate) => candidate.genre === desiredGenre) : false;
  const scored = candidates.map((candidate) => ({
    tag: candidate.tag,
    score: scoreStructuredMusic(candidate, desiredGenre, desiredIntensity, hasExactGenre, weather, timeOfDay),
  }));

  const recentSet = new Set((recentMusic ?? []).filter((tag) => tag && tag !== currentMusic));
  const nonCurrent = scored.filter((entry) => entry.tag !== currentMusic);
  const nonRecent = nonCurrent.filter((entry) => !recentSet.has(entry.tag));
  const poolBase = nonRecent.length > 0 ? nonRecent : nonCurrent.length > 0 ? nonCurrent : scored;
  if (!poolBase.length) return null;

  const bestScore = Math.max(...scored.map((entry) => entry.score));
  const currentScore = currentMusic ? scored.find((entry) => entry.tag === currentMusic)?.score : undefined;
  // Keep-current (#5161): scoring now runs on every turn, and per-turn
  // rotation of a still-fitting track is exactly the churn this feature
  // removes. The track only changes when its fit degraded — state, genre,
  // or intensity moved — which is when the score falls behind.
  if (currentScore !== undefined && currentScore >= bestScore - 1) return currentMusic ?? null;
  const poolBestScore = Math.max(...poolBase.map((entry) => entry.score));
  const selectionPool = poolBase.filter((entry) => entry.score >= poolBestScore - 1);
  return pickRandom(selectionPool).tag;
}

function inferLocationKindFromBackground(background?: string | null): LocationKind | null {
  const bgLower = (background ?? "").toLowerCase();
  if (!bgLower) return null;
  if (/(underground|dungeon|cave|catacomb|crypt|sewer|ruin)/.test(bgLower)) return "underground";
  if (/(city|street|market|town|village|alley|plaza|urban)/.test(bgLower)) return "urban";
  if (/(forest|woods|river|lake|mountain|beach|desert|valley|field|nature|swamp)/.test(bgLower)) return "nature";
  if (/(interior|room|laboratory|mansion|house|tavern|palace|hallway|bedroom|classroom|library)/.test(bgLower)) {
    return "interior";
  }
  return "exterior";
}

function ambientKeywordScore(parts: string[], keywords: string[]): number {
  let score = 0;
  for (const kw of keywords) {
    if (parts.some((part) => part.includes(kw) || kw.includes(part))) score++;
  }
  return score;
}

function weatherAllowsStormAudio(weather?: string | null): boolean {
  const normalized = normalizeToken(weather);
  return normalized === "storm" || normalized === "stormy" || normalized === "thunderstorm";
}

function ambientStormAudioScore(parts: string[], weather?: string | null): number {
  const hasStormAudio = parts.includes("thunder") || parts.includes("lightning") || parts.includes("storm");
  if (!hasStormAudio) return 0;
  return weatherAllowsStormAudio(weather) ? 2 : -6;
}

function ambientLocationScore(parts: string[], locationKind: LocationKind | null): number {
  if (!locationKind) return 0;
  const subcategory = parts[1] ?? "";

  if (locationKind === "interior") {
    if (subcategory === "interior" || parts.includes("interior")) return 4;
    if (subcategory === "nature" || subcategory === "urban") return -2;
  }

  if (locationKind === "underground") {
    if (parts.some((part) => ["dungeon", "cave", "underground"].includes(part))) return 4;
    if (subcategory === "interior") return 2;
    if (subcategory === "nature") return -1;
  }

  if (locationKind === "urban") {
    if (subcategory === "urban" || parts.includes("urban") || parts.includes("crowd")) return 4;
    if (subcategory === "nature") return -2;
  }

  if (locationKind === "nature" || locationKind === "exterior") {
    if (subcategory === "nature" || parts.includes("nature")) return 4;
    if (subcategory === "interior") return -2;
  }

  return 0;
}

/**
 * Pick the best ambient tag for the current game context.
 * Returns `null` when the current ambient is already appropriate or no match found.
 */
export function scoreAmbient(input: AmbientScoreInput): string | null {
  const { state, weather, timeOfDay, currentAmbient, availableAmbient, background } = input;
  if (!availableAmbient.length) return null;

  const locationKind = normalizeLocationKind(input.locationKind) ?? inferLocationKindFromBackground(background);
  const keywords: string[] = [];
  if (locationKind) {
    keywords.push(...LOCATION_AMBIENT[locationKind]);
  } else {
    keywords.push(...(STATE_AMBIENT[state] ?? []));
  }
  if (weather) keywords.push(...(WEATHER_AMBIENT[weather.toLowerCase()] ?? []));
  if (timeOfDay) keywords.push(...(TIME_AMBIENT[timeOfDay.toLowerCase()] ?? []));

  const scored = availableAmbient.map((tag) => {
    const parts = tag
      .toLowerCase()
      .split(/[:\-_]+/)
      .filter((part) => part.length > 1);
    const score =
      ambientLocationScore(parts, locationKind) +
      ambientKeywordScore(parts, keywords) +
      ambientStormAudioScore(parts, weather);
    return { tag, score };
  });

  for (let i = scored.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [scored[i], scored[j]] = [scored[j]!, scored[i]!];
  }
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score <= 0) return null;

  const current = currentAmbient ? scored.find((entry) => entry.tag === currentAmbient) : undefined;
  if (current && current.score >= best.score) return null;

  return best.tag;
}
