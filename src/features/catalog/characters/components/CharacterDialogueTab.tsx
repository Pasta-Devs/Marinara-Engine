import { useState } from "react";
import { Maximize2, Trash2 } from "lucide-react";

import type { CharacterData } from "../../../../engine/contracts/types/character";
import { ExpandedTextarea } from "../../../../shared/components/ui/ExpandedTextarea";
import { HelpTooltip } from "../../../../shared/components/ui/HelpTooltip";
import { CharacterEditorSectionHeader as SectionHeader } from "./CharacterEditorSectionHeader";

export function CharacterDialogueTab({
  formData,
  updateField,
}: {
  formData: CharacterData;
  updateField: <K extends keyof CharacterData>(key: K, value: CharacterData[K]) => void;
}) {
  const [expandedField, setExpandedField] = useState<"first_mes" | "mes_example" | number | null>(null);

  const addGreeting = () => {
    updateField("alternate_greetings", [...formData.alternate_greetings, ""]);
  };

  const updateGreeting = (i: number, value: string) => {
    const copy = [...formData.alternate_greetings];
    copy[i] = value;
    updateField("alternate_greetings", copy);
  };

  const removeGreeting = (i: number) => {
    updateField(
      "alternate_greetings",
      formData.alternate_greetings.filter((_, idx) => idx !== i),
    );
    setExpandedField((current) => (typeof current === "number" && current >= i ? null : current));
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dialogue & Greetings"
        subtitle="First message, example dialogue, and alternate greetings."
      />

      <label className="block space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            First Message{" "}
            <HelpTooltip text="The character's opening message when a new chat starts. Good first messages set the scene and establish the character's voice." />
          </span>
          <button
            type="button"
            onClick={() => setExpandedField("first_mes")}
            className="shrink-0 rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            title="Expand editor"
          >
            <Maximize2 size="0.875rem" />
          </button>
        </div>
        <textarea
          value={formData.first_mes}
          onChange={(e) => updateField("first_mes", e.target.value)}
          rows={6}
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm leading-relaxed outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder="What does the character say when they first meet someone? Use *asterisks* for actions…"
        />
      </label>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Alternate Greetings ({formData.alternate_greetings.length})
            <HelpTooltip text="Alternative first messages for variety. When starting a new chat, you can pick which greeting to use." />
          </span>
          <button
            type="button"
            onClick={addGreeting}
            className="rounded-xl bg-[var(--primary)]/15 px-3 py-1 text-xs font-medium text-[var(--primary)] transition-all hover:bg-[var(--primary)]/25"
          >
            + Add
          </button>
        </div>
        {formData.alternate_greetings.map((g, i) => (
          <div key={i} className="relative">
            <textarea
              value={g}
              onChange={(e) => updateGreeting(i, e.target.value)}
              rows={3}
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 pr-16 text-sm outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40"
              placeholder={`Greeting #${i + 1}…`}
            />
            <div className="absolute right-2 top-2 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setExpandedField(i)}
                className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                title="Expand editor"
              >
                <Maximize2 size="0.75rem" />
              </button>
              <button
                type="button"
                onClick={() => removeGreeting(i)}
                className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:text-[var(--destructive)]"
              >
                <Trash2 size="0.75rem" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <label className="block space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Example Dialogue{" "}
            <HelpTooltip text="Sample conversations showing how the character talks. Helps the AI learn the character's speaking style, vocabulary, and mannerisms." />
          </span>
          <button
            type="button"
            onClick={() => setExpandedField("mes_example")}
            className="shrink-0 rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            title="Expand editor"
          >
            <Maximize2 size="0.875rem" />
          </button>
        </div>
        <p className="text-[0.625rem] text-[var(--muted-foreground)]/70">
          {"Use <START> to separate exchanges. Use {{user}} and {{char}} as placeholders."}
        </p>
        <textarea
          value={formData.mes_example}
          onChange={(e) => updateField("mes_example", e.target.value)}
          rows={10}
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 font-mono text-xs leading-relaxed outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder={"<START>\n{{user}}: Hello!\n{{char}}: *waves excitedly* Hey there!"}
        />
      </label>

      <ExpandedTextarea
        open={expandedField === "first_mes"}
        onClose={() => setExpandedField(null)}
        title="First Message"
        value={formData.first_mes}
        onChange={(value) => updateField("first_mes", value)}
        placeholder="What does the character say when they first meet someone? Use *asterisks* for actions…"
      />
      <ExpandedTextarea
        open={expandedField === "mes_example"}
        onClose={() => setExpandedField(null)}
        title="Example Dialogue"
        value={formData.mes_example}
        onChange={(value) => updateField("mes_example", value)}
        placeholder={"<START>\n{{user}}: Hello!\n{{char}}: *waves excitedly* Hey there!"}
      />
      {formData.alternate_greetings.map((g, i) => (
        <ExpandedTextarea
          key={i}
          open={expandedField === i}
          onClose={() => setExpandedField(null)}
          title={`Alternate Greeting #${i + 1}`}
          value={g}
          onChange={(value) => updateGreeting(i, value)}
          placeholder={`Greeting #${i + 1}…`}
        />
      ))}
    </div>
  );
}
