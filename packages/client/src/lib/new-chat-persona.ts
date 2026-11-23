// The persona a new chat starts with, as SillyTavern keeps the current persona from chat to chat.
// A starred settings profile with a persona still wins: it is applied after the chat is made.

type ChatLike = { personaId?: string | null; updatedAt?: string | null };
type PersonaLike = { id: string };

/** The persona of the most recently updated chat that has one, else the only persona, else none. */
export function defaultNewChatPersonaId(
  chats: readonly ChatLike[] | undefined,
  personas: readonly PersonaLike[] | undefined,
): string | null {
  const known = new Set((personas ?? []).map((persona) => persona.id));
  let latest: { id: string; at: string } | null = null;
  for (const chat of chats ?? []) {
    if (!chat.personaId || !known.has(chat.personaId)) continue;
    const at = chat.updatedAt ?? "";
    if (!latest || at > latest.at) latest = { id: chat.personaId, at };
  }
  if (latest) return latest.id;
  return known.size === 1 ? [...known][0]! : null;
}
