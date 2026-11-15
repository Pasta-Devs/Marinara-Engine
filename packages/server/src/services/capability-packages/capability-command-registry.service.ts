import { CONVERSATION_COMMAND_KEYS, getTurnGameEngine } from "@marinara-engine/shared";
import { currentRoomGeneration } from "../multiplayer/generation-policy.js";
export interface CapabilityConversationCommandRegistration {
  commandType: string;
  tags: string[];
  maxPayloadChars?: number;
  description?: string;
  payloadExample?: string;
  validatePayload?: (payload: string | null) => boolean;
  /**
   * Handlers must be idempotent. A completed in-memory dispatch is released,
   * and a durable claim can fail after the handler has run, so a later retry
   * may invoke the handler again.
   */
  handler?: (action: CapabilityConversationAction) => void | Promise<void>;
  /**
   * Capability API 1.827. The copy of the Commands toggle a command that starts a turn game gets in Chat Settings
   * and the chat setup wizard. Without it the toggle is named after the game and uses the Engine's description.
   */
  toggle?: { label?: string; description?: string };
  /**
   * Capability API 1.827. Called when a character's tag starts this command's turn game, before the game is set
   * up. Return the game's config and, if some should sit out, the proposed characters to seat. Return null to not
   * start the game; returning nothing changes nothing. It has 2 seconds, and if it throws or runs out of time the
   * game does not start. Without it the game starts with the engine's default config.
   */
  startConfig?: (
    context: CapabilityTurnGameStartContext,
  ) => CapabilityTurnGameStart | null | Promise<CapabilityTurnGameStart | null>;
}

export interface CapabilityTurnGameStartContext {
  chatId: string;
  /** The character whose tag starts the game, if the reply named one. */
  characterId: string | null;
  /** The characters the Engine would seat, the tagging character first. */
  botCharacterIds: string[];
  /** The player's seat: the chat's persona id, or "human" without one. */
  humanSeatId: string;
  /** The chat's IANA time zone, or null when it has none and the server's local time applies. */
  timeZone: string | null;
}

export interface CapabilityTurnGameStart {
  config?: unknown;
  /**
   * Seats only these of the proposed characters, in the order given; ids not proposed are dropped. An empty list
   * seats the player alone, and the game does not start if that is fewer players than it needs.
   */
  botCharacterIds?: string[];
}

/** A package command that starts a registered turn game and has no built-in toggle. */
export interface CapabilityTurnGameCommand {
  commandType: string;
  /** The tag a character writes, without brackets. */
  tag: string;
  gameType: string;
  /** The game's own name, for the prompt. */
  gameLabel: string;
  /** The toggle's name: the package's, or the game's. */
  label: string;
  /** The package's toggle description, or null for the Engine's. */
  description: string | null;
  minPlayers: number;
  maxPlayers: number;
}

export interface CapabilityConversationAction {
  type: "capability";
  commandType: string;
  payload: string | null;
  chatId: string;
  sourceMessageId: string;
  swipeIndex: number;
  branchChatId: string;
  characterId: string | null;
}

const tagToCommandType = new Map<string, string>();
const handlersByCommandType = new Map<string, CapabilityConversationCommandRegistration["handler"]>();
const payloadLimitsByCommandType = new Map<string, number>();
const descriptionsByCommandType = new Map<string, { description: string; payloadExample: string }>();
const validatorsByCommandType = new Map<string, CapabilityConversationCommandRegistration["validatePayload"]>();
const turnGameDetailsByCommandType = new Map<
  string,
  Pick<CapabilityConversationCommandRegistration, "toggle" | "startConfig"> & { tag: string }
>();
const builtInCommandKeys = new Set<string>(CONVERSATION_COMMAND_KEYS);
const dispatchedActions = new Set<string>();

/** The turn-game engine a command starts: `tic_tac_toe` starts `tic-tac-toe`. */
export function turnGameTypeForCommand(commandType: string): string {
  return commandType.replaceAll("_", "-");
}

