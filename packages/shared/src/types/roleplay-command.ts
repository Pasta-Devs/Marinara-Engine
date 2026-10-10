import { toStraightQuotes } from "../utils/quote-format.js";

export const ROLEPLAY_COMMAND_KEYS = [
  "illustrate",
  "document",
  "sound",
  "music",
  "notes",
  "memory",
  "roll",
  "combat",
  "dm",
  "interrupt",
  "whisper",
] as const;

export type RoleplayCommandKey = (typeof ROLEPLAY_COMMAND_KEYS)[number];
export type RoleplayCommandToggles = Partial<Record<RoleplayCommandKey, boolean>>;
export type RoleplayCommandAudience = "all" | "narrator";

export type RoleplayPrivateCommand =
  | { type: "notes"; content: string }
  | { type: "dismiss_notes" }
  | { type: "memory"; id: string; content: string }
  | { type: "dismiss_memory"; id: string };

export interface RoleplayDocument {
  type: string;
  title: string;
  content: string;
}

export type RoleplayCommand =
  | RoleplayPrivateCommand
  | { type: "illustrate"; subject: string; characters?: string[] }
  | { type: "document"; documentType: string; title: string; content: string }
  | { type: "sound"; description: string }
  | { type: "music"; mood: string }
  | {
      type: "roll";
      notation: string;
      reason: string;
      character?: string;
      attribute?: string;
      modifier?: number;
      dc?: number;
    }
  | { type: "combat" }
  | { type: "dm"; character: string; message: string }
  | { type: "whisper"; character: string; text: string }
  | { type: "interrupt"; part: string };

export interface RoleplayWhisperRecipient {
  id: string;
  kind: "character" | "persona";
}

export interface RoleplayCommandActivity {
  command: RoleplayCommand;
  /** Original command text, kept separate from the user's editable context. */
  raw: string;
  deleted?: boolean;
  error?: string;
  result?: string;
  /** Saved presentation choices belong to this command occurrence and message swipe. */
  documentStyle?: number;
  contentOffset?: number;
  /** Adjacent text before the inline command, or after it when contentOffset is zero. */
  contentAnchor?: string;
  /** Resolve once so a rename cannot redirect a saved secret. */
  whisperRecipient?: RoleplayWhisperRecipient;
  /** Exact before/after text makes interruption reversible without overwriting later edits. */
  interruption?: {
    targetMessageId: string;
    targetSwipeIndex: number;
    targetSwipeId?: string;
    originalContent: string;
    interruptedContent: string;
    restored?: boolean;
  };
}

/** Read current records, or reconstruct editable context from older message extras. */
export function getRoleplayCommandActivity(extra: Record<string, unknown>): RoleplayCommandActivity[] {
  if (Array.isArray(extra.roleplayCommandActivity)) {
    return extra.roleplayCommandActivity.filter(
      (item): item is RoleplayCommandActivity =>
        item &&
        typeof item.raw === "string" &&
        item.command &&
        [...ROLEPLAY_COMMAND_KEYS, "dismiss_notes", "dismiss_memory"].includes(item.command.type),
    );
  }
  const activity: RoleplayCommandActivity[] = [];
  if (Array.isArray(extra.roleplayPrivateCommands)) {
    for (const command of extra.roleplayPrivateCommands) {
      if (command && ["notes", "dismiss_notes", "memory", "dismiss_memory"].includes(command.type))
        activity.push({ command, raw: JSON.stringify(command) });
    }
  }
  if (Array.isArray(extra.roleplayDocuments)) {
    for (const document of extra.roleplayDocuments) {
      if (document && typeof document.title === "string" && typeof document.content === "string") {
        const command = {
          type: "document" as const,
          documentType: document.type,
          title: document.title,
          content: document.content,
        };
        activity.push({ command, raw: JSON.stringify(command) });
      }
    }
  }
  return activity;
}

export function getRoleplayPrivateCommands(extra: Record<string, unknown>): RoleplayPrivateCommand[] {
  return getRoleplayCommandActivity(extra).flatMap(({ command, deleted, error }): RoleplayPrivateCommand[] => {
    if (error) return [];
    if (command.type === "notes") return [deleted ? { type: "dismiss_notes" } : command];
    if (command.type === "memory") return [deleted ? { type: "dismiss_memory", id: command.id } : command];
    return command.type === "dismiss_notes" || command.type === "dismiss_memory" ? [command] : [];
  });
}

export function getRoleplayDocuments(extra: Record<string, unknown>): RoleplayDocument[] {
  return getRoleplayCommandActivity(extra).flatMap(({ command, deleted, error }) =>
    !deleted &&
    !error &&
    command.type === "document" &&
    typeof command.title === "string" &&
    typeof command.content === "string"
      ? [{ type: command.documentType, title: command.title, content: command.content }]
      : [],
  );
}

