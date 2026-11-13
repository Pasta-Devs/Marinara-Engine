// ──────────────────────────────────────────────
// Lorebook Editor: import entries from Markdown or CSV
// Parses with the shared parser for a live preview (the server runs the
// same parser), then posts the text to the import route.
// ──────────────────────────────────────────────
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, FileUp, Loader2, XCircle } from "lucide-react";
import {
  detectLorebookTextFormat,
  parseLorebookText,
  type LorebookTextDuplicateMode,
  type LorebookTextFormat,
  type LorebookTextIssue,
} from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { SHEET_BUTTON_QUIET, SHEET_BUTTON_PRIMARY } from "../ui/neutral-surface-styles";
import { api } from "../../lib/api-client";
import { lorebookKeys } from "../../hooks/use-lorebooks";
import { cn } from "../../lib/utils";

const PREVIEW_LIMIT = 200;

interface LorebookTextImportResult {
  lorebookId: string;
  created: number;
  renamed: number;
  overwritten: number;
  skipped: number;
  invalid: number;
  foldersCreated: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  lorebookId: string;
}

type ImportTarget = "current" | "new";

export function LorebookTextImportDialog({ open, onClose, lorebookId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [format, setFormat] = useState<LorebookTextFormat>("markdown");
  const [target, setTarget] = useState<ImportTarget>("current");
  const [newName, setNewName] = useState("");
  const [duplicateMode, setDuplicateMode] = useState<LorebookTextDuplicateMode>("skip");
  const [importing, setImporting] = useState(false);

  const parsed = useMemo(() => (text.trim() ? parseLorebookText(format, text) : null), [format, text]);
  const errors = parsed?.issues.filter((issue) => issue.severity === "error") ?? [];
  const warnings = parsed?.issues.filter((issue) => issue.severity === "warning") ?? [];
  const validCount = parsed?.entries.filter((entry) => !entry.invalid).length ?? 0;
  const fileError = errors.some((issue) => issue.entryIndex === null);
  const canImport = !!parsed && !fileError && validCount > 0 && !importing;

  const reset = () => {
    setText("");
    setFileName("");
    setFormat("markdown");
    setTarget("current");
    setNewName("");
    setDuplicateMode("skip");
  };

  const close = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const loadText = (value: string, name = "") => {
    setText(value);
    setFileName(name);
    setFormat(detectLorebookTextFormat(value, name || undefined));
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    loadText(await file.text(), file.name);
  };

  const issueText = (issue: LorebookTextIssue) =>
    t(`lorebook.textImport.issue.${issue.code}`, { detail: issue.detail ?? "" });

  const suggestedName = parsed?.title || fileName.replace(/\.(md|markdown|txt|csv)$/i, "");

  const handleImport = async () => {
    if (!canImport) return;
    setImporting(true);
    try {
      const body = { format, text, duplicateMode };
      const result =
        target === "new"
          ? await api.post<LorebookTextImportResult>("/lorebooks/import-text", {
              ...body,
              name: newName.trim() || suggestedName || t("lorebook.textImport.defaultName"),
            })
          : await api.post<LorebookTextImportResult>(`/lorebooks/${lorebookId}/import-text`, body);
      qc.invalidateQueries({ queryKey: lorebookKeys.all });
      toast.success(
        t("lorebook.textImport.success", {
          created: result.created + result.renamed,
          overwritten: result.overwritten,
          skipped: result.skipped + result.invalid,
        }),
      );
      reset();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("lorebook.textImport.failure"));
    } finally {
      setImporting(false);
    }
  };

  const optionClass = (active: boolean) =>
    cn(
      "flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
      active
        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
        : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
    );

  return (
    <Modal
      footer={
        <>
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={!canImport}
            className={SHEET_BUTTON_PRIMARY}
          >
            {importing ? <Loader2 size="0.8125rem" className="animate-spin" /> : null}
            {t("lorebook.textImport.import", { count: validCount })}
          </button>
          <button type="button" onClick={close} disabled={importing} className={SHEET_BUTTON_QUIET}>
            {t("lorebook.textImport.cancel")}
          </button>
        </>
      }
      closeButtonClassName="max-sm:hidden"
      open={open}
      onClose={close}
      title={t("lorebook.textImport.title")}
      width="max-w-2xl"
      closeDisabled={importing}
    >
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("lorebook.textImport.description")}</p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--accent)]"
          >
            <FileUp size="0.8125rem" />
            {t("lorebook.textImport.chooseFile")}
          </button>
          {fileName ? (
            <span className="min-w-0 truncate text-xs text-[var(--muted-foreground)]">{fileName}</span>
          ) : null}
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as LorebookTextFormat)}
            aria-label={t("lorebook.textImport.format")}
            className="mari-editor-field ml-auto px-2 py-1.5 text-xs max-sm:text-base"
          >
            <option value="markdown">{t("lorebook.textImport.formatMarkdown")}</option>
            <option value="csv">{t("lorebook.textImport.formatCsv")}</option>
          </select>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,.txt,.csv,text/markdown,text/csv,text/plain"
            className="hidden"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>

        <textarea
          value={text}
          onChange={(event) => {
            if (!text.trim()) loadText(event.target.value, fileName);
            else setText(event.target.value);
          }}
          placeholder={t("lorebook.textImport.pastePlaceholder")}
          aria-label={t("lorebook.textImport.pasteLabel")}
          spellCheck={false}
          className="mari-editor-field block h-32 w-full resize-y px-3 py-2 font-mono text-xs max-sm:text-base"
        />

        {parsed ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <span className="font-medium">{t("lorebook.textImport.readyCount", { count: validCount })}</span>
              {errors.length > 0 ? (
                <span className="text-[var(--destructive)]">
                  {t("lorebook.textImport.errorCount", { count: errors.length })}
                </span>
              ) : null}
              {warnings.length > 0 ? (
                <span className="text-amber-500">
                  {t("lorebook.textImport.warningCount", { count: warnings.length })}
                </span>
              ) : null}
            </div>
            {parsed.issues.length > 0 ? (
              <ul className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2 text-xs">
                {parsed.issues.slice(0, PREVIEW_LIMIT).map((issue, index) => (
                  <li key={`${issue.code}-${issue.line}-${index}`} className="flex items-start gap-1.5">
                    {issue.severity === "error" ? (
                      <XCircle size="0.75rem" className="mt-0.5 shrink-0 text-[var(--destructive)]" />
                    ) : (
                      <AlertTriangle size="0.75rem" className="mt-0.5 shrink-0 text-amber-500" />
                    )}
                    <span className="min-w-0 break-words">
                      {issue.line !== null ? (
                        <span className="text-[var(--muted-foreground)]">
                          {t("lorebook.textImport.lineLabel", { line: issue.line })}{" "}
                        </span>
                      ) : null}
                      {issueText(issue)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {parsed.entries.length > 0 ? (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--border)]">
                {parsed.entries.slice(0, PREVIEW_LIMIT).map((entry, index) => (
                  <div
                    key={`${entry.line}-${index}`}
                    className={cn(
                      "border-b border-[var(--border)] px-3 py-1.5 text-xs last:border-b-0",
                      entry.invalid && "opacity-50",
                    )}
                  >
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate font-medium">{entry.name || t("lorebook.textImport.unnamed")}</span>
                      {entry.folderPath.length > 0 ? (
                        <span className="truncate text-[var(--muted-foreground)]">{entry.folderPath.join(" / ")}</span>
                      ) : null}
                    </div>
                    {entry.keys.length > 0 ? (
                      <div className="truncate text-[var(--muted-foreground)]">{entry.keys.join(", ")}</div>
                    ) : null}
                  </div>
                ))}
                {parsed.entries.length > PREVIEW_LIMIT ? (
                  <div className="px-3 py-1.5 text-xs text-[var(--muted-foreground)]">
                    {t("lorebook.textImport.moreEntries", { count: parsed.entries.length - PREVIEW_LIMIT })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-xs font-medium">{t("lorebook.textImport.target")}</span>
            <div className="flex gap-1 rounded-lg bg-[var(--secondary)] p-0.5" role="radiogroup">
              <button
                type="button"
                role="radio"
                aria-checked={target === "current"}
                onClick={() => setTarget("current")}
                className={optionClass(target === "current")}
              >
                {t("lorebook.textImport.targetCurrent")}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={target === "new"}
                onClick={() => setTarget("new")}
                className={optionClass(target === "new")}
              >
                {t("lorebook.textImport.targetNew")}
              </button>
            </div>
            {target === "new" ? (
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder={suggestedName || t("lorebook.textImport.defaultName")}
                aria-label={t("lorebook.textImport.newName")}
                maxLength={200}
                className="mari-editor-field w-full px-3 py-1.5 text-xs max-sm:text-base"
              />
            ) : null}
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">{t("lorebook.textImport.duplicates")}</span>
            <select
              value={duplicateMode}
              onChange={(event) => setDuplicateMode(event.target.value as LorebookTextDuplicateMode)}
              className="mari-editor-field w-full px-3 py-1.5 text-xs max-sm:text-base"
            >
              <option value="skip">{t("lorebook.textImport.duplicateSkip")}</option>
              <option value="rename">{t("lorebook.textImport.duplicateRename")}</option>
              <option value="overwrite">{t("lorebook.textImport.duplicateOverwrite")}</option>
            </select>
          </label>
        </div>
      </div>
    </Modal>
  );
}
