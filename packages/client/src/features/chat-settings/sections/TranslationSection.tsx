import { Languages, RotateCcw } from "lucide-react";
import { DEFAULT_TRANSLATION_SYSTEM_PROMPT } from "@marinara-engine/shared";
import { HelpTooltip } from "../../../components/ui/HelpTooltip";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { ChatSettingsSection } from "../ChatSettingsSection";
import type { ChatConnectionOption } from "./ConnectionSection";
import { useTranslation as useUiTranslation } from "react-i18next";

interface TranslationSectionProps {
  metadata: Record<string, unknown>;
  textConnections: ChatConnectionOption[];
  onMetadataChange: (patch: Record<string, unknown>) => void;
}

export function TranslationSection({ metadata, textConnections, onMetadataChange }: TranslationSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const provider = (metadata.translationProvider as string | undefined) ?? "google";
  const legacyTargetLanguage = (metadata.translationTargetLang as string | undefined) ?? "en";
  const inputTargetLanguage = (metadata.translationInputTargetLang as string | undefined) ?? legacyTargetLanguage;
  const outputTargetLanguage = (metadata.translationOutputTargetLang as string | undefined) ?? legacyTargetLanguage;
  const legacyPrompt = typeof metadata.translationPrompt === "string" ? metadata.translationPrompt : "";

  const readDirectionalPrompt = (key: "translationInputPrompt" | "translationOutputPrompt") => {
    const value = metadata[key];
    if (value === null) return "";
    const stored = typeof value === "string" ? value : legacyPrompt;
    return stored.trim().length > 0 ? stored : "";
  };
  const inputPrompt = readDirectionalPrompt("translationInputPrompt");
  const outputPrompt = readDirectionalPrompt("translationOutputPrompt");

  const updatePrompt = (key: "translationInputPrompt" | "translationOutputPrompt", value: string) => {
    const nextPrompt = !value.trim() || value.trim() === DEFAULT_TRANSLATION_SYSTEM_PROMPT.trim() ? null : value;
    onMetadataChange({ [key]: nextPrompt });
  };

  return (
    <ChatSettingsSection
      id="translation"
      label={localizeUi("ui.chatSettings.translationsection.translation")}
      icon={<Languages size="0.875rem" />}
      help={localizeUi("ui.chatSettings.translationsection.configureTranslationForThisChatHereIncludingProviderTarget")}
    >
      <div className="space-y-3">
        <div>
          <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.connections.connectioneditor.provider")}
          </label>
          <select
            value={provider}
            onChange={(e) => onMetadataChange({ translationProvider: e.target.value })}
            className="mt-0.5 w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
          >
            <option value="google">{localizeUi("ui.chatSettings.translationsection.googleTranslate")}</option>
            <option value="deepl">{localizeUi("ui.chatSettings.translationsection.deeplApi")}</option>
            <option value="deeplx">{localizeUi("ui.chatSettings.translationsection.deeplxSelfHosted")}</option>
            <option value="ai">{localizeUi("ui.chatSettings.translationsection.aiViaConnection")}</option>
          </select>
        </div>

        <TranslationLanguageField
          label={localizeUi("ui.chatSettings.translationsection.modelLanguage")}
          description={localizeUi(
            "ui.chatSettings.translationsection.yourOutgoingMessagesAreTranslatedIntoThisLanguage",
          )}
          provider={provider}
          value={inputTargetLanguage}
          onChange={(value) => onMetadataChange({ translationInputTargetLang: value })}
        />

        <TranslationLanguageField
          label={localizeUi("ui.chatSettings.translationsection.myLanguage")}
          description={localizeUi(
            "ui.chatSettings.translationsection.incomingModelResponsesAreTranslatedIntoThisLanguage",
          )}
          provider={provider}
          value={outputTargetLanguage}
          onChange={(value) => onMetadataChange({ translationOutputTargetLang: value })}
        />

        {provider === "ai" && (
          <>
            <div>
              <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                {localizeUi("ui.chatSettings.connectionsection.connection")}
                <HelpTooltip
                  text={localizeUi("ui.chatSettings.translationsection.whichAiConnectionToUseForTranslation")}
                  size="0.625rem"
                />
              </label>
              <select
                value={(metadata.translationConnectionId as string | undefined) ?? ""}
                onChange={(e) => onMetadataChange({ translationConnectionId: e.target.value })}
                className="mt-0.5 w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
              >
                <option value="">{localizeUi("ui.chatSettings.translationsection.selectConnection")}</option>
                {textConnections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name}
                  </option>
                ))}
              </select>
            </div>

            <TranslationPromptField
              label={localizeUi("ui.chatSettings.translationsection.outgoingMessagePrompt")}
              customPrompt={inputPrompt}
              onChange={(value) => updatePrompt("translationInputPrompt", value)}
              onRestore={() => onMetadataChange({ translationInputPrompt: null })}
            />
            <TranslationPromptField
              label={localizeUi("ui.chatSettings.translationsection.incomingResponsePrompt")}
              customPrompt={outputPrompt}
              onChange={(value) => updatePrompt("translationOutputPrompt", value)}
              onRestore={() => onMetadataChange({ translationOutputPrompt: null })}
            />
          </>
        )}

        {provider === "deepl" && (
          <div>
            <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.chatSettings.translationsection.deeplApiKey")}
            </label>
            <input
              type="password"
              value={(metadata.translationDeeplApiKey as string | undefined) ?? ""}
              onChange={(e) => onMetadataChange({ translationDeeplApiKey: e.target.value })}
              placeholder={localizeUi("ui.chatSettings.translationsection.xxxxxxxxXxxxXxxxXxxxXxxxxxxxxxxxFx")}
              className="mt-0.5 w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
            />
          </div>
        )}

        {provider === "deeplx" && (
          <div>
            <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.chatSettings.translationsection.deeplxUrl")}
              <HelpTooltip
                text={localizeUi("ui.chatSettings.translationsection.urlOfYourSelfHostedDeeplxInstanceEG")}
                size="0.625rem"
              />
            </label>
            <input
              type="text"
              value={(metadata.translationDeeplxUrl as string | undefined) ?? ""}
              onChange={(e) => onMetadataChange({ translationDeeplxUrl: e.target.value })}
              placeholder={localizeUi("ui.chatSettings.translationsection.httpLocalhost1188")}
              className="mt-0.5 w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
            />
          </div>
        )}

        <TranslationToggle
          enabled={metadata.autoTranslate === true}
          title={localizeUi("ui.chatSettings.translationsection.autoTranslateResponses")}
          description={localizeUi(
            "ui.chatSettings.translationsection.automaticallyTranslateAiResponsesAfterGeneration",
          )}
          onToggle={() => onMetadataChange({ autoTranslate: !metadata.autoTranslate })}
        />
        <TranslationToggle
          enabled={metadata.translateInput === true}
          title={localizeUi("ui.chatSettings.translationsection.translateMyMessages")}
          description={localizeUi(
            "ui.chatSettings.translationsection.translateYourMessagesToTheTargetLanguageBeforeSending",
          )}
          onToggle={() => onMetadataChange({ translateInput: !metadata.translateInput })}
        />
        <TranslationToggle
          enabled={metadata.showInputTranslateButton === true}
          title={localizeUi("ui.chatSettings.translationsection.showDraftTranslateButton")}
          description={localizeUi("ui.chatSettings.translationsection.addATranslateButtonBesideSendSoYouCan")}
          onToggle={() => onMetadataChange({ showInputTranslateButton: !metadata.showInputTranslateButton })}
        />
        <TranslationToggle
          enabled={metadata.translationDisplayOnly === true}
          title={localizeUi("ui.chatSettings.translationsection.showOnlyTranslation")}
          description={localizeUi("ui.chatSettings.translationsection.onceAMessageIsTranslatedShowJustTheTranslation")}
          onToggle={() => onMetadataChange({ translationDisplayOnly: !metadata.translationDisplayOnly })}
        />
      </div>
    </ChatSettingsSection>
  );
}

