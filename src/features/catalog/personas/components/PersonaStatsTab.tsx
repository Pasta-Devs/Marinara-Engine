import { Plus, X } from "lucide-react";
import {
  DEFAULT_PERSONA_STATS,
  DEFAULT_RPG_STATS,
  type PersonaFormData,
  type PersonaRPGStats,
  type PersonaStatsData,
} from "../lib/persona-editor-model";
import { PersonaEditorSectionHeader } from "./PersonaEditorSectionHeader";

export function PersonaStatsTab({
  formData,
  updateField,
}: {
  formData: PersonaFormData;
  updateField: <K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => void;
}) {
  const parsed: PersonaStatsData = formData.personaStats ?? DEFAULT_PERSONA_STATS;

  const save = (next: PersonaStatsData) => {
    updateField("personaStats", next);
  };

  const updateBar = (index: number, field: string, value: string | number) => {
    const next = [...parsed.bars];
    next[index] = { ...next[index], [field]: value };
    save({ ...parsed, bars: next });
  };

  const addBar = () => {
    save({ ...parsed, bars: [...parsed.bars, { name: "New Stat", value: 100, max: 100, color: "#8b5cf6" }] });
  };

  const removeBar = (index: number) => {
    save({ ...parsed, bars: parsed.bars.filter((_, i) => i !== index) });
  };

  const rpgStats: PersonaRPGStats = parsed.rpgStats ?? DEFAULT_RPG_STATS;

  const updateRpg = (patch: Partial<PersonaRPGStats>) => {
    save({ ...parsed, rpgStats: { ...rpgStats, ...patch } });
  };

  const updateRpgAttribute = (index: number, field: string, value: string | number) => {
    const next = [...rpgStats.attributes];
    next[index] = { ...next[index], [field]: value };
    updateRpg({ attributes: next });
  };

  const addRpgAttribute = () => {
    updateRpg({ attributes: [...rpgStats.attributes, { name: "NEW", value: 10 }] });
  };

  const removeRpgAttribute = (index: number) => {
    updateRpg({ attributes: rpgStats.attributes.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <PersonaEditorSectionHeader
        title="Persona Status Bars"
        subtitle="Track your persona's physical and mental needs. These are updated by the Persona Stats agent after each message."
      />

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <input
          type="checkbox"
          checked={parsed.enabled}
          onChange={(e) => save({ ...parsed, enabled: e.target.checked })}
          className="h-4 w-4 rounded accent-emerald-500"
        />
        <div>
          <p className="text-sm font-medium">Enable Persona Stats</p>
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            Tracked by the Persona Stats agent. Stats appear in the HUD and are adjusted based on narrative events.
          </p>
        </div>
      </label>

      {parsed.enabled && (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Status Bars</h3>
              <button
                type="button"
                onClick={addBar}
                className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[0.6875rem] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/25"
              >
                <Plus size="0.75rem" />
                Add
              </button>
            </div>

            <div className="space-y-2">
              {parsed.bars.map((bar, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={bar.color}
                      onChange={(e) => updateBar(i, "color", e.target.value)}
                      className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent"
                    />
                    <input
                      value={bar.name}
                      onChange={(e) => updateBar(i, "name", e.target.value)}
                      className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs font-medium"
                      placeholder="Stat name"
                    />
                    <span className="text-[0.625rem] text-[var(--muted-foreground)]">max:</span>
                    <input
                      type="number"
                      value={bar.max}
                      onChange={(e) => updateBar(i, "max", parseInt(e.target.value) || 1)}
                      className="w-14 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-center text-xs"
                      min={1}
                    />
                    <button
                      type="button"
                      onClick={() => removeBar(i)}
                      className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-red-500/15 hover:text-red-400"
                    >
                      <X size="0.75rem" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-[var(--card)] p-4 ring-1 ring-[var(--border)]">
            <h4 className="mb-1.5 text-xs font-semibold">How persona stats work</h4>
            <ul className="space-y-1 text-[0.6875rem] text-[var(--muted-foreground)]">
              <li>
                &bull; <strong className="text-[var(--foreground)]">Status bars</strong> — Represent your persona&apos;s
                physical and mental state (hunger, energy, hygiene, etc.)
              </li>
              <li>
                &bull; The <strong className="text-[var(--foreground)]">Persona Stats agent</strong> adjusts values
                realistically based on what happens in the narrative.
              </li>
              <li>
                &bull; Bars are displayed in the <strong className="text-[var(--foreground)]">HUD widget</strong> during
                chat with color-coded gradients.
              </li>
              <li>&bull; Values set here serve as the initial defaults for new conversations.</li>
            </ul>
          </div>
        </>
      )}

      <div className="border-t border-[var(--border)] pt-6">
        <PersonaEditorSectionHeader
          title="RPG Attributes"
          subtitle="Define your persona's RPG stats (STR, DEX, etc.) and HP — just like character cards. Tracked via Persona Stats in the game state."
        />

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <input
            type="checkbox"
            checked={rpgStats.enabled}
            onChange={(e) => updateRpg({ enabled: e.target.checked })}
            className="h-4 w-4 rounded accent-purple-500"
          />
          <div>
            <p className="text-sm font-medium">Enable RPG Attributes</p>
            <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
              Attributes are injected into the prompt and tracked via Persona Stats in the game state.
            </p>
          </div>
        </label>

        {rpgStats.enabled && (
          <>
            <div className="mt-4 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-xs font-semibold">Hit Points (HP)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted-foreground)]">Max:</span>
                <input
                  type="number"
                  value={rpgStats.hp.max}
                  onChange={(e) => updateRpg({ hp: { ...rpgStats.hp, max: parseInt(e.target.value) || 1 } })}
                  className="w-20 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-center text-sm"
                  min={1}
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Attributes</h3>
                <button
                  type="button"
                  onClick={addRpgAttribute}
                  className="flex items-center gap-1 rounded-lg bg-purple-500/15 px-2.5 py-1 text-[0.6875rem] font-medium text-purple-400 transition-colors hover:bg-purple-500/25"
                >
                  <Plus size="0.75rem" />
                  Add
                </button>
              </div>

              <div className="space-y-2">
                {rpgStats.attributes.map((attr, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2"
                  >
                    <input
                      value={attr.name}
                      onChange={(e) => updateRpgAttribute(i, "name", e.target.value)}
                      className="w-20 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs font-medium"
                      placeholder="Name"
                    />
                    <input
                      type="number"
                      value={attr.value}
                      onChange={(e) => updateRpgAttribute(i, "value", parseInt(e.target.value) || 0)}
                      className="w-16 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-center text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeRpgAttribute(i)}
                      className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-red-500/15 hover:text-red-400"
                    >
                      <X size="0.75rem" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-[var(--card)] p-4 ring-1 ring-[var(--border)]">
              <h4 className="mb-1.5 text-xs font-semibold">How RPG attributes work</h4>
              <ul className="space-y-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                <li>
                  &bull; <strong className="text-[var(--foreground)]">HP</strong> — Injected into the prompt so the AI
                  knows your persona&apos;s current health.
                </li>
                <li>
                  &bull; <strong className="text-[var(--foreground)]">Attributes</strong> — Custom stats (STR, DEX,
                  etc.) that define your persona&apos;s capabilities.
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
    </div>
  );
}
