import type { AgentContext, AgentResult } from "@marinara-engine/shared";
import type { ResolvedAgent } from "../agents/agent-pipeline.js";
import { normalizeAgentContextSize } from "../agents/agent-executor.js";

export type SpotifyRuntimeAgent = ResolvedAgent & {
  __spotifyToolCalls?: Set<string>;
  __spotifyPlayApplied?: boolean;
  __spotifyPlayError?: string | null;
  __spotifyToolError?: string | null;
  __spotifyPlaybackPending?: boolean;
  __spotifyPlayUris?: string[];
  __spotifyCandidateTracks?: SpotifyRuntimeTrack[];
  __spotifyCurrentAfterPlayUri?: string | null;
  __spotifyPlayDisplay?: string | null;
  __spotifyPlayReason?: string | null;
  __spotifyQueued?: number | null;
  __spotifyDevice?: string | null;
};

type SpotifyRuntimeTrack = {
  uri: string;
  name: string;
  artist: string;
  album?: string | null;
};

export function readSpotifyStringField(data: unknown, key: string): string {
  if (!data || typeof data !== "object") return "";
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

export function readSpotifyNumberField(data: unknown, key: string): number | null {
  if (!data || typeof data !== "object") return null;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readSpotifyTrackUris(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const raw =
    (Array.isArray(record.trackUris) && record.trackUris) ||
    (Array.isArray(record.uris) && record.uris) ||
    (typeof record.trackUri === "string" ? [record.trackUri] : null) ||
    (typeof record.uri === "string" ? [record.uri] : null) ||
    [];
  return raw.filter((uri): uri is string => typeof uri === "string" && uri.startsWith("spotify:"));
}

function readSpotifyTrackNames(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const raw =
    (Array.isArray(record.trackNames) && record.trackNames) ||
    (typeof record.trackName === "string" ? [record.trackName] : null) ||
    [];
  return raw.filter((name): name is string => typeof name === "string" && name.trim().length > 0);
}

function readSpotifyCandidateTracks(data: unknown): SpotifyRuntimeTrack[] {
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const rawTracks = Array.isArray(record.tracks) ? record.tracks : [];
  return rawTracks
    .map((track): SpotifyRuntimeTrack | null => {
      if (!track || typeof track !== "object") return null;
      const item = track as Record<string, unknown>;
      const uri = typeof item.uri === "string" && item.uri.startsWith("spotify:track:") ? item.uri : "";
      if (!uri) return null;
      return {
        uri,
        name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Unknown track",
        artist: typeof item.artist === "string" && item.artist.trim() ? item.artist.trim() : "",
        album: typeof item.album === "string" && item.album.trim() ? item.album.trim() : null,
      };
    })
    .filter((track): track is SpotifyRuntimeTrack => track !== null);
}

export function rememberSpotifyCandidateTracks(agent: SpotifyRuntimeAgent, data: unknown): void {
  const tracks = readSpotifyCandidateTracks(data);
  if (tracks.length === 0) return;
  const seen = new Set<string>();
  const merged: SpotifyRuntimeTrack[] = [];
  for (const track of [...tracks, ...(agent.__spotifyCandidateTracks ?? [])]) {
    if (seen.has(track.uri)) continue;
    seen.add(track.uri);
    merged.push(track);
  }
  agent.__spotifyCandidateTracks = merged.slice(0, 120);
}

function formatSpotifyTrackName(track: SpotifyRuntimeTrack): string {
  return `${track.name}${track.artist ? ` — ${track.artist}` : ""}`;
}

function readSpotifyTrackNamesForUris(agent: SpotifyRuntimeAgent, uris: string[]): string[] {
  if (uris.length === 0) return [];
  const byUri = new Map((agent.__spotifyCandidateTracks ?? []).map((track) => [track.uri, track]));
  return uris
    .map((uri) => byUri.get(uri))
    .filter((track): track is SpotifyRuntimeTrack => Boolean(track))
    .map(formatSpotifyTrackName);
}

function spotifyUrisAreFromKnownCandidates(agent: SpotifyRuntimeAgent, uris: string[]): boolean {
  if (uris.length === 0) return false;
  const knownUris = new Set((agent.__spotifyCandidateTracks ?? []).map((track) => track.uri));
  return uris.every((uri) => knownUris.has(uri));
}

export function readSpotifyPlaybackTrackUri(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (typeof record.currentUri === "string" && record.currentUri.startsWith("spotify:track:")) {
    return record.currentUri;
  }
  const track = record.track;
  if (track && typeof track === "object") {
    const uri = (track as Record<string, unknown>).uri;
    if (typeof uri === "string" && uri.startsWith("spotify:track:")) return uri;
  }
  return null;
}

function extractSpotifyJsonPayload(text: string): Record<string, unknown> | null {
  const resultMatch = text.match(/<result\s+agent\s*=\s*["']?spotify["']?\s*>([\s\S]*?)<\/result>/i);
  let candidate = (resultMatch?.[1] ?? text).trim();
  const fenceMatch = candidate.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (fenceMatch) candidate = fenceMatch[1]!.trim();
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (jsonMatch) candidate = jsonMatch[0]!;

  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function normalizeSpotifyAgentResult(result: AgentResult): AgentResult {
  if (result.agentType !== "spotify" || !result.success || !result.data || typeof result.data !== "object") {
    return result;
  }

  const data = result.data as Record<string, unknown>;
  if (data.parseError !== true || typeof data.raw !== "string") return result;

  const parsed = extractSpotifyJsonPayload(data.raw);
  if (!parsed) return result;

  return {
    ...result,
    data: parsed,
  };
}

export function shouldDeferSpotifyAgentEvent(result: AgentResult): boolean {
  return result.agentType === "spotify";
}

function isBlockingSpotifyToolError(error: string | null | undefined): error is string {
  return (
    !!error && /(not configured|not connected|token|scope|premium|active spotify device|playback failed)/i.test(error)
  );
}

async function executeSpotifyAgentToolJson(
  agent: SpotifyRuntimeAgent,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!agent.toolContext) return { error: "Spotify tool context is unavailable." };
  const raw = await agent.toolContext.executeToolCall({
    id: `spotify-agent-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: "function",
    function: {
      name,
      arguments: JSON.stringify(args),
    },
  });
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      rememberSpotifyCandidateTracks(agent, parsed);
      return parsed as Record<string, unknown>;
    }
    return { raw };
  } catch {
    return { raw };
  }
}

function getSpotifyConstraintRecord(context: AgentContext): Record<string, unknown> {
  return context.memory._spotifyDjConstraints && typeof context.memory._spotifyDjConstraints === "object"
    ? (context.memory._spotifyDjConstraints as Record<string, unknown>)
    : {};
}

function buildSpotifyFallbackQuery(
  agent: SpotifyRuntimeAgent,
  resultData: Record<string, unknown>,
  context: AgentContext,
): { query: string; mood: string } {
  const mood = readSpotifyStringField(resultData, "mood");
  const searchQuery = readSpotifyStringField(resultData, "searchQuery");
  const contextSize = normalizeAgentContextSize(agent.settings.contextSize);
  const recentText = context.recentMessages
    .slice(-contextSize)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
  const text = [searchQuery, mood, recentText, context.mainResponse ?? ""]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join("\n")
    .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
  return {
    query: text || "roleplay scene music",
    mood: mood || "Music DJ selection",
  };
}

async function loadSpotifyFallbackCandidates(args: {
  agent: SpotifyRuntimeAgent;
  resultData: Record<string, unknown>;
  context: AgentContext;
}): Promise<{ tracks: SpotifyRuntimeTrack[]; error: string | null; searchQuery: string; mood: string }> {
  const { agent, resultData, context } = args;
  const existing = agent.__spotifyCandidateTracks ?? [];
  const queryInfo = buildSpotifyFallbackQuery(agent, resultData, context);
  if (existing.length > 0) {
    return { tracks: existing, error: null, searchQuery: queryInfo.query, mood: queryInfo.mood };
  }

  const constraints = getSpotifyConstraintRecord(context);
  const sourceType = typeof constraints.sourceType === "string" ? constraints.sourceType : "liked";
  const playlistId =
    typeof constraints.playlistId === "string" && constraints.playlistId.trim()
      ? constraints.playlistId.trim()
      : sourceType === "playlist"
        ? ""
        : "liked";
  const artist = typeof constraints.artist === "string" && constraints.artist.trim() ? constraints.artist.trim() : "";

  const sourceResult =
    sourceType === "artist"
      ? await executeSpotifyAgentToolJson(agent, "spotify_search", {
          query: [artist ? `artist:${artist}` : "", queryInfo.query].filter(Boolean).join(" "),
          limit: 20,
        })
      : sourceType === "any"
        ? await executeSpotifyAgentToolJson(agent, "spotify_search", {
            query: queryInfo.query,
            limit: 20,
          })
        : await executeSpotifyAgentToolJson(agent, "spotify_get_playlist_tracks", {
            playlistId: playlistId || "liked",
            query: queryInfo.query,
            mood: queryInfo.mood,
            candidateLimit: 40,
          });

  const tracks = readSpotifyCandidateTracks(sourceResult);
  if (tracks.length > 0) {
    rememberSpotifyCandidateTracks(agent, sourceResult);
    return { tracks, error: null, searchQuery: queryInfo.query, mood: queryInfo.mood };
  }

  const error = typeof sourceResult.error === "string" ? sourceResult.error : "No Spotify candidates found.";
  return { tracks: [], error, searchQuery: queryInfo.query, mood: queryInfo.mood };
}

async function playSpotifyFallbackCandidates(args: {
  agent: SpotifyRuntimeAgent;
  result: AgentResult;
  resultData: Record<string, unknown>;
  context: AgentContext;
  reason: string;
}): Promise<AgentResult> {
  const { agent, result, resultData, context, reason } = args;
  if (!agent.toolContext) {
    return { ...result, success: false, error: "Music DJ chose music, but Spotify tools were unavailable." };
  }

  const candidates = await loadSpotifyFallbackCandidates({ agent, resultData, context });
  if (candidates.error || candidates.tracks.length === 0) {
    return { ...result, success: false, error: candidates.error ?? "No Spotify candidates found." };
  }

  const queueSize = context.chatMode === "game" ? 1 : 5;
  const picked = candidates.tracks.slice(0, queueSize);
  const uris = picked.map((track) => track.uri);
  const play = await executeSpotifyAgentToolJson(
    agent,
    "spotify_play",
    uris.length === 1 ? { uri: uris[0], reason } : { uris, reason },
  );
  if (play.applied !== true) {
    const playError = typeof play.error === "string" ? play.error : "Spotify play did not apply playback.";
    return { ...result, success: false, error: playError };
  }

  const parsedData = { ...resultData };
  delete parsedData.parseError;
  delete parsedData.raw;
  const queued = readSpotifyNumberField(play, "queued") ?? uris.length;
  const display = readSpotifyStringField(play, "display");
  return {
    ...result,
    success: true,
    error: null,
    data: {
      ...parsedData,
      action: "play",
      mood: candidates.mood,
      searchQuery: candidates.searchQuery,
      trackUris: uris,
      trackNames: picked.map(formatSpotifyTrackName),
      queued,
      currentUri: readSpotifyPlaybackTrackUri(play) ?? null,
      device: readSpotifyStringField(play, "device") || null,
      display:
        display ||
        (queued > 1 ? `🎵 Queued ${queued} tracks: ${candidates.mood}` : `🎵 Started Spotify playback: ${candidates.mood}`),
      deterministicFallbackApplied: true,
    },
  };
}

async function applySpotifyAgentPlaybackFallback(
  agent: SpotifyRuntimeAgent,
  result: AgentResult,
  context: AgentContext,
): Promise<AgentResult> {
  const normalizedResult = normalizeSpotifyAgentResult(result);
  if (
    agent.type !== "spotify" ||
    normalizedResult.type !== "spotify_control" ||
    !normalizedResult.success ||
    !normalizedResult.data ||
    typeof normalizedResult.data !== "object"
  ) {
    return normalizedResult;
  }

  const data = normalizedResult.data as Record<string, unknown>;
  if (agent.__spotifyPlayApplied === true) {
    const parsedData = { ...data };
    delete parsedData.parseError;
    delete parsedData.raw;
    const playedUris = agent.__spotifyPlayUris?.length ? agent.__spotifyPlayUris : readSpotifyTrackUris(data);
    const trackNames = readSpotifyTrackNames(data);
    const fallbackTrackNames = readSpotifyTrackNamesForUris(agent, playedUris);
    const mood = readSpotifyStringField(data, "mood") || agent.__spotifyPlayReason || "Music DJ selection";
    const queued = agent.__spotifyQueued ?? (playedUris.length > 0 ? playedUris.length : null);
    return {
      ...normalizedResult,
      error: null,
      data: {
        ...parsedData,
        action: "play",
        mood,
        trackUris: playedUris,
        trackNames: trackNames.length > 0 ? trackNames : fallbackTrackNames,
        queued,
        currentUri: agent.__spotifyCurrentAfterPlayUri ?? null,
        device: agent.__spotifyDevice ?? null,
        playbackPending: agent.__spotifyPlaybackPending === true,
        display:
          agent.__spotifyPlayDisplay ??
          (queued && queued > 1 ? `🎵 Queued ${queued} tracks: ${mood}` : `🎵 Started Spotify playback: ${mood}`),
        toolPlaybackApplied: true,
      },
    };
  }

  const action = readSpotifyStringField(data, "action");
  const requestedUris = readSpotifyTrackUris(data);
  if (isBlockingSpotifyToolError(agent.__spotifyToolError) && action !== "play") {
    return { ...normalizedResult, success: false, error: agent.__spotifyToolError };
  }
  if (data.parseError === true || (action === "play" && requestedUris.length === 0)) {
    return playSpotifyFallbackCandidates({
      agent,
      result: normalizedResult,
      resultData: data,
      context,
      reason: readSpotifyStringField(data, "mood") || "Music DJ malformed-result recovery",
    });
  }
  if (action !== "play" || requestedUris.length === 0) return normalizedResult;

  const spotifyPlayCalled = agent.__spotifyToolCalls instanceof Set && agent.__spotifyToolCalls.has("spotify_play");
  if (!spotifyPlayCalled && !spotifyUrisAreFromKnownCandidates(agent, requestedUris)) {
    return playSpotifyFallbackCandidates({
      agent,
      result: normalizedResult,
      resultData: data,
      context,
      reason: readSpotifyStringField(data, "mood") || "Music DJ grouped-result playback",
    });
  }
  if (spotifyPlayCalled && agent.__spotifyPlayError) {
    return { ...normalizedResult, success: false, error: agent.__spotifyPlayError };
  }
  if (!agent.toolContext) {
    return {
      ...normalizedResult,
      success: false,
      error: "Music DJ chose music, but Spotify tools were unavailable.",
    };
  }

  const playArgs =
    requestedUris.length === 1
      ? { uri: requestedUris[0], reason: readSpotifyStringField(data, "mood") || "Music DJ selection" }
      : { uris: requestedUris, reason: readSpotifyStringField(data, "mood") || "Music DJ selection" };
  const play = await executeSpotifyAgentToolJson(agent, "spotify_play", playArgs);
  if (play.applied !== true) {
    const playError = typeof play.error === "string" ? play.error : "Spotify play did not apply playback.";
    return { ...normalizedResult, success: false, error: playError };
  }

  const currentUri = readSpotifyPlaybackTrackUri(play);
  const trackNames = readSpotifyTrackNames(data);
  const fallbackTrackNames = readSpotifyTrackNamesForUris(agent, requestedUris);
  const queued = readSpotifyNumberField(play, "queued") ?? requestedUris.length;
  const display = readSpotifyStringField(play, "display");
  return {
    ...normalizedResult,
    error: null,
    data: {
      ...data,
      trackUris: requestedUris,
      trackNames: trackNames.length > 0 ? trackNames : fallbackTrackNames,
      toolFallbackApplied: true,
      currentUri: currentUri ?? null,
      queued,
      display: display || undefined,
    },
  };
}

export async function applySpotifyAgentPlaybackFallbacks(
  results: AgentResult[],
  resolvedAgents: ResolvedAgent[],
  context: AgentContext,
): Promise<AgentResult[]> {
  const spotifyAgent = resolvedAgents.find((agent) => agent.type === "spotify") as SpotifyRuntimeAgent | undefined;
  if (!spotifyAgent) return results;
  return Promise.all(results.map((result) => applySpotifyAgentPlaybackFallback(spotifyAgent, result, context)));
}
