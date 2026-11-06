import { useTranslation } from "react-i18next";
import { AlertCircle, Check, ChevronRight, Eye, EyeOff, ExternalLink } from "lucide-react";
import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import { PROVIDERS, type APIProvider } from "@marinara-engine/shared";
import { ModelDownloadModal } from "../ModelDownloadModal";
import { LocalWhisper } from "../../connections/DeviceDetail";
import { DecisionModelModal } from "../DecisionModelModal";
import { SpeechToTextCard } from "../../panels/settings/SpeechToTextCard";
import { TTSConfigCard } from "../../panels/settings/TTSConfigCard";
import { cn } from "../../../lib/utils";
import { SECTION_HEADING_CLASS } from "../../connections/ConnectionBalance";
import { CheckIcon, CheckLine, checkBorderClass, type FieldCheck } from "../../connections/AccessCheck";
import {
  type DeviceService,
  type MediaBackend,
  type ServiceId,
  type TestResult,
  LOCAL_PRESETS,
  LOGIN_COMMANDS,
  MEDIA_KEY_URLS,
  SELF_HOSTED,
  LINKAPI,
  LINKAPI_SERVICE,
  DECISION_BUILTIN,
  failureReason,
  hostOf,
  inputClass,
  labelClass,
} from "./shared";

type ProviderDefinition = (typeof PROVIDERS)[APIProvider];

export interface AccessStepProps {
  provider: APIProvider | null;
  service: ServiceId | null;
  device: DeviceService | null;
  selectedMedia: MediaBackend | null;
  def: ProviderDefinition | null;
  closeBlocked: boolean;
  keyless: boolean;
  isLocal: boolean;
  isMedia: boolean;
  requiresAccessKey: boolean;
  apiKey: string;
  setApiKey: (value: string) => void;
  showKey: boolean;
  setShowKey: Dispatch<SetStateAction<boolean>>;
  baseUrl: string;
  setBaseUrl: (value: string) => void;
  resetTest: () => void;
  tested: TestResult | null;
  /** Live address and key status while the user types. */
  check: { address: FieldCheck; key: FieldCheck };
  onRecheck: () => void;
  maxRpm: string;
  setMaxRpm: (value: string) => void;
  maxJobs: string;
  setMaxJobs: (value: string) => void;
  serviceName: (service: ServiceId) => string;
  modelCount?: number;
  keyRef: RefObject<HTMLInputElement | null>;
  /** Built-in model: its window has its own footer; this closes it. */
  onBuiltInDone: () => void;
}

