import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  advancedMemoryProblems,
  normalizeAdvancedMemorySettings,
  type AdvancedMemorySettings as MemorySettings,
} from "@marinara-engine/shared";
import { useDecisionOptions } from "../../hooks/use-decision-model";
import { decisionModelOption } from "../connections/DecisionDefaultControl";
import {
  advancedMemorySceneNumbers,
  markAdvancedMemoryNotified,
  useAdvancedMemoryAction,
  useAdvancedMemoryKnowledgeMessages,
  useAdvancedMemoryStatus,
} from "../../hooks/use-advanced-memory";
import { useUIStore } from "../../stores/ui.store";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { AdvancedMemoryProgress } from "./AdvancedMemoryProgress";
import { useConnections } from "../../hooks/use-connections";
import { useChatMessageCount } from "../../hooks/use-chats";

const fieldClass = "mari-chrome-field w-full rounded-lg px-3 py-2 text-xs disabled:opacity-50";
const actionClass = "mari-chrome-control min-h-9 rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50";
// Scenes with unclear participants are listed with the other scene problems in the Fix box.
const warningKeys: Record<string, string> = {
  "decision-connection-unavailable": "chat.advancedMemory.warning.decisionConnectionUnavailable",
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
  hasHistory = false,
  variant = "drawer",
}: {
  chatId: string;
  metadataSettings: unknown;
  individual: boolean;
  characters: MemoryCharacterOption[];
  connections: Array<{ id: string; name: string; model?: string }>;
  hasHistory?: boolean;
  variant?: "drawer" | "wizard";
}) {
  const { t } = useTranslation();
  const status = useAdvancedMemoryStatus(chatId);
  const action = useAdvancedMemoryAction(chatId);
  const savedConnections = useConnections();
  const decisionConnections = (
    (savedConnections.data ?? []) as Array<{ id: string; name: string; provider: string; model?: string }>
  ).filter((connection) => connection.provider === "decision");
  const settings = status.data?.settings ?? normalizeAdvancedMemorySettings(metadataSettings);
  // The local models the global Decision model offers, greyed out with the reason when one can't answer (#7326).
  const decisionOptions = useDecisionOptions(settings.enabled && settings.decisionEnabled);
  const localDecisionModels = (decisionOptions.data?.options ?? []).filter((entry) => entry.group === "local");
  const [confirmKnowledge, setConfirmKnowledge] = useState(false);
  const [knowledgeCharacterIds, setKnowledgeCharacterIds] = useState<string[]>([]);
  const [knowledgeChoices, setKnowledgeChoices] = useState<Record<string, string>>({});
  const [knowledgeCursors, setKnowledgeCursors] = useState<Array<string | undefined>>([undefined]);
  const [rescanDraft, setRescanDraft] = useState<{ chatId: string; start?: number; end?: number }>({ chatId });
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
  const numberInputsDisabled =
    running || status.isLoading || status.isError || (action.isPending && action.variables?.action !== "settings");
  const disabled = action.isPending || numberInputsDisabled;
  const save = (patch: Partial<MemorySettings> | ((current: MemorySettings) => Partial<MemorySettings>)) =>
    action.mutate({ action: "settings", settings: patch });
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
  // Fix: every scene Advanced Memory flagged, repaired in one run. Hand-edited and unclear ones are listed.
  const problems = status.data ? advancedMemoryProblems(status.data) : null;
  const sceneNumbers = advancedMemorySceneNumbers(status.data);
  const fixResult = status.data?.job.fixResult;
  const showResult = !!fixResult && !running && status.data?.job.id === fixResult.jobId;
  const numbered = (ids: readonly string[]) =>
    [...new Set(ids)].filter((id) => sceneNumbers.has(id)).sort((a, b) => sceneNumbers.get(a)! - sceneNumbers.get(b)!);
  const fixIds = numbered(problems?.fixSceneIds ?? []);
  const reviewIds = numbered([
    ...(problems?.reviewSceneIds ?? []),
    ...(showResult ? fixResult.reviewSceneIds : []),
  ]).filter((id) => !fixIds.includes(id));
  const fixedIds = showResult ? numbered(fixResult.fixedSceneIds) : [];
  const knowledgeBlocked = !!problems?.blockers.includes("needs_confirmation");
  const canFix = fixIds.length > 0 && !knowledgeBlocked && !running && !action.isPending;
  const fixPending = action.isPending && action.variables?.action === "initialize" && !!action.variables.fixAll;
  const fix = () => action.mutate({ action: "initialize", fixAll: true, debugMode: useUIStore.getState().debugMode });
  // Re-scan starts on the ongoing scene, or the latest one when every scene has ended, never on the whole chat.
  const sceneRecords = (status.data?.records ?? []).filter((record) => record.kind === "scene");
  const openScenes = sceneRecords.filter((record) => record.status === "open");
  const latestStart = Math.max(
    1,
    ...(openScenes.length ? openScenes : sceneRecords).map((record) => record.startIndex),
  );
  // A range typed for another chat does not carry over.
  const rescanRange = rescanDraft.chatId === chatId ? rescanDraft : { chatId };
  const messageCount = useChatMessageCount(settings.enabled && variant === "drawer" ? chatId : null);
  const lastMessage = Math.max(1, messageCount.data?.count ?? 0);
  const rescanStart = Math.min(rescanRange.start ?? latestStart, lastMessage);
  const rescanEnd = Math.max(rescanStart, Math.min(rescanRange.end ?? lastMessage, lastMessage));
  const showRescan =
    variant === "drawer" &&
    sceneRecords.length > 0 &&
    !["idle", "needs_confirmation"].includes(status.data?.job.status ?? "idle");
  const rescan = () =>
    action.mutate({
      action: "initialize",
      range: { start: rescanStart, end: rescanEnd },
      debugMode: useUIStore.getState().debugMode,
    });
  const openScene = (sceneId: string) => useUIStore.getState().setAdvancedMemoryRequest({ chatId, sceneId });
  const showFix = variant === "drawer" && settings.enabled && (fixIds.length > 0 || reviewIds.length > 0 || showResult);
  // Re-render when a request arrives; the effect below takes it.
  useUIStore((state) => state.advancedMemoryRequest);
  const problemKey = [...fixIds, ...reviewIds].join(" ");
  useEffect(() => {
    // Seen here, so the notice outside Chat Settings doesn't repeat these scenes.
    if (variant === "drawer" && problemKey) markAdvancedMemoryNotified(chatId, problemKey.split(" "));
  }, [chatId, problemKey, variant]);
  useEffect(() => {
    // The notice's Fix button opens Chat Settings here and starts Fix once memory has loaded.
    // Read the store, not this render's value: the request is taken once.
    const request = useUIStore.getState().advancedMemoryRequest;
    if (variant !== "drawer" || !request?.fix || request.chatId !== chatId || !status.data) return;
    // Wait for running work or another save to finish rather than dropping the request.
    if (!canFix && (action.isPending || running)) return;
    useUIStore.getState().setAdvancedMemoryRequest(null);
    if (canFix) fix();
  });
  const sceneButtons = (ids: string[]) => (
    <span className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          className="mari-chrome-control min-h-9 min-w-9 rounded-lg px-2 py-1 text-xs font-medium tabular-nums"
          aria-label={t("chat.advancedMemory.fix.openScene", { number: sceneNumbers.get(id) })}
          onClick={() => openScene(id)}
        >
          #{sceneNumbers.get(id)}
        </button>
      ))}
    </span>
  );
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
        label={t(variant === "wizard" ? "chat.advancedMemory.wizardTitle" : "chat.advancedMemory.title")}
        description={t(
          variant === "wizard" ? "chat.advancedMemory.wizardDescription" : "chat.advancedMemory.description",
        )}
        checked={settings.enabled}
        disabled={action.isPending || (!settings.enabled && numberInputsDisabled)}
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
        <div className="space-y-3">
          {status.data && (
            <AdvancedMemoryProgress
              chatId={chatId}
              status={status.data}
              // A paused or stopped Fix resumes as Fix, so a hand-edited scene can't stop it.
              onResume={status.data.job.fixResult === null && !knowledgeBlocked ? fix : initialize}
              pending={action.isPending && action.variables?.action === "initialize"}
            />
          )}
          {hasHistory && (status.data?.job.status === "idle" || status.data?.job.status === "needs_confirmation") && (
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              {t("chat.advancedMemory.prepareHistoryHelp")}
            </p>
          )}
          {showFix && (
            <section
              aria-label={t("chat.advancedMemory.fix.title")}
              data-component="AdvancedMemoryFix"
              className="space-y-2 rounded-lg border border-[var(--marinara-app-accent-static)] bg-[var(--secondary)] p-3 text-xs"
            >
              <div role="status" aria-live="polite" className="space-y-2">
                {showResult && (
                  <div className="space-y-1.5">
                    <p className="font-medium">
                      {fixedIds.length
                        ? t("chat.advancedMemory.fix.fixed", { count: fixedIds.length })
                        : t("chat.advancedMemory.fix.noneFixed")}
                    </p>
                    {sceneButtons(fixedIds)}
                  </div>
                )}
                {reviewIds.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="font-medium">{t("chat.advancedMemory.fix.review", { count: reviewIds.length })}</p>
                    {sceneButtons(reviewIds)}
                  </div>
                )}
                {fixIds.length > 0 && (
                  <p className="font-medium">{t("chat.advancedMemory.fix.needsFixing", { count: fixIds.length })}</p>
                )}
              </div>
              {fixIds.length > 0 && (
                <>
                  <p className="leading-relaxed text-[var(--muted-foreground)]">
                    {t(knowledgeBlocked ? "chat.advancedMemory.fix.confirmKnowledge" : "chat.advancedMemory.fix.help")}
                  </p>
                  {knowledgeBlocked ? (
                    <button type="button" className={`${actionClass} w-full`} disabled={disabled} onClick={initialize}>
                      {t("chat.advancedMemory.confirmKnowledge")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`${actionClass} w-full disabled:cursor-wait`}
                      disabled={!canFix}
                      aria-busy={fixPending}
                      onClick={fix}
                    >
                      {t("chat.advancedMemory.fix.action")}
                    </button>
                  )}
                </>
              )}
            </section>
          )}
          {status.data?.warnings?.some((warning) => warningKeys[warning]) ? (
            <ul className="list-disc space-y-1 pl-4 text-xs text-[var(--muted-foreground)]">
              {status.data.warnings
                .filter((warning) => warningKeys[warning])
                .map((warning) => (
                  <li key={warning}>{t(warningKeys[warning]!)}</li>
                ))}
            </ul>
          ) : null}
          {/* Chat Settings follows its window's width; the setup wizard follows the screen. */}
          <div
            className={
              variant === "drawer" ? "grid grid-cols-1 gap-3 @lg:grid-cols-2" : "grid grid-cols-1 gap-3 sm:grid-cols-2"
            }
          >
            <label className="space-y-1 text-xs">
              <span>{t("chat.advancedMemory.contextCap")}</span>
              <DraftNumberInput
                value={settings.maxContextTokens}
                min={1024}
                max={10_000_000}
                disabled={numberInputsDisabled}
                onCommit={(maxContextTokens) =>
                  save((current) => ({
                    maxContextTokens,
                    summaryBudgetTokens: Math.min(current.summaryBudgetTokens, maxContextTokens - 1),
                  }))
                }
                ariaLabel={t("chat.advancedMemory.contextCap")}
                className={fieldClass}
              />
            </label>
            <label className="space-y-1 text-xs">
              <span>{t("chat.advancedMemory.memoryBudget")}</span>
              <DraftNumberInput
                value={settings.summaryBudgetTokens}
                min={64}
                max={131_072}
                disabled={numberInputsDisabled}
                onCommit={(summaryBudgetTokens) =>
                  save((current) => ({
                    summaryBudgetTokens: Math.min(summaryBudgetTokens, current.maxContextTokens - 1),
                  }))
                }
                ariaLabel={t("chat.advancedMemory.memoryBudget")}
                className={fieldClass}
              />
            </label>
          </div>
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("chat.advancedMemory.budgetHelp")}</p>
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            {t("chat.advancedMemory.memoryAllocationHelp")}
          </p>
          <SettingsSwitch
            label={t("chat.advancedMemory.decisionEnabled")}
            description={t("chat.advancedMemory.decisionDescription")}
            checked={settings.decisionEnabled}
            disabled={disabled}
            onChange={(decisionEnabled) => save({ decisionEnabled })}
            labelPosition="start"
            className="justify-between rounded-md bg-[var(--secondary)] px-3 py-2.5 text-left"
            labelClassName="text-xs font-medium"
          />
          {settings.decisionEnabled && (
            <div className="space-y-2">
              <label className="block space-y-1 text-xs">
                <span>{t("chat.advancedMemory.decisionConnection")}</span>
                <select
                  value={settings.decisionConnectionId ?? ""}
                  disabled={
                    disabled ||
                    savedConnections.isLoading ||
                    savedConnections.isError ||
                    decisionOptions.isLoading ||
                    decisionOptions.isError
                  }
                  className={fieldClass}
                  onChange={(event) => save({ decisionConnectionId: event.target.value || null })}
                >
                  <option value="">{t("chat.advancedMemory.chooseDecisionConnection")}</option>
                  {settings.decisionConnectionId &&
                    ![...localDecisionModels, ...decisionConnections].some(
                      (choice) => choice.id === settings.decisionConnectionId,
                    ) && (
                      <option value={settings.decisionConnectionId}>
                        {t("chat.advancedMemory.missingConnection")}
                      </option>
                    )}
                  {localDecisionModels.length > 0 && (
                    <optgroup label={t("connections.decision.localGroup")}>
                      {localDecisionModels.map((entry) => decisionModelOption(t, entry))}
                    </optgroup>
                  )}
                  {decisionConnections.length > 0 && (
                    <optgroup label={t("connections.decision.connectionGroup")}>
                      {decisionConnections.map((connection) => (
                        <option key={connection.id} value={connection.id}>
                          {connection.name}
                          {connection.model ? <> · {connection.model}</> : null}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              {/* Either list failing leaves the choice incomplete; the steady accent does not pulse. */}
              {(savedConnections.isError || decisionOptions.isError) && (
                <p role="alert" className="text-xs text-[var(--marinara-app-accent-static)]">
                  {t("chat.advancedMemory.failed", {
                    message: (savedConnections.error ?? decisionOptions.error)?.message,
                  })}{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      if (savedConnections.isError) void savedConnections.refetch();
                      if (decisionOptions.isError) void decisionOptions.refetch();
                    }}
                  >
                    {t("chat.advancedMemory.retry")}
                  </button>
                </p>
              )}
              <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                {t("chat.advancedMemory.decisionHelp")}
              </p>
            </div>
          )}
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
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            {t("chat.advancedMemory.summaryGenerationHelp")}
          </p>
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {t("chat.advancedMemory.resolvedModels", {
              helper: status.data?.helperModel ?? t("chat.advancedMemory.unavailable"),
              summary: status.data?.summaryModel ?? t("chat.advancedMemory.unavailable"),
            })}
          </p>
          <label className="block space-y-1 text-xs">
            <span>{t("chat.advancedMemory.sceneCheckInterval")}</span>
            <DraftNumberInput
              value={settings.sceneCheckInterval}
              min={1}
              max={100}
              disabled={numberInputsDisabled}
              onCommit={(sceneCheckInterval) => save({ sceneCheckInterval })}
              ariaLabel={t("chat.advancedMemory.sceneCheckInterval")}
              className={fieldClass}
            />
            <span className="block text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
              {t("chat.advancedMemory.sceneCheckIntervalHelp")}
            </span>
          </label>
          <h4 className="text-xs font-medium">{t("chat.advancedMemory.movingContext")}</h4>
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("chat.advancedMemory.windowHelp")}</p>
          <label className="block space-y-1 text-xs">
            <span>{t("chat.advancedMemory.maximumScenes")}</span>
            <DraftNumberInput
              value={settings.retrieveMaxScenes}
              min={0}
              max={50}
              disabled={numberInputsDisabled}
              onCommit={(retrieveMaxScenes) => save({ retrieveMaxScenes })}
              ariaLabel={t("chat.advancedMemory.maximumScenes")}
              className={fieldClass}
            />
            <span className="block text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
              {t("chat.advancedMemory.maximumScenesHelp")}
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs">
              <span>{t("chat.advancedMemory.minimumMessages")}</span>
              <DraftNumberInput
                value={settings.retrieveMinMessages}
                min={0}
                max={50}
                disabled={numberInputsDisabled}
                onCommit={(retrieveMinMessages) =>
                  save((current) => ({
                    retrieveMinMessages,
                    retrieveMaxMessages: Math.max(retrieveMinMessages, current.retrieveMaxMessages),
                  }))
                }
                ariaLabel={t("chat.advancedMemory.minimumMessages")}
                className={fieldClass}
              />
            </label>
            <label className="space-y-1 text-xs">
              <span>{t("chat.advancedMemory.maximumMessages")}</span>
              <DraftNumberInput
                value={settings.retrieveMaxMessages}
                min={0}
                max={50}
                disabled={numberInputsDisabled}
                onCommit={(retrieveMaxMessages) =>
                  save((current) => ({
                    retrieveMaxMessages,
                    retrieveMinMessages: Math.min(retrieveMaxMessages, current.retrieveMinMessages),
                  }))
                }
                ariaLabel={t("chat.advancedMemory.maximumMessages")}
                className={fieldClass}
              />
            </label>
          </div>
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
          {individual && characters.length > 1 && (
            <SettingsSwitch
              label={t("chat.advancedMemory.autoMessageVisibility")}
              description={t("chat.advancedMemory.autoMessageVisibilityHelp")}
              checked={settings.autoMessageVisibility}
              disabled={disabled}
              onChange={(autoMessageVisibility) => save({ autoMessageVisibility })}
              labelPosition="start"
              className="justify-between rounded-md bg-[var(--secondary)] px-3 py-2.5 text-left"
              labelClassName="text-xs font-medium"
            />
          )}
          {showRescan && (
            <section
              aria-label={t("chat.advancedMemory.rescan.title")}
              data-component="AdvancedMemoryRescan"
              className="space-y-2 rounded-lg bg-[var(--secondary)] p-3 text-xs"
            >
              <h4 className="font-medium">{t("chat.advancedMemory.rescan.title")}</h4>
              <p className="leading-relaxed text-[var(--muted-foreground)]">{t("chat.advancedMemory.rescan.help")}</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span>{t("chat.advancedMemory.rescan.from")}</span>
                  <DraftNumberInput
                    value={rescanStart}
                    min={1}
                    max={lastMessage}
                    disabled={numberInputsDisabled}
                    onCommit={(start) => setRescanDraft({ ...rescanRange, chatId, start })}
                    ariaLabel={t("chat.advancedMemory.rescan.from")}
                    className={fieldClass}
                  />
                </label>
                <label className="space-y-1">
                  <span>{t("chat.advancedMemory.rescan.to")}</span>
                  <DraftNumberInput
                    value={rescanEnd}
                    min={1}
                    max={lastMessage}
                    disabled={numberInputsDisabled}
                    onCommit={(end) => setRescanDraft({ ...rescanRange, chatId, end })}
                    ariaLabel={t("chat.advancedMemory.rescan.to")}
                    className={fieldClass}
                  />
                </label>
              </div>
              <button
                type="button"
                className={`${actionClass} w-full`}
                disabled={disabled || !messageCount.data}
                onClick={rescan}
              >
                {t("chat.advancedMemory.rescan.action")}
              </button>
            </section>
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
