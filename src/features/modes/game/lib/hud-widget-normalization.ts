import type { HudWidget } from "../../../../engine/contracts/types/game";

type LegacyHudWidget = Omit<HudWidget, "position"> & {
  position: HudWidget["position"] | "hud_bottom";
};

function isNumericHudWidgetType(type: HudWidget["type"]) {
  return type === "progress_bar" || type === "gauge" || type === "relationship_meter";
}

function finiteNumber(value: unknown): number | null {
  const raw = typeof value === "string" && value.trim() ? Number(value.trim()) : value;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

type LegacyInventoryGridItem = { name: string; slot?: string; quantity?: number };

function positiveInventoryQuantity(value: unknown): number {
  const quantity = finiteNumber(value) ?? 1;
  return Math.max(1, Math.floor(quantity));
}

function legacyInventoryGridItems(value: unknown): LegacyInventoryGridItem[] | null {
  if (!Array.isArray(value)) return null;
  const items: LegacyInventoryGridItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : "";
    if (!name) continue;
    const slot = typeof record.slot === "string" ? record.slot : undefined;
    items.push({
      name,
      ...(slot ? { slot } : {}),
      quantity: positiveInventoryQuantity(record.quantity),
    });
  }
  return items;
}

function normalizeLegacyHudWidgetPosition(widget: LegacyHudWidget, legacyBottomIndex: number): HudWidget {
  if (widget.position !== "hud_bottom") return widget as HudWidget;
  return {
    ...widget,
    position: legacyBottomIndex % 2 === 0 ? "hud_left" : "hud_right",
  };
}

export function normalizeHudWidgets(widgets: readonly LegacyHudWidget[]): HudWidget[] {
  let legacyBottomCount = 0;
  return widgets.map((widget) => {
    let normalized = normalizeLegacyHudWidgetPosition(widget, legacyBottomCount);
    if (widget.position === "hud_bottom") legacyBottomCount += 1;

    if (isNumericHudWidgetType(normalized.type)) {
      const max = Math.max(1, finiteNumber(normalized.config.max) ?? 100);
      const value = finiteNumber(normalized.config.value) ?? finiteNumber(normalized.config.startingValue) ?? 0;
      const startingValue = finiteNumber(normalized.config.startingValue) ?? value;

      if (
        normalized.config.max !== max ||
        normalized.config.value !== value ||
        normalized.config.startingValue !== startingValue
      ) {
        normalized = {
          ...normalized,
          config: {
            ...normalized.config,
            max,
            startingValue,
            value,
          },
        };
      }
    }

    const legacyItems = legacyInventoryGridItems((normalized.config as HudWidget["config"] & { items?: unknown }).items);
    if (normalized.type === "inventory_grid" && !Array.isArray(normalized.config.contents) && legacyItems) {
      normalized = {
        ...normalized,
        config: {
          ...normalized.config,
          contents: legacyItems,
        },
      };
    }

    return normalized;
  });
}
