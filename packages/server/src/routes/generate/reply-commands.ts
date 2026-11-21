import type { RoleplayCommandActivity } from "@marinara-engine/shared";
import { resolveSelfieImageConnectionId } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import {
  parseCharacterCommands,
  parseCharacterCommandsBySpeaker,
  parseDirectMessageCommands,
  type CharacterCommand,
  type DirectMessageCommand,
} from "../../services/conversation/character-commands.js";
import {
  filterEnabledConversationCommands,
  isConversationCommandEnabled,
} from "../../services/generation/conversation-command-runtime.js";
import {
  formatUnresolvedRoleplayDmFallback,
  replaceRoleplayDmCommandText,
  resolveRoleplayDmTarget,
} from "../../services/generation/roleplay-dm-utils.js";
import { recoverImplicitSelfieCommand } from "../../services/generation/selfie-command-recovery.js";

type ReplyCharacter = { id: string; name: string };

/** Parses a Conversation reply's character commands, then recovers an implicit selfie. */
export function parseConversationReplyCommands(
  text: string,
  o: {
    chatId: string;
    chatMeta: Record<string, unknown>;
    charInfo: ReadonlyArray<ReplyCharacter>;
    targetCharId: string | null;
    /** Merged group conversations attribute each command to its speaker. */
    speakerAttribution: boolean;
    latestUserMessage?: string | null;
    /** The Images default, when selfies follow it (see selfieFollowsImagesDefault). */
    selfieImagesDefaultId?: string | null;
  },
) {
  let changed = false;
  let commands: CharacterCommand[] = [];
  let commandCharacterIds: (string | null)[] | null = null;
  let commandContent: string | null = null;
  const responseBeforeCommandParsing = text;
  // Merged group conversations carry multiple characters' turns in one
  // response; attribute each command to its speaker so e.g. a [selfie]
  // renders the character that took it, not always the first one.
  const speakerParse = o.speakerAttribution ? parseCharacterCommandsBySpeaker(text, o.charInfo, o.targetCharId) : null;
  const parsed = speakerParse ?? parseCharacterCommands(text);
  const speakerIdByCommand = speakerParse
    ? new Map(
        speakerParse.commands.map(
          (command, index) => [command, speakerParse.commandCharacterIds[index] ?? o.targetCharId] as const,
        ),
      )
    : null;
  if (parsed.commands.length > 0) {
    commands = filterEnabledConversationCommands(parsed.commands, o.chatMeta);
    if (commands.length > 0) {
      commandContent = responseBeforeCommandParsing.trim();
      if (speakerIdByCommand) {
        commandCharacterIds = commands.map((command) => speakerIdByCommand.get(command) ?? o.targetCharId);
      }
    }
    text = parsed.cleanContent;
    changed = true;
    logger.info(
      "[generate] Parsed %d character command(s), %d enabled: %j",
      parsed.commands.length,
      commands.length,
      commands.map((c) => c.type),
    );
  }
  const recoveredSelfieCommand = recoverImplicitSelfieCommand({
    response: text,
    latestUserMessage: o.latestUserMessage,
    imageGenerationEnabled:
      isConversationCommandEnabled(o.chatMeta, "selfie") &&
      resolveSelfieImageConnectionId(o.chatMeta, o.selfieImagesDefaultId ?? null).length > 0,
    existingCommands: commands,
  });
  if (recoveredSelfieCommand) {
    commands = [...commands, recoveredSelfieCommand];
    // Recovered (implicit) selfies have no speaker prefix to attribute to;
    // fall back to the generation's character.
    if (commandCharacterIds) commandCharacterIds = [...commandCharacterIds, o.targetCharId];
    logger.info("[generate] Recovered implicit selfie command for chat %s", o.chatId);
  }
  return { text, changed, rawCount: parsed.commands.length, commands, commandCharacterIds, commandContent };
}

/**
 * Parses a Roleplay reply's [dm] commands. A target with a card becomes an executable
 * command plus activity; a cardless target is replaced by its plain-text fallback.
 * `listCharacters` runs only when the reply holds a [dm] command.
 */
export async function parseRoleplayDmReplyCommands(
  text: string,
  o: {
    charInfo: ReplyCharacter[];
    listCharacters: () => Promise<Array<{ id: string; data?: unknown }>>;
  },
) {
  const activity: RoleplayCommandActivity[] = [];
  const executableCommands: DirectMessageCommand[] = [];
  const parsed = parseDirectMessageCommands(text);
  if (parsed.commands.length === 0) return { text, changed: false, commands: executableCommands, activity };

  const allCharacters = await o.listCharacters();
  const skippedTargets: string[] = [];
  let nextResponse = text;

  for (const command of parsed.commands) {
    const target = resolveRoleplayDmTarget(command.character, o.charInfo, allCharacters);
    if (target) {
      activity.push({
        command: { type: "dm", character: command.character, message: command.message },
        raw: command.raw ?? JSON.stringify(command),
      });
      executableCommands.push({
        ...command,
        resolvedCharacterId: target.id,
        resolvedCharacterName: target.name,
      });
      nextResponse = replaceRoleplayDmCommandText(nextResponse, command, "");
    } else {
      skippedTargets.push(command.character);
      nextResponse = replaceRoleplayDmCommandText(nextResponse, command, formatUnresolvedRoleplayDmFallback(command));
    }
  }

  logger.info(
    "[generate] Parsed %d executable roleplay DM command(s), skipped %d cardless target(s): %j",
    executableCommands.length,
    skippedTargets.length,
    executableCommands.map((c) => c.resolvedCharacterName ?? c.character),
  );
  for (const target of skippedTargets) {
    logger.warn('[generate] Skipped roleplay DM command for cardless target "%s"', target);
  }
  return {
    text: nextResponse.replace(/\n{3,}/g, "\n\n").trim(),
    changed: true,
    commands: executableCommands,
    activity,
  };
}
