import { z } from "zod";

export const MULTIPLAYER_PROTOCOL_VERSION = 1 as const;
export const MULTIPLAYER_LIMITS = {
  messages: 100,
  actionBytes: 16_384,
  snapshotBytes: 262_144,
  text: 8_000,
  description: 4_000,
  pollMs: 20_000,
  inviteMs: 30 * 60_000,
  sessionMs: 12 * 60 * 60_000,
} as const;

const id = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/u);
const name = z.string().trim().min(1).max(80);
const text = z.string().max(MULTIPLAYER_LIMITS.text);
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const mode = z.enum(["conversation", "roleplay", "game"]);

/** Reviewed text only. Never accept card extensions, image URLs or library records. */
export const multiplayerPersonaSchema = z
  .object({ name, description: z.string().max(MULTIPLAYER_LIMITS.description) })
  .strict();

export const multiplayerCharacterProposalSchema = z
  .object({ name, description: z.string().max(MULTIPLAYER_LIMITS.description), role: z.enum(["character", "gm"]) })
  .strict();

export const multiplayerPlayerSchema = z
  .object({
    id,
    displayName: name,
    personaName: name.nullable(),
    isHost: z.boolean(),
    connected: z.boolean(),
    ready: z.boolean(),
    joinsNextRound: z.boolean(),
    personaChangeRejected: z.boolean().optional(),
  })
  .strict();

export const multiplayerMessageSchema = z
  .object({
    id,
    actorId: id.nullable(),
    actorName: name,
    kind: z.enum(["user", "assistant", "narrator", "event"]),
    text,
    createdAt: z.string().datetime(),
    event: z
      .object({ type: z.enum(["host-pass", "kick", "pause", "resume"]), targetName: name.optional() })
      .strict()
      .optional(),
    reactions: z
      .array(z.object({ emoji: z.string().min(1).max(64), by: z.array(name) }).strict())
      .max(12)
      .optional(),
  })
  .strict();

export const multiplayerRoundSchema = z
  .object({
    id,
    number: revision,
    phase: z.enum(["collecting", "resolving", "interrupted"]),
    requiredParticipantIds: z.array(id),
    submittedParticipantIds: z.array(id),
    ownSubmission: z.object({ revision, text, pass: z.boolean() }).strict().nullable(),
  })
  .strict();

/** Public Game presentation only; no cards, raw trackers, widgets, debug output or assets. */
export const multiplayerGameStateSchema = z
  .object({
    state: z.enum(["exploration", "dialogue", "combat", "travel_rest"]),
    location: z.string().max(200).nullable(),
    weather: z.string().max(200).nullable(),
    time: z.string().max(200).nullable(),
    choices: z.array(z.string().min(1).max(300)).max(8),
    rolls: z
      .array(
        z
          .object({ label: z.string().min(1).max(100), total: z.number().finite().min(-1_000_000).max(1_000_000) })
          .strict(),
      )
      .max(12),
    trackers: z.array(
      z
        .object({
          ownerId: id,
          name,
          values: z.array(z.object({ label: z.string().min(1).max(80), value: z.string().max(80) }).strict()).max(16),
        })
        .strict(),
    ),
    /** The viewer's own checks in the latest reply (Alyssa 2026-10-30: each player sees their roll). */
    ownRolls: z
      .array(
        z
          .object({
            skill: z.string().min(1).max(100),
            total: z.number().finite().min(-1_000_000).max(1_000_000),
            dc: z.number().finite().min(-1_000_000).max(1_000_000),
            success: z.boolean(),
          })
          .strict(),
      )
      .max(8)
      .default([]),
    /** What the viewer's own bag holds (Alyssa 2026-10-30: guests see their bag), by name only. */
    bag: z
      .array(
        z
          .object({
            name: z.string().min(1).max(120),
            quantity: z.number().int().min(1).max(1_000_000),
            equipped: z.boolean(),
          })
          .strict(),
      )
      .max(48)
      .default([]),
  })
  .strict();
export type MultiplayerGameState = z.infer<typeof multiplayerGameStateSchema>;

/** A name the fight gives one of its own things (a combatant, an option): never an object key. */
const fightKey = z
  .string()
  .min(1)
  .max(256)
  .refine((value) => !["__proto__", "constructor", "prototype"].includes(value));
const fightCell = z.object({ x: z.number().int().min(0).max(255), y: z.number().int().min(0).max(255) }).strict();
const fightLine = z.string().min(1).max(300);

/**
 * A shared room's fight as one player sees it (2026-10-27): only what the board shows, copied field by
 * field from the host's own view of the fight for that player. Their own party members' menu is in it
 * while one of them is to act; nobody else's is.
 */
