import { logger } from "../../lib/logger.js";
import { stripConversationResponseEnvelope } from "../../services/conversation/transcript-sanitize.js";
import {
  stripSpacesBeforeLineBreaks,
  trimIncompleteModelEnding,
} from "../../services/generation/generation-text-utils.js";

type ReplyCharacter = { id: string; name: string };

/**
 * Cleans a finished reply after its commands are parsed: OOC extraction, the individual-group
 * speaker prefix strip, the Conversation envelope strip, the incomplete-ending trim and the
 * roleplay whitespace trim. A reply that only holds other speakers' turns is dropped.
 */
export function cleanGeneratedReply(
  text: string,
  o: {
    chatId: string;
    chatMode: string;
    impersonate: boolean;
    connectedChatId: string | null | undefined;
    isGroupChat: boolean;
    usesIndividualGroupGeneration: boolean;
    targetCharId: string | null;
    charInfo: ReadonlyArray<ReplyCharacter>;
    /** Trim a cut-off model ending (already false for impersonation and a defined intro). */
    trimIncompleteEnding: boolean;
  },
): { text: string; changed: boolean; oocMessages: string[] } | { dropped: "wrong_speaker" } {
  let fullResponse = text;
  let changed = false;
  const { chatMode, targetCharId, charInfo } = o;

  // ── Extract <ooc> tags from roleplay responses and post to connected conversation ──
  const oocMessages: string[] = [];
  if (chatMode === "roleplay" && !o.impersonate && o.connectedChatId) {
    const OOC_RE = /<ooc>([\s\S]*?)<\/ooc>/gi;
    for (const match of fullResponse.matchAll(OOC_RE)) {
      const text = match[1]!.trim();
      if (text) oocMessages.push(text);
    }
    if (oocMessages.length > 0) {
      fullResponse = fullResponse
        .replace(OOC_RE, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      changed = true;
    }
  }

  // ── Strip character name prefix in individual group mode ──
  // LLMs often prefix the response with the character name even when told not to.
  // Also strip any leftover <speaker> tags from individual mode responses.
  if (o.isGroupChat && o.usesIndividualGroupGeneration && targetCharId) {
    const charRow = charInfo.find((c) => c.id === targetCharId);
    if (charRow) {
      const cName = charRow.name;
      const escapedName = cName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (chatMode === "conversation") {
        const beforeTimestampStrip = fullResponse;
        fullResponse = fullResponse
          .replace(/^(\s*\[\d{1,2}[:.]\d{2}\]\s*)+/g, "")
          .replace(/^(\s*\[\d{1,2}\.\d{1,2}\.\d{4}\]\s*)+/g, "")
          .trimStart();
        if (fullResponse !== beforeTimestampStrip) changed = true;
      }
      // Strip <speaker="Name">...</speaker> wrapper if present
      const speakerWrap = new RegExp(`^\\s*<speaker="${escapedName}">[\\s\\S]*?<\\/speaker>\\s*$`, "i");
      const speakerMatch = fullResponse.match(speakerWrap);
      if (speakerMatch) {
        fullResponse = fullResponse
          .replace(/<speaker="[^"]*">/gi, "")
          .replace(/<\/speaker>/gi, "")
          .trim();
        changed = true;
      }
      // Strip plain name prefixes: "Dottore: text" or "Dottore\ntext".
      const beforeNamePrefixStrip = fullResponse;
      const targetPrefix = new RegExp(`^\\s*${escapedName}\\s*:\\s*`, "i");
      const targetLinePrefix = new RegExp(`^\\s*${escapedName}\\s*\\n+`, "i");
      const stripTargetPrefix = () => {
        fullResponse = fullResponse.replace(targetPrefix, "").replace(targetLinePrefix, "").trimStart();
      };
      const otherNames = charInfo
        .filter((character) => character.id !== targetCharId)
        .map((character) => character.name)
        .filter((name): name is string => Boolean(name))
        .filter((name) => name.trim().toLocaleLowerCase() !== cName.trim().toLocaleLowerCase())
        .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const otherSpeakerPrefix =
        otherNames.length > 0 ? new RegExp(`^\\s*(?:${otherNames.join("|")})\\s*:\\s*`, "i") : null;

      stripTargetPrefix();
      let prunePasses = 0;
      while (otherSpeakerPrefix?.test(fullResponse) && prunePasses++ < 6) {
        const embeddedTargetPrefix = new RegExp(`(?:^|\\n\\s*\\n)\\s*${escapedName}\\s*:\\s*`, "i");
        const targetMatch = fullResponse.match(embeddedTargetPrefix);
        if (targetMatch?.index != null && targetMatch.index > 0) {
          fullResponse = fullResponse.slice(targetMatch.index).trimStart();
          stripTargetPrefix();
          continue;
        }
        const paragraphBreak = fullResponse.search(/\n(?:\s*\n)?/);
        if (paragraphBreak < 0) {
          logger.warn(
            {
              chatId: o.chatId,
              targetCharId,
              targetName: cName,
              responsePreview: fullResponse.slice(0, 240),
            },
            "[generate] Dropping wrong-speaker-only individual group response",
          );
          return { dropped: "wrong_speaker" };
        }
        fullResponse = fullResponse.slice(paragraphBreak).trimStart();
        stripTargetPrefix();
      }
      if (chatMode === "conversation" && otherNames.length > 0) {
        const nextSpeakerPrefix = new RegExp(`\\n\\s*(?:${otherNames.join("|")})\\s*:\\s*`, "i");
        const nextSpeakerMatch = fullResponse.match(nextSpeakerPrefix);
        if (nextSpeakerMatch?.index != null) {
          fullResponse = fullResponse.slice(0, nextSpeakerMatch.index).trimEnd();
        }
      }
      if (fullResponse !== beforeNamePrefixStrip) {
        changed = true;
      }
    }
  }

  // ── Strip leaked timestamps/speaker envelopes from Conversation responses ──
  // Models sometimes echo prompt-only metadata such as
  // `[11.07 15:53] Character: Hello!`. Keep merged group speaker
  // boundaries, but store single/individual replies as content only.
  if (chatMode === "conversation" && !o.impersonate) {
    const beforeStrip = fullResponse;
    const conversationSpeakerName = targetCharId
      ? (charInfo.find((character) => character.id === targetCharId)?.name ?? null)
      : null;
    fullResponse = stripConversationResponseEnvelope(fullResponse, {
      speakerName: conversationSpeakerName,
      speakerNames: charInfo.map((character) => character.name),
      preserveSpeakerPrefix: o.isGroupChat && !o.usesIndividualGroupGeneration,
    });
    if (fullResponse !== beforeStrip) {
      changed = true;
    }
  }

  if (o.trimIncompleteEnding) {
    const beforeTrim = fullResponse;
    fullResponse = trimIncompleteModelEnding(fullResponse);
    if (fullResponse !== beforeTrim) {
      changed = true;
      logger.debug(
        "[generate] Trimmed incomplete model ending for chat %s (%d -> %d chars)",
        o.chatId,
        beforeTrim.length,
        fullResponse.length,
      );
    }
  }

  if (chatMode === "roleplay") {
    const beforeRoleplayWhitespace = fullResponse;
    fullResponse = stripSpacesBeforeLineBreaks(fullResponse).trim();
    if (fullResponse !== beforeRoleplayWhitespace) {
      changed = true;
    }
  }

  // Keep an OOC-only answer visible: an empty reply is discarded before linked-chat
  // posting runs. Check after speaker/ending cleanup, which can remove the last prose.
  if (!fullResponse.trim() && oocMessages.length > 0) {
    // Reuse cleanup once without extraction so recovered text still obeys the speaker gate.
    const recovered = cleanGeneratedReply(oocMessages.join("\n\n"), { ...o, connectedChatId: null });
    if ("dropped" in recovered || !recovered.text.trim()) return recovered;
    fullResponse = recovered.text;
    logger.warn(
      { chatId: o.chatId, connectedChatId: o.connectedChatId, oocCount: oocMessages.length },
      "[generate] Kept OOC-only reply visible in roleplay after post-processing removed all prose",
    );
    oocMessages.length = 0;
    changed = true;
  } else if (oocMessages.length > 0) {
    logger.info("[generate] Extracted %d OOC message(s) for conversation %s", oocMessages.length, o.connectedChatId);
  }

  return { text: fullResponse, changed, oocMessages };
}
