/**
 * Keeps one derived value per message, so a pass over a long game only rebuilds the messages that
 * changed. A value is reused while its message has the same fields, the same per-message `extra`
 * values and the pass runs with the same `inputs`. Any change to `inputs` drops every value.
 *
 * Call `begin` at the start of each pass and `end` after it: `end` forgets messages the pass did
 * not ask for, so deleted or unloaded messages do not stay in memory.
 */
export class MessageMemo<M extends { id: string }, T> {
  private inputs: readonly unknown[] | null = null;
  private entries = new Map<string, { message: M; extra: readonly unknown[]; value: T }>();
  private seen = new Set<string>();

  begin(inputs: readonly unknown[]): void {
    if (!this.inputs || !sameValues(this.inputs, inputs)) this.entries.clear();
    this.inputs = inputs;
    this.seen = new Set();
  }

  get(message: M, extra: readonly unknown[], build: () => T): T {
    this.seen.add(message.id);
    const cached = this.entries.get(message.id);
    if (cached && sameFields(cached.message, message) && sameValues(cached.extra, extra)) return cached.value;
    const value = build();
    this.entries.set(message.id, { message, extra, value });
    return value;
  }

  end(): void {
    for (const id of this.entries.keys()) if (!this.seen.has(id)) this.entries.delete(id);
  }
}

function sameValues(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

/** Messages are rebuilt as new objects on every refetch and stream chunk, so compare their fields. */
function sameFields<M extends object>(a: M, b: M): boolean {
  if (a === b) return true;
  const keys = Object.keys(a) as Array<keyof M>;
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => Object.is(a[key], b[key]));
}
