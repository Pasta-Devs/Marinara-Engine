import { CheckCircle, Loader2, Save, User } from "lucide-react";
import type { GeneratedCharacterData } from "../lib/character-maker-model";

type CharacterMakerGeneratedPreviewProps = {
  generated: GeneratedCharacterData;
  confirmedName: string;
  onConfirmedNameChange: (name: string) => void;
  saving: boolean;
  onSave: () => void;
};

export function CharacterMakerGeneratedPreview({
  generated,
  confirmedName,
  onConfirmedNameChange,
  saving,
  onSave,
}: CharacterMakerGeneratedPreviewProps) {
  return (
    <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="flex items-center gap-2">
        <CheckCircle size="0.875rem" className="text-emerald-500" />
        <span className="text-xs font-medium text-emerald-500">Character Generated!</span>
      </div>

      <div className="flex items-start gap-3 rounded-xl bg-[var(--card)] p-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 to-purple-500 shadow-md">
          <User size="1.25rem" className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="character-maker-confirmed-name">
            Confirm character name
          </label>
          <input
            id="character-maker-confirmed-name"
            value={confirmedName}
            onChange={(e) => onConfirmedNameChange(e.target.value)}
            className="w-full rounded-lg border border-transparent bg-transparent px-0 py-0 text-sm font-bold outline-none transition-colors focus:border-[var(--primary)]/30 focus:bg-[var(--secondary)] focus:px-2 focus:py-1"
          />
          <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted-foreground)]">
            {generated.description?.slice(0, 200)}
          </p>
          {generated.tags && generated.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {generated.tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[0.625rem] font-medium text-[var(--primary)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-2 text-xs">
        {generated.personality && <PreviewSection label="Personality" text={generated.personality} />}
        {generated.backstory && <PreviewSection label="Backstory" text={generated.backstory} />}
        {generated.appearance && <PreviewSection label="Appearance" text={generated.appearance} />}
        {generated.first_mes && <PreviewSection label="First Message" text={generated.first_mes} />}
      </div>

      <button
        onClick={onSave}
        disabled={saving || !confirmedName.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-400 to-purple-500 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-pink-500/20 transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
      >
        {saving ? (
          <>
            <Loader2 size="0.9375rem" className="animate-spin" />
            Saving…
          </>
        ) : (
          <>
            <Save size="0.9375rem" />
            Save & Edit Character
          </>
        )}
      </button>
    </div>
  );
}

function PreviewSection({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg bg-[var(--secondary)] p-2.5">
      <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
      </span>
      <p className="mt-1 line-clamp-3 text-[var(--foreground)]">{text}</p>
    </div>
  );
}
