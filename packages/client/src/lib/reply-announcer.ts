// ──────────────────────────────────────────────
// Screen readers: a short "Wren replied" when a reply lands (QC Nov 22 AX1)
// ──────────────────────────────────────────────
// Owner decision: say who replied, never read the reply itself. One announcement per run; calls that come
// within COALESCE_MS of each other (two group turns, a reply and "Copied") are said together, so the second
// never overwrites the first in the one live region.
import { announce } from "./live-announcer";

export const COALESCE_MS = 600;
/** More names than this are said as "Wren, Kit and 2 others". */
const MAX_NAMED_SPEAKERS = 3;

export type ReplyAnnouncement =
  | { kind: "replied"; names: string[]; chatName?: string | null; onScreen: boolean }
  | { kind: "swipe"; names: string[]; index: number; total: number; chatName?: string | null; onScreen: boolean }
  | { kind: "continued"; names: string[]; chatName?: string | null; onScreen: boolean }
  | { kind: "impersonated" }
  | { kind: "messaged"; names: string[] }
  | { kind: "stopped" }
  | { kind: "mari"; needsAnswer: boolean };

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Distinct, trimmed names in first-seen order. */
export function uniqueSpeakerNames(names: Iterable<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw?.trim();
    if (!name || seen.has(name.toLocaleLowerCase())) continue;
    seen.add(name.toLocaleLowerCase());
    out.push(name);
  }
  return out;
}

/** "Wren", "Wren and Kit", "Wren, Kit and Ada", or "Wren, Kit and 2 others" past three names. */
export function joinSpeakerNames(names: string[], locale: string, t: Translate): string {
  const list = uniqueSpeakerNames(names);
  if (list.length === 0) return "";
  const format = (items: string[]) => {
    try {
      return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(items);
    } catch {
      return items.join(", ");
    }
  };
  if (list.length <= MAX_NAMED_SPEAKERS) return format(list);
  const shown = list.slice(0, 2);
  return format([...shown, t("chat.announce.others", { count: list.length - shown.length })]);
}

/** The words a screen reader says for one finished run. Never the reply text. */
export function replyAnnouncementText(event: ReplyAnnouncement, locale: string, t: Translate): string {
  switch (event.kind) {
    case "impersonated":
      return t("chat.announce.impersonated");
    case "stopped":
      return t("chat.announce.stopped");
    case "mari":
      return t(event.needsAnswer ? "chat.announce.mariAsks" : "chat.announce.mariReplied");
    case "messaged": {
      const name = joinSpeakerNames(event.names, locale, t);
      return name ? t("chat.announce.messaged", { name }) : "";
    }
    default: {
      const name = joinSpeakerNames(event.names, locale, t) || t("chat.announce.someone");
      if (!event.onScreen && event.chatName?.trim()) {
        return t("chat.announce.repliedIn", { name, chat: event.chatName.trim() });
      }
      if (event.kind === "swipe") {
        return t("chat.announce.swipe", { name, index: event.index, total: event.total });
      }
      if (event.kind === "continued") return t("chat.announce.continued", { name });
      return t("chat.announce.replied", { name });
    }
  }
}

let queued: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Says `text` politely; texts queued within COALESCE_MS of the first are said together, once. */
export function queueAnnouncement(text: string) {
  if (!text) return;
  if (!queued.includes(text)) queued.push(text);
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const joined = queued.join(". ");
    queued = [];
    announce(joined);
  }, COALESCE_MS);
}
