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
  })
  .strict();
export type MultiplayerGameState = z.infer<typeof multiplayerGameStateSchema>;

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