export const multiplayerFightSchema = z
  .object({
    anchor: fightKey,
    id: fightKey,
    instanceId: fightKey,
    revision,
    round: z.number().int().min(0).max(100_000),
    over: z.boolean(),
    actorId: fightKey.nullable(),
    /** The player the fight waits on, when it is not the one viewing. */
    waitingOn: name.nullable(),
    combatants: z
      .array(
        z
          .object({
            id: fightKey,
            name,
            side: z.enum(["party", "enemy"]),
            health: z
              .object({
                value: z.number().finite().min(-1_000_000).max(1_000_000),
                max: z.number().finite().min(0).max(1_000_000),
              })
              .strict(),
            down: z.boolean(),
            defeated: z.boolean(),
            conditions: z.array(z.string().min(1).max(80)).max(8),
            /** The room player who plays this party member, by display name. */
            player: name.nullable(),
            mine: z.boolean(),
            controller: z.enum(["manual", "ai"]).nullable(),
            x: z.number().int().min(0).max(255).optional(),
            y: z.number().int().min(0).max(255).optional(),
          })
          .strict(),
      )
      .max(60),
    grid: z
      .object({
        width: z.number().int().min(1).max(64),
        height: z.number().int().min(1).max(64),
        tiles: z.array(z.array(z.string().max(24)).max(64)).max(64),
      })
      .strict()
      .nullable(),
    /** What one of the viewer's own party members may do now: their turn, or a moment that asks them. */
    options: z
      .array(
        z
          .object({
            id: fightKey,
            label: z.string().min(1).max(120),
            /** none: done as chosen; targets: pick up to `count` of `targetIds`; cell: a place from `cells`. */
            pick: z.enum(["none", "targets", "cell"]),
            count: z.number().int().min(0).max(20),
            targetIds: z.array(fightKey).max(60),
            cells: z.array(fightCell).max(400),
            /** A cell from `cells` is where it walks to (`to`), else where it is aimed (`at`). */
            moves: z.boolean(),
          })
          .strict(),
      )
      .max(60),
    /** What the moment asks, while one of the viewer's party members is asked to answer it. */
    prompt: z.string().max(300).nullable(),
    deploy: z
      .object({ unitIds: z.array(fightKey).max(20), cells: z.array(fightCell).max(400) })
      .strict()
      .nullable(),
    log: z.array(fightLine).max(16),
  })
  .strict();
export type MultiplayerFight = z.infer<typeof multiplayerFightSchema>;

/** What a guest may ask of their own party members in a fight. The host's fight checks every part of it. */
export const multiplayerFightCommandSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("ruleset"),
      optionId: fightKey,
      targetIds: z.array(fightKey).max(20),
      to: fightCell.optional(),
      at: fightCell.optional(),
    })
    .strict(),
  z.object({ type: z.literal("deploy"), unitId: fightKey, to: fightCell }).strict(),
  z.object({ type: z.literal("control"), unitId: fightKey, controller: z.enum(["manual", "ai"]) }).strict(),
]);
export type MultiplayerFightCommand = z.infer<typeof multiplayerFightCommandSchema>;

export const multiplayerSnapshotSchema = z
  .object({
    version: z.literal(MULTIPLAYER_PROTOCOL_VERSION),
    roomId: id,
    revision,
    name,
    mode,
    selfId: id,
    nextSequence: revision,
    status: z.enum(["lobby", "active", "paused", "ended"]),
    generation: z.enum(["idle", "running", "failed"]),
    usage: z
      .object({
        generations: revision,
        maxGenerations: z.number().int().min(1).max(1000),
        automaticReplies: z.boolean(),
      })
      .strict(),
    players: z.array(multiplayerPlayerSchema),
    characters: z.array(z.object({ id, name, role: z.enum(["character", "gm"]) }).strict()),
    messages: z.array(multiplayerMessageSchema).max(MULTIPLAYER_LIMITS.messages),
    round: multiplayerRoundSchema.nullable(),
    game: multiplayerGameStateSchema.nullable().optional(),
    fight: multiplayerFightSchema.nullable().optional(),
  })
  .strict();

const operation = { operationId: id, sequence: revision };
export const multiplayerActionSchema = z.discriminatedUnion("type", [
  z.object({ ...operation, type: z.literal("message"), text: text.trim().min(1) }).strict(),
  z
    .object({
      ...operation,
      type: z.literal("submit-action"),
      roundId: id,
      submissionRevision: revision,
      text: text.trim().min(1),
    })
    .strict(),
  z.object({ ...operation, type: z.literal("pass"), roundId: id, submissionRevision: revision }).strict(),
  z.object({ ...operation, type: z.literal("request-response") }).strict(),
  z.object({ ...operation, type: z.literal("set-persona"), persona: multiplayerPersonaSchema }).strict(),
  z
    .object({ ...operation, type: z.literal("propose-character"), character: multiplayerCharacterProposalSchema })
    .strict(),
  z.object({ ...operation, type: z.literal("leave") }).strict(),
  z
    .object({
      ...operation,
      type: z.literal("fight-command"),
      fight: z.object({ anchor: fightKey, id: fightKey, instanceId: fightKey, revision }).strict(),
      command: multiplayerFightCommandSchema,
    })
    .strict(),
]);

