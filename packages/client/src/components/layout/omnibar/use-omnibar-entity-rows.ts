import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { readNamedRow } from "./omnibar-result-view";
import type {
  CommandCenterCategoryLabels,
  CommandCenterChatModeLabels,
} from "../../command-center/command-center-visuals";
import { usePersonalExtensionCommands } from "../../../lib/personal-extension-contributions";
import {
  buildOmnibarChatRows,
  buildOmnibarCharacterRows,
  buildOmnibarPersonaRows,
  buildOmnibarLorebookRows,
  buildOmnibarPresetRows,
  buildOmnibarAgentRows,
  buildOmnibarConnectionRows,
} from "../../../lib/omnibar-entity-rows";
import { createSystemCommandDefinitions } from "../../../lib/command-center-system-commands";
import { getCharacterDisplayIdentity } from "../../../lib/character-display";
import type { usePresets, useSetDefaultPreset } from "../../../hooks/use-presets";
import type { useLorebooks } from "../../../hooks/use-lorebooks";
import { useHomeFeed } from "../../../hooks/use-home-feed";
import { selectHomeBrowserPackages, useInstalledCapabilityPackages } from "../../../hooks/use-capability-packages";
import { resolveCapabilityPackageDisplay } from "../../../lib/capability-package-localization";
import type { useConnections } from "../../../hooks/use-connections";
import type { useChats } from "../../../hooks/use-chats";
import type { useCharacters, usePersonas } from "../../../hooks/use-characters";
import type { useAgentConfigs } from "../../../hooks/use-agents";

type OmnibarEntityRowsInput = {
  chats: ReturnType<typeof useChats>["data"];
  characters: ReturnType<typeof useCharacters>["data"];
  personas: ReturnType<typeof usePersonas>["data"];
  lorebooks: ReturnType<typeof useLorebooks>["data"];
  presets: ReturnType<typeof usePresets>["data"];
  connections: ReturnType<typeof useConnections>["data"];
  agents: ReturnType<typeof useAgentConfigs>["data"];
  categoryLabels: CommandCenterCategoryLabels;
  chatModeLabels: CommandCenterChatModeLabels;
  setDefaultPresetMutate: ReturnType<typeof useSetDefaultPreset>["mutate"];
};

