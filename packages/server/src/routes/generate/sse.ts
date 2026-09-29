import type { FastifyReply } from "fastify";

type SsePayload = Record<string, unknown>;

/** Internal generation events are privileged data, not a peer protocol. */
export interface GenerationEventSink {
  readonly kind: "generation-event-sink";
  readonly ended: boolean;
  readonly started: boolean;
  start(headers: Record<string, string>): void;
  emit(payload: SsePayload): boolean;
  header(name: string, value: string): void;
  finish(statusCode: number, body?: unknown): void;
}

export type GenerationOutput = FastifyReply | GenerationEventSink;

export function createGenerationEventSink(callbacks: {
  onEvent(payload: SsePayload): void;
  onFinish(result: { statusCode: number; headers: Record<string, string>; body?: unknown }): void;
}): GenerationEventSink {
  let ended = false;
  let started = false;
  const headers: Record<string, string> = {};
  return {
    kind: "generation-event-sink",
    get ended() {
      return ended;
    },
    get started() {
      return started;
    },
    start(values) {
      if (ended) return;
      Object.assign(headers, values);
      started = true;
    },
    emit(payload) {
      if (ended) return false;
      callbacks.onEvent(payload);
      return true;
    },
    header(name, value) {
      if (!started && !ended) headers[name] = value;
    },
    finish(statusCode, body) {
      if (ended) return;
      ended = true;
      callbacks.onFinish({ statusCode, headers: { ...headers }, ...(body === undefined ? {} : { body }) });
    },
  };
}

function isEventSink(reply: GenerationOutput): reply is GenerationEventSink {
  return "kind" in reply && reply.kind === "generation-event-sink";
}

export function isSseReplyWritable(reply: GenerationOutput): boolean {
  if (isEventSink(reply)) return !reply.ended;
  return !reply.raw.destroyed && !reply.raw.writableEnded && !reply.raw.writableFinished;
}

export function startSseReply(reply: GenerationOutput, extraHeaders: Record<string, string> = {}) {
  if (isEventSink(reply)) return reply.start(extraHeaders);
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Connection: "keep-alive",
    ...extraHeaders,
  });
}

export function startSseKeepalive(reply: GenerationOutput, intervalMs = 15_000): () => void {
  if (isEventSink(reply)) return () => {};
  const timer = setInterval(() => {
    try {
      if (isSseReplyWritable(reply)) {
        reply.raw.write(": keepalive\n\n");
      }
    } catch {
      // Ignore writes after the client disconnects.
    }
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

export function sendSseEvent(reply: GenerationOutput, payload: SsePayload): boolean {
  if (!isSseReplyWritable(reply)) return false;
  try {
    if (isEventSink(reply)) return reply.emit(payload);
    return reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    return false;
  }
}

export function endGenerationOutput(reply: GenerationOutput): void {
  if (isEventSink(reply)) reply.finish(200);
  else reply.raw.end();
}

export function rejectGenerationOutput(reply: GenerationOutput, statusCode: number, body: unknown): unknown {
  if (isEventSink(reply)) return reply.finish(statusCode, body);
  return reply.status(statusCode).send(body);
}

/** Internal jobs outlive an individual viewer; only the HTTP adapter observes passive disconnects. */
export function onGenerationOutputClose(reply: GenerationOutput, listener: () => void): () => void {
  if (isEventSink(reply)) return () => {};
  reply.raw.on("close", listener);
  return () => {
    reply.raw.off("close", listener);
  };
}

export function generationOutputStarted(reply: GenerationOutput): boolean {
  return isEventSink(reply) ? reply.started : reply.raw.headersSent;
}

export function setGenerationOutputHeader(reply: GenerationOutput, name: string, value: string): void {
  if (generationOutputStarted(reply)) return;
  reply.header(name, value);
}
