import type { ChatMode, MultiplayerErrorCode } from "@marinara-engine/shared";

export function multiplayerGuestErrorLabelKey(code: MultiplayerErrorCode) {
  return `multiplayer.guest.errors.${code.replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase())}`;
}

/** Only locally translated strings cross into the isolated guest presentation. */
export const MULTIPLAYER_GUEST_LABEL_KEYS = [
  "title",
  "players",
  "closePlayers",
  "leave",
  "emptyMessages",
  "awaitingApproval",
  "reconnecting",
  "ended",
  "lobby",
  "paused",
  "connected",
  "host",
  "you",
  "waiting",
  "ready",
  "nextRound",
  "playing",
  "ai",
  "gm",
  "noPersona",
  "aiManagedByHost",
  "textOnly",
  "roundStatus",
  "waitingFor",
  "resolving",
  "interrupted",
  "actionSubmitted",
  "passSubmitted",
  "submitAction",
  "saveAction",
  "editAction",
  "pass",
  "messagePlaceholder",
  "actionPlaceholder",
  "send",
  "sending",
  "requestResponse",
  "generating",
  "actionFailed",
  "gameStatus",
  "gameExploration",
  "gameDialogue",
  "gameCombat",
  "gameTravelRest",
  "gameLocation",
  "gameWeather",
  "gameTime",
  "gameRolls",
  "gameTrackers",
  "gameChoices",
  "gameAddChoice",
  "commands",
  "commandsHelp",
  "reactionBy",
  "eventHostPass",
  "eventKick",
  "eventPause",
  "eventResume",
] as const;

export type MultiplayerGuestLabels = Record<(typeof MULTIPLAYER_GUEST_LABEL_KEYS)[number], string> & {
  errors: Record<MultiplayerErrorCode, string>;
  modes: Record<ChatMode, string>;
};
