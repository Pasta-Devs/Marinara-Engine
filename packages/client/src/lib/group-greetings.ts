// ──────────────────────────────────────────────
// Group chats: each character's greeting carries its own name
//
// A merged group roleplay labels replies "Narrator" (one narrator voice, by
// design), but the greetings before your first message are each written by one
// character, and they read "Narrator" too (QC panel 2, D5). ChatArea works out
// which messages are those greetings; ChatMessage gives them their character.
// ──────────────────────────────────────────────
import { createContext } from "react";

interface GreetingCandidate {
  id: string;
  role: string;
  characterId?: string | null;
}

/** Ids of the assistant messages, from a chat character, before the first visible message you wrote. */
export function findGroupGreetingIds(
  messages: readonly GreetingCandidate[] | undefined,
  chatCharacterIds: readonly string[],
  isVisibleUserMessage: (message: GreetingCandidate) => boolean,
): ReadonlySet<string> {
  const ids = new Set<string>();
  if (!messages || chatCharacterIds.length < 2) return ids;
  for (const message of messages) {
    if (isVisibleUserMessage(message)) break;
    if (message.role === "assistant" && message.characterId && chatCharacterIds.includes(message.characterId)) {
      ids.add(message.id);
    }
  }
  return ids;
}

export const GroupGreetingIdsContext = createContext<ReadonlySet<string> | null>(null);
