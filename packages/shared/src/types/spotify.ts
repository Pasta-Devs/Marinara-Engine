// ──────────────────────────────────────────────
// Spotify source contract
// ──────────────────────────────────────────────

/** Accepted source constraints used by Music DJ. */
const SPOTIFY_SOURCE_TYPES = ["liked", "playlist", "artist", "any"] as const;

export type SpotifySourceType = (typeof SPOTIFY_SOURCE_TYPES)[number];

/** Normalize persisted or user-provided values to a supported Spotify source. */
export function normalizeSpotifySourceType(value: unknown): SpotifySourceType {
  return SPOTIFY_SOURCE_TYPES.find((sourceType) => sourceType === value) ?? "liked";
}
