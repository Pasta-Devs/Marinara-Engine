export type ProfessorMariSettingsTab = "general" | "appearance" | "generations" | "addons" | "import" | "advanced";
export type ProfessorMariNavigationResourceKind = "character" | "persona" | "preset" | "lorebook" | "agent";

export type ProfessorMariNavigationTarget =
  | { kind: "home" }
  | { kind: "professor" }
  | { kind: "chats" }
  | { kind: "chat"; chatId: string }
  | {
      kind: "panel";
      panel: "characters" | "personas" | "lorebooks" | "presets" | "connections" | "agents" | "extensions";
    }
  | { kind: "settings"; tab: ProfessorMariSettingsTab; controlId?: string }
  | {
      kind: "surface";
      surface: "card-downloads" | "character-library" | "persona-library" | "agent-catalog" | "game-assets";
    }
  | {
      kind: "window";
      window: "discord" | "support" | "documentation" | "faq" | "widgets" | "tutorial" | "credits";
    }
  | { kind: "resource"; resource: ProfessorMariNavigationResourceKind; id: string }
  | { kind: "package"; packageId: string };

export interface ProfessorMariBrowserTab {
  id: string;
  label: string;
  aliases?: string[];
}

export interface ProfessorMariNavigationResource {
  kind: ProfessorMariNavigationResourceKind;
  id: string;
  name: string;
  aliases?: string[];
  searchText?: string[];
}

export interface ProfessorMariNavigationChat {
  id: string;
  name: string;
}

export const PROFESSOR_MARI_NAVIGATOR_POSITION_STORAGE_KEY = "marinara:home:professor-position:v1";
export const PROFESSOR_MARI_NAVIGATOR_RESET_EVENT = "marinara:home:professor-navigation-reset";

export const professorMariNavigatorRuntime = {
  minimized: false,
  hasAppeared: false,
};

export function resetProfessorMariNavigator() {
  professorMariNavigatorRuntime.minimized = false;
  professorMariNavigatorRuntime.hasAppeared = true;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PROFESSOR_MARI_NAVIGATOR_POSITION_STORAGE_KEY);
  } catch {
    /* Local storage is optional; the current session still resets. */
  }
  window.dispatchEvent(new Event(PROFESSOR_MARI_NAVIGATOR_RESET_EVENT));
}

interface NavigationRule {
  target: ProfessorMariNavigationTarget;
  priority: number;
  patterns: RegExp[];
}

