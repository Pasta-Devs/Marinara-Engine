import type { IntegrationGateway } from "../../engine/capabilities/integrations";
import { hapticsApi } from "./haptics-api";
import { imageGenerationApi } from "./image-generation-api";
import { spotifyApi } from "./integration-utility-api";
import { remoteRuntimeTarget } from "./remote-runtime";
import { invokeTauri } from "./tauri-client";

const REMOTE_HAPTIC_STATUS = {
  connected: false,
  serverUrl: null,
  scanning: false,
  devices: [],
  remoteUnsupported: true,
};

function remoteRuntimeConfigured(): boolean {
  try {
    return Boolean(remoteRuntimeTarget());
  } catch {
    return true;
  }
}

function remoteHapticResult<T>(value: unknown): Promise<T> {
  return Promise.resolve(value as T);
}

export const integrationGateway: IntegrationGateway = {
  spotify: {
    player: (input) => spotifyApi.player(input),
    playlists: (input) =>
      spotifyApi.playlists({
        agentId: input.agentId,
        limit: input.limit ?? undefined,
      }),
    playlistTracks: (input) => spotifyApi.playlistTracks(input),
    searchTracks: (input) => spotifyApi.searchTracks(input),
    playTrack: <T = unknown>(input: Record<string, unknown>) => spotifyApi.playTrack(input) as Promise<T>,
    play: <T = unknown>(input: Record<string, unknown>) => spotifyApi.play(input) as Promise<T>,
    volume: <T = unknown>(input: Record<string, unknown>) => spotifyApi.volume(input) as Promise<T>,
  },
  haptic: {
    status: <T = unknown>() =>
      remoteRuntimeConfigured() ? remoteHapticResult<T>(REMOTE_HAPTIC_STATUS) : hapticsApi.status<T>(),
    connect: <T = unknown>(input?: { url?: string | null }) =>
      remoteRuntimeConfigured()
        ? remoteHapticResult<T>(REMOTE_HAPTIC_STATUS)
        : hapticsApi.connect<T>(input?.url ?? undefined),
    command: <T = unknown>(_input: Record<string, unknown>) =>
      remoteRuntimeConfigured()
        ? remoteHapticResult<T>({ success: false, code: "haptic_remote_runtime_unsupported" })
        : hapticsApi.command<T>(_input),
    stopAll: <T = unknown>() =>
      remoteRuntimeConfigured()
        ? remoteHapticResult<T>({ success: false, code: "haptic_remote_runtime_unsupported" })
        : hapticsApi.stopAll<T>(),
  },
  customTools: {
    execute: <T = unknown>(input: { toolName: string; arguments: unknown }) =>
      invokeTauri<T>("custom_tool_execute", { body: input }),
  },
  image: {
    generate: <T = unknown>(input: Record<string, unknown>) => imageGenerationApi.generate<T>(input),
  },
  discord: {
    mirrorMessage: <T = unknown>(input: {
      webhookUrl: string;
      content: string;
      username?: string | null;
      avatarUrl?: string | null;
    }) => invokeTauri<T>("discord_webhook_send", { body: input }),
  },
};
