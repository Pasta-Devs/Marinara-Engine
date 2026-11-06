import {
  PERSONAL_EXTENSION_DICE_LIMITS,
  PERSONAL_EXTENSION_UI_LIMITS,
  isKeptDice,
  rollDieSecurely,
  type DieRoller,
  type PersonalClientExtensionRuntime,
  type PersonalExtensionDiceFormatDescriptor,
} from "@marinara-engine/shared";

/**
 * Dice formats that sandboxed Browser Extensions register with `marinara.dice.registerFormat`.
 * The extension reads a notation and names the dice to throw; Marinara throws them here with
 * its own roller and sends the faces back for the extension to read. The extension never
 * chooses a face, and everything it sends back is checked again on this side.
 */

type HostDiceFormat = PersonalExtensionDiceFormatDescriptor & {
  extensionId: string;
  extensionName: string;
  contentHash: string;
};

type DiceDispatcher = {
  contentHash: string;
  send: (message: Record<string, unknown>) => void;
};

type PendingDiceRequest = {
  extensionId: string;
  contentHash: string;
  expects: "dice-parse-result" | "dice-read-result";
  resolve: (message: Record<string, unknown> | null) => void;
  timer: ReturnType<typeof setTimeout>;
};

/** A roll an extension format read: the faces are Marinara's, the total and text the extension's. */
export interface PersonalExtensionDiceRoll {
  notation: string;
  formatLabel: string;
  extensionName: string;
  /** The sides of each die thrown, in throw order. */
  dice: number[];
  rolls: number[];
  total: number;
  text?: string;
  kept?: number[];
}

const FORMAT_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const dispatchers = new Map<string, DiceDispatcher>();
const pending = new Map<string, PendingDiceRequest>();
let formats: HostDiceFormat[] = [];
let nextRequest = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

/** An optional text field: absent when missing or blank, null only when it is not text or too long. */
function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.length > maxLength) return null;
  return text || undefined;
}

function normalizeFormat(value: unknown): PersonalExtensionDiceFormatDescriptor | null {
  if (!isRecord(value)) return null;
  const id = boundedText(value.id, PERSONAL_EXTENSION_UI_LIMITS.idLength);
  const label = boundedText(value.label, PERSONAL_EXTENSION_UI_LIMITS.labelLength);
  if (!id || !FORMAT_ID_PATTERN.test(id) || !label) return null;
  const description = optionalText(value.description, PERSONAL_EXTENSION_UI_LIMITS.descriptionLength);
  if (description === null) return null;
  return { id, label, ...(description ? { description } : {}) };
}

export function setPersonalExtensionDiceDispatcher(
  extension: PersonalClientExtensionRuntime,
  send: (message: Record<string, unknown>) => void,
) {
  dispatchers.set(extension.id, { contentHash: extension.contentHash, send });
}

export function registerPersonalExtensionDiceFormat(extension: PersonalClientExtensionRuntime, value: unknown) {
  const format = normalizeFormat(value);
  if (!format) return false;
  const own = formats.filter((candidate) => candidate.extensionId === extension.id);
  if (own.some((candidate) => candidate.id === format.id)) return false;
  if (own.length >= PERSONAL_EXTENSION_DICE_LIMITS.formatsPerExtension) return false;
  formats = [
    ...formats,
    { ...format, extensionId: extension.id, extensionName: extension.name, contentHash: extension.contentHash },
  ];
  return true;
}

export function removePersonalExtensionDiceFormat(extensionId: string, contentHash: string, formatId: unknown) {
  formats = formats.filter(
    (format) => !(format.extensionId === extensionId && format.contentHash === contentHash && format.id === formatId),
  );
}

/** Forget an extension's formats and answer its open requests with nothing, as when it stops. */
export function removePersonalExtensionDiceFormats(extensionId: string) {
  formats = formats.filter((format) => format.extensionId !== extensionId);
  dispatchers.delete(extensionId);
  for (const [requestId, request] of pending) {
    if (request.extensionId !== extensionId) continue;
    pending.delete(requestId);
    clearTimeout(request.timer);
    request.resolve(null);
  }
}

