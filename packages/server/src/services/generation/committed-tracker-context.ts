import { compactQuestProgressForContext, formatCustomTrackerFieldForPrompt } from "@marinara-engine/shared";
import { formatBeholderStateForPrompt, normalizeBeholderState } from "../agents/beholder-state.js";
import { wrapContent } from "../prompt/format-engine.js";

type WrapFormat = "xml" | "markdown" | "none";

type PromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  contextKind?: "prompt" | "history" | "injection";
};

type GameStateSnapshotLike = {
  date?: string | null;
  time?: string | null;
  location?: string | null;
  weather?: string | null;
  temperature?: string | null;
  worldCustomFields?: unknown;
  presentCharacters?: unknown;
  personaStats?: unknown;
  playerStats?: unknown;
};

export const MAX_WORLD_CUSTOM_FIELDS_IN_COMMITTED_CONTEXT = 64;

const WORLD_RESERVED_CUSTOM_FIELD_NAMES = new Set(["date", "time", "location", "weather", "temperature"]);
const CHARACTER_RESERVED_CUSTOM_FIELD_NAMES = new Set([
  "emoji",
  "name",
  "mood",
  "appearance",
  "outfit",
  "thoughts",
  "stats",
]);

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteNumberText(value: unknown): string | null {
  const numberValue =
    typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(numberValue) ? String(numberValue) : null;
}

function formatStatValue(value: unknown, max: unknown): string {
  const valueText = finiteNumberText(value);
  const maxText = finiteNumberText(max);
  if (!valueText) return "unknown";
  return maxText ? `${valueText}/${maxText}` : valueText;
}

function isNonEmptyLine(line: string | null): line is string {
  return !!line;
}

function formatStatLine(stat: any): string | null {
  const name = asText(stat?.name);
  if (!name) return null;
  return `- ${name}: ${formatStatValue(stat?.value, stat?.max)}`;
}

function formatStatSummary(stat: any): string | null {
  const name = asText(stat?.name);
  if (!name) return null;
  return `${name}: ${formatStatValue(stat?.value, stat?.max)}`;
}

function normalizeTrackerFieldName(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/\s+/gu, " ");
}

function formatNamedValueLine(field: unknown, reservedNames?: ReadonlySet<string>): string | null {
  if (!field || typeof field !== "object" || Array.isArray(field)) return null;
  const record = field as Record<string, unknown>;
  const name = asText(record.name);
  if (!name || reservedNames?.has(normalizeTrackerFieldName(name))) return null;
  const value = asText(record.value);
  return value ? `${name}: ${value}` : null;
}

function formatCharacterLine(character: any): string | null {
  if (typeof character === "string") {
    const name = asText(character);
    return name ? `- ${name}` : null;
  }
  const name = asText(character?.name);
  if (!name) return null;

  const details: string[] = [];
  if (character.mood) details.push(`mood: ${character.mood}`);
  if (character.appearance) details.push(`appearance: ${character.appearance}`);
  if (character.outfit) details.push(`outfit: ${character.outfit}`);
  if (character.thoughts) details.push(`thoughts: ${character.thoughts}`);
  if (character.customFields && typeof character.customFields === "object" && !Array.isArray(character.customFields)) {
    for (const [fieldName, fieldValue] of Object.entries(character.customFields)) {
      const line = formatNamedValueLine({ name: fieldName, value: fieldValue }, CHARACTER_RESERVED_CUSTOM_FIELD_NAMES);
      if (line) details.push(line);
    }
  }
  if (Array.isArray(character.stats) && character.stats.length > 0) {
    const statStr = (character.stats as unknown[]).map(formatStatSummary).filter(isNonEmptyLine).join(", ");
    if (statStr) details.push(`stats: ${statStr}`);
  }

  const label = [asText(character.emoji), name].filter(Boolean).join(" ");
  const detailStr = details.length > 0 ? ` (${details.join("; ")})` : "";
  return `- ${label}${detailStr}`;
}

function formatQuestLine(quest: any): string | null {
  const name = asText(quest?.name);
  if (!name) return null;
  const objectives = Array.isArray(quest.objectives)
    ? quest.objectives
        .map((objective: any) => {
          const text = asText(objective?.text);
          return text ? `  ${objective.completed ? "[x]" : "[ ]"} ${text}` : null;
        })
        .filter(isNonEmptyLine)
        .join("\n")
    : "";
  return `- ${name}${objectives ? "\n" + objectives : ""}`;
}

