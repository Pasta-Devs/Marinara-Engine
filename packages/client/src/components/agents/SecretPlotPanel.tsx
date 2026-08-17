import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Eye, EyeOff, RefreshCw, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Message } from "@marinara-engine/shared";
import { agentKeys, useAgentMemory, useUpdateAgentMemory } from "../../hooks/use-agents";
import { useGenerate } from "../../hooks/use-generate";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { HelpTooltip } from "../ui/HelpTooltip";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { useTranslation as useUiTranslation } from "react-i18next";

const AGENT_TYPE = "director";
const SECRET_PLOT_HELP =
  "Hidden Narrative Director arc memory. It is injected into prompts only when the secret plot toggle is on.";

function findLastAssistant(messages: Message[] | undefined): Message | null {
  if (!messages?.length) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "assistant") return messages[i]!;
  }
  return null;
}

function memoryToDraft(mem: Record<string, unknown>) {
  const arcRaw = mem.overarchingArc as Record<string, unknown> | string | undefined;
  let arcDescription = "";
  let arcProtagonist = "";
  let arcCharacter = "";
  let arcCompleted = false;
  if (arcRaw != null) {
    if (typeof arcRaw === "object") {
      arcDescription = String(arcRaw.description ?? "");
      arcProtagonist = String(arcRaw.protagonistArc ?? "");
      arcCharacter = String(arcRaw.characterArc ?? "");
      arcCompleted = arcRaw.completed === true;
    } else {
      arcDescription = String(arcRaw);
    }
  }
  return {
    arcDescription,
    arcProtagonist,
    arcCharacter,
    arcCompleted,
  };
}

type SecretPlotDraft = ReturnType<typeof memoryToDraft>;

function draftFingerprint(draft: SecretPlotDraft): string {
  return JSON.stringify(draft);
}