export function listPersonalExtensionDiceFormats(): readonly HostDiceFormat[] {
  return formats;
}

/** Hand a sandbox's `dice-parse-result` or `dice-read-result` to the request waiting for it. */
export function resolvePersonalExtensionDiceResponse(
  extension: Pick<PersonalClientExtensionRuntime, "id">,
  contentHash: string,
  message: Record<string, unknown>,
) {
  const requestId = typeof message.requestId === "string" ? message.requestId : null;
  const request = requestId ? pending.get(requestId) : undefined;
  if (
    !requestId ||
    !request ||
    request.extensionId !== extension.id ||
    request.contentHash !== contentHash ||
    request.expects !== message.type
  ) {
    return;
  }
  pending.delete(requestId);
  clearTimeout(request.timer);
  request.resolve(message);
}

function requestFromFormat(
  format: HostDiceFormat,
  message: Record<string, unknown> & { type: "dice-parse" | "dice-read" },
  requestId: string,
): Promise<Record<string, unknown> | null> {
  const dispatcher = dispatchers.get(format.extensionId);
  if (!dispatcher || dispatcher.contentHash !== format.contentHash) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      resolve(null);
    }, PERSONAL_EXTENSION_DICE_LIMITS.responseTimeoutMs);
    pending.set(requestId, {
      extensionId: format.extensionId,
      contentHash: format.contentHash,
      expects: message.type === "dice-parse" ? "dice-parse-result" : "dice-read-result",
      resolve,
      timer,
    });
    dispatcher.send({ ...message, requestId, contentHash: format.contentHash });
  });
}

function readThrowPlan(message: Record<string, unknown> | null): number[] | null {
  if (!message || message.ok !== true || !Array.isArray(message.dice)) return null;
  const dice = message.dice;
  if (dice.length < 1 || dice.length > PERSONAL_EXTENSION_DICE_LIMITS.dice) return null;
  return dice.every(
    (sides) =>
      Number.isSafeInteger(sides) &&
      sides >= PERSONAL_EXTENSION_DICE_LIMITS.minSides &&
      sides <= PERSONAL_EXTENSION_DICE_LIMITS.maxSides,
  )
    ? (dice as number[])
    : null;
}

/**
 * Roll `notation` through the first extension format that reads it, asking each in the order
 * they were registered. Null when no format reads it, or the one that does fails or is too slow.
 */
export async function rollWithPersonalExtensionDiceFormats(
  notation: string,
  roll: DieRoller = rollDieSecurely,
): Promise<PersonalExtensionDiceRoll | null> {
  if (!notation || notation.length > PERSONAL_EXTENSION_DICE_LIMITS.notationLength) return null;
  for (const format of [...formats]) {
    const requestId = `dice-${++nextRequest}`;
    const dice = readThrowPlan(
      await requestFromFormat(format, { type: "dice-parse", formatId: format.id, notation }, requestId),
    );
    if (!dice) continue;
    const rolls = dice.map((sides) => roll(sides));
    const read = await requestFromFormat(format, { type: "dice-read", rolls }, requestId);
    if (!read || read.ok !== true || typeof read.total !== "number" || !Number.isFinite(read.total)) return null;
    const text = optionalText(read.text, PERSONAL_EXTENSION_DICE_LIMITS.textLength);
    if (text === null) return null;
    if (read.kept !== undefined && !isKeptDice(read.kept, rolls.length)) return null;
    return {
      notation,
      formatLabel: format.label,
      extensionName: format.extensionName,
      dice,
      rolls,
      total: read.total,
      ...(text ? { text } : {}),
      ...(read.kept !== undefined ? { kept: read.kept as number[] } : {}),
    };
  }
  return null;
}
