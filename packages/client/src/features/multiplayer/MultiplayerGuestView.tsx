import { useEffect, useId, useRef, useState } from "react";
import { Bot, Check, LogOut, Send, Users, X } from "lucide-react";
import { MULTIPLAYER_LIMITS, type MultiplayerAction, type MultiplayerGuestState } from "@marinara-engine/shared";
import { ChatModeIcon } from "../../components/chat/ChatModeIcon";
import { getChatInputShellClass } from "../../components/chat/chat-input-styles";
import { cn, generateClientId } from "../../lib/utils";
import type { MultiplayerGuestLabels } from "./multiplayer-guest-labels";

interface MultiplayerGuestViewProps {
  state: MultiplayerGuestState;
  /** True means accepted by the host; failures must leave the draft intact. */
  onAction: (action: MultiplayerAction) => Promise<boolean>;
  labels: MultiplayerGuestLabels;
  onOpenPlayers?: () => void;
}

const BUTTON_CLASS =
  "mari-chrome-control flex !min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium !text-[var(--foreground)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50";

function formatLabel(template: string, values: Record<string, string | number>) {
  return template.replace(/\{\{(\w+)\}\}/gu, (match, key: string) => String(values[key] ?? match));
}

/** Peer content is rendered only as React text; no rich renderer or local capabilities. */
export function MultiplayerGuestView({ state, onAction, labels, onOpenPlayers }: MultiplayerGuestViewProps) {
  const [draft, setDraft] = useState("");
  const [playersOpen, setPlayersOpen] = useState(false);
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const sendAttemptRef = useRef<{ signature: string; operationId: string; sequence: number } | null>(null);
  const transcriptRef = useRef<HTMLElement>(null);
  const followingLatestRef = useRef(true);
  const [actionFailed, setActionFailed] = useState(false);
  const composerId = useId();
  const playersId = useId();
  const snapshot = state.snapshot;
  const round = snapshot?.round;
  const game = snapshot?.game;
  const isGame = snapshot?.mode === "game";
  const connected = state.phase === "connected" && snapshot?.status !== "ended";
  const canAct = connected && snapshot?.status === "active";
  const ownSubmission = round?.ownSubmission;
  const editing = round?.id === editingRoundId;
  const canSubmitRound =
    canAct &&
    round?.phase === "collecting" &&
    round.requiredParticipantIds.includes(snapshot.selfId) &&
    (!ownSubmission || editing);
  const canSend = isGame ? canSubmitRound : canAct && snapshot?.generation !== "running";
  const ownPlayer = snapshot?.players.find((player) => player.id === snapshot.selfId);
  const eventLabels = {
    "host-pass": labels.eventHostPass,
    kick: labels.eventKick,
    pause: labels.eventPause,
    resume: labels.eventResume,
  };
  const waitingPlayers = snapshot?.players.filter(
    (player) => round?.requiredParticipantIds.includes(player.id) && !round.submittedParticipantIds.includes(player.id),
  );
  const phaseText =
    state.phase === "awaiting-approval"
      ? labels.awaitingApproval
      : state.phase === "reconnecting"
        ? labels.reconnecting
        : state.phase === "ended" || snapshot?.status === "ended"
          ? labels.ended
          : snapshot?.status === "lobby"
            ? labels.lobby
            : snapshot?.status === "paused"
              ? labels.paused
              : labels.connected;

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript && followingLatestRef.current) transcript.scrollTop = transcript.scrollHeight;
  }, [playersOpen, snapshot?.revision]);
  useEffect(() => {
    if (state.error === "stale-action") sendAttemptRef.current = null;
  }, [state.error]);

  const dispatch = async (action: MultiplayerAction) => {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    setPending(true);
    setActionFailed(false);
    try {
      const accepted = await onAction(action);
      if (!accepted) setActionFailed(true);
      return accepted;
    } catch {
      setActionFailed(true);
      return false;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const submit = async () => {
    if (!canSend || pendingRef.current || !draft.trim()) return;
    const submittedDraft = draft;
    const payload =
      isGame && round
        ? {
            type: "submit-action" as const,
            roundId: round.id,
            submissionRevision: ownSubmission ? ownSubmission.revision + 1 : 0,
            text: submittedDraft,
          }
        : { type: "message" as const, text: submittedDraft };
    const signature = JSON.stringify(payload);
    // An acknowledgement can be lost after commit. Retrying the same draft
    // must retain its operation ID so the host can return the original result.
    const attempt =
      sendAttemptRef.current?.signature === signature
        ? sendAttemptRef.current
        : { signature, operationId: generateClientId(), sequence: snapshot?.nextSequence ?? 0 };
    sendAttemptRef.current = attempt;
    const accepted = await dispatch({ ...payload, operationId: attempt.operationId, sequence: attempt.sequence });
    if (accepted) {
      sendAttemptRef.current = null;
      setDraft((current) => (current === submittedDraft ? "" : current));
      setEditingRoundId(null);
    }
  };

  const leave = async () => {
    // Leaving must remain possible while a send is pending or transport is down.
    try {
      if (!(await onAction({ type: "leave", operationId: generateClientId(), sequence: snapshot?.nextSequence ?? 0 })))
        setActionFailed(true);
    } catch {
      setActionFailed(true);
    }
  };

  return (
    <main
      data-multiplayer-guest
      data-chat-mode={snapshot?.mode}
      className="flex h-full min-h-0 flex-col overflow-y-auto bg-[var(--background)] text-[var(--foreground)]"
    >
      <header className="sticky top-0 z-10 flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--background)] px-3 py-2">
        {snapshot && <ChatModeIcon mode={snapshot.mode} size={18} className="shrink-0 text-[var(--primary)]" />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">{snapshot?.name ?? labels.title}</h1>
          <p className="truncate text-xs text-[var(--muted-foreground)]">
            {snapshot ? labels.modes[snapshot.mode] : phaseText}
          </p>
        </div>
        {snapshot && (
          <button
            type="button"
            className={BUTTON_CLASS}
            aria-expanded={playersOpen}
            aria-controls={onOpenPlayers ? undefined : playersId}
            aria-label={playersOpen ? labels.closePlayers : labels.players}
            onClick={() => (onOpenPlayers ? onOpenPlayers() : setPlayersOpen((open) => !open))}
          >
            {playersOpen ? <X size={16} /> : <Users size={16} />}
            <span>{snapshot.players.length}</span>
          </button>
        )}
        <button type="button" onClick={() => void leave()} className={BUTTON_CLASS}>
          <LogOut size={16} />
          {labels.leave}
        </button>
      </header>

      <div role="status" aria-live="polite" className="shrink-0 border-b border-[var(--border)] px-3 py-2 text-xs">
        <p>{phaseText}</p>
        {snapshot?.generation === "running" && <p className="mt-1">{labels.generating}</p>}
        {state.error && <p className="mt-1 text-[var(--destructive)]">{labels.errors[state.error]}</p>}
        {ownPlayer?.personaChangeRejected && state.error !== "identity-conflict" && (
          <p className="mt-1 text-[var(--destructive)]">{labels.errors["identity-conflict"]}</p>
        )}
        {!state.error && snapshot?.generation === "failed" && (
          <p className="mt-1 text-[var(--destructive)]">{labels.errors["generation-failed"]}</p>
        )}
        {actionFailed && !state.error && <p className="mt-1 text-[var(--destructive)]">{labels.actionFailed}</p>}
      </div>

      {isGame && game && !playersOpen && (
        <details className="shrink-0 border-b border-[var(--border)] px-3 text-xs">
          <summary className="cursor-pointer py-3 font-medium">
            {labels.gameStatus}
            {game.location && <> · {game.location}</>}
          </summary>
          <div className="max-h-[30dvh] space-y-3 overflow-y-auto pb-3">
            <p className="font-medium">
              {
                {
                  exploration: labels.gameExploration,
                  dialogue: labels.gameDialogue,
                  combat: labels.gameCombat,
                  travel_rest: labels.gameTravelRest,
                }[game.state]
              }
            </p>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
              {(
                [
                  [labels.gameLocation, game.location],
                  [labels.gameWeather, game.weather],
                  [labels.gameTime, game.time],
                ] as const
              ).map(
                ([label, value], index) =>
                  value && (
                    <div key={index} className="contents">
                      <dt className="text-[var(--muted-foreground)]">{label}</dt>
                      <dd className="break-words">{value}</dd>
                    </div>
                  ),
              )}
            </dl>
            {game.rolls.length > 0 && (
              <section aria-label={labels.gameRolls}>
                <h2 className="mb-1 font-semibold">{labels.gameRolls}</h2>
                <ul className="space-y-1">
                  {game.rolls.map((roll, index) => (
                    <li key={index} className="break-words">
                      {roll.label}: {roll.total}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {game.trackers.length > 0 && (
              <section aria-label={labels.gameTrackers} className="space-y-2">
                <h2 className="font-semibold">{labels.gameTrackers}</h2>
                {game.trackers.map((tracker, index) => (
                  <div key={`${tracker.ownerId}-${index}`} className="break-words">
                    <h3 className="font-medium">{tracker.name}</h3>
                    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[var(--muted-foreground)]">
                      {tracker.values.map((value, valueIndex) => (
                        <li key={valueIndex}>
                          {value.label}: {value.value}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            )}
            {game.choices.length > 0 && (
              <section aria-label={labels.gameChoices} className="space-y-2">
                <h2 className="font-semibold">{labels.gameChoices}</h2>
                {game.choices.map((choice, index) => (
                  <button
                    key={index}
                    type="button"
                    className={cn(BUTTON_CLASS, "w-full !justify-start whitespace-normal break-words text-left")}
                    aria-label={formatLabel(labels.gameAddChoice, { choice })}
                    disabled={
                      !canSend || pending || draft.length + choice.length + (draft ? 1 : 0) > MULTIPLAYER_LIMITS.text
                    }
                    onClick={() => setDraft((current) => (current ? `${current}\n${choice}` : choice))}
                  >
                    {choice}
                  </button>
                ))}
              </section>
            )}
          </div>
        </details>
      )}

      {playersOpen && snapshot ? (
        <section id={playersId} aria-label={labels.players} className="min-h-0 flex-1 overflow-y-auto p-3">
          <h2 className="mb-3 text-sm font-semibold">{labels.players}</h2>
          <ul className="divide-y divide-[var(--border)]">
            {snapshot.players.map((player) => (
              <li key={player.id} className="flex min-w-0 items-start gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)] text-sm font-semibold">
                  {player.displayName.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1 break-words">
                  <p className="text-sm font-medium">
                    {player.displayName}
                    {player.isHost && (
                      <span className="ml-2 text-xs text-[var(--muted-foreground)]">{labels.host}</span>
                    )}
                    {player.id === snapshot.selfId && <span className="ml-2 text-xs">{labels.you}</span>}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {player.personaName ? formatLabel(labels.playing, { name: player.personaName }) : labels.noPersona}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                    {player.connected ? labels.connected : labels.reconnecting}
                    {isGame && (
                      <>
                        <span aria-hidden="true">·</span>
                        {player.joinsNextRound ? labels.nextRound : player.ready ? labels.ready : labels.waiting}
                        {player.ready && <Check size={12} aria-hidden="true" />}
                      </>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <h2 className="mb-2 mt-5 text-sm font-semibold">{labels.aiManagedByHost}</h2>
          <ul className="space-y-2">
            {snapshot.characters.map((character) => (
              <li key={character.id} className="flex items-start gap-2 break-words text-sm">
                <Bot size={16} className="mt-0.5 shrink-0" />
                <span className="min-w-0 flex-1">{character.name}</span>
                <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                  {character.role === "gm" ? labels.gm : labels.ai}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-[var(--muted-foreground)]">{labels.textOnly}</p>
        </section>
      ) : (
        <section
          ref={transcriptRef}
          aria-label={labels.modes[snapshot?.mode ?? "conversation"]}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4"
          onScroll={(event) => {
            const transcript = event.currentTarget;
            followingLatestRef.current = transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight < 80;
          }}
        >
          {!snapshot?.messages.length && (
            <p className="mx-auto max-w-prose py-8 text-center text-sm text-[var(--muted-foreground)]">
              {snapshot ? labels.emptyMessages : phaseText}
            </p>
          )}
          <ol className="space-y-4">
            {snapshot?.messages.map((message) => {
              const isSelf = message.actorId === snapshot.selfId;
              const bubble = snapshot.mode === "conversation" && message.kind !== "event";
              return (
                <li key={message.id} className={cn("flex min-w-0", isSelf && bubble && "justify-end")}>
                  <article
                    className={cn(
                      "mari-message-body min-w-0 max-w-prose",
                      bubble
                        ? "max-w-[90%] rounded-2xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 sm:max-w-[80%]"
                        : "w-full py-1",
                      message.kind === "event" && "text-[var(--muted-foreground)]",
                    )}
                  >
                    <p className="mari-message-meta mb-1 break-words text-xs font-semibold">
                      {message.actorName}
                      {isSelf && <span className="ml-2 font-normal">{labels.you}</span>}
                    </p>
                    <p className="mari-message-content whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {message.kind === "event" && message.event ? (
                        <>
                          {eventLabels[message.event.type]}
                          {message.event.targetName && <> · {message.event.targetName}</>}
                        </>
                      ) : (
                        message.text
                      )}
                    </p>
                    {!!message.reactions?.length && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {message.reactions.map((reaction, index) => (
                          <span
                            key={index}
                            aria-label={formatLabel(labels.reactionBy, {
                              emoji: reaction.emoji,
                              names: reaction.by.join(", "),
                            })}
                            title={formatLabel(labels.reactionBy, {
                              emoji: reaction.emoji,
                              names: reaction.by.join(", "),
                            })}
                            className="inline-flex max-w-full items-center gap-1 break-words rounded-full border border-[var(--border)] px-2 py-1 text-xs"
                          >
                            <span className="min-w-0 break-words">{reaction.emoji}</span>
                            <span>{reaction.by.length}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {snapshot && (
        <div className="shrink-0 border-t border-[var(--border)] p-2 pb-[calc(0.5rem+var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom)))] sm:p-3">
          {isGame && round && (
            <div role="status" aria-live="polite" className="mb-2 space-y-1 text-xs">
              <p>
                {formatLabel(labels.roundStatus, {
                  round: round.number,
                  ready: round.submittedParticipantIds.length,
                  total: round.requiredParticipantIds.length,
                })}
              </p>
              <p className="text-[var(--muted-foreground)]">
                {round.phase === "resolving"
                  ? labels.resolving
                  : round.phase === "interrupted"
                    ? labels.interrupted
                    : ownPlayer?.joinsNextRound
                      ? labels.nextRound
                      : waitingPlayers?.length
                        ? formatLabel(labels.waitingFor, {
                            names: waitingPlayers.map((player) => player.displayName).join(", "),
                          })
                        : labels.ready}
              </p>
              {ownSubmission && !editing && (
                <div className="flex items-center gap-2">
                  <Check size={14} />
                  <span className="min-w-0 flex-1">
                    {ownSubmission.pass ? labels.passSubmitted : labels.actionSubmitted}
                  </span>
                  <button
                    type="button"
                    className={BUTTON_CLASS}
                    disabled={!canAct || round.phase !== "collecting" || pending}
                    onClick={() => {
                      setDraft(ownSubmission.pass ? "" : ownSubmission.text);
                      setEditingRoundId(round.id);
                    }}
                  >
                    {labels.editAction}
                  </button>
                </div>
              )}
            </div>
          )}
          <div className={getChatInputShellClass({ layout: snapshot.mode, hasContent: Boolean(draft) })}>
            <label htmlFor={composerId} className="sr-only">
              {isGame ? labels.actionPlaceholder : labels.messagePlaceholder}
            </label>
            <textarea
              id={composerId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={state.phase === "ended" || snapshot.status === "ended"}
              placeholder={isGame ? labels.actionPlaceholder : labels.messagePlaceholder}
              maxLength={MULTIPLAYER_LIMITS.text}
              rows={2}
              className="min-h-12 min-w-0 flex-1 resize-none bg-transparent py-1 text-base leading-relaxed outline-none placeholder:text-[var(--muted-foreground)] disabled:opacity-50 sm:text-sm"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSend || pending || !draft.trim()}
              className={BUTTON_CLASS}
            >
              <Send size={16} />
              <span className={isGame ? "max-w-24" : "sr-only sm:not-sr-only"}>
                {pending ? labels.sending : isGame ? (editing ? labels.saveAction : labels.submitAction) : labels.send}
              </span>
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {isGame && round ? (
              <button
                type="button"
                className={BUTTON_CLASS}
                disabled={!canSubmitRound || pending}
                onClick={() =>
                  void dispatch({
                    type: "pass",
                    operationId: generateClientId(),
                    sequence: snapshot.nextSequence,
                    roundId: round.id,
                    submissionRevision: ownSubmission ? ownSubmission.revision + 1 : 0,
                  }).then((accepted) => {
                    if (accepted) setEditingRoundId(null);
                  })
                }
              >
                {labels.pass}
              </button>
            ) : !isGame ? (
              <button
                type="button"
                className={BUTTON_CLASS}
                disabled={!canAct || pending || snapshot.generation === "running"}
                onClick={() =>
                  void dispatch({
                    type: "request-response",
                    operationId: generateClientId(),
                    sequence: snapshot.nextSequence,
                  })
                }
              >
                <Bot size={14} />
                {labels.requestResponse}
              </button>
            ) : null}
            <p className="min-w-0 flex-1 text-xs text-[var(--muted-foreground)]">{labels.textOnly}</p>
          </div>
          <details className="mt-2 text-xs text-[var(--muted-foreground)]">
            <summary className="cursor-pointer py-1">{labels.commands}</summary>
            <p className="mt-1 leading-relaxed">{labels.commandsHelp}</p>
          </details>
        </div>
      )}
    </main>
  );
}
