import { useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Download, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import type { AdvancedMemoryRecord } from "@marinara-engine/shared";
import {
  useAdvancedMemoryAction,
  useAdvancedMemorySources,
  useAdvancedMemoryStatus,
  useExportAdvancedMemory,
} from "../../hooks/use-advanced-memory";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import type { MemoryCharacterOption } from "./AdvancedMemorySettings";

const buttonClass =
  "mari-chrome-control inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs disabled:opacity-50";
const reasonKeys: Record<string, string> = {
  "preparation-needed": "chat.advancedMemory.reason.preparationNeeded",
  "unverified-summary-omitted": "chat.advancedMemory.reason.unverifiedSummaryOmitted",
  "scene-boundary-rollover": "chat.advancedMemory.reason.sceneBoundaryRollover",
  "open-scene-prefix-summary": "chat.advancedMemory.reason.openScenePrefixSummary",
  "no-relevant-recall": "chat.advancedMemory.reason.noRelevantRecall",
};

export function AdvancedMemoryInspector({
  chatId,
  characters,
}: {
  chatId: string;
  characters: MemoryCharacterOption[];
}) {
  const { t } = useTranslation();
  const status = useAdvancedMemoryStatus(chatId);
  const action = useAdvancedMemoryAction(chatId);
  const exportMemory = useExportAdvancedMemory(chatId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showSources, setShowSources] = useState(false);
  const sources = useAdvancedMemorySources(chatId, showSources ? selectedId : null);
  const records = status.data?.records ?? [];
  const selected = records.find((record) => record.id === selectedId);
  const receipt = status.data?.latestReceipt;
  const pending = action.isPending || status.data?.job.status === "running";
  const characterName = (id: string) => characters.find((character) => character.id === id)?.name ?? id;
  const audience = (record: AdvancedMemoryRecord) =>
    record.audienceCharacterIds.length > 0
      ? record.audienceCharacterIds.map(characterName).join(", ")
      : t("chat.advancedMemory.sharedAudience");
  const openRecord = (record: AdvancedMemoryRecord) => {
    setSelectedId(record.id);
    setDraft(record.content);
    setShowSources(false);
  };
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error(t("chat.advancedMemory.importSize"));
      return;
    }
    try {
      const envelope: unknown = JSON.parse(await file.text());
      await action.mutateAsync({ action: "import", envelope });
    } catch (error) {
      if (error instanceof SyntaxError) toast.error(t("chat.advancedMemory.invalidImport"));
    }
  };

  return (
    <section
      className="space-y-3 border-t border-[var(--border)] pt-3"
      aria-label={t("chat.advancedMemory.archive")}
      data-component="AdvancedMemoryInspector"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold">{t("chat.advancedMemory.archive")}</h4>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={buttonClass}
            disabled={records.length === 0 || exportMemory.isPending}
            onClick={() => exportMemory.mutate()}
          >
            <Upload size="0.75rem" />
            {t("chat.advancedMemory.export")}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,.marinara"
            className="hidden"
            onChange={(event) => void importFile(event)}
          />
          <button type="button" className={buttonClass} disabled={pending} onClick={() => fileInput.current?.click()}>
            <Download size="0.75rem" />
            {t("chat.advancedMemory.import")}
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={pending || records.length === 0}
            onClick={() => action.mutate({ action: "reindex" })}
          >
            <RefreshCw size="0.75rem" />
            {t("chat.advancedMemory.reindex")}
          </button>
        </div>
      </div>
      {status.isLoading && (
        <p role="status" className="text-xs">
          {t("chat.advancedMemory.loading")}
        </p>
      )}
      {status.isError && (
        <p role="alert" className="text-xs text-[var(--destructive)]">
          {t("chat.advancedMemory.failed", { message: status.error.message })}
        </p>
      )}
      {!status.isLoading && !status.isError && records.length === 0 && (
        <p className="text-xs text-[var(--muted-foreground)]">{t("chat.advancedMemory.emptyArchive")}</p>
      )}
      {receipt && (
        <details className="rounded-lg bg-[var(--secondary)] p-3 text-xs">
          <summary className="cursor-pointer font-medium">{t("chat.advancedMemory.receipt")}</summary>
          <div className="mt-2 space-y-2 text-[var(--muted-foreground)]">
            <p>
              {t("chat.advancedMemory.receiptBudget", {
                before: receipt.estimatedTokensBefore,
                after: receipt.estimatedTokensAfter,
                budget: receipt.budgetTokens,
              })}
            </p>
            <p>
              {t("chat.advancedMemory.receiptSources", {
                scenes: receipt.recalledSceneIds.length,
                messages: receipt.recalledMessageIds.length,
              })}
            </p>
            <p className="break-all">
              {t("chat.advancedMemory.boundary")}: {receipt.boundaryMessageId ?? t("chat.advancedMemory.none")}
            </p>
            <p className="break-all">
              {t("chat.advancedMemory.checkpoint")}: {receipt.checkpointId ?? t("chat.advancedMemory.none")}
            </p>
            <p className="break-all">
              {t("chat.advancedMemory.recalledSceneIds")}:{" "}
              {receipt.recalledSceneIds.join(", ") || t("chat.advancedMemory.none")}
            </p>
            <p className="break-all">
              {t("chat.advancedMemory.recalledMessageIds")}:{" "}
              {receipt.recalledMessageIds.join(", ") || t("chat.advancedMemory.none")}
            </p>
            {receipt.reasons.length > 0 && (
              <ul className="list-disc space-y-1 pl-4">
                {receipt.reasons.map((reason, index) => (
                  <li key={index}>{t(reasonKeys[reason] ?? reason, { defaultValue: reason })}</li>
                ))}
              </ul>
            )}
          </div>
        </details>
      )}
      {selected ? (
        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              setSelectedId(null);
              setShowSources(false);
            }}
          >
            {t("chat.advancedMemory.backToArchive")}
          </button>
          <h5 className="break-words text-sm font-semibold">
            {selected.title || t(`chat.advancedMemory.kind.${selected.kind}`)}
          </h5>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("chat.advancedMemory.range", { start: selected.startIndex, end: selected.endIndex })} ·{" "}
            {audience(selected)}
          </p>
          <SettingsSwitch
            label={t("chat.advancedMemory.includeInRecall")}
            checked={selected.enabled}
            disabled={pending}
            onChange={(enabled) => action.mutate({ action: "record", recordId: selected.id, patch: { enabled } })}
            labelPosition="start"
            className="justify-between"
          />
          <label className="block space-y-1 text-xs">
            <span>{t("chat.advancedMemory.summaryText")}</span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={8}
              className="mari-chrome-field min-h-40 w-full resize-y rounded-lg px-3 py-2 text-xs leading-relaxed"
            />
          </label>
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("chat.advancedMemory.editHelp")}</p>
          <button
            type="button"
            className={buttonClass}
            disabled={pending || !draft.trim() || draft === selected.content}
            onClick={() => action.mutate({ action: "record", recordId: selected.id, patch: { content: draft } })}
          >
            {t("chat.advancedMemory.save")}
          </button>
          <button
            type="button"
            className={`${buttonClass} ml-2`}
            aria-expanded={showSources}
            onClick={() => setShowSources((value) => !value)}
          >
            {t("chat.advancedMemory.inspectSources")}
          </button>
          {showSources && (
            <div className="space-y-2 border-t border-[var(--border)] pt-3">
              {sources.isLoading && (
                <p role="status" className="text-xs">
                  {t("chat.advancedMemory.loading")}
                </p>
              )}
              {sources.isError && (
                <p role="alert" className="text-xs text-[var(--destructive)]">
                  {t("chat.advancedMemory.failed", { message: sources.error.message })}
                </p>
              )}
              {(sources.data ?? []).map((message) => (
                <article key={message.id} className="rounded-lg bg-[var(--secondary)] p-2">
                  <p className="mb-1 text-[0.6875rem] font-medium">
                    {message.characterId
                      ? characterName(message.characterId)
                      : t(`chat.advancedMemory.speaker.${message.role}`)}
                  </p>
                  <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed">
                    {message.content}
                  </pre>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {records.map((record) => (
            <li key={record.id}>
              <button
                type="button"
                onClick={() => openRecord(record)}
                className="w-full space-y-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-left hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <span className="block break-words text-xs font-semibold">
                  {record.title || t(`chat.advancedMemory.kind.${record.kind}`)}
                </span>
                <span className="block text-[0.6875rem] text-[var(--muted-foreground)]">
                  {t(`chat.advancedMemory.kind.${record.kind}`)} ·{" "}
                  {t("chat.advancedMemory.range", { start: record.startIndex, end: record.endIndex })}
                </span>
                <span className="block text-[0.6875rem] text-[var(--muted-foreground)]">
                  {audience(record)}
                  {record.timeline ? <> · {record.timeline}</> : null}
                </span>
                <span className="block text-[0.6875rem] text-[var(--muted-foreground)]">
                  {t(record.manualOverride ? "chat.advancedMemory.manual" : "chat.advancedMemory.generated")} ·{" "}
                  {t(`chat.advancedMemory.embedding.${record.embeddingStatus}`)}
                  {!record.enabled ? <> · {t("chat.advancedMemory.disabled")}</> : null}
                </span>
                <span className="line-clamp-3 block text-xs leading-relaxed">{record.content}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