const RULES: readonly NavigationRule[] = [
  {
    target: { kind: "settings", tab: "appearance" },
    priority: 82,
    patterns: [
      /\b(?:appearance|themes?|colou?rs?|accents?|fonts?|text scale|light mode|dark mode|chat backgrounds?)\b/,
    ],
  },
  {
    target: { kind: "settings", tab: "generations" },
    priority: 82,
    patterns: [
      /\b(?:generations?|image generation|video generation|media generation|prompt templates?|style profiles?)\b/,
    ],
  },
  {
    target: { kind: "settings", tab: "addons" },
    priority: 82,
    patterns: [/\b(?:addons?|personal extensions?|custom themes?|plugins?)\b/],
  },
  {
    target: { kind: "settings", tab: "import" },
    priority: 82,
    patterns: [/\b(?:imports?|bulk imports?|asset folders?|data transfers?)\b/],
  },
  {
    target: { kind: "settings", tab: "advanced" },
    priority: 82,
    patterns: [/\b(?:advanced|admin(?:istration)?|updates?|backups?|danger zone|server logs?|maintenance)\b/],
  },
  {
    target: { kind: "settings", tab: "general", controlId: "professor-mari-navigation" },
    priority: 112,
    patterns: [/\b(?:professor mari navigation|mari navigator|home mari helper|little mari navigator)\b/],
  },
  {
    target: { kind: "settings", tab: "general" },
    priority: 82,
    patterns: [
      /\b(?:general settings?|language settings?|notification settings?|input settings?|playback settings?)\b/,
    ],
  },
  {
    target: { kind: "surface", surface: "game-assets" },
    priority: 100,
    patterns: [/\b(?:game assets?|asset browser|sprites? library|background library)\b/],
  },
  {
    target: { kind: "surface", surface: "character-library" },
    priority: 96,
    patterns: [/\b(?:character|char)\s+(?:library|cards?|collection)\b/],
  },
  {
    target: { kind: "surface", surface: "persona-library" },
    priority: 96,
    patterns: [/\bpersonas?\s+(?:library|cards?|collection)\b/],
  },
  {
    target: { kind: "surface", surface: "agent-catalog" },
    priority: 96,
    patterns: [/\bagents?\s+(?:catalog|store|downloads?|packages?)\b/],
  },
  {
    target: { kind: "window", window: "discord" },
    priority: 94,
    patterns: [/\b(?:discord|community server|community chat)\b/],
  },
  {
    target: { kind: "window", window: "support" },
    priority: 94,
    patterns: [/\b(?:support|ko fi|kofi|donate|donation|tip jar)\b/],
  },
  {
    target: { kind: "window", window: "documentation" },
    priority: 90,
    patterns: [/\b(?:documentation|docs?|manual|guides?)\b/],
  },
  {
    target: { kind: "window", window: "faq" },
    priority: 92,
    patterns: [/\b(?:faq|frequently asked questions?|common questions?)\b/],
  },
  {
    target: { kind: "window", window: "widgets" },
    priority: 92,
    patterns: [/\b(?:widgets?|home widgets?|widget manager|home tiles?|customi[sz]e home)\b/],
  },
  {
    target: { kind: "window", window: "tutorial" },
    priority: 90,
    patterns: [/\b(?:tutorial|onboarding|walkthrough|getting started)\b/],
  },
  {
    target: { kind: "window", window: "credits" },
    priority: 90,
    patterns: [/\b(?:credits?|contributors?|creators?|who made)\b/],
  },
  {
    target: { kind: "chats" },
    priority: 58,
    patterns: [/\b(?:chats?|conversations?|convos?|roleplays?|rps?|games?|chat list|chat history)\b/],
  },
  {
    target: { kind: "professor" },
    priority: 62,
    patterns: [/\b(?:professor(?:\s+mari)?|prof\.?\s*mari|mari(?:\s+chat)?)\b/],
  },
  {
    target: { kind: "panel", panel: "characters" },
    priority: 66,
    patterns: [/\b(?:characters?|chars?|bots?)\b/],
  },
  {
    target: { kind: "panel", panel: "personas" },
    priority: 68,
    patterns: [/\b(?:personas?|profiles?|user personas?)\b/],
  },
  {
    target: { kind: "panel", panel: "lorebooks" },
    priority: 68,
    patterns: [/\b(?:lorebooks?|lore|world info|world information|world books?)\b/],
  },
  {
    target: { kind: "panel", panel: "presets" },
    priority: 68,
    patterns: [/\b(?:presets?|prompt presets?|prompt settings?)\b/],
  },
  {
    target: { kind: "panel", panel: "connections" },
    priority: 68,
    patterns: [/\b(?:connections?|providers?|models?|api connections?|api keys?)\b/],
  },
  {
    target: { kind: "panel", panel: "agents" },
    priority: 68,
    patterns: [/\b(?:agents?|tools?)\b/],
  },
  {
    target: { kind: "panel", panel: "extensions" },
    priority: 68,
    patterns: [/\b(?:extensions?|extension manager)\b/],
  },
  {
    target: { kind: "surface", surface: "card-downloads" },
    priority: 64,
    patterns: [/\b(?:browser|character browser|browse bots?|download characters?)\b/],
  },
  {
    target: { kind: "settings", tab: "general" },
    priority: 52,
    patterns: [/\b(?:settings?|preferences?|options?|configuration|configure)\b/],
  },
  {
    target: { kind: "home" },
    priority: 50,
    patterns: [/\b(?:home|homepage|start page|dashboard)\b/],
  },
] as const;

const RESOURCE_TYPE_ALIASES: Record<ProfessorMariNavigationResourceKind, readonly string[]> = {
  character: ["character", "characters", "char", "chars", "bot", "bots", "character card"],
  persona: ["persona", "personas", "profile", "profiles", "persona card"],
  preset: ["preset", "presets", "prompt preset", "prompt presets"],
  lorebook: ["lorebook", "lorebooks", "lore", "world info", "world book", "world books"],
  agent: ["agent", "agents", "tool agent", "tool agents"],
};

const RESOURCE_QUERY_FILLERS = new Set([
  "a",
  "an",
  "can",
  "could",
  "card",
  "edit",
  "editor",
  "find",
  "for",
  "go",
  "i",
  "is",
  "me",
  "my",
  "navigate",
  "open",
  "please",
  "show",
  "take",
  "the",
  "to",
  "view",
  "where",
  "you",
]);

function includesNormalizedPhrase(query: string, phrase: string) {
  return ` ${query} `.includes(` ${phrase} `);
}

