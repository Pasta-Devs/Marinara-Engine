// ──────────────────────────────────────────────
// Game: HUD Widget Setup Editor
// ──────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  normalizeTextForMatch,
  type HudWidget,
  type HudWidgetConfig,
  type HudWidgetType,
} from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { translate } from "../../localization/i18n";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { AgentSettingsActionButton } from "../chat/AgentSettingsControls";
import { useTranslation as useUiTranslation } from "react-i18next";

export const MAX_GAME_SETUP_WIDGETS = 4;
const GAME_WIDGET_EXPORT_KIND = "marinara-game-hud-widgets";
const GAME_WIDGET_EXPORT_VERSION = 1;

const WIDGET_TYPES: readonly HudWidgetType[] = [
  "progress_bar",
  "gauge",
  "relationship_meter",
  "counter",
  "stat_block",
  "list",
  "inventory_grid",
  "timer",
];

const DEFAULT_ACCENTS: Record<HudWidgetType, string> = {
  progress_bar: "#a78bfa",
  gauge: "#22c55e",
  relationship_meter: "#f472b6",
  counter: "#38bdf8",
  stat_block: "#f59e0b",
  list: "#14b8a6",
  inventory_grid: "#94a3b8",
  timer: "#fb7185",
};

const DEFAULT_ICONS: Record<HudWidgetType, string> = {
  progress_bar: "◆",
  gauge: "◔",
  relationship_meter: "♥",
  counter: "#",
  stat_block: "▦",
  list: "☰",
  inventory_grid: "▣",
  timer: "◷",
};

const WIDGET_NUMBER_INPUT_CLASS =
  "w-full rounded-lg border border-transparent bg-[var(--secondary)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/40";

interface NormalizeGameHudWidgetsOptions {
  mode?: "persisted" | "draft";
}

function isHudWidgetType(value: unknown): value is HudWidgetType {
  return (
    value === "progress_bar" ||
    value === "gauge" ||
    value === "relationship_meter" ||
    value === "counter" ||
    value === "stat_block" ||
    value === "list" ||
    value === "inventory_grid" ||
    value === "timer"
  );
}

function formatWidgetTypeLabel(type: HudWidgetType) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugifyWidgetId(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "widget"
  );
}

