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

    // A stat_block's row taken out by its name, any case (a member's second health row).
    if (changes.remove && !changes.statName && w.type === "stat_block") {
      const gone = changes.remove.trim().toLowerCase();
      const stats = Array.isArray(newConfig.stats) ? newConfig.stats : [];
      return { ...w, config: { ...newConfig, stats: stats.filter((stat) => stat.name.trim().toLowerCase() !== gone) } };
    }
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
        const exact = stats.findIndex((stat) => stat.name.trim().toLowerCase() === targetKey);
        // "Aldric" is the row "Aldric HP", where it is the only one it could be (laptop 2026-10-25:
        // every Game Master update added a second row beside the one the setup wrote).
        const near = stats.flatMap((stat, index) => {
          const name = stat.name.trim().toLowerCase();
          const longer = name.length > targetKey.length ? name : targetKey;
          const shorter = longer === name ? targetKey : name;
          return longer.startsWith(`${shorter} `) && !longer.slice(shorter.length + 1).includes(" ") ? [index] : [];
        });
        // A bare "Kesh" beside "Kesh HP" is the same health twice, left by older builds: the update
        // goes to "Kesh HP" and the bare row goes (laptop playtest 2026-10-25: "Kesh" said 26/38 while
        // "Kesh HP" stayed 33/33).
        const healthTwin = stats.findIndex((stat) =>
          HEALTH_WORDS.some((word) => stat.name.trim().toLowerCase().replace(/\s+/g, " ") === `${targetKey} ${word}`),
        );
        if (exact >= 0 && healthTwin >= 0) {
          stats[healthTwin] = { ...stats[healthTwin]!, value: newValue };
          stats.splice(exact, 1);
          newConfig.stats = stats;
          return { ...w, config: newConfig };
        }
        const statIndex = exact >= 0 ? exact : near.length === 1 ? near[0]! : -1;
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

/** One party member's health as their sheet has it. */
export interface PartyHealthRow {
  name: string;
  value: number;
  max: number;
}

const HEALTH_WORDS = ["hp", "health", "hit points", "vitality"];

/**
 * The widget updates that bring a party health widget's rows to what the sheets say (laptop playtest
 * 2026-10-25: "Ulfgar HP" stayed at 50 while the sheet said 48, because the Game Master wrote no
 * widget tag). A row is a member's when it is "<name> HP" (or Health, Hit points, Vitality) in any
 * stat block, or the bare name in a stat block whose label or id is about health. A name is the
 * member's full name or, where no other member shares it, their first. A row keeps the shape it was
 * written in: "36/36" stays "a/b", a number stays a number, and anything else (a word) is left alone.
 * `words` are the ruleset's own names for health ("Grit"), read beside the usual ones: names of what
 * remains, never of a track that counts what was taken.
 */
export function partyHealthWidgetUpdates(
  widgets: HudWidget[],
  rows: PartyHealthRow[],
  words: string[] = [],
): WidgetUpdate[] {
  if (rows.length === 0) return [];
  const healthWords = new Set(
    [...HEALTH_WORDS, ...words].map((word) => word.trim().toLowerCase().replace(/\s+/g, " ")).filter(Boolean),
  );
  // A label or id is about health when it holds one of the words whole: "Party Health", "party_hp",
  // "Santé du groupe". Both sides are read the same way, letters and digits of any script.
  const plainWords = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const plainHealthWords = [...healthWords].map(plainWords).filter(Boolean);
  const aboutHealthWord = (text: string) => {
    const plain = ` ${plainWords(text)} `;
    return plain.trim() !== "" && plainHealthWords.some((word) => plain.includes(` ${word} `));
  };
  const byName = new Map<string, PartyHealthRow | null>();
  const add = (key: string, row: PartyHealthRow, unique: boolean) => {
    if (!key) return;
    const existing = byName.get(key);
    if (existing === undefined) byName.set(key, row);
    else if (unique && existing !== row) byName.set(key, null);
  };
  for (const row of rows) add(row.name.trim().toLowerCase(), row, false);
  // Each word of a longer name, where no other member shares it: "Brother Kesh" is "Kesh" too.
  for (const row of rows) {
    const words = row.name.trim().toLowerCase().split(/\s+/);
    if (words.length > 1) for (const word of words) add(word, row, true);
  }
  const updates: WidgetUpdate[] = [];
  for (const widget of widgets) {
    if (widget.type !== "stat_block" || !Array.isArray(widget.config.stats)) continue;
    const aboutHealth = aboutHealthWord(widget.label) || aboutHealthWord(widget.id);
    // A widget update reaches only the first row of a name, so a later row of the same name is not
    // one this can bring in step: asking for it again would never settle.
    const seen = new Set<string>();
    const names = new Set(widget.config.stats.map((stat) => stat.name.trim().toLowerCase().replace(/\s+/g, " ")));
    for (const stat of widget.config.stats) {
      const name = stat.name.trim().toLowerCase();
      if (seen.has(name)) continue;
      seen.add(name);
      // A member's bare name beside their "<name> HP" row is the same health twice (laptop playtest
      // 2026-10-25: "Aldric 44/44" under a stale "Aldric HP 36/36", left by older builds): it goes,
      // and the "HP" row follows the sheet.
      // With no sheet to follow, the bare row holds the Game Master's latest word (older builds sent
      // its updates there), so the "HP" row takes it first.
      const twinWord = aboutHealth
        ? [...healthWords].find((word) => names.has(`${name.replace(/\s+/g, " ")} ${word}`))
        : undefined;
      if (twinWord !== undefined) {
        const twin = widget.config.stats.find(
          (other) =>
            other.name.trim().toLowerCase().replace(/\s+/g, " ") === `${name.replace(/\s+/g, " ")} ${twinWord}`,
        );
        if (twin && !byName.get(name) && twin.value !== stat.value)
          updates.push({ widgetId: widget.id, changes: { statName: twin.name, value: stat.value } });
        updates.push({ widgetId: widget.id, changes: { remove: stat.name } });
        continue;
      }
      const parts = name.split(/\s+/);
      let who: string | undefined;
      for (let cut = parts.length - 1; cut >= 1 && !who; cut--) {
        if (healthWords.has(parts.slice(cut).join(" "))) who = parts.slice(0, cut).join(" ");
      }
      if (!who && aboutHealth) who = name;
      const row = who ? byName.get(who) : undefined;
      if (!row) continue;
      const value = Math.max(0, Math.round(row.value));
      const max = Math.max(0, Math.round(row.max));
      let next: number | string | undefined;
      if (typeof stat.value === "number") next = value;
      else if (/^\s*-?\d+\s*\/\s*\d+\s*$/.test(stat.value)) next = `${value}/${max}`;
      else if (/^\s*-?\d+\s*$/.test(stat.value)) next = String(value);
      if (next === undefined || next === stat.value) continue;
      updates.push({ widgetId: widget.id, changes: { statName: stat.name, value: next } });
    }
  }
  return updates;
}