function resourceQueryRemainder(query: string) {
  const typeWords = new Set(
    Object.values(RESOURCE_TYPE_ALIASES)
      .flatMap((aliases) => aliases)
      .flatMap((alias) => normalizeProfessorMariNavigationQuery(alias).split(" ")),
  );
  return query
    .split(" ")
    .filter((word) => word && !RESOURCE_QUERY_FILLERS.has(word) && !typeWords.has(word))
    .join(" ");
}

function scoreDynamicResource(query: string, resource: ProfessorMariNavigationResource) {
  const names = [resource.name, ...(resource.aliases ?? [])]
    .map(normalizeProfessorMariNavigationQuery)
    .filter((name) => name.length >= 2);
  const searchableText = (resource.searchText ?? []).map(normalizeProfessorMariNavigationQuery).filter(Boolean);
  const hintedKinds = (
    Object.entries(RESOURCE_TYPE_ALIASES) as Array<[ProfessorMariNavigationResourceKind, readonly string[]]>
  )
    .filter(([, aliases]) =>
      aliases.some((alias) => includesNormalizedPhrase(query, normalizeProfessorMariNavigationQuery(alias))),
    )
    .map(([kind]) => kind);
  const remainder = resourceQueryRemainder(query);
  let best = -1;

  for (const name of names) {
    let score = -1;
    if (query === name) score = 190 + name.length;
    else if (remainder === name) score = 184 + name.length;
    else if (includesNormalizedPhrase(query, name)) score = 152 + Math.min(name.length, 32);
    else if (remainder.length >= 3 && name.startsWith(remainder)) score = 112 + remainder.length * 2;
    if (score < 0) continue;
    if (hintedKinds.includes(resource.kind)) score += 42;
    else if (hintedKinds.length > 0) score -= 90;
    best = Math.max(best, score);
  }

  if (best < 0 && remainder.length >= 3 && searchableText.some((value) => includesNormalizedPhrase(value, remainder))) {
    best = 80;
  }

  return best;
}

export function normalizeProfessorMariNavigationQuery(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

function scorePattern(query: string, pattern: RegExp, priority: number) {
  const match = pattern.exec(query);
  if (!match) return null;
  const matched = match[0].trim();
  return priority + matched.length * 2 + (matched === query ? 24 : 0);
}

function scoreDynamicTab(query: string, tab: ProfessorMariBrowserTab) {
  const aliases = [tab.id, tab.label, ...(tab.aliases ?? [])]
    .map(normalizeProfessorMariNavigationQuery)
    .filter((alias) => alias.length >= 3);
  let best = -1;
  for (const alias of aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
    const match = new RegExp(`\\b${escaped}\\b`, "i").exec(query);
    if (!match) continue;
    best = Math.max(best, 86 + match[0].length * 2 + (match[0] === query ? 24 : 0));
  }
  return best;
}

export function resolveProfessorMariNavigation(
  value: string,
  browserTabs: readonly ProfessorMariBrowserTab[] = [],
  resources: readonly ProfessorMariNavigationResource[] = [],
  chats: readonly ProfessorMariNavigationChat[] = [],
): ProfessorMariNavigationTarget | null {
  const query = normalizeProfessorMariNavigationQuery(value);
  if (!query) return null;

  // Exact chat titles outrank keyword routing, except for the generic words
  // users naturally use to ask for the Chats surface itself.
  const genericChatQueries = new Set(["chat", "chats", "conversations", "convo", "rp", "games"]);
  if (!genericChatQueries.has(query)) {
    const exactChat = chats.find((chat) => normalizeProfessorMariNavigationQuery(chat.name) === query);
    if (exactChat) return { kind: "chat", chatId: exactChat.id };
  }

  const matches: Array<{ target: ProfessorMariNavigationTarget; score: number; order: number }> = [];
  const consider = (target: ProfessorMariNavigationTarget, score: number, order: number) => {
    matches.push({ target, score, order });
  };

  RULES.forEach((rule, order) => {
    for (const pattern of rule.patterns) {
      const score = scorePattern(query, pattern, rule.priority);
      if (score !== null) consider(rule.target, score, order);
    }
  });

  browserTabs.forEach((tab, index) => {
    const score = scoreDynamicTab(query, tab);
    if (score >= 0) consider({ kind: "package", packageId: tab.id }, score, RULES.length + index);
  });

  resources.forEach((resource, index) => {
    const score = scoreDynamicResource(query, resource);
    if (score >= 0) {
      consider(
        { kind: "resource", resource: resource.kind, id: resource.id },
        score,
        RULES.length + browserTabs.length + index,
      );
    }
  });

  matches.sort((a, b) => b.score - a.score || a.order - b.order);
  return matches[0]?.target ?? null;
}
