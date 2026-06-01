import { useState } from "react";
import { Maximize2, Plus, X } from "lucide-react";

import type { CharacterData } from "../../../../engine/contracts/types/character";
import { ExpandedTextarea } from "../../../../shared/components/ui/ExpandedTextarea";
import { cn, generateClientId } from "../../../../shared/lib/utils";
import { normalizeAltDescriptions, type AltDescriptionEntry } from "../lib/character-editor-model";
import { CharacterEditorSectionHeader as SectionHeader } from "./CharacterEditorSectionHeader";

export function CharacterDescriptionTab({
  formData,
  updateField,
  updateExtension,
}: {
  formData: CharacterData;
  updateField: <K extends keyof CharacterData>(key: K, value: CharacterData[K]) => void;
  updateExtension: (key: string, value: unknown) => void;
}) {
  const altDescs = normalizeAltDescriptions(formData.extensions?.altDescriptions);
  const [expandedField, setExpandedField] = useState<"description" | string | null>(null);

  const updateAltDescs = (next: AltDescriptionEntry[]) => {
    updateExtension("altDescriptions", next);
  };

  const addAltDesc = () => {
    updateAltDescs([...altDescs, { id: generateClientId(), label: "Extension", content: "", active: true }]);
  };

  const toggleAltDesc = (id: string) => {
    updateAltDescs(altDescs.map((desc) => (desc.id === id ? { ...desc, active: !desc.active } : desc)));
  };

  const updateAltDescField = (id: string, field: "label" | "content", value: string) => {
    updateAltDescs(altDescs.map((desc) => (desc.id === id ? { ...desc, [field]: value } : desc)));
  };

  const removeAltDesc = (id: string) => {
    updateAltDescs(altDescs.filter((desc) => desc.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-2 mb-4">
          <SectionHeader
            title="Description"
            subtitle="The character's general description. This is sent in every prompt as part of the character's identity."
          />
          <button
            type="button"
            onClick={() => setExpandedField("description")}
            className="mt-0.5 shrink-0 rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            title="Expand editor"
          >
            <Maximize2 size="0.875rem" />
          </button>
        </div>
        <textarea
          value={formData.description}
          onChange={(event) => updateField("description", event.target.value)}
          placeholder="Describe who this character is, their role, and their key traits…"
          rows={12}
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
        />
        <p className="mt-1.5 text-right text-[0.625rem] text-[var(--muted-foreground)]">
          {formData.description.length} characters
        </p>
      </div>

      <div>
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Description Extensions</h3>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              Toggleable additions appended to this character's main description. Use these for situational states,
              relationships, combat details, or story-phase context.
            </p>
          </div>
          <button
            type="button"
            onClick={addAltDesc}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--primary)]/15 px-2.5 py-1 text-[0.6875rem] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/25"
          >
            <Plus size="0.75rem" />
            Add
          </button>
        </div>

        {altDescs.length === 0 ? (
          <p className="text-[0.6875rem] italic text-[var(--muted-foreground)]">
            No description extensions yet. Add one to toggle extra character context on and off.
          </p>
        ) : (
          <div className="space-y-3">
            {altDescs.map((desc) => (
              <div
                key={desc.id}
                className={cn(
                  "rounded-xl border bg-[var(--card)] p-4 transition-all",
                  desc.active
                    ? "border-[var(--primary)]/30 ring-1 ring-[var(--primary)]/10"
                    : "border-[var(--border)] opacity-60",
                )}
              >
                <div className="mb-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAltDesc(desc.id)}
                    className={cn(
                      "flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
                      desc.active ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/30",
                    )}
                    title={desc.active ? "Disable extension" : "Enable extension"}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full bg-[var(--primary-foreground)] shadow-sm transition-transform",
                        desc.active && "translate-x-4",
                      )}
                    />
                  </button>
                  <input
                    value={desc.label}
                    onChange={(event) => updateAltDescField(desc.id, "label", event.target.value)}
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2.5 py-1 text-xs font-medium outline-none focus:border-[var(--primary)]/40"
                    placeholder="Label (e.g. Combat Skills)"
                  />
                  <button
                    type="button"
                    onClick={() => removeAltDesc(desc.id)}
                    className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                    title="Remove extension"
                  >
                    <X size="0.75rem" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedField(desc.id)}
                    className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    title="Expand editor"
                  >
                    <Maximize2 size="0.75rem" />
                  </button>
                </div>
                <textarea
                  value={desc.content}
                  onChange={(event) => updateAltDescField(desc.id, "content", event.target.value)}
                  placeholder="Additional description content…"
                  rows={4}
                  className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
                />
                <p className="mt-1 text-right text-[0.625rem] text-[var(--muted-foreground)]">
                  {desc.content.length} characters
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <ExpandedTextarea
        open={expandedField === "description"}
        onClose={() => setExpandedField(null)}
        title="Description"
        value={formData.description}
        onChange={(value) => updateField("description", value)}
        placeholder="Describe who this character is, their role, and their key traits…"
      />
      {altDescs.map((desc) => (
        <ExpandedTextarea
          key={desc.id}
          open={expandedField === desc.id}
          onClose={() => setExpandedField(null)}
          title={desc.label || "Description Extension"}
          value={desc.content}
          onChange={(value) => updateAltDescField(desc.id, "content", value)}
          placeholder="Additional description content…"
        />
      ))}
    </div>
  );
}
