import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  normalizeAdvancedMemorySettings,
  type AdvancedMemorySettings as MemorySettings,
} from "@marinara-engine/shared";
import {
  useAdvancedMemoryAction,
  useAdvancedMemoryKnowledgeMessages,
  useAdvancedMemoryStatus,
} from "../../hooks/use-advanced-memory";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { AdvancedMemoryProgress } from "./AdvancedMemoryProgress";

const fieldClass = "mari-chrome-field w-full rounded-lg px-3 py-2 text-xs disabled:opacity-50";
const actionClass = "mari-chrome-control min-h-9 rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50";
const warningKeys: Record<string, string> = {
  "unscoped-agent-memory": "chat.advancedMemory.warning.unscopedAgentMemory",
  "unscoped-summaries": "chat.advancedMemory.warning.unscopedSummaries",
};

export interface MemoryCharacterOption {
  id: string;
  name: string;
}

export function AdvancedMemorySettings({
  chatId,
  metadataSettings,
  individual,
  characters,
  connections,
}: {
  chatId: string;
  metadataSettings: unknown;
  individual: boolean;
  characters: MemoryCharacterOption[];
  connections: Array<{ id: string; name: string; model?: string }>;
}) {
  const { t } = useTranslation();
  const status = useAdvancedMemoryStatus(chatId);
  const action = useAdvancedMemoryAction(chatId);
  const settings = status.data?.settings ?? normalizeAdvancedMemorySettings(metadataSettings);
  const [confirmKnowledge, setConfirmKnowledge] = useState(false);
  const [knowledgeCharacterIds, setKnowledgeCharacterIds] = useState<string[]>([]);
  const [knowledgeChoices, setKnowledgeChoices] = useState<Record<string, string>>({});
  const [knowledgeCursors, setKnowledgeCursors] = useState<Array<string | undefined>>([undefined]);
  const knowledgePanelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!settings.enabled) setConfirmKnowledge(false);
  }, [settings.enabled]);
  useEffect(() => {
    if (!confirmKnowledge) return;
    const frame = window.requestAnimationFrame(() => {
      knowledgePanelRef.current?.scrollIntoView({ block: "nearest" });
      knowledgePanelRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [confirmKnowledge]);
  const messages = useAdvancedMemoryKnowledgeMessages(chatId, confirmKnowledge, knowledgeCursors.at(-1));
  const firstKnowledgeMessage = messages.data?.[0];
  const lastKnowledgeMessage = messages.data?.at(-1);
  const missing = status.data?.missingKnowledgeCharacterIds ?? [];
  const running = status.data?.job.status === "running";
  const disabled = action.isPending || running || status.isLoading || status.isError;
  const save = (patch: Partial<MemorySettings>) => action.mutate({ action: "settings", settings: patch });
  const initialize = () => {
    if (individual && missing.length > 0) {
      setKnowledgeCharacterIds(missing);
      setKnowledgeChoices({});
      setKnowledgeCursors([undefined]);
      setConfirmKnowledge(true);
    } else {
      action.mutate({ action: "initialize" });
    }
  };
  const reviewKnowledge = () => {
    const ids = characters
      .filter((character) => character.id !== settings.narratorCharacterId)
      .map((character) => character.id);
    const choices: Record<string, string> = {};
    for (const id of ids) {
      const known = Object.hasOwn(settings.knowledgeStarts, id)
        ? settings.knowledgeStarts[id]
        : status.data?.effectiveKnowledgeStarts?.[id];
      if (!missing.includes(id) && known !== undefined) choices[id] = known ?? "beginning";
    }
    setKnowledgeCharacterIds(ids);
    setKnowledgeChoices(choices);
    setKnowledgeCursors([undefined]);
    setConfirmKnowledge(true);
  };
  const confirmAndInitialize = () => {
    const knowledgeStarts = { ...settings.knowledgeStarts };
    for (const id of knowledgeCharacterIds) {
      const choice = knowledgeChoices[id];
      if (!choice && missing.includes(id)) return;
      if (!choice) continue;
      knowledgeStarts[id] = choice === "beginning" ? null : choice;
    }
    action.mutate(
      { action: "initialize", settings: { knowledgeStarts, knowledgeConfirmed: true } },
      { onSuccess: () => setConfirmKnowledge(false) },
    );
  };

  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-3" data-component="AdvancedMemorySettings">
      <SettingsSwitch
        label={t("chat.advancedMemory.title")}
        description={t("chat.advancedMemory.description")}
        checked={settings.enabled}
        disabled={disabled}
        onChange={(enabled) => save({ enabled })}
        labelPosition="start"
        className="justify-between rounded-md bg-[var(--secondary)] px-3 py-2.5 text-left"
        labelClassName="text-xs font-medium"
      />
      {status.isError && (
        <p role="alert" className="text-xs text-[var(--destructive)]">
          {t("chat.advancedMemory.failed", { message: status.error.message })}{" "}
          <button type="button" className="underline" onClick={() => void status.refetch()}>
            {t("chat.advancedMemory.retry")}
          </button>
        </p>
      )}
      {settings.enabled && (
        <div className="space-y-3 px-1">
          {status.data && <AdvancedMemoryProgress chatId={chatId} status={status.data} onResume={initialize} />}
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            {t("chat.advancedMemory.summaryHelp")}
          </p>
          {status.data?.warnings?.length ? (
            <ul className="list-disc space-y-1 pl-4 text-xs text-[var(--muted-foreground)]">
              {status.data.warnings.map((warning, index) => (
                <li key={index}>{t(warningKeys[warning] ?? warning, { defaultValue: warning })}</li>
              ))}
            </ul>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs">
              <span>{t("chat.advancedMemory.contextCap")}</span>
              <DraftNumberInput
                value={settings.maxContextTokens}
                min={1024}
                max={10_000_000}
                disabled={disabled}
                onCommit={(maxContextTokens) =>
                  save({
                    maxContextTokens,
                    summaryBudgetTokens: Math.min(settings.summaryBudgetTokens, maxContextTokens - 1),
                  })
                }
                ariaLabel={t("chat.advancedMemory.contextCap")}
                className={fieldClass}
              />
            </label>
            <label className="space-y-1 text-xs">
              <span>{t("chat.advancedMemory.summaryBudget")}</span>
              <DraftNumberInput
                value={settings.summaryBudgetTokens}
                min={64}
                max={Math.min(131_072, settings.maxContextTokens - 1)}
                disabled={disabled}
                onCommit={(summaryBudgetTokens) => save({ summaryBudgetTokens })}
                ariaLabel={t("chat.advancedMemory.summaryBudget")}
                className={fieldClass}
              />
            </label>
          </div>
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("chat.advancedMemory.budgetHelp")}</p>
          <label className="block space-y-1 text-xs">
            <span>{t("chat.advancedMemory.helperModel")}</span>
            <select
              value={settings.helperConnectionId ?? ""}
              disabled={disabled}
              className={fieldClass}
              onChange={(event) => save({ helperConnectionId: event.target.value || null })}
            >
              <option value="">{t("chat.advancedMemory.defaultAgentConnection")}</option>
              {settings.helperConnectionId && !connections.some((item) => item.id === settings.helperConnectionId) && (
                <option value={settings.helperConnectionId}>{t("chat.advancedMemory.missingConnection")}</option>
              )}
              {connections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.model ? <> · {item.model}</> : null}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {t("chat.advancedMemory.resolvedModels", {
              helper: status.data?.helperModel ?? t("chat.advancedMemory.unavailable"),
              summary: status.data?.summaryModel ?? t("chat.advancedMemory.unavailable"),
            })}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs">
              <span>{t("chat.advancedMemory.minimumMessages")}</span>
              <DraftNumberInput
                value={settings.retrieveMinMessages}
                min={1}
                max={settings.retrieveMaxMessages}
                disabled={disabled}
                onCommit={(retrieveMinMessages) => save({ retrieveMinMessages })}
                ariaLabel={t("chat.advancedMemory.minimumMessages")}
                className={fieldClass}
              />
            </label>
            <label className="space-y-1 text-xs">
              <span>{t("chat.advancedMemory.maximumMessages")}</span>
              <DraftNumberInput
                value={settings.retrieveMaxMessages}
                min={settings.retrieveMinMessages}
                max={50}
                disabled={disabled}
                onCommit={(retrieveMaxMessages) => save({ retrieveMaxMessages })}
                ariaLabel={t("chat.advancedMemory.maximumMessages")}
                className={fieldClass}
              />
            </label>
          </div>
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("chat.advancedMemory.windowHelp")}</p>
          <label className="block space-y-1 text-xs">
            <span>{t("chat.advancedMemory.initialModel")}</span>
            <select
              value={settings.initialProcessingModel}
              disabled={disabled}
              className={fieldClass}
              onChange={(event) => save({ initialProcessingModel: event.target.value as "main" | "helper" })}
            >
              <option value="helper">{t("chat.advancedMemory.helperModel")}</option>
              <option value="main">{t("chat.advancedMemory.mainModel")}</option>
            </select>
          </label>
          {individual && (
            <label className="block space-y-1 text-xs">
              <span>{t("chat.advancedMemory.narrator")}</span>
              <select
                value={settings.narratorCharacterId ?? ""}
                aria-label={t("chat.advancedMemory.narrator")}
                disabled={disabled}
                className={fieldClass}
                onChange={(event) => save({ narratorCharacterId: event.target.value || null })}
              >
                <option value="">{t("chat.advancedMemory.none")}</option>
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
              <span className="block text-[0.6875rem] text-[var(--muted-foreground)]">
                {t("chat.advancedMemory.narratorHelp")}
              </span>
            </label>
          )}
          {individual && (
            <button type="button" className={`${actionClass} w-full`} disabled={disabled} onClick={reviewKnowledge}>
              {t("chat.advancedMemory.reviewKnowledge")}
            </button>
          )}
          {(status.data?.job.status === "idle" || status.data?.job.status === "needs_confirmation") && (
            <button type="button" disabled={disabled} className={`${actionClass} w-full`} onClick={initialize}>
              {t("chat.advancedMemory.initialize")}
            </button>
          )}
        </div>
      )}
      {confirmKnowledge && (
        <section
          ref={knowledgePanelRef}
          tabIndex={-1}
          className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
          aria-label={t("chat.advancedMemory.confirmKnowledge")}
        >
          <h4 className="text-sm font-semibold">{t("chat.advancedMemory.confirmKnowledge")}</h4>
          <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
            {t("chat.advancedMemory.knowledgeHelp")}
          </p>
          {messages.isLoading && (
            <p role="status" className="text-sm">
              {t("chat.advancedMemory.loading")}
            </p>
          )}
          {messages.isError && (
            <p role="alert" className="text-sm text-[var(--destructive)]">
              {t("chat.advancedMemory.failed", { message: messages.error.message })}
            </p>
          )}
          {knowledgeCharacterIds.map((id) => (
            <label key={id} className="block space-y-1 text-sm">
              <span>{characters.find((character) => character.id === id)?.name ?? id}</span>
              <select
                className={fieldClass}
                value={knowledgeChoices[id] ?? ""}
                disabled={messages.isLoading || action.isPending}
                onChange={(event) => setKnowledgeChoices((current) => ({ ...current, [id]: event.target.value }))}
              >
                <option value="" disabled={missing.includes(id)}>
                  {t(
                    missing.includes(id)
                      ? "chat.advancedMemory.chooseKnowledgeStart"
                      : "chat.advancedMemory.keepKnowledgeStart",
                  )}
                </option>
                <option value="beginning">{t("chat.advancedMemory.fromBeginning")}</option>
                {knowledgeChoices[id] &&
                  knowledgeChoices[id] !== "beginning" &&
                  !messages.data?.some((message) => message.id === knowledgeChoices[id]) && (
                    <option value={knowledgeChoices[id]}>{t("chat.advancedMemory.selectedOutsidePage")}</option>
                  )}
                {(messages.data ?? []).map((message) => (
                  <option key={message.id} value={message.id}>
                    {t("chat.advancedMemory.messageChoice", {
                      number: message.rowid,
                      excerpt: message.content.replace(/\s+/gu, " ").slice(0, 90),
                    })}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <div className="space-y-2">
            {firstKnowledgeMessage && lastKnowledgeMessage && (
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("chat.advancedMemory.knowledgePage", {
                  start: firstKnowledgeMessage.rowid,
                  end: lastKnowledgeMessage.rowid,
                })}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={actionClass}
                disabled={
                  messages.isFetching || action.isPending || !firstKnowledgeMessage || firstKnowledgeMessage.rowid <= 1
                }
                onClick={() => {
                  if (!firstKnowledgeMessage) return;
                  setKnowledgeCursors((current) => [
                    ...current,
                    `${firstKnowledgeMessage.createdAt}|${encodeURIComponent(firstKnowledgeMessage.id)}`,
                  ]);
                }}
              >
                {t("chat.advancedMemory.olderMessages")}
              </button>
              <button
                type="button"
                className={actionClass}
                disabled={messages.isFetching || action.isPending || knowledgeCursors.length <= 1}
                onClick={() => setKnowledgeCursors((current) => current.slice(0, -1))}
              >
                {t("chat.advancedMemory.newerMessages")}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={confirmAndInitialize}
            className={`${actionClass} w-full`}
            disabled={
              action.isPending ||
              messages.isLoading ||
              messages.isError ||
              missing.some((id) => knowledgeCharacterIds.includes(id) && !knowledgeChoices[id])
            }
          >
            {t("chat.advancedMemory.confirmAndInitialize")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmKnowledge(false)}
            className={`${actionClass} w-full`}
            disabled={action.isPending}
          >
            {t("chat.advancedMemory.cancelSetup")}
          </button>
        </section>
      )}
    </div>
  );
}
