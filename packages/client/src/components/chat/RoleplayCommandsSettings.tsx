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
  const update = useUpdateChatMetadata();
  const metadata = chat.metadata;
  const enabled = roleplayCommandsEnabled(metadata);
  const individual = characters.length > 1 && metadata.groupChatMode === "individual";
  const privateAvailable = characters.length === 1 || individual;
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
          disabled={update.isPending}
          onChange={(value) => update.mutate({ id: chat.id, roleplayCommandsEnabled: value })}
          labelPosition="start"
          className="min-h-11 justify-between rounded-lg bg-[var(--background)]/75 px-3 py-2.5 text-left ring-1 ring-[var(--border)]"
          labelClassName="text-xs font-medium"
        />
        {enabled && (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLEPLAY_COMMAND_KEYS.map((key) => {
                const available =
                  key === "illustrate"
                    ? installedAgentIds.has("illustrator")
                    : key === "music"
                      ? installedAgentIds.has("spotify")
                      : key === "notes" || key === "memory"
                        ? privateAvailable
                        : true;
                const checked = isRoleplayCommandEnabled(metadata, key);
                return (
                  <SettingsSwitch
                    key={key}
                    label={t(`roleplay.commands.${key}.label`)}
                    description={
                      !available
                        ? t(
                            key === "notes" || key === "memory"
                              ? "roleplay.commands.individualRequired"
                              : "roleplay.commands.agentRequired",
                          )
                        : t(`roleplay.commands.${key}.description`)
                    }
                    checked={checked}
                    disabled={!available || update.isPending}
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
                );
              })}
            </div>
            {individual && (
              <label className="flex flex-col gap-1.5 text-xs">
                <span className="font-medium">{t("roleplay.commands.narrator.label")}</span>
                <select
                  value={
                    characters.some((character) => character.id === metadata.roleplayCommandNarratorId)
                      ? (metadata.roleplayCommandNarratorId ?? "")
                      : ""
                  }
                  disabled={update.isPending}
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
                <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
                  {t("roleplay.commands.narrator.description")}
                </span>
              </label>
            )}
            {isRoleplayCommandEnabled(metadata, "sound") && (
              <label className="flex flex-col gap-1.5 text-xs">
                <span className="font-medium">{t("roleplay.commands.sound.connection")}</span>
                <select
                  value={metadata.roleplaySoundConnectionId ?? ""}
                  disabled={update.isPending}
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
                <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
                  {t("roleplay.commands.sound.requirements")}
                </span>
              </label>
            )}
          </>
        )}
      </AgentSettingsCard>
    </div>
  );
}
