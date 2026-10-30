import { Languages, RotateCcw, Save } from "lucide-react";
import { useRef, useState } from "react";
import { DEFAULT_TRANSLATION_SYSTEM_PROMPT, estimateTextTokens } from "@marinara-engine/shared";
import { formatEstimatedTokens } from "../../../lib/character-token-count";
import { HelpTooltip } from "../../../components/ui/HelpTooltip";
import { DraftTextarea } from "../../../components/ui/DraftTextarea";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { ChatSettingsSection } from "../ChatSettingsSection";
import type { ChatConnectionOption } from "./ConnectionSection";
import { useTranslation as useUiTranslation } from "react-i18next";

import { toast } from "sonner";
import { useSaveTranslatorDefaults, useTranslatorDefaults } from "../../../hooks/use-translator-defaults";
import { useUpdateChatMetadata } from "../../../hooks/use-chats";
import { trackChatMetadataSave } from "../../../lib/chat-metadata-save-barrier";

const PROMPT_KEYS = ["translationInputPrompt", "translationOutputPrompt"] as const;
type PromptKey = (typeof PROMPT_KEYS)[number];
type PromptCommit = { value: string | null; completion: Promise<unknown>; pending: boolean; failed: boolean };
type PromptCommitState = { chatId: string; fields: Partial<Record<PromptKey, PromptCommit>> };

interface TranslationSectionProps {
  chatId: string;
  metadata: Record<string, unknown>;
  textConnections: ChatConnectionOption[];
  onMetadataChange: (patch: Record<string, unknown>) => void;
}

