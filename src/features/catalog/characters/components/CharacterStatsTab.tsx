import { useRef } from "react";
import { Plus, X } from "lucide-react";
import type { CharacterData, RPGStatsConfig } from "../../../../engine/contracts/types/character";
import { generateClientId } from "../../../../shared/lib/utils";
import { DEFAULT_RPG_STATS } from "../lib/character-editor-model";
import { CharacterEditorSectionHeader } from "./CharacterEditorSectionHeader";

export function CharacterStatsTab({
  formData,
  updateExtension,
}: {
  formData: CharacterData;
  updateExtension: (key: string, value: unknown) => void;
}) {
  const stats: RPGStatsConfig = (formData.extensions.rpgStats as RPGStatsConfig) ?? DEFAULT_RPG_STATS;
  const attributeKeysRef = useRef<string[]>([]);
  while (attributeKeysRef.current.length < stats.attributes.length) {
    attributeKeysRef.current.push(generateClientId());
  }
  if (attributeKeysRef.current.length > stats.attributes.length) {
    attributeKeysRef.current.length = stats.attributes.length;
  }

  const update = (patch: Partial<RPGStatsConfig>) => {
    updateExtension("rpgStats", { ...stats, ...patch });
  };

  const updateAttribute = (index: number, field: string, value: string | number) => {
    const next = [...stats.attributes];
    next[index] = { ...next[index], [field]: value };
    update({ attributes: next });
  };

  const addAttribute = () => {
    attributeKeysRef.current.push(generateClientId());
    update({ attributes: [...stats.attributes, { name: "NEW", value: 10 }] });
  };

  const removeAttribute = (index: number) => {
    attributeKeysRef.current.splice(index, 1);
    update({ attributes: stats.attributes.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <CharacterEditorSectionHeader
        title="RPG Stats"
        subtitle="Toggle stat tracking for this character. When enabled, the character's stats are included in the prompt and tracked by agents."
      />

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <input
          type="checkbox"
          checked={stats.enabled}
          onChange={(event) => update({ enabled: event.target.checked })}
          className="h-4 w-4 rounded accent-purple-500"
        />
        <div>
          <p className="text-sm font-medium">Enable RPG Stats</p>
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            Stats will be injected into the prompt and tracked by the Character Tracker agent.
          </p>
        </div>
      </label>

      {stats.enabled && (
        <>
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-xs font-semibold">Hit Points (HP)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--muted-foreground)]">Max:</span>
              <input
                type="number"
                value={stats.hp.max}
                onChange={(event) => update({ hp: { ...stats.hp, max: parseInt(event.target.value) || 1 } })}
                className="w-20 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-center text-sm"
                min={1}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Attributes</h3>
              <button
                type="button"
                onClick={addAttribute}
                className="flex items-center gap-1 rounded-lg bg-purple-500/15 px-2.5 py-1 text-[0.6875rem] font-medium text-purple-400 transition-colors hover:bg-purple-500/25"
              >
                <Plus size="0.75rem" />
                Add
              </button>
            </div>

            <div className="space-y-2">
              {stats.attributes.map((attr, index) => (
                <div
                  key={attributeKeysRef.current[index]}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2"
                >
                  <input
                    value={attr.name}
                    onChange={(event) => updateAttribute(index, "name", event.target.value)}
                    className="w-20 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs font-medium"
                    placeholder="Name"
                  />
                  <input
                    type="number"
                    value={attr.value}
                    onChange={(event) => updateAttribute(index, "value", parseInt(event.target.value) || 0)}
                    className="w-16 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-center text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttribute(index)}
                    className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-red-500/15 hover:text-red-400"
                  >
                    <X size="0.75rem" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-[var(--card)] p-4 ring-1 ring-[var(--border)]">
            <h4 className="mb-1.5 text-xs font-semibold">How stats work</h4>
            <ul className="space-y-1 text-[0.6875rem] text-[var(--muted-foreground)]">
              <li>
                &bull; <strong className="text-[var(--foreground)]">HP</strong> — Injected into the prompt so the AI
                knows the character&apos;s current health.
              </li>
              <li>
                &bull; <strong className="text-[var(--foreground)]">Attributes</strong> — Custom stats (STR, DEX, etc.)
                that define the character&apos;s capabilities.
              </li>
              <li>
                &bull; The Character Tracker agent adjusts these values based on narrative events (combat, healing,
                etc.).
              </li>
              <li>&bull; Values set here serve as the initial/default state for new conversations.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
