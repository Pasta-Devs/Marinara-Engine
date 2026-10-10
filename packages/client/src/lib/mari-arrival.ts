// M9: Mari arrives with context. What the empty Mari pane says before anything
// is sent: one line about where you are, the things in it, and 2-4 cards. Built
// on the client from data the omnibar already has; no model call (R22). The
// input types carry names, counts and times only, never message text, so
// nothing here can show (or later send) what a chat says.
import type { MariSuggestionAction, MariSuggestionChip } from "@marinara-engine/shared";
import { parseChatMetadata } from "./chat-display";
import type { MariReferencedResource } from "./mari-referenced-resources";
import type { OmnibarTranslate } from "./omnibar-entity-rows";
import type { OmnibarContext } from "./omnibar-search";
import { formatRelativeContact } from "./relative-time";

/** Two actions only the omnibar can run: back to its search on settings, and K5's Undo. */
export type MariArrivalAction = MariSuggestionAction | { kind: "find-setting" } | { kind: "undo-setting" };
export type MariArrivalCard = Omit<MariSuggestionChip, "action"> & {
  action?: MariArrivalAction;
  /** N6 (R22): picking this card is the deliberate "fix" act, so only its send carries the live error text. */
  fix?: true;
};

/**
 * R7: the context a Mari thread belongs to. The key is `chat:<id>` from inside a chat, the open
 * editor's own result id (`character:<id>`, `lorebook:<id>`, `agent:<type>`, ...) from an editor, or
 * "general" for Home and every other screen. The label is the name the arrival already shows.
 */
export const MARI_GENERAL_CONTEXT = "general";
export interface MariThreadContext {
  key: string;
  label?: string;
}

export function mariThreadContextFor(context: OmnibarContext, arrival: MariArrival | null): MariThreadContext {
  if (context.surface === "editor" && context.openResource)
    return { key: context.openResource.resultId, label: arrival?.strong };
  if (context.surface === "chat" && context.activeChat)
    return { key: `chat:${context.activeChat.id}`, label: arrival?.strong };
  return { key: MARI_GENERAL_CONTEXT };
}

/** A Mari thread as the routing reads it: its stored context, if any, and when it was last used. */
export interface MariThread {
  id: string;
  contextKey: string;
  contextLabel?: string;
  lastMessageAt: number | null;
  createdAt: number;
}

export function readMariThread(chat: {
  id: string;
  metadata?: unknown;
  lastMessageAt?: string | null;
  createdAt?: string | null;
}): MariThread {
  const metadata = parseChatMetadata(chat.metadata);
  const key = typeof metadata.mariContextKey === "string" && metadata.mariContextKey ? metadata.mariContextKey : null;
  const label =
    typeof metadata.mariContextLabel === "string" && metadata.mariContextLabel ? metadata.mariContextLabel : undefined;
  // Threads from before R7 carry no key: they are general.
  return {
    id: chat.id,
    contextKey: key ?? MARI_GENERAL_CONTEXT,
    contextLabel: key ? label : undefined,
    lastMessageAt: Date.parse(chat.lastMessageAt ?? "") || null,
    createdAt: Date.parse(chat.createdAt ?? "") || 0,
  };
}

export type MariThreadChoice =
  /** The newest thread for this context (or the one the user chose to continue for it). */
  | { kind: "continue"; chatId: string }
  /**
   * No thread for this context: continue her most recent conversation and offer "New about <context>"
   * there. R13: silently starting an empty thread read as "she forgot everything".
   */
  | { kind: "ask"; recentChatId: string }
  /** No conversation with her yet at all: start one. */
  | { kind: "new" };

export function chooseMariThread({
  threads,
  contextKey,
  continuedThereId = null,
}: {
  threads: readonly MariThread[];
  contextKey: string;
  /** A thread the user already chose "Continue here" in for this context, this session. */
  continuedThereId?: string | null;
}): MariThreadChoice {
  if (continuedThereId && threads.some((thread) => thread.id === continuedThereId))
    return { kind: "continue", chatId: continuedThereId };
  const newest = (list: readonly MariThread[]) =>
    list.reduce<MariThread | null>(
      (best, thread) =>
        !best || (thread.lastMessageAt ?? thread.createdAt) > (best.lastMessageAt ?? best.createdAt) ? thread : best,
      null,
    );
  const match = newest(threads.filter((thread) => thread.contextKey === contextKey));
  if (match) return { kind: "continue", chatId: match.id };
  const recent = newest(threads.filter((thread) => thread.lastMessageAt !== null));
  return recent ? { kind: "ask", recentChatId: recent.id } : { kind: "new" };
}

