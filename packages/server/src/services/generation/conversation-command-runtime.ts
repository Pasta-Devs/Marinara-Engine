import {
  CONVERSATION_COMMAND_KEYS,
  type ChatMode,
  type ConversationCommandKey,
  type WrapFormat,
} from "@marinara-engine/shared";

import { logger } from "../../lib/logger.js";
import type { CharacterCommand } from "../conversation/character-commands.js";
import { wrapContent } from "../prompt/format-engine.js";
import { resolveSpotifyCredentials, spotifyHasScope } from "../spotify/spotify.service.js";
import { getActiveTurnGame } from "../turn-games/turn-game-runner.service.js";
import { getChatHapticIntifaceUrl } from "./haptic-runtime.js";

type ChatRowForCommands = {
  id: string;
  mode?: string | null;
  name?: string | null;
  characterIds?: unknown;
};

type CharacterRowForCommands = {
  data?: unknown;
};

type ConversationCommandsChatsStore = {
  list(): Promise<ChatRowForCommands[]>;
};

type ConversationCommandsCharactersStore = {
  getById(id: string): Promise<CharacterRowForCommands | null>;
};

export function readConversationCommandToggles(
  metadata: Record<string, unknown>,
): Partial<Record<ConversationCommandKey, boolean>> {
  const raw = metadata.conversationCommandToggles;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const toggles: Partial<Record<ConversationCommandKey, boolean>> = {};
  for (const key of CONVERSATION_COMMAND_KEYS) {
    if (typeof source[key] === "boolean") toggles[key] = source[key] as boolean;
  }
  return toggles;
}

export function isConversationCommandEnabled(metadata: Record<string, unknown>, key: ConversationCommandKey): boolean {
  return readConversationCommandToggles(metadata)[key] !== false;
}

function getConversationCommandKey(command: CharacterCommand): ConversationCommandKey | null {
  switch (command.type) {
    case "schedule_update":
      return "schedule_update";
    case "cross_post":
      return "cross_post";
    case "selfie":
      return "selfie";
    case "memory":
      return "memory";
    case "scene":
      return "scene";
    case "call":
      return "call";
    case "uno":
      return "uno";
    case "chess":
      return "chess";
    case "spotify":
    case "youtube":
      return "music";
    case "haptic":
      return "haptic";
    case "influence":
      return "influence";
    case "note":
      return "note";
    case "react":
      return "react";
    default:
      return null;
  }
}

export function filterEnabledConversationCommands(
  commands: CharacterCommand[],
  metadata: Record<string, unknown>,
): CharacterCommand[] {
  return commands.filter((command) => {
    const key = getConversationCommandKey(command);
    return key === null || isConversationCommandEnabled(metadata, key);
  });
}

