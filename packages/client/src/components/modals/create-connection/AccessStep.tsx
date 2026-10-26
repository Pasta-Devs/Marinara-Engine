import { useTranslation } from "react-i18next";
import { AlertCircle, Check, ChevronDown, ChevronRight, Eye, EyeOff, ExternalLink } from "lucide-react";
import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import { PROVIDERS, withKeyTail, type APIProvider, type ConnectionAccountListItem } from "@marinara-engine/shared";
import type { ConnectionRowData } from "../../connections/ConnectionRow";
import { ServiceRow } from "../../connections/ServiceRow";
import { BrandMark } from "../../connections/ProviderIcon";
import { LocalWhisper } from "../../connections/DeviceDetail";
import { SmoothFolderContent } from "../../ui/SmoothFolderContent";
import { SpeechToTextCard } from "../../panels/settings/SpeechToTextCard";
import { TTSConfigCard } from "../../panels/settings/TTSConfigCard";
import { cn } from "../../../lib/utils";
import {
  type DeviceService,
  type MediaBackend,
  type ServiceId,
  type TestResult,
  LOCAL_PRESETS,
  LOGIN_COMMANDS,
  MEDIA_KEY_URLS,
  LINKAPI,
  LINKAPI_SERVICE,
  ServiceTile,
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
  deviceSetUp: boolean;
  selectedMedia: MediaBackend | null;
  def: ProviderDefinition | null;
  choosing: boolean;
  connectedAccounts: ConnectionAccountListItem[];
  accountRows: (accountId: string) => ConnectionRowData[];
  closeBlocked: boolean;
  showModelsOf: (accountId: string) => Promise<void>;
  connectSecond: () => void;
  second: boolean;
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
  moreOpen: boolean;
  setMoreOpen: Dispatch<SetStateAction<boolean>>;
  name: string;
  setName: (value: string) => void;
  maxRpm: string;
  setMaxRpm: (value: string) => void;
  maxJobs: string;
  setMaxJobs: (value: string) => void;
  existing?: ConnectionAccountListItem;
  secondaryClass: string;
  serviceHint: (service: ServiceId) => string;
  serviceName: (service: ServiceId) => string;
  modelCount?: number;
  keyRef: RefObject<HTMLInputElement | null>;
}

