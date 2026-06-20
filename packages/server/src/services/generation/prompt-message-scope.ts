import { nameToXmlTag } from "@marinara-engine/shared";
import { pruneEmptyPromptWrappers } from "./runtime-agent-sections.js";

export type GenerationPromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  contextKind?: "prompt" | "history" | "injection";
  characterId?: string | null;
  images?: string[];
  files?: Array<{ type: string; data: string; filename?: string }>;
  providerMetadata?: Record<string, unknown>;
};

type CharacterPromptScopeInfo = {
  id: string;
  name: string;
  description?: string;
  personality?: string;
  scenario?: string;
  systemPrompt?: string;
  backstory?: string;
  appearance?: string;
  mesExample?: string;
  postHistoryInstructions?: string;
};

const PROFILE_SNIPPET_MIN_LENGTH = 20;

export function isStandaloneCharacterProfileBlock(content: string, characterName: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  const xmlTag = nameToXmlTag(characterName);
  if (
    (trimmed.startsWith(`<${xmlTag}>`) && trimmed.endsWith(`</${xmlTag}>`)) ||
    (trimmed.startsWith(`<${characterName}>`) && trimmed.endsWith(`</${characterName}>`))
  ) {
    return true;
  }
  const escaped = characterName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^#{1,6}\\s+${escaped}\\s*$`, "m").test(trimmed);
}

function nameToMarkdownHeadingForMatch(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim()
    .toLowerCase();
}

function removeXmlCharacterBlocks(content: string, characterName: string): string {
  const tagNames = new Set([nameToXmlTag(characterName)]);
  if (/^[A-Za-z][\w.-]*$/.test(characterName)) tagNames.add(characterName);

  let result = content;
  for (const tagName of tagNames) {
    if (!tagName) continue;
    const escapedTag = escapeRegExp(tagName);
    const blockPattern = new RegExp(
      `\\n?[ \\t]*<${escapedTag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${escapedTag}>[ \\t]*(?=\\n|$)`,
      "gi",
    );
    result = result.replace(blockPattern, "\n");
  }
  return result;
}