function nextWidgetId(base: string, widgets: readonly HudWidget[]) {
  const used = new Set(widgets.map((widget) => widget.id));
  const stem = slugifyWidgetId(base);
  let candidate = stem;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${stem}_${suffix++}`;
  }
  return candidate;
}

function parseNumber(value: unknown, fallback: number, min?: number) {
  const parsed = typeof value === "string" && value.trim() ? Number(value.trim()) : value;
  const numeric = typeof parsed === "number" && Number.isFinite(parsed) ? parsed : fallback;
  return typeof min === "number" ? Math.max(min, numeric) : numeric;
}

function nextStatBlockName(stats: readonly { name?: unknown }[]) {
  const used = new Set(
    stats
      .map((stat) =>
        String(stat.name ?? "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );
  let index = stats.length + 1;
  let candidate = `Stat ${index}`;
  while (used.has(candidate.toLowerCase())) {
    candidate = `Stat ${++index}`;
  }
  return candidate;
}

function buildInventoryGridContentsFromText(
  value: string,
  previousContents: NonNullable<HudWidgetConfig["contents"]>,
): NonNullable<HudWidgetConfig["contents"]> {
  const previousByName = new Map<string, NonNullable<HudWidgetConfig["contents"]>>();
  for (const item of previousContents) {
    const key = normalizeTextForMatch(item.name);
    if (!key) continue;
    const bucket = previousByName.get(key) ?? [];
    bucket.push(item);
    previousByName.set(key, bucket);
  }

  return value
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => {
      const previous = previousByName.get(normalizeTextForMatch(name))?.shift();
      return {
        ...previous,
        name,
        quantity: previous?.quantity ?? 1,
      };
    });
}

function parseListItemsDraft(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function defaultWidgetConfig(type: HudWidgetType): HudWidgetConfig {
  switch (type) {
    case "progress_bar":
      return { startingValue: 100, value: 100, max: 100 };
    case "gauge":
      return { startingValue: 50, value: 50, max: 100, dangerBelow: 25 };
    case "relationship_meter":
      return { startingValue: 50, value: 50, max: 100 };
    case "counter":
      return { count: 0 };
    case "stat_block":
      return { stats: [{ name: "Status", value: "Stable" }] };
    case "list":
      return { items: [] };
    case "inventory_grid":
      return { slots: 8, contents: [] };
    case "timer":
      return { seconds: 60, running: false };
  }
}

function normalizeConfig(
  type: HudWidgetType,
  config: unknown,
  options: NormalizeGameHudWidgetsOptions = {},
): HudWidgetConfig {
  const source = config && typeof config === "object" && !Array.isArray(config) ? (config as HudWidgetConfig) : {};
  const fallback = defaultWidgetConfig(type);
  const draftMode = options.mode === "draft";

  if (type === "progress_bar" || type === "gauge" || type === "relationship_meter") {
    const max = parseNumber(source.max, fallback.max ?? 100, 1);
    const value = Math.max(0, Math.min(max, parseNumber(source.value ?? source.startingValue, fallback.value ?? 0)));
    return {
      ...source,
      max,
      value,
      startingValue: Math.min(max, parseNumber(source.startingValue ?? value, value, 0)),
    };
  }

  if (type === "counter") {
    return { ...source, count: Math.round(parseNumber(source.count, 0)) };
  }

  if (type === "stat_block") {
    const stats = Array.isArray(source.stats)
      ? source.stats
          .map((stat) => {
            const rawValue = (stat as { value?: unknown }).value;
            return {
              name: draftMode
                ? String((stat as { name?: unknown }).name ?? "")
                : String((stat as { name?: unknown }).name ?? "").trim(),
              value: typeof rawValue === "number" || typeof rawValue === "string" ? rawValue : "",
            };
          })
          .filter((stat) => draftMode || stat.name)
      : (fallback.stats ?? []);
    return { ...source, stats };
  }

  if (type === "list") {
    return {
      ...source,
      items: Array.isArray(source.items) ? source.items.map((item) => String(item).trim()).filter(Boolean) : [],
    };
  }

  if (type === "inventory_grid") {
    return {
      ...source,
      slots: Math.round(parseNumber(source.slots, 8, 1)),
      contents: Array.isArray(source.contents) ? source.contents : [],
    };
  }

  return {
    ...source,
    seconds: Math.round(parseNumber(source.seconds, 60, 0)),
    running: source.running === true,
  };
}

export function createDefaultGameHudWidget(type: HudWidgetType, widgets: readonly HudWidget[]): HudWidget {
  const label = formatWidgetTypeLabel(type);
  return {
    id: nextWidgetId(label, widgets),
    type,
    label,
    icon: DEFAULT_ICONS[type],
    position:
      widgets.filter((widget) => widget.position === "hud_left").length <=
      widgets.filter((widget) => widget.position === "hud_right").length
        ? "hud_left"
        : "hud_right",
    accent: DEFAULT_ACCENTS[type],
    config: defaultWidgetConfig(type),
  };
}

export function normalizeGameHudWidgets(value: unknown, options: NormalizeGameHudWidgetsOptions = {}): HudWidget[] {
  if (!Array.isArray(value)) return [];
  const normalized: HudWidget[] = [];
  const usedIds = new Set<string>();
  const draftMode = options.mode === "draft";

  for (const entry of value) {
    if (!entry || typeof entry !== "object" || normalized.length >= MAX_GAME_SETUP_WIDGETS) continue;
    const raw = entry as Partial<HudWidget>;
    const type = isHudWidgetType(raw.type) ? raw.type : "progress_bar";
    const rawLabel = typeof raw.label === "string" ? raw.label : "";
    const label = draftMode ? rawLabel : rawLabel.trim() || formatWidgetTypeLabel(type);
    const preferredId = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : nextWidgetId(label, normalized);
    const id = usedIds.has(preferredId) ? nextWidgetId(label, normalized) : preferredId;
    usedIds.add(id);
    normalized.push({
      id,
      type,
      label,
      icon: typeof raw.icon === "string" ? raw.icon.slice(0, 8) : DEFAULT_ICONS[type],
      position: raw.position === "hud_right" ? "hud_right" : "hud_left",
      accent: typeof raw.accent === "string" && raw.accent.trim() ? raw.accent.trim() : DEFAULT_ACCENTS[type],
      config: normalizeConfig(type, raw.config, options),
    });
  }

  return normalized;
}

function getImportedWidgetSource(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const record = value as { widgets?: unknown; hudWidgets?: unknown; gameWidgetState?: unknown };
  if (Array.isArray(record.widgets)) return record.widgets;
  if (Array.isArray(record.hudWidgets)) return record.hudWidgets;
  if (Array.isArray(record.gameWidgetState)) return record.gameWidgetState;
  return [];
}

function buildWidgetExportFilename(filename?: string) {
  const stem =
    filename
      ?.replace(/\.json$/i, "")
      .trim()
      .replace(/[^\p{L}\p{N}._-]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "marinara-game-widgets";
  return `${stem}.json`;
}

function exportGameHudWidgets(widgets: readonly HudWidget[], filename?: string) {
  const normalizedWidgets = normalizeGameHudWidgets(widgets);
  const payload = {
    kind: GAME_WIDGET_EXPORT_KIND,
    version: GAME_WIDGET_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    widgets: normalizedWidgets,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildWidgetExportFilename(filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast.success(
    translate("ui.game.gamewidgetsetupeditor.exportedWidgets", {
      count: normalizedWidgets.length,
    }),
  );
}

async function importGameHudWidgetsFromFile(file: File) {
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
  const widgets = normalizeGameHudWidgets(getImportedWidgetSource(parsed));
  if (widgets.length === 0) {
    throw new Error("No valid game widgets were found in that file.");
  }
  return widgets;
}

interface GameWidgetFileControlsProps {
  widgets: HudWidget[];
  onImport: (widgets: HudWidget[]) => void;
  disabled?: boolean;
  className?: string;
  exportFilename?: string;
  importSuccessMessage?: (count: number) => string;
}

export function GameWidgetFileControls({
  widgets,
  onImport,
  disabled,
  className,
  exportFilename,
  importSuccessMessage,
}: GameWidgetFileControlsProps) {
  const { t: localizeUi } = useUiTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const normalizedWidgets = useMemo(() => normalizeGameHudWidgets(widgets, { mode: "draft" }), [widgets]);
  const canExport = normalizedWidgets.length > 0 && !disabled;

  const handleImport = async (file: File | undefined) => {
    if (!file || disabled) return;
    try {
      const importedWidgets = await importGameHudWidgetsFromFile(file);
      onImport(importedWidgets);
      toast.success(
        importSuccessMessage?.(importedWidgets.length) ??
          localizeUi("ui.game.gamewidgetsetupeditor.importedWidgets", {
            count: importedWidgets.length,
          }),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.game.gamewidgetfilecontrols.failedToImportGameWidgets"),
      );
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => void handleImport(event.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download size="0.75rem" />
        <span>{localizeUi("ui.game.gamewidgetfilecontrols.importWidgets")}</span>
      </button>
      <button
        type="button"
        onClick={() => exportGameHudWidgets(normalizedWidgets, exportFilename)}
        disabled={!canExport}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Upload size="0.75rem" />
        <span>{localizeUi("ui.game.gamewidgetfilecontrols.exportWidgets")}</span>
      </button>
    </div>
  );
}

interface GameWidgetSetupEditorProps {
  widgets: HudWidget[];
  onChange: (widgets: HudWidget[]) => void;
  disabled?: boolean;
  className?: string;
}

export function GameWidgetSetupEditor({ widgets, onChange, disabled, className }: GameWidgetSetupEditorProps) {
  const { t: localizeUi } = useUiTranslation();
  const [newWidgetType, setNewWidgetType] = useState<HudWidgetType>("progress_bar");
  const normalizedWidgets = useMemo(() => normalizeGameHudWidgets(widgets), [widgets]);
  const canAddWidget = normalizedWidgets.length < MAX_GAME_SETUP_WIDGETS;

  const replaceWidget = (widgetId: string, patch: Partial<HudWidget>) => {
    onChange(
      normalizedWidgets.map((widget) => {
        if (widget.id !== widgetId) return widget;
        const type = patch.type ?? widget.type;
        return {
          ...widget,
          ...patch,
          type,
          config: patch.type && patch.type !== widget.type ? defaultWidgetConfig(patch.type) : widget.config,
        };
      }),
    );
  };

  const replaceWidgetId = (widgetId: string, value: string) => {
    const otherWidgets = normalizedWidgets.filter((widget) => widget.id !== widgetId);
    const normalizedId = nextWidgetId(value, otherWidgets);
    replaceWidget(widgetId, { id: normalizedId });
    return normalizedId;
  };

  const updateWidgetConfig = (widgetId: string, patch: Partial<HudWidgetConfig>) => {
    onChange(
      normalizedWidgets.map((widget) =>
        widget.id === widgetId
          ? { ...widget, config: normalizeConfig(widget.type, { ...widget.config, ...patch }, { mode: "draft" }) }
          : widget,
      ),
    );
  };

  const addWidget = () => {
    if (!canAddWidget || disabled) return;
    onChange([...normalizedWidgets, createDefaultGameHudWidget(newWidgetType, normalizedWidgets)]);
  };

  const duplicateWidget = (widget: HudWidget) => {
    if (!canAddWidget || disabled) return;
    const label = widget.label.trim() || formatWidgetTypeLabel(widget.type);
    onChange([
      ...normalizedWidgets,
      {
        ...widget,
        id: nextWidgetId(`${label} copy`, normalizedWidgets),
        label: `${label} copy`,
        config: structuredClone(widget.config),
      },
    ]);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
          {normalizedWidgets.length}/{MAX_GAME_SETUP_WIDGETS} {localizeUi("ui.game.gamewidgetsetupeditor.widgets")}
        </span>
        <div className="flex min-w-0 items-center gap-2">
          <select
            value={newWidgetType}
            onChange={(event) => setNewWidgetType(event.target.value as HudWidgetType)}
            disabled={disabled || !canAddWidget}
            className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs text-[var(--foreground)] disabled:opacity-50"
          >
            {WIDGET_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatWidgetTypeLabel(type)}
              </option>
            ))}
          </select>
          <AgentSettingsActionButton
            type="button"
            variant="primary"
            onClick={addWidget}
            disabled={disabled || !canAddWidget}
          >
            <Plus size="0.75rem" />
            <span>{localizeUi("ui.characters.metadatatab.add")}</span>
          </AgentSettingsActionButton>
        </div>
      </div>

      {normalizedWidgets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-3 text-center text-[0.6875rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.game.gamewidgetsetupeditor.noWidgetsSelected")}
        </div>
      ) : (
        <div className="space-y-2">
          {normalizedWidgets.map((widget) => (
            <div key={widget.id} className="rounded-lg bg-[var(--background)]/75 p-3 ring-1 ring-[var(--border)]">
              <div className="grid gap-2 sm:grid-cols-[3.25rem_minmax(0,1fr)_9rem_auto] sm:items-end">
                <label className="space-y-1">
                  <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                    {localizeUi("ui.game.gamewidgetsetupeditor.icon")}
                  </span>
                  <input
                    value={widget.icon ?? ""}
                    maxLength={8}
                    disabled={disabled}
                    onChange={(event) => replaceWidget(widget.id, { icon: event.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs text-[var(--foreground)]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                    {localizeUi("ui.game.gamewidgetsetupeditor.label")}
                  </span>
                  <input
                    value={widget.label}
                    disabled={disabled}
                    onChange={(event) => replaceWidget(widget.id, { label: event.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs text-[var(--foreground)]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                    {localizeUi("ui.panels.gameassetssettings.type")}
                  </span>
                  <select
                    value={widget.type}
                    disabled={disabled}
                    onChange={(event) => replaceWidget(widget.id, { type: event.target.value as HudWidgetType })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs text-[var(--foreground)]"
                  >
                    {WIDGET_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {formatWidgetTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => duplicateWidget(widget)}
                    disabled={disabled || !canAddWidget}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
                    aria-label={localizeUi("ui.game.gamewidgetsetupeditor.duplicateValue1", {
                      value1: widget.label.trim() || formatWidgetTypeLabel(widget.type),
                    })}
                  >
                    <Copy size="0.875rem" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(normalizedWidgets.filter((entry) => entry.id !== widget.id))}
                    disabled={disabled}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--marinara-chat-chrome-accent)]/25 px-3 text-[var(--marinara-chat-chrome-accent)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg)] disabled:opacity-50"
                    aria-label={localizeUi("ui.game.gamewidgetsetupeditor.removeValue1", {
                      value1: widget.label.trim() || formatWidgetTypeLabel(widget.type),
                    })}
                  >
                    <Trash2 size="0.875rem" />
                  </button>
                </div>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                    {localizeUi("ui.game.gamewidgetsetupeditor.id")}
                  </span>
                  <input
                    key={widget.id}
                    defaultValue={widget.id}
                    disabled={disabled}
                    onBlur={(event) => {
                      event.currentTarget.value = replaceWidgetId(widget.id, event.currentTarget.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs text-[var(--foreground)]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                    {localizeUi("ui.game.gamewidgetsetupeditor.side")}
                  </span>
                  <select
                    value={widget.position}
                    disabled={disabled}
                    onChange={(event) =>
                      replaceWidget(widget.id, {
                        position: event.target.value === "hud_right" ? "hud_right" : "hud_left",
                      })
                    }
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs text-[var(--foreground)]"
                  >
                    <option value="hud_left">{localizeUi("ui.game.gamewidgetsetupeditor.leftHud")}</option>
                    <option value="hud_right">{localizeUi("ui.game.gamewidgetsetupeditor.rightHud")}</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                    {localizeUi("ui.game.gamewidgetsetupeditor.accent")}
                  </span>
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(widget.accent ?? "") ? widget.accent : DEFAULT_ACCENTS[widget.type]}
                    disabled={disabled}
                    onChange={(event) => replaceWidget(widget.id, { accent: event.target.value })}
                    className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2 py-1"
                  />
                </label>
              </div>

              <WidgetConfigFields
                widget={widget}
                disabled={disabled}
                onConfigChange={(patch) => updateWidgetConfig(widget.id, patch)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WidgetConfigFields({
  widget,
  disabled,
  onConfigChange,
}: {
  widget: HudWidget;
  disabled?: boolean;
  onConfigChange: (patch: Partial<HudWidgetConfig>) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (widget.type === "progress_bar" || widget.type === "gauge" || widget.type === "relationship_meter") {
    const value = parseNumber(widget.config.value ?? widget.config.startingValue, 0, 0);
    const max = parseNumber(widget.config.max, 100, 1);
    return (
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.game.widgeteditormodal.value")}
          </span>
          <DraftNumberInput
            min={0}
            value={value}
            disabled={disabled}
            onCommit={(next) => {
              onConfigChange({ value: next, startingValue: next });
            }}
            selectOnFocus
            className={WIDGET_NUMBER_INPUT_CLASS}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.regexscripteditor.max")}
          </span>
          <DraftNumberInput
            min={1}
            value={max}
            disabled={disabled}
            onCommit={(next) => onConfigChange({ max: next })}
            selectOnFocus
            className={WIDGET_NUMBER_INPUT_CLASS}
          />
        </label>
      </div>
    );
  }

  if (widget.type === "counter") {
    return (
      <label className="mt-2 block space-y-1">
        <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
          {localizeUi("ui.game.widgeteditormodal.count")}
        </span>
        <DraftNumberInput
          value={parseNumber(widget.config.count, 0)}
          disabled={disabled}
          onCommit={(next) => onConfigChange({ count: Math.round(next) })}
          selectOnFocus
          className={WIDGET_NUMBER_INPUT_CLASS}
        />
      </label>
    );
  }

  if (widget.type === "stat_block") {
    const stats = Array.isArray(widget.config.stats) ? widget.config.stats : [];
    return (
      <div className="mt-2 space-y-2">
        {stats.map((stat, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto]">
            <input
              value={stat.name}
              disabled={disabled}
              onChange={(event) => {
                const next = stats.map((entry, entryIndex) =>
                  entryIndex === index ? { ...entry, name: event.target.value } : entry,
                );
                onConfigChange({ stats: next });
              }}
              placeholder={localizeUi("ui.game.widgeteditormodal.stat")}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs text-[var(--foreground)]"
            />
            <input
              value={String(stat.value ?? "")}
              disabled={disabled}
              onChange={(event) => {
                const next = stats.map((entry, entryIndex) =>
                  entryIndex === index ? { ...entry, value: event.target.value } : entry,
                );
                onConfigChange({ stats: next });
              }}
              placeholder={localizeUi("ui.game.widgeteditormodal.value")}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs text-[var(--foreground)]"
            />
            <button
              type="button"
              onClick={() => onConfigChange({ stats: stats.filter((_, entryIndex) => entryIndex !== index) })}
              disabled={disabled}
              className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--marinara-chat-chrome-accent)]/25 px-3 text-[var(--marinara-chat-chrome-accent)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg)] disabled:opacity-50"
              aria-label={localizeUi("ui.game.widgetconfigfields.removeStat")}
            >
              <Trash2 size="0.75rem" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onConfigChange({ stats: [...stats, { name: nextStatBlockName(stats), value: "" }] })}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
        >
          <Plus size="0.75rem" />
          <span>{localizeUi("ui.game.widgeteditormodal.addStat")}</span>
        </button>
      </div>
    );
  }

  if (widget.type === "list") {
    const items = Array.isArray(widget.config.items) ? widget.config.items : [];
    return (
      <ListItemsField items={items.map((item) => String(item))} disabled={disabled} onConfigChange={onConfigChange} />
    );
  }

  if (widget.type === "inventory_grid") {
    const contents = Array.isArray(widget.config.contents) ? widget.config.contents : [];
    return (
      <div className="mt-2 grid gap-2 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <label className="space-y-1">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.game.widgetconfigfields.slots")}
          </span>
          <DraftNumberInput
            min={1}
            value={parseNumber(widget.config.slots, 8, 1)}
            disabled={disabled}
            onCommit={(next) => onConfigChange({ slots: Math.round(next) })}
            selectOnFocus
            className={WIDGET_NUMBER_INPUT_CLASS}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.game.widgetconfigfields.contents")}
          </span>
          <textarea
            value={contents.map((item) => item.name).join("\n")}
            disabled={disabled}
            rows={3}
            onChange={(event) =>
              onConfigChange({
                contents: buildInventoryGridContentsFromText(event.target.value, contents),
              })
            }
            className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs text-[var(--foreground)]"
          />
        </label>
      </div>
    );
  }

  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <label className="space-y-1">
        <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
          {localizeUi("ui.game.widgetconfigfields.seconds")}
        </span>
        <DraftNumberInput
          min={0}
          value={parseNumber(widget.config.seconds, 60, 0)}
          disabled={disabled}
          onCommit={(next) => onConfigChange({ seconds: Math.round(next) })}
          selectOnFocus
          className={WIDGET_NUMBER_INPUT_CLASS}
        />
      </label>
      <label className="flex items-center gap-2 self-end rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)]">
        <input
          type="checkbox"
          checked={widget.config.running === true}
          disabled={disabled}
          onChange={(event) => onConfigChange({ running: event.target.checked })}
          className="h-4 w-4 rounded border-[var(--border)]"
        />
        {localizeUi("ui.game.widgetconfigfields.running")}
      </label>
    </div>
  );
}

function ListItemsField({
  items,
  disabled,
  onConfigChange,
}: {
  items: string[];
  disabled?: boolean;
  onConfigChange: (patch: Partial<HudWidgetConfig>) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const externalValue = items.join("\n");
  const [draft, setDraft] = useState(externalValue);

  useEffect(() => {
    setDraft(externalValue);
  }, [externalValue]);

  return (
    <label className="mt-2 block space-y-1">
      <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
        {localizeUi("ui.game.widgeteditormodal.items")}
      </span>
      <textarea
        value={draft}
        disabled={disabled}
        rows={3}
        onChange={(event) => {
          const nextDraft = event.target.value;
          const nextItems = parseListItemsDraft(nextDraft);
          setDraft(nextDraft);
          onConfigChange({ items: nextItems });
        }}
        className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs text-[var(--foreground)]"
      />
    </label>
  );
}
