import {
  fetchSpotifyApi,
  normalizeSpotifySearchQuery,
  resolveSpotifyCredentials,
  spotifyHasScope,
  type SpotifyCredentialsResult,
} from "./spotify.service.js";
import type { createAgentsStorage } from "../storage/agents.storage.js";

type AgentsStorage = ReturnType<typeof createAgentsStorage>;

export type ConversationSpotifyTrack = {
  uri: string;
  name: string;
  artist: string;
  album: string | null;
};

export type ConversationSpotifyCommandErrorCode =
  "spotify_unavailable" | "missing_playback_scope" | "track_not_found" | "playback_failed";

export class ConversationSpotifyCommandError extends Error {
  status: number;
  code: ConversationSpotifyCommandErrorCode;

  constructor(status: number, message: string, code: ConversationSpotifyCommandErrorCode) {
    super(message);
    this.name = "ConversationSpotifyCommandError";
    this.status = status;
    this.code = code;
  }
}

function fail(status: number, message: string, code: ConversationSpotifyCommandErrorCode): never {
  throw new ConversationSpotifyCommandError(status, message, code);
}

export function isSilentConversationSpotifyCommandError(error: unknown): error is ConversationSpotifyCommandError {
  return (
    error instanceof ConversationSpotifyCommandError &&
    (error.code === "spotify_unavailable" || error.code === "missing_playback_scope")
  );
}

async function readSpotifyError(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text.trim()) return fallback;
  try {
    const json = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    if (typeof json.error === "string") return json.error;
    if (typeof json.error?.message === "string") return json.error.message;
    if (typeof json.message === "string") return json.message;
  } catch {
    /* use text below */
  }
  return text.slice(0, 300);
}

function normalizeSpotifyText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenOverlapScore(left: string, right: string): number {
  const leftTokens = new Set(normalizeSpotifyText(left).split(/\s+/).filter(Boolean));
  if (leftTokens.size === 0) return 0;
  const rightTokens = new Set(normalizeSpotifyText(right).split(/\s+/).filter(Boolean));
  let score = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) score += 1;
  }
  return score / leftTokens.size;
}

function spotifyTextSimilarity(wanted: string, actual: string): number {
  const normalizedWanted = normalizeSpotifyText(wanted);
  const normalizedActual = normalizeSpotifyText(actual);
  if (!normalizedWanted || !normalizedActual) return 0;
  if (normalizedActual === normalizedWanted) return 1;
  if (normalizedActual.includes(normalizedWanted) || normalizedWanted.includes(normalizedActual)) return 0.85;
  return tokenOverlapScore(wanted, actual);
}

function scoreSpotifyTrack(track: ConversationSpotifyTrack, desired: { title: string; artist: string }): number {
  return (
    spotifyTextSimilarity(desired.title, track.name) * 65 + spotifyTextSimilarity(desired.artist, track.artist) * 35
  );
}

async function searchSpotifyTrack(args: {
  credentials: SpotifyCredentialsResult;
  title: string;
  artist: string;
}): Promise<ConversationSpotifyTrack | null> {
  const title = args.title.replace(/"/g, "").replace(/\s+/g, " ").trim();
  const artist = args.artist.replace(/"/g, "").replace(/\s+/g, " ").trim();
  const queries = Array.from(
    new Set([`track:"${title}" artist:"${artist}"`, `"${title}" "${artist}"`, `${title} ${artist}`]),
  ).map((query) => normalizeSpotifySearchQuery(query));
  const candidatesByUri = new Map<string, ConversationSpotifyTrack>();

  for (const query of queries) {
    const res = await fetchSpotifyApi(
      args.credentials,
      `/search?${new URLSearchParams({ q: query, type: "track", limit: "8" })}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) continue;
    const data = (await res.json()) as {
      tracks?: {
        items?: Array<{
          uri?: string;
          name?: string;
          artists?: Array<{ name?: string }>;
          album?: { name?: string };
        }>;
      };
    };
    for (const item of data.tracks?.items ?? []) {
      if (!item.uri?.startsWith("spotify:track:")) continue;
      candidatesByUri.set(item.uri, {
        uri: item.uri,
        name: item.name || "Unknown track",
        artist:
          (item.artists ?? [])
            .map((entry) => entry.name)
            .filter(Boolean)
            .join(", ") || "Unknown artist",
        album: item.album?.name ?? null,
      });
    }
  }

  const [best] = Array.from(candidatesByUri.values()).sort(
    (a, b) => scoreSpotifyTrack(b, args) - scoreSpotifyTrack(a, args),
  );
  if (!best) return null;
  return scoreSpotifyTrack(best, args) >= 58 ? best : null;
}

export async function playConversationSpotifyCommand(args: {
  storage: AgentsStorage;
  title: string;
  artist: string;
}): Promise<{ track: ConversationSpotifyTrack }> {
  const credentials = await resolveSpotifyCredentials(args.storage, { refreshSkewMs: 60_000 });
  if (!("accessToken" in credentials)) {
    fail(credentials.status, credentials.error, "spotify_unavailable");
  }
  if (!spotifyHasScope(credentials.scopes, "user-modify-playback-state")) {
    fail(400, "Reconnect Spotify to allow conversation song commands.", "missing_playback_scope");
  }

  const track = await searchSpotifyTrack({
    credentials,
    title: args.title,
    artist: args.artist,
  });
  if (!track) {
    fail(404, `Spotify could not find "${args.title}" by ${args.artist}.`, "track_not_found");
  }

  const res = await fetchSpotifyApi(credentials, "/me/player/play", {
    method: "PUT",
    body: JSON.stringify({ uris: [track.uri], position_ms: 0 }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok && res.status !== 204) {
    fail(
      res.status,
      `Spotify play failed: ${await readSpotifyError(res, "Could not start playback.")}`,
      "playback_failed",
    );
  }

  return { track };
}
