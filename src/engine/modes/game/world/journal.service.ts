import type { GameNpc, SessionSummary, GameMap } from "../../../contracts/types/game";

// ── Types ──

export interface JournalEntry {
  timestamp: string;
  type: "location" | "npc" | "combat" | "quest" | "item" | "event" | "note";
  title: string;
  content: string;
  readableType?: "note" | "book";
  sourceMessageId?: string;
  sourceSegmentIndex?: number;
}

interface QuestEntry {
  id: string;
  name: string;
  status: "active" | "completed" | "failed";
  description: string;
  objectives: string[];
  discoveredAt: string;
  completedAt?: string;
}

export interface Journal {
  /** All chronological entries */
  entries: JournalEntry[];
  /** Active and completed quests */
  quests: QuestEntry[];
  /** Locations discovered */
  locations: string[];
  /** NPC interaction log */
  npcLog: Array<{ npcName: string; interactions: string[] }>;
  /** Inventory changes log */
  inventoryLog: Array<{
    item: string;
    action: "acquired" | "used" | "lost" | "removed";
    quantity: number;
    timestamp: string;
  }>;
}

function getReadableEntryKey(title: string, content: string): string {
  return `${title.replace(/\r\n/g, "\n").trim()}\u0000${content.replace(/\r\n/g, "\n").trim()}`;
}

function normalizeReadableTitle(title: string, readableType?: "note" | "book"): string {
  const trimmed = title.trim();
  if (trimmed) return trimmed;
  return readableType === "book" ? "Book" : "Note";
}

function normalizeReadableType(title: string, readableType?: "note" | "book"): "note" | "book" {
  if (readableType === "book" || readableType === "note") return readableType;
  return title.trim().toLowerCase() === "book" ? "book" : "note";
}

// ── Builder Functions ──

/** Create an empty journal. */
export function createJournal(): Journal {
  return {
    entries: [],
    quests: [],
    locations: [],
    npcLog: [],
    inventoryLog: [],
  };
}

/** Add a location discovery to the journal. */
export function addLocationEntry(journal: Journal, location: string, description: string = ""): Journal {
  if (journal.locations.includes(location)) return journal;

  return {
    ...journal,
    locations: [...journal.locations, location],
    entries: [
      ...journal.entries,
      {
        timestamp: new Date().toISOString(),
        type: "location",
        title: `Discovered: ${location}`,
        content: description || `The party arrived at ${location}.`,
      },
    ],
  };
}

/** Add a combat event to the journal. */
export function addCombatEntry(journal: Journal, description: string, outcome: "victory" | "defeat" | "fled"): Journal {
  return {
    ...journal,
    entries: [
      ...journal.entries,
      {
        timestamp: new Date().toISOString(),
        type: "combat",
        title: `Combat: ${outcome}`,
        content: description,
      },
    ],
  };
}

/** Add an inventory change. */
export function addInventoryEntry(
  journal: Journal,
  item: string,
  action: "acquired" | "used" | "lost" | "removed",
  quantity: number = 1,
): Journal {
  const normalizedItem = typeof item === "string" ? item.trim() : "";
  if (!normalizedItem) return journal;

  const now = new Date();
  const lastEntry = journal.inventoryLog[journal.inventoryLog.length - 1];
  if (lastEntry) {
    const lastTime = Date.parse(lastEntry.timestamp);
    const isRecentDuplicate =
      lastEntry.item.trim().toLowerCase() === normalizedItem.toLowerCase() &&
      lastEntry.action === action &&
      lastEntry.quantity === quantity &&
      Number.isFinite(lastTime) &&
      now.getTime() - lastTime <= 10_000;
    if (isRecentDuplicate) return journal;
  }

  const actionLabel =
    action === "acquired" ? "Found" : action === "used" ? "Used" : action === "removed" ? "Removed" : "Lost";

  return {
    ...journal,
    inventoryLog: [...journal.inventoryLog, { item: normalizedItem, action, quantity, timestamp: now.toISOString() }],
    entries: [
      ...journal.entries,
      {
        timestamp: now.toISOString(),
        type: "item",
        title: `${actionLabel}: ${normalizedItem}`,
        content: `${quantity}x ${normalizedItem} ${action}.`,
      },
    ],
  };
}

/** Add a general event entry. */
export function addEventEntry(journal: Journal, title: string, content: string): Journal {
  return {
    ...journal,
    entries: [...journal.entries, { timestamp: new Date().toISOString(), type: "event", title, content }],
  };
}

