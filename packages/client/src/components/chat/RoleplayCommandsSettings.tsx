import { Puzzle } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ROLEPLAY_COMMAND_KEYS,
  isRoleplayCommandEnabled,
  roleplayCommandsEnabled,
  type Chat,
} from "@marinara-engine/shared";
import { useUpdateChatMetadata } from "../../hooks/use-chats";
import { AgentSettingsCard } from "./AgentSettingsControls";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { cn } from "../../lib/utils";

export function RoleplayCommandsSettings({
  chat,
  characters,
  installedAgentIds,
  audioConnections,
}: {
  chat: Chat;
  characters: Array<{ id: string; name: string }>;
  installedAgentIds: ReadonlySet<string>;
  audioConnections: Array<{ id: string; name: string }>;
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
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLEPLAY_COMMAND_KEYS.map((key) => {
                const available =
                  key === "illustrate"
                    ? installedAgentIds.has("illustrator") && metadata.activeAgentIds?.includes("illustrator") === true
                    : key === "combat"
                      ? installedAgentIds.has("combat") && metadata.activeAgentIds?.includes("combat") === true
                      : key === "music"
                        ? installedAgentIds.has("spotify") &&
                          metadata.enableAgents === true &&
                          metadata.activeAgentIds?.includes("spotify") === true
                        : key === "notes" || key === "memory"
                          ? privateAvailable
                          : true;
                const checked = available && isRoleplayCommandEnabled(metadata, key);
                const audienceKey =
                  key === "roll"
                    ? "roleplayRollAudience"
                    : key === "document"
                      ? "roleplayDocumentAudience"
                      : "roleplayCombatAudience";
                const showAudienceWarning = metadata[audienceKey] === "narrator" && (!privateAvailable || !hasNarrator);
                return (
                  <div key={key} className="flex flex-col gap-2">
                    <SettingsSwitch
                      label={t(`roleplay.commands.${key}.label`)}
                      description={
                        !available
                          ? t(
                              key === "notes" || key === "memory"
                                ? "roleplay.commands.individualRequired"
                                : key === "illustrate"
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
                    {checked && (key === "roll" || key === "combat" || key === "document") && (
                      <div className="flex flex-col gap-1.5 text-xs">
                        <label htmlFor={`${chat.id}:${key}-audience`}>{t(`roleplay.commands.${key}.audience`)}</label>
                        <select
                          id={`${chat.id}:${key}-audience`}
                          aria-describedby={showAudienceWarning ? `${chat.id}:${key}-audience-status` : undefined}
                          value={metadata[audienceKey] ?? "all"}
                          onChange={(event) => update.mutate({ id: chat.id, [audienceKey]: event.target.value })}
                          className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 focus-visible:outline focus-visible:outline-[var(--primary)]"
                        >
                          <option value="all">{t("roleplay.commands.audience.all")}</option>
                          <option value="narrator">{t("roleplay.commands.audience.narrator")}</option>
                        </select>
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
                <select
                  id={`${chat.id}:command-narrator`}
                  aria-describedby={`${chat.id}:command-narrator-description`}
                  value={
                    characters.some((character) => character.id === metadata.roleplayCommandNarratorId)
                      ? (metadata.roleplayCommandNarratorId ?? "")
                      : ""
                  }
                  onChange={(event) =>
                    update.mutate({ id: chat.id, roleplayCommandNarratorId: event.target.value || null })
                  }
                  className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 focus-visible:outline focus-visible:outline-[var(--primary)]"
                >
                  <option value="">{t("roleplay.commands.narrator.none")}</option>
                  {characters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name}
                    </option>
                  ))}
                </select>
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
                <select
                  id={`${chat.id}:command-sound-connection`}
                  aria-describedby={`${chat.id}:command-sound-description`}
                  value={metadata.roleplaySoundConnectionId ?? ""}
                  onChange={(event) =>
                    update.mutate({ id: chat.id, roleplaySoundConnectionId: event.target.value || null })
                  }
                  className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 focus-visible:outline focus-visible:outline-[var(--primary)]"
                >
                  <option value="">{t("roleplay.commands.sound.defaultConnection")}</option>
                  {audioConnections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.name}
                    </option>
                  ))}
                </select>
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
