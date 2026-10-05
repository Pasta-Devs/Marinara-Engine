import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Joystick } from "lucide-react";
import type { MultiplayerHostAction, MultiplayerHostState } from "@marinara-engine/shared";
import { useMultiplayerHost, useMultiplayerMutation } from "../../hooks/use-multiplayer";
import { characterKeys } from "../../hooks/use-characters";
import { ChatSettingsSection } from "../chat-settings/ChatSettingsSection";
import { copyToClipboard } from "../../lib/utils";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { MULTIPLAYER_BUTTON_CLASS, MULTIPLAYER_INPUT_CLASS } from "./MultiplayerFields";

export type MultiplayerGameStart = Extract<MultiplayerHostAction, { type: "startGame" }>;

export function MultiplayerHostControls({
  host,
  gameStart,
}: {
  host: MultiplayerHostState;
  gameStart?: MultiplayerGameStart;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const action = useMultiplayerMutation<unknown, MultiplayerHostAction>("/multiplayer/host/actions");
  const [copyStatus, setCopyStatus] = useState(false);
  const [automaticReplies, setAutomaticReplies] = useState(host.snapshot.usage.automaticReplies);
  const [limit, setLimit] = useState(String(host.snapshot.usage.maxGenerations));
  useEffect(() => {
    setAutomaticReplies(host.snapshot.usage.automaticReplies);
    setLimit(String(host.snapshot.usage.maxGenerations));
  }, [host.snapshot.usage.automaticReplies, host.snapshot.usage.maxGenerations]);
  const canConfigure = host.snapshot.status === "lobby" || host.snapshot.status === "paused";
  const gm = host.snapshot.characters.find((character) => character.role === "gm");
  const run = async (value: MultiplayerHostAction) => {
    if (value.type === "stop" || value.type === "kick" || value.type === "pass") {
      const title = t(`multiplayer.host.${value.type}`);
      const message = t(`multiplayer.host.${value.type}Confirm`);
      const confirmed = await showConfirmDialog({
        title,
        message,
        tone: value.type === "pass" ? "default" : "destructive",
      });
      if (!confirmed) return;
    }
    action.mutate(value);
  };
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-[var(--border)]">
        {host.snapshot.players.map((player) => (
          <li key={player.id} className="space-y-2 py-2 text-xs">
            <p className="break-words font-medium">
              {player.displayName}
              {player.isHost && <> · {t("multiplayer.guest.host")}</>}
              {player.id === host.snapshot.selfId && <> · {t("multiplayer.guest.you")}</>}
            </p>
            <p className="break-words text-[var(--muted-foreground)]">
              {player.personaName
                ? t("multiplayer.guest.playing", { name: player.personaName })
                : t("multiplayer.guest.noPersona")}{" "}
              · {t(player.connected ? "multiplayer.guest.connected" : "multiplayer.guest.reconnecting")}
            </p>
            {host.snapshot.mode === "game" && (
              <p>
                {t(
                  player.joinsNextRound
                    ? "multiplayer.guest.nextRound"
                    : player.ready
                      ? "multiplayer.guest.ready"
                      : "multiplayer.guest.waiting",
                )}
              </p>
            )}
            {!player.isHost && (
              <div className="flex flex-wrap gap-2">
                {host.snapshot.mode === "game" && (
                  <button
                    type="button"
                    className={MULTIPLAYER_BUTTON_CLASS}
                    disabled={action.isPending || host.snapshot.round?.phase !== "collecting" || player.ready}
                    onClick={() => void run({ type: "pass", participantId: player.id })}
                  >
                    {t("multiplayer.host.pass")}
                  </button>
                )}
                <button
                  type="button"
                  className={MULTIPLAYER_BUTTON_CLASS}
                  disabled={action.isPending}
                  onClick={() => void run({ type: "kick", participantId: player.id })}
                >
                  {t("multiplayer.host.kick")}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <h3 className="text-xs font-semibold">{t("multiplayer.host.selectedCharacters")}</h3>
        {host.snapshot.characters.length === 0 && (
          <p className="text-xs text-[var(--muted-foreground)]">{t("multiplayer.host.noCharacters")}</p>
        )}
        {host.snapshot.characters.map((character) => (
          <div key={character.id} className="flex flex-wrap items-center gap-2 text-xs">
            <p className="min-w-0 flex-1 break-words">
              {character.name} · {t(character.role === "gm" ? "multiplayer.guest.gm" : "multiplayer.guest.ai")}
            </p>
            <button
              type="button"
              className={MULTIPLAYER_BUTTON_CLASS}
              disabled={action.isPending || host.snapshot.generation === "running"}
              onClick={() => action.mutate({ type: "remove-character", characterId: character.id })}
            >
              {t("multiplayer.character.remove")}
            </button>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <button
          type="button"
          className={MULTIPLAYER_BUTTON_CLASS}
          disabled={action.isPending}
          onClick={() => {
            setCopyStatus(false);
            action.mutate({ type: "invite" });
          }}
        >
          {t(host.invite ? "multiplayer.host.replaceInvite" : "multiplayer.host.invite")}
        </button>
        {host.invite && (
          <>
            <p className="text-xs">
              {t("multiplayer.host.inviteExpires", { time: new Date(host.invite.expiresAt).toLocaleString() })}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">{t("multiplayer.host.passwordSeparate")}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={MULTIPLAYER_BUTTON_CLASS}
                onClick={() => void copyToClipboard(host.invite!.code).then(setCopyStatus)}
              >
                {t(copyStatus ? "multiplayer.host.copied" : "multiplayer.host.copyInvite")}
              </button>
              <button
                type="button"
                className={MULTIPLAYER_BUTTON_CLASS}
                disabled={action.isPending}
                onClick={() => action.mutate({ type: "revoke-invite" })}
              >
                {t("multiplayer.host.revokeInvite")}
              </button>
            </div>
            <details>
              <summary className="cursor-pointer py-2 text-xs">{t("multiplayer.inviteCode")}</summary>
              <p className="select-all break-all rounded-lg bg-[var(--secondary)] p-2 text-xs">{host.invite.code}</p>
            </details>
          </>
        )}
      </div>
      <div className="space-y-3">
        <h3 className="text-xs font-semibold">{t("multiplayer.host.requests")}</h3>
        {host.pendingRequests.length === 0 && (
          <p className="text-xs text-[var(--muted-foreground)]">{t("multiplayer.host.noRequests")}</p>
        )}
        {host.pendingRequests.map((request) => (
          <div key={request.id} className="space-y-2 border-t border-[var(--border)] pt-2">
            <p className="break-words text-xs font-semibold">
              {request.displayName} · {request.persona.name}
            </p>
            <p className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs">
              {request.persona.description}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={MULTIPLAYER_BUTTON_CLASS}
                disabled={action.isPending}
                onClick={() => action.mutate({ type: "approve", requestId: request.id })}
              >
                {t("multiplayer.host.approve")}
              </button>
              <button
                type="button"
                className={MULTIPLAYER_BUTTON_CLASS}
                disabled={action.isPending}
                onClick={() => action.mutate({ type: "decline", requestId: request.id })}
              >
                {t("multiplayer.host.decline")}
              </button>
            </div>
          </div>
        ))}
      </div>
      {host.proposals.map((proposal) => (
        <div key={proposal.id} className="space-y-2 border-t border-[var(--border)] pt-2">
          <p className="break-words text-xs font-semibold">
            {proposal.displayName} · {proposal.character.name} ·{" "}
            {t(proposal.character.role === "gm" ? "multiplayer.guest.gm" : "multiplayer.guest.ai")}
          </p>
          <p className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs">
            {proposal.character.description}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={MULTIPLAYER_BUTTON_CLASS}
              disabled={action.isPending}
              onClick={() =>
                action.mutate(
                  { type: "proposal-approve", proposalId: proposal.id },
                  { onSuccess: () => void queryClient.invalidateQueries({ queryKey: characterKeys.all }) },
                )
              }
            >
              {t("multiplayer.host.approveCharacter")}
            </button>
            <button
              type="button"
              className={MULTIPLAYER_BUTTON_CLASS}
              disabled={action.isPending}
              onClick={() => action.mutate({ type: "proposal-decline", proposalId: proposal.id })}
            >
              {t("multiplayer.host.decline")}
            </button>
          </div>
        </div>
      ))}
      {host.snapshot.mode === "game" && host.snapshot.status === "lobby" && gameStart && (
        <div className="space-y-2 border-t border-[var(--border)] pt-3">
          <p className="text-xs">{t("multiplayer.host.reviewParty")}</p>
          <button
            type="button"
            className={MULTIPLAYER_BUTTON_CLASS}
            disabled={
              action.isPending || host.snapshot.players.some((player) => !player.personaName || !player.connected)
            }
            onClick={() =>
              action.mutate({
                ...gameStart,
                config: {
                  ...gameStart.config,
                  partyCharacterIds: host.snapshot.characters
                    .filter((character) => character.role === "character")
                    .map((character) => character.id),
                  gmMode: gm ? "character" : "standalone",
                  gmCharacterId: gm?.id ?? null,
                },
              })
            }
          >
            {t("multiplayer.host.startGame")}
          </button>
        </div>
      )}
      <div className="space-y-2 border-t border-[var(--border)] pt-3">
        <p className="text-xs">
          {t("multiplayer.host.usage", {
            used: host.snapshot.usage.generations,
            limit: host.snapshot.usage.maxGenerations,
          })}
        </p>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={automaticReplies}
            disabled={!canConfigure || action.isPending}
            onChange={(event) => setAutomaticReplies(event.target.checked)}
          />
          {t("multiplayer.host.automaticReplies")}
        </label>
        <label className="block space-y-1 text-xs">
          <span>{t("multiplayer.host.generationLimit")}</span>
          <input
            type="number"
            min={1}
            max={1000}
            step={1}
            value={limit}
            disabled={!canConfigure || action.isPending}
            onChange={(event) => setLimit(event.target.value)}
            className={MULTIPLAYER_INPUT_CLASS}
          />
        </label>
        <p className="text-xs text-[var(--muted-foreground)]">{t("multiplayer.host.configureHelp")}</p>
        <button
          type="button"
          className={MULTIPLAYER_BUTTON_CLASS}
          disabled={
            !canConfigure ||
            action.isPending ||
            !Number.isInteger(Number(limit)) ||
            Number(limit) < 1 ||
            Number(limit) > 1000
          }
          onClick={() => action.mutate({ type: "configure", automaticReplies, maxGenerations: Number(limit) })}
        >
          {t("multiplayer.host.saveControls")}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {host.snapshot.status !== "lobby" && (
          <button
            type="button"
            className={MULTIPLAYER_BUTTON_CLASS}
            disabled={action.isPending}
            onClick={() => action.mutate({ type: host.snapshot.status === "paused" ? "resume" : "pause" })}
          >
            {t(host.snapshot.status === "paused" ? "multiplayer.host.resume" : "multiplayer.host.pause")}
          </button>
        )}
        <button
          type="button"
          className={MULTIPLAYER_BUTTON_CLASS}
          disabled={action.isPending}
          onClick={() => void run({ type: "stop" })}
        >
          {t("multiplayer.host.stop")}
        </button>
      </div>
      {host.snapshot.status === "paused" && host.snapshot.mode === "game" && (
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("multiplayer.host.resumeHelp")}</p>
      )}
      {action.isError && (
        <p role="alert" className="text-xs text-[var(--destructive)]">
          {t("multiplayer.actionFailed")}
        </p>
      )}
    </div>
  );
}

export function MultiplayerPlayersSection({
  chatId,
  forceOpen = false,
  gameStart,
}: {
  chatId: string;
  forceOpen?: boolean;
  gameStart?: MultiplayerGameStart;
}) {
  const { t } = useTranslation();
  const { data: host } = useMultiplayerHost();
  if (!host || host.chatId !== chatId) return null;
  return (
    <ChatSettingsSection
      id="multiplayer"
      label={t("multiplayer.title")}
      icon={<Joystick size={16} />}
      count={host.snapshot.players.length}
      forceOpen={forceOpen}
      style={{ order: -1450 }}
    >
      <MultiplayerHostControls host={host} gameStart={gameStart} />
    </ChatSettingsSection>
  );
}
