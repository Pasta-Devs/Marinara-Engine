import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  multiplayerErrorCodeSchema,
  type Chat,
  type MultiplayerAction,
  type MultiplayerGuestState,
  type MultiplayerHostState,
  type MultiplayerHostAction,
  type MultiplayerPersona,
} from "@marinara-engine/shared";
import {
  multiplayerActionError,
  useMultiplayerGuest,
  useMultiplayerHost,
  useMultiplayerMutation,
  useMultiplayerParticipantAction,
  useMultiplayerStatus,
} from "../../hooks/use-multiplayer";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import { CHAT_SETTINGS_WINDOW_ID, useFloatingWindowStore } from "../../stores/floating-window.store";
import { useUpdateChatMetadata } from "../../hooks/use-chats";
import { useCharacters } from "../../hooks/use-characters";
import { parseCharacterDisplayData } from "../../lib/character-display";
import { readChatMetadata } from "../../lib/chat-wizard-defaults";
import { showAlertDialog, showConfirmDialog } from "../../lib/app-dialogs";
import { MultiplayerGuestFrame } from "./MultiplayerGuestFrame";
import { MultiplayerGuestView } from "./MultiplayerGuestView";
import {
  MULTIPLAYER_GUEST_LABEL_KEYS,
  multiplayerGuestErrorLabelKey,
  type MultiplayerGuestLabels,
} from "./multiplayer-guest-labels";
import { MultiplayerPersonaFields, MULTIPLAYER_BUTTON_CLASS, MULTIPLAYER_INPUT_CLASS } from "./MultiplayerFields";
import { MultiplayerHostControls, type MultiplayerGameStart } from "./MultiplayerHostControls";
import { MultiplayerParticipantControls } from "./MultiplayerParticipantControls";
import { useHostHasDetachedDrawers } from "../../components/ui/drawer-host";

const ChatSetupWizard = lazy(() =>
  import("../../components/chat/ChatSetupWizard").then((module) => ({ default: module.ChatSetupWizard })),
);
const ChatSettingsDrawer = lazy(() =>
  import("../../components/chat/ChatSettingsDrawer").then((module) => ({ default: module.ChatSettingsDrawer })),
);
const PreparedMultiplayerGameSetup = lazy(() =>
  import("./PreparedMultiplayerGameSetup").then((module) => ({ default: module.PreparedMultiplayerGameSetup })),
);

export function MultiplayerChat({ chat }: { chat: Chat }) {
  const metadata = readChatMetadata(chat);
  const role =
    metadata.multiplayer && typeof metadata.multiplayer === "object"
      ? (metadata.multiplayer as { role?: unknown }).role
      : null;
  return role === "guest" ? <JoinedMultiplayerChat chat={chat} /> : <HostedMultiplayerChat chat={chat} />;
}

function useGuestLabels(): MultiplayerGuestLabels {
  const { t } = useTranslation();
  return useMemo(
    () =>
      ({
        ...Object.fromEntries(MULTIPLAYER_GUEST_LABEL_KEYS.map((key) => [key, t(`multiplayer.guest.${key}`)])),
        errors: Object.fromEntries(
          multiplayerErrorCodeSchema.options.map((key) => [key, t(multiplayerGuestErrorLabelKey(key))]),
        ),
        modes: {
          conversation: t("multiplayer.guest.modes.conversation"),
          roleplay: t("multiplayer.guest.modes.roleplay"),
          game: t("multiplayer.guest.modes.game"),
        },
      }) as MultiplayerGuestLabels,
    [t],
  );
}