/** K1/L2: the "fix this" row a lastAppError points at: the connection, or the agent for a failed run. */
export function mariFixRowId(
  lastAppError: { retry?: { kind: "open-connection" | "open-agent"; id: string } } | null | undefined,
): string | null {
  const retry = lastAppError?.retry;
  return retry ? `${retry.kind === "open-agent" ? "agent" : "connection"}:${retry.id}` : null;
}

/**
 * N6 (R22): the row Mari is handed when nothing was picked. It may be the same row the Fix door
 * points at (a built-in agent's editor row shares its id with its Fix row) — that's fine, the row
 * still carries the right resource; only a deliberate pick of the Fix row attaches the error text
 * (see `buildAskContext`'s explicit `fix` flag at the call site). On an arrival, never the open
 * chat either (it is its own facet). Never a chat tool row (`chat-tool:…`, e.g. "Fix: Check the last
 * reply") either: it is an action, not a subject, and handing it over made Mari read any question
 * asked in that chat as a request to repair the last reply (slice 66).
 */
export function mariFallbackFocus<Row extends { id: string }>(
  rows: readonly Row[],
  arrivalChatRowId?: string | null,
): Row | null {
  const first = rows.find((row) => !row.id.startsWith("chat-tool:")) ?? null;
  return first && first.id === arrivalChatRowId ? null : first;
}

/**
 * N4: what a next-step card does. An action card acts at once; a Mari card sends its prompt at once,
 * or drafts it into the composer when Shift is held (desktop) or the card is long-pressed (touch).
 */
export function mariCardIntent(
  card: { action?: unknown },
  modifiers: { shiftKey?: boolean; longPress?: boolean } = {},
): "action" | "send" | "draft" {
  if (card.action) return "action";
  return modifiers.shiftKey || modifiers.longPress ? "draft" : "send";
}

export interface MariArrival {
  line: string;
  /** The part of `line` shown in bold (a name); absent when nothing is named. */
  strong?: string;
  meta: string[];
  refs: MariReferencedResource[];
  cards: MariArrivalCard[];
}

export interface MariArrivalData {
  t: OmnibarTranslate;
  now: number;
  /** L8: the game setup wizard is open; its step is a label only. */
  gameSetupStep?: string | null;
  chat?: {
    name: string;
    mode?: string;
    characters: readonly { id: string; name: string }[];
    lorebooks: readonly { id: string; name: string }[];
    messageCount?: number | null;
    /** The newest reply's metadata only, never its text: the builder cannot leak what it never gets. */
    lastReply?: { createdAt: string; finishReason?: string | null } | null;
    /** Messages after the newest summary; null when the chat has no summary yet. */
    messagesSinceSummary?: number | null;
    /** From the cached K3 active-entries scan, when one is cached. */
    activeEntries?: number | null;
  } | null;
  /** The last generation in this chat failed (K1's lastAppError "Generate reply"). */
  replyFailed?: boolean;
  agent?: {
    type: string;
    name: string;
    enabled: boolean;
    promptLength: number;
    settingsCount: number;
    onForChat?: string | null;
    lastError?: string | null;
  } | null;
  editor?: { name: string; field?: string | null } | null;
  settings?: { section: string; control?: string | null } | null;
  /** K5: the last setting flipped from the omnibar, while its Undo is still possible. */
  undoLabel?: string | null;
}

/**
 * K1's lastAppError is a single global slot, not per chat. Scope "Generate reply" failed
 * to the arrival's own chat so switching to an unrelated chat after a failure elsewhere
 * doesn't offer "Fix the last reply" for a reply that never ran there.
 */
export function isMariReplyFailure(
  lastAppError: { action?: string; chatId?: string } | null | undefined,
  arrivalChatId: string | undefined,
): boolean {
  return lastAppError?.action === "Generate reply" && lastAppError.chatId === arrivalChatId;
}