export const multiplayerErrorCodeSchema = z.enum([
  "disabled",
  "unavailable",
  "invalid-invite",
  "expired-invite",
  "identity-changed",
  "identity-conflict",
  "incompatible-version",
  "wrong-password",
  "room-full",
  "snapshot-too-large",
  "rate-limited",
  "awaiting-approval",
  "declined",
  "revoked",
  "room-ended",
  "disconnected",
  "invalid-message",
  "stale-action",
  "busy",
  "restricted-command",
  "generation-failed",
]);

export const multiplayerGuestStateSchema = z
  .object({
    phase: z.enum(["awaiting-approval", "connected", "reconnecting", "ended"]),
    snapshot: multiplayerSnapshotSchema.nullable(),
    error: multiplayerErrorCodeSchema.nullable(),
  })
  .strict();

export const multiplayerInviteSchema = z
  .object({
    version: z.literal(MULTIPLAYER_PROTOCOL_VERSION),
    origin: z
      .string()
      .max(256)
      .url()
      .refine((value) => {
        try {
          const url = new URL(value);
          return (
            url.protocol === "https:" &&
            !url.username &&
            !url.password &&
            url.pathname === "/" &&
            !url.search &&
            !url.hash
          );
        } catch {
          return false;
        }
      }),
    roomId: id,
    invite: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    expiresAt: z.string().datetime(),
  })
  .strict();

/** Bound bytes before JSON.parse and validate the result with its exact schema. */
export function parseMultiplayerJson<T>(input: string, schema: z.ZodType<T>, maximumBytes: number): T {
  if (input.length > maximumBytes || new TextEncoder().encode(input).byteLength > maximumBytes) {
    throw new Error("Multiplayer message exceeds the size limit");
  }
  return schema.parse(JSON.parse(input));
}

export type MultiplayerPersona = z.infer<typeof multiplayerPersonaSchema>;
export type MultiplayerPlayer = z.infer<typeof multiplayerPlayerSchema>;
export type MultiplayerMessage = z.infer<typeof multiplayerMessageSchema>;
export type MultiplayerSnapshot = z.infer<typeof multiplayerSnapshotSchema>;
export type MultiplayerAction = z.infer<typeof multiplayerActionSchema>;
export type MultiplayerGuestState = z.infer<typeof multiplayerGuestStateSchema>;
export type MultiplayerErrorCode = z.infer<typeof multiplayerErrorCodeSchema>;
export type MultiplayerInvite = z.infer<typeof multiplayerInviteSchema>;

const peerBase = { version: z.literal(MULTIPLAYER_PROTOCOL_VERSION), roomId: id };
const secret = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);
export const multiplayerPeerRequestSchema = z.discriminatedUnion("type", [
  z.object({ ...peerBase, type: z.literal("preview"), invite: secret }).strict(),
  z
    .object({
      ...peerBase,
      type: z.literal("join"),
      invite: secret,
      password: z.string().min(12).max(128),
      displayName: name,
      persona: multiplayerPersonaSchema,
    })
    .strict(),
  z.object({ ...peerBase, type: z.literal("poll"), revision }).strict(),
  z.object({ ...peerBase, type: z.literal("action"), action: multiplayerActionSchema }).strict(),
]);

export const multiplayerPeerResponseSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...peerBase,
      type: z.literal("preview"),
      name,
      mode,
      expiresAt: z.string().datetime(),
    })
    .strict(),
  z
    .object({
      version: z.literal(MULTIPLAYER_PROTOCOL_VERSION),
      type: z.literal("admission"),
      session: secret,
    })
    .strict(),
  z
    .object({
      version: z.literal(MULTIPLAYER_PROTOCOL_VERSION),
      type: z.literal("state"),
      state: multiplayerGuestStateSchema,
    })
    .strict(),
  z
    .object({
      version: z.literal(MULTIPLAYER_PROTOCOL_VERSION),
      type: z.literal("accepted"),
      operationId: id,
      state: multiplayerGuestStateSchema,
    })
    .strict(),
  z
    .object({
      version: z.literal(MULTIPLAYER_PROTOCOL_VERSION),
      type: z.literal("error"),
      code: multiplayerErrorCodeSchema,
      state: multiplayerGuestStateSchema.optional(),
    })
    .strict(),
]);

export type MultiplayerPeerRequest = z.infer<typeof multiplayerPeerRequestSchema>;
export type MultiplayerPeerResponse = z.infer<typeof multiplayerPeerResponseSchema>;
