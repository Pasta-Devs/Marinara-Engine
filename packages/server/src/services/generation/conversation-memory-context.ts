import { logger } from "../../lib/logger.js";

type CharactersStore = {
  getById(id: string): Promise<{ data: unknown } | null>;
  update(id: string, data: Record<string, unknown>): Promise<unknown>;
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
}: {
  chars: CharactersStore;
  characterIds: string[];
  awarenessBlock: string | null;
}): Promise<string | null> {
  const memoryLines: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
    if (validMemories.length !== memories.length) {
      const extensions = { ...(charData.extensions ?? {}), characterMemories: validMemories };
      await chars.update(characterId, { extensions });
    }

    for (const memory of validMemories) {
      memoryLines.push(`Memory from ${memory.from}: ${memory.summary}`);
    }
  }

  if (memoryLines.length === 0) return awarenessBlock;

  const memoriesSection = `\n\n## Memories\n${memoryLines.join("\n")}`;
  if (awarenessBlock) {
    return awarenessBlock.replace(/<\/awareness>$/, memoriesSection + "\n</awareness>");
  }
  return `<awareness>\n${memoriesSection.trimStart()}\n</awareness>`;
}
