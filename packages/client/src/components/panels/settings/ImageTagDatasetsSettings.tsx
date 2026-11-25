import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IMAGE_TAG_CATEGORIES,
  IMAGE_TAG_LIMITS,
  type ImageTagCategory,
  type ImageTagDatasetSummary,
  type ImageTagSearchMode,
} from "@marinara-engine/shared";
import {
  useImageTagDatasets,
  useImportImageTagDataset,
  useUpdateImageTagDataset,
  useDeleteImageTagDataset,
  useSearchImageTagDatasets,
} from "../../../hooks/use-image-tag-datasets";
import { showConfirmDialog, showPromptDialog } from "../../../lib/app-dialogs";
import { Checkbox } from "../../ui/Checkbox";
import { Select } from "../../ui/Select";
import { ToggleSetting } from "./SettingControls";

const buttonClass =
  "min-h-11 rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--secondary)] disabled:opacity-50 active:scale-95";
const inputClass =
  "min-h-11 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base text-[var(--foreground)]";

export function ImageTagDatasetsSettings() {
  const { t } = useTranslation();
  const datasets = useImageTagDatasets();
  const upload = useImportImageTagDataset();
  const update = useUpdateImageTagDataset();
  const remove = useDeleteImageTagDataset();
  const search = useSearchImageTagDatasets();
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("file");
  const [replaceId, setReplaceId] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ImageTagSearchMode>("prefix");
  const [error, setError] = useState("");
  const [report, setReport] = useState<ImageTagDatasetSummary | null>(null);
  const busy = upload.isPending || update.isPending || remove.isPending || search.isPending;
  const categoryLabel = (value: ImageTagCategory) =>
    t(
      `settings.imageTagDatasets.categories.${({ 0: "general", 1: "artists", 3: "copyrights", 4: "characters", 5: "meta" } as const)[value]}`,
    );
  const sources = datasets.data?.sources ?? [];

  async function perform(action: () => Promise<unknown>) {
    setError("");
    search.reset();
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("settings.imageTagDatasets.failed"));
    }
  }

  async function deleteSource(id: string, name: string) {
    if (
      !(await showConfirmDialog({
        title: t("settings.imageTagDatasets.delete"),
        message: t("settings.imageTagDatasets.deleteConfirm", { name }),
        tone: "destructive",
      }))
    )
      return;
    await perform(async () => {
      await remove.mutateAsync(id);
      if (replaceId === id) setReplaceId(undefined);
      setReport(null);
    });
  }

  return (
    <div className="space-y-3" aria-busy={busy}>
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
        {t("settings.imageTagDatasets.description")}
      </p>
      <a
        className="inline-flex min-h-11 items-center text-xs text-[var(--primary)] underline"
        href="https://huggingface.co/datasets/HDiffusion/historical-danbooru-tag-counts/tree/main"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("settings.imageTagDatasets.sourceLink")}
      </a>

      {datasets.isPending && (
        <p role="status" className="text-xs text-[var(--muted-foreground)]">
          {t("settings.imageTagDatasets.loading")}
        </p>
      )}
      {datasets.isError && (
        <div role="alert" className="space-y-2 text-xs text-[var(--destructive)]">
          <p>{t("settings.imageTagDatasets.loadFailed")}</p>
          <button className={buttonClass} onClick={() => void datasets.refetch()}>
            {t("settings.imageTagDatasets.retry")}
          </button>
        </div>
      )}
      {datasets.data && (
        <>
          {sources.length === 0 && datasets.data.unavailableSources.length === 0 && (
            <p className="text-xs text-[var(--muted-foreground)]">{t("settings.imageTagDatasets.empty")}</p>
          )}
          <ul className="divide-y divide-[var(--border)]">
            {sources.map((source) => (
              <li key={source.id} className="space-y-2 py-3">
                <ToggleSetting
                  label={<span className="break-all">{source.name}</span>}
                  checked={source.enabled}
                  disabled={busy}
                  onChange={(enabled) => void perform(() => update.mutateAsync({ id: source.id, enabled }))}
                />
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t("settings.imageTagDatasets.sourceDetails", {
                    count: source.recordCount,
                    date: new Date(source.updatedAt).toLocaleDateString(),
                  })}
                </p>
                <fieldset disabled={!source.enabled || busy} className="flex flex-wrap gap-x-4 disabled:opacity-60">
                  <legend className="text-xs text-[var(--muted-foreground)]">
                    {t("settings.imageTagDatasets.enabledCategories")}
                  </legend>
                  {IMAGE_TAG_CATEGORIES.map((value) => (
                    <label key={value} className="flex min-h-11 items-center gap-2 text-xs">
                      <Checkbox
                        checked={source.enabledCategories.includes(value)}
                        onChange={(event) => {
                          const enabledCategories = event.target.checked
                            ? [...source.enabledCategories, value]
                            : source.enabledCategories.filter((item) => item !== value);
                          void perform(() => update.mutateAsync({ id: source.id, enabledCategories }));
                        }}
                      />
                      {categoryLabel(value)} ({(source.categoryCounts[value] ?? 0).toLocaleString()})
                    </label>
                  ))}
                </fieldset>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={buttonClass}
                    disabled={busy}
                    onClick={async () => {
                      const name = await showPromptDialog({
                        title: t("settings.imageTagDatasets.rename"),
                        message: t("settings.imageTagDatasets.name"),
                        defaultValue: source.name,
                      });
                      if (name?.trim()) void perform(() => update.mutateAsync({ id: source.id, name: name.trim() }));
                    }}
                  >
                    {t("settings.imageTagDatasets.rename")}
                  </button>
                  <button
                    className={buttonClass}
                    disabled={busy}
                    onClick={() => {
                      setReplaceId(source.id);
                      setReport(null);
                      fileRef.current?.focus();
                    }}
                  >
                    {t("settings.imageTagDatasets.replace")}
                  </button>
                  <button className={buttonClass} disabled={busy} onClick={() => setReport(source)}>
                    {t("settings.imageTagDatasets.report")}
                  </button>
                  <button
                    className={`${buttonClass} text-[var(--destructive)]`}
                    disabled={busy}
                    onClick={() => void deleteSource(source.id, source.name)}
                  >
                    {t("settings.imageTagDatasets.delete")}
                  </button>
                </div>
              </li>
            ))}
            {datasets.data.unavailableSources.map((id) => (
              <li key={id} className="space-y-2 py-3">
                <p className="break-all text-xs text-[var(--destructive)]">
                  {t("settings.imageTagDatasets.unavailable", { id })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={buttonClass}
                    disabled={busy}
                    onClick={() => {
                      setReplaceId(id);
                      fileRef.current?.focus();
                    }}
                  >
                    {t("settings.imageTagDatasets.replace")}
                  </button>
                  <button
                    className={`${buttonClass} text-[var(--destructive)]`}
                    disabled={busy}
                    onClick={() => void deleteSource(id, id)}
                  >
                    {t("settings.imageTagDatasets.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!file) return;
              void perform(async () => {
                if (file.size > IMAGE_TAG_LIMITS.uploadBytes) throw new Error(t("settings.imageTagDatasets.tooLarge"));
                if (
                  replaceId &&
                  !(await showConfirmDialog({
                    title: t("settings.imageTagDatasets.replace"),
                    message: t("settings.imageTagDatasets.replaceConfirm"),
                  }))
                )
                  return;
                const imported = await upload.mutateAsync({
                  file,
                  category: category === "file" ? undefined : (Number(category) as ImageTagCategory),
                  replaceId,
                });
                setReport(imported);
                setFile(null);
                setReplaceId(undefined);
                if (fileRef.current) fileRef.current.value = "";
              });
            }}
          >
            <label htmlFor={`${inputId}-file`} className="block text-xs font-medium text-[var(--foreground)]">
              {replaceId
                ? t("settings.imageTagDatasets.replacing", {
                    name: sources.find((source) => source.id === replaceId)?.name ?? replaceId,
                  })
                : t("settings.imageTagDatasets.csvFile")}
            </label>
            <input
              ref={fileRef}
              id={`${inputId}-file`}
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              className={`${inputClass} file:mr-2 file:rounded file:border-0 file:bg-[var(--secondary)] file:p-2 file:text-[var(--foreground)]`}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <label className="block text-xs text-[var(--foreground)]">{t("settings.imageTagDatasets.category")}</label>
            <Select
              label={t("settings.imageTagDatasets.category")}
              value={category}
              onChange={setCategory}
              disabled={busy}
              className={inputClass}
              options={[
                { value: "file", label: t("settings.imageTagDatasets.fromFile") },
                ...IMAGE_TAG_CATEGORIES.map((value) => ({ value: String(value), label: categoryLabel(value) })),
              ]}
            />
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              {t("settings.imageTagDatasets.formatHelp")}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={buttonClass} disabled={busy || !file}>
                {upload.isPending ? t("settings.imageTagDatasets.importing") : t("settings.imageTagDatasets.import")}
              </button>
              {replaceId && (
                <button type="button" className={buttonClass} disabled={busy} onClick={() => setReplaceId(undefined)}>
                  {t("settings.imageTagDatasets.cancelReplace")}
                </button>
              )}
            </div>
          </form>
        </>
      )}
      {report && (
        <div role="status" className="space-y-1 text-xs text-[var(--muted-foreground)]">
          <p className="break-all font-medium text-[var(--foreground)]">{report.name}</p>
          <p>
            {t("settings.imageTagDatasets.reportSummary", {
              accepted: report.report.acceptedRows.toLocaleString(),
              invalid: report.report.invalidRows.toLocaleString(),
              duplicates: report.report.duplicateRows.toLocaleString(),
              blank: report.report.blankRows.toLocaleString(),
            })}
          </p>
          {report.report.issues.length > 0 && (
            <details>
              <summary className="min-h-11 cursor-pointer py-3">{t("settings.imageTagDatasets.issueDetails")}</summary>
              <ul className="max-h-48 overflow-y-auto">
                {report.report.issues.map((issue) => (
                  <li key={`${issue.row}-${issue.code}`}>
                    {t("settings.imageTagDatasets.issue", {
                      row: issue.row,
                      reason: t(`settings.imageTagDatasets.issues.${issue.code}`),
                    })}
                  </li>
                ))}
              </ul>
              {report.report.omittedIssues > 0 && (
                <p>{t("settings.imageTagDatasets.omitted", { count: report.report.omittedIssues })}</p>
              )}
            </details>
          )}
        </div>
      )}
      <form
        className="space-y-2 border-t border-[var(--border)] pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          void search
            .mutateAsync({ queries: [query], mode })
            .catch((cause: unknown) =>
              setError(cause instanceof Error ? cause.message : t("settings.imageTagDatasets.failed")),
            );
        }}
      >
        <label htmlFor={`${inputId}-query`} className="block text-xs font-medium text-[var(--foreground)]">
          {t("settings.imageTagDatasets.search")}
        </label>
        <input
          id={`${inputId}-query`}
          className={inputClass}
          value={query}
          maxLength={IMAGE_TAG_LIMITS.queryCharacters}
          disabled={search.isPending}
          onChange={(event) => {
            setQuery(event.target.value);
            search.reset();
          }}
        />
        <label className="block text-xs text-[var(--foreground)]">{t("settings.imageTagDatasets.searchMode")}</label>
        <Select
          label={t("settings.imageTagDatasets.searchMode")}
          value={mode}
          disabled={search.isPending}
          onChange={(value) => {
            setMode(value);
            search.reset();
          }}
          className={inputClass}
          options={(["exact", "prefix", "substring"] as const).map((value) => ({
            value,
            label: t(`settings.imageTagDatasets.modes.${value}`),
          }))}
        />
        <button
          type="submit"
          className={buttonClass}
          disabled={!query.trim() || search.isPending || busy || !datasets.data}
        >
          {search.isPending ? t("settings.imageTagDatasets.searching") : t("settings.imageTagDatasets.search")}
        </button>
      </form>
      {search.data && (
        <div role="status" className="space-y-2 text-xs text-[var(--muted-foreground)]">
          {search.data.status !== "ready" ? (
            <p>{t(`settings.imageTagDatasets.status.${search.data.status}`)}</p>
          ) : (
            search.data.results.map((result) => (
              <div key={result.query}>
                <p>
                  {t("settings.imageTagDatasets.matches", { shown: result.matches.length, total: result.totalMatches })}
                </p>
                <ul className="divide-y divide-[var(--border)]">
                  {result.matches.map((match) => (
                    <li key={`${match.category}-${match.canonicalName}`} className="space-y-1 py-2">
                      <code className="break-all text-[var(--foreground)]">{match.canonicalName}</code>
                      {match.matchedAlias && (
                        <p className="break-all">
                          {t("settings.imageTagDatasets.alias", { alias: match.matchedAlias })}
                        </p>
                      )}
                      <p className="break-words">
                        {categoryLabel(match.category)} ·{" "}
                        {t("settings.imageTagDatasets.posts", { count: match.postCount })} ·{" "}
                        {match.sourceIds.map((id) => sources.find((source) => source.id === id)?.name ?? id).join(", ")}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="break-words text-xs text-[var(--destructive)]">
          {error}
        </p>
      )}
    </div>
  );
}
