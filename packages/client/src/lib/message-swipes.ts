import { api } from "./api-client";

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
  } catch {
    // Older servers will not have the bulk endpoint; keep imports/updates usable.
  }

  for (const content of contents) {
    await api.post(`/chats/${chatId}/messages/${messageId}/swipes`, {
      content,
      silent: true,
    });
  }
}