function JoinedMultiplayerChat({ chat }: { chat: Chat }) {
  const { t } = useTranslation();
  const labels = useGuestLabels();
  const status = useMultiplayerStatus();
  const enabled = status.data?.available === true && status.data.enabled;
  const guest = useMultiplayerGuest();
  const action = useMultiplayerParticipantAction(false);
  const disconnect = useMultiplayerMutation<unknown, void>("/multiplayer/guest", "delete");
  const mode = useUIStore((state) => state.theme);
  const accent = useUIStore((state) => state.appAccentColor);
  const [participantOpen, setParticipantOpen] = useState(false);
  const session = guest.data?.localChatId === chat.id ? guest.data : null;
  const state: MultiplayerGuestState = session
    ? guest.isError
      ? { ...session.state, phase: "reconnecting", error: "disconnected" }
      : { ...session.state, error: multiplayerActionError(action.error) ?? session.state.error }
    : {
        phase: guest.isLoading ? "reconnecting" : "ended",
        snapshot: null,
        error: guest.isLoading ? null : "unavailable",
      };
  const leave = async () => {
    try {
      if (enabled) await disconnect.mutateAsync();
    } finally {
      useChatStore.getState().setActiveChatId(null);
    }
  };
  const onAction = async (value: MultiplayerAction) => {
    if (value.type === "leave") {
      await leave();
      return true;
    }
    try {
      await action.mutateAsync(value);
      return true;
    } catch {
      return false;
    }
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-b border-[var(--border)] p-2">
        {state.snapshot && (
          <button
            type="button"
            className={MULTIPLAYER_BUTTON_CLASS}
            aria-expanded={participantOpen}
            onClick={() => setParticipantOpen((open) => !open)}
          >
            {t(participantOpen ? "multiplayer.closeControls" : "multiplayer.yourCharacters")}
          </button>
        )}
        <button
          type="button"
          className={MULTIPLAYER_BUTTON_CLASS}
          onClick={() => void leave().catch(() => useChatStore.getState().setActiveChatId(null))}
        >
          {t("multiplayer.guest.leave")}
        </button>
      </div>
      {participantOpen && state.snapshot && (
        <div className="max-h-[50dvh] shrink-0 overflow-y-auto border-b border-[var(--border)]">
          <MultiplayerParticipantControls snapshot={state.snapshot} onAction={onAction} />
        </div>
      )}
      {"MarinaraAndroidNative" in window ? (
        <div className="space-y-3 p-4">
          <p>{t("multiplayer.nativeUnavailable")}</p>
          <button
            type="button"
            className={MULTIPLAYER_BUTTON_CLASS}
            onClick={() => void leave().catch(() => useChatStore.getState().setActiveChatId(null))}
          >
            {t("multiplayer.guest.leave")}
          </button>
        </div>
      ) : !enabled ? (
        <p role="status" className="p-4 text-sm">
          {t(status.isLoading ? "multiplayer.loading" : "multiplayer.environmentDisabled")}
        </p>
      ) : (
        <MultiplayerGuestFrame
          key={chat.id}
          state={state}
          labels={labels}
          title={t("multiplayer.title")}
          theme={{ mode, accent: /^#[0-9a-f]{6}$/iu.test(accent) ? accent : "#ec4b97" }}
          onAction={onAction}
          onProtocolError={() => {
            void disconnect.mutateAsync().catch(() => undefined);
          }}
        />
      )}
    </div>
  );
}

function HostedMultiplayerChat({ chat }: { chat: Chat }) {
  const { t } = useTranslation();
  const labels = useGuestLabels();
  const status = useMultiplayerStatus();
  const hostQuery = useMultiplayerHost(status.data?.enabled === true);
  const host = hostQuery.data?.chatId === chat.id ? hostQuery.data : null;
  const metadata = readChatMetadata(chat);
  const [setupComplete, setSetupComplete] = useState(metadata.multiplayerSetupComplete === true);
  const settingsOpen = useFloatingWindowStore((state) => state.open[CHAT_SETTINGS_WINDOW_ID] === true);
  const settingsSectionsPoppedOut = useHostHasDetachedDrawers(CHAT_SETTINGS_WINDOW_ID);
  // A hosted chat shows Chat Settings, so the topbar offers its button.
  const hosting = Boolean(host);
  useEffect(() => {
    if (!hosting) return;
    return useFloatingWindowStore.getState().registerHost(CHAT_SETTINGS_WINDOW_ID);
  }, [hosting]);
  const [initialSection, setInitialSection] = useState<"multiplayer" | null>(null);
  // Players opens Chat Settings at its Multiplayer section; the next open, from the topbar, starts at the top.
  useEffect(() => {
    if (!settingsOpen) setInitialSection(null);
  }, [settingsOpen]);
  const [participantOpen, setParticipantOpen] = useState(false);
  const [gameStart, setGameStart] = useState<MultiplayerGameStart | undefined>(() =>
    chat.metadata.gameSetupConfig && chat.metadata.multiplayerGameSetup
      ? { type: "startGame", config: chat.metadata.gameSetupConfig, ...chat.metadata.multiplayerGameSetup }
      : undefined,
  );
  const [setupSaving, setSetupSaving] = useState(false);
  const rosterAction = useMultiplayerMutation<unknown, MultiplayerHostAction>("/multiplayer/host/actions");
  const updateMetadata = useUpdateChatMetadata();
  const action = useMultiplayerParticipantAction(true);
  const stop = useMultiplayerMutation<unknown, { type: "stop" }>("/multiplayer/host/actions");
  const finishSetup = async (setup?: MultiplayerGameStart) => {
    if (setupSaving) return;
    setSetupSaving(true);
    try {
      if (setup && host) {
        const current = (await hostQuery.refetch()).data;
        if (
          !current ||
          current.chatId !== chat.id ||
          current.snapshot.status !== "lobby" ||
          current.snapshot.generation === "running"
        )
          throw new Error("Shared game setup is no longer editable");
        const selected = new Map<string, "character" | "gm">(
          setup.config.partyCharacterIds.map((id) => [id, "character"]),
        );
        if (setup.config.gmMode === "character" && setup.config.gmCharacterId)
          selected.set(setup.config.gmCharacterId, "gm");
        for (const character of current.snapshot.characters) {
          if (selected.get(character.id) !== character.role)
            await rosterAction.mutateAsync({ type: "remove-character", characterId: character.id });
        }
        for (const [characterId, role] of selected) {
          if (!current.snapshot.characters.some((character) => character.id === characterId && character.role === role))
            await rosterAction.mutateAsync({ type: "add-character", characterId, role });
        }
      }
      await updateMetadata.mutateAsync({
        id: chat.id,
        multiplayerSetupComplete: true,
        ...(setup
          ? {
              gameSetupConfig: setup.config,
              multiplayerGameSetup: {
                preferences: setup.preferences,
                gmConnectionId: setup.gmConnectionId,
                gameName: setup.gameName,
              },
            }
          : {}),
      });
      if (setup) setGameStart(setup);
      setSetupComplete(true);
    } catch {
      void showAlertDialog({ title: t("multiplayer.host.review"), message: t("multiplayer.actionFailed") });
    } finally {
      setSetupSaving(false);
    }
  };
  const openSettings = (section: "multiplayer" | null, opener?: HTMLElement) => {
    setInitialSection(section);
    useFloatingWindowStore.getState().openWindow(CHAT_SETTINGS_WINDOW_ID, opener);
  };
  const closeSettings = (options?: { force?: boolean }) => {
    useFloatingWindowStore.getState().dismissWindow(CHAT_SETTINGS_WINDOW_ID, options);
  };
  const openPlayers = () => openSettings("multiplayer");
  if (status.isLoading || hostQuery.isLoading)
    return (
      <p role="status" className="p-4 text-sm">
        {t("multiplayer.loading")}
      </p>
    );
  if (!status.data?.available || !status.data.enabled)
    return (
      <div className="space-y-3 p-4">
        <p className="text-sm">{t("multiplayer.environmentDisabled")}</p>
        <button
          type="button"
          className={MULTIPLAYER_BUTTON_CLASS}
          onClick={() => useChatStore.getState().setActiveChatId(null)}
        >
          {t("multiplayer.back")}
        </button>
      </div>
    );
  if (!host && metadata.multiplayer)
    return (
      <div className="space-y-3 p-4">
        <p>{t("multiplayer.host.stopped")}</p>
        <button
          type="button"
          className={MULTIPLAYER_BUTTON_CLASS}
          onClick={() => useChatStore.getState().setActiveChatId(null)}
        >
          {t("multiplayer.back")}
        </button>
      </div>
    );
  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {!setupComplete ? (
        <Suspense
          fallback={
            <p role="status" className="p-4">
              {t("multiplayer.loading")}
            </p>
          }
        >
          {chat.mode === "game" ? (
            <PreparedMultiplayerGameSetup
              chat={chat}
              players={host?.snapshot.players ?? []}
              busy={setupSaving}
              onPrepared={(setup) => {
                void finishSetup({ type: "startGame", ...setup });
              }}
              onCancel={() => useChatStore.getState().setActiveChatId(null)}
            />
          ) : (
            <ChatSetupWizard
              chat={chat}
              onFinish={() => {
                void finishSetup();
              }}
            />
          )}
        </Suspense>
      ) : !host ? (
        <MultiplayerHostReview
          chat={chat}
          tlsAvailable={status.data.tlsAvailable}
          onEditSetup={() => setSetupComplete(false)}
          onHosted={() => {
            if (chat.mode !== "game") openPlayers();
          }}
        />
      ) : (
        <>
          <div className="flex shrink-0 items-center justify-end gap-2 border-b border-[var(--border)] px-3 py-1">
            <button
              type="button"
              className={MULTIPLAYER_BUTTON_CLASS}
              aria-expanded={participantOpen}
              onClick={() => setParticipantOpen((open) => !open)}
            >
              {t(participantOpen ? "multiplayer.closeControls" : "multiplayer.yourCharacters")}
            </button>
            {/* Chat Settings opens from the topbar. */}
          </div>
          {participantOpen && (
            <div className="max-h-[50dvh] shrink-0 overflow-y-auto border-b border-[var(--border)]">
              <MultiplayerParticipantControls
                host
                snapshot={host.snapshot}
                onAction={async (value) => {
                  try {
                    await action.mutateAsync(value);
                    return true;
                  } catch {
                    return false;
                  }
                }}
              />
            </div>
          )}
          {host.snapshot.status === "lobby" && chat.mode === "game" ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <h1 className="mb-3 text-base font-semibold">{chat.name}</h1>
              <p className="mb-4 text-sm">{t("multiplayer.host.reviewParty")}</p>
              <MultiplayerHostControls host={host} gameStart={gameStart} />
              <button type="button" className={MULTIPLAYER_BUTTON_CLASS} onClick={() => setSetupComplete(false)}>
                {t("multiplayer.editSetup")}
              </button>
            </div>
          ) : (
            <MultiplayerGuestView
              state={{
                phase: hostQuery.isError ? "reconnecting" : "connected",
                snapshot: host.snapshot,
                error: hostQuery.isError ? "disconnected" : multiplayerActionError(action.error),
              }}
              labels={{ ...labels, leave: t("multiplayer.host.stop") }}
              onOpenPlayers={openPlayers}
              onAction={async (value: MultiplayerAction) => {
                if (value.type === "leave") {
                  if (
                    !(await showConfirmDialog({
                      title: t("multiplayer.host.stop"),
                      message: t("multiplayer.host.stopConfirm"),
                      tone: "destructive",
                    }))
                  )
                    return false;
                  try {
                    await stop.mutateAsync({ type: "stop" });
                    return true;
                  } catch {
                    return false;
                  }
                }
                try {
                  await action.mutateAsync(value);
                  return true;
                } catch {
                  return false;
                }
              }}
            />
          )}
          {(settingsOpen || settingsSectionsPoppedOut) && (
            <Suspense fallback={null}>
              <ChatSettingsDrawer
                chat={chat}
                open={settingsOpen}
                onClose={closeSettings}
                initialSection={initialSection}
                multiplayerGameStart={gameStart}
              />
            </Suspense>
          )}
        </>
      )}
      {updateMetadata.isError && (
        <p role="alert" className="p-3 text-xs text-[var(--destructive)]">
          {t("multiplayer.actionFailed")}
        </p>
      )}
    </div>
  );
}

