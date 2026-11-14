import { useMemo } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Regex } from "lucide-react";
import type { Chat, ScopedRegexMode } from "@marinara-engine/shared";
import { useCharacters } from "../../../hooks/use-characters";
import { useUpdateChatMetadata } from "../../../hooks/use-chats";
import { useRegexScripts, useUpdateRegexScript, type RegexScriptRow } from "../../../hooks/use-regex-scripts";
import { parseCharacterDisplayData } from "../../../lib/character-display";
import { cn } from "../../../lib/utils";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface ScopedRegexSectionProps {
  sectionId: string;
  order: number;
  chat: Chat;
  chatCharIds: string[];
  scopedRegexMode: ScopedRegexMode;
  inheritsScopedRegexMode: boolean;
  presetScopedRegexMode: ScopedRegexMode;
}

export function ScopedRegexSection({
  sectionId,
  order,
  chat,
  chatCharIds,
  scopedRegexMode,
  inheritsScopedRegexMode,
  presetScopedRegexMode,
}: ScopedRegexSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  const { data: allCharacters } = useCharacters({ includeBuiltIn: true });
  const { data: regexScripts } = useRegexScripts();
  const updateRegexScript = useUpdateRegexScript();
  // Character-scoped regex scripts grouped by the chat's characters — drives the
  // per-character list + the section badge, and whether the section shows at all.
  const chatScopedRegexGroups = useMemo(() => {
    if (!regexScripts) return [] as Array<{ characterId: string; name: string; scripts: RegexScriptRow[] }>;
    const charById = new Map(((allCharacters as Array<{ id: string; data?: unknown }>) ?? []).map((c) => [c.id, c]));
    const scripts = regexScripts as RegexScriptRow[];
    return chatCharIds
      .map((characterId) => {
        const row = charById.get(characterId);
        return {
          characterId,
          name: parseCharacterDisplayData({ data: row?.data }).name,
          scripts: scripts.filter((script) => {
            try {
              const ids = JSON.parse(script.targetCharacterIds ?? "[]");
              return Array.isArray(ids) && ids.includes(characterId);
            } catch {
              return false;
            }
          }),
        };
      })
      .filter((group) => group.scripts.length > 0);
  }, [regexScripts, allCharacters, chatCharIds]);
  const scopedRegexCount = useMemo(
    () => new Set(chatScopedRegexGroups.flatMap((g) => g.scripts.map((s) => s.id))).size,
    [chatScopedRegexGroups],
  );

  if (chatScopedRegexGroups.length === 0) return null;
  return (
    <ChatSettingsSection
      id={sectionId}
      style={{ order }}
      label={localizeUi("ui.chat.chatsettingsdrawer.scopedRegexScripts")}
      icon={<Regex size="0.875rem" />}
      count={scopedRegexCount}
      help={localizeUi("ui.chat.chatsettingsdrawer.applyCharacterScopedRegexScriptsToDisplayedMessagesExclusive")}
    >
      <div className="space-y-2">
        <SettingsSwitch
          label={localizeUi("chat.settings.regex.usePreset")}
          checked={inheritsScopedRegexMode}
          onChange={(inherit) => updateMeta.mutate({ id: chat.id, scopedRegexMode: inherit ? null : scopedRegexMode })}
          description={localizeUi("chat.settings.regex.presetDefault", {
            mode:
              presetScopedRegexMode === "disabled"
                ? localizeUi("ui.agents.agenteditor.disabled")
                : presetScopedRegexMode === "exclusive"
                  ? localizeUi("ui.chat.chatsettingsdrawer.exclusive")
                  : localizeUi("ui.chat.chatsettingsdrawer.chat"),
          })}
        />
        <div className="flex rounded-lg ring-1 ring-[var(--border)]">
          <button
            onClick={() => updateMeta.mutate({ id: chat.id, scopedRegexMode: "disabled" })}
            aria-pressed={scopedRegexMode === "disabled"}
            className={cn(
              "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-l-lg",
              scopedRegexMode === "disabled"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
            )}
          >
            {localizeUi("ui.agents.agenteditor.disabled")}
          </button>
          <button
            onClick={() => updateMeta.mutate({ id: chat.id, scopedRegexMode: "exclusive" })}
            aria-pressed={scopedRegexMode === "exclusive"}
            className={cn(
              "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors",
              scopedRegexMode === "exclusive"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
            )}
          >
            {localizeUi("ui.chat.chatsettingsdrawer.exclusive")}
          </button>
          <button
            onClick={() => updateMeta.mutate({ id: chat.id, scopedRegexMode: "chat" })}
            aria-pressed={scopedRegexMode === "chat"}
            className={cn(
              "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-r-lg",
              scopedRegexMode === "chat"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
            )}
          >
            {localizeUi("ui.chat.chatsettingsdrawer.chat")}
          </button>
        </div>
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {scopedRegexMode === "disabled"
            ? localizeUi("ui.chat.chatsettingsdrawer.characterScopedRegexIsOffOnlyGlobalScriptsRun")
            : scopedRegexMode === "exclusive"
              ? localizeUi("ui.chat.chatsettingsdrawer.eachScopedScriptOnlyTransformsItsOwnCharacterS")
              : localizeUi("ui.chat.chatsettingsdrawer.allScopedScriptsTransformEveryMessage")}
        </p>
        {chatScopedRegexGroups.map((group) => (
          <div key={group.characterId} className="rounded-lg ring-1 ring-[var(--border)]">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 truncate text-xs font-medium text-[var(--foreground)]">{group.name}</span>
              <span className="shrink-0 text-[0.625rem] text-[var(--muted-foreground)]">
                {group.scripts.length} {localizeUi("ui.chat.chatsettingsdrawer.script")}
                {group.scripts.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s")}
              </span>
            </div>
            <div className="max-h-48 space-y-0.5 overflow-y-auto border-t border-[var(--border)] px-2 py-1.5">
              {group.scripts.map((script) => {
                const enabled = script.enabled === "true";
                return (
                  <button
                    key={script.id}
                    type="button"
                    onClick={() => updateRegexScript.mutate({ id: script.id, enabled: !enabled })}
                    title={
                      enabled
                        ? localizeUi("ui.chat.chatsettingsdrawer.enabledClickToDisable")
                        : localizeUi("ui.chat.chatsettingsdrawer.disabledClickToEnable")
                    }
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[0.6875rem] transition-colors hover:bg-[var(--accent)]"
                  >
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        enabled ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/40",
                      )}
                    />
                    <span
                      className={cn(
                        "min-w-0 truncate",
                        enabled ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]",
                      )}
                    >
                      {script.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ChatSettingsSection>
  );
}
