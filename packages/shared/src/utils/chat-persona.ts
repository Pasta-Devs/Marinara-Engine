/**
 * Resolve only the Persona explicitly selected for a chat.
 * Legacy global active flags never supply a chat identity.
 */
export function resolveChatPersonaCandidate<T extends { id: string }>(
  personas: readonly T[],
  chatPersonaId: string | null | undefined,
  _legacyChatMode?: string | null,
): T | null {
  return (chatPersonaId ? personas.find((persona) => persona.id === chatPersonaId) : null) ?? null;
}
