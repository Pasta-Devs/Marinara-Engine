import { normalizeTextForMatch, type WrapFormat } from "@marinara-engine/shared";

import { getIntentHint, isMessageIntent } from "../../services/conversation/intent.service.js";
import {
  formatZonedConversationDate,
  formatZonedConversationTime,
  getZonedWeekdayName,
} from "../../services/conversation/timezone.js";
import { wrapContent } from "../../services/prompt/format-engine.js";

type ConversationContextCharacter = {
  charId?: string;
  name: string;
  displayName?: string;
  status: string;
  activity: string;
  todaySchedule?: string | null;
};

type PromptRoleMessage = {
  role: string;
};

export function buildConversationCurrentContextBlock(args: {
  nowInstant: Date;
  promptTimeZone?: string;
  convoCharInfo: ConversationContextCharacter[];
  finalMessages: PromptRoleMessage[];
  personaName: string;
  userMessage?: string | null;
  userStatus?: string | null;
  userActivity?: string | null;
  mentionedCharacterNames?: string[] | null;
  autonomousIntentKey?: unknown;
  /** Character receiving this prompt in Individual group mode. */
  primaryCharacterId?: string | null;
  /** @deprecated Group behavior is derived from convoCharInfo. Kept for caller compatibility. */
  isGroup?: boolean;
  /** @deprecated Conversation mode no longer has a separate early-group mode. */
  earlyGroupMode?: string;
  wrapFormat: WrapFormat;
}): string {
  const timeStr = formatZonedConversationTime(args.nowInstant, args.promptTimeZone);
  const dateStr = formatZonedConversationDate(args.nowInstant, args.promptTimeZone);
  const dayName = getZonedWeekdayName(args.nowInstant, args.promptTimeZone);

  const scheduleLines: string[] = [];
  for (const character of args.convoCharInfo) {
    if (character.todaySchedule) {
      const prefix =
        args.convoCharInfo.length > 1
          ? `${character.name}'s schedule today (${dayName}): `
          : `Your schedule today (${dayName}): `;
      scheduleLines.push(prefix + character.todaySchedule);
    }
  }

  const statusLines = buildConversationStatusLines(args.convoCharInfo, args.primaryCharacterId);

  const userStatusLabels: Record<string, string> = {
    active: "online",
    idle: "idle / away from the computer",
    dnd: "do not disturb",
  };
  const shouldIncludeUserStatus = args.userStatus !== "invisible";
  const userStatusLabel = userStatusLabels[args.userStatus ?? "active"] ?? "online";
  const userActivity = args.userActivity?.replace(/\s+/g, " ").trim().slice(0, 120) ?? "";
  const userStatusLine = userActivity ? `${userStatusLabel} - ${userActivity}` : userStatusLabel;

  const mentionLine = buildMentionLine({
    mentionedCharacterNames: args.mentionedCharacterNames,
    convoCharInfo: args.convoCharInfo,
    personaName: args.personaName,
  });

  const latestVisiblePromptTurn = [...args.finalMessages]
    .reverse()
    .find((message) => message.role === "user" || message.role === "assistant");
  const proactiveTurnLine =
    latestVisiblePromptTurn?.role === "assistant" && !args.userMessage?.trim()
      ? `No new message from ${args.personaName} was sent in this request; this is a proactive/autonomous turn. Do not write ${args.personaName}'s side of the conversation.`
      : null;
  const autonomousIntentKey = typeof args.autonomousIntentKey === "string" ? args.autonomousIntentKey : "";
  const intentHint = isMessageIntent(autonomousIntentKey) ? getIntentHint(autonomousIntentKey) : "";

  const contextLines = [
    ...statusLines,
    ...(shouldIncludeUserStatus ? [`${args.personaName}'s status: ${userStatusLine}.`] : []),
    ...(proactiveTurnLine ? [proactiveTurnLine] : []),
    ...(mentionLine ? [mentionLine] : []),
    ...(intentHint ? [`What prompted this message: ${intentHint}`] : []),
    ...scheduleLines,
    `The current time and date: ${timeStr}, ${dateStr}.`,
  ];

  return wrapContent(contextLines.join("\n"), "Context", args.wrapFormat);
}

function buildConversationStatusLines(
  convoCharInfo: ConversationContextCharacter[],
  primaryCharacterId?: string | null,
): string[] {
  const statusLabels: Record<string, string> = {
    online: "online",
    idle: "idle / away",
    dnd: "busy / do not disturb",
    offline: "offline",
  };
  const buildCharStatus = (character: ConversationContextCharacter) => {
    const label = statusLabels[character.status] ?? "online";
    return character.activity ? `${label} (${character.activity})` : label;
  };
  const promptName = (character: ConversationContextCharacter) => character.displayName?.trim() || character.name;
  const primaryCharacter = primaryCharacterId
    ? convoCharInfo.find((character) => character.charId === primaryCharacterId)
    : null;

  if (!primaryCharacter || convoCharInfo.length === 1) {
    const statusLine =
      convoCharInfo.length === 1
        ? buildCharStatus(convoCharInfo[0]!)
        : convoCharInfo.map((character) => `${character.name}: ${buildCharStatus(character)}`).join("; ");
    return [`Your current status: ${statusLine}.`];
  }

  return [
    `Your current status: ${promptName(primaryCharacter)}: ${buildCharStatus(primaryCharacter)}.`,
    ...convoCharInfo
      .filter((character) => character !== primaryCharacter)
      .map((character) => `${promptName(character)}'s status: ${buildCharStatus(character)}.`),
  ];
}

export function replaceConversationContextBlockForTarget(
  content: string,
  sharedContextBlock: string,
  targetContextBlock: string,
): string {
  if (!sharedContextBlock || sharedContextBlock === targetContextBlock || !content.includes(sharedContextBlock)) {
    return content;
  }
  return content.split(sharedContextBlock).join(targetContextBlock);
}

function buildMentionLine(args: {
  mentionedCharacterNames?: string[] | null;
  convoCharInfo: ConversationContextCharacter[];
  personaName: string;
}): string | null {
  const mentionedNames = (args.mentionedCharacterNames ?? []).filter((name) =>
    args.convoCharInfo.some((character) => normalizeTextForMatch(character.name) === normalizeTextForMatch(name)),
  );
  if (mentionedNames.length === 0) return null;

  if (args.convoCharInfo.length === 1) {
    return `${args.personaName} @mentioned you directly — treat this as an urgent ping that demands your attention even if you are busy or away.`;
  }

  return `${args.personaName} @mentioned: ${mentionedNames.join(", ")} — this is an urgent ping directed at ${
    mentionedNames.length === 1 ? "that person" : "those people"
  } specifically. The mentioned character(s) should feel compelled to respond promptly even if busy or away.`;
}
