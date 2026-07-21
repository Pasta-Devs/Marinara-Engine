const pendingSavesByChat = new Map<string, Promise<void>>();

/** Register a metadata save immediately and keep saves ordered for one chat. */
export function trackChatMetadataSave<T>(chatId: string, save: () => Promise<T>): Promise<T> {
  const previous = pendingSavesByChat.get(chatId) ?? Promise.resolve();
  const operation = previous.then(save);
  const settled = operation.then(
    () => undefined,
    () => undefined,
  );

  pendingSavesByChat.set(chatId, settled);
  void settled.then(() => {
    if (pendingSavesByChat.get(chatId) === settled) pendingSavesByChat.delete(chatId);
  });

  return operation;
}

/** Wait until all metadata saves already registered for this chat have settled. */
export async function waitForPendingChatMetadataSaves(chatId: string): Promise<void> {
  let pending = pendingSavesByChat.get(chatId);
  while (pending) {
    await pending;
    const next = pendingSavesByChat.get(chatId);
    if (!next || next === pending) return;
    pending = next;
  }
}