export function AccessStep(props: AccessStepProps) {
  const { t } = useTranslation();
  const failure =
    props.tested && !props.tested.success && props.provider
      ? failureReason(props.provider, props.tested.message ?? "")
      : null;
  const keyUrl = props.selectedMedia
    ? MEDIA_KEY_URLS[props.selectedMedia.source]
    : props.service === LINKAPI_SERVICE
      ? LINKAPI.keyUrl
      : props.def?.keyUrl;

  const { setMoreOpen } = props;
  useEffect(() => {
    if (failure !== "key") return;
    if (!props.moreOpen) {
      setMoreOpen(true);
      return;
    }
    document.getElementById("add-connection-key")?.focus();
  }, [failure, props.moreOpen, setMoreOpen]);

  const keyField = (optional: boolean) => (
    <div className="flex flex-col gap-1">
      <label htmlFor="add-connection-key" className={labelClass}>
        {t(optional ? "connections.add.apiKeyOptional" : "connections.add.apiKey")}
      </label>
      <div className="flex gap-1.5">
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
          aria-describedby={props.tested ? "add-connection-key-help add-connection-result" : "add-connection-key-help"}
          className={cn(inputClass, "min-w-0 flex-1 font-mono")}
        />
        <button
          type="button"
          onClick={() => props.setShowKey((value) => !value)}
          aria-pressed={props.showKey}
          aria-label={t("connections.add.showKey")}
          title={t("connections.add.showKey")}
          className="mari-connection-btn mari-connection-btn--icon"
        >
          {props.showKey ? <EyeOff size="0.875rem" aria-hidden /> : <Eye size="0.875rem" aria-hidden />}
        </button>
      </div>
      <p id="add-connection-key-help" className="text-[0.6875rem] text-[var(--muted-foreground)]">
        {t("connections.add.keySaved")}
      </p>
      {keyUrl && !optional && (
        <p className="flex flex-wrap items-center gap-x-1.5 text-[0.6875rem]">
          <a
            href={keyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 font-medium text-[var(--foreground)] underline decoration-[var(--muted-foreground)] underline-offset-2 hover:decoration-[var(--foreground)] md:min-h-0"
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

  if (props.device) {
    return (
      <section className="h-full min-h-0 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-xl">
          <div className="flex flex-col gap-4 p-4 md:p-5">
            <div className={cn("flex items-start gap-3", props.device !== "local_model" && "hidden")}>
              <ServiceTile service={props.device} />
              <div className="min-w-0 flex-1 text-xs leading-snug text-[var(--muted-foreground)]">
                <p>{t(`connections.add.hint.${props.device}`)}</p>
                <p data-add-connection-device-state className="mt-1 text-[0.6875rem]">
                  {t(props.deviceSetUp ? "connections.add.deviceReady" : "connections.add.deviceNotSetUp")}
                </p>
              </div>
            </div>
            {props.device === "local_model" && (
              <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                {t("connections.add.localModelInfo")}
              </p>
            )}
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
      <div className="mx-auto max-w-xl">
        <div className="flex flex-col gap-4 p-4 md:p-5">
          <div className="flex items-center gap-3">
            <ServiceTile service={props.service ?? props.provider} />
            <div className="min-w-0 flex-1 text-xs leading-snug text-[var(--muted-foreground)]">
              <p>{props.service ? props.serviceHint(props.service) : t(`connections.add.hint.${props.provider}`)}</p>
              {props.def?.billing && !props.choosing && (
                <p className="mt-0.5 text-[0.6875rem]">{t(`connections.add.billingInfo.${props.def.billing}`)}</p>
              )}
            </div>
          </div>
          {props.choosing ? (
            <div data-add-connection-existing className="flex flex-col gap-3">
              <ul className="flex flex-col gap-2">
                {props.connectedAccounts.map((account) => (
                  <li key={account.id} className="mari-connection-group">
                    <ServiceRow
                      account={account}
                      rows={props.accountRows(account.id)}
                      count={t("connections.list.models", { count: props.accountRows(account.id).length })}
                      state={account.state}
                      stateLabel={t(`connections.accounts.state.${account.state}`)}
                      billing={account.billing}
                      data-add-connection-existing-account={account.id}
                      onClick={() => void props.showModelsOf(account.id)}
                      disabled={props.closeBlocked}
                      trailing={
                        <ChevronRight size="1rem" className="shrink-0 text-[var(--muted-foreground)]" aria-hidden />
                      }
                    />
                  </li>
                ))}
              </ul>
              <button
                type="button"
                data-add-connection-make-new
                onClick={props.connectSecond}
                className={cn(props.secondaryClass, "self-start")}
              >
                {t("connections.add.makeNew")}
              </button>
            </div>
          ) : (
            <>
              {props.second && !props.keyless && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t(props.isLocal ? "connections.add.secondServer" : "connections.add.secondKey")}
                </p>
              )}
              {props.isLocal && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="add-connection-url" className={labelClass}>
                    {t("connections.add.serverAddress")}
                  </label>
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
                    aria-describedby={props.tested ? "add-connection-result" : undefined}
                    className={cn(inputClass, "font-mono")}
                  />
                  {!props.selectedMedia && (
                    <div className="flex flex-wrap gap-1 pt-1" role="group" aria-label={t("connections.add.presets")}>
                      {LOCAL_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            props.setBaseUrl(preset.url);
                            props.resetTest();
                          }}
                          aria-pressed={props.baseUrl.trim() === preset.url}
                          className="mari-connection-chip gap-1"
                        >
                          <BrandMark of={preset.label} className="h-3 w-3" />
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {failure !== "key" && (
                    <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                      {t("connections.add.noKeyNeeded")}
                    </p>
                  )}
                </div>
              )}
              {props.requiresAccessKey && keyField(false)}
              {props.isLocal && failure === "key" && keyField(true)}
              {props.keyless && (
                <p className="text-xs text-[var(--muted-foreground)]">{t("connections.add.keyless")}</p>
              )}
              {props.isMedia && (
                <p className="text-xs text-[var(--muted-foreground)]">{t("connections.add.mediaNext")}</p>
              )}
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
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          {failure === "plan" && props.provider && LOGIN_COMMANDS[props.provider]
                            ? t("connections.add.loginHint", { command: LOGIN_COMMANDS[props.provider] })
                            : t(
                                failure === "key"
                                  ? "connections.add.retryKey"
                                  : props.isLocal
                                    ? "connections.add.retryLocal"
                                    : "connections.add.retryKey",
                              )}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
              {(!props.isMedia || props.selectedMedia) && (
                <>
                  <button
                    type="button"
                    onClick={() => props.setMoreOpen((value) => !value)}
                    aria-expanded={props.moreOpen}
                    aria-controls="add-connection-more"
                    className="flex min-h-11 items-center gap-1.5 self-start rounded-lg px-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] md:min-h-9"
                  >
                    <ChevronDown
                      size="0.75rem"
                      className={cn("transition-transform", props.moreOpen && "rotate-180")}
                    />
                    {t("connections.add.moreOptions")}
                  </button>
                  <SmoothFolderContent open={props.moreOpen}>
                    <div id="add-connection-more" className="flex flex-col gap-2 pb-1">
                      {props.isLocal && failure !== "key" && keyField(true)}
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-[var(--muted-foreground)]">{t("connections.add.name")}</span>
                        <input
                          value={props.name}
                          onChange={(event) => props.setName(event.target.value)}
                          placeholder={
                            !props.isLocal && props.existing
                              ? withKeyTail(props.def?.name ?? "", props.apiKey)
                              : props.def?.name
                          }
                          className={inputClass}
                        />
                      </label>
                      {!props.isLocal && (!props.keyless || props.selectedMedia) && (
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-[var(--muted-foreground)]">
                            {t("connections.add.endpoint")}
                          </span>
                          <input
                            value={props.baseUrl}
                            onChange={(event) => {
                              props.setBaseUrl(event.target.value);
                              props.resetTest();
                            }}
                            placeholder={props.selectedMedia?.defaultBaseUrl ?? props.def?.defaultBaseUrl}
                            inputMode="url"
                            className={cn(inputClass, "font-mono")}
                          />
                        </label>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-[var(--muted-foreground)]">
                            {t("connections.add.maxRequestsPerMinute")}
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={600}
                            value={props.maxRpm}
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
                            onChange={(event) => props.setMaxJobs(event.target.value)}
                            className={inputClass}
                          />
                        </label>
                      </div>
                    </div>
                  </SmoothFolderContent>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
