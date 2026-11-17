/**
 * Feature tips: one line that names a feature where it lives, at the moment it would help, then never
 * again. The rules that decide "the moment" are local counters (no AI calls). At most one tip shows per
 * app session, so they never pile up. Settings > General > Confirmations & Help turns them off or shows
 * them again. Seen tips live in this browser, like the walkthroughs; the on/off switch syncs.
 */
import { toast } from "sonner";
import { translate } from "../localization/i18n";
import { useUIStore } from "../stores/ui.store";

export type FeatureTipId = "settingsProfilesRoleplay" | "chatDefaultsConversation" | "peekPrompt" | "branches";

export const FEATURE_TIP_IDS: readonly FeatureTipId[] = [
  "settingsProfilesRoleplay",
  "chatDefaultsConversation",
  "peekPrompt",
  "branches",
];

const STORAGE_KEY = "marinara:feature-tips:v1";
const SESSION_KEY = "marinara:feature-tips:session";

interface FeatureTipState {
  seen: Partial<Record<FeatureTipId, number>>;
  counts: Record<string, number>;
}

function readState(): FeatureTipState {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<FeatureTipState> | null;
    return {
      seen: parsed?.seen && typeof parsed.seen === "object" ? parsed.seen : {},
      counts: parsed?.counts && typeof parsed.counts === "object" ? parsed.counts : {},
    };
  } catch {
    return { seen: {}, counts: {} };
  }
}

function writeState(state: FeatureTipState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full quota: a tip may show again, nothing breaks.
  }
}

function sessionTip(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

/** Adds one to a named counter and returns the new value. */
export function bumpFeatureTipCount(name: string, by = 1): number {
  const state = readState();
  const next = (state.counts[name] ?? 0) + by;
  state.counts[name] = next;
  writeState(state);
  return next;
}

export function featureTipCount(name: string): number {
  return readState().counts[name] ?? 0;
}

/**
 * Whether this tip may show now: tips on, never seen here, and no other tip this session.
 * The tip already showing this session still may (a re-render must not hide it).
 */
export function canShowFeatureTip(id: FeatureTipId): boolean {
  if (typeof window === "undefined") return false;
  if (!useUIStore.getState().featureTipsEnabled) return false;
  if (readState().seen[id] !== undefined) return false;
  const shown = sessionTip();
  return shown === null || shown === id;
}

/** Claims this session's tip slot. Seen is recorded on dismiss or action, so a reload mid-read keeps it. */
export function claimFeatureTip(id: FeatureTipId) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    // Without session storage tips still show once each.
  }
}

export function markFeatureTipSeen(id: FeatureTipId) {
  const state = readState();
  if (state.seen[id] !== undefined) return;
  state.seen[id] = Date.now();
  writeState(state);
}

/** Settings > Show tips again: every tip may show once more (counters keep counting). */
export function resetFeatureTips() {
  const state = readState();
  writeState({ ...state, seen: {} });
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to clear.
  }
}

const MARI_FACE = `${import.meta.env.BASE_URL}sprites/mari/Mari_profile.png`;

/**
 * A tip that has no panel of its own to sit in (a chat event), shown as a notice with one button.
 * It counts as seen as soon as it shows: a notice leaves by itself, and a tip never repeats.
 */
export function showFeatureTipNotice(
  id: FeatureTipId,
  { message, actionLabel, onAction }: { message: string; actionLabel?: string; onAction?: () => void },
) {
  if (!canShowFeatureTip(id)) return;
  claimFeatureTip(id);
  markFeatureTipSeen(id);
  toast(message, {
    id: `feature-tip:${id}`,
    duration: 12_000,
    icon: <img src={MARI_FACE} alt="" className="mari-feature-tip__face" />,
    className: "mari-feature-tip-toast",
    action:
      actionLabel && onAction
        ? {
            label: actionLabel,
            onClick: onAction,
          }
        : undefined,
    // No "Dismiss" button: the toast's own ✕ closes it, and it's already marked seen.
  });
}

export const FEATURE_TIP_FACE = MARI_FACE;

// ── Chat-event tips ──

const regenerations = new Map<string, number>();

/** The third regeneration of one reply in a session: Peek prompt shows what the AI was sent. */
export function noteRegenerationForTips(chatId: string, messageId: string, openPeekPrompt: () => void) {
  const key = `${chatId}:${messageId}`;
  const count = (regenerations.get(key) ?? 0) + 1;
  regenerations.set(key, count);
  if (count !== 3) return;
  showFeatureTipNotice("peekPrompt", {
    message: translate("featureTips.peekPrompt"),
    actionLabel: translate("featureTips.peekPromptAction"),
    onAction: openPeekPrompt,
  });
}

/** Deleting three or more messages at once (often to retry from earlier): branches keep both paths. */
export function noteBulkDeleteForTips(count: number, openGuide: () => void) {
  if (count < 3) return;
  showFeatureTipNotice("branches", {
    message: translate("featureTips.branches"),
    actionLabel: translate("featureTips.readHow"),
    onAction: openGuide,
  });
}
