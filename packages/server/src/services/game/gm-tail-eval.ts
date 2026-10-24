/**
 * The GM turn-tail caching eval (not a shipped setting).
 *
 * Today the whole format reminder is rebuilt after the history every turn, so a provider can cache
 * only the system prompt and the history. A chat whose metadata sets `gmTailLayout` tries the
 * other layouts the proposal compares:
 *
 * - "split": the instructions that hold for the whole game are written into the system prompt,
 *   and the turn reminder keeps only what changes (Phase A).
 * - "split-history": as "split", and the party's sheets and inventory are written into the
 *   history a few messages back instead of the reminder (Phase B, simulated: a built version
 *   would write a checkpoint when they change).
 *
 * With MARINARA_GM_TAIL_EVAL_DIR set, each game turn's provider messages, raw reply and usage are
 * written there as one JSON file, so the eval can score the reply and read the cached tokens.
 */
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

export type GmTailLayout = "legacy" | "split" | "split-history";

export function gmTailLayoutOf(metadata: Record<string, unknown>): GmTailLayout {
  const value = metadata.gmTailLayout;
  return value === "split" || value === "split-history" ? value : "legacy";
}

/** How many history messages back the simulated checkpoint sits. */
export function gmTailCheckpointDepthOf(metadata: Record<string, unknown>): number {
  const value = Number(metadata.gmTailCheckpointDepth);
  return Number.isInteger(value) && value >= 0 ? value : 4;
}

type PromptMessage = { role: string; content: string };

/**
 * The stable instructions go into the first system message, before any lore written after the
 * GM's own prompt, so lore that comes and goes leaves them in the cached prefix.
 */
export function insertStableGmInstructions<M extends PromptMessage>(
  messages: M[],
  stable: string,
  loreAfter: string,
): void {
  const text = stable.trim();
  if (!text) return;
  const system = messages.find((message) => message.role === "system");
  if (!system) {
    messages.unshift({ role: "system", content: text } as M);
    return;
  }
  const at = loreAfter ? system.content.lastIndexOf(loreAfter) : -1;
  system.content =
    at < 0 ? `${system.content}\n\n${text}` : `${system.content.slice(0, at)}${text}\n\n${system.content.slice(at)}`;
}

/**
 * The party's sheets and inventory, appended to the player message `depth` history messages back
 * (or the oldest one there is). A user message keeps it in the history on every provider: a
 * system row there is lifted into the system prompt by some of them.
 */
export function insertPartyStateCheckpoint<M extends PromptMessage>(
  messages: M[],
  partyState: string,
  depth: number,
): void {
  const text = partyState.trim();
  if (!text) return;
  const block = `<party_state>\nThe party's character sheets and belongings as of this point. The turn reminder says if anything changed since.\n${text}\n</party_state>`;
  const userIndexes = messages.flatMap((message, index) => (message.role === "user" ? [index] : []));
  if (userIndexes.length === 0) return;
  const cutoff = messages.length - depth;
  const target = [...userIndexes].reverse().find((index) => index <= cutoff) ?? userIndexes[0]!;
  const message = messages[target]!;
  message.content = `${message.content}\n\n${block}`;
}

export async function recordGmTailEvalTurn(record: {
  chatId: string;
  layout: GmTailLayout;
  model: string;
  messages: ReadonlyArray<PromptMessage>;
  response: string;
  thinking?: string;
  usage?: unknown;
  finishReason?: string;
  durationMs?: number;
}): Promise<void> {
  const dir = process.env.MARINARA_GM_TAIL_EVAL_DIR?.trim();
  if (!dir) return;
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await writeFile(
    join(dir, `${stamp}-${record.chatId}.json`),
    JSON.stringify({ ...record, recordedAt: new Date().toISOString() }, null, 2),
  );
}
