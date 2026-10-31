import type {
  MultiplayerAction,
  MultiplayerErrorCode,
  MultiplayerPersona,
  MultiplayerStoredParticipant,
  MultiplayerStoredRoom,
  MultiplayerStoredRound,
} from "@marinara-engine/shared";
import { normalizeCharacterLookupName } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { createChatsStorage, withChatMetadataPatchQueue } from "../storage/chats.storage.js";
import { newId, now } from "../../utils/id-generator.js";
import { record } from "./room-projection.js";
import { roomPlayerCommand } from "./player-commands.js";
import {
  applyRoomPersonaChanges,
  ensureRoomHumanGameCards,
  validateNewRoomHumanGameName,
  validateRoomPersonaChange,
  RoomPersonaConflictError,
} from "./game-persona.js";

export class MultiplayerError extends Error {
  constructor(readonly code: MultiplayerErrorCode) {
    super(code);
  }
}
export type RoomClaim = { roomId: string; epoch: string; operationId: string; roundId: string | null };

export function nextRound(room: MultiplayerStoredRoom): MultiplayerStoredRound {
  for (const participant of room.participants) {
    participant.joinsNextRound = false;
    if (participant.pendingPersona) {
      participant.persona = participant.pendingPersona;
      delete participant.pendingPersona;
    }
  }
  return {
    id: newId(),
    number: (room.round?.number ?? 0) + 1,
    phase: "collecting",
    requiredParticipantIds: room.participants.map((p) => p.id),
    submissions: {},
    resolutionId: null,
  };
}

/** Invisible characters (zero-width space, soft hyphen) are dropped, so a name cannot pass for another one. */
export function roomNameKey(name: string) {
  return normalizeCharacterLookupName(name.replace(/\p{Default_Ignorable_Code_Point}/gu, ""));
}

export function assertRoomPersonaName(room: MultiplayerStoredRoom, name: string, participantId?: string) {
  const normalized = roomNameKey(name);
  if (
    !normalized ||
    room.participants.some(
      (p) =>
        p.id !== participantId &&
        [p.persona.name, p.pendingPersona?.name].some((n) => n && roomNameKey(n) === normalized),
    ) ||
    room.characters.some((c) => roomNameKey(c.name) === normalized)
  )
    throw new MultiplayerError("identity-conflict");
}