export function SecretPlotPanel({
  chatId,
  messages,
  isAgentProcessing,
  isGenerationBusy = isAgentProcessing,
}: {
  chatId: string | null;
  messages: Message[] | undefined;
  isAgentProcessing: boolean;
  isGenerationBusy?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const qc = useQueryClient();
  const { retryAgents } = useGenerate();
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<SecretPlotDraft | null>(null);
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null);
  const draftRef = useRef<SecretPlotDraft | null>(null);
  const savedFingerprintRef = useRef<string | null>(null);

  // Shared hook so this key has exactly one queryFn cache-wide (the Agent
  // Suite modal reads the same key; two different queryFns would race).
  const queryKey = useMemo(() => agentKeys.memory(AGENT_TYPE, chatId ?? ""), [chatId]);
  const { data, isLoading, isError, refetch } = useAgentMemory(AGENT_TYPE, chatId);
  const updateMemory = useUpdateAgentMemory();

  const target = useMemo(() => findLastAssistant(messages), [messages]);
  const draftSignature = useMemo(() => (draft ? draftFingerprint(draft) : null), [draft]);
  const hasUnsavedChanges = !!draft && savedFingerprint !== null && draftSignature !== savedFingerprint;
  const hasArcMemory =
    !!draft && !!(draft.arcDescription.trim() || draft.arcProtagonist.trim() || draft.arcCharacter.trim());
  const saveLabel = !draft
    ? "Secret plot unavailable"
    : saved && !hasUnsavedChanges
      ? "Secret plot saved"
      : hasUnsavedChanges
        ? "Save secret plot"
        : "Secret plot unchanged";

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    savedFingerprintRef.current = savedFingerprint;
  }, [savedFingerprint]);

  useEffect(() => {
    draftRef.current = null;
    savedFingerprintRef.current = null;
    setDraft(null);
    setSavedFingerprint(null);
    setSaved(false);
    setRevealed(false);
  }, [chatId]);

  useEffect(() => {
    if (!data?.memory) return;
    const currentDraft = draftRef.current;
    const currentSavedFingerprint = savedFingerprintRef.current;
    const currentIsDirty =
      currentDraft !== null &&
      currentSavedFingerprint !== null &&
      draftFingerprint(currentDraft) !== currentSavedFingerprint;
    if (currentIsDirty) return;

    const nextDraft = memoryToDraft(data.memory);
    const nextFingerprint = draftFingerprint(nextDraft);
    draftRef.current = nextDraft;
    savedFingerprintRef.current = nextFingerprint;
    setDraft(nextDraft);
    setSavedFingerprint(nextFingerprint);
    setSaved(false);
  }, [data?.memory]);

  const patchMemory = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!chatId) return;
      await updateMemory.mutateAsync({ agentType: AGENT_TYPE, chatId, patch });
    },
    [chatId, updateMemory],
  );

  const handleSave = useCallback(async () => {
    if (!chatId || saving || !draft) return;
    setSaving(true);
    try {
      const hasArc =
        draft.arcDescription.trim() || draft.arcProtagonist.trim() || draft.arcCharacter.trim() || draft.arcCompleted;
      await patchMemory({
        overarchingArc: hasArc
          ? {
              description: draft.arcDescription.trim() || undefined,
              protagonistArc: draft.arcProtagonist.trim() || undefined,
              characterArc: draft.arcCharacter.trim() || undefined,
              completed: draft.arcCompleted,
            }
          : null,
      });
      setSavedFingerprint(draftFingerprint(draft));
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }, [chatId, draft, patchMemory, saving]);

  const handleRegenerate = useCallback(async () => {
    if (!chatId || !target || isGenerationBusy || rerolling) return;
    const ok = await showConfirmDialog({
      title: localizeUi("ui.agents.secretplotpanel.regenerateSecretPlot_75a6ece"),
      message: localizeUi("ui.agents.secretplotpanel.replaceTheCurrentHiddenNarrativeDirectorArcForThis"),
      confirmLabel: localizeUi("ui.agents.secretplotpanel.regenerate"),
      cancelLabel: "Keep Current Arc",
      tone: "destructive",
    });
    if (!ok) return;

    setRerolling(true);
    try {
      await retryAgents(chatId, [AGENT_TYPE], { forMessageId: target.id, secretPlotRerollMode: "full" });
      await qc.invalidateQueries({ queryKey });
      await refetch();
      toast.success(localizeUi("ui.agents.secretplotpanel.secretPlotRegenerated"));
    } finally {
      setRerolling(false);
    }
  }, [chatId, target, isGenerationBusy, rerolling, retryAgents, qc, queryKey, refetch, localizeUi]);

  if (!chatId) return null;
  const busy = isGenerationBusy || rerolling;

  return (
    <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/45 px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md text-left text-[0.6875rem] font-semibold text-[var(--foreground)] transition-colors hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
        >
          <ChevronDown
            size="0.75rem"
            className={cn("shrink-0 text-[var(--primary)] transition-transform", open ? "rotate-180" : "-rotate-90")}
          />
          <span className="truncate">{localizeUi("ui.agents.secretplotpanel.secretPlot")}</span>
          {hasUnsavedChanges && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />}
        </button>
        <HelpTooltip
          text={SECRET_PLOT_HELP}
          wide
          side="left"
          size="0.75rem"
          className="text-[var(--muted-foreground)]"
        />
      </div>

      {open && (
        <div className="space-y-2 border-t border-[var(--border)] pt-2 text-[0.625rem]">
          {isLoading && (
            <p className="mari-chrome-text-muted py-2 text-center">
              {localizeUi("ui.agents.secretplotpanel.loadingSecretPlot")}
            </p>
          )}
          {isError && (
            <p className="rounded-md border border-[var(--destructive)]/25 bg-[var(--destructive)]/10 px-2 py-1.5 text-center text-[var(--destructive)]">
              {localizeUi("ui.agents.secretplotpanel.couldNotLoadDirectorMemory")}
            </p>
          )}

          {!isLoading && draft && (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRevealed((value) => !value)}
                  className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-[var(--border)]/70 bg-[var(--secondary)]/45 px-2 py-1 text-[0.625rem] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
                >
                  {revealed ? <EyeOff size="0.6875rem" /> : <Eye size="0.6875rem" />}
                  {revealed
                    ? localizeUi("ui.agents.secretplotpanel.hideSpoilers")
                    : hasArcMemory
                      ? localizeUi("ui.chat.agentsuitemodal.revealSpoilers")
                      : localizeUi("ui.agents.secretplotpanel.revealEmptyArc")}
                </button>
                <button
                  type="button"
                  disabled={busy || !target}
                  onClick={handleRegenerate}
                  title={
                    target
                      ? localizeUi("ui.agents.secretplotpanel.regenerateSecretPlot")
                      : localizeUi("ui.agents.secretplotpanel.noAssistantMessageYet")
                  }
                  className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-[var(--border)]/70 bg-[var(--secondary)]/45 px-2 py-1 text-[0.625rem] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw size="0.6875rem" className={cn(rerolling && "animate-spin")} />
                  {localizeUi("ui.agents.secretplotpanel.regenerate")}
                </button>
                <button
                  type="button"
                  disabled={saving || isAgentProcessing || !draft || !hasUnsavedChanges}
                  onClick={handleSave}
                  title={saveLabel}
                  aria-label={saveLabel}
                  className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saved && !hasUnsavedChanges ? (
                    <Check size="0.6875rem" />
                  ) : (
                    <Save size="0.6875rem" className={cn(saving && "animate-pulse")} />
                  )}
                </button>
              </div>

              {!revealed && (
                <div className="rounded-md border border-dashed border-[var(--border)] px-2 py-2 text-center text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.agents.secretplotpanel.spoilersHidden")}
                </div>
              )}

              {revealed && (
                <div className="space-y-2">
                  <label className="block">
                    <span className="mb-1 block text-[0.5625rem] font-medium text-[var(--muted-foreground)]">
                      {localizeUi("ui.agents.secretplotpanel.arcDescription")}
                    </span>
                    <textarea
                      value={draft.arcDescription}
                      onChange={(event) => {
                        setSaved(false);
                        setDraft((current) => (current ? { ...current, arcDescription: event.target.value } : current));
                      }}
                      rows={3}
                      spellCheck={false}
                      className="w-full resize-y rounded-md border border-[var(--input)] bg-[var(--secondary)]/45 px-2 py-1.5 font-mono text-[0.625rem] leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[0.5625rem] font-medium text-[var(--muted-foreground)]">
                      {localizeUi("ui.agents.secretplotpanel.protagonistArc")}
                    </span>
                    <textarea
                      value={draft.arcProtagonist}
                      onChange={(event) => {
                        setSaved(false);
                        setDraft((current) => (current ? { ...current, arcProtagonist: event.target.value } : current));
                      }}
                      rows={2}
                      spellCheck={false}
                      className="w-full resize-y rounded-md border border-[var(--input)] bg-[var(--secondary)]/45 px-2 py-1.5 font-mono text-[0.625rem] leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[0.5625rem] font-medium text-[var(--muted-foreground)]">
                      {localizeUi("ui.agents.secretplotpanel.characterArc")}
                    </span>
                    <textarea
                      value={draft.arcCharacter}
                      onChange={(event) => {
                        setSaved(false);
                        setDraft((current) => (current ? { ...current, arcCharacter: event.target.value } : current));
                      }}
                      rows={2}
                      spellCheck={false}
                      className="w-full resize-y rounded-md border border-[var(--input)] bg-[var(--secondary)]/45 px-2 py-1.5 font-mono text-[0.625rem] leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
                    />
                  </label>
                  <SettingsSwitch
                    label={localizeUi("ui.noodle.noodlehome.completed")}
                    checked={draft.arcCompleted}
                    onChange={(checked) => {
                      setSaved(false);
                      setDraft((current) => (current ? { ...current, arcCompleted: checked } : current));
                    }}
                    labelPosition="start"
                    className="min-h-7 justify-between rounded-md border border-[var(--border)]/70 bg-[var(--secondary)]/35 px-2 py-1 text-[0.625rem] text-[var(--muted-foreground)]"
                    labelClassName="text-[0.625rem]"
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
