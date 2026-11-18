// What Roleplay's and Game's Agents sections both show: the note when no agents are downloaded, the Enable Agents
// switch and the Agent Suite button, plus the music player names both Music DJ cards use. Each face passes its own
// wording.
import type { ReactNode } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Sparkles, Wrench } from "lucide-react";
import type { MusicProvider } from "../../../components/chat/AgentAddSetupFields";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { cn } from "../../../lib/utils";

export function getMusicProviderLabel(provider: MusicProvider): string {
  return provider === "spotify" ? "Spotify" : provider === "youtube" ? "YouTube" : "Custom";
}

export function NoAgentsDownloaded({ modeLabel, onDownload }: { modeLabel: string; onDownload: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--secondary)]/35 px-4 py-5 text-center">
      <p className="text-xs font-medium text-[var(--foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.noAgentsDownloadedYet")}
      </p>
      <p className="mx-auto mt-1 max-w-[32rem] text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.downloadOptionalAgentsToAddTrackersWritersMapsAnd")} {modeLabel}.
      </p>
      <button
        type="button"
        onClick={onDownload}
        className="mari-chrome-control mari-chrome-control--primary mx-auto mt-3 px-4 py-2 text-xs"
      >
        <Sparkles size="0.8125rem" />
        {localizeUi("ui.agents.agentcatalogview.downloadAgents")}
      </button>
    </div>
  );
}

export function EnableAgentsSwitch({
  enabled,
  description,
  onChange,
}: {
  enabled: boolean;
  description: ReactNode;
  onChange: (enabled: boolean) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <SettingsSwitch
      label={localizeUi("ui.chat.chatsettingsdrawer.enableAgents")}
      description={description}
      checked={enabled}
      onChange={onChange}
      labelPosition="start"
      className={cn(
        "justify-between rounded-lg px-3 py-2.5 text-left",
        enabled
          ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
          : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
      )}
      labelClassName="text-xs font-medium"
    />
  );
}

export function AgentSuiteButton({ onClick }: { onClick: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left transition-all hover:bg-[var(--accent)]"
    >
      <div className="min-w-0 flex-1">
        <span className="text-[0.6875rem] font-medium">{localizeUi("ui.chat.agentsuitemodal.agentSuite")}</span>
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.chatsettingsdrawer.viewAndEditEverythingAgentsHaveStoredInThis")}
        </p>
      </div>
      <div className="flex h-5 w-9 shrink-0 items-center justify-center text-[var(--muted-foreground)]">
        <Wrench size="0.75rem" />
      </div>
    </button>
  );
}