/** The omnibar's own rows for every command, chat and library record, plus the name lookups they share. */
export function useOmnibarEntityRows({
  chats,
  characters,
  personas,
  lorebooks,
  presets,
  connections,
  agents,
  categoryLabels,
  chatModeLabels,
  setDefaultPresetMutate,
}: OmnibarEntityRowsInput) {
  const { t, i18n } = useTranslation();
  const installedPackages = useInstalledCapabilityPackages();
  // Slice 85: every Home package tab (Noodle, …) is a row too, as the Home navigator found them.
  const packageTabCommands = useMemo(
    () =>
      selectHomeBrowserPackages(installedPackages.data).map((item) => {
        const display = resolveCapabilityPackageDisplay(item.manifest, i18n.resolvedLanguage ?? i18n.language);
        return {
          id: `home-tab:${item.id}`,
          title: display.homeBrowserTab?.label ?? display.name,
          kind: "navigation" as const,
          icon: "package" as const,
          target: { kind: "package", packageId: item.id } as const,
          aliases: [item.manifest.name, display.name],
        };
      }),
    [installedPackages.data, i18n.language, i18n.resolvedLanguage],
  );
  // Q6: the Home feed's last message per recent chat (bounded, cached), for the chat rows' second line.
  const homeFeed = useHomeFeed();
  const latestMessageByChatId = useMemo(
    () =>
      new Map(
        (homeFeed.data?.recentChats ?? []).flatMap(({ chat, latestMessage }) =>
          latestMessage ? [[chat.id, latestMessage] as const] : [],
        ),
      ),
    [homeFeed.data?.recentChats],
  );
  const extensionCommands = usePersonalExtensionCommands();
  const characterById = useMemo(
    () =>
      new Map(
        (characters ?? []).flatMap((item) => {
          const row = readNamedRow(item);
          return row ? [[row.id, item] as const] : [];
        }),
      ),
    [characters],
  );
  const characterNameById = useMemo(
    () =>
      new Map(
        (characters ?? []).flatMap((item) => {
          const row = readNamedRow(item);
          if (!row) return [];
          const record = item as Record<string, unknown>;
          return [
            [
              row.id,
              getCharacterDisplayIdentity({ data: record.data, comment: record.comment as string | null | undefined }),
            ] as const,
          ];
        }),
      ),
    [characters],
  );
  const personaById = useMemo(() => new Map((personas ?? []).map((item) => [item.id, item])), [personas]);
  const connectionById = useMemo(
    () =>
      new Map(
        (connections ?? []).flatMap((item) => {
          const row = readNamedRow(item);
          return row ? [[row.id, row] as const] : [];
        }),
      ),
    [connections],
  );

  // Reverse index: which lorebooks are attached to a given character / persona.
  // Lets resource previews surface their real relationships, not just their own row.
  const lorebookLinks = useMemo(() => {
    const byCharacter = new Map<string, string[]>();
    const byPersona = new Map<string, string[]>();
    for (const book of lorebooks ?? []) {
      for (const cid of book.characterIds ?? []) {
        byCharacter.set(cid, [...(byCharacter.get(cid) ?? []), book.name]);
      }
      for (const pid of book.personaIds ?? []) {
        byPersona.set(pid, [...(byPersona.get(pid) ?? []), book.name]);
      }
    }
    return { byCharacter, byPersona };
  }, [lorebooks]);

  const data = useMemo(() => {
    const commands = [
      {
        id: "home",
        title: t("home.title", "Home"),
        kind: "navigation" as const,
        icon: "home" as const,
        target: { kind: "home" } as const,
        aliases: ["start"],
      },
      {
        id: "chats",
        title: t("ui.layout.chats", "Chats"),
        kind: "navigation" as const,
        icon: "chats" as const,
        target: { kind: "chats" } as const,
      },
      ...createSystemCommandDefinitions((key, fallback) => t(`commandCenter.system.${key}`, fallback)).map(
        (command) => ({
          id: command.id,
          title: command.title,
          kind: command.kind,
          icon: command.icon,
          aliases: command.aliases,
          keywords: command.keywords,
          target: command.target,
          availability: command.availability,
        }),
      ),
      ...packageTabCommands,
      ...extensionCommands.map((command) => ({
        ...command,
        action: { kind: "personal-extension", commandId: command.id } as const,
        target: { kind: "home" } as const,
      })),
    ];
    const chatRows = buildOmnibarChatRows({
      chats: chats ?? [],
      characterById,
      connectionById,
      personaById,
      chatModeLabels,
      latestMessageByChatId,
      t,
    });
    const resources = [
      ...buildOmnibarCharacterRows({
        characters: characters ?? [],
        lorebookNamesByCharacter: lorebookLinks.byCharacter,
        categoryLabels,
        t,
      }),
      ...buildOmnibarPersonaRows({
        personas: personas ?? [],
        lorebookNamesByPersona: lorebookLinks.byPersona,
        categoryLabels,
        t,
      }),
      ...buildOmnibarLorebookRows({
        lorebooks: lorebooks ?? [],
        characterNameById,
        personaById,
        categoryLabels,
        t,
      }),
      ...buildOmnibarPresetRows({
        presets: presets ?? [],
        categoryLabels,
        t,
        onSetDefaultPreset: (id) => setDefaultPresetMutate(id),
      }),
      ...buildOmnibarAgentRows({ agents: agents ?? [], connectionById, categoryLabels, t }),
    ];
    const connectionRows = buildOmnibarConnectionRows({ connections: connections ?? [], categoryLabels, t });
    return {
      commands,
      chats: chatRows,
      resources,
      connections: connectionRows,
      askProfessorTitle: t("omnibar.askProfessorMari"),
    };
  }, [
    agents,
    categoryLabels,
    characterById,
    characterNameById,
    characters,
    chatModeLabels,
    chats,
    connections,
    connectionById,
    extensionCommands,
    latestMessageByChatId,
    packageTabCommands,
    lorebooks,
    lorebookLinks,
    personaById,
    personas,
    presets,
    setDefaultPresetMutate,
    t,
  ]);
  return { characterNameById, personaById, connectionById, data };
}
