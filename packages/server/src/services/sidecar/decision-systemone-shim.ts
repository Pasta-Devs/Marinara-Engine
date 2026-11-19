/**
 * A small `/v1/systemone` front for decision servers that do not speak it the way the
 * rest of Marinara asks.
 *
 * Everything that asks a decision model (gates, the Illustrator checks, the Test
 * button, the warm-up) sends a System One request to the decision slot's address. Two
 * of the GGUF runtimes need something in between:
 *
 * - `letters` (JevK5): a plain GGUF on a stock llama-server. The question goes in as
 *   JevK5's own prompt, the server evaluates it without generating, and the answer is
 *   read from the option letters' log-probabilities under the authors' temperature.
 *   This is a port of `jevk5/prompt.py` and `jevk5/gguf.py` at v0.3.0 (Apache-2.0),
 *   token for token, so the numbers match the authors' own llama.cpp path.
 * - `text-state` (Valen): Valen's server accepts a state that is text or a chat-message
 *   list, and refuses any other object. Marinara's state is an object, so it is sent as
 *   its JSON text, which is also what llama.cpp's own server does with an object. A
 *   state that carries pictures already arrives as a chat-message list and passes as is.
 *
 * It listens on loopback only, on a port the system picks, and forwards only to the
 * one server it was made for.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { logger } from "../../lib/logger.js";

export type DecisionShimMode =
  { kind: "letters"; temperature: number; knockoutTemperature: number } | { kind: "text-state" };

const LETTERS = "ABCDEFGHIJKLMNOP";
const SYSTEM =
  "Apply the supplied criterion to the supplied evidence. Choose exactly one listed option. " +
  "Respond with only its uppercase letter, with no explanation or reasoning.";
/** Qwen3.5's template with thinking off, as JevK5 pins it. */
const chatTemplate = (system: string, user: string) =>
  `<|im_start|>system\n${system}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n`;
/** A letter outside the returned top-k sits at least this far below the last one. */
const MISSING_MARGIN = 2.0;
const TOP_K = 40;
/** Room for three scaled pictures beside a long scene. */
const MAX_BODY_BYTES = 16 * 1024 * 1024;

function isMessageState(state: unknown): boolean {
  return (
    !!state &&
    typeof state === "object" &&
    Array.isArray((state as { messages?: unknown }).messages) &&
    Object.keys(state).length === 1
  );
}

/**
 * `json.dumps(value, ensure_ascii=False)` as Python writes it: a space after every
 * comma and colon. JevK5 was trained on that text, and `JSON.stringify` leaves the
 * spaces out, which would be a different token sequence for every request.
 */
