import { Languages, RotateCcw } from "lucide-react";
import { DEFAULT_TRANSLATION_SYSTEM_PROMPT } from "@marinara-engine/shared";
import { HelpTooltip } from "../../../components/ui/HelpTooltip";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { ChatSettingsSection } from "../ChatSettingsSection";
import type { ChatConnectionOption } from "./ConnectionSection";

interface TranslationSectionProps {
  metadata: Record<string, unknown>;
  textConnections: ChatConnectionOption[];
  onMetadataChange: (patch: Record<string, unknown>) => void;
}

export function TranslationSection({ metadata, textConnections, onMetadataChange }: TranslationSectionProps) {
  const provider = (metadata.translationProvider as string | undefined) ?? "google";
  const storedPrompt = typeof metadata.translationPrompt === "string" ? metadata.translationPrompt : "";
  const customPrompt = storedPrompt.trim().length > 0 ? storedPrompt : "";
  const promptValue = customPrompt || DEFAULT_TRANSLATION_SYSTEM_PROMPT;
  const hasCustomPrompt = customPrompt.length > 0;

  const updatePrompt = (value: string) => {
    const nextPrompt = !value.trim() || value.trim() === DEFAULT_TRANSLATION_SYSTEM_PROMPT.trim() ? null : value;
    onMetadataChange({ translationPrompt: nextPrompt });
  };

  return (
    <ChatSettingsSection
      label="Translation"
      icon={<Languages size="0.875rem" />}
      help="Configure translation for this chat here, including provider, target language, and automatic response translation for Game mode."
    >
      <div className="space-y-3">
        <div>
          <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Provider</label>
          <select
            value={provider}
            onChange={(e) => onMetadataChange({ translationProvider: e.target.value })}
            className="mt-0.5 w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
          >
            <option value="google">Google Translate</option>
            <option value="deepl">DeepL API</option>
            <option value="deeplx">DeepLX (self-hosted)</option>
            <option value="ai">AI (via connection)</option>
          </select>
        </div>

        <div>
          <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            Target Language
            <HelpTooltip
              text={
                provider === "ai"
                  ? "Language name (e.g. English, Japanese, Spanish)"
                  : "Language code (e.g. en, ja, es, de, fr, zh, ko)"
              }
              size="0.625rem"
            />
          </label>
          <input
            type="text"
            value={(metadata.translationTargetLang as string | undefined) ?? "en"}
            onChange={(e) => onMetadataChange({ translationTargetLang: e.target.value })}
            placeholder={provider === "ai" ? "English" : "en"}
            className="mt-0.5 w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
          />
        </div>

        {provider === "ai" && (
          <>
            <div>
              <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                Connection
                <HelpTooltip text="Which AI connection to use for translation" size="0.625rem" />
              </label>
              <select
                value={(metadata.translationConnectionId as string | undefined) ?? ""}
                onChange={(e) => onMetadataChange({ translationConnectionId: e.target.value })}
                className="mt-0.5 w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
              >
                <option value="">Select connection…</option>
                {textConnections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                  AI Prompt
                  <HelpTooltip
                    text="System prompt used by AI translation. Restoring uses Guksu's built-in default."
                    size="0.625rem"
                  />
                </label>
                {hasCustomPrompt && (
                  <button
                    type="button"
                    onClick={() => onMetadataChange({ translationPrompt: null })}
                    className="flex shrink-0 items-center gap-1 rounded-md bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    title="Restore default prompt"
                  >
                    <RotateCcw size="0.625rem" />
                    Restore
                  </button>
                )}
              </div>
              <textarea
                value={promptValue}
                onChange={(e) => updatePrompt(e.target.value)}
                rows={5}
                className="min-h-28 w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 font-mono text-xs leading-relaxed outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
              />
            </div>
          </>
        )}

        {provider === "deepl" && (
          <div>
            <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">DeepL API Key</label>
            <input
              type="password"
              value={(metadata.translationDeeplApiKey as string | undefined) ?? ""}
              onChange={(e) => onMetadataChange({ translationDeeplApiKey: e.target.value })}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
              className="mt-0.5 w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
            />
          </div>
        )}

        {provider === "deeplx" && (
          <div>
            <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
              DeepLX URL
              <HelpTooltip
                text="URL of your self-hosted DeepLX instance (e.g. http://localhost:1188)"
                size="0.625rem"
              />
            </label>
            <input
              type="text"
              value={(metadata.translationDeeplxUrl as string | undefined) ?? ""}
              onChange={(e) => onMetadataChange({ translationDeeplxUrl: e.target.value })}
              placeholder="http://localhost:1188"
              className="mt-0.5 w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
            />
          </div>
        )}

        <TranslationToggle
          enabled={metadata.autoTranslate === true}
          title="Auto-Translate Responses"
          description="Automatically translate AI responses after generation."
          onToggle={() => onMetadataChange({ autoTranslate: !metadata.autoTranslate })}
        />
        <TranslationToggle
          enabled={metadata.translateInput === true}
          title="Translate My Messages"
          description="Translate your messages to the target language before sending."
          onToggle={() => onMetadataChange({ translateInput: !metadata.translateInput })}
        />
        <TranslationToggle
          enabled={metadata.showInputTranslateButton === true}
          title="Show Draft Translate Button"
          description="Add a translate button beside Send so you can translate and edit your message before sending it."
          onToggle={() => onMetadataChange({ showInputTranslateButton: !metadata.showInputTranslateButton })}
        />
      </div>
    </ChatSettingsSection>
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
