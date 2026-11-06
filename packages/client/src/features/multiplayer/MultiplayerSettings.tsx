import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { LogIn, Power, PowerOff, Users } from "lucide-react";
import type { MultiplayerGuestSession, MultiplayerPersona, MultiplayerPreview } from "@marinara-engine/shared";
import { multiplayerActionError, useMultiplayerMutation, useMultiplayerStatus } from "../../hooks/use-multiplayer";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import {
  SETTINGS_BUTTON_CLASS,
  SETTINGS_PRIMARY_FULL_BUTTON_CLASS,
  SettingsSection,
} from "../../components/panels/settings/SettingControls";
import { ChatModeSelectorModal, type ChatLaunchMode } from "../../components/chat/ChatModeSelectorModal";
import { MultiplayerPersonaFields, MULTIPLAYER_INPUT_CLASS } from "./MultiplayerFields";

export function MultiplayerSettings() {
  const { t } = useTranslation();
  const status = useMultiplayerStatus();
  const settings = useMultiplayerMutation<unknown, { enabled: boolean; consent: boolean }>(
    "/multiplayer/settings",
    "put",
  );
  const [consent, setConsent] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const createShared = useMultiplayerMutation<{ chatId: string }, { name: string; mode: ChatLaunchMode }>(
    "/multiplayer/prepare",
  );
  const id = useId();
  return (
    <SettingsSection
      title="Multiplayer"
      description="Play one chat together with people on other devices."
      headerAction={
        <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
          Work in progress
        </span>
      }
      icon={<Users size={16} />}
      anchorId="settings-section-multiplayer"
    >
      <div className="space-y-3">
        <button
          type="button"
          className={SETTINGS_BUTTON_CLASS}
          disabled={status.isFetching}
          onClick={() => void status.refetch()}
        >
          {t("multiplayer.refreshStatus")}
        </button>
        {status.isLoading ? (
          <p role="status" className="text-xs">
            {t("multiplayer.loading")}
          </p>
        ) : !status.data?.available ? (
          <p className="text-xs leading-relaxed">{t("multiplayer.environmentDisabled")}</p>
        ) : (
          <>
            <p className="text-xs leading-relaxed">{t("multiplayer.warning")}</p>
            {!status.data.enabled && (
              <label className="flex items-start gap-2 text-xs leading-relaxed">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                {t("multiplayer.consent")}
              </label>
            )}
            <button
              type="button"
              role="switch"
              aria-checked={status.data.enabled}
              aria-describedby={id}
              disabled={settings.isPending || (!status.data.enabled && !consent)}
              className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}
              onClick={() =>
                settings.mutate(
                  { enabled: !status.data!.enabled, consent: true },
                  { onSuccess: () => setConsent(false) },
                )
              }
            >
              {status.data.enabled ? <PowerOff size="0.8125rem" /> : <Power size="0.8125rem" />}
              {t(status.data.enabled ? "multiplayer.disable" : "multiplayer.enable")}
            </button>
            <p id={id} className="text-xs text-[var(--muted-foreground)]">
              {t("multiplayer.activationHelp")}
            </p>
            {status.data.enabled && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={SETTINGS_BUTTON_CLASS} onClick={() => setCreateOpen(true)}>
                  {t("multiplayer.create")}
                </button>
                <button
                  type="button"
                  disabled={"MarinaraAndroidNative" in window}
                  aria-expanded={joinOpen}
                  className={SETTINGS_BUTTON_CLASS}
                  onClick={() => setJoinOpen((value) => !value)}
                >
                  {t("multiplayer.join")}
                </button>
              </div>
            )}
            {"MarinaraAndroidNative" in window && <p className="text-xs">{t("multiplayer.nativeUnavailable")}</p>}
            {settings.isError && (
              <p role="alert" className="text-xs text-[var(--destructive)]">
                {t("multiplayer.actionFailed")}
              </p>
            )}
            {joinOpen && status.data.enabled && !("MarinaraAndroidNative" in window) && <MultiplayerJoin />}
            <ChatModeSelectorModal
              open={createOpen}
              onClose={() => setCreateOpen(false)}
              sharedOnly
              isPending={createShared.isPending}
              onSelectMode={(mode) =>
                createShared.mutate(
                  { mode, name: t("multiplayer.defaultName") },
                  {
                    onSuccess: (result) => {
                      setCreateOpen(false);
                      useChatStore.getState().setActiveChatId(result.chatId);
                      useUIStore.getState().closeRightPanel();
                    },
                  },
                )
              }
            />
            {createShared.isError && (
              <p role="alert" className="text-xs text-[var(--destructive)]">
                {t("multiplayer.actionFailed")}
              </p>
            )}
          </>
        )}
      </div>
    </SettingsSection>
  );
}