export function pythonJsonDumps(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "null";
    // Python writes a float that is whole as `1.0`; Marinara's state holds integers
    // there, which Python also writes without a decimal point.
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return `[${value.map(pythonJsonDumps).join(", ")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined);
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}: ${pythonJsonDumps(item)}`).join(", ")}}`;
  }
  return "null";
}

type Question = { type?: unknown; instructions?: unknown; criteria?: unknown };

/** (option id, option text) for a typed question, as `decision_options` builds them. */
export function letterOptions(question: Question): Array<[string, string]> {
  const criteria = question.criteria;
  let pairs: Array<[string, string]>;
  if (question.type === "noul") {
    const described =
      criteria && typeof criteria === "object" && !Array.isArray(criteria) ? (criteria as Record<string, unknown>) : {};
    pairs = (["true", "false"] as const).map((key) => [
      key,
      typeof described[key] === "string" && described[key] ? (described[key] as string) : `The proposition is ${key}.`,
    ]);
  } else if (question.type === "choice") {
    const map: Record<string, unknown> = Array.isArray(criteria)
      ? Object.fromEntries(criteria.map((key) => [String(key), null]))
      : criteria && typeof criteria === "object"
        ? (criteria as Record<string, unknown>)
        : {};
    pairs = Object.entries(map).map(([key, description]) => [
      key,
      typeof description === "string" && description ? description : key,
    ]);
  } else if (question.type === "score" && Array.isArray(criteria)) {
    pairs = criteria.map((level, index) => [String(index), String(level)]);
  } else {
    throw new Error("Unsupported question");
  }
  if (pairs.length < 2) throw new Error("A question needs at least two options");
  return pairs.map(([key, text]) => [key, `${key}: ${text}`]);
}

export function letterPrompt(state: unknown, criterion: unknown, options: string[]): string {
  const user = pythonJsonDumps({
    evidence: state,
    criterion,
    options: options.map((description, index) => ({ letter: LETTERS[index], description })),
  });
  return chatTemplate(SYSTEM, user);
}

/** The calibrated distribution over up to 16 lettered options, from the top log-probabilities. */
export function readLetters(seen: Map<string, number>, count: number, temperature: number): number[] {
  const floor = (seen.size > 0 ? Math.min(...seen.values()) : 0) - MISSING_MARGIN;
  const logprobs = Array.from({ length: count }, (_, index) => seen.get(LETTERS[index]!) ?? floor);
  const top = Math.max(...logprobs);
  const weights = logprobs.map((value) => Math.exp((value - top) / temperature));
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((value) => value / total);
}

type Reader = (texts: string[]) => Promise<number[]>;

function groups(n: number, count: number): number[][] {
  const base = Math.floor(n / count);
  const extra = n % count;
  const runs: number[][] = [];
  let start = 0;
  for (let group = 0; group < count; group += 1) {
    const stop = start + base + (group < extra ? 1 : 0);
    runs.push(Array.from({ length: stop - start }, (_, index) => start + index));
    start = stop;
  }
  return runs;
}

async function combine(read: Reader, texts: string[]): Promise<number[]> {
  if (texts.length <= LETTERS.length) return read(texts);
  const weights = await knockout(read, texts);
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((value) => value / total);
}

/** `_knockout` from jevk5/prompt.py: read each group, then a final of the best of each. */
async function knockout(read: Reader, texts: string[]): Promise<number[]> {
  const runs = groups(texts.length, Math.ceil(texts.length / LETTERS.length));
  const inner: number[][] = [];
  for (const run of runs) {
    const probs = await read(run.map((index) => texts[index]!));
    const sum = probs.reduce((total, value) => total + value, 0);
    inner.push(probs.map((value) => value / sum));
  }
  const keep = Math.max(1, Math.floor(LETTERS.length / runs.length));
  const ranked = inner.map((probs) =>
    probs.map((_, index) => index).sort((left, right) => probs[right]! - probs[left]!),
  );
  const chosen = new Set<string>();
  ranked.forEach((order, group) => order.slice(0, keep).forEach((index) => chosen.add(`${group}:${index}`)));
  const rest = ranked
    .flatMap((order, group) => order.slice(keep).map((index) => [group, index] as const))
    .sort((left, right) => inner[right[0]]![right[1]]! - inner[left[0]]![left[1]]!);
  for (const [group, index] of rest.slice(0, Math.max(0, LETTERS.length - chosen.size)))
    chosen.add(`${group}:${index}`);
  const tops = runs.map((_, group) =>
    [...chosen]
      .map((entry) => entry.split(":").map(Number) as [number, number])
      .filter(([owner]) => owner === group)
      .map(([, index]) => index)
      .sort((left, right) => left - right),
  );
  const final = await combine(
    read,
    runs.flatMap((run, group) => tops[group]!.map((index) => texts[run[index]!]!)),
  );
  const shares: Array<Map<number, number>> = [];
  let at = 0;
  for (const top of tops) {
    shares.push(new Map(top.map((index, offset) => [index, final[at + offset]!])));
    at += top.length;
  }
  const inFinal = inner.reduce((total, probs, group) => {
    const share = shares[group]!;
    const mass = [...share.values()].reduce((sum, value) => sum + value, 0);
    return total + mass * [...share.keys()].reduce((sum, index) => sum + probs[index]!, 0);
  }, 0);
  const weights: number[] = [];
  inner.forEach((probs, group) => {
    const share = shares[group]!;
    const mass = [...share.values()].reduce((sum, value) => sum + value, 0);
    probs.forEach((value, index) => weights.push(share.has(index) ? share.get(index)! * inFinal : mass * value));
  });
  return weights;
}

/** `spread` with the knockout method and its sharpening temperature. */
export async function spreadLetters(read: Reader, texts: string[], knockoutTemperature: number): Promise<number[]> {
  if (texts.length <= LETTERS.length) return read(texts);
  let probs = await combine(read, texts);
  if (knockoutTemperature !== 1) {
    probs = probs.map((value) => value ** (1 / knockoutTemperature));
    const total = probs.reduce((sum, value) => sum + value, 0);
    probs = probs.map((value) => value / total);
  }
  return probs;
}

function answerShape(question: Question, probabilities: Record<string, number>): Record<string, unknown> {
  const values = Object.values(probabilities);
  const confidence = Math.max(...values);
  if (question.type === "noul") return { type: "noul", noul: probabilities.true ?? 0, confidence };
  if (question.type === "choice") {
    const choice = Object.entries(probabilities).sort((left, right) => right[1] - left[1])[0]![0];
    return { type: "choice", choice, probabilities, confidence };
  }
  const score = Object.entries(probabilities).reduce((sum, [key, value]) => sum + Number(key) * value, 0);
  return { type: "score", score, probabilities, confidence };
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("Request too large");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

function send(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return;
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(text) });
  res.end(text);
}

export class DecisionSystemOneShim {
  private server: Server | null = null;
  private port: number | null = null;

  constructor(
    private readonly upstream: string,
    private readonly mode: DecisionShimMode,
  ) {}

  get baseUrl(): string | null {
    return this.port ? `http://127.0.0.1:${this.port}` : null;
  }

  async start(): Promise<string> {
    const server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    this.server = server;
    this.port = (server.address() as AddressInfo).port;
    return this.baseUrl!;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.port = null;
    if (!server) return;
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const abort = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) abort.abort();
    });
    try {
      const path = (req.url ?? "").split("?")[0];
      if (req.method === "GET" && path === "/health") {
        const upstream = await fetch(`${this.upstream}/health`, { signal: AbortSignal.timeout(3000) });
        send(res, upstream.ok ? 200 : 503, { status: upstream.ok ? "ok" : "unavailable" });
        return;
      }
      if (req.method !== "POST" || path !== "/v1/systemone") {
        send(res, 404, { error: "Not found" });
        return;
      }
      const body = (await readBody(req)) as { state?: unknown; questions?: unknown };
      if (!body || typeof body !== "object" || !body.questions || typeof body.questions !== "object") {
        send(res, 400, { error: "questions is required" });
        return;
      }
      if (this.mode.kind === "text-state") {
        const forwarded = {
          ...body,
          // A chat-message state (one carrying pictures) is already Valen's own shape.
          state:
            typeof body.state === "string" || isMessageState(body.state)
              ? body.state
              : JSON.stringify(body.state ?? null),
        };
        const upstream = await fetch(`${this.upstream}/v1/systemone`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(forwarded),
          signal: abort.signal,
        });
        const text = await upstream.text();
        res.writeHead(upstream.status, { "Content-Type": "application/json" });
        res.end(text);
        return;
      }
      await this.answerWithLetters(body.state, body.questions as Record<string, Question>, res, abort.signal);
    } catch (error) {
      if (abort.signal.aborted) return;
      const message = error instanceof Error ? error.message : "Decision request failed";
      logger.debug({ err: error }, "[decision-shim] Request failed");
      send(res, error instanceof SyntaxError ? 400 : 502, { error: message });
    }
  }

  private async answerWithLetters(
    state: unknown,
    questions: Record<string, Question>,
    res: ServerResponse,
    signal: AbortSignal,
  ): Promise<void> {
    const mode = this.mode as Extract<DecisionShimMode, { kind: "letters" }>;
    const answers: Record<string, unknown> = {};
    let inputTokens = 0;
    // One question at a time: the server is serial, and the state comes first in every
    // prompt, so its prompt cache carries the shared part from one question to the next.
    for (const [id, question] of Object.entries(questions)) {
      let options: Array<[string, string]>;
      try {
        options = letterOptions(question);
      } catch (error) {
        send(res, 400, { error: error instanceof Error ? error.message : "Bad question" });
        return;
      }
      const read: Reader = async (texts) => {
        const prompt = letterPrompt(state, question.instructions, texts);
        const tokenized = (await (
          await fetch(`${this.upstream}/tokenize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Special tokens parsed: a prompt string sent to /completion is plain text,
            // which would split <|im_start|> into characters.
            body: JSON.stringify({ content: prompt, add_special: false, parse_special: true }),
            signal,
          })
        ).json()) as { tokens?: number[] };
        if (!Array.isArray(tokenized.tokens)) throw new Error("Tokenize failed");
        const response = await fetch(`${this.upstream}/completion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: tokenized.tokens,
            n_predict: 1,
            n_probs: TOP_K,
            temperature: 0,
            cache_prompt: true,
          }),
          signal,
        });
        if (!response.ok) throw new Error(`The model server answered ${response.status}`);
        const result = (await response.json()) as {
          tokens_evaluated?: number;
          completion_probabilities?: Array<{ top_logprobs?: Array<{ token?: string; logprob?: number }> }>;
        };
        inputTokens += result.tokens_evaluated ?? 0;
        const seen = new Map<string, number>();
        for (const entry of result.completion_probabilities?.[0]?.top_logprobs ?? []) {
          if (typeof entry.token === "string" && typeof entry.logprob === "number" && !seen.has(entry.token))
            seen.set(entry.token, entry.logprob);
        }
        return readLetters(seen, texts.length, mode.temperature);
      };
      const probs = await spreadLetters(
        read,
        options.map(([, text]) => text),
        mode.knockoutTemperature,
      );
      answers[id] = answerShape(question, Object.fromEntries(options.map(([key], index) => [key, probs[index]!])));
    }
    send(res, 200, { answers, usage: { input_tokens: inputTokens, output_tokens: 0 } });
  }
}
