import type { HudWidget } from "@marinara-engine/shared";
import type { Journal, JournalEntry } from "./journal.service.js";

function normalizeListItem(value: string): string {
  return value
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?;,:]+$/g, "")
    .toLowerCase();
}

function readWidgetParam(body: string, name: "add" | "remove"): string | null {
  const match = body.match(new RegExp(`(?:^|,)\\s*${name}:\\s*(?:"([^"]*)"|'([^']*)'|([^,]*))`, "i"));
  const value = (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
  return value || null;
}

export function restoreBranchHudLists(
  metadata: Record<string, unknown>,
  copiedMessages: Array<{ content?: string | null }>,
): HudWidget[] {
  const blueprint = metadata.gameBlueprint as { hudWidgets?: unknown } | null;
  const setup = metadata.gameSetupConfig as { customHudWidgets?: unknown } | null;
  const hasBlueprintWidgets = Array.isArray(blueprint?.hudWidgets);
  const hasSetupWidgets = Array.isArray(setup?.customHudWidgets);
  const initial = hasBlueprintWidgets
    ? (blueprint.hudWidgets as HudWidget[])
    : hasSetupWidgets
      ? (setup.customHudWidgets as HudWidget[])
      : Array.isArray(metadata.gameWidgetState)
        ? (metadata.gameWidgetState as HudWidget[])
        : [];
  let widgets = initial.map((widget) => ({
    ...widget,
    config: {
      ...widget.config,
      ...(!hasBlueprintWidgets && widget.type === "list" ? { items: [] } : {}),
    },
  }));

  for (const message of copiedMessages) {
    for (const match of (message.content ?? "").matchAll(/\[widget:\s*([^,\]]+),([^\]]*)\]/gi)) {
      const widgetId = match[1]!.trim();
      const add = readWidgetParam(match[2] ?? "", "add");
      const remove = readWidgetParam(match[2] ?? "", "remove");
      widgets = widgets.map((widget) => {
        if (widget.id !== widgetId || widget.type !== "list") return widget;
        let items = [...(widget.config.items ?? [])];
        if (remove) {
          const target = normalizeListItem(remove);
          items = items.filter((item) => normalizeListItem(item) !== target);
        }
        if (add) {
          const target = normalizeListItem(add);
          items = [...items.filter((item) => normalizeListItem(item) !== target), add].slice(-5);
        }
        return { ...widget, config: { ...widget.config, items } };
      });
    }
  }
  return widgets;
}

function normalizedEntryTitle(entry: JournalEntry): string {
  return entry.title
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim()
    .toLowerCase();
}

export function trimJournalForBranch(
  journal: Journal,
  copiedMessageIds: Set<string>,
  cutoffCreatedAt: string,
): Journal {
  const cutoff = Date.parse(cutoffCreatedAt);
  if (!Number.isFinite(cutoff)) return journal;
  const beforeCutoff = (timestamp: string | undefined) => {
    const parsed = Date.parse(timestamp ?? "");
    return Number.isFinite(parsed) && parsed < cutoff;
  };
  const entries = journal.entries.filter((entry) =>
    entry.sourceMessageId ? copiedMessageIds.has(entry.sourceMessageId) : beforeCutoff(entry.timestamp),
  );
  const locationNames = new Set(
    entries
      .filter((entry) => entry.type === "location")
      .map((entry) =>
        entry.title
          .replace(/^Discovered:\s*/i, "")
          .trim()
          .toLowerCase(),
      ),
  );
  const npcEntries = entries.filter((entry) => entry.type === "npc");

  return {
    ...journal,
    entries,
    locations: journal.locations.filter((location) => locationNames.has(location.trim().toLowerCase())),
    npcLog: journal.npcLog
      .map((npc) => ({
        ...npc,
        interactions: npc.interactions.filter((interaction) =>
          npcEntries.some(
            (entry) =>
              normalizedEntryTitle(entry) === npc.npcName.trim().toLowerCase() &&
              entry.content.trim() === interaction.trim(),
          ),
        ),
      }))
      .filter((npc) => npc.interactions.length > 0),
    inventoryLog: journal.inventoryLog.filter((entry) => beforeCutoff(entry.timestamp)),
    quests: journal.quests
      .filter((quest) => beforeCutoff(quest.discoveredAt))
      .map((quest) =>
        quest.completedAt && !beforeCutoff(quest.completedAt)
          ? { ...quest, status: "active" as const, completedAt: undefined }
          : quest,
      ),
  };
}
