import type { ReactNode } from "react";
import { Plus, X } from "lucide-react";

import {
  createDefaultRpgStatPools,
  syncRpgHpFromPools,
  type RPGStatsConfig,
  type RPGStatPool,
} from "@marinara-engine/shared";

export const DEFAULT_RPG_STATS: RPGStatsConfig = {
  enabled: false,
  attributes: [
    { name: "STR", value: 10 },
    { name: "DEX", value: 10 },
    { name: "CON", value: 10 },
    { name: "INT", value: 10 },
    { name: "WIS", value: 10 },
    { name: "CHA", value: 10 },
  ],
  hp: { value: 100, max: 100 },
  pools: createDefaultRpgStatPools(),
};

export interface CardRpgFieldsLabels {
  pools: string;
  attributes: string;
  add: string;
  name: string;
  poolFallback: string;
  removePoolFallback: string;
  poolAria: {
    color: (name: string) => string;
    value: (name: string) => string;
    max: (name: string) => string;
    remove: (name: string) => string;
  };
}

export interface CardRpgPoolIcons {
  render: (pool: RPGStatPool, index: number) => ReactNode;
  onRemap?: (previousPools: RPGStatPool[], nextPools: RPGStatPool[], mapIndex: (nextIndex: number) => number) => void;
}

export interface CardRpgFieldsProps {
  attributes: RPGStatsConfig["attributes"];
  pools: RPGStatPool[];
  hp: RPGStatsConfig["hp"];
  onChange: (patch: Partial<RPGStatsConfig>) => void;
  labels: CardRpgFieldsLabels;
  /** Character commits a trimmed name on blur; Persona edits live. */
  poolNameMode?: "draft" | "live";
  onDraftChange?: () => void;
  poolIcons?: CardRpgPoolIcons;
  poolsClassName?: string;
  attributesClassName?: string;
}

function createNewRpgPool(existing: readonly RPGStatPool[]): RPGStatPool {
  const used = new Set(existing.map((pool) => pool.name.trim().toLowerCase()).filter(Boolean));
  let index = existing.length + 1;
  let name = `Pool ${index}`;
  while (used.has(name.toLowerCase())) {
    name = `Pool ${++index}`;
  }
  return { name, value: 100, max: 100, color: "#a78bfa" };
}

export function CardRpgFields({
  attributes,
  pools,
  hp,
  onChange,
  labels,
  poolNameMode = "live",
  onDraftChange,
  poolIcons,
  poolsClassName = "space-y-3",
  attributesClassName = "space-y-3",
}: CardRpgFieldsProps) {
  const replacePools = (nextPools: RPGStatPool[]) => {
    onChange({ pools: nextPools, hp: syncRpgHpFromPools(nextPools, hp) });
  };

  const addPool = () => {
    replacePools([...pools, createNewRpgPool(pools)]);
  };

  const updatePool = (index: number, patch: Partial<RPGStatPool>) => {
    const nextPools = pools.map((pool, poolIndex) => (poolIndex === index ? { ...pool, ...patch } : pool));
    if (typeof patch.name === "string" && patch.name !== pools[index]?.name) {
      poolIcons?.onRemap?.(pools, nextPools, (nextIndex) => nextIndex);
    }
    replacePools(nextPools);
  };

  const removePool = (index: number) => {
    const nextPools = pools.filter((_, poolIndex) => poolIndex !== index);
    poolIcons?.onRemap?.(pools, nextPools, (nextIndex) => (nextIndex < index ? nextIndex : nextIndex + 1));
    replacePools(nextPools);
  };

  const updateAttributeName = (index: number, name: string) => {
    onChange({
      attributes: attributes.map((attribute, attributeIndex) =>
        attributeIndex === index ? { ...attribute, name } : attribute,
      ),
    });
  };

  const updateAttributeValue = (index: number, value: number) => {
    onChange({
      attributes: attributes.map((attribute, attributeIndex) =>
        attributeIndex === index ? { ...attribute, value } : attribute,
      ),
    });
  };

  const addAttribute = () => {
    onChange({ attributes: [...attributes, { name: "NEW", value: 10 }] });
  };

  const removeAttribute = (index: number) => {
    onChange({ attributes: attributes.filter((_, attributeIndex) => attributeIndex !== index) });
  };

  return (
    <>
      {/* Pools */}
      <div className={poolsClassName}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{labels.pools}</h3>
          <button
            type="button"
            onClick={addPool}
            className="mari-chrome-accent-surface mari-accent-animated flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
          >
            <Plus size="0.75rem" />
            {labels.add}
          </button>
        </div>
        <div className="space-y-2">
          {pools.map((pool, i) => (
            <div
              key={i}
              className={
                poolIcons
                  ? "grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 sm:grid-cols-[2rem_2rem_minmax(0,1fr)_5rem_5rem_auto] sm:items-center"
                  : "grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 sm:grid-cols-[2rem_minmax(0,1fr)_5rem_5rem_auto] sm:items-center"
              }
            >
              <input
                type="color"
                value={pool.color}
                onChange={(e) => updatePool(i, { color: e.target.value })}
                className="h-8 w-8 rounded border border-[var(--border)] bg-transparent p-0.5"
                aria-label={labels.poolAria.color(pool.name || labels.poolFallback)}
              />
              {poolIcons?.render(pool, i)}
              {poolNameMode === "draft" ? (
                <input
                  key={pool.name}
                  defaultValue={pool.name}
                  onChange={onDraftChange}
                  onBlur={(e) => {
                    const name = e.currentTarget.value.trim() || pool.name;
                    e.currentTarget.value = name;
                    if (name !== pool.name) updatePool(i, { name });
                  }}
                  className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs font-medium"
                  placeholder={labels.name}
                />
              ) : (
                <input
                  value={pool.name}
                  onChange={(e) => updatePool(i, { name: e.target.value })}
                  className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs font-medium"
                  placeholder={labels.name}
                />
              )}
              <input
                type="number"
                value={pool.value}
                onChange={(e) => updatePool(i, { value: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-center text-xs"
                min={0}
                aria-label={labels.poolAria.value(pool.name || labels.poolFallback)}
              />
              <input
                type="number"
                value={pool.max}
                onChange={(e) => updatePool(i, { max: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-center text-xs"
                min={1}
                aria-label={labels.poolAria.max(pool.name || labels.poolFallback)}
              />
              <button
                type="button"
                onClick={() => removePool(i)}
                className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]"
                aria-label={labels.poolAria.remove(pool.name || labels.removePoolFallback)}
              >
                <X size="0.75rem" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Attributes */}
      <div className={attributesClassName}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{labels.attributes}</h3>
          <button
            type="button"
            onClick={addAttribute}
            className="mari-chrome-accent-surface mari-accent-animated flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
          >
            <Plus size="0.75rem" />
            {labels.add}
          </button>
        </div>

        <div className="space-y-2">
          {attributes.map((attr, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2"
            >
              <input
                value={attr.name}
                onChange={(e) => updateAttributeName(i, e.target.value)}
                className="w-20 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs font-medium"
                placeholder={labels.name}
              />
              <input
                type="number"
                value={attr.value}
                onChange={(e) => updateAttributeValue(i, parseInt(e.target.value) || 0)}
                className="w-16 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-center text-xs"
              />
              <button
                type="button"
                onClick={() => removeAttribute(i)}
                className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]"
              >
                <X size="0.75rem" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