function parseStoredAgentSettingsValue(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function isConversationYoutubeCommandAvailable(storage: {
  getByType(type: string): Promise<{ settings?: unknown } | null>;
}): Promise<boolean> {
  const agent = (await storage.getByType("spotify")) ?? (await storage.getByType("youtube"));
  const settings = parseStoredAgentSettingsValue(agent?.settings);
  return typeof settings.youtubeApiKey === "string" && settings.youtubeApiKey.trim().length > 0;
}

export async function buildConversationCommandsReminder(args: {
  enabled: boolean;
  chatMode: ChatMode;
  chatMeta: Record<string, unknown>;
  characterIds: string[];
  personaName: string;
  chatId: string;
  musicPlayerEnabled?: boolean;
  musicPlayerSource?: string | null;
  chats: ConversationCommandsChatsStore;
  chars: ConversationCommandsCharactersStore;
  agentsStore: Parameters<typeof resolveSpotifyCredentials>[0];
  db: Parameters<typeof getActiveTurnGame>[0];
  wrapFormat: WrapFormat;
  resolvePromptMacros: (value: string) => string;
}): Promise<string | null> {
  if (!args.enabled) return null;
  const { chatMeta, chatMode, characterIds, personaName } = args;
  const scheduleCommandEnabled = isConversationCommandEnabled(chatMeta, "schedule_update");
  const crossPostCommandEnabled = isConversationCommandEnabled(chatMeta, "cross_post");
  const selfieCommandEnabled = isConversationCommandEnabled(chatMeta, "selfie");
  const memoryCommandEnabled = isConversationCommandEnabled(chatMeta, "memory");
  const sceneCommandEnabled = isConversationCommandEnabled(chatMeta, "scene");
  const callCommandEnabled = isConversationCommandEnabled(chatMeta, "call");
  const musicCommandEnabled = isConversationCommandEnabled(chatMeta, "music");
  const hapticCommandEnabled = isConversationCommandEnabled(chatMeta, "haptic");
  const activeMusicCommandSource =
    args.musicPlayerEnabled === false
      ? null
      : args.musicPlayerSource === "youtube" || args.musicPlayerSource === "custom"
        ? args.musicPlayerSource
        : "spotify";

  // Discover other chats this character is in (for cross_post targets + memory targets)
  const allChatsForCrossPost = await args.chats.list();
  const crossPostTargets: string[] = [];
  const memoryTargetCharIds = new Set<string>();
  for (const c of allChatsForCrossPost) {
    if (c.id === args.chatId || c.mode !== "conversation") continue;
    const cCharIds: string[] =
      typeof c.characterIds === "string" ? JSON.parse(c.characterIds as string) : (c.characterIds as string[]);
    if (characterIds.some((id) => cCharIds.includes(id))) {
      crossPostTargets.push(c.name || c.id);
      // Collect character IDs from shared group chats (groups = 2+ characters)
      if (cCharIds.length > 1) {
        for (const id of cCharIds) {
          if (!characterIds.includes(id)) memoryTargetCharIds.add(id);
        }
      }
    }
  }
  // Also check if the CURRENT chat is a group: characters in this chat can target each other
  if (characterIds.length > 1) {
    for (const id of characterIds) memoryTargetCharIds.add(id);
  }

  // Resolve memory target names
  const memoryTargetNames: string[] = [];
  for (const tid of memoryTargetCharIds) {
    const tRow = await args.chars.getById(tid);
    if (tRow) {
      const tData = JSON.parse(tRow.data as string);
      if (tData.name) memoryTargetNames.push(tData.name);
    }
  }

  // Check if selfie is enabled for this chat (user picked an image gen connection)
  const hasImageGen = !!chatMeta.imageGenConnectionId;
  let conversationSpotifyCommandsAvailable = false;
  let conversationYoutubeCommandsAvailable = false;
  if (chatMode === "conversation" && musicCommandEnabled && activeMusicCommandSource === "spotify") {
    try {
      const spotifyCredentials = await resolveSpotifyCredentials(args.agentsStore, { refreshSkewMs: 60_000 });
      if (
        "accessToken" in spotifyCredentials &&
        spotifyHasScope(spotifyCredentials.scopes, "user-modify-playback-state")
      ) {
        conversationSpotifyCommandsAvailable = true;
      } else {
        const spotifyReason =
          "error" in spotifyCredentials ? spotifyCredentials.error : "missing user-modify-playback-state scope";
        logger.debug("[spotify/conversation] Song command unavailable: %s", spotifyReason);
      }
    } catch (err) {
      logger.debug(err, "[spotify/conversation] Failed to check Spotify command availability");
    }
  } else if (chatMode === "conversation" && musicCommandEnabled && activeMusicCommandSource === "youtube") {
    conversationYoutubeCommandsAvailable = await isConversationYoutubeCommandAvailable(args.agentsStore);
  }

  const commandLines: string[] = [
    `Here are your optional, hidden commands you may use if you wish to, but only when they genuinely fit the conversation:`,
    ``,
  ];
  let availableCommandCount = 0;
  const addCommandLines = (...lines: string[]) => {
    commandLines.push(...lines, ``);
    availableCommandCount += 1;
  };

  if (scheduleCommandEnabled) {
    addCommandLines(
      `- [schedule_update: status="online|idle|dnd|offline", activity="activity name", duration="number of hours (e.g., 1h)"] - only if you change your own status/activity, for example, if the user asks you to stop what you're doing or if you decide to change them yourself.`,
    );
  }

  if (crossPostCommandEnabled && crossPostTargets.length > 0) {
    addCommandLines(
      `- [cross_post: target="${crossPostTargets.map((t) => `"${t}"`).join("|")}"] - if you want to redirect your message to a different chat. Use this when the user suggests you say something in another chat, or when it makes sense to message someone else.`,
      ` Example: ${personaName} says "maybe ask about that in the group chat?" → You respond: [cross_post: target="${crossPostTargets[0] ?? "group chat"}"] Hey guys, does anyone know about…`,
    );
  }

  if (selfieCommandEnabled && hasImageGen) {
    addCommandLines(
      `- [selfie] or [selfie: context="description of what the selfie shows"] - you send a photo of yourself. Use this when the user asks for a selfie, photo, or pic, or when you want to share what you look like right now.`,
      `   If you say you are sending, sharing, taking, or attaching a selfie/photo/pic, include [selfie] in that same response. Do not only narrate the action.`,
    );
  }

  // Memory command: only available when there are valid targets (characters in shared group chats)
  if (memoryCommandEnabled && memoryTargetNames.length > 0) {
    addCommandLines(
      `- [memory: target="${memoryTargetNames.map((n) => `"${n}"`).join("|")}", summary="brief description of what happened"] - create a memory that another character will remember. Use this when something notable happens between you and another character that they would naturally remember (e.g., shared a meal, had an argument, made plans). Don't overuse this; only for genuinely memorable moments.`,
      `   Example: [memory: target="${memoryTargetNames[0]}", summary="watched a movie together and argued about the ending"]`,
    );
  }

  // Scene command: only in conversation mode
  if (sceneCommandEnabled && chatMode === "conversation") {
    addCommandLines(
      `- [scene: scenario="brief description of what happens in this scene", background="place"] - initiate a mini-roleplay scene branching from this conversation. The system will plan and create a complete immersive scene for you.`,
      `   Example: You agree to go stargazing → include [scene: scenario="lying on a blanket in the park, looking at the stars together", background="park"]`,
      `   WHEN TO USE: You SHOULD proactively trigger a scene whenever the conversation naturally leads to an activity, outing, or situation that would be more immersive as a scene. Examples:`,
      `   - {{user}} says "I'm coming over" or "Let's go to the park" → trigger a scene for arriving/being at that location.`,
      `   - You invite {{user}} somewhere and they accept → trigger a scene for that activity.`,
      `   - A plan is made (date, trip, hangout, confrontation) and the moment arrives → trigger a scene.`,
      `   Do NOT wait for {{user}} to explicitly ask for a scene. If the conversation implies you and {{user}} are about to DO something together, initiate the scene yourself.`,
      `   EXCEPTION: Do NOT start a scene for playing UNO, chess, cards, or other board/table games — those have their own commands. Use [uno] for UNO and [chess] for chess, not [scene].`,
    );
  }

  if (callCommandEnabled && chatMode === "conversation") {
    addCommandLines(
      `- [call], [call: reason="brief reason"], or [call: reason="brief reason", greeting="first thing to say after ${personaName} answers"] - ring ${personaName} for an audio call. Use this only when a live call naturally fits, such as when you urgently want to talk, when typing is awkward, or when ${personaName} asks you to call. The system will show an incoming call request; do not assume it was answered unless the call starts. If you include greeting, it will play only after ${personaName} accepts.`,
    );
  }

  // Turn-games: conversation mode only, when no game is running yet and at least one other character is present.
  const unoAdvertisable =
    chatMode === "conversation" && isConversationCommandEnabled(chatMeta, "uno") && characterIds.length >= 1;
  const chessAdvertisable =
    chatMode === "conversation" && isConversationCommandEnabled(chatMeta, "chess") && characterIds.length >= 1;
  const noActiveTurnGame = (unoAdvertisable || chessAdvertisable) && !(await getActiveTurnGame(args.db, args.chatId));
  if (unoAdvertisable && noActiveTurnGame) {
    addCommandLines(
      `- [uno] - start a game of UNO at the table. Include this ONLY when ${personaName} proposes playing UNO (or cards) and you are willing to play right now. The system deals the cards and runs the game — you do NOT narrate dealing or describe the hands.`,
      `   If you are busy, tired, or simply don't feel like it, just say so in character and do NOT include [uno]. Agreeing to play IS including [uno].`,
      `   Example: ${personaName} says "anyone up for a round of uno?" and you're in → "Oh, you're SO on. [uno]"`,
    );
  }
  if (chessAdvertisable && noActiveTurnGame) {
    addCommandLines(
      `- [chess] - start a one-on-one chess game against ${personaName}. Include this ONLY when ${personaName} proposes playing chess and YOU are willing to play right now. Chess seats exactly two players: ${personaName} and you — whichever character includes [chess] takes the opponent's seat. The system sets up the board and runs the game — you do NOT describe the board or narrate setup.`,
      `   If you'd rather not play, say so in character and do NOT include [chess]. Agreeing to play IS including [chess].`,
      `   Example: ${personaName} says "up for a game of chess?" and you're in → "Prepare to lose your queen. [chess]"`,
    );
  }

  if (conversationSpotifyCommandsAvailable) {
    addCommandLines(
      `- [spotify: title="Song title", artist="Artist"] - only if you want to play a selected song on the user's active Spotify player. Use this sparingly, when the song choice genuinely fits the moment.`,
    );
  }

  if (conversationYoutubeCommandsAvailable) {
    addCommandLines(
      `- [youtube: query="Song title Artist"] - only if you want to play a selected song on the user's active YouTube player. Use this sparingly, when the song choice genuinely fits the moment.`,
    );
  }

  // Haptic command: only when devices are connected and haptic feedback is enabled
  const hapticEnabled = chatMeta.enableHapticFeedback === true;
  if (hapticCommandEnabled && hapticEnabled) {
    const { hapticService } = await import("../haptic/buttplug-service.js");
    // Auto-connect to Intiface Central if not already connected
    if (!hapticService.connected) {
      try {
        await hapticService.connect(getChatHapticIntifaceUrl(chatMeta));
      } catch {
        logger.warn("[haptic] Auto-connect to Intiface Central failed — is the server running?");
      }
    }
    if (hapticService.connected && hapticService.devices.length > 0) {
      const deviceNames = hapticService.devices.map((d) => d.name).join(", ");
      addCommandLines(
        `- [haptic: action="vibrate|oscillate|rotate|position|stop", intensity=0.0-1.0, duration=seconds (0 = loop until next command)] or [haptic: action="stop"] - control or stop the user's connected intimate device(s) (${deviceNames}). Use this during physical/intimate/sensual moments to provide haptic feedback that matches the narrative. Vary intensity based on the scene.`,
        `   You can include multiple [haptic] commands in one message for patterns (e.g., escalating: 0.2 → 0.5 → 0.8).`,
        `   Example: *trails a finger slowly down your arm* [haptic: action="vibrate", intensity=0.3, duration=2]`,
      );
    }
  }

  if (availableCommandCount === 0) return null;
  commandLines.push(
    `IMPORTANT: Commands are stripped from your message before the user sees it. The rest of your message is shown normally. You can include multiple commands in one message, but you do not need to use any of them unless it makes sense in context.`,
  );

  return wrapContent(args.resolvePromptMacros(commandLines.join("\n")), "commands", args.wrapFormat);
}
