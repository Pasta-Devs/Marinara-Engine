// ──────────────────────────────────────────────
// New-chat drafts this browser made
//
// A draft left untouched on another device waits 30 minutes before it is
// cleared (that device may still be on its setup). One this browser made in a
// window that has since closed has nobody coming back to it, so it goes at the
// next start instead of sitting in the chat list (QC panel 2, D9). Each window
// keeps a heartbeat; a draft whose window stopped beating is from a closed one.
// ──────────────────────────────────────────────
const DRAFTS_KEY = "marinara-local-setup-drafts";
const ALIVE_PREFIX = "marinara-window-alive:";
const BEAT_MS = 10_000;
/** A window that hasn't beaten for this long is closed (or asleep long enough that its draft is stale). */
const GONE_MS = 45_000;

const windowId =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

type DraftOwners = Record<string, string>;

function readDrafts(): DraftOwners {
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as DraftOwners) : {};
  } catch {
    return {};
  }
}

function writeDrafts(drafts: DraftOwners) {
  try {
    if (Object.keys(drafts).length === 0) localStorage.removeItem(DRAFTS_KEY);
    else localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    /* storage blocked: such drafts fall back to the 30-minute rule */
  }
}

function beat() {
  try {
    localStorage.setItem(ALIVE_PREFIX + windowId, String(Date.now()));
  } catch {
    /* ignore */
  }
}

let beating = false;
function startBeating() {
  if (beating || typeof window === "undefined") return;
  beating = true;
  beat();
  window.setInterval(beat, BEAT_MS);
  window.addEventListener("pagehide", () => {
    try {
      localStorage.removeItem(ALIVE_PREFIX + windowId);
    } catch {
      /* ignore */
    }
  });
}

/** A launcher in this window just made a draft. */
export function rememberLocalSetupDraft(chatId: string) {
  startBeating();
  writeDrafts({ ...readDrafts(), [chatId]: windowId });
}

/** The draft finished, was kept or was removed: nothing to clean up any more. */
export function forgetLocalSetupDraft(chatId: string) {
  const drafts = readDrafts();
  if (!(chatId in drafts)) return;
  delete drafts[chatId];
  writeDrafts(drafts);
}

/** This browser made the draft in a window that has since closed. */
export function isOrphanedLocalSetupDraft(chatId: string): boolean {
  const owner = readDrafts()[chatId];
  if (!owner || owner === windowId) return false;
  try {
    const last = Number(localStorage.getItem(ALIVE_PREFIX + owner));
    return !Number.isFinite(last) || Date.now() - last > GONE_MS;
  } catch {
    return false;
  }
}

/** Heartbeats left by windows that closed without saying so. */
export function pruneLocalWindowBeats() {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(ALIVE_PREFIX)) continue;
      const last = Number(localStorage.getItem(key));
      if (!Number.isFinite(last) || Date.now() - last > GONE_MS * 4) localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

startBeating();

/** Drops records of drafts that no longer exist. */
export function keepOnlyLocalSetupDrafts(existingChatIds: ReadonlySet<string>) {
  const drafts = readDrafts();
  let changed = false;
  for (const id of Object.keys(drafts)) {
    if (!existingChatIds.has(id)) {
      delete drafts[id];
      changed = true;
    }
  }
  if (changed) writeDrafts(drafts);
}