export function TranslationSection({ chatId, metadata, textConnections, onMetadataChange }: TranslationSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const { data: hasSavedDefaults } = useTranslatorDefaults();
  const saveDefaults = useSaveTranslatorDefaults();
  // Queue the whole prompt mutation below; nesting its API queue would deadlock.
  const updatePromptMeta = useUpdateChatMetadata();
  const promptCommits = useRef<PromptCommitState | null>(null);
  const [, setCommitRevision] = useState(0);
  const [savingAction, setSavingAction] = useState<"save" | "forget" | null>(null);
  const queuePromptCommit = (ownerId: string, key: PromptKey, value: string | null) => {
    // Register before onMutate can yield; keep each field's failure until it is retried or edited.
    const completion = trackChatMetadataSave(ownerId, () =>
      updatePromptMeta.mutateAsync({ id: ownerId, [key]: value }),
    );
    const commit = { value, completion, pending: true, failed: false };
    const owner: PromptCommitState =
      promptCommits.current?.chatId === ownerId ? promptCommits.current : { chatId: ownerId, fields: {} };
    owner.fields[key] = commit;
    promptCommits.current = owner;
    setCommitRevision((revision) => revision + 1);
    void completion
      .catch(() => {
        commit.failed = true;
      })
      .finally(() => {
        commit.pending = false;
        setCommitRevision((revision) => revision + 1);
      });
    return commit;
  };
  const saveTranslatorDefaults = async (sourceChatId: string | null) => {
    setSavingAction(sourceChatId ? "save" : "forget");
    try {
      const commits = promptCommits.current;
      if (sourceChatId && commits?.chatId === sourceChatId) {
        await Promise.all(
          PROMPT_KEYS.map((key) => {
            const commit = commits.fields[key];
            // Only an explicit Save retries a known failure, once per field for this action.
            return commit?.failed ? queuePromptCommit(sourceChatId, key, commit.value).completion : commit?.completion;
          }),
        );
      }
      await saveDefaults.mutateAsync(sourceChatId);
      toast.success(
        localizeUi(sourceChatId ? "chat.translation.defaults.saved" : "chat.translation.defaults.forgotten"),
      );
    } catch {
      toast.error(localizeUi("chat.translation.defaults.failed"));
    } finally {
      setSavingAction(null);
    }
  };
  const provider = (metadata.translationProvider as string | undefined) ?? "google";
  const legacyTargetLanguage = (metadata.translationTargetLang as string | undefined) ?? "en";
  const inputTargetLanguage = (metadata.translationInputTargetLang as string | undefined) ?? legacyTargetLanguage;
  const outputTargetLanguage = (metadata.translationOutputTargetLang as string | undefined) ?? legacyTargetLanguage;
  const legacyPrompt = typeof metadata.translationPrompt === "string" ? metadata.translationPrompt : "";

  const readDirectionalPrompt = (key: PromptKey) => {
    const commit = promptCommits.current?.chatId === chatId ? promptCommits.current.fields[key] : undefined;
    if (commit?.pending || commit?.failed) return commit.value ?? "";
    const value = metadata[key];
    if (value === null) return "";
    const stored = typeof value === "string" ? value : legacyPrompt;
    return stored.trim().length > 0 ? stored : "";
  };
  const inputPrompt = readDirectionalPrompt("translationInputPrompt");
  const outputPrompt = readDirectionalPrompt("translationOutputPrompt");

  const updatePrompt = (key: PromptKey, value: string) => {
    const nextPrompt = !value.trim() || value.trim() === DEFAULT_TRANSLATION_SYSTEM_PROMPT.trim() ? null : value;
    queuePromptCommit(chatId, key, nextPrompt);
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
              key={`${chatId}:input`}
              label={localizeUi("ui.chatSettings.translationsection.outgoingMessagePrompt")}
              customPrompt={inputPrompt}
              onChange={(value) => updatePrompt("translationInputPrompt", value)}
              onRestore={() => updatePrompt("translationInputPrompt", "")}
            />
            <TranslationPromptField
              key={`${chatId}:output`}
              label={localizeUi("ui.chatSettings.translationsection.incomingResponsePrompt")}
              customPrompt={outputPrompt}
              onChange={(value) => updatePrompt("translationOutputPrompt", value)}
              onRestore={() => updatePrompt("translationOutputPrompt", "")}
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
        <div className="space-y-2 pt-1">
          <p className="text-xs text-[var(--muted-foreground)]">
            {localizeUi("chat.translation.defaults.description")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={savingAction !== null}
              onClick={() => saveTranslatorDefaults(chatId)}
              className="flex items-center gap-1.5 rounded-md bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] ring-1 ring-[var(--marinara-chat-chrome-button-border)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--primary)] disabled:opacity-50"
            >
              <Save size="0.875rem" aria-hidden="true" />
              {savingAction === "save"
                ? localizeUi("editor.save.saving")
                : localizeUi("chat.translation.defaults.save")}
            </button>
            {hasSavedDefaults && (
              <button
                type="button"
                disabled={savingAction !== null}
                onClick={() => saveTranslatorDefaults(null)}
                className="flex items-center gap-1.5 rounded-md bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)] ring-1 ring-[var(--marinara-chat-chrome-button-border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-[var(--primary)] disabled:opacity-50"
              >
                <RotateCcw size="0.875rem" aria-hidden="true" />
                {localizeUi("chat.translation.defaults.forget")}
              </button>
            )}
          </div>
        </div>
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
        className="mari-chrome-field mt-0.5 w-full !rounded-md px-3 py-2 text-xs"
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
  const [liveDraft, setLiveDraft] = useState<string | null>(null);
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
      <DraftTextarea
        value={customPrompt || DEFAULT_TRANSLATION_SYSTEM_PROMPT}
        onCommit={onChange}
        onFocus={(event) => setLiveDraft(event.currentTarget.value)}
        onInput={(event) => setLiveDraft(event.currentTarget.value)}
        onBlur={() => setLiveDraft(null)}
        rows={5}
        className="min-h-28 w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 font-mono text-xs leading-relaxed outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
      />
      <p className="mt-0.5 text-right text-[0.625rem] text-[var(--muted-foreground)]">
        {formatEstimatedTokens(
          estimateTextTokens(liveDraft ?? (customPrompt || DEFAULT_TRANSLATION_SYSTEM_PROMPT)),
          localizeUi,
        )}
      </p>
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