/**
 * 45b: what she looks down at during the pull, taken from her arrival on this screen, so the pull and
 * the pane agree on what there is to talk about. A name or a fixed phrase only (R22). Null: nothing to
 * comment on (Home, or a screen without an arrival); the pull keeps its plain label.
 */
export function mariPullAbout(
  context: OmnibarContext,
  arrival: MariArrival | null,
  t: OmnibarTranslate,
): string | null {
  if (!arrival?.strong) return null;
  const fix = arrival.cards.some((card) => card.fix || card.id === "arrival:fix-reply");
  if (context.surface === "chat") {
    if (fix) return t("omnibar.pull.about.fixReply", "fix that reply");
    const character = arrival.refs.find((ref) => ref.kind === "character")?.name;
    return character ? t("omnibar.pull.about.chat", "{{name}}'s chat", { name: character }) : arrival.strong;
  }
  if (context.openResource?.kind === "agent") {
    return fix
      ? t("omnibar.pull.about.fixRun", "fix that run")
      : t("omnibar.pull.about.agent", "{{name}} settings", { name: arrival.strong });
  }
  return arrival.strong;
}

const MAX_CARDS = 4;
const mari = (id: string, label: string, prompt: string, detail?: string, icon?: string): MariArrivalCard => ({
  id: `arrival:${id}`,
  label,
  prompt,
  ...(detail ? { detail } : {}),
  ...(icon ? { icon } : {}),
});
const act = (
  id: string,
  label: string,
  action: MariArrivalAction,
  detail?: string,
  icon?: string,
): MariArrivalCard => ({
  ...mari(id, label, label, detail, icon),
  action,
});
const tokens = (length: number) => Math.max(1, Math.round(length / 4));

