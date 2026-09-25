import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { REQUEST_TIMEOUTS, type RequestTimeoutSettings as Values } from "@marinara-engine/shared";
import { api, getPrivilegedActionErrorMessage } from "../../../lib/api-client";
import { DraftNumberInput } from "../../ui/DraftNumberInput";

const queryKey = ["request-timeouts"];
export function RequestTimeoutSettings() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isError } = useQuery({ queryKey, queryFn: () => api.get<Values>("/admin/request-timeouts") });
  const [draft, setDraft] = useState<Values | null>(null);
  const save = useMutation({
    mutationFn: (values: Values) => api.put<Values>("/admin/request-timeouts", values),
    onSuccess: (values) => {
      qc.setQueryData(queryKey, values);
      setDraft(null);
      toast.success(t("settings.timeouts.saved"));
    },
    onError: (error) => toast.error(getPrivilegedActionErrorMessage(error, t("settings.timeouts.saveFailed"))),
  });
  const values = draft ?? data;
  if (!values)
    return (
      <p className="text-xs text-[var(--muted-foreground)]">
        {t(isError ? "settings.timeouts.loadFailed" : "settings.timeouts.loading")}
      </p>
    );
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("settings.timeouts.description")}</p>
      {Object.entries(REQUEST_TIMEOUTS).map(([key, spec]) => {
        const name = key as keyof Values;
        return (
          <label key={key} className="flex items-center justify-between gap-3 text-xs">
            <span>{t(`settings.timeouts.${key}`)}</span>
            <DraftNumberInput
              value={values[name]}
              min={10}
              max={spec.maxSeconds}
              disabled={save.isPending}
              ariaLabel={t(`settings.timeouts.${key}`)}
              onCommit={(value) => setDraft((current) => ({ ...(current ?? values), [key]: value }))}
              className="w-24 shrink-0 rounded-lg bg-[var(--secondary)] px-2.5 py-2 text-xs outline-none ring-1 ring-[var(--border)] focus:ring-[var(--ring)]"
            />
          </label>
        );
      })}
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("settings.timeouts.restart")}</p>
      <button
        type="button"
        disabled={!draft || save.isPending}
        onClick={() => save.mutate(values)}
        className="mari-chrome-control mari-chrome-control--selected w-full justify-center px-3"
      >
        {t("settings.timeouts.save")}
      </button>
    </div>
  );
}
