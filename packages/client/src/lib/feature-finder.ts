/**
 * Feature finder: the words people bring with them (SillyTavern terms, everyday phrases) mapped to what
 * Marinara calls the feature, where its guide is, and what "Show me" does. Ctrl+K turns a match into a
 * Feature group (a row naming the feature plus rows that do it), and the "Coming from SillyTavern"
 * guide's Show me links run the same steps. One list, so the search and the guide never disagree.
 *
 * Only add words that do NOT already find the feature by its own name: "lorebook" finds Lorebooks
 * already, "world info" is the gap. Words are matched whole, so a short one never fires inside another.
 */
import type { ProfessorMariNavigationTarget } from "./professor-mari-navigation";

export type FeatureStep =
  | { kind: "docs"; path: string }
  | { kind: "start-chat"; mode: "conversation" | "roleplay"; profile?: boolean }
  | { kind: "target"; target: ProfessorMariNavigationTarget }
  /** Needs an open chat: the row is left out without one. */
  | { kind: "chat-tool"; tool: "peek-prompt" | "memory-recall" };

export interface FeatureAction {
  id: string;
  labelKey: string;
  label: string;
  step: FeatureStep;
}

export interface FeatureEntry {
  id: string;
  nameKey: string;
  name: string;
  summaryKey: string;
  summary: string;
  /** SillyTavern's words for it. A match shows "SillyTavern: <word>" on the row. */
  sillyTavern: readonly string[];
  /** Everyday words for it. */
  plain: readonly string[];
  /** Its guide, relative to the docs folder. */
  guide: string;
  /** What Show me does: the first action, else the guide. */
  actions: readonly FeatureAction[];
}

const key = (id: string, part: string) => `featureFinder.${id}.${part}`;

function feature(
  entry: Omit<FeatureEntry, "nameKey" | "summaryKey" | "actions"> & {
    actions?: readonly Omit<FeatureAction, "labelKey">[];
  },
): FeatureEntry {
  return {
    ...entry,
    nameKey: key(entry.id, "name"),
    summaryKey: key(entry.id, "summary"),
    actions: (entry.actions ?? []).map((action) => ({ ...action, labelKey: key(entry.id, `action.${action.id}`) })),
  };
}

export const FEATURE_FINDER_ENTRIES: readonly FeatureEntry[] = [
  feature({
    id: "settingsProfiles",
    name: "Settings profiles",
    summary: "Save a chat's connection, preset, agents and more, then start new chats with them in one step.",
    sillyTavern: ["chat preset", "chat default", "chat completion preset"],
    plain: [
      "settings profile",
      "start chats faster",
      "start chat faster",
      "quick start",
      "reuse chat settings",
      "save chat settings",
      "default chat settings",
      "chat template",
      "chat setup",
    ],
    guide: "chats/settings-profiles.md",
    actions: [
      {
        id: "startRoleplay",
        label: "Start a roleplay from a profile",
        step: { kind: "start-chat", mode: "roleplay", profile: true },
      },
    ],
  }),
  feature({
    id: "authorsNotes",
    name: "Author's Notes",
    summary: "A note the AI reads on every reply, for a standing rule or a hidden fact. In Chat settings (Roleplay).",
    sillyTavern: ["author's note", "authors note", "author note"],
    plain: ["standing reminder", "note for the ai"],
    guide: "roleplay/getting-started.md",
  }),
  feature({
    id: "lorebooks",
    name: "Lorebooks",
    summary: "Notes the AI reads when certain words come up: places, people, rules of your world.",
    sillyTavern: ["world info", "worldinfo", "world book", "worldbook"],
    plain: ["world facts"],
    guide: "lorebooks/overview.md",
    actions: [
      {
        id: "open",
        label: "Open your lorebooks",
        step: { kind: "target", target: { kind: "surface", surface: "lorebook-library" } },
      },
    ],
  }),
  feature({
    id: "quickReplies",
    name: "Quick replies and slash commands",
    summary: "One-click Send alternatives (impersonate, guided replies) next to Send, and commands you type with /.",
    sillyTavern: ["quick reply", "quick replies", "qr", "stscript"],
    plain: ["canned reply", "reply button"],
    guide: "chats/guided-and-impersonate.md",
    actions: [
      {
        id: "slash",
        label: "Read the slash commands list",
        step: { kind: "docs", path: "chats/slash-commands.md" },
      },
    ],
  }),
  feature({
    id: "peekPrompt",
    name: "Peek prompt",
    summary: "See the exact text the AI received for a reply.",
    sillyTavern: ["prompt itemization", "itemization", "prompt inspector"],
    plain: ["see the prompt", "view prompt", "raw prompt", "full prompt", "what the ai sees", "what the ai received"],
    guide: "chats/peek-prompt.md",
    actions: [
      {
        id: "peek",
        label: "Peek at this chat's prompt",
        step: { kind: "chat-tool", tool: "peek-prompt" },
      },
    ],
  }),
  feature({
    id: "branches",
    name: "Branches",
    summary: "Copy a chat up to any message to try another path. The original stays safe.",
    sillyTavern: ["checkpoint", "create branch"],
    plain: ["fork chat", "fork a chat", "alternate timeline", "try a different path", "another path"],
    guide: "chats/branches.md",
  }),
  feature({
    id: "agents",
    name: "Agents",
    summary: "Optional helpers: trackers, image generation, summaries, maps and more. Turn them on per chat.",
    sillyTavern: ["extension", "st extension", "image generation extension"],
    plain: ["plugin", "add on", "addon"],
    guide: "agents/agents-overview.md",
    actions: [
      {
        id: "browse",
        label: "Browse agents",
        step: { kind: "target", target: { kind: "surface", surface: "agent-catalog" } },
      },
    ],
  }),
  feature({
    id: "memory",
    name: "Memory recall and summaries",
    summary: "Bring old messages back when a long chat outgrows what the model can read at once.",
    sillyTavern: ["summarize", "vector storage", "data bank", "chat vectorization"],
    plain: ["long term memory", "ai forgets", "forgets things", "forgetting", "remember older messages"],
    guide: "agents/memory.md",
    actions: [
      {
        id: "recall",
        label: "Memory recall for this chat",
        step: { kind: "chat-tool", tool: "memory-recall" },
      },
    ],
  }),
  feature({
    id: "connections",
    name: "Connections",
    summary: "Link Marinara to an AI provider or a local model. Each connection keeps its own models.",
    sillyTavern: ["connection profile", "api connection", "chat completion source", "text completion"],
    plain: ["api key", "ai provider"],
    guide: "connections/connecting-to-a-provider.md",
    actions: [
      {
        id: "open",
        label: "Open Connections",
        step: { kind: "target", target: { kind: "panel", panel: "connections" } },
      },
    ],
  }),
  feature({
    id: "swipes",
    name: "Swipes",
    summary: "Alternate replies to the same message: the arrows under a reply, or swipe on a touch screen.",
    sillyTavern: ["reroll"],
    plain: ["alternate reply", "another reply", "different reply", "other answer"],
    guide: "chats/messages.md",
  }),
  feature({
    id: "personas",
    name: "Personas",
    summary: "Who you are in a chat: your name, look and description, picked per chat.",
    sillyTavern: ["user persona", "persona management"],
    plain: ["my character", "play as", "who i am"],
    guide: "characters/personas.md",
    actions: [
      {
        id: "open",
        label: "Open your personas",
        step: { kind: "target", target: { kind: "surface", surface: "persona-library" } },
      },
    ],
  }),
  feature({
    id: "themes",
    name: "Themes and CSS themes",
    summary: "Change the whole app's look. CSS themes restyle everything, and you can download more.",
    sillyTavern: ["custom css", "ui theme", "moving ui"],
    plain: ["change the look", "app look", "skin"],
    guide: "appearance/custom-css-themes.md",
    actions: [
      {
        id: "open",
        label: "Open Appearance settings",
        step: { kind: "target", target: { kind: "settings", tab: "appearance" } },
      },
    ],
  }),
  feature({
    id: "sillyTavern",
    name: "Coming from SillyTavern",
    summary: "What each SillyTavern feature is called here, and how to bring your characters, chats and presets.",
    // Plain words, so the row doesn't read "SillyTavern: sillytavern".
    sillyTavern: [],
    plain: ["sillytavern", "silly tavern"],
    guide: "data/coming-from-sillytavern.md",
  }),
];