/** Add or update a readable note or book entry (shown in the Library tab). */
export function addNoteEntry(
  journal: Journal,
  title: string,
  content: string,
  options: {
    readableType?: "note" | "book";
    sourceMessageId?: string;
    sourceSegmentIndex?: number;
  } = {},
): Journal {
  const readableType = normalizeReadableType(title, options.readableType);
  const normalizedTitle = normalizeReadableTitle(title, readableType);
  const normalizedContent = content.replace(/\r\n/g, "\n").trim();
  const sourceMessageId =
    typeof options.sourceMessageId === "string" && options.sourceMessageId.trim()
      ? options.sourceMessageId.trim()
      : undefined;
  const sourceSegmentIndex = Number.isInteger(options.sourceSegmentIndex) ? options.sourceSegmentIndex : undefined;

  const updateExistingEntry = (matcher: (entry: JournalEntry) => boolean): Journal | null => {
    const existingIndex = journal.entries.findIndex((entry) => entry.type === "note" && matcher(entry));
    if (existingIndex < 0) return null;

    const existingEntry = journal.entries[existingIndex]!;
    if (
      existingEntry.title === normalizedTitle &&
      existingEntry.content === normalizedContent &&
      existingEntry.readableType === readableType &&
      existingEntry.sourceMessageId === sourceMessageId &&
      existingEntry.sourceSegmentIndex === sourceSegmentIndex
    ) {
      return journal;
    }

    const nextEntries = [...journal.entries];
    nextEntries[existingIndex] = {
      ...existingEntry,
      title: normalizedTitle,
      content: normalizedContent,
      readableType,
      ...(sourceMessageId ? { sourceMessageId } : {}),
      ...(sourceSegmentIndex != null ? { sourceSegmentIndex } : {}),
    };

    return { ...journal, entries: nextEntries };
  };

  if (sourceMessageId && sourceSegmentIndex != null) {
    const bySource = updateExistingEntry(
      (entry) => entry.sourceMessageId === sourceMessageId && entry.sourceSegmentIndex === sourceSegmentIndex,
    );
    if (bySource) return bySource;
  }

  const nextKey = getReadableEntryKey(normalizedTitle, normalizedContent);
  const byContent = updateExistingEntry((entry) => getReadableEntryKey(entry.title, entry.content) === nextKey);
  if (byContent) return byContent;

  const seenReadableKeys = new Set<string>();
  let removedDuplicates = false;
  const dedupedEntries = journal.entries.filter((entry) => {
    if (entry.type !== "note") return true;
    const key = getReadableEntryKey(entry.title, entry.content);
    if (seenReadableKeys.has(key)) {
      removedDuplicates = true;
      return false;
    }
    seenReadableKeys.add(key);
    return true;
  });

  if (seenReadableKeys.has(nextKey)) {
    return removedDuplicates ? { ...journal, entries: dedupedEntries } : journal;
  }

  return {
    ...journal,
    entries: [
      ...dedupedEntries,
      {
        timestamp: new Date().toISOString(),
        type: "note",
        title: normalizedTitle,
        content: normalizedContent,
        readableType,
        ...(sourceMessageId ? { sourceMessageId } : {}),
        ...(sourceSegmentIndex != null ? { sourceSegmentIndex } : {}),
      },
    ],
  };
}

/**
 * Build a structured session recap from journal data.
 * This replaces the LLM-based session summary for deterministic recaps.
 */
export function buildStructuredRecap(journal: Journal, sessionNumber: number): string {
  const sections: string[] = [`Session ${sessionNumber} Recap:`];

  // Locations
  if (journal.locations.length > 0) {
    sections.push(`\nLocations visited: ${journal.locations.join(", ")}`);
  }

  // Quest progress
  const activeQuests = journal.quests.filter((q) => q.status === "active");
  const completedQuests = journal.quests.filter((q) => q.status === "completed");
  if (completedQuests.length > 0) {
    sections.push(`\nCompleted quests: ${completedQuests.map((q) => q.name).join(", ")}`);
  }
  if (activeQuests.length > 0) {
    sections.push(`\nActive quests: ${activeQuests.map((q) => q.name).join(", ")}`);
  }

  // NPC interactions
  if (journal.npcLog.length > 0) {
    sections.push("\nKey NPC interactions:");
    for (const npc of journal.npcLog) {
      const latest = npc.interactions[npc.interactions.length - 1];
      sections.push(`  - ${npc.npcName}: ${latest}`);
    }
  }

  // Combat events
  const combatEntries = journal.entries.filter((e) => e.type === "combat");
  if (combatEntries.length > 0) {
    sections.push(`\nCombat encounters: ${combatEntries.length}`);
    for (const entry of combatEntries.slice(-3)) {
      sections.push(`  - ${entry.content}`);
    }
  }

  // Notable items
  const acquiredItems = journal.inventoryLog.filter((i) => i.action === "acquired");
  if (acquiredItems.length > 0) {
    sections.push(`\nItems acquired: ${acquiredItems.map((i) => `${i.quantity}x ${i.item}`).join(", ")}`);
  }

  return sections.join("\n");
}

/**
 * Build a deterministic session summary from journal + game state.
 * Can replace the LLM-based conclude session in many cases.
 */
export function buildDeterministicSummary(
  journal: Journal,
  sessionNumber: number,
  npcs: GameNpc[],
  map: GameMap | null,
): Omit<SessionSummary, "timestamp"> {
  const combatEntries = journal.entries.filter((e) => e.type === "combat");
  const questEntries = journal.quests;
  const npcEntries = journal.npcLog;

  // Key discoveries = completed quests + new locations + key events
  const keyDiscoveries: string[] = [
    ...questEntries.filter((q) => q.status === "completed").map((q) => `Completed: ${q.name}`),
    ...journal.locations.map((l) => `Visited: ${l}`),
  ];

  // NPC updates
  const npcUpdates = npcEntries.map((n) => {
    const npc = npcs.find((np) => np.name === n.npcName);
    return `${n.npcName}: ${n.interactions.length} interactions${npc ? ` (reputation: ${npc.reputation})` : ""}`;
  });

  // Party dynamics from combat and interaction patterns
  const partyDynamics =
    combatEntries.length > 0
      ? `The party fought ${combatEntries.length} encounter(s) this session.`
      : "A peaceful session focused on exploration and dialogue.";
  const latestLocation = journal.locations[journal.locations.length - 1] ?? map?.name ?? "the party's current position";

  return {
    sessionNumber,
    summary: buildStructuredRecap(journal, sessionNumber),
    resumePoint: `The next session should resume from ${latestLocation}.`,
    partyDynamics,
    partyState: `${journal.locations.length} locations explored, ${questEntries.filter((q) => q.status === "active").length} active quests`,
    keyDiscoveries,
    characterMoments: [],
    littleDetails: [],
    statsSnapshot: {},
    npcUpdates,
  };
}
