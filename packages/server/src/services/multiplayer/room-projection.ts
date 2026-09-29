import { gameNarrationForParticipant } from "./game-projection.js";
import {
  getRoleplayWhispers,
  MULTIPLAYER_LIMITS,
  multiplayerSnapshotSchema,
  multiplayerMessageSchema,
  stripGmTagsKeepReadables,
  type MultiplayerMessage,
  type MultiplayerSnapshot,
  type MultiplayerStoredRoom,
} from "@marinara-engine/shared";
import { RoleplayCommandStreamFilter } from "../generation/roleplay-commands.js";

export function record(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return record(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Model prose can contain private Game dialogue even when its renderer is inert. */
export function roomVisibleText(
  content: string,
  mode: string,
  room: MultiplayerStoredRoom,
  selfId: string,
  audienceSnapshot?: unknown,
): string {
  let text = content.slice(0, 64_000);
  // Provider reasoning delimiters never become shared narration, including truncated blocks.
  text = text.replace(/<(think|thinking|analysis|reasoning)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/giu, "");
  if (mode === "game") {
    text = gameNarrationForParticipant(text, room, selfId, audienceSnapshot);
    text = stripGmTagsKeepReadables(text);
    // The ordinary presentation keeps malformed tags visible for debugging; peers do not receive them.
    text = text.replace(/\[\w+:[^\]]*$/u, "");
  }
  const commands = new RoleplayCommandStreamFilter();
  return (commands.push(text) + commands.flush()).trim().slice(0, MULTIPLAYER_LIMITS.text);
}

type MessageRow = {
  id: string;
  role: string;
  characterId: string | null;
  content: string;
  extra: unknown;
  createdAt: string;
};

export class MultiplayerSnapshotTooLargeError extends Error {
  constructor() {
    super("The room update exceeds the safe transfer size.");
  }
}

/** The only shared transcript projection. No metadata, debug fields, assets or provider events cross this boundary. */
export function projectRoomSnapshot(input: {
  room: MultiplayerStoredRoom;
  chat: { name: string; mode: string };
  selfId: string;
  connected: ReadonlySet<string>;
  messages: readonly MessageRow[];
  game?: import("@marinara-engine/shared").MultiplayerGameState | null;
  /** Trusted local management must remain available to reduce an oversized shared update. */
  forLocalHost?: boolean;
}): MultiplayerSnapshot {
  const { room, chat, selfId, connected } = input;
  const self = room.participants.find((p) => p.id === selfId);
  if (!self) throw new Error("Participant is not admitted");
  const messages: MultiplayerMessage[] = [];
  for (const row of input.messages.slice(-MULTIPLAYER_LIMITS.messages)) {
    const extra = record(row.extra);
    if (row.role === "system" || extra.hiddenFromUser === true || extra.commandOnly === true) continue;
    const attribution = record(extra.multiplayer);
    const rawEvent = record(extra.multiplayerEvent);
    const event = multiplayerMessageSchema.shape.event.safeParse(rawEvent);
    const persona = record(extra.personaSnapshot);
    const character = room.characters.find((c) => c.id === row.characterId);
    const storedActor = record(extra.multiplayerActor);
    const actor =
      (storedActor.id === null ||
        (typeof storedActor.id === "string" && /^[A-Za-z0-9_-]{8,64}$/u.test(storedActor.id))) &&
      typeof storedActor.name === "string" &&
      storedActor.name.trim() &&
      storedActor.name.length <= 80 &&
      (storedActor.role === "character" || storedActor.role === "gm")
        ? (storedActor as { id: string | null; name: string; role: "character" | "gm" })
        : character;
    const actorId =
      row.role === "user" && typeof attribution.participantId === "string"
        ? attribution.participantId
        : (actor?.id ?? null);
    // Reject unattributed user messages: ordinary/private history is never made public by a room flag.
    if (row.role === "user" && !actorId) continue;
    const name = row.role === "user" && typeof persona.name === "string" ? persona.name : (actor?.name ?? "GM");
    let text =
      row.role === "user"
        ? row.content.slice(0, MULTIPLAYER_LIMITS.text)
        : roomVisibleText(row.content, chat.mode, room, selfId, extra.multiplayerGameAudience);
    if (row.role !== "user") {
      const whispers = getRoleplayWhispers(extra).filter(
        ({ recipient }) => recipient.kind === "persona" && recipient.id === selfId,
      );
      for (const { command } of whispers) text += `\n\n${command.text}`;
    }
    if (!text.trim()) continue;
    const reactions = (Array.isArray(extra.reactions) ? extra.reactions : []).slice(0, 12).flatMap((value) => {
      const reaction = record(value);
      if (typeof reaction.emoji !== "string" || !reaction.emoji || reaction.emoji.length > 64) return [];
      const by = Array.isArray(reaction.by)
        ? [...new Set(reaction.by)].flatMap((id) => {
            const actor = room.characters.find((character) => character.id === id);
            return actor ? [actor.name] : [];
          })
        : [];
      return by.length ? [{ emoji: reaction.emoji, by }] : [];
    });
    messages.push({
      id: row.id,
      actorId,
      actorName: name.slice(0, 80) || "GM",
      kind: event.success
        ? "event"
        : row.role === "user"
          ? "user"
          : row.role === "narrator" || actor?.role === "gm"
            ? "narrator"
            : "assistant",
      text: text.slice(0, MULTIPLAYER_LIMITS.text),
      createdAt: row.createdAt,
      ...(event.success ? { event: event.data } : {}),
      ...(reactions.length ? { reactions } : {}),
    });
  }
  const round = room.round;
  const snapshot = multiplayerSnapshotSchema.parse({
    version: 1,
    roomId: room.roomId,
    revision: room.revision,
    name: chat.name.slice(0, 80) || "Room",
    mode: chat.mode,
    selfId,
    nextSequence: self.lastSequence + 1,
    status: room.status,
    generation: room.generation,
    usage: {
      generations: room.generations,
      maxGenerations: room.maxGenerations,
      automaticReplies: room.automaticReplies,
    },
    players: room.participants.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      personaName: p.persona.name,
      isHost: p.isHost,
      connected: connected.has(p.id),
      ready: !!round?.submissions[p.id],
      joinsNextRound: p.joinsNextRound,
      ...(p.personaChangeRejected ? { personaChangeRejected: true } : {}),
    })),
    characters: room.characters,
    messages,
    game: input.game ?? null,
    round: round
      ? {
          id: round.id,
          number: round.number,
          phase: round.phase,
          requiredParticipantIds: round.requiredParticipantIds,
          submittedParticipantIds: Object.keys(round.submissions),
          ownSubmission: round.submissions[selfId]
            ? {
                revision: round.submissions[selfId]!.revision,
                text: round.submissions[selfId]!.text,
                pass: round.submissions[selfId]!.pass,
              }
            : null,
        }
      : null,
  });
  // Retain the most recent complete messages; never truncate serialized JSON or remove its ownership fields.
  while (
    Buffer.byteLength(JSON.stringify(snapshot)) > MULTIPLAYER_LIMITS.snapshotBytes - 512 &&
    snapshot.messages.length
  )
    snapshot.messages.shift();
  if (!input.forLocalHost && Buffer.byteLength(JSON.stringify(snapshot)) > MULTIPLAYER_LIMITS.snapshotBytes - 512)
    throw new MultiplayerSnapshotTooLargeError();
  return snapshot;
}
