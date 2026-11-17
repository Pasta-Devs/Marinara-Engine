import { matchesAudioGenerationConnectionId } from "../../../lib/connection-filters";
import { Puzzle } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ROLEPLAY_COMMAND_KEYS,
  isRoleplayCommandEnabled,
  roleplayCommandsEnabled,
  type Chat,
} from "@marinara-engine/shared";
import { useUpdateChatMetadata } from "../../../hooks/use-chats";
import { AgentSettingsCard } from "../../../components/chat/AgentSettingsControls";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { Select } from "../../../components/ui/Select";
import { cn } from "../../../lib/utils";
import { normalizeRollOutcomeToneMode } from "../../../components/dice/dice-tone";
import { ConnectionSelect } from "../../../components/connections/ConnectionSelect";

export function RoleplayCommandsSettings({
  chat,
  characters,
  installedAgentIds,
  audioConnections,
}: {
  chat: Chat;
  characters: Array<{ id: string; name: string }>;
  installedAgentIds: ReadonlySet<string>;
  audioConnections: Array<{ id: string; name: string; audioGenerationLegacyConnectionId?: string | null }>;
}) {
  const { t } = useTranslation();
  const update = useUpdateChatMetadata({ serialize: true });
  const metadata = chat.metadata;
  const enabled = roleplayCommandsEnabled(metadata);
  const individual = characters.length > 1 && metadata.groupChatMode === "individual";
  const privateAvailable = characters.length === 1 || individual;
  const hasNarrator = characters.some((character) => character.id === metadata.roleplayCommandNarratorId);
  return (
    <div className="mb-3" data-roleplay-commands>
      <AgentSettingsCard
        id={`${chat.id}:roleplay-commands`}
        icon={<Puzzle size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
        title={t("roleplay.commands.title")}
        description={t("roleplay.commands.description")}
        initialOpen={false}
      >
        <SettingsSwitch
          label={t("roleplay.commands.title")}
          description={t("roleplay.commands.enableDescription")}
          checked={enabled}
          onChange={(value) => update.mutate({ id: chat.id, roleplayCommandsEnabled: value })}
          labelPosition="start"
          className={cn(
            "min-h-11 justify-between rounded-lg px-3 py-2.5 text-left ring-1",
            enabled
              ? "bg-[var(--primary)]/10 ring-[var(--primary)]/30"
              : "bg-[var(--background)]/75 ring-[var(--border)]",
          )}
          labelClassName="text-xs font-medium"
        />
        {enabled && (
          <>
            <div className="grid gap-2 @lg:grid-cols-2">
              {ROLEPLAY_COMMAND_KEYS.map((key) => {
                const available =
                  key === "illustrate" || key === "video"
                    ? installedAgentIds.has("illustrator") && metadata.activeAgentIds?.includes("illustrator") === true
                    : key === "combat"
                      ? installedAgentIds.has("combat") && metadata.activeAgentIds?.includes("combat") === true
                      : key === "music"
                        ? installedAgentIds.has("spotify") &&
                          metadata.enableAgents === true &&
                          metadata.activeAgentIds?.includes("spotify") === true
                        : key === "notes" || key === "memory" || key === "whisper"
                          ? privateAvailable
                          : true;
                const checked = available && isRoleplayCommandEnabled(metadata, key);
                const audienceKey =
                  key === "roll"
                    ? "roleplayRollAudience"
                    : key === "document"
                      ? "roleplayDocumentAudience"
                      : key === "whisper"
                        ? "roleplayWhisperAudience"
                        : "roleplayCombatAudience";
                const showAudienceWarning = metadata[audienceKey] === "narrator" && (!privateAvailable || !hasNarrator);
                return (
                  <div key={key} className="flex flex-col gap-2">
                    <SettingsSwitch
                      label={t(`roleplay.commands.${key}.label`)}
                      description={
                        !available
                          ? t(
                              key === "notes" || key === "memory" || key === "whisper"
                                ? "roleplay.commands.individualRequired"
                                : key === "illustrate" || key === "video"
                                  ? "roleplay.commands.agentAttachedRequired"
                                  : `roleplay.commands.${key}.agentRequired`,
                            )
                          : t(`roleplay.commands.${key}.description`)
                      }
                      checked={checked}
                      disabled={!available}
                      labelPosition="start"
                      onChange={(value) =>
                        update.mutate({
                          id: chat.id,
                          roleplayCommandToggles: { ...metadata.roleplayCommandToggles, [key]: value },
                        })
                      }
                      className={cn(
                        "h-full min-h-[4.125rem] items-center justify-between rounded-lg px-3 py-2.5 text-left",
                        checked
                          ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                          : "bg-[var(--background)]/75 ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
                      )}
                      labelClassName="text-[0.6875rem] font-medium"
                    />
                    {checked && key === "illustrate" && (
                      <SettingsSwitch
                        label={t("roleplay.commands.illustrate.inline.label")}
                        description={t("roleplay.commands.illustrate.inline.description")}
                        checked={metadata.roleplayIllustrateInline === true}
                        labelPosition="start"
                        onChange={(value) => update.mutate({ id: chat.id, roleplayIllustrateInline: value })}
                        className={cn(
                          "min-h-11 shrink-0 items-center justify-between rounded-lg px-3 py-2 text-left ring-1",
                          metadata.roleplayIllustrateInline === true
                            ? "bg-[var(--primary)]/10 ring-[var(--primary)]/30"
                            : "bg-[var(--background)]/75 ring-[var(--border)] hover:bg-[var(--accent)]",
                        )}
                        labelClassName="text-[0.6875rem] font-medium"
                      />
                    )}
                    {checked && (key === "roll" || key === "combat" || key === "document" || key === "whisper") && (
                      <div className="flex flex-col gap-1.5 text-xs">
                        <label htmlFor={`${chat.id}:${key}-audience`}>{t(`roleplay.commands.${key}.audience`)}</label>
                        <Select
                          id={`${chat.id}:${key}-audience`}
                          aria-describedby={showAudienceWarning ? `${chat.id}:${key}-audience-status` : undefined}
                          label={t(`roleplay.commands.${key}.audience`)}
                          value={metadata[audienceKey] ?? "all"}
                          options={[
                            { value: "all", label: t("roleplay.commands.audience.all") },
                            { value: "narrator", label: t("roleplay.commands.audience.narrator") },
                          ]}
                          onChange={(value) => update.mutate({ id: chat.id, [audienceKey]: value })}
                          className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 focus-visible:outline focus-visible:outline-[var(--primary)]"
                        />
                        {showAudienceWarning && (
                          <span
                            id={`${chat.id}:${key}-audience-status`}
                            className="text-[0.6875rem] text-[var(--muted-foreground)]"
                            role="status"
                          >
                            {t(
                              !privateAvailable
                                ? "roleplay.commands.narrator.individualRequired"
                                : "roleplay.commands.narrator.required",
                            )}
                          </span>
                        )}
                        {key === "roll" && (
                          <>
                            <label htmlFor={`${chat.id}:roll-outcome-tone`}>
                              {t("roleplay.commands.roll.outcomeTone.label")}
                            </label>
                            <Select
                              id={`${chat.id}:roll-outcome-tone`}
                              label={t("roleplay.commands.roll.outcomeTone.label")}
                              value={normalizeRollOutcomeToneMode(metadata.roleplayRollOutcomeTone)}
                              options={[
                                { value: "off", label: t("roleplay.commands.roll.outcomeTone.off") },
                                { value: "outcome", label: t("roleplay.commands.roll.outcomeTone.outcome") },
                                { value: "outcome-crits", label: t("roleplay.commands.roll.outcomeTone.outcomeCrits") },
                              ]}
                              onChange={(value) => update.mutate({ id: chat.id, roleplayRollOutcomeTone: value })}
                              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 focus-visible:outline focus-visible:outline-[var(--primary)]"
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {characters.length > 0 && (
              <div className="flex flex-col gap-1.5 text-xs">
                <label htmlFor={`${chat.id}:command-narrator`} className="font-medium">
                  {t("roleplay.commands.narrator.label")}
                </label>
                <Select
                  id={`${chat.id}:command-narrator`}
                  aria-describedby={`${chat.id}:command-narrator-description`}
                  label={t("roleplay.commands.narrator.label")}
                  value={
                    characters.some((character) => character.id === metadata.roleplayCommandNarratorId)
                      ? (metadata.roleplayCommandNarratorId ?? "")
                      : ""
                  }
                  options={[
                    { value: "", label: t("roleplay.commands.narrator.none") },
                    ...characters.map((character) => ({ value: character.id, label: character.name })),
                  ]}
                  onChange={(value) => update.mutate({ id: chat.id, roleplayCommandNarratorId: value || null })}
                  className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 focus-visible:outline focus-visible:outline-[var(--primary)]"
                />
                <span
                  id={`${chat.id}:command-narrator-description`}
                  className="text-[0.6875rem] text-[var(--muted-foreground)]"
                >
                  {t("roleplay.commands.narrator.description")}
                </span>
              </div>
            )}
            {isRoleplayCommandEnabled(metadata, "sound") && (
              <div className="flex flex-col gap-1.5 text-xs">
                <label htmlFor={`${chat.id}:command-sound-connection`} className="font-medium">
                  {t("roleplay.commands.sound.connection")}
                </label>
                <ConnectionSelect
                  job={t("connections.picker.job.roleplaySounds")}
                  id={`${chat.id}:command-sound-connection`}
                  aria-describedby={`${chat.id}:command-sound-description`}
                  value={
                    audioConnections.find((connection) =>
                      matchesAudioGenerationConnectionId(connection, metadata.roleplaySoundConnectionId),
                    )?.id ??
                    metadata.roleplaySoundConnectionId ??
                    null
                  }
                  onChange={(value) => update.mutate({ id: chat.id, roleplaySoundConnectionId: value })}
                  // Music & Sound Effects Models: kind "audio" lists the speech (TTS) ones.
                  kind="all"
                  rowFilter={(row) => audioConnections.some((connection) => connection.id === row.id)}
                  defaultLabel={t("roleplay.commands.sound.defaultConnection")}
                  className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 focus-visible:outline focus-visible:outline-[var(--primary)]"
                />
                <span
                  id={`${chat.id}:command-sound-description`}
                  className="text-[0.6875rem] text-[var(--muted-foreground)]"
                >
                  {t("roleplay.commands.sound.requirements")}
                </span>
              </div>
            )}
          </>
        )}
      </AgentSettingsCard>
    </div>
  );
}
