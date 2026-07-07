import type { ChatMode } from "@marinara-engine/shared";

import { logger } from "../../lib/logger.js";
import type {
  CharacterCommand,
  SpotifyCommand,
  YouTubeCommand,
} from "../conversation/character-commands.js";
import {
  ConversationSpotifyCommandError,
  isSilentConversationSpotifyCommandError,
  playConversationSpotifyCommand,
} from "../spotify/conversation-spotify-command.service.js";

type SpotifyStorage = Parameters<typeof playConversationSpotifyCommand>[0]["storage"];

export async function handleConversationMusicCommand(args: {
  command: CharacterCommand;
  chatId: string;
  chatMode: ChatMode;
  agentsStore: SpotifyStorage;
  sendEvent: (event: { type: string; data: Record<string, unknown> }) => void;
}): Promise<boolean> {
  if (args.command.type === "spotify") {
    await handleSpotifyCommand(args.command as SpotifyCommand, args);
    return true;
  }
  if (args.command.type === "youtube") {
    handleYoutubeCommand(args.command as YouTubeCommand, args);
    return true;
  }
  return false;
}

async function handleSpotifyCommand(
  command: SpotifyCommand,
  args: Parameters<typeof handleConversationMusicCommand>[0],
): Promise<void> {
  if (args.chatMode !== "conversation") {
    logger.debug("[spotify/conversation] Ignored song command outside conversation mode");
    return;
  }

  try {
    const result = await playConversationSpotifyCommand({
      storage: args.agentsStore,
      title: command.title,
      artist: command.artist,
    });
    args.sendEvent({
      type: "spotify_command",
      data: {
        title: command.title,
        artist: command.artist,
        track: result.track,
      },
    });
    logger.info(
      '[spotify/conversation] Played "%s" by "%s" for chat %s',
      result.track.name,
      result.track.artist,
      args.chatId,
    );
  } catch (err) {
    if (isSilentConversationSpotifyCommandError(err)) {
      logger.debug(
        '[spotify/conversation] Dropped unavailable song command: "%s" by "%s" - %s',
        command.title,
        command.artist,
        err.message,
      );
      return;
    }

    const message = err instanceof Error ? err.message : "Spotify song command failed.";
    args.sendEvent({
      type: "spotify_command_error",
      data: {
        title: command.title,
        artist: command.artist,
        error: message,
      },
    });
    if (err instanceof ConversationSpotifyCommandError) {
      logger.warn(
        '[spotify/conversation] Song command failed (%d): "%s" by "%s" - %s',
        err.status,
        command.title,
        command.artist,
        err.message,
      );
    } else {
      logger.warn(err, "[spotify/conversation] Song command failed");
    }
  }
}

function handleYoutubeCommand(
  command: YouTubeCommand,
  args: Parameters<typeof handleConversationMusicCommand>[0],
): void {
  if (args.chatMode !== "conversation") {
    logger.debug("[youtube/conversation] Ignored song command outside conversation mode");
    return;
  }
  args.sendEvent({
    type: "youtube_command",
    data: {
      searchQuery: command.query,
      mood: "Conversation music command",
    },
  });
  logger.info('[youtube/conversation] Requested "%s" for chat %s', command.query, args.chatId);
}
