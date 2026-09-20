// ──────────────────────────────────────────────
// Atlas Cloud: model-specific video inputs
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  AtlasCloudModelLimits,
  AtlasCloudModelOptionField,
  AtlasCloudModelOptions as AtlasCloudModelOptionValues,
  AtlasCloudModelOptionValue,
} from "@marinara-engine/shared";
import { useAtlasCloudVideoModelSchema } from "../../hooks/use-atlas-cloud-model-schema";

const LABEL_CLASS = "text-[0.625rem] font-medium text-[var(--muted-foreground)]";
const INPUT_CLASS =
  "mt-1 w-full rounded-lg bg-[var(--card)] px-3 py-2 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-sky-400/50";
const MODEL_DEFAULT = "__model_default__";
const MODEL_INPUT_DEBOUNCE_MS = 400;

interface Props {
  model: string;
  value: AtlasCloudModelOptionValues;
  onChange: (next: AtlasCloudModelOptionValues) => void;
}

function formatDefault(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/** Every input the selected Atlas Cloud model declares beyond the common scene-video controls. */
export function AtlasCloudModelOptions({ model, value, onChange }: Props) {
  const { t } = useTranslation();
  const [settledModel, setSettledModel] = useState(model);

  // The model field is free text; wait for typing to pause before asking the server about it.
  useEffect(() => {
    const timer = setTimeout(() => setSettledModel(model), MODEL_INPUT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [model]);

  const schema = useAtlasCloudVideoModelSchema(settledModel);
  const data = schema.data;
  const changedCount = Object.keys(value).length;

  const setOption = (name: string, next: AtlasCloudModelOptionValue | undefined) => {
    const { [name]: _removed, ...rest } = value;
    onChange(next === undefined ? rest : { ...rest, [name]: next });
  };

  let body;
  if (!settledModel.trim()) {
    body = <StatusLine>{t("connections.mediaSources.atlas.modelOptions.enterModel")}</StatusLine>;
  } else if (schema.isLoading) {
    body = (
      <StatusLine>
        <Loader2 size="0.75rem" className="animate-spin" />
        {t("connections.mediaSources.atlas.modelOptions.loading")}
      </StatusLine>
    );
  } else if (schema.isError) {
    body = <StatusLine>{t("connections.mediaSources.atlas.modelOptions.error")}</StatusLine>;
  } else if (!data) {
    body = <StatusLine>{t("connections.mediaSources.atlas.modelOptions.enterModel")}</StatusLine>;
  } else if (!data.available) {
    body = <StatusLine>{t("connections.mediaSources.atlas.modelOptions.unavailable")}</StatusLine>;
  } else {
    body = (
      <>
        {data.limits && <ModelLimits limits={data.limits} />}
        {data.fields.length === 0 ? (
          <StatusLine>{t("connections.mediaSources.atlas.modelOptions.none")}</StatusLine>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {data.fields.map((field) => (
              <OptionField
                key={`${data.model}:${field.name}`}
                field={field}
                value={value[field.name]}
                onChange={(next) => setOption(field.name, next)}
              />
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-2 rounded-lg bg-[var(--background)]/40 p-2.5 ring-1 ring-[var(--border)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold">{t("connections.mediaSources.atlas.modelOptions.title")}</p>
          <p className="text-[0.55rem] text-[var(--muted-foreground)]">
            {t("connections.mediaSources.atlas.modelOptions.help")}
          </p>
        </div>
        {changedCount > 0 && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:text-[var(--foreground)] active:scale-95"
          >
            <RotateCcw size="0.75rem" />
            {t("connections.mediaSources.atlas.modelOptions.reset")}
          </button>
        )}
      </div>
      {body}
    </div>
  );
}

function StatusLine({ children }: { children: React.ReactNode }) {
  return <p className="flex items-center gap-1.5 text-[0.625rem] text-[var(--muted-foreground)]">{children}</p>;
}

function ModelLimits({ limits }: { limits: AtlasCloudModelLimits }) {
  const { t } = useTranslation();
  const lines: string[] = [];
  if (limits.durations) {
    lines.push(
      t("connections.mediaSources.atlas.modelOptions.limitsDurations", { values: limits.durations.join(", ") }),
    );
  } else if (limits.minDurationSeconds !== null || limits.maxDurationSeconds !== null) {
    lines.push(
      t("connections.mediaSources.atlas.modelOptions.limitsDurationRange", {
        min: limits.minDurationSeconds ?? 1,
        max: limits.maxDurationSeconds ?? 60,
      }),
    );
  }
  if (limits.resolutions) {
    lines.push(
      t("connections.mediaSources.atlas.modelOptions.limitsResolutions", { values: limits.resolutions.join(", ") }),
    );
  }
  if (limits.sizes) {
    lines.push(t("connections.mediaSources.atlas.modelOptions.limitsSizes", { values: limits.sizes.join(", ") }));
  }
  if (limits.aspectRatios) {
    lines.push(
      t("connections.mediaSources.atlas.modelOptions.limitsAspectRatios", { values: limits.aspectRatios.join(", ") }),
    );
  }

  return (
    <div className="space-y-1">
      {!limits.acceptsReferenceImage && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-[0.625rem] font-medium text-amber-400">
          <AlertTriangle size="0.75rem" className="mt-0.5 shrink-0" />
          {t("connections.mediaSources.atlas.modelOptions.noReferenceImage")}
        </p>
      )}
      {lines.length > 0 && (
        <div className="text-[0.55rem] text-[var(--muted-foreground)]">
          <ul className="list-inside list-disc">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-0.5">{t("connections.mediaSources.atlas.modelOptions.limitsNote")}</p>
        </div>
      )}
    </div>
  );
}

function OptionField({
  field,
  value,
  onChange,
}: {
  field: AtlasCloudModelOptionField;
  value: AtlasCloudModelOptionValue | undefined;
  onChange: (next: AtlasCloudModelOptionValue | undefined) => void;
}) {
  const { t } = useTranslation();
  const providerDefault = formatDefault(field.default);
  const defaultLabel = providerDefault
    ? t("connections.mediaSources.atlas.modelOptions.modelDefaultValue", { value: providerDefault })
    : t("connections.mediaSources.atlas.modelOptions.modelDefault");
  const wide = field.type === "json" || (field.type === "string" && !field.enum);

  let control;
  if (field.type === "boolean") {
    control = (
      <select
        value={typeof value === "boolean" ? String(value) : MODEL_DEFAULT}
        onChange={(event) => onChange(event.target.value === MODEL_DEFAULT ? undefined : event.target.value === "true")}
        className={INPUT_CLASS}
      >
        <option value={MODEL_DEFAULT}>{defaultLabel}</option>
        <option value="true">{t("connections.mediaSources.atlas.modelOptions.on")}</option>
        <option value="false">{t("connections.mediaSources.atlas.modelOptions.off")}</option>
      </select>
    );
  } else if (field.enum) {
    const choices = field.enum;
    // Options are addressed by position so choices such as 1 and "1" stay distinct and keep their type.
    const selectedIndex = choices.findIndex((choice) => Object.is(choice, value));
    control = (
      <select
        value={selectedIndex >= 0 ? String(selectedIndex) : MODEL_DEFAULT}
        onChange={(event) =>
          onChange(event.target.value === MODEL_DEFAULT ? undefined : choices[Number(event.target.value)])
        }
        className={INPUT_CLASS}
      >
        <option value={MODEL_DEFAULT}>{defaultLabel}</option>
        {choices.map((choice, index) => (
          <option key={`${typeof choice}:${choice}`} value={String(index)}>
            {String(choice)}
          </option>
        ))}
      </select>
    );
  } else if (field.type === "number" || field.type === "integer") {
    control = <NumberOption field={field} value={value} placeholder={defaultLabel} onChange={onChange} />;
  } else if (field.type === "json") {
    control = <JsonOption value={value} placeholder={defaultLabel} onChange={onChange} />;
  } else {
    control = <TextOption value={value} placeholder={defaultLabel} onChange={onChange} />;
  }

  return (
    <label className={wide ? "block sm:col-span-2" : "block"}>
      <span className={LABEL_CLASS}>
        <code className="text-[var(--foreground)]">{field.name}</code>
        {field.required && (
          <span className="ml-1 text-amber-400">{t("connections.mediaSources.atlas.modelOptions.required")}</span>
        )}
      </span>
      {control}
      {field.description && (
        <span className="mt-0.5 block text-[0.55rem] text-[var(--muted-foreground)]">{field.description}</span>
      )}
    </label>
  );
}

function NumberOption({
  field,
  value,
  placeholder,
  onChange,
}: {
  field: AtlasCloudModelOptionField;
  value: AtlasCloudModelOptionValue | undefined;
  placeholder: string;
  onChange: (next: AtlasCloudModelOptionValue | undefined) => void;
}) {
  const [draft, setDraft] = useState(typeof value === "number" ? String(value) : "");

  useEffect(() => {
    setDraft(typeof value === "number" ? String(value) : "");
  }, [value]);

  const commit = () => {
    if (!draft.trim()) return onChange(undefined);
    let parsed = Number(draft);
    if (!Number.isFinite(parsed)) return setDraft(typeof value === "number" ? String(value) : "");
    if (field.type === "integer") parsed = Math.trunc(parsed);
    if (field.minimum !== null) parsed = Math.max(field.minimum, parsed);
    if (field.maximum !== null) parsed = Math.min(field.maximum, parsed);
    setDraft(String(parsed));
    onChange(parsed);
  };

  return (
    <input
      type="number"
      inputMode={field.type === "integer" ? "numeric" : "decimal"}
      value={draft}
      min={field.minimum ?? undefined}
      max={field.maximum ?? undefined}
      step={field.type === "integer" ? 1 : "any"}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      className={INPUT_CLASS}
    />
  );
}

function TextOption({
  value,
  placeholder,
  onChange,
}: {
  value: AtlasCloudModelOptionValue | undefined;
  placeholder: string;
  onChange: (next: AtlasCloudModelOptionValue | undefined) => void;
}) {
  return (
    <textarea
      rows={2}
      value={typeof value === "string" ? value : ""}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value ? event.target.value : undefined)}
      className={`${INPUT_CLASS} resize-y`}
    />
  );
}

function JsonOption({
  value,
  placeholder,
  onChange,
}: {
  value: AtlasCloudModelOptionValue | undefined;
  placeholder: string;
  onChange: (next: AtlasCloudModelOptionValue | undefined) => void;
}) {
  const { t } = useTranslation();
  const serialized = value === undefined ? "" : JSON.stringify(value, null, 2);
  const [draft, setDraft] = useState(serialized);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(serialized);
    setInvalid(false);
  }, [serialized]);

  const commit = () => {
    if (!draft.trim()) {
      setInvalid(false);
      return onChange(undefined);
    }
    try {
      const parsed: unknown = JSON.parse(draft);
      if (parsed === null || typeof parsed !== "object") throw new Error("not a list or object");
      setInvalid(false);
      onChange(parsed as AtlasCloudModelOptionValue);
    } catch {
      setInvalid(true);
    }
  };

  return (
    <>
      <textarea
        rows={3}
        value={draft}
        spellCheck={false}
        placeholder={placeholder}
        aria-invalid={invalid}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        className={`${INPUT_CLASS} resize-y font-mono`}
      />
      {invalid && (
        <span className="mt-0.5 block text-[0.55rem] text-[var(--destructive)]">
          {t("connections.mediaSources.atlas.modelOptions.invalidJson")}
        </span>
      )}
    </>
  );
}
