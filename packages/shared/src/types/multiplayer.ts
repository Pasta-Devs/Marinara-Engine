import type { ChatMode } from "./chat.js";
import type { GameSetupConfig } from "./game.js";
import type { MultiplayerGuestState, MultiplayerPersona, MultiplayerSnapshot } from "../schemas/multiplayer.schema.js";

export interface MultiplayerStatus {
  available: boolean;
  enabled: boolean;
  hosting: boolean;
  joined: boolean;
  tlsAvailable: boolean;
}

export interface MultiplayerHostState {
  chatId: string;
  snapshot: MultiplayerSnapshot;
  pendingRequests: Array<{ id: string; displayName: string; persona: MultiplayerPersona }>;
  proposals: Array<{
    id: string;
    participantId: string;
    displayName: string;
    character: MultiplayerPersona & { role: "character" | "gm" };
  }>;
  invite: { code: string; expiresAt: string } | null;
}

export interface MultiplayerGuestSession {
  localChatId: string;
  state: MultiplayerGuestState;
}

export interface MultiplayerPreview {
  name: string;
  mode: ChatMode;
  fingerprint: string;
  expiresAt: string;
}

export type MultiplayerHostAction =
  | { type: "invite" | "revoke-invite" | "pause" | "resume" | "stop" }
  | { type: "configure"; automaticReplies: boolean; maxGenerations: number }
  | { type: "approve" | "decline"; requestId: string }
  | { type: "kick" | "pass"; participantId: string }
  | { type: "proposal-approve" | "proposal-decline"; proposalId: string }
  | { type: "add-character"; characterId: string; role: "character" | "gm" }
  | { type: "remove-character"; characterId: string }
  | {
      type: "startGame";
      config: GameSetupConfig;
      preferences: string;
      gmConnectionId?: string;
      gameName?: string;
    };

export interface MultiplayerStoredParticipant {
  id: string;
  displayName: string;
  persona: MultiplayerPersona;
  isHost: boolean;
  joinsNextRound: boolean;
  lastSequence: number;
  pendingPersona?: MultiplayerPersona;
  personaChangeRejected?: boolean;
}

export interface MultiplayerStoredRound {
  id: string;
  number: number;
  phase: "collecting" | "resolving" | "interrupted";
  requiredParticipantIds: string[];
  submissions: Record<string, { operationId: string; revision: number; text: string; pass: boolean }>;
  resolutionId: string | null;
}

/** Host-owned metadata; credentials and private provider settings never belong here. */
export interface MultiplayerStoredRoom {
  version: 1;
  role: "host";
  roomId: string;
  epoch: string;
  revision: number;
  status: "lobby" | "active" | "paused" | "ended";
  generation: "idle" | "running" | "failed";
  generationOperationId: string | null;
  pendingResponse: boolean;
  automaticReplies: boolean;
  generations: number;
  maxGenerations: number;
  participants: MultiplayerStoredParticipant[];
  characters: Array<{ id: string; name: string; role: "character" | "gm" }>;
  round: MultiplayerStoredRound | null;
  receipts: Array<{ operationId: string; sequence: number; participantId: string; messageIds: string[] }>;
  lastActivityAt: string;
}

/** Joined chats are local navigation entries, not imported host chats or credentials. */
export interface MultiplayerJoinedRoom {
  version: 1;
  role: "guest";
  roomId: string;
  hostFingerprint: string;
  status: "joined" | "disconnected" | "ended";
}
