import { BookOpen } from "lucide-react";
import type { EmbeddedLorebookImportPreview } from "../../../../shared/lib/character-import";

type CharacterImportLorebookPromptProps = {
  files: File[];
  previews: EmbeddedLorebookImportPreview[];
  onChoose: (files: File[], importEmbeddedLorebook: boolean) => void;
};

export function CharacterImportLorebookPrompt({ files, previews, onChoose }: CharacterImportLorebookPromptProps) {
  return (
    <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 p-4">
      <div className="flex items-start gap-3">
        <BookOpen className="mt-0.5 shrink-0 text-[var(--primary)]" size="1.125rem" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">Embedded lorebook found</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
            Import the embedded lorebook as a standalone Marinara lorebook, or keep it only inside the character card.
          </p>
          <div className="mt-3 max-h-32 overflow-y-auto rounded-lg border border-[var(--border)]/70 bg-[var(--background)]/40">
            {previews.map((preview) => (
              <div
                key={`${preview.filename}-${preview.name ?? ""}`}
                className="flex items-center justify-between gap-3 border-b border-[var(--border)]/60 px-3 py-2 text-xs last:border-b-0"
              >
                <span className="min-w-0 truncate font-medium">{preview.name ?? preview.filename}</span>
                <span className="shrink-0 text-[var(--muted-foreground)]">
                  {preview.embeddedLorebookEntries} {preview.embeddedLorebookEntries === 1 ? "entry" : "entries"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onChoose(files, false)}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            >
              No Import
            </button>
            <button
              type="button"
              onClick={() => onChoose(files, true)}
              className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
            >
              Import Lorebook
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
