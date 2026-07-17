import type { WrapFormat } from "@marinara-engine/shared";

import { sanitizeConnectedGameTranscript } from "../../services/generation/generation-text-utils.js";
import { isConversationCommandEnabled } from "../../services/generation/conversation-command-runtime.js";
import { wrapContent } from "../../services/prompt/format-engine.js";
import { sanitizePromptLeaf } from "../../services/prompt/prompt-escaping.js";
import { parseGameStateRow } from "./generate-route-utils.js";

type ConnectedChatRow = {
  id: string;
  name?: string | null;
  mode?: string | null;
  characterIds?: unknown;
  metadata?: unknown;
};

type ConnectedChatMessage = {
  role?: string | null;
  characterId?: string | null;
  content?: unknown;
};

type ConnectedCharacterRow = {
  data?: unknown;
};

type ConnectedChatsStore = {
  getById(id: string): Promise<ConnectedChatRow | null>;
  listMessages(chatId: string): Promise<ConnectedChatMessage[]>;
};

type ConnectedCharactersStore = {
  getById(id: string): Promise<ConnectedCharacterRow | null>;
};

type ConnectedGameStateStore = {
  getLatestCommitted(chatId: string): Promise<Record<string, unknown> | null>;
  getLatest(chatId: string): Promise<Record<string, unknown> | null>;
};