export function getRoleplayWhispers(extra: Record<string, unknown>) {
  return getRoleplayCommandActivity(extra).flatMap((activity, index) => {
    const { command, whisperRecipient: recipient } = activity;
    return !activity.deleted &&
      !activity.error &&
      command.type === "whisper" &&
      typeof command.character === "string" &&
      typeof command.text === "string" &&
      command.text.length > 0 &&
      command.text.length <= 16_000 &&
      recipient &&
      typeof recipient.id === "string" &&
      recipient.id.length > 0 &&
      (recipient.kind === "character" || recipient.kind === "persona")
      ? [{ activity, index, command, recipient }]
      : [];
  });
}

/** Keep an inline result near its original text after edits; ambiguous anchors fall back to the end. */
export function getRoleplayCommandContentOffset(text: string, item: RoleplayCommandActivity): number {
  const expected = item.contentOffset;
  if (
    typeof expected === "number" &&
    Number.isSafeInteger(expected) &&
    expected >= 0 &&
    typeof item.contentAnchor === "string" &&
    item.contentAnchor.length > 0
  ) {
    // Saving an edit can change the quote style without moving any text.
    const anchor = toStraightQuotes(item.contentAnchor);
    text = toStraightQuotes(text);
    const currentAnchor =
      expected === 0 ? text.slice(0, anchor.length) : text.slice(Math.max(0, expected - anchor.length), expected);
    if (expected <= text.length && currentAnchor === anchor) return expected;
    if (text.indexOf(anchor) >= 0 && text.indexOf(anchor) === text.lastIndexOf(anchor))
      return text.indexOf(anchor) + (expected === 0 ? 0 : anchor.length);
  }
  return text.length;
}

/**
 * Move inline results through an edit of the text they sit in. A result before or after the changed part keeps
 * its place. One inside it follows the unchanged text right before or after it; without any, it keeps its old
 * anchor and shows at the end, as before.
 */
export function reanchorRoleplayCommandActivity(
  before: string,
  after: string,
  activity: readonly RoleplayCommandActivity[],
): RoleplayCommandActivity[] {
  const [left, right] = [toStraightQuotes(before), toStraightQuotes(after)];
  let start = 0;
  while (start < left.length && start < right.length && left[start] === right[start]) start++;
  let end = 0;
  while (
    end < left.length - start &&
    end < right.length - start &&
    left[left.length - 1 - end] === right[right.length - 1 - end]
  )
    end++;
  const uniqueIndex = (text: string) => {
    const index = text ? right.indexOf(text) : -1;
    return index >= 0 && index === right.lastIndexOf(text) ? index : -1;
  };
  return activity.map((item) => {
    if (typeof item.contentOffset !== "number") return item;
    const offset = getRoleplayCommandContentOffset(before, item);
    let moved = offset <= start ? offset : offset >= before.length - end ? after.length - (before.length - offset) : -1;
    for (const size of [80, 40, 20]) {
      if (moved >= 0) break;
      const prior = left.slice(Math.max(0, offset - size), offset);
      const priorIndex = uniqueIndex(prior);
      moved = priorIndex >= 0 ? priorIndex + prior.length : uniqueIndex(left.slice(offset, offset + size));
    }
    if (moved < 0) return item;
    return {
      ...item,
      contentOffset: moved,
      contentAnchor: moved === 0 ? after.slice(0, 80) : after.slice(Math.max(0, moved - 80), moved),
    };
  });
}

export function roleplayCommandsEnabled(metadata: Record<string, unknown>): boolean {
  // Preserve an existing explicit DM opt-in. New chats have no enabled commands.
  return (
    metadata.roleplayCommandsEnabled === true ||
    (metadata.roleplayCommandsEnabled === undefined && metadata.roleplayDmCommandsEnabled === true)
  );
}

export function isRoleplayCommandEnabled(metadata: Record<string, unknown>, key: RoleplayCommandKey): boolean {
  if (!roleplayCommandsEnabled(metadata)) return false;
  const toggles = metadata.roleplayCommandToggles;
  if (toggles && typeof toggles === "object" && !Array.isArray(toggles)) {
    const value = (toggles as Record<string, unknown>)[key];
    if (typeof value === "boolean") return value;
  }
  return key === "dm" && metadata.roleplayDmCommandsEnabled === true;
}

/** A narrator-only command needs an unambiguous, current participant as its caller. */
export function isRoleplayCommandAllowed(
  metadata: Record<string, unknown>,
  key: RoleplayCommandKey,
  characterId: string | null | undefined,
): boolean {
  if (!isRoleplayCommandEnabled(metadata, key)) return false;
  if (
    (key === "roll" && metadata.roleplayRollAudience === "narrator") ||
    (key === "combat" && metadata.roleplayCombatAudience === "narrator") ||
    (key === "document" && metadata.roleplayDocumentAudience === "narrator") ||
    (key === "whisper" && metadata.roleplayWhisperAudience === "narrator")
  ) {
    if (!characterId || characterId !== metadata.roleplayCommandNarratorId) return false;
  }
  if (key === "music" && metadata.enableAgents !== true) return false;
  if (key === "illustrate" || key === "combat" || key === "music") {
    return (
      Array.isArray(metadata.activeAgentIds) &&
      metadata.activeAgentIds.includes(key === "illustrate" ? "illustrator" : key === "music" ? "spotify" : "combat")
    );
  }
  return true;
}
