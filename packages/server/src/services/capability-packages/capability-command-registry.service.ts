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
const dispatchedActions = new Set<string>();

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
  return () => {
    for (const tag of tags) {
      if (tagToCommandType.get(tag) === commandType) tagToCommandType.delete(tag);
    }
    if (handlersByCommandType.get(commandType) === registration.handler) handlersByCommandType.delete(commandType);
    payloadLimitsByCommandType.delete(commandType);
    descriptionsByCommandType.delete(commandType);
    validatorsByCommandType.delete(commandType);
  };
}

export function listCapabilityConversationCommandInstructions(): string[] {
  return Array.from(
    descriptionsByCommandType,
    ([commandType, details]) =>
      `- [${commandType}:<JSON payload>] — ${details.description} Example: [${commandType}:${details.payloadExample}]`,
  );
}

export function parseCapabilityConversationCommands(content: string) {
  const commands: Array<{ type: "capability"; commandType: string; payload: string | null }> = [];
  const seen = new Set<string>();
  // A JSON payload can itself contain `]` (a note body, an array), so the payload group matches a
  // `{…}` brace run before falling back to bracket-free text. Lazy so two commands on one line stay
  // separate. ponytail: flat objects only — a nested `}` ends the match early; upgrade to a real
  // scanner if payloads ever nest.
  for (const match of content.matchAll(/\[([a-z][a-z0-9_-]*)(?::(\{[^\r\n]*?\}|[^\]\r\n]*))?\]/gi)) {
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
  return content.replace(/\[([a-z][a-z0-9_-]*)(?::(?:\{[^\r\n]*?\}|[^\]\r\n]*))?\]/gi, (match, tag: string) =>
    tagToCommandType.has(tag.toLocaleLowerCase()) ? "" : match,
  );
}
