import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  isReservedManagedGenerationParameterKey,
  type ManagedGenerationParameterDefinition,
} from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useCustomGenerationParameters,
  useSaveCustomGenerationParameters,
} from "../../../hooks/use-custom-generation-parameters";
import { parseGenerationParameterDraft } from "../../../lib/generation-parameter-draft";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { cn } from "../../../lib/utils";

type DefinitionDraft = {
  id: string | null;
  name: string;
  requestKey: string;
  min: string;
  max: string;
  tooltip: string;
};

const EMPTY_DRAFT: DefinitionDraft = {
  id: null,
  name: "",
  requestKey: "",
  min: "0",
  max: "1",
  tooltip: "",
};

function makeDefinitionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `parameter-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CustomGenerationParametersSettings() {
  const { t } = useTranslation();
  const { data: definitions = [], isLoading } = useCustomGenerationParameters();
  const saveDefinitions = useSaveCustomGenerationParameters();
  const [draft, setDraft] = useState<DefinitionDraft>(EMPTY_DRAFT);
  const [formOpen, setFormOpen] = useState(false);
  const [validationKey, setValidationKey] = useState<string | null>(null);

  const editingDefinition = useMemo(
    () => definitions.find((definition) => definition.id === draft.id) ?? null,
    [definitions, draft.id],
  );

  const resetForm = () => {
    setDraft(EMPTY_DRAFT);
    setFormOpen(false);
    setValidationKey(null);
  };

  const openForEdit = (definition: ManagedGenerationParameterDefinition) => {
    setDraft({
      id: definition.id,
      name: definition.name,
      requestKey: definition.requestKey,
      min: String(definition.min),
      max: String(definition.max),
      tooltip: definition.tooltip ?? "",
    });
    setValidationKey(null);
    setFormOpen(true);
  };

  const saveDraft = async () => {
    const name = draft.name.trim();
    const requestKey = draft.requestKey.trim();
    const min = parseGenerationParameterDraft(draft.min);
    const max = parseGenerationParameterDraft(draft.max);
    const normalizedRequestKey = requestKey.toLowerCase();
    const duplicate = definitions.some(
      (definition) => definition.id !== draft.id && definition.requestKey.toLowerCase() === normalizedRequestKey,
    );

    let errorKey: string | null = null;
    if (!name) errorKey = "settings.customGenerationParameters.validation.nameRequired";
    else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(requestKey)) {
      errorKey = "settings.customGenerationParameters.validation.requestKey";
    } else if (duplicate) errorKey = "settings.customGenerationParameters.validation.duplicate";
    else if (isReservedManagedGenerationParameterKey(requestKey)) {
      errorKey = "settings.customGenerationParameters.validation.reserved";
    } else if (min === null || max === null) {
      errorKey = "settings.customGenerationParameters.validation.finiteRange";
    } else if (min > max) errorKey = "settings.customGenerationParameters.validation.rangeOrder";

    if (errorKey || min === null || max === null) {
      setValidationKey(errorKey);
      return;
    }

    const nextDefinition: ManagedGenerationParameterDefinition = {
      id: draft.id ?? makeDefinitionId(),
      name,
      requestKey,
      min,
      max,
      ...(draft.tooltip.trim() ? { tooltip: draft.tooltip.trim() } : {}),
    };
    const next = editingDefinition
      ? definitions.map((definition) => (definition.id === editingDefinition.id ? nextDefinition : definition))
      : [...definitions, nextDefinition];

    try {
      await saveDefinitions.mutateAsync(next);
      toast.success(t("settings.customGenerationParameters.saved"));
      resetForm();
    } catch {
      toast.error(t("settings.customGenerationParameters.saveFailed"));
    }
  };

  const deleteDefinition = async (definition: ManagedGenerationParameterDefinition) => {
    const confirmed = await showConfirmDialog({
      title: t("settings.customGenerationParameters.deleteTitle"),
      message: t("settings.customGenerationParameters.deleteMessage", { name: definition.name }),
      confirmLabel: t("settings.customGenerationParameters.deleteAction"),
      cancelLabel: t("chat.delete.dialog.cancel"),
    });
    if (!confirmed) return;
    try {
      await saveDefinitions.mutateAsync(definitions.filter((candidate) => candidate.id !== definition.id));
      if (draft.id === definition.id) resetForm();
      toast.success(t("settings.customGenerationParameters.deleted"));
    } catch {
      toast.error(t("settings.customGenerationParameters.saveFailed"));
    }
  };

  if (isLoading) {
    return <p className="text-xs text-[var(--muted-foreground)]">{t("settings.customGenerationParameters.loading")}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
        {t("settings.customGenerationParameters.description")}
      </p>

      {definitions.length > 0 ? (
        <div className="space-y-2">
          {definitions.map((definition) => (
            <div
              key={definition.id}
              className="flex items-start gap-2 rounded-lg bg-[var(--background)]/55 p-2.5 ring-1 ring-[var(--border)]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-xs font-semibold text-[var(--foreground)]">{definition.name}</span>
                  <code className="text-[0.625rem] text-[var(--marinara-chat-chrome-button-text-active)]">
                    {definition.requestKey}
                  </code>
                </div>
                <p className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                  {t("settings.customGenerationParameters.range", {
                    min: definition.min,
                    max: definition.max,
                  })}
                </p>
                {definition.tooltip && (
                  <p className="mt-1 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                    {definition.tooltip}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => openForEdit(definition)}
                  className="mari-chrome-control mari-chrome-control--compact h-7 w-7 p-0"
                  aria-label={t("settings.customGenerationParameters.editAction", { name: definition.name })}
                  title={t("settings.customGenerationParameters.editAction", { name: definition.name })}
                >
                  <Pencil size="1rem" className="shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => void deleteDefinition(definition)}
                  disabled={saveDefinitions.isPending}
                  className="mari-chrome-control mari-chrome-control--compact h-7 w-7 p-0"
                  aria-label={t("settings.customGenerationParameters.deleteActionNamed", { name: definition.name })}
                  title={t("settings.customGenerationParameters.deleteActionNamed", { name: definition.name })}
                >
                  <Trash2 size="1rem" className="shrink-0 text-[var(--destructive)]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--muted-foreground)]">
          {t("settings.customGenerationParameters.empty")}
        </div>
      )}

      {formOpen ? (
        <div className="space-y-3 rounded-lg bg-[var(--background)]/55 p-3 ring-1 ring-[var(--border)]">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                {t("settings.customGenerationParameters.name")}
              </span>
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-lg bg-[var(--secondary)] px-2.5 py-2 text-xs outline-none ring-1 ring-[var(--border)] focus:ring-[var(--ring)]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                {t("settings.customGenerationParameters.value")}
              </span>
              <input
                value={draft.requestKey}
                onChange={(event) => setDraft((current) => ({ ...current, requestKey: event.target.value }))}
                placeholder={t("settings.customGenerationParameters.valuePlaceholder")}
                spellCheck={false}
                className="w-full rounded-lg bg-[var(--secondary)] px-2.5 py-2 font-mono text-xs outline-none ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/60 focus:ring-[var(--ring)]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                {t("settings.customGenerationParameters.minimum")}
              </span>
              <input
                value={draft.min}
                onChange={(event) => setDraft((current) => ({ ...current, min: event.target.value }))}
                inputMode="decimal"
                className="w-full rounded-lg bg-[var(--secondary)] px-2.5 py-2 text-xs outline-none ring-1 ring-[var(--border)] focus:ring-[var(--ring)]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                {t("settings.customGenerationParameters.maximum")}
              </span>
              <input
                value={draft.max}
                onChange={(event) => setDraft((current) => ({ ...current, max: event.target.value }))}
                inputMode="decimal"
                className="w-full rounded-lg bg-[var(--secondary)] px-2.5 py-2 text-xs outline-none ring-1 ring-[var(--border)] focus:ring-[var(--ring)]"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
              {t("settings.customGenerationParameters.tooltip")}
            </span>
            <textarea
              value={draft.tooltip}
              onChange={(event) => setDraft((current) => ({ ...current, tooltip: event.target.value }))}
              rows={3}
              className="w-full resize-y rounded-lg bg-[var(--secondary)] px-2.5 py-2 text-xs outline-none ring-1 ring-[var(--border)] focus:ring-[var(--ring)]"
            />
          </label>
          {validationKey && <p className="text-[0.625rem] text-amber-500">{t(validationKey)}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={resetForm}
              className="mari-chrome-control mari-chrome-control--compact justify-center px-3"
            >
              <X size="0.75rem" />
              {t("chat.delete.dialog.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={saveDefinitions.isPending}
              className={cn(
                "mari-chrome-control mari-chrome-control--compact mari-chrome-control--selected justify-center px-3",
                saveDefinitions.isPending && "opacity-60",
              )}
            >
              <Check size="0.75rem" />
              {t("settings.customGenerationParameters.save")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(EMPTY_DRAFT);
            setFormOpen(true);
          }}
          className="mari-chrome-control mari-chrome-control--compact mari-chrome-control--selected w-full justify-center px-3"
        >
          <Plus size="0.75rem" />
          {t("settings.customGenerationParameters.add")}
        </button>
      )}
    </div>
  );
}
