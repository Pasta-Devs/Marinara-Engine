import { randomBytes, createHash, scrypt, timingSafeEqual, X509Certificate } from "node:crypto";
import { promisify } from "node:util";
import {
  characterDataSchema,
  createChatSchema,
  multiplayerInviteSchema,
  normalizeCharacterLookupName,
  parseMultiplayerJson,
  MULTIPLAYER_LIMITS,
  type MultiplayerAction,
  type MultiplayerGuestSession,
  type MultiplayerGuestState,
  type MultiplayerHostAction,
  type MultiplayerHostState,
  type MultiplayerInvite,
  type MultiplayerPeerRequest,
  type MultiplayerPeerResponse,
  type MultiplayerPersona,
  type MultiplayerStoredRoom,
  type MultiplayerStatus,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import type { GenerationRunner } from "../../routes/generate.routes.js";
import { createGenerationEventSink } from "../../routes/generate/sse.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { newId, now } from "../../utils/id-generator.js";
import { logger } from "../../lib/logger.js";
import {
  createMultiplayerRoomStore,
  createRoomParticipant,
  MultiplayerError,
  assertRoomPersonaName,
  type RoomClaim,
} from "./room-store.js";
import { record, projectRoomSnapshot } from "./room-projection.js";
import { requestMultiplayerPeer } from "./peer-client.js";
import { startMultiplayerPeerServer } from "./peer-server.js";
import { createGameStateStorage } from "../storage/game-state.storage.js";
import { projectMultiplayerGame } from "./game-projection.js";
import { filterRoomGamePartyCharacterIds } from "./generation-policy.js";

const deriveKey = promisify(scrypt);
const secret = () => randomBytes(32).toString("base64url");
const hash = (value: string) => createHash("sha256").update(value).digest();
const matches = (value: string, expected: Buffer) => timingSafeEqual(hash(value), expected);
type Guest = {
  invitation: MultiplayerInvite;
  token: string;
  localChatId: string;
  state: MultiplayerGuestState;
  abort: AbortController;
  poll: Promise<void> | null;
  expiresAt: number;
  admittedSelfId: string | null;
  lastRevision: number;
};
type Session = {
  id: string;
  participant: ReturnType<typeof createRoomParticipant>;
  status: "pending" | "approved" | "declined" | "revoked";
  expiresAt: number;
  lastSeen: number;
  polling: boolean;
  actions: number[];
};
type Host = {
  chatId: string;
  lastHostSeen: number;
  store: ReturnType<typeof createMultiplayerRoomStore>;
  origin: string;
  fingerprint: string;
  passwordSalt: Buffer;
  passwordHash: Buffer;
  invite: MultiplayerInvite | null;
  inviteHash: Buffer | null;
  sessions: Map<string, Session>;
  proposals: MultiplayerHostState["proposals"];
  abort: AbortController;
  listener: Awaited<ReturnType<typeof startMultiplayerPeerServer>> | null;
  waiters: Set<() => void>;
  generationAbort?: AbortController;
  joining: boolean;
  joinAttempts: number[];
};
type GameStartAction = Extract<MultiplayerHostAction, { type: "startGame" }>;
type RuntimeClaim = RoomClaim & { signal?: AbortSignal };

function gameRoster(room: MultiplayerStoredRoom) {
  const gm = room.characters.find((character) => character.role === "gm");
  return {
    partyCharacterIds: room.characters.filter((character) => character.id !== gm?.id).map((character) => character.id),
    gmMode: gm ? ("character" as const) : ("standalone" as const),
    gmCharacterId: gm?.id ?? null,
  };
}

async function saveRoomCharacters(
  chats: ReturnType<typeof createChatsStorage>,
  chat: { id: string; mode: string },
  room: MultiplayerStoredRoom,
) {
  await chats.update(chat.id, { characterIds: room.characters.map((character) => character.id) });
  if (chat.mode === "game") {
    const metadata = record((await chats.getById(chat.id))?.metadata);
    const roster = gameRoster(room);
    if (metadata.gameSetupConfig)
      await chats.patchMetadata(
        chat.id,
        {
          gameSetupConfig: { ...record(metadata.gameSetupConfig), ...roster },
          gamePartyCharacterIds: [...roster.partyCharacterIds, ...filterRoomGamePartyCharacterIds(metadata, [])],
          gameGmMode: roster.gmMode,
          gameGmCharacterId: roster.gmCharacterId,
        },
        { metadataQueueHeld: true },
      );
  }
}

function addRoomCharacter(
  room: MultiplayerStoredRoom,
  character: MultiplayerStoredRoom["characters"][number],
  game: boolean,
) {
  if (room.generation === "running") throw new MultiplayerError("busy");
  const existing = room.characters.findIndex((entry) => entry.id === character.id);
  if (existing < 0 && room.characters.length >= MULTIPLAYER_LIMITS.characters) throw new MultiplayerError("room-full");
  assertRoomPersonaName(
    { ...room, characters: room.characters.filter((entry) => entry.id !== character.id) },
    character.name,
  );
  if (game && character.role === "gm") for (const entry of room.characters) entry.role = "character";
  if (existing < 0) room.characters.push(character);
  else room.characters[existing] = character;
}

export interface MultiplayerGameRuntime {
  runGameStart(
    input: Omit<GameStartAction, "type"> & { chatId: string },
    claim: RuntimeClaim,
    runner: GenerationRunner,
    signal?: AbortSignal,
  ): Promise<unknown>;
  finishGameTurn(chatId: string, claim: RuntimeClaim, signal?: AbortSignal): Promise<unknown>;
}

/** One explicitly started room or joined session per Engine. Credentials live only until Stop/restart. */
export class MultiplayerService {
  private enabled = false;
  private host: Host | null = null;
  private guest: Guest | null = null;
  private controlTail: Promise<unknown> = Promise.resolve();
  private runner: GenerationRunner | null = null;
  private game: MultiplayerGameRuntime | null = null;
  private jobs = new Set<Promise<void>>();
  private outbound = new Set<AbortController>();

  constructor(
    private options: {
      db: DB;
      available: boolean;
      tls: () => { cert: Buffer; key: Buffer } | null;
      abortGeneration: (chatId: string) => void;
    },
  ) {}
  setRunner(runner: GenerationRunner) {
    this.runner = runner;
  }
  setGameRuntime(runtime: MultiplayerGameRuntime) {
    this.game = runtime;
  }
  async initialize() {
    this.enabled =
      this.options.available && (await createAppSettingsStorage(this.options.db).get("multiplayer")) === "true";
    // Never restore networking. Mark previous hosts interrupted and joined navigation entries disconnected.
    const chats = createChatsStorage(this.options.db);
    for (const chat of await chats.list()) {
      const room = record(record(chat.metadata).multiplayer);
      if (room.role === "host" && room.status !== "ended")
        await chats.patchMetadata(chat.id, {
          multiplayer: {
            ...room,
            status: "ended",
            generation: "failed",
            generationOperationId: null,
            pendingResponse: false,
            round: room.round ? { ...record(room.round), phase: "interrupted" } : null,
          },
        });
      if (room.role === "guest" && room.status !== "ended")
        await chats.patchMetadata(chat.id, { multiplayer: { ...room, status: "disconnected" } });
    }
  }
  status(): MultiplayerStatus {
    let tlsAvailable = false;
    if (this.options.available) {
      try {
        tlsAvailable = !!this.options.tls();
      } catch {
        /* Invalid TLS remains unavailable. */
      }
    }
    return {
      available: this.options.available,
      enabled: this.options.available && this.enabled,
      hosting: !!this.host,
      joined: !!this.guest,
      tlsAvailable,
    };
  }
  private gate() {
    if (!this.options.available || !this.enabled) throw new MultiplayerError("disabled");
  }
  private controls<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.controlTail.then(operation, operation);
    this.controlTail = next.catch(() => undefined);
    return next;
  }
  async settings(enabled: boolean) {
    // Disabling is immediate, including an in-flight password/admission request.
    if (!enabled) {
      this.enabled = false;
      for (const abort of this.outbound) abort.abort();
      this.host?.abort.abort();
      this.guest?.abort.abort();
    }
    return this.controls(async () => {
      if (!this.options.available) throw new MultiplayerError("disabled");
      this.enabled = enabled;
      if (!enabled) {
        await this.stopHost();
        await this.leaveGuest();
      }
      await createAppSettingsStorage(this.options.db).set("multiplayer", enabled ? "true" : "false");
      return this.status();
    });
  }
  async prepare(input: { chatId: string } | { mode: "conversation" | "roleplay" | "game"; name: string }) {
    this.gate();
    const chats = createChatsStorage(this.options.db);
    const source =
      "chatId" in input
        ? await chats.getById(input.chatId)
        : {
            ...input,
            characterIds: "[]",
            personaId: null,
            personaCharacterId: null,
            connectionId: null,
            promptPresetId: null,
          };
    if (!source) throw new MultiplayerError("invalid-message");
    // Clone only reviewed setup references, never a transcript, arbitrary metadata, notes or memories.
    const chat = await chats.create(
      createChatSchema.parse({
        name: source.name.slice(0, 80),
        mode: source.mode,
        characterIds: JSON.parse(source.characterIds).slice(0, 8),
        personaId: source.personaId,
        personaCharacterId: source.personaCharacterId,
        connectionId: source.connectionId,
        promptPresetId: source.promptPresetId,
      }),
    );
    await chats.patchMetadata(chat!.id, {
      multiplayerSetup: true,
      multiplayerSetupComplete: false,
      characterSchedules: {},
      conversationStatusOverrides: {},
      conversationSchedulesEnabled: false,
      activeLorebookIds: [],
      activeAgentIds: [],
      activeToolIds: [],
      crossChatAwareness: false,
    });
    return { chatId: chat!.id };
  }
  async startHost(input: {
    chatId: string;
    publicOrigin: string;
    password: string;
    displayName: string;
    persona: MultiplayerPersona;
  }) {
    return this.controls(async () => {
      this.gate();
      if (this.host || this.guest) throw new MultiplayerError("busy");
      const tls = this.options.tls();
      if (!tls) throw new MultiplayerError("unavailable");
      const chats = createChatsStorage(this.options.db);
      const chat = await chats.getById(input.chatId);
      if (!chat || record(chat.metadata).multiplayerSetup !== true || (await chats.countMessages(chat.id)) > 0)
        throw new MultiplayerError("invalid-message");
      const origin = new URL(input.publicOrigin);
      const roomId = newId(),
        epoch = newId();
      const fingerprint = new X509Certificate(tls.cert).fingerprint256.replaceAll(":", "").toLowerCase();
      multiplayerInviteSchema.parse({
        version: 1,
        origin: origin.origin,
        roomId,
        invite: secret(),
        fingerprint,
        expiresAt: now(),
      });
      const salt = randomBytes(32);
      const passwordHash = (await deriveKey(input.password, salt, 32)) as Buffer;
      this.gate();
      const characters: MultiplayerStoredRoom["characters"] = [];
      const storage = createCharactersStorage(this.options.db);
      const gameSetup = chat.mode === "game" ? record(record(chat.metadata).gameSetupConfig) : {};
      const gmId =
        gameSetup.gmMode === "character" && typeof gameSetup.gmCharacterId === "string"
          ? gameSetup.gmCharacterId
          : null;
      const selectedIds = [
        ...new Set([
          ...(JSON.parse(chat.characterIds) as string[]),
          ...(Array.isArray(gameSetup.partyCharacterIds)
            ? gameSetup.partyCharacterIds.filter((id): id is string => typeof id === "string")
            : []),
          ...(gmId ? [gmId] : []),
        ]),
      ];
      if (selectedIds.length > MULTIPLAYER_LIMITS.characters) throw new MultiplayerError("room-full");
      for (const id of selectedIds) {
        const character = await storage.getById(id);
        if (character)
          characters.push({
            id,
            name: String(record(character.data).name || "AI").slice(0, 80),
            role: id === gmId ? "gm" : "character",
          });
      }
      const room: MultiplayerStoredRoom = {
        version: 1,
        role: "host",
        roomId,
        epoch,
        revision: 1,
        status: chat.mode === "game" ? "lobby" : "active",
        generation: "idle",
        generationOperationId: null,
        pendingResponse: false,
        automaticReplies: record(chat.metadata).groupResponseOrder !== "manual",
        generations: 0,
        maxGenerations: 100,
        participants: [createRoomParticipant(input.displayName, input.persona, true)],
        characters,
        round: null,
        receipts: [],
        lastActivityAt: now(),
      };
      assertRoomPersonaName(room, input.persona.name, room.participants[0]!.id);
      if (
        room.characters.some((c) => !normalizeCharacterLookupName(c.name)) ||
        new Set(room.characters.map((c) => normalizeCharacterLookupName(c.name))).size !== room.characters.length
      )
        throw new MultiplayerError("identity-conflict");
      await chats.patchMetadata(chat.id, { multiplayer: room });
      const host: Host = {
        chatId: chat.id,
        lastHostSeen: Date.now(),
        store: createMultiplayerRoomStore(this.options.db, chat.id, roomId, epoch),
        origin: origin.origin,
        fingerprint,
        passwordSalt: salt,
        passwordHash,
        invite: null,
        inviteHash: null,
        sessions: new Map(),
        proposals: [],
        abort: new AbortController(),
        listener: null,
        waiters: new Set(),
        joining: false,
        joinAttempts: [],
      };
      this.host = host;
      try {
        host.listener = await startMultiplayerPeerServer({
          tls,
          port: Number(origin.port || 443),
          enabled: () => this.options.available && this.enabled && this.host === host && !host.abort.signal.aborted,
          handle: (message, context) => this.receive(host, message, context),
        });
        this.replaceInvite(host, roomId);
      } catch (error) {
        await this.stopHost();
        throw error;
      }
      logger.info("[multiplayer] Started room-only listener");
      return this.hostState();
    });
  }
  private replaceInvite(host: Host, roomId: string) {
    const invitation: MultiplayerInvite = {
      version: 1,
      origin: host.origin,
      roomId,
      invite: secret(),
      fingerprint: host.fingerprint,
      expiresAt: new Date(Date.now() + MULTIPLAYER_LIMITS.inviteMs).toISOString(),
    };
    host.invite = invitation;
    host.inviteHash = hash(invitation.invite);
  }
  private wake(host: Host) {
    for (const resolve of host.waiters) resolve();
    host.waiters.clear();
  }
  private live(host: Host) {
    this.gate();
    if (this.host !== host || host.abort.signal.aborted) throw new MultiplayerError("room-ended");
  }
  private async snapshot(host: Host, participantId: string) {
    this.live(host);
    const { chat, room } = await host.store.read();
    const connected = new Set(
      [...host.sessions.values()]
        .filter((s) => s.status === "approved" && s.expiresAt > Date.now() && s.lastSeen > Date.now() - 45_000)
        .map((s) => s.participant.id),
    );
    if (host.lastHostSeen > Date.now() - 45_000) connected.add(room.participants.find((p) => p.isHost)!.id);
    const messages = await createChatsStorage(this.options.db).listMessagePreviews(
      host.chatId,
      MULTIPLAYER_LIMITS.messages,
    );
    this.live(host);
    const game =
      chat.mode === "game"
        ? projectMultiplayerGame({
            room,
            metadata: chat.metadata,
            state: await createGameStateStorage(this.options.db).getLatest(host.chatId),
            messages,
          })
        : null;
    this.live(host);
    return projectRoomSnapshot({ room, chat, selfId: participantId, connected, messages, game });
  }
  async hostState(): Promise<MultiplayerHostState | null> {
    this.gate();
    const host = this.host;
    if (!host) return null;
    host.lastHostSeen = Date.now();
    const { room } = await host.store.read();
    return {
      chatId: host.chatId,
      snapshot: await this.snapshot(host, room.participants.find((p) => p.isHost)!.id),
      pendingRequests: [...host.sessions.values()]
        .filter((s) => s.status === "pending" && s.expiresAt > Date.now())
        .map((s) => ({ id: s.id, displayName: s.participant.displayName, persona: s.participant.persona })),
      proposals: host.proposals,
      invite:
        host.invite && Date.parse(host.invite.expiresAt) > Date.now()
          ? { code: encodeMultiplayerInvite(host.invite), expiresAt: host.invite.expiresAt }
          : null,
    };
  }
  private async sessionState(host: Host, session: Session): Promise<MultiplayerGuestState> {
    this.live(host);
    if (session.expiresAt <= Date.now() || session.status === "revoked")
      return { phase: "ended", snapshot: null, error: "revoked" };
    if (session.status === "declined") return { phase: "ended", snapshot: null, error: "declined" };
    if (session.status === "pending") return { phase: "awaiting-approval", snapshot: null, error: null };
    const snapshot = await this.snapshot(host, session.participant.id);
    this.live(host);
    // A concurrent Kick/Leave must win over asynchronous storage/projection reads.
    if ((session.status as Session["status"]) !== "approved" || session.expiresAt <= Date.now())
      return { phase: "ended", snapshot: null, error: "revoked" };
    return { phase: "connected", snapshot, error: null };
  }
  private async receive(
    host: Host,
    message: MultiplayerPeerRequest,
    context: { session: string | null; address: string; signal: AbortSignal },
  ): Promise<MultiplayerPeerResponse> {
    let authenticated: Session | undefined;
    try {
      this.live(host);
      if (context.signal.aborted) throw new MultiplayerError("disconnected");
      const { room, chat } = await host.store.read();
      if (message.roomId !== room.roomId) throw new MultiplayerError("invalid-invite");
      if (message.type === "preview" || message.type === "join") {
        if (!host.invite || !host.inviteHash || !matches(message.invite, host.inviteHash))
          throw new MultiplayerError("invalid-invite");
        if (Date.parse(host.invite.expiresAt) <= Date.now()) throw new MultiplayerError("expired-invite");
        if (message.type === "preview")
          return {
            version: 1,
            type: "preview",
            roomId: room.roomId,
            name: chat.name.slice(0, 80),
            mode: chat.mode as "conversation" | "roleplay" | "game",
            expiresAt: host.invite.expiresAt,
          };
        host.joinAttempts = host.joinAttempts.filter((time) => time > Date.now() - 60_000);
        if (host.joining || host.joinAttempts.length >= 6) throw new MultiplayerError("rate-limited");
        host.joinAttempts.push(Date.now());
        host.joining = true;
        try {
          const candidate = (await deriveKey(message.password, host.passwordSalt, 32)) as Buffer;
          this.live(host);
          if (context.signal.aborted) throw new MultiplayerError("disconnected");
          if (
            !host.inviteHash ||
            !host.invite ||
            !matches(message.invite, host.inviteHash) ||
            Date.parse(host.invite.expiresAt) <= Date.now()
          )
            throw new MultiplayerError("expired-invite");
          if (!timingSafeEqual(candidate, host.passwordHash)) throw new MultiplayerError("wrong-password");
          for (const [key, value] of host.sessions)
            if (value.expiresAt <= Date.now() || value.status === "declined" || value.status === "revoked")
              host.sessions.delete(key);
          if (host.sessions.size >= 8 || room.participants.length >= MULTIPLAYER_LIMITS.players)
            throw new MultiplayerError("room-full");
          const token = secret();
          host.sessions.set(hash(token).toString("hex"), {
            id: newId(),
            participant: createRoomParticipant(message.displayName, message.persona),
            status: "pending",
            expiresAt: Date.now() + MULTIPLAYER_LIMITS.sessionMs,
            lastSeen: Date.now(),
            polling: false,
            actions: [],
          });
          this.wake(host);
          return { version: 1, type: "admission", session: token };
        } finally {
          host.joining = false;
        }
      }
      const session = context.session ? host.sessions.get(hash(context.session).toString("hex")) : undefined;
      if (!session || session.expiresAt <= Date.now()) throw new MultiplayerError("revoked");
      session.lastSeen = Date.now();
      // Revocation is session-scoped, including pending admission and stale UI sequences.
      // It never submits/passes a Game actor or reads a transcript.
      if (message.type === "action" && message.action.type === "leave") {
        session.status = "revoked";
        this.wake(host);
        return {
          version: 1,
          type: "accepted",
          operationId: message.action.operationId,
          state: { phase: "ended", snapshot: null, error: "revoked" },
        };
      }
      if (message.type === "poll") {
        if (session.polling) throw new MultiplayerError("busy");
        session.polling = true;
        try {
          if ((session.status === "approved" && message.revision === room.revision) || session.status === "pending")
            await new Promise<void>((resolve) => {
              const done = () => {
                clearTimeout(timer);
                host.waiters.delete(done);
                context.signal.removeEventListener("abort", done);
                host.abort.signal.removeEventListener("abort", done);
                resolve();
              };
              const timer = setTimeout(done, MULTIPLAYER_LIMITS.pollMs);
              timer.unref();
              host.waiters.add(done);
              context.signal.addEventListener("abort", done, { once: true });
              host.abort.signal.addEventListener("abort", done, { once: true });
              if (context.signal.aborted || host.abort.signal.aborted) done();
            });
          if (context.signal.aborted) throw new MultiplayerError("disconnected");
          return { version: 1, type: "state", state: await this.sessionState(host, session) };
        } finally {
          session.polling = false;
        }
      }
      if (session.status !== "approved")
        throw new MultiplayerError(
          session.status === "pending" ? "awaiting-approval" : session.status === "declined" ? "declined" : "revoked",
        );
      authenticated = session;
      session.actions = session.actions.filter((time) => time > Date.now() - 60_000);
      if (session.actions.length >= 30) throw new MultiplayerError("rate-limited");
      session.actions.push(Date.now());
      await this.participantAction(
        host,
        session.participant.id,
        message.action,
        AbortSignal.any([context.signal, host.abort.signal]),
        () => session.status === "approved" && session.expiresAt > Date.now(),
      );
      if (message.action.type === "leave") session.status = "revoked";
      return {
        version: 1,
        type: "accepted",
        operationId: message.action.operationId,
        state: await this.sessionState(host, session),
      };
    } catch (error) {
      // Domain errors only. Never disclose exception strings, file paths or provider responses to peers.
      const code = error instanceof MultiplayerError ? error.code : "unavailable";
      const state =
        code === "stale-action" && authenticated
          ? await this.sessionState(host, authenticated).catch(() => undefined)
          : undefined;
      return { version: 1, type: "error", code, ...(state ? { state: { ...state, error: code } } : {}) };
    }
  }
  private async participantAction(
    host: Host,
    participantId: string,
    action: MultiplayerAction,
    signal?: AbortSignal,
    isActive?: () => boolean,
  ) {
    // Serialize the bounded proposal queue with its durable receipt, including retries at capacity.
    if (action.type === "propose-character")
      return this.controls(() => this.commitParticipantAction(host, participantId, action, signal, isActive));
    return this.commitParticipantAction(host, participantId, action, signal, isActive);
  }
  private async commitParticipantAction(
    host: Host,
    participantId: string,
    action: MultiplayerAction,
    signal?: AbortSignal,
    isActive?: () => boolean,
  ) {
    this.live(host);
    if (action.type === "propose-character" && host.proposals.length >= 8) {
      const { room } = await host.store.read();
      if (!room.receipts.some((r) => r.operationId === action.operationId && r.participantId === participantId))
        throw new MultiplayerError("busy");
    }
    const result = await host.store.action(participantId, action, signal, isActive);
    if (!result.duplicate && action.type === "propose-character" && (!isActive || isActive())) {
      const { room } = await host.store.read();
      host.proposals.push({
        id: action.operationId,
        participantId,
        displayName: room.participants.find((p) => p.id === participantId)!.displayName,
        character: action.character,
      });
    }
    // Leave disconnects; an unresolved Game slot still requires explicit host Pass/Kick.
    if (action.type === "leave")
      for (const session of host.sessions.values())
        if (session.participant.id === participantId) session.status = "revoked";
    this.wake(host);
    if (result.claim) this.launch(host, result.claim);
  }
  async hostParticipantAction(action: MultiplayerAction) {
    this.gate();
    const host = this.host;
    if (!host) throw new MultiplayerError("room-ended");
    const { room } = await host.store.read();
    await this.participantAction(host, room.participants.find((p) => p.isHost)!.id, action);
    return this.hostState();
  }
  async hostAction(action: MultiplayerHostAction) {
    return this.controls(async () => {
      this.gate();
      const host = this.host;
      if (!host) throw new MultiplayerError("room-ended");
      if (action.type === "stop") {
        await this.stopHost();
        return null;
      }
      if (action.type === "invite") this.replaceInvite(host, (await host.store.read()).room.roomId);
      else if (action.type === "revoke-invite") {
        host.invite = null;
        host.inviteHash = null;
      } else if (action.type === "approve" || action.type === "decline") {
        const session = [...host.sessions.values()].find((s) => s.id === action.requestId);
        if (!session || session.status !== "pending" || session.expiresAt <= Date.now())
          throw new MultiplayerError("stale-action");
        if (action.type === "approve") {
          await host.store.admit(session.participant);
          session.status = "approved";
        } else session.status = "declined";
      } else if (action.type === "kick") {
        const claim = await host.store.kick(action.participantId);
        for (const session of host.sessions.values())
          if (session.participant.id === action.participantId) session.status = "revoked";
        if (claim) this.launch(host, claim);
      } else if (action.type === "pass") {
        const claim = await host.store.hostPass(action.participantId);
        if (claim) this.launch(host, claim);
      } else if (action.type === "pause") {
        await host.store.pause();
        host.generationAbort?.abort();
        this.options.abortGeneration(host.chatId);
      } else if (action.type === "resume") {
        const claim = await host.store.resume();
        if (claim) this.launch(host, claim);
      } else if (action.type === "configure")
        await host.store.change((room) => {
          if (room.status !== "paused" && room.status !== "lobby") throw new MultiplayerError("busy");
          room.automaticReplies = action.automaticReplies;
          room.maxGenerations = action.maxGenerations;
        });
      else if (action.type === "add-character" || action.type === "remove-character") {
        await host.store.change(async (room, chats, chat, transaction) => {
          if (room.generation === "running") throw new MultiplayerError("busy");
          if (action.type === "add-character") {
            const character = await createCharactersStorage(transaction).getById(action.characterId);
            if (!character) throw new MultiplayerError("invalid-message");
            addRoomCharacter(
              room,
              {
                id: character.id,
                name: String(record(character.data).name || "AI").slice(0, 80),
                role: action.role,
              },
              chat.mode === "game",
            );
          } else room.characters = room.characters.filter((character) => character.id !== action.characterId);
          await saveRoomCharacters(chats, chat, room);
        });
      } else if (action.type === "proposal-approve" || action.type === "proposal-decline") {
        const proposal = host.proposals.find((p) => p.id === action.proposalId);
        if (!proposal) throw new MultiplayerError("stale-action");
        if (action.type === "proposal-approve")
          await host.store.change(async (room, chats, chat, transaction) => {
            if (room.characters.length >= MULTIPLAYER_LIMITS.characters || room.generation === "running")
              throw new MultiplayerError("busy");
            assertRoomPersonaName(room, proposal.character.name);
            // The host explicitly reviews and saves these two text fields. No card import or peer assets.
            const character = await createCharactersStorage(transaction).create(
              characterDataSchema.parse({ name: proposal.character.name, description: proposal.character.description }),
            );
            if (!character) throw new MultiplayerError("unavailable");
            addRoomCharacter(
              room,
              { id: character.id, name: proposal.character.name, role: proposal.character.role },
              chat.mode === "game",
            );
            await saveRoomCharacters(chats, chat, room);
          });
        host.proposals = host.proposals.filter((p) => p.id !== action.proposalId);
      } else if (action.type === "startGame") await this.startGame(host, action);
      this.wake(host);
      return this.hostState();
    });
  }
  private async startGame(host: Host, action: GameStartAction) {
    if (!this.game || !this.runner) throw new MultiplayerError("unavailable");
    const claim = await host.store.change((room, _chats, chat) => {
      if (
        chat.mode !== "game" ||
        room.status !== "lobby" ||
        room.generation === "running" ||
        room.generations >= room.maxGenerations
      )
        throw new MultiplayerError("busy");
      // The Players roster is authoritative, including removals made after the setup wizard.
      action = { ...action, config: { ...action.config, ...gameRoster(room) } };
      room.status = "active";
      room.generation = "running";
      room.generationOperationId = newId();
      room.generations++;
      return { roomId: room.roomId, epoch: room.epoch, operationId: room.generationOperationId, roundId: null };
    });
    this.launch(host, claim, async (signal) => {
      await this.game!.runGameStart({ ...action, chatId: host.chatId }, { ...claim, signal }, this.runner!, signal);
    });
  }
  private launch(
    host: Host,
    claim: RoomClaim,
    run?: (signal: AbortSignal) => Promise<void>,
    request: Record<string, unknown> = {},
  ) {
    const generationAbort = new AbortController();
    host.generationAbort = generationAbort;
    const signal = AbortSignal.any([host.abort.signal, generationAbort.signal]);
    const job = (async () => {
      let success = false;
      try {
        this.live(host);
        if (run) {
          await run(signal);
          signal.throwIfAborted();
          success = true;
        } else {
          if (!this.runner) throw new MultiplayerError("unavailable");
          let failed = false,
            done = false;
          const sink = createGenerationEventSink({
            onEvent: (event) => {
              if (event.type === "error") failed = true;
              if (event.type === "done") done = true;
            },
            onFinish: ({ statusCode }) => {
              if (statusCode >= 400) failed = true;
            },
          });
          await this.runner({ chatId: host.chatId, userMessage: null, ...request }, sink, { ...claim, signal });
          this.live(host);
          success = done && !failed && !signal.aborted;
          if (success && claim.roundId) await this.game?.finishGameTurn(host.chatId, { ...claim, signal }, signal);
        }
      } catch (error) {
        if (!(error instanceof MultiplayerError))
          logger.warn({ err: error }, "[multiplayer] Room generation did not complete");
      } finally {
        if (host.generationAbort === generationAbort) host.generationAbort = undefined;
        if (this.host === host && !host.abort.signal.aborted) {
          const next = await host.store.finishGeneration(claim, success).catch(async (error) => {
            logger.error(error, "[multiplayer] Could not commit the room generation boundary");
            // Preserve committed provider work but expose an interrupted state instead of a stuck spinner.
            await host.store.finishGeneration(claim, false);
            return null;
          });
          this.wake(host);
          if (next) this.launch(host, next);
        }
      }
    })();
    this.jobs.add(job);
    void job.finally(() => this.jobs.delete(job)).catch(() => undefined);
    return job;
  }
  async autonomousEnabled(chatId: string) {
    if (!this.options.available || !this.enabled || !this.host || this.host.chatId !== chatId) return false;
    const { chat, room } = await this.host.store.read();
    const anyoneConnected =
      this.host.lastHostSeen > Date.now() - 45_000 ||
      [...this.host.sessions.values()].some(
        (s) => s.status === "approved" && s.lastSeen > Date.now() - 45_000 && s.expiresAt > Date.now(),
      );
    return (
      anyoneConnected &&
      chat.mode === "conversation" &&
      room.status === "active" &&
      room.generation === "idle" &&
      room.generations < room.maxGenerations
    );
  }
  async generateAutonomous(input: {
    chatId: string;
    characterId: string;
    autonomousIntentKey: string;
    userTimeZone: string;
  }) {
    if (!(await this.autonomousEnabled(input.chatId))) return false;
    const host = this.host!;
    if (!(await host.store.read()).room.characters.some((c) => c.id === input.characterId)) return false;
    const claim = await host.store.beginGeneration();
    if (!claim) return false;
    await this.launch(host, claim, undefined, {
      autonomous: true,
      forCharacterId: input.characterId,
      autonomousIntentKey: input.autonomousIntentKey,
      userTimeZone: input.userTimeZone,
    });
    return this.host === host && !host.abort.signal.aborted && (await host.store.read()).room.generation === "idle";
  }
  private async stopHost() {
    const host = this.host;
    if (!host) return;
    this.host = null;
    host.abort.abort();
    host.invite = null;
    host.inviteHash = null;
    this.options.abortGeneration(host.chatId);
    host.sessions.clear();
    host.proposals = [];
    this.wake(host);
    await host.listener?.close();
    try {
      await host.store.stop();
    } finally {
      host.passwordHash.fill(0);
      host.passwordSalt.fill(0);
    }
    logger.info("[multiplayer] Stopped room and revoked participant sessions");
  }
  async preview(inviteCode: string) {
    this.gate();
    const invitation = decodeMultiplayerInvite(inviteCode);
    const reply = await this.connect(invitation, {
      version: 1,
      roomId: invitation.roomId,
      type: "preview",
      invite: invitation.invite,
    });
    this.gate();
    if (reply.type === "error") throw new MultiplayerError(reply.code);
    if (reply.type !== "preview") throw new MultiplayerError("invalid-message");
    return { name: reply.name, mode: reply.mode, expiresAt: reply.expiresAt, fingerprint: invitation.fingerprint };
  }
  async join(input: { inviteCode: string; password: string; displayName: string; persona: MultiplayerPersona }) {
    return this.controls(async () => {
      this.gate();
      if (this.host || this.guest) throw new MultiplayerError("busy");
      const invitation = decodeMultiplayerInvite(input.inviteCode);
      const preview = await this.preview(input.inviteCode);
      const response = await this.connect(invitation, {
        version: 1,
        roomId: invitation.roomId,
        type: "join",
        invite: invitation.invite,
        password: input.password,
        displayName: input.displayName,
        persona: input.persona,
      });
      this.gate();
      if (response.type === "error") throw new MultiplayerError(response.code);
      if (response.type !== "admission") throw new MultiplayerError("invalid-message");
      const chats = createChatsStorage(this.options.db);
      const chat = await chats.create(createChatSchema.parse({ name: preview.name, mode: preview.mode }));
      await chats.patchMetadata(chat!.id, {
        multiplayer: {
          version: 1,
          role: "guest",
          roomId: invitation.roomId,
          hostFingerprint: invitation.fingerprint,
          status: "joined",
        },
        characterSchedules: {},
        conversationStatusOverrides: {},
        conversationSchedulesEnabled: false,
        activeAgentIds: [],
        activeToolIds: [],
        activeLorebookIds: [],
      });
      this.guest = {
        invitation,
        token: response.session,
        localChatId: chat!.id,
        state: { phase: "awaiting-approval", snapshot: null, error: null },
        abort: new AbortController(),
        poll: null,
        expiresAt: Date.now() + MULTIPLAYER_LIMITS.sessionMs,
        admittedSelfId: null,
        lastRevision: -1,
      };
      return { localChatId: chat!.id, state: this.guest.state };
    });
  }
  private applyGuestState(guest: Guest, state: MultiplayerGuestState) {
    if (this.guest !== guest || guest.abort.signal.aborted) return;
    if (state.snapshot) {
      if (guest.admittedSelfId && state.snapshot.selfId !== guest.admittedSelfId) {
        guest.state = { phase: "ended", snapshot: null, error: "invalid-message" };
        guest.abort.abort();
        return;
      }
      if (state.snapshot.revision < guest.lastRevision) return;
      guest.admittedSelfId = state.snapshot.selfId;
      guest.lastRevision = state.snapshot.revision;
    }
    const changedPhase = guest.state.phase !== state.phase;
    guest.state = state;
    if (changedPhase) {
      void createChatsStorage(this.options.db)
        .patchMetadata(guest.localChatId, (metadata) => {
          if (this.guest !== guest || guest.state.phase !== state.phase) return {};
          return {
            multiplayer: {
              ...record(metadata.multiplayer),
              status: state.phase === "ended" ? "ended" : state.phase === "reconnecting" ? "disconnected" : "joined",
            },
          };
        })
        .catch((error: unknown) => logger.debug({ err: error }, "[multiplayer] Could not save connection status"));
    }
  }
  private async connect(invitation: MultiplayerInvite, message: MultiplayerPeerRequest) {
    this.gate();
    if (this.outbound.size >= 2) throw new MultiplayerError("busy");
    const abort = new AbortController();
    this.outbound.add(abort);
    try {
      return await requestMultiplayerPeer(invitation, message, { signal: abort.signal });
    } catch (error) {
      if (record(error).code === "MULTIPLAYER_IDENTITY_CHANGED") throw new MultiplayerError("identity-changed");
      throw error;
    } finally {
      this.outbound.delete(abort);
    }
  }
  async guestState(): Promise<MultiplayerGuestSession | null> {
    this.gate();
    const guest = this.guest;
    if (!guest) return null;
    // One connector poll per Engine even with several UI tabs. Viewers receive only the validated projection.
    if (!guest.poll && guest.state.phase !== "ended")
      guest.poll = (async () => {
        try {
          if (guest.expiresAt <= Date.now()) {
            this.applyGuestState(guest, { phase: "ended", snapshot: null, error: "revoked" });
            return;
          }
          const response = await requestMultiplayerPeer(
            guest.invitation,
            {
              version: 1,
              type: "poll",
              roomId: guest.invitation.roomId,
              revision: guest.state.snapshot?.revision ?? 0,
            },
            { session: guest.token, signal: guest.abort.signal },
          );
          this.gate();
          if (response.type === "state") this.applyGuestState(guest, response.state);
          else if (response.type === "error")
            this.applyGuestState(guest, {
              phase: ["revoked", "declined", "room-ended", "disabled"].includes(response.code)
                ? "ended"
                : "reconnecting",
              snapshot: null,
              error: response.code,
            });
        } catch (error) {
          this.applyGuestState(
            guest,
            record(error).code === "MULTIPLAYER_IDENTITY_CHANGED"
              ? { phase: "ended", snapshot: null, error: "identity-changed" }
              : { ...guest.state, phase: "reconnecting", error: "disconnected" },
          );
        } finally {
          guest.poll = null;
        }
      })();
    // Return cached safe state; the pending long poll wakes the next local UI refresh.
    return { localChatId: guest.localChatId, state: guest.state };
  }
  async guestAction(action: MultiplayerAction) {
    this.gate();
    const guest = this.guest;
    if (!guest || guest.state.phase === "ended") throw new MultiplayerError("disconnected");
    const response = await requestMultiplayerPeer(
      guest.invitation,
      { version: 1, type: "action", roomId: guest.invitation.roomId, action },
      { session: guest.token, signal: guest.abort.signal },
    ).catch((error: unknown) => {
      if (record(error).code === "MULTIPLAYER_IDENTITY_CHANGED") {
        this.applyGuestState(guest, { phase: "ended", snapshot: null, error: "identity-changed" });
        throw new MultiplayerError("identity-changed");
      }
      throw error;
    });
    this.gate();
    if (this.guest !== guest) throw new MultiplayerError("disconnected");
    if (response.type === "error") {
      if (response.state) this.applyGuestState(guest, { ...response.state, error: response.code });
      throw new MultiplayerError(response.code);
    }
    if (response.type !== "accepted") throw new MultiplayerError("invalid-message");
    this.applyGuestState(guest, response.state);
    return { localChatId: guest.localChatId, state: guest.state };
  }
  async leaveGuest() {
    const guest = this.guest;
    if (!guest) return;
    // Best effort revoke, then always discard local authority; closing remains available offline.
    this.guest = null;
    guest.abort.abort();
    if (this.options.available && this.enabled) {
      const action: MultiplayerAction = {
        type: "leave",
        operationId: newId(),
        sequence: guest.state.snapshot?.nextSequence ?? 0,
      };
      void requestMultiplayerPeer(
        guest.invitation,
        { version: 1, type: "action", roomId: guest.invitation.roomId, action },
        { session: guest.token, signal: AbortSignal.timeout(2_000) },
      ).catch(() => undefined);
    }
    const chats = createChatsStorage(this.options.db);
    await chats.patchMetadata(guest.localChatId, {
      multiplayer: {
        version: 1,
        role: "guest",
        roomId: guest.invitation.roomId,
        hostFingerprint: guest.invitation.fingerprint,
        status: "ended",
      },
    });
    guest.token = "";
  }
  async close() {
    this.enabled = false;
    for (const abort of this.outbound) abort.abort();
    await this.stopHost();
    await this.leaveGuest();
  }
}

export function encodeMultiplayerInvite(invitation: MultiplayerInvite) {
  return `ME1.${Buffer.from(JSON.stringify(invitation)).toString("base64url")}`;
}
export function decodeMultiplayerInvite(value: string): MultiplayerInvite {
  if (!/^ME1\.[A-Za-z0-9_-]{1,2048}$/u.test(value)) throw new MultiplayerError("invalid-invite");
  let result: MultiplayerInvite;
  try {
    result = parseMultiplayerJson(
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(value.slice(4), "base64url")),
      multiplayerInviteSchema,
      1536,
    );
  } catch {
    throw new MultiplayerError("invalid-invite");
  }
  if (Date.parse(result.expiresAt) <= Date.now()) throw new MultiplayerError("expired-invite");
  return result;
}
