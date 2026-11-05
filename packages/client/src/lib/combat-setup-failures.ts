/**
 * A fight setup that failed, remembered by chat and turn, so opening the chat again shows the failure
 * and waits for Retry Combat instead of asking the model again on its own: each setup is a model call
 * that may take minutes (playtest B1). Kept in this browser only; unreadable storage remembers nothing.
 */
export interface CombatSetupFailure {
  message: string;
  cutOff: boolean;
}

const KEY = "marinara.combatSetupFailures";
/** The newest failures kept; older ones are forgotten. */
const LIMIT = 20;

type Stored = Record<string, CombatSetupFailure & { at: number }>;

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Stored) : {};
  } catch {
    return {};
  }
}

function write(stored: Stored): void {
  try {
    const kept = Object.entries(stored)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, LIMIT);
    if (kept.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Storage unavailable: the failure is simply not remembered.
  }
}

const keyOf = (chatId: string, messageId: string) => `${chatId}:${messageId}`;

export function rememberCombatSetupFailure(chatId: string, messageId: string, failure: CombatSetupFailure): void {
  write({ ...read(), [keyOf(chatId, messageId)]: { ...failure, at: Date.now() } });
}

export function recalledCombatSetupFailure(chatId: string, messageId: string): CombatSetupFailure | null {
  const found = read()[keyOf(chatId, messageId)];
  return found && typeof found.message === "string" ? { message: found.message, cutOff: found.cutOff === true } : null;
}

export function forgetCombatSetupFailure(chatId: string, messageId: string): void {
  const stored = read();
  if (!(keyOf(chatId, messageId) in stored)) return;
  delete stored[keyOf(chatId, messageId)];
  write(stored);
}

/**
 * A request the browser dropped before the server answered: the page was reloaded or closed mid-setup, or
 * the connection fell. The server may still finish that setup, so it is not remembered as this turn's
 * failure; opening the chat again asks again instead of showing a failure that never happened.
 */
export function isDroppedRequest(error: unknown): boolean {
  if (error instanceof DOMException) return error.name === "AbortError";
  return error instanceof TypeError && /fetch|network|load failed/i.test(error.message);
}