/** Uses the existing per-chat queue, then the existing transaction: state and attributed messages commit together. */
export function createMultiplayerRoomStore(db: DB, chatId: string, roomId: string, epoch: string) {
  async function advanceRound(room: MultiplayerStoredRoom, transaction: DB) {
    const changes = room.participants
      .filter((p) => p.pendingPersona)
      .map((p) => ({
        participantId: p.id,
        previousName: p.persona.name,
        name: p.pendingPersona!.name,
      }));
    const { rejectedParticipantIds } = await applyRoomPersonaChanges(transaction, chatId, changes);
    for (const participant of room.participants) {
      if (rejectedParticipantIds.includes(participant.id)) {
        delete participant.pendingPersona;
        participant.personaChangeRejected = true;
      }
    }
    room.round = nextRound(room);
    await ensureRoomHumanGameCards(transaction, chatId, room);
  }
  async function change<T>(
    operation: (
      room: MultiplayerStoredRoom,
      chats: ReturnType<typeof createChatsStorage>,
      chat: NonNullable<Awaited<ReturnType<ReturnType<typeof createChatsStorage>["getById"]>>>,
      transaction: DB,
    ) => Promise<T> | T,
  ): Promise<T> {
    return withChatMetadataPatchQueue(chatId, () =>
      db.transaction(async (tx) => {
        const chats = createChatsStorage(tx);
        const chat = await chats.getById(chatId);
        const room = record(record(chat?.metadata).multiplayer) as unknown as MultiplayerStoredRoom;
        if (
          !chat ||
          room.version !== 1 ||
          room.role !== "host" ||
          room.roomId !== roomId ||
          room.epoch !== epoch ||
          room.status === "ended"
        )
          throw new MultiplayerError("room-ended");
        const result = await operation(room, chats, chat, tx);
        room.revision++;
        await chats.patchMetadata(chatId, { multiplayer: room }, { metadataQueueHeld: true });
        return result;
      }),
    );
  }
  async function read() {
    const chats = createChatsStorage(db);
    const chat = await chats.getById(chatId);
    const room = record(record(chat?.metadata).multiplayer) as unknown as MultiplayerStoredRoom;
    if (!chat || room.version !== 1 || room.role !== "host" || room.roomId !== roomId || room.epoch !== epoch)
      throw new MultiplayerError("room-ended");
    return { chat, room, metadata: record(chat.metadata) };
  }
  function claim(room: MultiplayerStoredRoom): RoomClaim | null {
    if (
      room.status !== "active" ||
      room.generation === "running" ||
      room.generations >= room.maxGenerations ||
      (!room.round && !room.characters.length)
    )
      return null;
    const operationId = newId();
    room.generation = "running";
    room.generationOperationId = operationId;
    room.generations++;
    room.pendingResponse = false;
    if (room.round) {
      room.round.phase = "resolving";
      room.round.resolutionId = operationId;
    }
    return { roomId, epoch, operationId, roundId: room.round?.id ?? null };
  }
  async function appendUser(
    chats: ReturnType<typeof createChatsStorage>,
    participant: MultiplayerStoredParticipant,
    text: string,
    operationId: string,
  ) {
    const message = await chats.createMessage({
      chatId,
      role: "user",
      characterId: null,
      content: text,
      extra: {
        personaSnapshot: { personaId: participant.id, source: "persona", name: participant.persona.name },
        multiplayer: { participantId: participant.id, operationId },
      },
    });
    return message!.id;
  }
  async function appendEvent(
    chats: ReturnType<typeof createChatsStorage>,
    type: "host-pass" | "kick" | "pause" | "resume",
    targetName?: string,
  ) {
    const content =
      type === "host-pass"
        ? `The host recorded a pass for ${targetName}.`
        : type === "kick"
          ? `The host removed ${targetName} from the session.`
          : type === "pause"
            ? "The host paused the session."
            : "The host resumed the session.";
    await chats.createMessage({
      chatId,
      role: "narrator",
      characterId: null,
      content,
      extra: { multiplayerEvent: { type, ...(targetName ? { targetName } : {}) } },
    });
  }
  async function closeRound(
    room: MultiplayerStoredRoom,
    chats: ReturnType<typeof createChatsStorage>,
    /** A round a fight's result closed: everyone played in the fight, so nobody "passes" in the story. */
    quietPasses = false,
  ): Promise<RoomClaim | null> {
    const round = room.round;
    if (!round || round.phase !== "collecting" || !round.requiredParticipantIds.every((id) => round.submissions[id]))
      return null;
    const claimed = claim(room);
    if (!claimed) return null;
    for (const id of round.requiredParticipantIds) {
      const participant = room.participants.find((p) => p.id === id);
      const submission = round.submissions[id]!;
      if (participant && !(quietPasses && submission.pass))
        await appendUser(
          chats,
          participant,
          submission.pass ? `[Passes this round]` : submission.text,
          submission.operationId,
        );
    }
    return claimed;
  }
  return {
    read,
    change,
    async admit(participant: MultiplayerStoredParticipant) {
      return change(async (room, _chats, chat, transaction) => {
        assertRoomPersonaName(room, participant.persona.name);
        try {
          await validateNewRoomHumanGameName(transaction, chatId, participant.persona.name);
        } catch (error) {
          if (error instanceof RoomPersonaConflictError) throw new MultiplayerError("identity-conflict");
          throw error;
        }
        participant.joinsNextRound = chat.mode === "game" && (!!room.round || room.generation === "running");
        room.participants.push(participant);
        await ensureRoomHumanGameCards(transaction, chatId, room, true);
      });
    },
    async action(participantId: string, action: MultiplayerAction, signal?: AbortSignal, isActive?: () => boolean) {
      return change(async (room, chats, chat, transaction) => {
        const requireActive = () => {
          if (signal?.aborted || (isActive && !isActive())) throw new MultiplayerError("disconnected");
        };
        requireActive();
        const participant = room.participants.find((p) => p.id === participantId);
        if (!participant) throw new MultiplayerError("revoked");
        const receipt = room.receipts.find(
          (r) => r.operationId === action.operationId && r.participantId === participantId,
        );
        if (receipt) {
          if (receipt.sequence !== action.sequence) throw new MultiplayerError("stale-action");
          return { claim: null, duplicate: true };
        }
        if (action.sequence !== participant.lastSequence + 1) throw new MultiplayerError("stale-action");
        const messageIds: string[] = [];
        let claimed: RoomClaim | null = null;
        if (action.type === "message") {
          if (chat.mode === "game" || room.status !== "active" || room.generation === "running")
            throw new MultiplayerError("busy");
          const command = roomPlayerCommand(action.text);
          if (command.text) messageIds.push(await appendUser(chats, participant, command.text, action.operationId));
          if (command.response === "request" || (room.automaticReplies && command.response === "automatic")) {
            room.pendingResponse = true;
            claimed = claim(room);
            if (!claimed && command.response === "request") throw new MultiplayerError("busy");
          }
        } else if (action.type === "submit-action" || action.type === "pass") {
          const round = room.round;
          if (
            room.status !== "active" ||
            !round ||
            round.phase !== "collecting" ||
            round.id !== action.roundId ||
            !round.requiredParticipantIds.includes(participantId)
          )
            throw new MultiplayerError("stale-action");
          const previous = round.submissions[participantId];
          if (action.submissionRevision !== (previous ? previous.revision + 1 : 0))
            throw new MultiplayerError("stale-action");
          const command = action.type === "submit-action" ? roomPlayerCommand(action.text) : null;
          if (command?.response === "request") throw new MultiplayerError("restricted-command");
          round.submissions[participantId] = {
            operationId: action.operationId,
            revision: action.submissionRevision,
            text: command?.text ?? "",
            pass: action.type === "pass",
          };
          claimed = await closeRound(room, chats);
        } else if (action.type === "fight-command") {
          // The fight itself checks the command once its receipt is kept (2026-10-27); a room that is not
          // playing a Game has no fight to send it to.
          if (chat.mode !== "game" || room.status !== "active") throw new MultiplayerError("busy");
        } else if (action.type === "request-response") {
          if (chat.mode === "game") throw new MultiplayerError("restricted-command");
          claimed = claim(room);
          if (!claimed) throw new MultiplayerError("busy");
        } else if (action.type === "set-persona") {
          assertRoomPersonaName(room, action.persona.name, participantId);
          try {
            await validateRoomPersonaChange(transaction, chatId, {
              participantId,
              previousName: participant.persona.name,
              name: action.persona.name,
            });
          } catch (error) {
            if (error instanceof RoomPersonaConflictError) throw new MultiplayerError("identity-conflict");
            throw error;
          }
          delete participant.personaChangeRejected;
          if (room.round || (chat.mode === "game" && room.generation === "running"))
            participant.pendingPersona = action.persona;
          else participant.persona = action.persona;
        }
        // Proposals and Leave have in-memory session effects after this durable receipt commits.
        requireActive();
        participant.lastSequence = action.sequence;
        room.receipts.push({ operationId: action.operationId, sequence: action.sequence, participantId, messageIds });
        room.receipts = room.receipts.slice(-128);
        room.lastActivityAt = now();
        return { claim: claimed, duplicate: false };
      });
    },
    async hostPass(participantId: string) {
      return change(async (room, chats) => {
        const round = room.round;
        if (
          room.status !== "active" ||
          !round ||
          round.phase !== "collecting" ||
          !round.requiredParticipantIds.includes(participantId)
        )
          throw new MultiplayerError("stale-action");
        if (round.submissions[participantId]?.pass) return null;
        round.submissions[participantId] = {
          operationId: newId(),
          revision: (round.submissions[participantId]?.revision ?? -1) + 1,
          text: "",
          pass: true,
        };
        await appendEvent(chats, "host-pass", room.participants.find((p) => p.id === participantId)!.persona.name);
        return closeRound(room, chats);
      });
    },
    /** The room's fight is over (2026-10-27): its result is the host's turn, and the round closes on it,
     *  everybody yet to act passing, so the Game Master tells what came of it at once. */
    async fightResult(text: string) {
      return change(async (room, chats, chat) => {
        const round = room.round;
        const host = room.participants.find((p) => p.isHost)!;
        if (chat.mode !== "game" || room.status !== "active" || !round || round.phase !== "collecting")
          throw new MultiplayerError("busy");
        const previous = round.submissions[host.id];
        round.submissions[host.id] = {
          operationId: newId(),
          revision: previous ? previous.revision + 1 : 0,
          text,
          pass: false,
        };
        if (!round.requiredParticipantIds.includes(host.id)) round.requiredParticipantIds.push(host.id);
        for (const id of round.requiredParticipantIds)
          round.submissions[id] ??= { operationId: newId(), revision: 0, text: "", pass: true };
        // The guests played their part in the fight itself (laptop room playtest 2026-10-30).
        return closeRound(room, chats, true);
      });
    },
    async kick(participantId: string) {
      return change(async (room, chats) => {
        const participant = room.participants.find((p) => p.id === participantId);
        if (!participant) return null;
        if (participant.isHost) throw new MultiplayerError("invalid-message");
        room.participants = room.participants.filter((p) => p.id !== participantId);
        // A resolving turn keeps its locked actions; revocation takes effect now and
        // the next collection uses the remaining roster. Never wait on a provider to revoke access.
        if (room.round?.phase === "collecting") {
          room.round.requiredParticipantIds = room.round.requiredParticipantIds.filter((id) => id !== participantId);
          delete room.round.submissions[participantId];
        }
        await appendEvent(chats, "kick", participant.persona.name);
        return closeRound(room, chats);
      });
    },
    async beginGeneration() {
      return change((room) => {
        if (room.round) return null;
        return claim(room);
      });
    },
    async finishGeneration(completed: RoomClaim, success: boolean) {
      return change(async (room, _chats, chat, transaction) => {
        if (room.generationOperationId !== completed.operationId) return null;
        room.generationOperationId = null;
        success = success && room.status === "active";
        room.generation = success ? "idle" : "failed";
        if (success && chat.mode === "game" && !room.round) await advanceRound(room, transaction);
        else if (room.round?.id === completed.roundId) {
          if (success) await advanceRound(room, transaction);
          else {
            room.round.phase = "interrupted";
            room.status = "paused";
          }
        }
        if (!success) {
          room.pendingResponse = false;
          if (chat.mode === "game") {
            if (room.round) {
              room.round.phase = "interrupted";
              room.status = "paused";
            } else room.status = "lobby"; // Explicit Start may inspect/recover setup; never retry it on a timer.
          }
        }
        // A failure is never automatically retried. The host must inspect the committed state first.
        return success && room.pendingResponse && !room.round ? claim(room) : null;
      });
    },
    async pause() {
      return change(async (room, chats) => {
        if (room.status === "paused") return;
        if (room.status !== "active") throw new MultiplayerError("busy");
        room.status = "paused";
        room.pendingResponse = false;
        if (room.round?.phase === "resolving") room.round.phase = "interrupted";
        await appendEvent(chats, "pause");
      });
    },
    async resume() {
      return change(async (room, chats, _chat, transaction) => {
        if (room.status !== "paused") throw new MultiplayerError("busy");
        if (room.generation === "running") throw new MultiplayerError("busy");
        room.status = "active";
        // Explicit resume acknowledges ambiguous partial effects; move forward without replaying actions.
        if (room.round?.phase === "interrupted") await advanceRound(room, transaction);
        room.generation = "idle";
        await appendEvent(chats, "resume");
        return closeRound(room, chats);
      });
    },
    /** The interrupted round again, its actions as they were (laptop 2026-10-30: a 503 mid-round lost
     *  both players' actions to Resume). Only while the Game Master wrote nothing of it, so nothing it
     *  did is done twice: its actions, or a pause notice after them, are still the newest messages. */
    async retry() {
      return change(async (room, chats) => {
        if (room.status !== "paused" || room.round?.phase !== "interrupted" || room.generation === "running")
          throw new MultiplayerError("busy");
        const newest = (await chats.listMessagesPaginated(chatId, 8))
          .filter((message) => !(message.role === "narrator" && message.content === "The host paused the session."))
          .at(-1);
        if (newest?.role !== "user") throw new MultiplayerError("busy");
        room.status = "active";
        room.generation = "idle";
        return claim(room);
      });
    },
    async stop() {
      return change((room) => {
        room.status = "ended";
        room.pendingResponse = false;
        room.generationOperationId = null;
        if (room.generation === "running") room.generation = "failed";
        if (room.round?.phase === "resolving") room.round.phase = "interrupted";
      });
    },
  };
}

export function createRoomParticipant(
  displayName: string,
  persona: MultiplayerPersona,
  isHost = false,
): MultiplayerStoredParticipant {
  return { id: newId(), displayName, persona, isHost, joinsNextRound: false, lastSequence: -1 };
}