function removeMarkdownCharacterBlocks(content: string, characterNames: string[]): string {
  if (!characterNames.length) return content;
  const targetHeadings = new Set(
    characterNames.flatMap((name) => [name.trim().toLowerCase(), nameToMarkdownHeadingForMatch(name)]).filter(Boolean),
  );
  const lines = content.split(/\r?\n/);
  const kept: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    const heading = match?.[2]?.trim().toLowerCase();
    if (!match || !heading || !targetHeadings.has(heading)) {
      kept.push(line);
      continue;
    }

    const level = match[1]!.length;
    index += 1;
    while (index < lines.length) {
      const nextMatch = lines[index]!.match(/^(#{1,6})\s+/);
      if (nextMatch && nextMatch[1]!.length <= level) {
        index -= 1;
        break;
      }
      index += 1;
    }
  }

  return kept.join("\n");
}

function removeOtherCharacterProfileBlocks(content: string, otherCharacterNames: string[]): string {
  if (!otherCharacterNames.length) return content;
  let result = content;
  for (const name of otherCharacterNames) {
    result = removeXmlCharacterBlocks(result, name);
  }
  result = removeMarkdownCharacterBlocks(result, otherCharacterNames);
  return result.replace(/\n{3,}/g, "\n\n").trim();
}

function removeExactPromptSnippet(content: string, snippet: string): string {
  const normalizedSnippet = snippet.replace(/\r\n?/g, "\n").trim();
  if (normalizedSnippet.length < PROFILE_SNIPPET_MIN_LENGTH) return content;

  const escapedLines = normalizedSnippet
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(escapeRegExp);

  if (escapedLines.length === 0) return content;

  const snippetPattern = escapedLines.join("[ \\t]*\\r?\\n[ \\t]*");
  const pattern = new RegExp(`\\n?[ \\t]*${snippetPattern}[ \\t]*(?=\\r?\\n|$)`, "g");
  return content.replace(pattern, "\n");
}

function removeOtherCharacterProfileContent(content: string, otherCharacters: CharacterPromptScopeInfo[]): string {
  if (otherCharacters.length === 0) return content;

  const blockScoped = removeOtherCharacterProfileBlocks(
    content,
    otherCharacters.map((character) => character.name),
  );
  const blockScopedBaseline = content.replace(/\n{3,}/g, "\n\n").trim();

  // Wrapped character markers are the normal path. If they matched, avoid an
  // extra exact-text pass so shared scenario text on the target card survives.
  if (blockScoped !== blockScopedBaseline) return blockScoped;

  let result = content;
  for (const character of otherCharacters) {
    for (const value of [
      character.description,
      character.personality,
      character.scenario,
      character.systemPrompt,
      character.backstory,
      character.appearance,
      character.mesExample,
      character.postHistoryInstructions,
    ]) {
      if (value) result = removeExactPromptSnippet(result, value);
    }
  }

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

function stripChatHistoryXmlWrappers(content: string): string {
  return content
    .replace(/^\s*<chat_history>\s*\n?/i, "")
    .replace(/\n?\s*<\/chat_history>\s*$/i, "")
    .replace(/^\s*<last_message>\s*\n?/i, "")
    .replace(/\n?\s*<\/last_message>\s*$/i, "")
    .trim();
}

function stripChatHistoryMarkdownWrappers(content: string): string {
  return content
    .replace(/^\s*##\s+Chat History\s*\n/i, "")
    .replace(/^\s*##\s+Last Message\s*\n/i, "")
    .trim();
}

function reassignHistoryLastMessageWrapper(messages: GenerationPromptMessage[]): void {
  const historyIndexes = messages
    .map((message, index) => (message.contextKind === "history" ? index : -1))
    .filter((index) => index >= 0);
  if (historyIndexes.length === 0) return;

  const hasXmlWrappers = historyIndexes.some((index) =>
    /<\/?(?:chat_history|last_message)>/i.test(messages[index]!.content),
  );
  const hasMarkdownWrappers = historyIndexes.some((index) =>
    /(?:^|\n)\s*##\s+(?:Chat History|Last Message)\s*(?:\n|$)/i.test(messages[index]!.content),
  );
  if (!hasXmlWrappers && !hasMarkdownWrappers) return;

  for (const index of historyIndexes) {
    const stripped = hasXmlWrappers
      ? stripChatHistoryXmlWrappers(messages[index]!.content)
      : stripChatHistoryMarkdownWrappers(messages[index]!.content);
    messages[index] = { ...messages[index]!, content: stripped };
  }

  const lastHistoryIndex = historyIndexes[historyIndexes.length - 1]!;
  const historyBeforeLast = historyIndexes.filter((index) => index < lastHistoryIndex);
  if (hasXmlWrappers) {
    if (historyBeforeLast.length > 0) {
      const firstHistoryIndex = historyBeforeLast[0]!;
      const lastChatHistoryIndex = historyBeforeLast[historyBeforeLast.length - 1]!;
      messages[firstHistoryIndex] = {
        ...messages[firstHistoryIndex]!,
        content: `<chat_history>\n${messages[firstHistoryIndex]!.content}`,
      };
      messages[lastChatHistoryIndex] = {
        ...messages[lastChatHistoryIndex]!,
        content: `${messages[lastChatHistoryIndex]!.content}\n</chat_history>`,
      };
    }
    messages[lastHistoryIndex] = {
      ...messages[lastHistoryIndex]!,
      content: `<last_message>\n${messages[lastHistoryIndex]!.content}\n</last_message>`,
    };
    return;
  }

  if (historyBeforeLast.length > 0) {
    const firstHistoryIndex = historyBeforeLast[0]!;
    messages[firstHistoryIndex] = {
      ...messages[firstHistoryIndex]!,
      content: `## Chat History\n${messages[firstHistoryIndex]!.content}`,
    };
  }
  messages[lastHistoryIndex] = {
    ...messages[lastHistoryIndex]!,
    content: `## Last Message\n${messages[lastHistoryIndex]!.content}`,
  };
}

export function scopeIndividualGroupMessagesForTarget(
  messages: GenerationPromptMessage[],
  targetCharacterId: string | null,
  characters: CharacterPromptScopeInfo[],
): GenerationPromptMessage[] {
  if (!targetCharacterId) return messages;
  const targetCharacter = characters.find((character) => character.id === targetCharacterId);
  if (!targetCharacter) return messages;
  const otherCharacters = characters.filter((character) => character.id !== targetCharacterId);

  const scoped = messages
    .map((message) => {
      let next: GenerationPromptMessage = { ...message };
      const isHistoryMessage =
        next.contextKind === "history" ||
        (next.contextKind === undefined && next.role !== "system" && next.characterId != null);

      if (!isHistoryMessage) {
        const content = removeOtherCharacterProfileContent(next.content, otherCharacters);
        next = { ...next, content };
      }

      if (isHistoryMessage) {
        if (next.characterId) {
          const role = next.characterId === targetCharacterId ? "assistant" : "user";
          next = { ...next, role };
        } else if (next.role === "assistant") {
          next = { ...next, role: "user" };
        }

        if (next.role !== "assistant" && next.providerMetadata) {
          const withoutAssistantMetadata = { ...next };
          delete withoutAssistantMetadata.providerMetadata;
          next = withoutAssistantMetadata;
        }
      }

      return next;
    })
    .filter((message) => message.content.trim());

  reassignHistoryLastMessageWrapper(scoped);
  pruneEmptyPromptWrappers(scoped);
  return scoped;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
