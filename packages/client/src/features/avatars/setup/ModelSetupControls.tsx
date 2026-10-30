// Shared model import and expression controls; renderer libraries stay in their lazy modules.
import { useId, useRef, type ReactNode } from "react";
import { Loader2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  AVATAR_EXPRESSION_SLOTS,
  type AvatarExpressionBindingSource,
  type AvatarExpressionMap,
  type AvatarExpressionSlot,
} from "@marinara-engine/shared";

const SOURCE_KEYS: Readonly<Record<AvatarExpressionBindingSource, string>> = {
  preset: "avatars.vrm.source.preset",
  "name-match": "avatars.vrm.source.nameMatch",
  "sprite-label": "avatars.vrm.source.nameMatch",
  user: "avatars.vrm.source.user",
  missing: "avatars.vrm.source.missing",
};

export const MODEL_BUTTON_CLASS =
  "flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--background)] px-3 py-2 text-[0.6875rem] font-medium ring-1 ring-[var(--border)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-40";

export function modelErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function ModelSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 max-w-full space-y-3 rounded-xl bg-[var(--secondary)]/55 p-3 ring-1 ring-[var(--border)]">
      <div className="min-w-0">
        <h4 className="text-xs font-semibold text-[var(--foreground)]">{title}</h4>
        <p className="mt-0.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function ModelFileButton({
  accept,
  label,
  busy,
  disabled,
  onFile,
}: {
  accept: string;
  label: string;
  busy: boolean;
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <button type="button" disabled={disabled} onClick={() => input.current?.click()} className={MODEL_BUTTON_CLASS}>
        {busy ? <Loader2 size="0.75rem" className="animate-spin" /> : <Upload size="0.75rem" />}
        {label}
      </button>
    </>
  );
}

export function ExpressionBindings({
  data,
  saving,
  onChange,
}: {
  data: { expressionMap: AvatarExpressionMap; expressionNames?: string[] };
  saving: boolean;
  onChange: (map: AvatarExpressionMap) => void;
}) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const names = data.expressionNames ?? [];
  return (
    <div className="grid grid-cols-2 gap-2">
      {AVATAR_EXPRESSION_SLOTS.map((slot: AvatarExpressionSlot) => {
        const binding = data.expressionMap[slot];
        const target = binding?.target ?? "";
        const id = `${idPrefix}-${slot}`;
        return (
          <div key={slot} className="min-w-0 rounded-lg bg-[var(--background)]/70 p-2 ring-1 ring-[var(--border)]">
            <label htmlFor={id} className="block text-[0.6875rem] font-medium text-[var(--foreground)]">
              {t(`avatars.vrm.slot.${slot}`)}
            </label>
            <select
              id={id}
              value={target}
              disabled={saving}
              onChange={(event) =>
                onChange({
                  ...data.expressionMap,
                  [slot]: { target: event.target.value || null, source: "user", confidence: 1 },
                })
              }
              className="mt-1 min-h-11 w-full rounded-lg bg-[var(--secondary)] px-2.5 py-2 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60 pointer-coarse:text-base"
            >
              <option value="">{t("avatars.vrm.expressions.none")}</option>
              {target && !names.includes(target) ? <option value={target}>{target}</option> : null}
              {names.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
              {t(SOURCE_KEYS[binding?.source ?? "missing"])}
            </p>
          </div>
        );
      })}
    </div>
  );
}
