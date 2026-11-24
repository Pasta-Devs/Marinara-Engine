import {
  CAPABILITY_STORE_SECTIONS,
  matchOmnibarCapabilityAgentPackageIds,
  type StampedCapabilityCatalog,
  type StampedCapabilityCatalogPackage,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { capabilityPackageManager } from "../capability-packages/package-manager.service.js";

export const OFFICIAL_AGENT_CATALOG_SECTIONS = [...CAPABILITY_STORE_SECTIONS, "more"] as const;
export type OfficialAgentCatalogSection = (typeof OFFICIAL_AGENT_CATALOG_SECTIONS)[number];

export interface OfficialAgentKnowledgeEntry {
  id: string;
  name: string;
  section: OfficialAgentCatalogSection;
  modes?: string;
  summary: string;
  preview?: boolean;
}

export type OfficialAgentCatalogRuntime = "workspace" | "assistant";

const SECTION_TITLES: Record<OfficialAgentCatalogSection, string> = {
  apps: "Apps",
  games: "Chat games",
  writing: "Writing help",
  memory: "Memory & lore",
  trackers: "Trackers",
  adventure: "Adventure tools",
  media: "Pictures & sound",
  alive: "Characters come alive",
  more: "More agents",
};

function catalogGuidanceLines(runtime: OfficialAgentCatalogRuntime): readonly string[] {
  const installCheckLines =
    runtime === "workspace"
      ? [
          "- The catalog is not proof of install. Before naming an agent for a request, call `agent.list`; suggest a catalog package (Agents → Agent Organizer) only when nothing installed covers it. Never claim an uninstalled agent is active.",
          "- When asked what an official catalog package does, its permissions, requirements, version, or recent changes, call `agent.catalog.get` (`id` or `name`) instead of guessing from its one-line summary.",
        ]
      : [
          "- The catalog is not proof of install. Before suggesting a new install, have the user check Agents (or Agent Organizer) to see whether an installed agent already covers it. Never claim an uninstalled agent is active.",
        ];
  return [
    "Catalog guidance:",
    "- Package sources, manifests, artifacts, and the complete official catalog are public at https://github.com/Pasta-Devs/Marinara-Agents.",
    ...installCheckLines,
    "- Install, update, or uninstall official packages from Agents → Agent Organizer. When a compatible update is found, Marinara asks before applying it; declining or failing an update preserves the installed version and leaves the manual Update action available.",
    "- Pipeline agents are enabled per compatible chat in Chat Settings → Agents. Feature packages such as Maps, Calls, and Conversation games expose their own controls after installation.",
    "- Do not describe About Me Keeper as an agent. Conversation About Me and its update tool are built into Marinara Engine.",
  ];
}

const CATALOG_CACHE_TTL_MS = 15 * 60 * 1000;
const CATALOG_ERROR_COOLDOWN_MS = 60 * 1000;
const CATALOG_LOOKUP_TIMEOUT_MS = 2_000;

function compareCodeUnit(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Bundled fallback catalog snapshot for Professor Mari when the server is offline
 * or the live catalog has not loaded yet. Runtime prompts pull live metadata
 * through `getOfficialAgentCatalogKnowledge()`.
 */
export const OFFICIAL_AGENT_KNOWLEDGE_ENTRIES: readonly OfficialAgentKnowledgeEntry[] = [
  // Apps
  {
    id: "gacha-forge",
    name: "Gacha Forge",
    section: "apps",
    modes: "Home",
    summary: "Turn any world into a gacha game",
  },
  {
    id: "noodle",
    name: "Noodle",
    section: "apps",
    modes: "Home",
    summary: "A pretend social network for your characters",
  },
  {
    id: "otome-forge",
    name: "Otome Hearth",
    section: "apps",
    modes: "Home",
    summary: "An otome game made from your characters",
  },
  {
    id: "saucelings",
    name: "Saucelings",
    section: "apps",
    modes: "Home",
    summary: "A little pet that your characters raise",
  },
  {
    id: "slurp2",
    name: "Slurp",
    section: "apps",
    modes: "Home",
    summary: "A private creator app for your characters",
  },
  {
    id: "story-writer",
    name: "Story Writer",
    section: "apps",
    modes: "Home",
    summary: "Co-write a book with your characters",
  },
  // Chat games
  {
    id: "eightball",
    name: "8-Ball Pool",
    section: "games",
    modes: "Conversation",
    summary: "8-Ball Pool in a chat",
  },
  {
    id: "blackjack",
    name: "Blackjack",
    section: "games",
    modes: "Conversation",
    summary: "Play blackjack against the house",
  },
  {
    id: "chess",
    name: "Chess",
    section: "games",
    modes: "Conversation",
    summary: "Play chess against your characters",
  },
  {
    id: "poker",
    name: "Poker",
    section: "games",
    modes: "Conversation",
    summary: "Texas Hold'em with your characters",
  },
  {
    id: "rock-paper-scissors",
    name: "Rock-Paper-Scissors",
    section: "games",
    modes: "Conversation",
    summary: "Best of three, any time",
  },
  {
    id: "tic-tac-toe",
    name: "Tic-Tac-Toe",
    section: "games",
    modes: "Conversation",
    summary: "A quick game of X and O",
  },
  {
    id: "uno",
    name: "UNO",
    section: "games",
    modes: "Conversation",
    summary: "Play UNO with your characters",
  },
  {
    id: "wordle",
    name: "Wordle",
    section: "games",
    modes: "Conversation",
    summary: "One word a day, raced with your characters",
  },
  // Writing help
  {
    id: "card-evolution-auditor",
    name: "Card Evolution Auditor",
    section: "writing",
    modes: "Roleplay",
    summary: "Suggests card updates as characters change",
  },
  {
    id: "continuity",
    name: "Continuity Checker",
    section: "writing",
    modes: "Roleplay",
    summary: "Fixes mistakes about places and time",
  },
  {
    id: "director",
    name: "Narrative Director",
    section: "writing",
    modes: "Roleplay",
    summary: "Pushes the story in a new direction",
  },
  {
    id: "prose-guardian",
    name: "Prose Guardian",
    section: "writing",
    modes: "Roleplay",
    summary: "Removes repetition and banned words",
  },
  // Memory & lore
  {
    id: "knowledge-retrieval",
    name: "Knowledge Retrieval",
    section: "memory",
    modes: "Roleplay",
    summary: "Finds the lore that matters right now",
  },
  {
    id: "knowledge-router",
    name: "Knowledge Router",
    section: "memory",
    modes: "Roleplay",
    summary: "Picks lorebook entries, cheaper",
  },
  {
    id: "long-term-memory",
    name: "Long-Term Memory",
    section: "memory",
    modes: "Conversation, Roleplay, and Game",
    summary: "Remembers things across all your chats",
  },
  {
    id: "lorebook-keeper",
    name: "Lorebook Keeper",
    section: "memory",
    modes: "Roleplay and Game",
    summary: "Keeps your lorebooks in sync with the story",
  },
  {
    id: "memory-nag",
    name: "Memory Nag",
    section: "memory",
    modes: "Roleplay",
    summary: "Reminds the AI of loose ends",
  },
  // Trackers
  {
    id: "beholder",
    name: "Beholder",
    section: "trackers",
    modes: "Roleplay",
    summary: "What each character wears and holds",
  },
  {
    id: "character-tracker",
    name: "Character Tracker",
    section: "trackers",
    modes: "Roleplay",
    summary: "Who is here, and how they look and feel",
  },
  {
    id: "custom-tracker",
    name: "Custom Tracker",
    section: "trackers",
    modes: "Roleplay",
    summary: "Track anything you want",
  },
  {
    id: "inventory-tracker",
    name: "Inventory Tracker",
    section: "trackers",
    modes: "Roleplay",
    summary: "Money, gear and what you carry",
  },
  {
    id: "persona-stats",
    name: "Persona Stats",
    section: "trackers",
    modes: "Roleplay",
    summary: "Hunger, energy and hygiene",
  },
  {
    id: "quartermaster",
    name: "Quartermaster",
    section: "trackers",
    modes: "Roleplay",
    summary: "An RPG sheet with gear and outfits",
  },
  {
    id: "quest",
    name: "Quest Tracker",
    section: "trackers",
    modes: "Roleplay",
    summary: "A quest log with goals and rewards",
  },
  {
    id: "relationship-tracker",
    name: "Relationship Tracker",
    section: "trackers",
    modes: "Roleplay",
    summary: "How everyone feels about each other",
  },
  {
    id: "world-state",
    name: "World State",
    section: "trackers",
    modes: "Roleplay",
    summary: "Date, time, weather and place",
  },
  // Adventure tools
  {
    id: "cyoa",
    name: "CYOA Choices",
    section: "adventure",
    modes: "Roleplay",
    summary: "A few choices after each reply",
  },
  {
    id: "combat",
    name: "Combat",
    section: "adventure",
    modes: "Roleplay",
    summary: "Turn-based fights with initiative and HP",
  },
  {
    id: "hierarchical-maps",
    name: "World Maps",
    section: "adventure",
    modes: "Roleplay and Game",
    summary: "World maps from regions to rooms",
  },
  // Pictures & sound
  {
    id: "background",
    name: "Background",
    section: "media",
    modes: "Roleplay",
    summary: "Picks a background for each scene",
  },
  {
    id: "illustrator",
    name: "Illustrator",
    section: "media",
    modes: "Conversation, Roleplay, and Game",
    summary: "Paints scenes from your story as you play",
  },
  {
    id: "html",
    name: "Immersive HTML",
    section: "media",
    modes: "Roleplay",
    summary: "Adds visual effects to messages",
  },
  {
    id: "spotify",
    name: "Music DJ",
    section: "media",
    modes: "Conversation, Roleplay, and Game",
    summary: "Music that fits the mood",
  },
  {
    id: "storyboard",
    name: "Storyboard",
    section: "media",
    modes: "Roleplay and Game",
    summary: "Turns scenes into comic panels",
  },
  // Characters come alive
  {
    id: "2d-avatars",
    name: "2D Avatars",
    section: "alive",
    modes: "Roleplay and Game",
    summary: "Animated 2D faces that blink and talk",
  },
  {
    id: "3d-avatars",
    name: "3D Avatars",
    section: "alive",
    modes: "Roleplay and Game",
    summary: "3D models that move and talk",
  },
  {
    id: "conversation-calls",
    name: "Calls",
    section: "alive",
    modes: "Conversation",
    summary: "Voice and video calls with characters",
  },
  {
    id: "echo-chamber",
    name: "Echo Chamber",
    section: "alive",
    modes: "Roleplay",
    summary: "A live stream chat reacts to your roleplay",
  },
  {
    id: "expression",
    name: "Expression Engine",
    section: "alive",
    modes: "Roleplay",
    summary: "Sprites that match the mood",
  },
  {
    id: "haptic",
    name: "Haptic Feedback",
    section: "alive",
    modes: "Conversation, Roleplay, and Game",
    summary: "Connected toys that follow the story",
  },
];

const KNOWN_PACKAGE_MODES = new Map<string, string>(
  OFFICIAL_AGENT_KNOWLEDGE_ENTRIES.flatMap((entry) => (entry.modes ? [[entry.id, entry.modes] as const] : [])),
);

function hasConversationGameContribution(manifest: StampedCapabilityCatalogPackage["manifest"]): boolean {
  return Boolean(
    manifest.contributions && "conversationGame" in manifest.contributions && manifest.contributions.conversationGame,
  );
}

/** Maps a catalog package to its Agent Organizer section (matching `organizer-model.ts`). */
export function sectionForCatalogPackage(pkg: StampedCapabilityCatalogPackage): OfficialAgentCatalogSection {
  if (pkg.store?.section) return pkg.store.section;
  if (pkg.manifest.contributions?.homeBrowserTab) return "apps";
  if (pkg.manifest.kind.includes("turn-game") || hasConversationGameContribution(pkg.manifest)) return "games";
  if (pkg.category === "writer") return "writing";
  if (pkg.category === "tracker") return "trackers";
  return "more";
}

/** Extracts a concise single-line summary from `store.tagline` or the first sentence of `manifest.description`. */
export function summaryForCatalogPackage(pkg: StampedCapabilityCatalogPackage): string {
  const tagline = pkg.store?.tagline?.replace(/\s+/gu, " ").trim();
  if (tagline) return tagline.replace(/\.+$/u, "");
  const description = pkg.manifest.description.replace(/\s+/gu, " ").trim();
  const firstSentence = (description.split(/(?<=\.)\s/u)[0] ?? description).trim();
  const cleaned = firstSentence.replace(/\.+$/u, "");
  return cleaned.length > 140 ? `${cleaned.slice(0, 139).trimEnd()}…` : cleaned;
}

function modesForCatalogPackage(
  pkg: StampedCapabilityCatalogPackage,
  section: OfficialAgentCatalogSection,
): string | undefined {
  const known = KNOWN_PACKAGE_MODES.get(pkg.manifest.id);
  if (known) return known;
  if (section === "apps" || pkg.manifest.contributions?.homeBrowserTab) return "Home";
  if (section === "games" || pkg.manifest.kind.includes("turn-game") || hasConversationGameContribution(pkg.manifest)) {
    return "Conversation";
  }
  if (pkg.manifest.kind.includes("ruleset")) return "Game";
  return undefined;
}

function dedupeCatalogPackages(
  catalog: Pick<StampedCapabilityCatalog, "packages">,
): readonly StampedCapabilityCatalogPackage[] {
  const seen = new Set<string>();
  const unique: StampedCapabilityCatalogPackage[] = [];
  for (const pkg of catalog.packages) {
    const id = pkg.manifest.id;
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(pkg);
  }
  return unique;
}

/**
 * Converts a live or stamped capability catalog into deterministically ordered entries
 * for Professor Mari's prompt and Quick Answer grounding.
 */
export function entriesFromCapabilityCatalog(
  catalog: Pick<StampedCapabilityCatalog, "packages">,
): OfficialAgentKnowledgeEntry[] {
  const entries = dedupeCatalogPackages(catalog).map((pkg) => {
    const id = pkg.manifest.id;
    const section = sectionForCatalogPackage(pkg);
    const modes = modesForCatalogPackage(pkg, section);
    return {
      id,
      name: pkg.manifest.name.trim(),
      section,
      ...(modes ? { modes } : {}),
      summary: summaryForCatalogPackage(pkg),
      ...(pkg.preview === true ? { preview: true } : {}),
    };
  });
  return entries.sort((left, right) => compareCodeUnit(left.name, right.name) || compareCodeUnit(left.id, right.id));
}

function formatEntryLine(entry: OfficialAgentKnowledgeEntry): string {
  const qualifiers = [
    `package \`${entry.id}\``,
    ...(entry.modes ? [entry.modes] : []),
    ...(entry.preview ? ["preview"] : []),
  ];
  const summary = entry.summary.replace(/\.+$/u, "");
  return `- ${entry.name} (${qualifiers.join("; ")}): ${summary}.`;
}

/** Formats catalog entries into `<official_agent_catalog>` grouped by Agent Organizer section. */
export function formatOfficialAgentCatalogBlock(
  entries: readonly OfficialAgentKnowledgeEntry[],
  options?: { runtime?: OfficialAgentCatalogRuntime },
): string {
  const runtime = options?.runtime ?? "workspace";
  const bySection = new Map<OfficialAgentCatalogSection, OfficialAgentKnowledgeEntry[]>();
  for (const entry of entries) {
    const group = bySection.get(entry.section);
    if (group) group.push(entry);
    else bySection.set(entry.section, [entry]);
  }
  const sectionLines = OFFICIAL_AGENT_CATALOG_SECTIONS.flatMap((section) => {
    const group = bySection.get(section);
    if (!group || group.length === 0) return [];
    const sorted = [...group].sort(
      (left, right) => compareCodeUnit(left.name, right.name) || compareCodeUnit(left.id, right.id),
    );
    return [`## ${SECTION_TITLES[section]}`, ...sorted.map(formatEntryLine)];
  });
  return [
    "<official_agent_catalog>",
    `The official Marinara Engine v2.3.0+ catalog contains these ${entries.length} optional first-party packages:`,
    ...sectionLines,
    ...catalogGuidanceLines(runtime),
    "</official_agent_catalog>",
  ].join("\n");
}

export const PROFESSOR_MARI_AGENT_CATALOG_KNOWLEDGE = formatOfficialAgentCatalogBlock(OFFICIAL_AGENT_KNOWLEDGE_ENTRIES);
export const PROFESSOR_MARI_ASSISTANT_AGENT_CATALOG_KNOWLEDGE = formatOfficialAgentCatalogBlock(
  OFFICIAL_AGENT_KNOWLEDGE_ENTRIES,
  { runtime: "assistant" },
);

export interface OfficialAgentCatalogKnowledgeResult {
  entries: readonly OfficialAgentKnowledgeEntry[];
  block: string;
  source: "live" | "fallback";
}

export type OfficialAgentCatalogLookupResult =
  | {
      found: true;
      source: "live" | "fallback";
      entry: OfficialAgentKnowledgeEntry;
      package?: StampedCapabilityCatalogPackage;
    }
  | {
      found: false;
      ambiguous: boolean;
      source: "live" | "fallback";
      query: string;
      candidates: readonly OfficialAgentKnowledgeEntry[];
    };

type CatalogLoadOptions = {
  fetchCatalog?: () => Promise<Pick<StampedCapabilityCatalog, "packages">>;
  now?: () => number;
  forceRefresh?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
};

type CachedCatalogState = {
  entries: readonly OfficialAgentKnowledgeEntry[];
  packagesById: ReadonlyMap<string, StampedCapabilityCatalogPackage>;
  block: string;
  assistantBlock: string;
  fetchedAt: number;
};

let liveCatalogCache: CachedCatalogState | null = null;
let lastCatalogErrorAt: number | null = null;
let inFlightCatalogLoad: Promise<CachedCatalogState | null> | null = null;
let catalogCacheGeneration = 0;

function toCatalogResult(
  state: CachedCatalogState | null,
  runtime: OfficialAgentCatalogRuntime,
): OfficialAgentCatalogKnowledgeResult {
  if (state) {
    return {
      entries: state.entries,
      block: runtime === "assistant" ? state.assistantBlock : state.block,
      source: "live",
    };
  }
  return {
    entries: OFFICIAL_AGENT_KNOWLEDGE_ENTRIES,
    block:
      runtime === "assistant"
        ? PROFESSOR_MARI_ASSISTANT_AGENT_CATALOG_KNOWLEDGE
        : PROFESSOR_MARI_AGENT_CATALOG_KNOWLEDGE,
    source: "fallback",
  };
}

async function awaitCatalogStateWithinBudget(
  pending: Promise<CachedCatalogState | null>,
  signal?: AbortSignal,
  timeoutMs?: number,
): Promise<CachedCatalogState | null> {
  if (signal?.aborted) return null;
  if (!signal && timeoutMs === undefined) {
    return pending.then(
      (state) => state ?? liveCatalogCache,
      () => liveCatalogCache,
    );
  }

  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (state: CachedCatalogState | null) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve(state);
    };
    const onAbort = () => finish(liveCatalogCache);
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
    if (timeoutMs !== undefined) {
      timer = setTimeout(() => finish(liveCatalogCache), Math.max(0, timeoutMs));
    }
    void pending.then(
      (state) => finish(state ?? liveCatalogCache),
      () => finish(liveCatalogCache),
    );
  });
}