/** Null means "nothing to say about this screen": the generic welcome stays (Home with nothing open). */
export function buildMariArrival(context: OmnibarContext, data: MariArrivalData): MariArrival | null {
  const { t } = data;
  if (data.gameSetupStep) {
    return {
      line: t("mari.arrival.gameSetup", "You're setting up a game."),
      meta: [data.gameSetupStep],
      refs: [],
      cards: [
        mari(
          "explain-step",
          t("mari.arrival.cards.explainStep", "Explain this step"),
          "Explain this step of the game setup.",
          undefined,
          "FileText",
        ),
        mari(
          "pick-step",
          t("mari.arrival.cards.pickStep", "What should I pick here?"),
          "What should I pick in this step of the game setup?",
          undefined,
          "Wand2",
        ),
      ],
    };
  }

  const resource = context.openResource;
  if (context.surface === "editor" && resource?.kind === "agent" && data.agent) {
    const agent = data.agent;
    const failed = Boolean(agent.lastError);
    const cards: MariArrivalCard[] = [];
    // L2's fix acts at once when it is a picker; the error names the missing connection.
    if (failed && /connection/i.test(agent.lastError!)) {
      cards.push(
        act(
          "pick-connection",
          t("mari.arrival.cards.pickConnection", "Pick a connection"),
          { kind: "panel", panel: "connections" },
          t("mari.arrival.cards.pickConnectionDetail", "Opens your connections"),
          "Link2",
        ),
      );
    }
    if (failed) {
      cards.push({
        ...mari(
          "why-failed",
          t("mari.arrival.cards.whyFailed", "Why did the last run fail?"),
          `Why did the last ${agent.name} run fail, and how do I fix it?`,
          agent.lastError!.slice(0, 80),
          "Search",
        ),
        fix: true,
      });
    }
    if (agent.promptLength > 0) {
      cards.push(
        mari(
          "tighten-prompt",
          t("mari.arrival.cards.tightenPrompt", "Tighten its prompt"),
          `Tighten the ${agent.name} agent's prompt. Show the change as a review.`,
          t("mari.arrival.cards.tightenPromptDetail", "≈{{tokens}} tokens · shown as a review", {
            tokens: tokens(agent.promptLength).toLocaleString(),
          }),
          "Pencil",
        ),
      );
    }
    if (agent.settingsCount > 0) {
      cards.push(
        mari(
          "agent-settings",
          t("mari.arrival.cards.agentSettings", "What do its settings do?"),
          `What do the ${agent.name} agent's settings do?`,
          t("mari.arrival.cards.settingsCount", "{{count}} settings", { count: agent.settingsCount }),
          "FileText",
        ),
      );
    }
    for (const card of [
      mari(
        "agent-what",
        t("mari.arrival.cards.agentWhat", "What does it do?"),
        `What does the ${agent.name} agent do, and when does it run?`,
        undefined,
        "Wand2",
      ),
      mari(
        "agent-check",
        t("mari.arrival.cards.agentCheck", "Is it set up right?"),
        `Check that the ${agent.name} agent is set up right for my chats.`,
        undefined,
        "Search",
      ),
    ]) {
      if (cards.length < 2) cards.push(card);
    }
    return {
      line: t("mari.arrival.agent", "This is {{name}}, one of your agents.", { name: agent.name }),
      strong: agent.name,
      // On or off is on the agent's pill below; the line says only what the pill cannot.
      meta: [
        agent.onForChat ? t("mari.arrival.onForChat", "On for {{chat}}", { chat: agent.onForChat }) : null,
        failed ? t("mari.arrival.lastRunFailed", "Last run failed") : null,
      ].filter((value): value is string => Boolean(value)),
      refs: [
        {
          kind: "agent",
          id: agent.type,
          name: agent.name,
          fromList: false,
          state: failed ? "failed" : agent.enabled ? "on" : "off",
        },
      ],
      cards: cards.slice(0, MAX_CARDS),
    };
  }

  if (context.surface === "editor" && resource && data.editor) {
    const { name, field } = data.editor;
    const cards: MariArrivalCard[] = [];
    if (field) {
      cards.push(
        mari(
          "improve-field",
          t("mari.arrival.cards.improveField", "Improve {{field}}", { field }),
          `Improve the ${field} field of ${name}. Show the change as a review.`,
          t("mari.arrival.cards.improveFieldDetail", "Shown as a review"),
          "Pencil",
        ),
      );
    }
    if (resource.kind !== "connection") {
      cards.push(
        mari(
          "consistency",
          t("mari.arrival.cards.consistency", "Check consistency"),
          `Check ${name} for contradictions and gaps.`,
          undefined,
          "Search",
        ),
      );
    }
    if (resource.kind === "lorebook") {
      cards.push(
        mari(
          "never-fired",
          t("mari.arrival.cards.neverFired", "Entries that never fire"),
          `Which entries in ${name} never fire, and why?`,
          undefined,
          "BookOpen",
        ),
      );
    }
    if (cards.length < 2) {
      cards.push(
        mari(
          "better",
          t("mari.arrival.cards.better", "What could be better?"),
          `What would make ${name} better?`,
          undefined,
          "Wand2",
        ),
      );
    }
    const refKind =
      resource.kind === "character" || resource.kind === "persona" || resource.kind === "lorebook"
        ? resource.kind
        : null;
    return {
      line: t("mari.arrival.editing", "You're editing {{name}}.", { name }),
      strong: name,
      meta: [
        field ? t("mari.arrival.fieldOpen", "{{field}} open", { field }) : null,
        context.editorDirty ? t("mari.arrival.unsaved", "Unsaved changes") : null,
      ].filter((value): value is string => Boolean(value)),
      refs: refKind ? [{ kind: refKind, id: resource.id, name, fromList: false }] : [],
      cards: cards.slice(0, MAX_CARDS),
    };
  }

  if (context.surface === "settings" && data.settings) {
    const { section, control } = data.settings;
    const cards: MariArrivalCard[] = [
      mari(
        "explain-section",
        t("mari.arrival.cards.explainSection", "Explain this section"),
        `Explain the ${section} settings.`,
        undefined,
        "FileText",
      ),
      act(
        "find-setting",
        t("mari.arrival.cards.findSetting", "Find a setting"),
        { kind: "find-setting" },
        t("mari.arrival.cards.findSettingDetail", "Search every setting"),
        "Search",
      ),
    ];
    if (data.undoLabel) {
      cards.push(
        act(
          "undo-setting",
          t("mari.arrival.cards.undoSetting", "Undo last change"),
          { kind: "undo-setting" },
          data.undoLabel,
          "Undo2",
        ),
      );
    }
    return {
      line: t("mari.arrival.settings", "You're in Settings · {{section}}.", { section }),
      strong: section,
      meta: control ? [control] : [],
      refs: [],
      cards,
    };
  }

  if (context.surface === "chat" && context.activeChat && data.chat) {
    const chat = data.chat;
    const chatId = context.activeChat.id;
    const character = chat.characters[0]?.name;
    const count = chat.messageCount ?? null;
    const cards: MariArrivalCard[] = [];
    const cutOff = chat.lastReply?.finishReason === "length";
    if (cutOff || data.replyFailed) {
      cards.push({
        ...mari(
          "fix-reply",
          t("mari.arrival.cards.fixReply", "Fix the last reply"),
          data.replyFailed
            ? "My last reply failed to generate. Why, and how do I fix it?"
            : "The last reply in this chat was cut off. Fix it.",
          data.replyFailed
            ? t("mari.arrival.cards.fixReplyFailed", "It failed to generate")
            : t("mari.arrival.cards.fixReplyCut", "It stopped mid-sentence"),
          "Pencil",
        ),
        ...(data.replyFailed ? { fix: true as const } : {}),
      });
    }
    if (chat.lorebooks.length > 0) {
      cards.push(
        mari(
          "why-entry",
          t("mari.arrival.cards.whyEntry", "Why didn't an entry fire?"),
          "Why didn't a lorebook entry fire in this chat?",
          chat.activeEntries != null
            ? t("mari.arrival.cards.activeEntries", "{{count}} entries active now", { count: chat.activeEntries })
            : chat.lorebooks.map((lorebook) => lorebook.name).join(", "),
          "Search",
        ),
      );
    }
    if (count && chat.mode !== "game") {
      const since = chat.messagesSinceSummary;
      cards.push(
        since != null
          ? mari(
              "summarize",
              t("mari.arrival.cards.summarizeSince", "Summarize since the last summary"),
              "Summarize this chat since the last summary.",
              t("mari.arrival.cards.newMessages", "{{count}} new messages", { count: since }),
              "FileText",
            )
          : mari(
              "summarize",
              t("mari.arrival.cards.summarize", "Summarize this chat"),
              "Summarize this chat so far.",
              t("mari.arrival.cards.messages", "{{count}} messages", { count }),
              "FileText",
            ),
      );
    }
    cards.push(
      act(
        "peek-prompt",
        t("mari.arrival.cards.peekPrompt", "Peek at the prompt"),
        { kind: "peek-prompt", chatId },
        // A fact, not "Opens now": the row's › already says that.
        character
          ? t("mari.arrival.cards.peekPromptFor", "What {{name}} gets next turn", { name: character })
          : t("mari.arrival.cards.peekPromptNext", "What the next reply gets"),
      ),
    );
    if (cards.length < 2) {
      cards.push(
        mari(
          "chat-setup",
          t("mari.arrival.cards.chatSetup", "How is this chat set up?"),
          "Explain how this chat is set up: characters, lorebooks, preset and connection.",
          undefined,
          "Wand2",
        ),
      );
    }
    const lastReply = chat.lastReply ? formatRelativeContact(chat.lastReply.createdAt, data.now) : null;
    return {
      line: character
        ? t("mari.arrival.chat", "You're in {{chat}} with {{character}}.", { chat: chat.name, character })
        : t("mari.arrival.chatAlone", "You're in {{chat}}.", { chat: chat.name }),
      strong: chat.name,
      meta: [
        chat.mode ? t(`home.recentChats.mode.${chat.mode}`, chat.mode) : null,
        count != null ? t("mari.arrival.cards.messages", "{{count}} messages", { count }) : null,
        lastReply ? t("mari.arrival.lastReply", "last reply {{time}}", { time: lastReply }) : null,
      ].filter((value): value is string => Boolean(value)),
      refs: [
        ...chat.characters
          .slice(0, 2)
          .map((row) => ({ kind: "character" as const, id: row.id, name: row.name, fromList: false })),
        ...chat.lorebooks
          .slice(0, 2)
          .map((row) => ({ kind: "lorebook" as const, id: row.id, name: row.name, fromList: false })),
      ],
      cards: cards.slice(0, MAX_CARDS),
    };
  }

  return null;
}
