// Structured-tool error text.
//
// Mari's `app_data` surface is repaired by the model reading the error, so the text is the
// documentation a small model gets at the moment it is wrong. Every message follows one order:
//
//   <action>: <what is wrong> (<what arrived>). <where it goes / accepted shape>.
//
// Text only: nothing here validates, dispatches or changes what is accepted.

import { AsyncLocalStorage } from "node:async_hooks";

const MAX_ECHO = 80;

// #7999: an argument the tool used differently than sent (a limit lowered to its maximum,
// an offset past the end) is still answered, but the result has to say so, or a cut-off
// page reads as a whole one. One tool call collects its notes; the caller prints them.
const argumentNotes = new AsyncLocalStorage<string[]>();

export function collectArgumentNotes<T>(notes: string[], run: () => Promise<T>): Promise<T> {
  return argumentNotes.run(notes, run);
}

/** A call nobody collects for (the `mari db` route, a direct service call) carries its own notes. */
export async function withArgumentNotes<T extends { notes?: string[] }>(run: () => Promise<T>): Promise<T> {
  if (argumentNotes.getStore()) return run();
  const notes: string[] = [];
  const result = await argumentNotes.run(notes, run);
  return notes.length ? { ...result, notes } : result;
}

export function noteArgument(message: string): void {
  const notes = argumentNotes.getStore();
  if (notes && !notes.includes(message)) notes.push(message);
}

/** A short, safe rendering of what the caller actually sent. Never dumps a payload. */
export function describeReceived(value: unknown): string {
  if (value === undefined) return "none was sent";
  if (value === null) return "null was sent";
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return "an empty string was sent";
    return `got ${JSON.stringify(text.length > MAX_ECHO ? `${text.slice(0, MAX_ECHO)}…` : text)}`;
  }
  if (typeof value === "number" || typeof value === "boolean") return `got ${JSON.stringify(value)}`;
  if (Array.isArray(value)) return `got an array of ${value.length}`;
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).slice(0, 6);
    return `got an object with keys ${keys.join(", ") || "(none)"}`;
  }
  return `got ${typeof value}`;
}

/** Levenshtein distance, capped: only used to suggest a near-miss action name. */
function distance(a: string, b: string): number {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [
    index,
    ...Array(right.length).fill(0),
  ]) as number[][];
  for (let column = 1; column <= right.length; column += 1) rows[0]![column] = column;
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row]![column] = Math.min(
        rows[row - 1]![column]! + 1,
        rows[row]![column - 1]! + 1,
        rows[row - 1]![column - 1]! + cost,
      );
    }
  }
  return rows[left.length]![right.length]!;
}

function nearest(received: string, valid: readonly string[]): string | null {
  let best: { name: string; score: number } | null = null;
  for (const name of valid) {
    const score = distance(received, name);
    if (!best || score < best.score) best = { name, score };
  }
  // "gets" → "get" is one edit; "character.creat" → "character.create" is one too.
  return best && best.score <= 2 ? best.name : null;
}

/** A required field is missing: name it, echo what arrived, and show where it belongs. */
export function needArg(
  action: string,
  field: string,
  options: { aliases?: readonly string[]; received?: unknown; where?: string; shape?: string } = {},
): never {
  const names = [field, ...(options.aliases ?? [])].map((name) => `"${name}"`).join(" or ");
  const where = options.where ?? 'top-level, or inside "data"';
  const shape = options.shape ? ` ${options.shape}` : "";
  throw new Error(
    `${action} needs a non-empty ${names} (${describeReceived(options.received)}) — pass it ${where}.${shape}`,
  );
}

/** An action name did not match: echo it, suggest the nearest valid one, list them. */
export function unknownActionMessage(scope: string, received: string, valid: readonly string[]): string {
  // A model-written name has no length limit: compare and echo only its first MAX_ECHO characters.
  const shown = received.length > MAX_ECHO ? `${received.slice(0, MAX_ECHO)}…` : received;
  const suggestion = received.length > MAX_ECHO ? null : nearest(received, valid);
  const hint = suggestion ? ` Did you mean "${suggestion}"?` : "";
  return `Unknown ${scope} action "${shown}".${hint} Valid actions: ${valid.join(", ")}.`;
}

export function unknownAction(scope: string, received: string, valid: readonly string[]): never {
  throw new Error(unknownActionMessage(scope, received, valid));
}

/** An enum value is outside its set: it already names the field and the received value. */
export function badEnum(field: string, allowed: readonly string[], received: unknown): never {
  throw new Error(`"${field}" must be one of ${allowed.join(", ")} (${describeReceived(received)}).`);
}

/** A lookup missed: name the kind and the id, say ids are generated, and point at the finder. */
export function missingRecord(kind: string, id: string, lookup: string): Error {
  // Model-written, like an action name: quote it and cap it so the finder hint stays on one short line.
  const shown = JSON.stringify(id.length > MAX_ECHO ? `${id.slice(0, MAX_ECHO)}…` : id);
  return new Error(
    `No ${kind} has the id ${shown}. ${kind} ids are generated, never a name or slug; find the record with ${lookup} and send the "id" it returns.`,
  );
}