function TranslationLanguageField({
  label,
  description,
  provider,
  value,
  onChange,
}: {
  label: string;
  description: string;
  provider: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div>
      <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
        {label}
        <HelpTooltip
          text={
            provider === "ai"
              ? localizeUi("ui.chatSettings.translationlanguagefield.value1UseALanguageNameSuchAsEnglishJapanese", {
                  value1: description,
                })
              : localizeUi("ui.chatSettings.translationlanguagefield.value1UseALanguageCodeSuchAsEnJa", {
                  value1: description,
                })
          }
          size="0.625rem"
        />
      </label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          provider === "ai"
            ? localizeUi("ui.chatSettings.translationlanguagefield.english")
            : localizeUi("ui.chatSettings.translationlanguagefield.en")
        }
        className="mt-0.5 w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
      />
    </div>
  );
}

function TranslationPromptField({
  label,
  customPrompt,
  onChange,
  onRestore,
}: {
  label: string;
  customPrompt: string;
  onChange: (value: string) => void;
  onRestore: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
          {label}
          <HelpTooltip
            text={localizeUi(
              "ui.chatSettings.translationpromptfield.systemPromptUsedByAiTranslationTargetlanguageResolvesTo",
            )}
            size="0.625rem"
          />
        </label>
        {customPrompt && (
          <button
            type="button"
            onClick={onRestore}
            className="flex shrink-0 items-center gap-1 rounded-md bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            title={localizeUi("ui.agents.agenteditor.restoreDefaultPrompt")}
          >
            <RotateCcw size="0.625rem" />
            {localizeUi("ui.chatSettings.translationpromptfield.restore")}
          </button>
        )}
      </div>
      <textarea
        value={customPrompt || DEFAULT_TRANSLATION_SYSTEM_PROMPT}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        className="min-h-28 w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 font-mono text-xs leading-relaxed outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
      />
    </div>
  );
}

function TranslationToggle({
  enabled,
  title,
  description,
  onToggle,
}: {
  enabled: boolean;
  title: string;
  description: string;
  onToggle: () => void;
}) {
  return (
    <SettingsSwitch
      label={title}
      description={description}
      checked={enabled}
      onChange={onToggle}
      labelPosition="start"
      className={[
        "justify-between rounded-lg px-3 py-2.5 text-left",
        enabled
          ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
          : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
      ].join(" ")}
      labelClassName="text-[0.6875rem] font-medium"
    />
  );
}
