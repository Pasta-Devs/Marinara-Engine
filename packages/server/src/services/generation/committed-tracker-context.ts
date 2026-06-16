import { compactQuestProgressForContext, formatCustomTrackerFieldForPrompt } from "@marinara-engine/shared";
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
  presentCharacters?: unknown;
  personaStats?: unknown;
  playerStats?: unknown;
};

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function injectCommittedTrackerContext(args: {
  messages: PromptMessage[];
  chatEnableAgents: boolean;
  activeAgentIds: string[];
  latestGameState: GameStateSnapshotLike | null | undefined;
  chatMetadata: Record<string, unknown>;
  wrapFormat: WrapFormat;
  dedupeLastMessageWrappers(messages: PromptMessage[]): void;
  findTrackerContextInsertIndex(messages: PromptMessage[]): number;
}): void {
  if (!args.chatEnableAgents || args.activeAgentIds.length === 0) return;

  const active = new Set(args.activeAgentIds);
  const hasWorldState = active.has("world-state");
  const hasCharTracker = active.has("character-tracker");
  const hasPersonaStats = active.has("persona-stats");
  const hasQuest = active.has("quest");
  const hasCustomTracker = active.has("custom-tracker");
  if (!hasWorldState && !hasCharTracker && !hasPersonaStats && !hasQuest && !hasCustomTracker) return;

  const snap = args.latestGameState ?? undefined;
  if (!snap) return;

  const trackerParts: string[] = [];

  if (hasWorldState) {
    const wsParts: string[] = [];
    if (snap.date) wsParts.push(`Date: ${snap.date}`);
    if (snap.time) wsParts.push(`Time: ${snap.time}`);
    if (snap.location) wsParts.push(`Location: ${snap.location}`);
    if (snap.weather) wsParts.push(`Weather: ${snap.weather}`);
    if (snap.temperature) wsParts.push(`Temperature: ${snap.temperature}`);
    if (wsParts.length > 0) trackerParts.push(wrapContent(wsParts.join("\n"), "World", args.wrapFormat));
  }

  if (hasCharTracker) {
    const presentChars = parseMaybeJson(snap.presentCharacters);
    if (Array.isArray(presentChars) && presentChars.length > 0) {
      const charLines = presentChars.map((character: any) => {
        if (typeof character === "string") return `- ${character}`;
        const details: string[] = [];
        if (character.mood) details.push(`mood: ${character.mood}`);
        if (character.appearance) details.push(`appearance: ${character.appearance}`);
        if (character.outfit) details.push(`outfit: ${character.outfit}`);
        if (character.thoughts) details.push(`thoughts: ${character.thoughts}`);
        if (Array.isArray(character.stats) && character.stats.length > 0) {
          const statStr = character.stats
            .map((stat: any) => `${stat.name}: ${stat.value}${stat.max ? `/${stat.max}` : ""}`)
            .join(", ");
          details.push(`stats: ${statStr}`);
        }
        const detailStr = details.length > 0 ? ` (${details.join("; ")})` : "";
        return `- ${character.emoji ?? ""} ${character.name ?? character}${detailStr}`;
      });
      trackerParts.push(wrapContent(charLines.join("\n"), "Present Characters", args.wrapFormat));
    }
  }

  if (hasPersonaStats && snap.personaStats) {
    const psBars = parseMaybeJson(snap.personaStats);
    if (Array.isArray(psBars) && psBars.length > 0) {
      const barLines = psBars.map((bar: any) => `- ${bar.name}: ${bar.value}/${bar.max}`);
      trackerParts.push(wrapContent(barLines.join("\n"), "Persona Stats", args.wrapFormat));
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
        const questLines = activeQuestsForContext.map((quest) => {
          const objectives = Array.isArray(quest.objectives)
            ? quest.objectives.map((objective) => `  [ ] ${objective.text}`).join("\n")
            : "";
          return `- ${quest.name}${objectives ? "\n" + objectives : ""}`;
        });
        if (questLines.length > 0) {
          trackerParts.push(wrapContent(questLines.join("\n"), "Active Quests", args.wrapFormat));
        }
      }

      if (hasPersonaStats && Array.isArray(stats.inventory) && stats.inventory.length > 0) {
        const invLines = stats.inventory.map(
          (item: any) =>
            `- ${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}${item.description ? ` — ${item.description}` : ""}`,
        );
        trackerParts.push(wrapContent(invLines.join("\n"), "Inventory", args.wrapFormat));
      }

      if (hasPersonaStats && Array.isArray(stats.stats) && stats.stats.length > 0) {
        const statLines = stats.stats.map((stat: any) => `- ${stat.name}: ${stat.value}${stat.max ? `/${stat.max}` : ""}`);
        trackerParts.push(wrapContent(statLines.join("\n"), "Stats", args.wrapFormat));
      }

      if (hasCustomTracker && Array.isArray(stats.customTrackerFields) && stats.customTrackerFields.length > 0) {
        const customLines = stats.customTrackerFields.map(formatCustomTrackerFieldForPrompt);
        trackerParts.push(wrapContent(customLines.join("\n"), "Custom Tracker", args.wrapFormat));
      }
    }
  }

  const playerNotes = typeof args.chatMetadata.gamePlayerNotes === "string" ? args.chatMetadata.gamePlayerNotes.trim() : "";
  if (playerNotes) {
    trackerParts.push(
      wrapContent(
        `The player has written these personal notes. Consider them when narrating — they reflect what the player is tracking, their theories, and plans:\n${playerNotes}`,
        "Player Notes",
        args.wrapFormat,
      ),
    );
  }

  if (trackerParts.length === 0) return;

  args.dedupeLastMessageWrappers(args.messages);
  const contextBlock =
    args.wrapFormat === "none"
      ? trackerParts.join("\n\n")
      : args.wrapFormat === "xml"
        ? `<context>\n${trackerParts.map((part) => "    " + part.replace(/\n/g, "\n    ")).join("\n")}\n</context>`
        : `# Context\n*(Established state as of the last message. Do not re-describe — advance from here.)*\n${trackerParts.join("\n")}`;

  args.messages.splice(args.findTrackerContextInsertIndex(args.messages), 0, {
    role: "user",
    content: contextBlock,
    contextKind: "injection",
  });
}
