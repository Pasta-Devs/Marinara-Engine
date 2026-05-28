import type { IntegrationGateway } from "../../engine/capabilities/integrations";
import { hapticsApi } from "./haptics-api";
import { imageGenerationApi } from "./image-generation-api";
import { spotifyApi } from "./integration-utility-api";
import { invokeTauri } from "./tauri-client";

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
    command: <T = unknown>(input: Record<string, unknown>) => hapticsApi.command<T>(input),
    stopAll: <T = unknown>() => hapticsApi.stopAll<T>(),
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
