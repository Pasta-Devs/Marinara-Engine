/** Where a closed setup wizard is remembered for its chat, so a reload keeps it closed. */
const setupDismissedKey = (chatId: string) => `game-setup-dismissed:${chatId}`;

export function readSetupDismissed(chatId: string): boolean {
  try {
    return localStorage.getItem(setupDismissedKey(chatId)) === "1";
  } catch {
    return false;
  }
}

export function writeSetupDismissed(chatId: string, dismissed: boolean) {
  try {
    if (dismissed) localStorage.setItem(setupDismissedKey(chatId), "1");
    else localStorage.removeItem(setupDismissedKey(chatId));
  } catch {
    /* storage unavailable */
  }
}