function formatInventoryLine(item: any): string | null {
  const name = asText(item?.name);
  if (!name) return null;
  const quantity = finiteNumberText(item?.quantity);
  const description = asText(item?.description);
  return `- ${name}${quantity && Number(quantity) > 1 ? ` x${quantity}` : ""}${description ? ` — ${description}` : ""}`;
}

function formatInventoryTrackerLine(item: any): string | null {
  const name = asText(item?.name);
  if (!name) return null;
  const quantity = finiteNumberText(item?.qty);
  return `- ${name}${quantity && Number(quantity) > 1 ? ` x${quantity}` : ""}`;
}

export function buildCommittedTrackerContextBlock(args: {
  chatEnableAgents: boolean;
  activeAgentIds: string[];
  latestGameState: GameStateSnapshotLike | null | undefined;
  beholderState?: unknown;
  chatMetadata: Record<string, unknown>;
  wrapFormat: WrapFormat;
}): string | null {
  if (!args.chatEnableAgents || args.activeAgentIds.length === 0) return null;

  const active = new Set(args.activeAgentIds);
  const hasWorldState = active.has("world-state");
  const hasCharTracker = active.has("character-tracker");
  const hasPersonaStats = active.has("persona-stats");
  const hasQuest = active.has("quest");
  const hasCustomTracker = active.has("custom-tracker");
  const hasInventoryTracker = active.has("inventory-tracker");
  const hasBeholder = active.has("beholder");
  if (
    !hasWorldState &&
    !hasCharTracker &&
    !hasPersonaStats &&
    !hasQuest &&
    !hasCustomTracker &&
    !hasInventoryTracker &&
    !hasBeholder
  )
    return null;

  const snap = args.latestGameState ?? {};

  const trackerParts: string[] = [];

  if (hasWorldState) {
    const wsParts: string[] = [];
    if (snap.date) wsParts.push(`Date: ${snap.date}`);
    if (snap.time) wsParts.push(`Time: ${snap.time}`);
    if (snap.location) wsParts.push(`Location: ${snap.location}`);
    if (snap.weather) wsParts.push(`Weather: ${snap.weather}`);
    if (snap.temperature) wsParts.push(`Temperature: ${snap.temperature}`);
    const worldCustomFields = parseMaybeJson(snap.worldCustomFields);
    if (Array.isArray(worldCustomFields)) {
      const customLines: string[] = [];
      for (const field of worldCustomFields) {
        const line = formatNamedValueLine(field, WORLD_RESERVED_CUSTOM_FIELD_NAMES);
        if (!line) continue;
        customLines.push(line);
        if (customLines.length >= MAX_WORLD_CUSTOM_FIELDS_IN_COMMITTED_CONTEXT) break;
      }
      wsParts.push(...customLines);
    }
    if (wsParts.length > 0) trackerParts.push(wrapContent(wsParts.join("\n"), "World", args.wrapFormat));
  }

  if (hasCharTracker) {
    const presentChars = parseMaybeJson(snap.presentCharacters);
    if (Array.isArray(presentChars) && presentChars.length > 0) {
      const charLines = presentChars.map(formatCharacterLine).filter(isNonEmptyLine);
      if (charLines.length > 0)
        trackerParts.push(wrapContent(charLines.join("\n"), "Present Characters", args.wrapFormat));
    }
  }

  if (hasPersonaStats && snap.personaStats) {
    const psBars = parseMaybeJson(snap.personaStats);
    if (Array.isArray(psBars) && psBars.length > 0) {
      const barLines = psBars.map(formatStatLine).filter(isNonEmptyLine);
      if (barLines.length > 0) trackerParts.push(wrapContent(barLines.join("\n"), "Persona Stats", args.wrapFormat));
    }
  }

  if (snap.playerStats) {
    const stats = parseMaybeJson(snap.playerStats) as any;
    if (stats) {
      if (hasPersonaStats && stats.status) {
        trackerParts.push(wrapContent(`Status: ${stats.status}`, "Status", args.wrapFormat));
      }

      if (hasQuest && Array.isArray(stats.activeQuests) && stats.activeQuests.length > 0) {
        const activeQuestsForContext = compactQuestProgressForContext(stats.activeQuests);
        const questLines = activeQuestsForContext.map(formatQuestLine).filter(isNonEmptyLine);
        if (questLines.length > 0) {
          trackerParts.push(wrapContent(questLines.join("\n"), "Active Quests", args.wrapFormat));
        }
      }

      if (hasPersonaStats && Array.isArray(stats.inventory) && stats.inventory.length > 0) {
        const invLines = (stats.inventory as unknown[]).map(formatInventoryLine).filter(isNonEmptyLine);
        if (invLines.length > 0) trackerParts.push(wrapContent(invLines.join("\n"), "Inventory", args.wrapFormat));
      }

      if (hasPersonaStats && Array.isArray(stats.stats) && stats.stats.length > 0) {
        const statLines = (stats.stats as unknown[]).map(formatStatLine).filter(isNonEmptyLine);
        if (statLines.length > 0) trackerParts.push(wrapContent(statLines.join("\n"), "Stats", args.wrapFormat));
      }

      if (hasCustomTracker && Array.isArray(stats.customTrackerFields) && stats.customTrackerFields.length > 0) {
        const customLines = stats.customTrackerFields.map(formatCustomTrackerFieldForPrompt);
        trackerParts.push(wrapContent(customLines.join("\n"), "Custom Tracker", args.wrapFormat));
      }

      if (hasInventoryTracker) {
        const inventoryGroups = [
          ["Currencies", stats.inventoryTrackerCurrencies],
          ["Equipped", stats.inventoryTrackerEquipped],
          ["Inventory", stats.inventoryTrackerInventory],
        ] as const;
        const groupBlocks = inventoryGroups.flatMap(([label, rows]) => {
          if (!Array.isArray(rows) || rows.length === 0) return [];
          const lines = rows.map(formatInventoryTrackerLine).filter(isNonEmptyLine);
          return lines.length > 0 ? [`${label}:\n${lines.join("\n")}`] : [];
        });
        if (groupBlocks.length > 0) {
          trackerParts.push(wrapContent(groupBlocks.join("\n"), "Inventory Tracker", args.wrapFormat));
        }
      }
    }
  }

  if (hasBeholder) {
    const beholderState = normalizeBeholderState(args.beholderState);
    if (beholderState && beholderState.characters.length > 0) {
      trackerParts.push(wrapContent(formatBeholderStateForPrompt(beholderState), "Physical State", args.wrapFormat));
    }
  }

  const playerNotes =
    typeof args.chatMetadata.gamePlayerNotes === "string" ? args.chatMetadata.gamePlayerNotes.trim() : "";
  if (playerNotes) {
    trackerParts.push(
      wrapContent(
        `The player has written these personal notes. Consider them when narrating — they reflect what the player is tracking, their theories, and plans:\n${playerNotes}`,
        "Player Notes",
        args.wrapFormat,
      ),
    );
  }

  if (trackerParts.length === 0) return null;

  return args.wrapFormat === "none"
    ? trackerParts.join("\n\n")
    : args.wrapFormat === "xml"
      ? `<context>\n${trackerParts.map((part) => "    " + part.replace(/\n/g, "\n    ")).join("\n")}\n</context>`
      : `# Context\n*(Established state as of the last message. Do not re-describe — advance from here.)*\n${trackerParts.join("\n")}`;
}

export function injectCommittedTrackerContext(args: {
  messages: PromptMessage[];
  chatEnableAgents: boolean;
  activeAgentIds: string[];
  latestGameState: GameStateSnapshotLike | null | undefined;
  beholderState?: unknown;
  chatMetadata: Record<string, unknown>;
  wrapFormat: WrapFormat;
  dedupeLastMessageWrappers(messages: PromptMessage[]): void;
  findTrackerContextInsertIndex(messages: PromptMessage[]): number;
}): void {
  const contextBlock = buildCommittedTrackerContextBlock({
    chatEnableAgents: args.chatEnableAgents,
    activeAgentIds: args.activeAgentIds,
    latestGameState: args.latestGameState,
    beholderState: args.beholderState,
    chatMetadata: args.chatMetadata,
    wrapFormat: args.wrapFormat,
  });

  if (!contextBlock) return;

  args.dedupeLastMessageWrappers(args.messages);
  args.messages.splice(args.findTrackerContextInsertIndex(args.messages), 0, {
    role: "user",
    content: contextBlock,
    contextKind: "injection",
  });
}