async function loadCatalogState(options?: CatalogLoadOptions): Promise<CachedCatalogState | null> {
  const now = options?.now ?? Date.now;
  const currentTime = now();

  if (!options?.forceRefresh && liveCatalogCache && currentTime - liveCatalogCache.fetchedAt < CATALOG_CACHE_TTL_MS) {
    return liveCatalogCache;
  }

  if (options?.signal?.aborted) {
    return null;
  }

  if (
    !options?.forceRefresh &&
    lastCatalogErrorAt !== null &&
    currentTime - lastCatalogErrorAt < CATALOG_ERROR_COOLDOWN_MS
  ) {
    return liveCatalogCache;
  }

  if (!inFlightCatalogLoad) {
    const generation = catalogCacheGeneration;
    const fetchCatalog = options?.fetchCatalog ?? (() => capabilityPackageManager.catalog());
    inFlightCatalogLoad = (async (): Promise<CachedCatalogState | null> => {
      try {
        const catalog = await fetchCatalog();
        const uniquePackages = dedupeCatalogPackages(catalog);
        const entries = entriesFromCapabilityCatalog({ packages: [...uniquePackages] });
        if (entries.length === 0) throw new Error("Capability catalog returned zero packages");
        const state: CachedCatalogState = {
          entries,
          packagesById: new Map(uniquePackages.map((pkg) => [pkg.manifest.id, pkg])),
          block: formatOfficialAgentCatalogBlock(entries, { runtime: "workspace" }),
          assistantBlock: formatOfficialAgentCatalogBlock(entries, { runtime: "assistant" }),
          fetchedAt: now(),
        };
        if (generation !== catalogCacheGeneration) return null;
        liveCatalogCache = state;
        lastCatalogErrorAt = null;
        return state;
      } catch (error) {
        if (generation === catalogCacheGeneration) {
          lastCatalogErrorAt = now();
        }
        logger.debug(error, "[mari-catalog] live catalog unavailable; using fallback snapshot");
        return null;
      } finally {
        if (generation === catalogCacheGeneration) {
          inFlightCatalogLoad = null;
        }
      }
    })();
  }

  return awaitCatalogStateWithinBudget(inFlightCatalogLoad, options?.signal, options?.timeoutMs);
}

