import type { HudWidget, WidgetUpdate } from "../types/game.js";

const MAX_LIST_WIDGET_ITEMS = 5;

function normalizeListWidgetItem(value: string): string {
  const trimmed = value.trim();
  let start = 0;
  let end = trimmed.length;
  while (start < end && (trimmed[start] === '"' || trimmed[start] === "'")) start++;
  while (end > start && (trimmed[end - 1] === '"' || trimmed[end - 1] === "'")) end--;
  const compact = trimmed.slice(start, end).replace(/\s+/g, " ");
  end = compact.length;
  while (end > 0 && ".!?;,:".includes(compact[end - 1]!)) end--;
  return compact.slice(0, end).toLowerCase();
}

function appendListWidgetItem(items: string[], nextItem: string): string[] {
  const cleaned = nextItem.trim();
  if (!cleaned) return items;

  const normalizedNewItem = normalizeListWidgetItem(cleaned);
  const dedupedItems = items.filter((item) => normalizeListWidgetItem(item) !== normalizedNewItem);
  return [...dedupedItems, cleaned].slice(-MAX_LIST_WIDGET_ITEMS);
}

function removeListWidgetItem(items: string[], target: string): string[] {
  const normalizedTarget = normalizeListWidgetItem(target);
  if (!normalizedTarget) return items;

  const exactMatchIndex = items.findIndex((item) => normalizeListWidgetItem(item) === normalizedTarget);
  if (exactMatchIndex >= 0) {
    return items.filter((_, index) => index !== exactMatchIndex);
  }

  const partialMatches = items
    .map((item, index) => ({ index, normalized: normalizeListWidgetItem(item) }))
    .filter(({ normalized }) => normalized.includes(normalizedTarget) || normalizedTarget.includes(normalized));

  if (partialMatches.length !== 1) return items;
  return items.filter((_, index) => index !== partialMatches[0]!.index);
}

export function applyGameWidgetUpdate(widgets: HudWidget[], update: WidgetUpdate): HudWidget[] {
  return widgets.map((w) => {
    if (w.id !== update.widgetId) return w;
    const changes = update.changes;
    const newConfig = { ...w.config };

    // Handle stat_block: update a specific stat by name, creating it when needed.
    if (changes.statName && w.type === "stat_block") {
      const targetName = changes.statName.trim();
      const rawValue = changes.value;
      const newValue =
        typeof rawValue === "number"
          ? rawValue
          : typeof rawValue === "string" && rawValue.trim()
            ? rawValue.trim()
            : undefined;
      if (targetName && newValue !== undefined) {
        const stats = Array.isArray(newConfig.stats) ? [...newConfig.stats] : [];
        const targetKey = targetName.toLowerCase();
        const statIndex = stats.findIndex((stat) => stat.name.trim().toLowerCase() === targetKey);
        if (statIndex >= 0) {
          stats[statIndex] = { ...stats[statIndex]!, value: newValue };
        } else {
          stats.push({ name: targetName, value: newValue });
        }
        newConfig.stats = stats;
      }
    } else {
      // Merge simple numeric/config fields
      if (changes.value !== undefined)
        newConfig.value = typeof changes.value === "number" ? changes.value : newConfig.value;
      if (changes.count !== undefined) newConfig.count = changes.count;
      if (changes.running !== undefined) newConfig.running = changes.running;
      if (changes.seconds !== undefined) newConfig.seconds = changes.seconds;
    }

    // Handle list/inventory add/remove
    if (w.type === "list") {
      let nextItems = [...(newConfig.items ?? [])];
      if (changes.remove) {
        nextItems = removeListWidgetItem(nextItems, changes.remove);
      }
      if (changes.add) {
        nextItems = appendListWidgetItem(nextItems, changes.add);
      }
      newConfig.items = nextItems;
    } else {
      if (changes.add && w.type === "inventory_grid") {
        newConfig.contents = [...(newConfig.contents ?? []), { name: changes.add, quantity: 1 }];
      }
      if (changes.remove && w.type === "inventory_grid") {
        newConfig.contents = (newConfig.contents ?? []).filter((c) => c.name !== changes.remove);
      }
    }
    return { ...w, config: newConfig };
  });
}