export function AccessStep(props: AccessStepProps) {
  const { t } = useTranslation();
  const failure =
    props.tested && !props.tested.success && props.provider
      ? failureReason(props.provider, props.tested.message ?? "", props.tested.errorCode)
      : null;
  const keyUrl = props.selectedMedia
    ? MEDIA_KEY_URLS[props.selectedMedia.source]
    : props.service === LINKAPI_SERVICE
      ? LINKAPI.keyUrl
      : props.def?.keyUrl;

  useEffect(() => {
    if (failure === "key") document.getElementById("add-connection-key")?.focus();
  }, [failure]);

  const keyName = props.service ? props.serviceName(props.service) : props.def?.name;
  // A server you run: its address matters more than its name.
  const addressFirst = !!props.selectedMedia && SELF_HOSTED.has(props.selectedMedia.source);
  const loginCommand = props.provider ? LOGIN_COMMANDS[props.provider] : undefined;
  const endpointField = !props.isLocal && (!props.keyless || props.selectedMedia) && (
    <div className="flex flex-col gap-1">
      <label htmlFor="add-connection-endpoint" className="text-xs text-[var(--muted-foreground)]">
        {t("connections.add.endpoint")}
      </label>
      <span className="relative">
        <input
          id="add-connection-endpoint"
          value={props.baseUrl}
          onChange={(event) => {
            props.setBaseUrl(event.target.value);
            props.resetTest();
          }}
          placeholder={props.selectedMedia?.defaultBaseUrl ?? props.def?.defaultBaseUrl}
          inputMode="url"
          aria-describedby="add-connection-endpoint-check"
          className={cn(inputClass, "font-mono pr-10", checkBorderClass(props.check.address.state))}
        />
        <CheckIcon state={props.check.address.state} />
      </span>
      <CheckLine id="add-connection-endpoint-check" check={props.check.address} onRecheck={props.onRecheck} />
    </div>
  );
  const moreRef = useRef<HTMLDetailsElement>(null);
  const addressWarn = props.check.address.state === "warn";
  // A failed address check opens More options, so the folded address and its warning show.
  useEffect(() => {
    if (addressWarn && moreRef.current) moreRef.current.open = true;
  }, [addressWarn]);
  const keyField = (optional: boolean) => (
    <div className="flex flex-col gap-1">
      <label htmlFor="add-connection-key" className={labelClass}>
        {t(optional ? "connections.add.apiKeyOptional" : "connections.add.apiKey")}
      </label>
      <div className="flex gap-1.5">
        <div className="relative min-w-0 flex-1">
          <input
            id="add-connection-key"
            ref={optional ? undefined : props.keyRef}
            type={props.showKey ? "text" : "password"}
            value={props.apiKey}
            onChange={(event) => {
              props.setApiKey(event.target.value);
              props.resetTest();
            }}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="off"
            aria-describedby={cn(
              props.tested ? "add-connection-result" : "add-connection-key-help",
              "add-connection-key-check",
            )}
            placeholder={keyName && !optional ? t("connections.add.keyPlaceholder", { name: keyName }) : undefined}
            className={cn(inputClass, "font-mono pr-10", checkBorderClass(props.check.key.state))}
          />
          <CheckIcon state={props.check.key.state} />
        </div>
        <button
          type="button"
          onClick={() => props.setShowKey((value) => !value)}
          aria-pressed={props.showKey}
          aria-label={t("connections.add.showKey")}
          title={t("connections.add.showKey")}
          className="mari-chrome-control mari-chrome-control--compact"
        >
          {props.showKey ? <EyeOff size="0.875rem" aria-hidden /> : <Eye size="0.875rem" aria-hidden />}
        </button>
      </div>
      <CheckLine id="add-connection-key-check" check={props.check.key} onRecheck={props.onRecheck} />
      {keyUrl && !optional && (
        <p className="flex flex-wrap items-center gap-x-1.5 text-[0.6875rem]">
          <a
            href={keyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 max-md:-my-3.5 items-center gap-1 font-medium text-[var(--foreground)] underline decoration-[var(--muted-foreground)] underline-offset-2 hover:decoration-[var(--foreground)] md:min-h-0"
          >
            {t("connections.add.getKey")}
            <ExternalLink size="0.6875rem" aria-hidden />
            <span className="sr-only">{t("connections.add.newTab")}</span>
          </a>
          <span className="text-[var(--muted-foreground)]">· {hostOf(keyUrl)}</span>
        </p>
      )}
    </div>
  );

  if (props.device === "local_model")
    return (
      <section className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
        <ModelDownloadModal embedded open onClose={props.onBuiltInDone} />
      </section>
    );
  if (props.service === DECISION_BUILTIN)
    return (
      <section className="h-full min-h-0 overflow-y-auto overscroll-contain">
        <DecisionModelModal embedded open onClose={props.onBuiltInDone} />
      </section>
    );
  if (props.device) {
    return (
      <section className="h-full min-h-0 overflow-y-auto overscroll-contain">
        <div className="max-w-xl">
          <div className="flex flex-col gap-4 px-3 py-4">
            {props.device === "tts" && <TTSConfigCard defaultExpanded />}
            {props.device === "stt" && <SpeechToTextCard defaultExpanded />}
            {props.device === "stt" && import.meta.env.VITE_MARINARA_LITE !== "true" && <LocalWhisper />}
          </div>
        </div>
      </section>
    );
  }

  if (!props.provider) return null;

  return (
    <section className="h-full min-h-0 overflow-y-auto overscroll-contain">
      <div className="max-w-xl">
        <div className="flex flex-col gap-4 px-3 py-4">
          {!props.isMedia && <h3 className={SECTION_HEADING_CLASS}>{t("connections.accounts.editor.access")}</h3>}
          {loginCommand && failure !== "plan" && (
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("connections.add.signInFirst", { command: loginCommand })}
            </p>
          )}
          {props.isLocal && (
            <div className="flex flex-col gap-1">
              <label htmlFor="add-connection-url" className={labelClass}>
                {t("connections.add.serverAddress")}
              </label>
              <div className="relative">
                <input
                  id="add-connection-url"
                  ref={props.keyRef}
                  value={props.baseUrl}
                  onChange={(event) => {
                    props.setBaseUrl(event.target.value);
                    props.resetTest();
                  }}
                  placeholder={props.selectedMedia ? undefined : LOCAL_PRESETS[0]!.url}
                  inputMode="url"
                  spellCheck={false}
                  autoCapitalize="off"
                  aria-describedby={cn(props.tested && "add-connection-result", "add-connection-url-check")}
                  className={cn(inputClass, "font-mono pr-10", checkBorderClass(props.check.address.state))}
                />
                <CheckIcon state={props.check.address.state} />
              </div>
              <CheckLine id="add-connection-url-check" check={props.check.address} onRecheck={props.onRecheck} />
            </div>
          )}
          {props.requiresAccessKey && keyField(false)}
          {props.isLocal && failure === "key" && keyField(true)}
          {props.tested && (
            <div
              id="add-connection-result"
              role="status"
              data-add-connection-result={props.tested.success ? "ok" : "failed"}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3",
                props.tested.success
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-[var(--destructive)]/40 bg-[var(--destructive)]/5",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  props.tested.success
                    ? "bg-emerald-500/15 text-emerald-500"
                    : "bg-[var(--destructive)]/15 text-[var(--destructive)]",
                )}
              >
                {props.tested.success ? <Check size="1rem" aria-hidden /> : <AlertCircle size="1rem" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                {props.tested.success ? (
                  <p className="text-sm font-medium">
                    {props.modelCount === undefined
                      ? t("connections.add.connected")
                      : t("connections.add.connectedModels", { count: props.modelCount })}
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-medium">
                      {t(`connections.add.error.${failure ?? "other"}`, {
                        host:
                          hostOf(
                            props.baseUrl.trim() ||
                              props.selectedMedia?.defaultBaseUrl ||
                              props.def?.defaultBaseUrl ||
                              "",
                          ) || props.serviceName(props.service ?? props.provider!),
                      })}
                    </p>
                    {props.tested.message && (
                      <p className="mt-1 break-words font-mono text-[0.625rem] text-[var(--muted-foreground)]">
                        {props.tested.message}
                      </p>
                    )}
                    {failure === "plan" && props.provider && LOGIN_COMMANDS[props.provider] && (
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {t("connections.add.loginHint", { command: LOGIN_COMMANDS[props.provider] })}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
          {(!props.isMedia || props.selectedMedia) && (
            <div className="flex flex-col gap-2">
              {props.isLocal && failure !== "key" && keyField(true)}
              {addressFirst && endpointField}
              <details ref={moreRef} className="group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-xs text-[var(--foreground)] md:min-h-9 [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    size="0.875rem"
                    aria-hidden
                    className="transition-transform group-open:rotate-90 motion-reduce:transition-none"
                  />
                  {t("connections.add.moreOptions")}
                  <span className="text-[var(--muted-foreground)]">
                    {t(
                      endpointField && !addressFirst
                        ? "connections.add.moreOptionsHintAddress"
                        : "connections.add.moreOptionsHint",
                    )}
                  </span>
                </summary>
                {!addressFirst && endpointField && <div className="pt-1">{endpointField}</div>}
                <div className="grid grid-cols-2 gap-2 pb-1 pt-1">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {t("connections.add.maxRequestsPerMinute")}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={600}
                      value={props.maxRpm}
                      placeholder={t("connections.accounts.editor.noLimit")}
                      onChange={(event) => props.setMaxRpm(event.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {t("connections.add.maxParallelJobs")}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={16}
                      value={props.maxJobs}
                      placeholder={t("connections.accounts.editor.noLimit")}
                      onChange={(event) => props.setMaxJobs(event.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
