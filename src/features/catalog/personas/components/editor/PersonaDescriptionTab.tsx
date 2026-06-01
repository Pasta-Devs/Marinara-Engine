import { useState } from "react";
import { Maximize2, Plus, Tag, X } from "lucide-react";
import { AvatarCropWidget } from "../../../../../shared/components/ui/AvatarCropWidget";
import { ExpandedTextarea } from "../../../../../shared/components/ui/ExpandedTextarea";
import { HelpTooltip } from "../../../../../shared/components/ui/HelpTooltip";
import { cn, generateClientId } from "../../../../../shared/lib/utils";
import type { AltDescriptionEntry, PersonaFormData } from "../../lib/persona-editor-model";

export function PersonaDescriptionTab({
  formData,
  updateField,
  avatarPreview,
}: {
  formData: PersonaFormData;
  updateField: <K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => void;
  avatarPreview: string | null;
}) {
  const altDescs = formData.altDescriptions;
  const [expandedField, setExpandedField] = useState<"description" | string | null>(null);
  const [newTag, setNewTag] = useState("");

  const addTag = () => {
    const tag = newTag.trim();
    if (!tag) return;
    if (formData.tags.includes(tag)) return;
    updateField("tags", [...formData.tags, tag]);
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    updateField(
      "tags",
      formData.tags.filter((t) => t !== tag),
    );
  };

  const updateAltDescs = (next: AltDescriptionEntry[]) => {
    updateField("altDescriptions", next);
  };

  const addAltDesc = () => {
    updateAltDescs([...altDescs, { id: generateClientId(), label: "Extension", content: "", active: true }]);
  };

  const toggleAltDesc = (id: string) => {
    updateAltDescs(
      altDescs.map((description) =>
        description.id === id ? { ...description, active: !description.active } : description,
      ),
    );
  };

  const updateAltDescField = (id: string, field: "label" | "content", value: string) => {
    updateAltDescs(
      altDescs.map((description) => (description.id === id ? { ...description, [field]: value } : description)),
    );
  };

  const removeAltDesc = (id: string) => {
    updateAltDescs(altDescs.filter((description) => description.id !== id));
  };

  return (
    <div className="space-y-6">
      {avatarPreview && (
        <AvatarCropWidget
          src={avatarPreview}
          alt={formData.name}
          crop={formData.avatarCrop}
          onChange={(next) => updateField("avatarCrop", next)}
        />
      )}

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Description</h3>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              Your general description. This is sent in every prompt so the AI knows who you are.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpandedField("description")}
            className="shrink-0 rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            title="Expand editor"
            aria-label="Expand description editor"
          >
            <Maximize2 size="0.875rem" />
          </button>
        </div>
        <textarea
          value={formData.description}
          onChange={(event) => updateField("description", event.target.value)}
          placeholder="Describe who you are, your role in the story, and your key traits…"
          rows={12}
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/20"
        />
        <p className="mt-1.5 text-right text-[0.625rem] text-[var(--muted-foreground)]">
          {formData.description.length} characters
        </p>
      </div>

      <div className="space-y-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
          Tags{" "}
          <HelpTooltip text="Labels for organizing personas. Use tags like 'fantasy', 'modern', 'OC' etc. to categorize and filter." />
        </span>
        <div className="flex flex-wrap gap-1.5">
          {formData.tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[0.6875rem] font-medium text-emerald-400"
            >
              <Tag size="0.625rem" />
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-0.5 rounded-full transition-colors hover:text-[var(--destructive)]"
                aria-label={`Remove tag ${tag}`}
              >
                <X size="0.625rem" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            value={newTag}
            onChange={(event) => setNewTag(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTag();
              }
            }}
            placeholder="Add tag…"
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-xs outline-none focus:border-emerald-400/40"
          />
          <button
            type="button"
            onClick={addTag}
            className="rounded-xl bg-emerald-400/15 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-all hover:bg-emerald-400/25"
          >
            Add
          </button>
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Description Extensions</h3>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              Toggleable additions appended to your main description. Use these for situational details like combat
              skills, relationships, or temporary states.
            </p>
          </div>
          <button
            type="button"
            onClick={addAltDesc}
            className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[0.6875rem] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/25"
          >
            <Plus size="0.75rem" />
            Add
          </button>
        </div>

        {altDescs.length === 0 ? (
          <p className="text-[0.6875rem] italic text-[var(--muted-foreground)]">
            No description extensions yet. Add one to toggle extra context on and off.
          </p>
        ) : (
          <div className="space-y-3">
            {altDescs.map((description) => (
              <div
                key={description.id}
                className={cn(
                  "rounded-xl border bg-[var(--card)] p-4 transition-all",
                  description.active
                    ? "border-emerald-400/30 ring-1 ring-emerald-400/10"
                    : "border-[var(--border)] opacity-60",
                )}
              >
                <div className="mb-3 flex items-center gap-2">
                  <label className="relative flex h-5 w-9 shrink-0 cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={description.active}
                      onChange={() => toggleAltDesc(description.id)}
                      className="peer sr-only"
                      aria-label={`${description.active ? "Disable" : "Enable"} ${description.label || "description extension"}`}
                    />
                    <span
                      className={cn(
                        "flex h-5 w-9 items-center rounded-full p-0.5 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400/60",
                        description.active ? "bg-emerald-500" : "bg-[var(--muted-foreground)]/30",
                      )}
                    >
                      <span
                        className={cn(
                          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                          description.active && "translate-x-4",
                        )}
                      />
                    </span>
                  </label>
                  <input
                    value={description.label}
                    onChange={(event) => updateAltDescField(description.id, "label", event.target.value)}
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2.5 py-1 text-xs font-medium outline-none focus:border-emerald-400/40"
                    placeholder="Label (e.g. Combat Skills)"
                  />
                  <button
                    type="button"
                    onClick={() => removeAltDesc(description.id)}
                    className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-red-500/15 hover:text-red-400"
                    title="Remove extension"
                    aria-label={`Remove ${description.label || "description extension"}`}
                  >
                    <X size="0.75rem" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedField(description.id)}
                    className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                    title="Expand editor"
                    aria-label={`Expand ${description.label || "description extension"} editor`}
                  >
                    <Maximize2 size="0.75rem" />
                  </button>
                </div>
                <textarea
                  value={description.content}
                  onChange={(event) => updateAltDescField(description.id, "content", event.target.value)}
                  placeholder="Additional description content…"
                  rows={4}
                  className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/20"
                />
                <p className="mt-1 text-right text-[0.625rem] text-[var(--muted-foreground)]">
                  {description.content.length} characters
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
        placeholder="Describe who you are, your role in the story, and your key traits…"
      />
      {altDescs.map((description) => (
        <ExpandedTextarea
          key={description.id}
          open={expandedField === description.id}
          onClose={() => setExpandedField(null)}
          title={description.label || "Description Extension"}
          value={description.content}
          onChange={(value) => updateAltDescField(description.id, "content", value)}
          placeholder="Additional description content…"
        />
      ))}
    </div>
  );
}