/** Lowercase, apostrophes dropped, other punctuation as spaces, plural words made singular. */
export function normalizeFeatureText(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word))
    .join(" ");
}

export interface FeatureMatch {
  feature: FeatureEntry;
  /** The word that matched, as written in the list. */
  term: string;
  fromSillyTavern: boolean;
  score: number;
}

const normalizedTerms = new Map<string, string>();
function normalizedTerm(term: string) {
  let out = normalizedTerms.get(term);
  if (out === undefined) {
    out = normalizeFeatureText(term);
    normalizedTerms.set(term, out);
  }
  return out;
}

/**
 * Features whose words the query uses: the whole query (320), the word inside a longer question (260),
 * or the query is the start of a word list entry while typing (230, four letters or more). Best first.
 */
export function matchFeatures(
  query: string,
  entries: readonly FeatureEntry[] = FEATURE_FINDER_ENTRIES,
): FeatureMatch[] {
  const q = normalizeFeatureText(query);
  if (q.length < 2) return [];
  const padded = ` ${q} `;
  const matches: FeatureMatch[] = [];
  for (const entry of entries) {
    let best: FeatureMatch | null = null;
    const consider = (term: string, fromSillyTavern: boolean) => {
      const t = normalizedTerm(term);
      if (!t) return;
      let score = -1;
      if (t === q) score = 320;
      else if (t.length >= 4 && padded.includes(` ${t} `)) score = 260;
      else if (q.length >= 4 && t.startsWith(q)) score = 230;
      if (score < 0) return;
      // A SillyTavern word wins a tie: its row can say "SillyTavern: …".
      const weighted = score + (fromSillyTavern ? 1 : 0) + Math.min(t.length, 30) / 100;
      if (!best || weighted > best.score) best = { feature: entry, term, fromSillyTavern, score: weighted };
    };
    entry.sillyTavern.forEach((term) => consider(term, true));
    entry.plain.forEach((term) => consider(term, false));
    if (best) matches.push(best);
  }
  return matches.sort((a, b) => b.score - a.score);
}

export function findFeature(id: string): FeatureEntry | undefined {
  return FEATURE_FINDER_ENTRIES.find((entry) => entry.id === id);
}

/** "Show me" in the guide: the first action that works without an open chat, else the guide itself. */
export function featureShowStep(entry: FeatureEntry, hasActiveChat: boolean): FeatureStep {
  const action = entry.actions.find((candidate) => candidate.step.kind !== "chat-tool" || hasActiveChat);
  return action?.step ?? { kind: "docs", path: entry.guide };
}
