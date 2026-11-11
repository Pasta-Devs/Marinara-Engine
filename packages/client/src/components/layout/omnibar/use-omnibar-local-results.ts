import type { Chat } from "@marinara-engine/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import type { useOmnibarEntityRows } from "./use-omnibar-entity-rows";
import { useUIStore } from "../../../stores/ui.store";
import { useLocalizedUiText } from "../../../localization/use-localized-ui-text";
import { OMNIBAR_SETTINGS_TOGGLE_BINDINGS } from "../../../lib/omnibar-settings-toggle-bindings";
import type { OmnibarResult } from "../../../lib/omnibar-search";
import { buildOmnibarControlResults, buildOmnibarChatControlResults } from "../../../lib/omnibar-results";
import type { useUpdateChat, useUpdateChatMetadata } from "../../../hooks/use-chats";
import { useActivateTheme, useSetActiveTheme, useThemes } from "../../../hooks/use-themes";
import { putBackOwnLook } from "../../../lib/theme-package";
import { useThemeSafetyStore } from "../../../lib/theme-safety";

/** Every row the omnibar can rank without a server search: setting controls, the open chat's controls, commands and records. */
export function useOmnibarLocalResults({
  activeChat,
  activeChatId,
  data,
  theme,
  updateChat,
  updateChatMetadata,
}: {
  activeChat: Chat | null;
  activeChatId: string | null;
  data: ReturnType<typeof useOmnibarEntityRows>["data"];
  theme: ReturnType<typeof useUIStore.getState>["theme"];
  updateChat: ReturnType<typeof useUpdateChat>;
  updateChatMetadata: ReturnType<typeof useUpdateChatMetadata>;
}) {
  const { t } = useTranslation();
  const localize = useLocalizedUiText();
  const reduceAmbientEffects = useUIStore((state) => state.reduceAmbientEffects);
  const musicPlayerEnabled = useUIStore((state) => state.musicPlayerEnabled);
  const speechToTextEnabled = useUIStore((state) => state.speechToTextEnabled);
  const notificationSoundsOnlyWhenUnfocused = useUIStore((state) => state.notificationSoundsOnlyWhenUnfocused);
  const showTimestamps = useUIStore((state) => state.showTimestamps);
  const showModelName = useUIStore((state) => state.showModelName);
  const showTokenUsage = useUIStore((state) => state.showTokenUsage);
  // One shallow-compared subscription for every settings-registry toggle the
  // omnibar can flip in place, so adding a binding never means adding a hook.
  const settingsToggleValues = useUIStore(
    useShallow((state) => {
      const values: Record<string, boolean> = {};
      for (const id in OMNIBAR_SETTINGS_TOGGLE_BINDINGS) values[id] = OMNIBAR_SETTINGS_TOGGLE_BINDINGS[id].get(state);
      return values;
    }),
  );
  const userStatus = useUIStore((state) => state.userStatus);
  // "Custom theme": the way out of a broken theme that every theme leaves reachable (Ctrl+K and
  // the omnibar sit in the protected layer). Off switches the theme off everywhere; on picks the
  // theme again (with "Keep this theme?") or leaves safe mode.
  const { data: themes = [] } = useThemes();
  const activeTheme = themes.find((theme) => theme.isActive) ?? null;
  const safeMode = useThemeSafetyStore((state) => state.safeMode);
  const blockedThemeId = useThemeSafetyStore((state) => state.blockedThemeId);
  const setActiveTheme = useSetActiveTheme();
  const activateTheme = useActivateTheme();
  const setThemeActive = setActiveTheme.mutateAsync;
  const customThemeRow = useMemo<OmnibarResult | null>(() => {
    if (!activeTheme && !safeMode) return null;
    const on = !!activeTheme && !safeMode && blockedThemeId !== activeTheme.id;
    return {
      id: "control:customTheme",
      title: t("theming.command.customTheme", "Custom theme"),
      description: activeTheme?.name,
      aliases: [
        t("theming.command.turnOff", "Turn off custom theme"),
        "turn off custom theme",
        "disable theme",
        "safe mode",
        "reset theme",
        "default theme",
      ],
      category: "settings",
      score: 178,
      control: {
        type: "toggle",
        label: t("theming.command.customTheme", "Custom theme"),
        value: on,
        onChange: (next: string | boolean) => {
          const safety = useThemeSafetyStore.getState();
          if (next !== true) {
            void setThemeActive(null).then(() => {
              putBackOwnLook(activeTheme);
              safety.clearBlockedTheme();
              if (safety.safeMode) safety.leaveSafeMode();
            });
          } else if (safety.safeMode) safety.leaveSafeMode();
          else if (activeTheme) void activateTheme(activeTheme);
        },
      },
    };
  }, [activateTheme, activeTheme, blockedThemeId, safeMode, setThemeActive, t]);
  const controls = useMemo<OmnibarResult[]>(
    () => [
      ...(customThemeRow ? [customThemeRow] : []),
      ...buildOmnibarControlResults({
        localize,
        musicPlayerEnabled,
        notificationSoundsOnlyWhenUnfocused,
        reduceAmbientEffects,
        settingsToggleValues,
        setters: useUIStore.getState(),
        showModelName,
        showTimestamps,
        showTokenUsage,
        speechToTextEnabled,
        t,
        theme,
        userStatus,
      }),
    ],
    [
      customThemeRow,
      localize,
      musicPlayerEnabled,
      notificationSoundsOnlyWhenUnfocused,
      reduceAmbientEffects,
      settingsToggleValues,
      showModelName,
      showTimestamps,
      showTokenUsage,
      speechToTextEnabled,
      t,
      theme,
      userStatus,
    ],
  );

  // Chat state as inline controls: the changes a user makes most often are to
  // the chat they are already in — model, preset, persona, agents. These edit
  // the chat in the row, so nothing navigates away from the scene.
  // useMutation returns a fresh object every render, so the memo depends on the
  // stable mutateAsync functions. Depending on the mutation objects would give
  // this list a new identity each render and churn every list derived from it.
  const patchChat = updateChat.mutateAsync;
  const patchChatMetadata = updateChatMetadata.mutateAsync;
  const chatControls = useMemo<OmnibarResult[]>(
    () =>
      buildOmnibarChatControlResults({
        activeChat,
        activeChatId,
        connections: data.connections,
        patchChat,
        patchChatMetadata,
        resources: data.resources,
        t,
      }),
    [activeChat, activeChatId, data.connections, data.resources, patchChat, patchChatMetadata, t],
  );

  const searchableEntityResults = useMemo<OmnibarResult[]>(
    () => [
      ...data.chats.map((item) => ({
        id: `chat:${item.id}`,
        title: item.name,
        category: "chat" as const,
        target: { kind: "chat", chatId: item.id } as const,
        score: 1,
        preview: item.preview,
        kind: "chat" as const,
        icon: "chats" as const,
      })),
      ...data.resources.map((item) => ({
        ...item,
        id: `${item.kind}:${item.id}`,
        title: item.name,
        category: item.kind,
        target: { kind: "resource", resource: item.kind, id: item.id } as const,
        score: 1,
        description: item.description,
        preview: item.preview,
        kind: "resource" as const,
        icon: item.kind,
        control: "control" in item ? item.control : undefined,
      })),
      ...data.connections.map((item) => ({
        id: `connection:${item.id}`,
        title: item.name,
        category: "connection" as const,
        target: { kind: "panel", panel: "connections" } as const,
        score: 1,
        preview: item.preview,
        kind: "settings" as const,
        icon: "connection" as const,
      })),
    ],
    [data.chats, data.connections, data.resources],
  );
  const searchableCommandResults = useMemo<OmnibarResult[]>(
    () =>
      data.commands.map((command) => ({
        ...command,
        category: command.kind === "settings" ? ("settings" as const) : ("navigation" as const),
        score: 160,
      })),
    [data.commands],
  );
  const allLocalResults = useMemo(
    () => [...controls, ...chatControls, ...searchableCommandResults, ...searchableEntityResults],
    [chatControls, controls, searchableCommandResults, searchableEntityResults],
  );
  return { controls, chatControls, searchableEntityResults, allLocalResults, patchChat, patchChatMetadata };
}