/**
 * Resolves the current `<official_agent_catalog>` block with an in-memory 15-minute TTL cache,
 * single-flight request deduplication, 60-second error cooldown, caller cancellation/deadline bounds,
 * and fallback to the last-known live catalog or bundled 46-package snapshot when offline.
 */
export async function getOfficialAgentCatalogKnowledge(
  options?: CatalogLoadOptions & {
    runtime?: OfficialAgentCatalogRuntime;
  },
): Promise<OfficialAgentCatalogKnowledgeResult> {
  const runtime = options?.runtime ?? "workspace";
  const state = await loadCatalogState(options);
  return toCatalogResult(state, runtime);
}

function normalizeLookupToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/gu, " ");
}

function singleOrAmbiguous(
  matches: readonly OfficialAgentKnowledgeEntry[],
): { matched: OfficialAgentKnowledgeEntry | null; candidates: readonly OfficialAgentKnowledgeEntry[] } | null {
  const [first, second] = matches;
  if (!first) return null;
  return second ? { matched: null, candidates: matches } : { matched: first, candidates: [] };
}

function matchOfficialCatalogEntries(
  entries: readonly OfficialAgentKnowledgeEntry[],
  rawQuery: string,
): { matched: OfficialAgentKnowledgeEntry | null; candidates: readonly OfficialAgentKnowledgeEntry[] } {
  const trimmed = rawQuery.trim();
  if (!trimmed) return { matched: null, candidates: [] };
  const lower = trimmed.toLowerCase();
  const exactId = entries.find((entry) => entry.id.toLowerCase() === lower);
  if (exactId) return { matched: exactId, candidates: [] };

  const byExactName = singleOrAmbiguous(entries.filter((entry) => entry.name.toLowerCase() === lower));
  if (byExactName) return byExactName;

  const normalizedQuery = normalizeLookupToken(trimmed);
  const byExactNormalized = singleOrAmbiguous(
    entries.filter(
      (entry) =>
        normalizeLookupToken(entry.id) === normalizedQuery || normalizeLookupToken(entry.name) === normalizedQuery,
    ),
  );
  if (byExactNormalized) return byExactNormalized;

  const partial = entries.filter(
    (entry) =>
      entry.id.toLowerCase().includes(lower) ||
      entry.name.toLowerCase().includes(lower) ||
      normalizeLookupToken(entry.id).includes(normalizedQuery) ||
      normalizeLookupToken(entry.name).includes(normalizedQuery),
  );
  return singleOrAmbiguous(partial) ?? { matched: null, candidates: [] };
}

