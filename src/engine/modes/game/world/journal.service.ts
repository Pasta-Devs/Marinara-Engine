import type { GameNpc, SessionSummary, GameMap } from "../../../contracts/types/game";
import type { PlayerStats, QuestProgress } from "../../../contracts/types/game-state";

// ── Types ──

interface JournalEntry {
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
function addLocationEntry(journal: Journal, location: string, description: string = ""): Journal {
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

/** Add an NPC interaction to the journal. */
function addNpcEntry(journal: Journal, npc: GameNpc, interaction: string): Journal {
  const npcName = npc.name.trim();
  const normalizedInteraction = interaction.trim();
  if (!npcName || !normalizedInteraction) return journal;

  const existing = journal.npcLog.find((entry) => entry.npcName === npcName);
  const updatedLog = existing
    ? journal.npcLog.map((entry) =>
        entry.npcName === npcName && !entry.interactions.includes(normalizedInteraction)
          ? { ...entry, interactions: [...entry.interactions, normalizedInteraction] }
          : entry,
      )
    : [...journal.npcLog, { npcName, interactions: [normalizedInteraction] }];

  const title = `${npc.emoji ? `${npc.emoji} ` : ""}${npcName}`;
  const hasEntry = journal.entries.some(
    (entry) => entry.type === "npc" && entry.title === title && entry.content === normalizedInteraction,
  );

  return {
    ...journal,
    npcLog: updatedLog,
    entries: hasEntry
      ? journal.entries
      : [
          ...journal.entries,
          {
            timestamp: new Date().toISOString(),
            type: "npc",
            title,
            content: normalizedInteraction,
          },
        ],
  };
}

/** Add a combat event to the journal. */
function addCombatEntry(journal: Journal, description: string, outcome: "victory" | "defeat" | "fled"): Journal {
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

/** Add or update a quest in the journal. */
function upsertQuest(
  journal: Journal,
  quest: Omit<QuestEntry, "discoveredAt"> & { discoveredAt?: string },
): Journal {
  const id = quest.id.trim() || quest.name.trim();
  const name = quest.name.trim() || id;
  if (!id || !name) return journal;
  const now = new Date().toISOString();
  const explicitCompletedAt = quest.completedAt?.trim() || undefined;
  const completedAt = quest.status === "completed" ? (explicitCompletedAt ?? now) : undefined;

  const normalizedQuest: QuestEntry = {
    id,
    name,
    status: quest.status,
    description: quest.description.trim(),
    objectives: quest.objectives.map((objective) => objective.trim()).filter(Boolean),
    discoveredAt: quest.discoveredAt ?? now,
    ...(completedAt ? { completedAt } : {}),
  };
  const existing = journal.quests.find((entry) => entry.id === id);

  if (existing) {
    const updated = journal.quests.map((entry) =>
      entry.id === id
        ? (() => {
            const { completedAt: _completedAt, ...entryWithoutCompletedAt } = entry;
            const nextCompletedAt =
              normalizedQuest.status === "completed" ? (explicitCompletedAt ?? entry.completedAt ?? now) : undefined;
            return {
              ...entryWithoutCompletedAt,
              name: normalizedQuest.name || entry.name,
              status: normalizedQuest.status,
              description: normalizedQuest.description || entry.description,
              objectives: normalizedQuest.objectives.length > 0 ? normalizedQuest.objectives : entry.objectives,
              ...(nextCompletedAt ? { completedAt: nextCompletedAt } : {}),
            };
          })()
        : entry,
    );
    return { ...journal, quests: updated };
  }

  return {
    ...journal,
    quests: [...journal.quests, normalizedQuest],
    entries: [
      ...journal.entries,
      {
        timestamp: new Date().toISOString(),
        type: "quest",
        title: `Quest: ${normalizedQuest.name}`,
        content: normalizedQuest.description,
      },
    ],
  };
}

/** Add an inventory change. */
function addInventoryEntry(
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeJournalEntry(
  type: string,
  data: Record<string, unknown>,
): Pick<JournalEntry, "type" | "title" | "content"> {
  const title =
    readText(data.title) ||
    readText(data.name) ||
    (type === "location" ? readText(data.location) : "") ||
    (type === "location"
      ? "Location"
      : type === "npc"
        ? "NPC"
        : type === "combat"
          ? "Combat"
          : type === "item"
            ? "Item"
            : type === "quest"
              ? "Quest"
              : type === "note"
                ? "Note"
                : "Event");
  const content = readText(data.content) || readText(data.description);
  return { type: type as JournalEntry["type"], title, content };
}

function normalizeNpcJournalCommand(data: Record<string, unknown>): { npc: GameNpc; interaction: string } | null {
  const rawNpc = asRecord(data.npc);
  const name = readText(rawNpc.name) || readText(data.name) || readText(data.title);
  if (!name) return null;
  const npc: GameNpc = {
    id: readText(rawNpc.id) || name,
    name,
    emoji: readText(rawNpc.emoji),
    description: readText(rawNpc.description),
    location: readText(rawNpc.location),
    reputation: Number.isFinite(Number(rawNpc.reputation)) ? Number(rawNpc.reputation) : 0,
    met: rawNpc.met === false ? false : true,
    notes: Array.isArray(rawNpc.notes) ? rawNpc.notes.filter((note): note is string => typeof note === "string") : [],
  };
  const interaction = readText(data.interaction) || readText(data.content) || readText(data.description);
  return interaction ? { npc, interaction } : null;
}

function normalizeQuestStatus(value: unknown): QuestEntry["status"] {
  const status = readText(value).toLowerCase();
  return status === "completed" || status === "failed" ? status : "active";
}

function normalizeQuestObjectives(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((objective) => {
      if (typeof objective === "string") return objective.trim();
      const record = asRecord(objective);
      const text = readText(record.text) || readText(record.description) || readText(record.name);
      if (!text) return "";
      return record.completed === true ? `[Done] ${text}` : text;
    })
    .filter(Boolean);
}

function normalizeQuestJournalCommand(
  data: Record<string, unknown>,
): (Omit<QuestEntry, "discoveredAt"> & { discoveredAt?: string }) | null {
  const quest = asRecord(data.quest);
  const source = Object.keys(quest).length > 0 ? quest : data;
  const name = readText(source.name) || readText(source.title);
  const id = readText(source.id) || readText(source.questEntryId) || name;
  if (!id || !name) return null;
  return {
    id,
    name,
    status: normalizeQuestStatus(source.status),
    description: readText(source.description) || readText(source.content),
    objectives: normalizeQuestObjectives(source.objectives),
    discoveredAt: readText(source.discoveredAt) || undefined,
    completedAt: readText(source.completedAt) || undefined,
  };
}

/** Apply a generated or UI journal command to the structured journal. */
export function applyJournalEntry(journal: Journal, type: string, data: Record<string, unknown>): Journal {
  if (type === "location") {
    const { title, content } = normalizeJournalEntry(type, data);
    return addLocationEntry(journal, title, content);
  }
  if (type === "npc") {
    const command = normalizeNpcJournalCommand(data);
    return command ? addNpcEntry(journal, command.npc, command.interaction) : journal;
  }
  if (type === "combat") {
    const { content } = normalizeJournalEntry(type, data);
    const outcome = data.result === "defeat" || data.result === "fled" ? data.result : data.outcome;
    return addCombatEntry(journal, content, outcome === "defeat" || outcome === "fled" ? outcome : "victory");
  }
  if (type === "quest") {
    const quest = normalizeQuestJournalCommand(data);
    return quest ? upsertQuest(journal, quest) : journal;
  }
  if (type === "item") {
    const item = readText(data.item) || readText(data.name) || readText(data.title) || "Item";
    const action =
      data.action === "used" || data.action === "lost" || data.action === "removed" ? data.action : "acquired";
    const quantity = Number(data.quantity ?? 1);
    return addInventoryEntry(journal, item, action, Number.isFinite(quantity) ? quantity : 1);
  }
  if (type === "note") {
    const { title, content } = normalizeJournalEntry(type, data);
    const readableType = data.readableType === "book" ? "book" : "note";
    return addNoteEntry(journal, title, content, {
      readableType,
      sourceMessageId: readText(data.sourceMessageId) || undefined,
      sourceSegmentIndex: Number.isInteger(data.sourceSegmentIndex) ? (data.sourceSegmentIndex as number) : undefined,
    });
  }
  const { title, content } = normalizeJournalEntry(type, data);
  return addEventEntry(journal, title, content);
}

function buildNpcTrackedInteraction(npc: GameNpc): string {
  const location = npc.location?.trim();
  return location && location.toLowerCase() !== "unknown" ? `Tracked at ${location}.` : "Tracked.";
}

function questJournalData(quest: QuestProgress): Omit<QuestEntry, "discoveredAt"> {
  const objectiveRows = Array.isArray(quest.objectives)
    ? quest.objectives.filter((objective) => !!objective && typeof objective.text === "string")
    : [];
  const objectives = objectiveRows.map((objective) => `${objective.completed ? "[Done] " : ""}${objective.text}`);
  const currentObjective = objectiveRows.find((objective) => !objective.completed)?.text;
  return {
    id: quest.questEntryId || quest.name,
    name: quest.name,
    status: quest.completed ? "completed" : "active",
    description: currentObjective ?? (quest.completed ? `${quest.name} completed.` : `${quest.name} is in progress.`),
    objectives,
  };
}

/** Sync journal rows from tracked game state that is rendered by journal/recap views. */
export function syncJournalFromGameState(
  journal: Journal,
  options: {
    gameNpcs?: GameNpc[] | null;
    playerStats?: PlayerStats | null;
    currentLocation?: string | null;
  },
): Journal {
  let next = journal;
  const locationName = options.currentLocation?.trim();
  if (locationName) {
    next = addLocationEntry(next, locationName, `The party is at ${locationName}.`);
  }
  for (const npc of options.gameNpcs ?? []) {
    if (!npc?.name) continue;
    const interaction = buildNpcTrackedInteraction(npc);
    const hasInteraction = next.npcLog.some(
      (entry) => entry.npcName === npc.name && entry.interactions.includes(interaction),
    );
    if (!hasInteraction) {
      next = addNpcEntry(next, npc, interaction);
    }
  }
  for (const quest of options.playerStats?.activeQuests ?? []) {
    next = upsertQuest(next, questJournalData(quest));
  }
  return next;
}

/** Add a general event entry. */
function addEventEntry(journal: Journal, title: string, content: string): Journal {
  return {
    ...journal,
    entries: [...journal.entries, { timestamp: new Date().toISOString(), type: "event", title, content }],
  };
}

/** Add or update a readable note or book entry (shown in the Library tab). */
function addNoteEntry(
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
