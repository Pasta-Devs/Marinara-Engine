// ──────────────────────────────────────────────
// ImageReadingSettings — the Image reading job's own settings: what the reading Model is told, what it is asked
// with each picture, and how long and how varied its answer may be. Engine-wide; a chat can still use its own
// prompt in Chat settings › Advanced Parameters.
// ──────────────────────────────────────────────
import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_IMAGE_CAPTIONING_MAX_TOKENS,
  DEFAULT_IMAGE_CAPTIONING_PROMPT,
  DEFAULT_IMAGE_CAPTIONING_REQUEST,
  DEFAULT_IMAGE_CAPTIONING_TEMPERATURE,
  type ImageReadingSettings as Settings,
} from "@marinara-engine/shared";
import { useImageReadingSettings, useSetImageReadingSettings } from "../../hooks/use-image-reading-settings";
import { DraftTextarea } from "../ui/DraftTextarea";
import { DraftNumberInput } from "../ui/DraftNumberInput";

const LABEL = "text-xs font-medium text-[var(--muted-foreground)]";
const HINT = "text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]";
const FIELD = "mari-chrome-field w-full px-3 text-xs";

function ResetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex items-center justify-center rounded-lg bg-[var(--secondary)] px-2 py-1 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
    >
      <RotateCcw size="0.625rem" aria-hidden />
    </button>
  );
}

/** One prompt box: shows the built-in text until changed; clearing it or matching the built-in text resets it. */
function PromptField({
  label,
  hint,
  resetLabel,
  value,
  builtIn,
  rows,
  onSave,
}: {
  label: string;
  hint: string;
  resetLabel: string;
  value: string | null;
  builtIn: string;
  rows: number;
  onSave: (value: string | null) => void;
}) {
  const custom = value?.trim() ? value : null;
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <span className={LABEL}>{label}</span>
        {custom && <ResetButton label={resetLabel} onClick={() => onSave(null)} />}
      </div>
      <DraftTextarea
        aria-label={label}
        value={custom ?? builtIn}
        onCommit={(next) => {
          const trimmed = next.trim();
          onSave(trimmed && trimmed !== builtIn.trim() ? next : null);
        }}
        rows={rows}
        spellCheck={false}
        className={`${FIELD} resize-y py-2 leading-relaxed`}
      />
      <p className={HINT}>{hint}</p>
    </div>
  );
}

export function ImageReadingSettings() {
  const { t } = useTranslation();
  const { data } = useImageReadingSettings();
  const save = useSetImageReadingSettings();
  if (!data) return null;
  const set = (changes: Partial<Settings>) => save.mutate(changes);
  return (
    <div className="flex flex-col gap-4">
      <PromptField
        label={t("connections.imageReading.prompt")}
        hint={t("connections.imageReading.promptHint")}
        resetLabel={t("connections.imageReading.reset")}
        value={data.prompt}
        builtIn={DEFAULT_IMAGE_CAPTIONING_PROMPT}
        rows={6}
        onSave={(prompt) => set({ prompt })}
      />
      <PromptField
        label={t("connections.imageReading.request")}
        hint={t("connections.imageReading.requestHint", {
          filename: "{{filename}}",
          interpolation: { escapeValue: false },
        })}
        resetLabel={t("connections.imageReading.reset")}
        value={data.request}
        builtIn={DEFAULT_IMAGE_CAPTIONING_REQUEST}
        rows={3}
        onSave={(request) => set({ request })}
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className={LABEL}>{t("connections.imageReading.maxTokens")}</span>
          <DraftNumberInput
            allowEmpty
            ariaLabel={t("connections.imageReading.maxTokens")}
            min={64}
            max={32768}
            value={data.maxTokens}
            placeholder={String(DEFAULT_IMAGE_CAPTIONING_MAX_TOKENS)}
            onCommit={(maxTokens) => set({ maxTokens })}
            selectOnFocus
            className={`${FIELD} h-11 md:h-9`}
          />
        </label>
        <label className="block space-y-1.5">
          <span className={LABEL}>{t("connections.imageReading.temperature")}</span>
          <DraftNumberInput
            allowEmpty
            integer={false}
            ariaLabel={t("connections.imageReading.temperature")}
            min={0}
            max={2}
            value={data.temperature}
            placeholder={String(DEFAULT_IMAGE_CAPTIONING_TEMPERATURE)}
            onCommit={(temperature) => set({ temperature })}
            selectOnFocus
            className={`${FIELD} h-11 md:h-9`}
          />
        </label>
      </div>
      <p className={HINT}>{t("connections.imageReading.limitsHint")}</p>
    </div>
  );
}
