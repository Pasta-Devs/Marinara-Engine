// The window that opens when an agent is added to a chat: its budget, run interval and setup before it's added.
// The drawer renders it outside the Agents section, since the agent setup queue opens it while Agents is collapsed.
import { useTranslation as useUiTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { DEFAULT_AGENT_CONTEXT_SIZE, MIN_AGENT_MAX_TOKENS, type Lorebook } from "@marinara-engine/shared";
import { AgentAddSetupFields } from "../../../components/chat/AgentAddSetupFields";
import { NeedsModelChip, agentModelNeed } from "../../../components/connections/NeedsModelChip";
import { Modal } from "../../../components/ui/Modal";
import { SHEET_BUTTON_PRIMARY, SHEET_BUTTON_QUIET } from "../../../components/ui/neutral-surface-styles";
import { useLorebooks } from "../../../hooks/use-lorebooks";
import { getCadenceInputValue, parseCadenceInputValue, stepCadenceValue } from "../../../lib/agent-cadence";
import { useLocalizedUiText } from "../../../localization/use-localized-ui-text";
import { normalizeAgentMaxTokens, type ChatAgents } from "./use-chat-agents";

function normalizeAgentMaxTokensInputValue(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.trunc(value));
}

export function AgentAddModal({ agents }: { agents: ChatAgents }) {
  const { t: localizeUi } = useUiTranslation();
  const localizeText = useLocalizedUiText();
  const { data: lorebooks } = useLorebooks();
  const {
    supportsNarrativeDirectorSecretPlot,
    getPromptOptionsForAgent,
    agentAddSpriteSubjects,
    agentAddPreview,
    setAgentAddPreview,
    setAgentSetupQueue,
    agentAddCadenceInputFocused,
    setAgentAddCadenceInputFocused,
    addingAgentToChat,
    confirmAddAgent,
    agentAddIntervalMeta,
    agentAddIsRuntimeDisabled,
    agentAddIsFeature,
  } = agents;

  return (
    <Modal
      open={!!agentAddPreview}
      onClose={() => {
        if (!addingAgentToChat) {
          setAgentAddPreview(null);
          setAgentSetupQueue([]);
        }
      }}
      title={
        agentAddPreview
          ? localizeUi("ui.chat.chatsettingsdrawer.addValue1", { value1: agentAddPreview.agent.name })
          : localizeUi("ui.chat.chatsettingsdrawer.addAgent")
      }
      footer={
        <>
          <button onClick={confirmAddAgent} disabled={addingAgentToChat} className={SHEET_BUTTON_PRIMARY}>
            {addingAgentToChat
              ? localizeUi("ui.chat.chatsettingsdrawer.adding")
              : localizeUi("ui.chat.chatsettingsdrawer.addAgent")}
          </button>
          <button
            onClick={() => {
              setAgentAddPreview(null);
              setAgentSetupQueue([]);
            }}
            disabled={addingAgentToChat}
            className={SHEET_BUTTON_QUIET}
          >
            {localizeUi("chat.delete.dialog.cancel")}
          </button>
        </>
      }
      closeButtonClassName="max-sm:hidden"
      width="max-w-lg"
      chatFloatingPanel
    >
      {agentAddPreview && (
        <div className="space-y-4">
          <div className="rounded-xl bg-[var(--secondary)]/80 px-4 py-3 ring-1 ring-[var(--border)]">
            <div className="flex items-start gap-3">
              <Sparkles size="1rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{agentAddPreview.agent.name}</p>
                  <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[0.5625rem] max-sm:text-[13px] uppercase tracking-wide text-[var(--muted-foreground)]">
                    {agentAddPreview.agent.builtIn
                      ? agentAddPreview.agent.category
                      : localizeUi("ui.agents.toolcard.custom")}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs max-sm:text-[13px] leading-5 text-[var(--muted-foreground)]">
                  {agentAddPreview.agent.description || "No description available."}
                </p>
                {(() => {
                  const need = agentModelNeed(agentAddPreview.agent.id, agentAddPreview.config?.settings);
                  return need && <NeedsModelChip kind={need.kind} own={need.own} className="mt-2" />;
                })()}
              </div>
            </div>
          </div>

          {agentAddIsFeature ? (
            <div className="rounded-xl bg-[var(--secondary)]/70 px-3 py-2.5 text-[0.6875rem] max-sm:text-[13px] leading-5 text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              {localizeUi("ui.chat.chatsettingsdrawer.thisLetsCharactersInitiateTheDownloadedFeatureInThis")}
            </div>
          ) : agentAddIsRuntimeDisabled ? (
            <div className="rounded-xl bg-[var(--secondary)]/70 px-3 py-2.5 text-[0.6875rem] max-sm:text-[13px] leading-5 text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              {localizeUi("ui.chat.chatsettingsdrawer.thisAddsItsInstructionsToTheNextRoleplayPrompt")}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="block text-[0.6875rem] max-sm:text-[13px] font-semibold text-[var(--foreground)]">
                {localizeUi("ui.agents.agenteditor.agentBudget")}
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[0.625rem] max-sm:text-[13px] font-medium text-[var(--muted-foreground)]">
                    {localizeUi("ui.agents.agenteditor.contextSize")}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={agentAddPreview.contextSize}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        setAgentAddPreview((current) =>
                          current
                            ? {
                                ...current,
                                contextSize: Number.isFinite(value)
                                  ? Math.max(1, Math.min(200, value))
                                  : DEFAULT_AGENT_CONTEXT_SIZE,
                              }
                            : current,
                        );
                      }}
                      disabled={addingAgentToChat}
                      className="w-28 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm max-sm:text-base tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <span className="text-[0.6875rem] max-sm:text-[13px] text-[var(--muted-foreground)]">
                      {localizeUi("ui.agents.agenteditor.messages")}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[0.625rem] max-sm:text-[13px] font-medium text-[var(--muted-foreground)]">
                    {localizeUi("ui.agents.agenteditor.maxOutputTokens")}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={MIN_AGENT_MAX_TOKENS}
                      value={agentAddPreview.maxTokens}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        setAgentAddPreview((current) =>
                          current
                            ? {
                                ...current,
                                maxTokens: normalizeAgentMaxTokensInputValue(
                                  Number.isFinite(value) ? value : undefined,
                                ),
                              }
                            : current,
                        );
                      }}
                      onBlur={() => {
                        setAgentAddPreview((current) =>
                          current ? { ...current, maxTokens: normalizeAgentMaxTokens(current.maxTokens) } : current,
                        );
                      }}
                      disabled={addingAgentToChat}
                      className="w-32 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm max-sm:text-base tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <span className="text-[0.6875rem] max-sm:text-[13px] text-[var(--muted-foreground)]">
                      {localizeUi("ui.agents.agenteditor.tokens")}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-[0.625rem] max-sm:text-[13px] text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.chatsettingsdrawer.contextSizeControlsRecentChatMessagesMaxOutputReserves")}
              </p>
            </div>
          )}

          {agentAddIntervalMeta && agentAddPreview.runInterval != null && (
            <div className="space-y-1.5">
              <label className="block text-[0.6875rem] max-sm:text-[13px] font-semibold text-[var(--foreground)]">
                {localizeText(agentAddIntervalMeta.label)}
              </label>
              <div className="flex items-center gap-3">
                {agentAddPreview.agent.builtIn ? (
                  <input
                    type="number"
                    min={agentAddIntervalMeta.min ?? 1}
                    max={agentAddIntervalMeta.max}
                    value={agentAddPreview.runInterval}
                    onChange={(e) => {
                      setAgentAddPreview((current) =>
                        current
                          ? {
                              ...current,
                              runInterval: parseCadenceInputValue(
                                e.target.value,
                                agentAddIntervalMeta.defaultValue,
                                agentAddIntervalMeta.max,
                                agentAddIntervalMeta.min,
                              ),
                            }
                          : current,
                      );
                    }}
                    disabled={addingAgentToChat}
                    className="w-28 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm max-sm:text-base tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                ) : (
                  <div className="relative w-28">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        agentAddCadenceInputFocused
                          ? String(agentAddPreview.runInterval)
                          : getCadenceInputValue(agentAddPreview.runInterval)
                      }
                      onFocus={(e) => {
                        setAgentAddCadenceInputFocused(true);
                        e.target.select();
                      }}
                      onBlur={() => setAgentAddCadenceInputFocused(false)}
                      onKeyDown={(e) => {
                        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                        e.preventDefault();
                        const delta = e.key === "ArrowUp" ? 1 : -1;
                        setAgentAddPreview((current) =>
                          current
                            ? {
                                ...current,
                                runInterval: stepCadenceValue(
                                  current.runInterval ?? 1,
                                  delta,
                                  agentAddIntervalMeta.max,
                                  agentAddIntervalMeta.min,
                                ),
                              }
                            : current,
                        );
                      }}
                      onChange={(e) => {
                        setAgentAddPreview((current) =>
                          current
                            ? {
                                ...current,
                                runInterval: parseCadenceInputValue(
                                  e.target.value,
                                  current.runInterval ?? 1,
                                  agentAddIntervalMeta.max,
                                  agentAddIntervalMeta.min,
                                ),
                              }
                            : current,
                        );
                      }}
                      disabled={addingAgentToChat}
                      className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 pr-8 text-sm max-sm:text-base tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <div className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-md">
                      <button
                        type="button"
                        aria-label={localizeUi("ui.agents.agenteditor.increaseTriggerCadence")}
                        disabled={addingAgentToChat}
                        onClick={() => {
                          setAgentAddPreview((current) =>
                            current
                              ? {
                                  ...current,
                                  runInterval: stepCadenceValue(
                                    current.runInterval ?? 1,
                                    1,
                                    agentAddIntervalMeta.max,
                                    agentAddIntervalMeta.min,
                                  ),
                                }
                              : current,
                          );
                        }}
                        className="flex h-4 w-5 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ChevronUp size="0.6875rem" />
                      </button>
                      <button
                        type="button"
                        aria-label={localizeUi("ui.agents.agenteditor.decreaseTriggerCadence")}
                        disabled={addingAgentToChat}
                        onClick={() => {
                          setAgentAddPreview((current) =>
                            current
                              ? {
                                  ...current,
                                  runInterval: stepCadenceValue(
                                    current.runInterval ?? 1,
                                    -1,
                                    agentAddIntervalMeta.max,
                                    agentAddIntervalMeta.min,
                                  ),
                                }
                              : current,
                          );
                        }}
                        className="flex h-4 w-5 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ChevronDown size="0.6875rem" />
                      </button>
                    </div>
                  </div>
                )}
                <span className="text-[0.6875rem] max-sm:text-[13px] text-[var(--muted-foreground)]">
                  {agentAddIntervalMeta.unit}
                </span>
              </div>
              <p className="text-[0.625rem] max-sm:text-[13px] text-[var(--muted-foreground)]">
                {agentAddPreview.agent.id === "illustrator"
                  ? localizeUi("agents.illustrator.chatRunIntervalHelp")
                  : agentAddIntervalMeta.help}
              </p>
            </div>
          )}

          <AgentAddSetupFields
            agentId={agentAddPreview.agent.id}
            value={agentAddPreview.setup}
            disabled={addingAgentToChat}
            lorebooks={(lorebooks ?? []) as Lorebook[]}
            promptOptions={getPromptOptionsForAgent(agentAddPreview.agent.id)}
            spriteSubjects={agentAddSpriteSubjects}
            allowSecretPlotControls={supportsNarrativeDirectorSecretPlot}
            onChange={(patch) =>
              setAgentAddPreview((current) =>
                current ? { ...current, setup: { ...current.setup, ...patch } } : current,
              )
            }
          />
        </div>
      )}
    </Modal>
  );
}