function MultiplayerHostReview({
  chat,
  tlsAvailable,
  onEditSetup,
  onHosted,
}: {
  chat: Chat;
  tlsAvailable: boolean;
  onEditSetup: () => void;
  onHosted: () => void;
}) {
  const { t } = useTranslation();
  const { data: characters = [] } = useCharacters();
  const selectedIds = new Set([
    ...chat.characterIds,
    ...(chat.metadata.gameSetupConfig?.partyCharacterIds ?? []),
    ...(chat.metadata.gameSetupConfig?.gmCharacterId ? [chat.metadata.gameSetupConfig.gmCharacterId] : []),
  ]);
  const [publicOrigin, setPublicOrigin] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [persona, setPersona] = useState<MultiplayerPersona>({ name: "", description: "" });
  const [consent, setConsent] = useState(false);
  const host = useMultiplayerMutation<
    MultiplayerHostState,
    {
      chatId: string;
      publicOrigin: string;
      password: string;
      displayName: string;
      persona: MultiplayerPersona;
      consent: boolean;
    }
  >("/multiplayer/host");
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-base font-semibold">{t("multiplayer.host.review")}</h1>
        <p className="break-words text-sm">
          {chat.name} · {t(`multiplayer.guest.modes.${chat.mode}`)}
        </p>
        <p className="text-xs leading-relaxed">{t("multiplayer.host.disclosure")}</p>
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">{t("multiplayer.host.selectedCharacters")}</h2>
          {characters
            .filter(
              (character): character is { id: string; data: unknown } =>
                typeof character.id === "string" && selectedIds.has(character.id) && "data" in character,
            )
            .map((character) => {
              const data = parseCharacterDisplayData(character);
              return (
                <details key={character.id} className="border-b border-[var(--border)] py-2">
                  <summary className="cursor-pointer break-words text-xs font-medium">
                    {data.name} ·{" "}
                    {t(
                      character.id === chat.metadata.gameSetupConfig?.gmCharacterId
                        ? "multiplayer.guest.gm"
                        : "multiplayer.guest.ai",
                    )}
                  </summary>
                  <p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs">
                    {data.description}
                  </p>
                </details>
              );
            })}
          {selectedIds.size === 0 && (
            <p className="text-xs text-[var(--muted-foreground)]">{t("multiplayer.host.noCharacters")}</p>
          )}
        </div>
        <p className="text-xs leading-relaxed">{t("multiplayer.warning")}</p>
        {!tlsAvailable && (
          <p role="alert" className="text-xs text-[var(--destructive)]">
            {t("multiplayer.host.tlsRequired")}
          </p>
        )}
        <label className="block space-y-1 text-xs font-medium">
          <span>{t("multiplayer.host.origin")}</span>
          <input
            type="url"
            value={publicOrigin}
            maxLength={256}
            placeholder={t("multiplayer.host.originPlaceholder")}
            onChange={(event) => setPublicOrigin(event.target.value)}
            className={MULTIPLAYER_INPUT_CLASS}
          />
        </label>
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("multiplayer.host.originHelp")}</p>
        <label className="block space-y-1 text-xs font-medium">
          <span>{t("multiplayer.password")}</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={MULTIPLAYER_INPUT_CLASS}
          />
        </label>
        <label className="block space-y-1 text-xs font-medium">
          <span>{t("multiplayer.displayName")}</span>
          <input
            maxLength={80}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className={MULTIPLAYER_INPUT_CLASS}
          />
        </label>
        <MultiplayerPersonaFields value={persona} onChange={setPersona} />
        <label className="flex items-start gap-2 text-xs leading-relaxed">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          {t("multiplayer.host.consent")}
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={MULTIPLAYER_BUTTON_CLASS} onClick={onEditSetup}>
            {t("multiplayer.editSetup")}
          </button>
          <button
            type="button"
            className={MULTIPLAYER_BUTTON_CLASS}
            disabled={
              !tlsAvailable ||
              !consent ||
              password.length < 12 ||
              !displayName.trim() ||
              !persona.name.trim() ||
              !publicOrigin ||
              host.isPending
            }
            onClick={() =>
              host.mutate(
                { chatId: chat.id, publicOrigin, password, displayName, persona, consent },
                {
                  onSuccess: () => {
                    setPassword("");
                    onHosted();
                  },
                },
              )
            }
          >
            {t("multiplayer.host.start")}
          </button>
        </div>
        {host.isError && (
          <p role="alert" className="text-xs text-[var(--destructive)]">
            {t("multiplayer.host.failed")}
          </p>
        )}
      </div>
    </div>
  );
}
