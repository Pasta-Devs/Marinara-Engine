/**
 * A message edit in progress, kept while you go to another chat or tab (or the page reloads), so a
 * half-rewritten reply comes back in its editor instead of being thrown away (keyboard QC round 2, IR2-2).
 * Dropped on Save or Cancel, and ignored once the message itself has changed.
 */
type MessageEditDraft = { text: string; base: string; savedAt: number };

const STORAGE_KEY = "marinara-message-edit-drafts";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function readAll(): Record<string, MessageEditDraft> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, MessageEditDraft>) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, MessageEditDraft>) {
  try {
    const now = Date.now();
    for (const [id, draft] of Object.entries(all)) if (now - draft.savedAt > MAX_AGE_MS) delete all[id];
    if (Object.keys(all).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage full or blocked: the edit lasts while the editor is open */
  }
}

/** The kept edit for a message whose text is still `base`, or null. */
export function readMessageEditDraft(messageId: string, base: string): string | null {
  const draft = readAll()[messageId];
  if (!draft || typeof draft.text !== "string" || draft.base !== base) return null;
  if (Date.now() - draft.savedAt > MAX_AGE_MS) return null;
  return draft.text;
}

export function keepMessageEditDraft(messageId: string, base: string, text: string) {
  const all = readAll();
  if (text === base) delete all[messageId];
  else all[messageId] = { text, base, savedAt: Date.now() };
  writeAll(all);
}

export function dropMessageEditDraft(messageId: string) {
  const all = readAll();
  if (!(messageId in all)) return;
  delete all[messageId];
  writeAll(all);
}
