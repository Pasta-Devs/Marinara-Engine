import { useState } from "react";
import { Maximize2 } from "lucide-react";

import { ExpandedTextarea } from "../../../../shared/components/ui/ExpandedTextarea";
import { CharacterEditorSectionHeader as SectionHeader } from "./CharacterEditorSectionHeader";

export function CharacterTextareaTab({
  title,
  subtitle,
  value,
  onChange,
  placeholder,
  rows = 8,
}: {
  title: string;
  subtitle: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div className="flex items-start justify-between gap-2 mb-4">
        <SectionHeader title={title} subtitle={subtitle} />
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-0.5 shrink-0 rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          title="Expand editor"
        >
          <Maximize2 size="0.875rem" />
        </button>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
      />
      <p className="mt-1.5 text-right text-[0.625rem] text-[var(--muted-foreground)]">{value.length} characters</p>
      <ExpandedTextarea
        open={expanded}
        onClose={() => setExpanded(false)}
        title={title}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
}
