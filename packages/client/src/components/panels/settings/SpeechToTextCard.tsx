import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Globe, Key, Loader2, Mic, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { SPEECH_TO_TEXT_DEFAULT_MODEL, type SpeechToTextConfig } from "@marinara-engine/shared";
import { useInstalledCapabilityPackages } from "../../../hooks/use-capability-packages";
import {
  useSpeechToTextConfig,
  useTestSpeechToText,
  useUpdateSpeechToTextConfig,
} from "../../../hooks/use-speech-to-text";
import { cn } from "../../../lib/utils";
import { translate } from "../../../localization/i18n";
import { SettingsSwitch } from "./SettingControls";

const INPUT_CLS = "mari-chrome-field w-full px-3 py-2.5 text-sm placeholder:text-[var(--muted-foreground)]";
/** An address, not copy: the usual root of a self-hosted server on the same machine. */
const SERVER_URL_EXAMPLE = "http://localhost:8000/v1";

function Field({ label, help, children }: { label: string; help: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block space-y-1.5">
        <span className="block text-xs font-medium text-[var(--foreground)]">{label}</span>
        {children}
      </label>
      <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">{help}</p>
    </div>
  );
}

function serverName(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

/** Lets Calls send recorded speech to the user's own speech-to-text server instead of Local Whisper. */
export function SpeechToTextCard() {
  const { t } = useTranslation();
  const { data: installedPackages } = useInstalledCapabilityPackages();
  // Only Calls records speech, so the card stays out of the way until it is installed.
  const callsInstalled = useMemo(
    () =>
      (installedPackages ?? []).some(
        (item) => item.status !== "error" && item.manifest.kind.includes("conversation-calls"),
      ),
    [installedPackages],
  );
  const { data: savedConfig } = useSpeechToTextConfig(callsInstalled);
  const updateConfig = useUpdateSpeechToTextConfig();
  const testServer = useTestSpeechToText();
  const [draft, setDraft] = useState<SpeechToTextConfig | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The newest edit that is not saved yet. It is cleared only once a save of it succeeds.
  const pendingSaveRef = useRef<SpeechToTextConfig | null>(null);
  // Saves go out one at a time, so an older save cannot land after a newer one.
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const { mutateAsync: putConfig } = updateConfig;

  // Seed once: refetches after each save must not overwrite what the user is still typing.
  useEffect(() => {
    if (savedConfig && !draft) setDraft(savedConfig);
  }, [draft, savedConfig]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      // Leaving Connections before the autosave fires still keeps the last edit. On desktop the card
      // stays mounted, so clear the edit once saved, or each later visit would send it again.
      const pending = pendingSaveRef.current;
      if (!pending) return;
      const run = saveQueueRef.current.then(() => putConfig(pending));
      saveQueueRef.current = run.catch(() => undefined);
      run.then(
        () => {
          if (pendingSaveRef.current === pending) pendingSaveRef.current = null;
        },
        // The global translator, so a language change does not rerun this cleanup and send the edit twice.
        () => toast.error(translate("connections.speechToText.saveFailed")),
      );
    },
    [putConfig],
  );

  if (!callsInstalled || !draft) return null;

  const saveNow = async (config: SpeechToTextConfig) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setSaveStatus("saving");
    const run = saveQueueRef.current.then(() => putConfig(config));
    saveQueueRef.current = run.catch(() => undefined);
    try {
      await run;
      if (pendingSaveRef.current === config) pendingSaveRef.current = null;
      if (!pendingSaveRef.current) setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
      throw error;
    }
  };

  const change = (patch: Partial<SpeechToTextConfig>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    setTestResult(null);
    setSaveStatus("idle");
    pendingSaveRef.current = next;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveNow(next).catch(() => toast.error(t("connections.speechToText.saveFailed")));
    }, 600);
  };

  const handleTest = async () => {
    setTestResult(null);
    try {
      await saveNow(draft);
      await testServer.mutateAsync();
      setTestResult({ ok: true, message: t("connections.speechToText.testPassed") });
    } catch (error) {
      setTestResult({
        ok: false,
        message: error instanceof Error && error.message ? error.message : t("connections.speechToText.testFailed"),
      });
    }
  };

  const active = draft.enabled && Boolean(draft.baseUrl.trim());
  const testing = testServer.isPending;

  return (
    <div data-component="SpeechToTextCard" className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex items-center gap-2.5">
        <div className="mari-chrome-accent-tile mari-accent-animated flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <Mic size="1rem" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{t("connections.speechToText.title")}</div>
          <div className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
            {active
              ? t("connections.speechToText.summaryOn", {
                  model: draft.model || SPEECH_TO_TEXT_DEFAULT_MODEL,
                  server: serverName(draft.baseUrl.trim()),
                })
              : t("connections.speechToText.summaryOff")}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <SettingsSwitch
            checked={draft.enabled}
            onChange={(checked) => change({ enabled: checked })}
            ariaLabel={t("connections.speechToText.toggle")}
            title={t("connections.speechToText.toggle")}
            className="rounded-lg p-1 hover:bg-[var(--secondary)]"
          />
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="mari-chrome-control mari-chrome-control--small h-8 min-h-0 w-8 p-0"
            title={expanded ? t("ui.panels.ttsconfigcard.collapse") : t("ui.panels.ttsconfigcard.expand")}
            aria-label={expanded ? t("ui.panels.ttsconfigcard.collapse") : t("ui.panels.ttsconfigcard.expand")}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp size="0.875rem" /> : <ChevronDown size="0.875rem" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-4 border-t border-[var(--border)] pt-3">
          <p className="text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
            {t("connections.speechToText.intro")}
          </p>

          <Field label={t("connections.speechToText.serverUrl")} help={t("connections.speechToText.serverUrlHelp")}>
            <span className="relative block">
              <Globe
                size="0.875rem"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                aria-hidden
              />
              <input
                value={draft.baseUrl}
                onChange={(event) => change({ baseUrl: event.target.value })}
                className={cn(INPUT_CLS, "pl-8 font-mono")}
                placeholder={SERVER_URL_EXAMPLE}
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
              />
            </span>
          </Field>

          <Field label={t("connections.speechToText.apiKey")} help={t("connections.speechToText.apiKeyHelp")}>
            <span className="relative block">
              <Key
                size="0.875rem"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                aria-hidden
              />
              <input
                value={draft.apiKey}
                onChange={(event) => change({ apiKey: event.target.value })}
                type="password"
                className={cn(INPUT_CLS, "pl-8")}
                placeholder={t("connections.speechToText.apiKeyPlaceholder")}
                autoComplete="off"
              />
            </span>
          </Field>

          <Field label={t("connections.speechToText.model")} help={t("connections.speechToText.modelHelp")}>
            <input
              value={draft.model}
              onChange={(event) => change({ model: event.target.value })}
              className={cn(INPUT_CLS, "font-mono")}
              placeholder={SPEECH_TO_TEXT_DEFAULT_MODEL}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>

          <Field label={t("connections.speechToText.language")} help={t("connections.speechToText.languageHelp")}>
            <input
              value={draft.language}
              onChange={(event) => change({ language: event.target.value.replace(/[^A-Za-z-]/gu, "").slice(0, 16) })}
              className={INPUT_CLS}
              placeholder={t("connections.speechToText.languagePlaceholder")}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing || !draft.baseUrl.trim()}
              className="mari-chrome-control mari-chrome-control--small text-xs"
            >
              {testing ? <Loader2 size="0.75rem" className="animate-spin" /> : <PlugZap size="0.75rem" />}
              {testing ? t("connections.speechToText.testing") : t("connections.speechToText.test")}
            </button>
            <div className="flex-1" />
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                <Loader2 size="0.625rem" className="animate-spin" />
                {t("chat.settings.inlineEditor.saving")}
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                <Check size="0.625rem" />
                {t("chat.settings.inlineEditor.saved")}
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-[0.6875rem] text-[var(--marinara-app-accent-static)]">
                {t("connections.speechToText.saveFailed")}
              </span>
            )}
          </div>

          {testResult &&
            (testResult.ok ? (
              <p role="status" className="flex items-start gap-1.5 text-[0.6875rem] text-[var(--foreground)]">
                <Check size="0.75rem" className="mt-px shrink-0 text-[var(--muted-foreground)]" aria-hidden />
                {testResult.message}
              </p>
            ) : (
              <p
                role="alert"
                className="flex items-start gap-1.5 break-words text-[0.6875rem] leading-relaxed text-[var(--foreground)]"
              >
                <AlertTriangle
                  size="0.75rem"
                  className="mt-px shrink-0 text-[var(--marinara-app-accent-static)]"
                  aria-hidden
                />
                <span className="min-w-0">{testResult.message}</span>
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