function toggleText(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

export function registerCapabilityConversationCommand(
  registration: CapabilityConversationCommandRegistration,
): () => void {
  const commandType = registration.commandType.trim();
  if (!/^[a-z][a-z0-9_-]*$/.test(commandType)) throw new Error("Capability command type is invalid");
  const tags = registration.tags.map((tag) => tag.trim().toLocaleLowerCase());
  if (tags.length === 0 || tags.some((tag) => !/^[a-z][a-z0-9_-]*$/.test(tag))) {
    throw new Error("Capability command tag is invalid");
  }
  if (payloadLimitsByCommandType.has(commandType)) {
    throw new Error(`Capability command type ${commandType} is already registered`);
  }
  for (const tag of tags) {
    if (tagToCommandType.has(tag)) throw new Error(`Conversation command tag ${tag} is already registered`);
    tagToCommandType.set(tag, commandType);
  }
  if (registration.handler) handlersByCommandType.set(commandType, registration.handler);
  if (registration.validatePayload) validatorsByCommandType.set(commandType, registration.validatePayload);
  payloadLimitsByCommandType.set(commandType, Math.max(0, Math.min(registration.maxPayloadChars ?? 2_000, 8_000)));
  if (registration.handler && registration.description) {
    descriptionsByCommandType.set(commandType, {
      description: registration.description.trim().slice(0, 500),
      payloadExample: registration.payloadExample?.trim().slice(0, 500) || "{}",
    });
  }
  turnGameDetailsByCommandType.set(commandType, {
    tag: tags[0]!,
    toggle: registration.toggle,
    startConfig: typeof registration.startConfig === "function" ? registration.startConfig : undefined,
  });
  return () => {
    for (const tag of tags) {
      if (tagToCommandType.get(tag) === commandType) tagToCommandType.delete(tag);
    }
    if (handlersByCommandType.get(commandType) === registration.handler) handlersByCommandType.delete(commandType);
    payloadLimitsByCommandType.delete(commandType);
    descriptionsByCommandType.delete(commandType);
    validatorsByCommandType.delete(commandType);
    turnGameDetailsByCommandType.delete(commandType);
  };
}

/**
 * Package commands that start a registered turn game, other than the built-in Conversation command keys (UNO,
 * chess and the rest keep their own toggles and prompt lines). The toggle key is the command type.
 */
export function listCapabilityTurnGameCommands(): CapabilityTurnGameCommand[] {
  const commands: CapabilityTurnGameCommand[] = [];
  for (const [commandType, details] of turnGameDetailsByCommandType) {
    if (builtInCommandKeys.has(commandType)) continue;
    const engine = getTurnGameEngine(turnGameTypeForCommand(commandType));
    if (!engine) continue;
    commands.push({
      commandType,
      tag: details.tag,
      gameType: engine.gameType,
      gameLabel: engine.label,
      label: toggleText(details.toggle?.label, 80) ?? engine.label,
      description: toggleText(details.toggle?.description, 300),
      minPlayers: engine.minPlayers,
      maxPlayers: engine.maxPlayers,
    });
  }
  return commands;
}

/** The package's start hook for a command's turn game, if it registered one. */
export function getCapabilityTurnGameStartConfig(
  commandType: string,
): CapabilityConversationCommandRegistration["startConfig"] {
  return turnGameDetailsByCommandType.get(commandType)?.startConfig;
}

export function listCapabilityConversationCommandInstructions(): string[] {
  if (currentRoomGeneration()) return [];
  return Array.from(
    descriptionsByCommandType,
    ([commandType, details]) =>
      `- [${commandType}:<JSON payload>] — ${details.description} Example: [${commandType}:${details.payloadExample}]`,
  );
}

/** The bracket-tag grammar, as a source string so a second parser cannot drift from the shipped one.
 *  Group 1 is the tag name, group 2 the optional payload. A JSON payload can itself contain `]` (a
 *  note body, an array), so the payload alternative matches a `{…}` brace run before falling back to
 *  bracket-free text. Lazy, so two commands on one line stay separate. ponytail: flat objects only —
 *  a nested `}` ends the match early; upgrade to a real scanner if payloads ever nest.
 *
 *  Exported for the package-declared GM verb runtime (#5798), which scans the same grammar against a
 *  different, per-chat vocabulary. Sharing the source is the point: a verb the prompt advertises but
 *  the parser cannot match would leave a raw tag in the player's prose. */
export const CAPABILITY_COMMAND_TAG_PATTERN = String.raw`\[([a-z][a-z0-9_-]*)(?::(\{[^\r\n]*?\}|[^\]\r\n]*))?\]`;

/** A fresh global regex per call — a shared one carries `lastIndex` between callers. */
export function createCapabilityCommandTagRegex(): RegExp {
  return new RegExp(CAPABILITY_COMMAND_TAG_PATTERN, "gi");
}

export function parseCapabilityConversationCommands(content: string) {
  const commands: Array<{ type: "capability"; commandType: string; payload: string | null }> = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(createCapabilityCommandTagRegex())) {
    const commandType = tagToCommandType.get(match[1]!.toLocaleLowerCase());
    if (!commandType || seen.has(commandType)) continue;
    seen.add(commandType);
    const rawPayload = match[2]?.trim() || null;
    const maxPayloadChars = payloadLimitsByCommandType.get(commandType) ?? 2_000;
    const payload = rawPayload && rawPayload.length <= maxPayloadChars ? rawPayload : null;
    commands.push({
      type: "capability",
      commandType,
      payload: validatorsByCommandType.get(commandType)?.(payload) === false ? null : payload,
    });
  }
  return commands;
}

export async function dispatchCapabilityConversationAction(
  action: CapabilityConversationAction,
  claim?: () => Promise<boolean>,
): Promise<boolean> {
  if (currentRoomGeneration()) return false;
  const handler = handlersByCommandType.get(action.commandType);
  if (!handler) return false;
  const actionKey = `${action.branchChatId}:${action.sourceMessageId}:${action.swipeIndex}:${action.commandType}`;
  if (dispatchedActions.has(actionKey)) return false;
  dispatchedActions.add(actionKey);
  try {
    await handler(action);
    return !claim || (await claim());
  } finally {
    // In-flight keys serialize local dispatches; neither failures nor completed actions remain resident.
    dispatchedActions.delete(actionKey);
  }
}

export function stripCapabilityConversationCommands(content: string) {
  return content.replace(createCapabilityCommandTagRegex(), (match, tag: string) =>
    tagToCommandType.has(tag.toLocaleLowerCase()) ? "" : match,
  );
}
