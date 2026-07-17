import type { WrapFormat } from "@marinara-engine/shared";

import { logger } from "../../lib/logger.js";
import { getZonedDayBounds } from "../conversation/timezone.js";
import { wrapContent } from "../prompt/format-engine.js";
import { sanitizePromptLeaf } from "../prompt/prompt-escaping.js";

type CharactersStore = {
  getById(id: string): Promise<{ data: unknown } | null>;
};

type CharacterMemory = {
  from: string;
  fromCharId: string;
  summary: string;
  createdAt: string;
};

export async function mergeConversationCharacterMemories({
  chars,
  characterIds,
  awarenessBlock,
  timeZone,
  wrapFormat,
}: {
  chars: CharactersStore;
  characterIds: string[];
  awarenessBlock: string | null;
  timeZone?: string;
  wrapFormat: WrapFormat;
}): Promise<string | null> {
  const memoryLines: string[] = [];
  const today = getZonedDayBounds(new Date(), timeZone).start;

  for (const characterId of characterIds) {
    const charRow = await chars.getById(characterId);
    if (!charRow) continue;

    let charData: Record<string, any>;
    try {
      const parsed = typeof charRow.data === "string" ? JSON.parse(charRow.data) : charRow.data;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      charData = parsed as Record<string, any>;
    } catch (error) {
      logger.warn(error, "[memory] Skipping malformed character data for %s", characterId);
      continue;
    }
    const memories: CharacterMemory[] = charData.extensions?.characterMemories ?? [];
    if (memories.length === 0) continue;

    const validMemories = memories.filter((memory) => new Date(memory.createdAt) >= today);

    for (const memory of validMemories) {
      memoryLines.push(
        `Memory from ${sanitizePromptLeaf(memory.from, wrapFormat)}: ${sanitizePromptLeaf(memory.summary, wrapFormat)}`,
      );
    }
  }

  if (memoryLines.length === 0) return awarenessBlock;

  const memoriesSection = wrapContent(memoryLines.join("\n"), "Memories", wrapFormat, 1);
  if (awarenessBlock) {
    if (wrapFormat === "xml") {
      return awarenessBlock.replace(/<\/awareness>$/, `${memoriesSection}\n</awareness>`);
    }
    return `${awarenessBlock}\n\n${memoriesSection}`;
  }
  return wrapContent(memoriesSection, "Awareness", wrapFormat);
}
