import {
  BUILT_IN_AGENTS,
  CONVERSATION_COMMAND_AGENT_IDS,
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
    case "poker":
      return "poker";
    case "eightball":
      return "eightball";
    case "tic_tac_toe":
      return "tic_tac_toe";
    case "rock_paper_scissors":
      return "rock_paper_scissors";
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

function isConversationCommandAvailable(key: ConversationCommandKey): boolean {
  const packageAgentId = CONVERSATION_COMMAND_AGENT_IDS[key];
  return !packageAgentId || BUILT_IN_AGENTS.some((agent) => agent.id === packageAgentId);
}

export function filterEnabledConversationCommands(
  commands: CharacterCommand[],
  metadata: Record<string, unknown>,
): CharacterCommand[] {
  return commands.filter((command) => {
    const key = getConversationCommandKey(command);
    return key === null || (isConversationCommandAvailable(key) && isConversationCommandEnabled(metadata, key));
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
  const selfieCommandEnabled =
    isConversationCommandAvailable("selfie") && isConversationCommandEnabled(chatMeta, "selfie");
  const memoryCommandEnabled = isConversationCommandEnabled(chatMeta, "memory");
  const sceneCommandEnabled = isConversationCommandEnabled(chatMeta, "scene");
  const reactCommandEnabled = isConversationCommandEnabled(chatMeta, "react");
  const callCommandEnabled =
    isConversationCommandAvailable("call") && isConversationCommandEnabled(chatMeta, "call");
  const musicCommandEnabled =
    isConversationCommandAvailable("music") && isConversationCommandEnabled(chatMeta, "music");
  const hapticCommandEnabled =
    isConversationCommandAvailable("haptic") && isConversationCommandEnabled(chatMeta, "haptic");
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

  if (reactCommandEnabled) {
    addCommandLines(
      `- [react: emoji="😂"] or [react: emoji=":name:"] — if you want to react to the user's message, send it in its own line, using any standard emoji, or a custom one. It posts as a small emoji on their message, the way you'd react in a chat app. You can also react to another character instead by adding their name: [react: emoji="🙄" to "Character Name"]. Use it only when it genuinely fits how your character feels in the moment; it is optional, may stand alone or sit alongside your reply, and choosing a flat reaction or none at all is itself a valid choice.`,
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
      `- [scene: scenario="brief description of what happens in this scene", background="place"] - request a mini-roleplay scene branching from this conversation. The user will be asked for POV, tense, and optional prompt wishes before the system plans and creates the scene.`,
      `   Example: You agree to go stargazing → include [scene: scenario="lying on a blanket in the park, looking at the stars together", background="park"]`,
      `   WHEN TO USE: You SHOULD proactively trigger a scene whenever the conversation naturally leads to an activity, outing, or situation that would be more immersive as a scene. Examples:`,
      `   - {{user}} says "I'm coming over" or "Let's go to the park" → trigger a scene for arriving/being at that location.`,
      `   - You invite {{user}} somewhere and they accept → trigger a scene for that activity.`,
      `   - A plan is made (date, trip, hangout, confrontation) and the moment arrives → trigger a scene.`,
      `   Do NOT wait for {{user}} to explicitly ask for a scene. If the conversation implies you and {{user}} are about to DO something together, initiate the scene yourself.`,
      `   EXCEPTION: Do NOT start a scene for playing UNO, chess, poker, 8-ball pool, tic-tac-toe, rock-paper-scissors, cards, or other board/table games — those have their own commands. Use [uno] for UNO, [chess] for chess, [poker] for poker, [eightball] for 8-ball pool, [tic_tac_toe] for tic-tac-toe, and [rock_paper_scissors] for rock-paper-scissors, not [scene].`,
    );
  }

  if (callCommandEnabled && chatMode === "conversation") {
    addCommandLines(
      `- [call], [call: reason="brief reason"], or [call: reason="brief reason", greeting="first thing to say after ${personaName} answers"] - ring ${personaName} for an audio call. Use this only when a live call naturally fits, such as when you urgently want to talk, when typing is awkward, or when ${personaName} asks you to call. The system will show an incoming call request; do not assume it was answered unless the call starts. If you include greeting, it will play only after ${personaName} accepts.`,
    );
  }

  // Turn-games: conversation mode only, when no game is running yet and at least one other character is present.
  const unoAdvertisable =
    isConversationCommandAvailable("uno") &&
    chatMode === "conversation" &&
    isConversationCommandEnabled(chatMeta, "uno") &&
    characterIds.length >= 1;
  const chessAdvertisable =
    isConversationCommandAvailable("chess") &&
    chatMode === "conversation" &&
    isConversationCommandEnabled(chatMeta, "chess") &&
    characterIds.length >= 1;
  const pokerAdvertisable =
    isConversationCommandAvailable("poker") &&
    chatMode === "conversation" &&
    isConversationCommandEnabled(chatMeta, "poker") &&
    characterIds.length >= 1;
  const eightballAdvertisable =
    isConversationCommandAvailable("eightball") &&
    chatMode === "conversation" &&
    isConversationCommandEnabled(chatMeta, "eightball") &&
    characterIds.length >= 1;
  const ticTacToeAdvertisable =
    isConversationCommandAvailable("tic_tac_toe") &&
    chatMode === "conversation" &&
    isConversationCommandEnabled(chatMeta, "tic_tac_toe") &&
    characterIds.length >= 1;
  const rpsAdvertisable =
    isConversationCommandAvailable("rock_paper_scissors") &&
    chatMode === "conversation" &&
    isConversationCommandEnabled(chatMeta, "rock_paper_scissors") &&
    characterIds.length >= 1;
  const noActiveTurnGame =
    (unoAdvertisable || chessAdvertisable || pokerAdvertisable || eightballAdvertisable || ticTacToeAdvertisable || rpsAdvertisable) &&
    !(await getActiveTurnGame(args.db, args.chatId));
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
  if (pokerAdvertisable && noActiveTurnGame) {
    addCommandLines(
      `- [poker] - start a game of Texas Hold'em poker at the table. Include this ONLY when ${personaName} proposes playing poker and you are willing to play right now. The system seats ${personaName} plus every willing character at the table and runs the game — you do NOT narrate dealing, blinds, or describe anyone's cards.`,
      `   If you are busy, tired, or simply don't feel like it, just say so in character and do NOT include [poker]. Agreeing to play IS including [poker].`,
      `   Example: ${personaName} says "who's up for some poker?" and you're in → "Deal me in. [poker]"`,
    );
  }
  if (eightballAdvertisable && noActiveTurnGame) {
    addCommandLines(
      `- [eightball] - start a one-on-one game of 8-ball pool against ${personaName}. Include this ONLY when ${personaName} proposes playing pool/8-ball and YOU are willing to play right now. 8-ball seats exactly two players: ${personaName} and you — whichever character includes [eightball] takes the opponent's seat. The system racks the table and runs the game — you do NOT describe the table or narrate shots.`,
      `   If you'd rather not play, say so in character and do NOT include [eightball]. Agreeing to play IS including [eightball].`,
      `   Example: ${personaName} says "rack 'em up?" and you're in → "You're breaking. [eightball]"`,
    );
  }
  if (ticTacToeAdvertisable && noActiveTurnGame) {
    addCommandLines(
      `- [tic_tac_toe] - start a one-on-one tic-tac-toe game against ${personaName}. Include this ONLY when ${personaName} proposes playing tic-tac-toe (or noughts and crosses) and YOU are willing to play right now. Tic-tac-toe seats exactly two players: ${personaName} and you — whichever character includes [tic_tac_toe] takes the opponent's seat. The system sets up the board and runs the game — you do NOT describe the board or narrate moves.`,
      `   If you'd rather not play, say so in character and do NOT include [tic_tac_toe]. Agreeing to play IS including [tic_tac_toe].`,
      `   Example: ${personaName} says "tic-tac-toe?" and you're in → "You're on. [tic_tac_toe]"`,
    );
  }
  if (rpsAdvertisable && noActiveTurnGame) {
    addCommandLines(
      `- [rock_paper_scissors] - start a one-on-one rock-paper-scissors match against ${personaName}. Include this ONLY when ${personaName} proposes playing rock-paper-scissors (or "rps") and YOU are willing to play right now. Rock-paper-scissors seats exactly two players: ${personaName} and you — whichever character includes [rock_paper_scissors] takes the opponent's seat. The system runs the match — you do NOT narrate throws or reveal your choice in advance.`,
      `   If you'd rather not play, say so in character and do NOT include [rock_paper_scissors]. Agreeing to play IS including [rock_paper_scissors].`,
      `   Example: ${personaName} says "rock paper scissors, best of three?" and you're in → "Bring it on. [rock_paper_scissors]"`,
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
