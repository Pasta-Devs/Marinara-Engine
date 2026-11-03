import { api, ApiError } from "./api-client";

export function normalizeGreetingSwipes(greetings: readonly string[] | null | undefined) {
  if (!Array.isArray(greetings)) return [];
  return greetings.map((greeting) => greeting.trim()).filter(Boolean);
}

export async function addSilentGreetingSwipes(chatId: string, messageId: string, greetings: readonly string[]) {
  const contents = normalizeGreetingSwipes(greetings);
  if (contents.length === 0) return;

  try {
    await api.post(`/chats/${chatId}/messages/${messageId}/swipes/bulk`, {
      contents,
      silent: true,
    });
    return;
  } catch (error) {
    // Older servers will not have the bulk endpoint; keep imports/updates usable.
    if (!(error instanceof ApiError) || ![404, 405, 501].includes(error.status)) {
      throw error;
    }
  }

  for (const content of contents) {
    await api.post(`/chats/${chatId}/messages/${messageId}/swipes`, {
      content,
      silent: true,
    });
  }
}

/** Posts a character's greeting as the chat's first message, with its alternates as swipes. */
export async function postGreetingWithSwipes(
  chatId: string,
  characterId: string,
  greeting: string,
  alternates?: readonly string[],
) {
  const msg = await api.post<{ id: string }>(`/chats/${chatId}/messages`, {
    role: "assistant",
    content: greeting,
    characterId,
  });
  if (msg?.id && alternates?.length) await addSilentGreetingSwipes(chatId, msg.id, alternates);
}