/**
 * Looks up an official catalog package by exact id, case-insensitive exact name,
 * or unambiguous substring using the warm live cache (or offline snapshot).
 */
export async function lookupOfficialAgentCatalogPackage(
  query: string,
  options?: CatalogLoadOptions,
): Promise<OfficialAgentCatalogLookupResult> {
  const state = await loadCatalogState({
    ...options,
    timeoutMs: options?.timeoutMs ?? CATALOG_LOOKUP_TIMEOUT_MS,
  });
  const source = state ? "live" : "fallback";
  const entries = state?.entries ?? OFFICIAL_AGENT_KNOWLEDGE_ENTRIES;
  const { matched, candidates } = matchOfficialCatalogEntries(entries, query);
  if (!matched) {
    return {
      found: false,
      ambiguous: candidates.length > 1,
      source,
      query: query.trim(),
      candidates,
    };
  }
  const pkg = state?.packagesById.get(matched.id);
  return {
    found: true,
    source,
    entry: matched,
    ...(pkg ? { package: pkg } : {}),
  };
}

/** Returns the cached live catalog entries when loaded, or the bundled snapshot otherwise. */
export function getCachedOfficialAgentCatalogEntries(): readonly OfficialAgentKnowledgeEntry[] {
  return liveCatalogCache?.entries ?? OFFICIAL_AGENT_KNOWLEDGE_ENTRIES;
}

/** Pre-warms the live official catalog cache in the background without blocking startup. */
export function warmOfficialAgentCatalogKnowledge(): void {
  void getOfficialAgentCatalogKnowledge().catch(() => {});
}

export function resetOfficialAgentCatalogCacheForTests(): void {
  catalogCacheGeneration += 1;
  liveCatalogCache = null;
  lastCatalogErrorAt = null;
  inFlightCatalogLoad = null;
}

/**
 * K4: when an unasked quick-answer query names a capability ("images",
 * "music", "maps"...), ground the answer with 2-3 real catalog lines instead
 * of letting the model guess. Uses cached catalog data synchronously (R22 stays
 * true for unasked calls).
 */
export function formatCapabilityAgentGroundingLines(query: string): string | null {
  const packageIds = matchOmnibarCapabilityAgentPackageIds(query);
  if (packageIds.length === 0) return null;
  const catalogEntries = getCachedOfficialAgentCatalogEntries();
  const entries = packageIds.flatMap((id) => catalogEntries.filter((entry) => entry.id === id));
  if (entries.length === 0) return null;
  return entries.map(formatEntryLine).join("\n");
}
