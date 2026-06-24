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