function MultiplayerJoin() {
  const { t } = useTranslation();
  const status = useMultiplayerStatus();
  const id = useId();
  const [inviteCode, setInviteCode] = useState("");
  const [reviewedCode, setReviewedCode] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [persona, setPersona] = useState<MultiplayerPersona>({ name: "", description: "" });
  const [consent, setConsent] = useState(false);
  const preview = useMultiplayerMutation<MultiplayerPreview, { inviteCode: string }>("/multiplayer/preview");
  const join = useMultiplayerMutation<
    MultiplayerGuestSession,
    { inviteCode: string; password: string; displayName: string; persona: MultiplayerPersona; consent: boolean }
  >("/multiplayer/join");
  const reviewed = preview.data && reviewedCode === inviteCode;
  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-3">
      <label htmlFor={`${id}-invite`} className="block text-xs font-medium">
        {t("multiplayer.inviteCode")}
      </label>
      <textarea
        id={`${id}-invite`}
        rows={3}
        maxLength={4096}
        value={inviteCode}
        onChange={(event) => {
          setInviteCode(event.target.value);
          setConsent(false);
        }}
        className={MULTIPLAYER_INPUT_CLASS}
      />
      <button
        type="button"
        className={SETTINGS_BUTTON_CLASS}
        disabled={!inviteCode.trim() || preview.isPending}
        onClick={() => preview.mutate({ inviteCode }, { onSuccess: () => setReviewedCode(inviteCode) })}
      >
        {t("multiplayer.reviewInvite")}
      </button>
      {preview.isError && (
        <p role="alert" className="text-xs text-[var(--destructive)]">
          {t("multiplayer.inviteFailed")}
        </p>
      )}
      {reviewed && (
        <>
          <div className="space-y-1 break-words text-xs">
            <p className="font-semibold">
              {preview.data.name} · {t(`multiplayer.guest.modes.${preview.data.mode}`)}
            </p>
            <p>{t("multiplayer.fingerprint")}</p>
            <p className="break-all font-mono">{preview.data.fingerprint}</p>
            <p>{t("multiplayer.verifyHost")}</p>
          </div>
          <label htmlFor={`${id}-password`} className="block text-xs font-medium">
            {t("multiplayer.password")}
          </label>
          <input
            id={`${id}-password`}
            type="password"
            autoComplete="off"
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={MULTIPLAYER_INPUT_CLASS}
          />
          <label htmlFor={`${id}-display`} className="block text-xs font-medium">
            {t("multiplayer.displayName")}
          </label>
          <input
            id={`${id}-display`}
            maxLength={80}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className={MULTIPLAYER_INPUT_CLASS}
          />
          <MultiplayerPersonaFields value={persona} onChange={setPersona} />
          <label className="flex items-start gap-2 text-xs leading-relaxed">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            {t("multiplayer.joinConsent")}
          </label>
          <button
            type="button"
            className={SETTINGS_PRIMARY_FULL_BUTTON_CLASS}
            disabled={join.isPending || !consent || !password || !displayName.trim() || !persona.name.trim()}
            onClick={() =>
              join.mutate(
                { inviteCode, password, displayName, persona, consent },
                {
                  onSuccess: (session) => {
                    setPassword("");
                    useChatStore.getState().setActiveChatId(session.localChatId);
                    useUIStore.getState().closeRightPanel();
                  },
                },
              )
            }
          >
            <LogIn size="0.8125rem" />
            {t("multiplayer.requestJoin")}
          </button>
          {join.isError && (
            <p role="alert" className="text-xs text-[var(--destructive)]">
              {t(
                multiplayerActionError(join.error) === "busy" && (status.data?.joined || status.data?.hosting)
                  ? "multiplayer.leaveCurrentFirst"
                  : "multiplayer.joinFailed",
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