export async function resolveConversationConnectedChatContext(args: {
  connectedChatId: unknown;
  conversationCommandsEnabled: boolean;
  chatMeta: Record<string, unknown>;
  personaName: string;
  chats: ConnectedChatsStore;
  chars: ConnectedCharactersStore;
  gameStateStore: ConnectedGameStateStore;
  wrapFormat: WrapFormat;
}): Promise<{ connectedChatBlock: string | null; systemPromptAppend: string | null }> {
  if (!args.connectedChatId) return { connectedChatBlock: null, systemPromptAppend: null };

  let connectedChatBlock: string | null = null;
  let systemPromptAppend: string | null = null;
  const connectedInfluenceCommandEnabled =
    args.conversationCommandsEnabled && isConversationCommandEnabled(args.chatMeta, "influence");
  const connectedNoteCommandEnabled =
    args.conversationCommandsEnabled && isConversationCommandEnabled(args.chatMeta, "note");
  const connectedChat = await args.chats.getById(args.connectedChatId as string);
  const safe = (value: unknown): string => sanitizePromptLeaf(String(value ?? ""), args.wrapFormat);
  const nestedSection = (content: string, name: string): string => wrapContent(content, name, args.wrapFormat, 1);

  if (connectedChat && connectedChat.mode === "roleplay") {
    const rpMessages = await args.chats.listMessages(connectedChat.id);
    const recentRp = rpMessages.slice(-20);

    const rpCharIds: string[] =
      typeof connectedChat.characterIds === "string"
        ? JSON.parse(connectedChat.characterIds as string)
        : (connectedChat.characterIds as string[]);
    const rpCharNames = new Map<string, string>();
    for (const cid of rpCharIds) {
      const row = await args.chars.getById(cid);
      if (row) {
        const d = JSON.parse(row.data as string);
        rpCharNames.set(cid, d.name ?? "Unknown");
      }
    }

    const recentMessageLines: string[] = [];
    for (const m of recentRp) {
      const speaker =
        m.role === "user"
          ? args.personaName
          : m.characterId
            ? (rpCharNames.get(m.characterId) ?? "Character")
            : "Narrator";
      recentMessageLines.push(`[${safe(speaker)}]: ${safe(String(m.content ?? "").slice(0, 500))}`);
    }
    const safeConnectedChatName = safe(connectedChat.name ?? "Connected roleplay");
    connectedChatBlock = wrapContent(
      [`Connected roleplay: ${safeConnectedChatName}`, nestedSection(recentMessageLines.join("\n"), "Recent Messages")]
        .filter(Boolean)
        .join("\n\n"),
      "Connected Roleplay",
      args.wrapFormat,
    );

    if (connectedInfluenceCommandEnabled || connectedNoteCommandEnabled) {
      const connectedInstructionLines = [
        `You have access to context from a connected roleplay: "${safeConnectedChatName}".`,
        `Recent messages from that roleplay are provided so you can naturally reference or discuss events happening there.`,
      ];
      if (connectedInfluenceCommandEnabled) {
        connectedInstructionLines.push(
          ``,
          `If something said in THIS conversation should affect or influence the roleplay, you can create an influence tag:`,
          `<influence>description of what should happen or change in the roleplay based on this conversation</influence>`,
          `Example: if the user says "tell ${safe(rpCharNames.values().next().value ?? "them")} to meet us at the tavern", you could respond normally AND include:`,
          `<influence>The group discussed meeting at the tavern. ${safe(args.personaName)} wants everyone to head there.</influence>`,
          ``,
          `Influences are injected into the roleplay's context before the next generation. Use them sparingly; only when conversation content genuinely should cross over into the roleplay.`,
          `The influence tag is stripped from your visible message. The rest of your response is shown normally.`,
        );
      }
      if (connectedNoteCommandEnabled) {
        connectedInstructionLines.push(
          ``,
          `If something said in this conversation should durably persist in the roleplay's context across many turns (a fact the character should keep remembering, a promise made, a secret revealed, a name learned), create a note tag instead of an influence:`,
          `<note>fact, decision, or detail the roleplay character should keep remembering</note>`,
          `Notes are shown to the roleplay character on every future turn until the user clears them. Use influences for one-shot mid-scene steering; use notes for things that should remain true going forward. Use notes sparingly; every saved note costs prompt budget on every roleplay turn.`,
          `The note tag is stripped from your visible message.`,
        );
      }
      systemPromptAppend = wrapContent(
        connectedInstructionLines.join("\n"),
        "Connected Roleplay Instructions",
        args.wrapFormat,
      );
    }
  } else if (connectedChat && connectedChat.mode === "game") {
    const gameMeta =
      typeof connectedChat.metadata === "string"
        ? JSON.parse(connectedChat.metadata)
        : (connectedChat.metadata ?? {});
    const sessionNumber = (gameMeta.gameSessionNumber as number) ?? 1;
    const sessionStatus = (gameMeta.gameSessionStatus as string) ?? "setup";
    const activeState = (gameMeta.gameActiveState as string) ?? "exploration";
    const storedSummaries = Array.isArray(gameMeta.gamePreviousSessionSummaries)
      ? (gameMeta.gamePreviousSessionSummaries as Array<{
          summary?: string;
          resumePoint?: string;
          partyDynamics?: string;
          keyDiscoveries?: string[];
        }>)
      : [];
    const latestSummary = storedSummaries[storedSummaries.length - 1] ?? null;
    const gameMessages = await args.chats.listMessages(connectedChat.id);
    const recentGame = gameMessages.slice(-20);
    const latestConnectedState =
      (await args.gameStateStore.getLatestCommitted(connectedChat.id)) ??
      (await args.gameStateStore.getLatest(connectedChat.id));
    const linkedGameState = latestConnectedState ? parseGameStateRow(latestConnectedState) : null;

    const safeConnectedChatName = safe(connectedChat.name ?? "Connected game");
    const gameSections: string[] = [
      `Connected game: ${safeConnectedChatName}`,
      nestedSection(`Session ${safe(sessionNumber)} (${safe(sessionStatus)}), state: ${safe(activeState)}`, "Status"),
    ];
    if (linkedGameState) {
      const sceneDetails = [
        linkedGameState.location ? `Location: ${safe(linkedGameState.location)}` : null,
        linkedGameState.time ? `Time: ${safe(linkedGameState.time)}` : null,
        linkedGameState.date ? `Date: ${safe(linkedGameState.date)}` : null,
        linkedGameState.weather ? `Weather: ${safe(linkedGameState.weather)}` : null,
        linkedGameState.temperature ? `Temperature: ${safe(linkedGameState.temperature)}` : null,
      ].filter(Boolean);
      if (sceneDetails.length > 0) {
        gameSections.push(nestedSection(sceneDetails.join(" | "), "Scene"));
      }
      if (linkedGameState.presentCharacters.length > 0) {
        gameSections.push(
          nestedSection(
            linkedGameState.presentCharacters.map((character) => safe(character.name)).join(", "),
            "Present Characters",
          ),
        );
      }
      if (linkedGameState.recentEvents.length > 0) {
        gameSections.push(
          nestedSection(
            linkedGameState.recentEvents
              .slice(-5)
              .map((event) => `- ${safe(event.slice(0, 300))}`)
              .join("\n"),
            "Recent Events",
          ),
        );
      }
    }
    if (latestSummary?.summary) {
      gameSections.push(nestedSection(safe(latestSummary.summary), "Latest Session Summary"));
      if (latestSummary.resumePoint) {
        gameSections.push(nestedSection(safe(latestSummary.resumePoint), "Resume Point"));
      }
      if (latestSummary.partyDynamics) {
        gameSections.push(nestedSection(safe(latestSummary.partyDynamics), "Party Dynamics"));
      }
      if (Array.isArray(latestSummary.keyDiscoveries) && latestSummary.keyDiscoveries.length > 0) {
        gameSections.push(nestedSection(latestSummary.keyDiscoveries.map(safe).join("; "), "Key Discoveries"));
      }
    }
    const recentMessageLines: string[] = [];
    for (const m of recentGame) {
      const speaker = m.role === "user" ? args.personaName : m.role === "narrator" ? "Narrator" : "Game Master";
      const content = sanitizeConnectedGameTranscript(typeof m.content === "string" ? m.content : "");
      if (!content) continue;
      recentMessageLines.push(`[${safe(speaker)}]: ${safe(content.slice(0, 500))}`);
    }
    gameSections.push(nestedSection(recentMessageLines.join("\n"), "Recent Messages"));
    connectedChatBlock = wrapContent(gameSections.filter(Boolean).join("\n\n"), "Connected Game", args.wrapFormat);

    if (connectedInfluenceCommandEnabled || connectedNoteCommandEnabled) {
      const connectedInstructionLines = [
        `You have access to context from a connected game: "${safeConnectedChatName}".`,
        `The current scene, session summary, and recent game messages are provided so you can naturally answer questions or comment on what is happening in that game.`,
      ];
      if (connectedInfluenceCommandEnabled) {
        connectedInstructionLines.push(
          ``,
          `If something said in THIS conversation should affect or influence the game, you can create an influence tag:`,
          `<influence>description of what should happen or change in the game based on this conversation</influence>`,
          `Example: if the group agrees they want to visit the merchant district next, you could respond normally AND include:`,
          `<influence>The group agreed they want to head to the merchant district next and look for supplies.</influence>`,
          ``,
          `Influences are injected into the game's context before the next generation. Use them sparingly; only when conversation content genuinely should cross over into the game.`,
          `The influence tag is stripped from your visible message. The rest of your response is shown normally.`,
        );
      }
      if (connectedNoteCommandEnabled) {
        connectedInstructionLines.push(
          ``,
          `If something said in this conversation should durably persist in the game's context across many turns (an established world fact, an ongoing party dynamic, a recurring NPC trait, a secret the GM should keep remembering), create a note tag instead of an influence:`,
          `<note>fact, decision, or detail the game should keep remembering</note>`,
          `Notes are shown to the game on every future turn until the user clears them. Use influences for one-shot mid-scene steering; use notes for things that should remain true going forward. Use notes sparingly; every saved note costs prompt budget on every game turn.`,
          `The note tag is stripped from your visible message.`,
        );
      }
      systemPromptAppend = wrapContent(
        connectedInstructionLines.join("\n"),
        "Connected Game Instructions",
        args.wrapFormat,
      );
    }
  }

  return { connectedChatBlock, systemPromptAppend };
}
