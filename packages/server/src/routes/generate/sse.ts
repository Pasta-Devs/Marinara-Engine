import type { FastifyReply } from "fastify";
import { reportDiagnosticError } from "../../lib/diagnostic-operation.js";
import { sanitizeDiagnosticText } from "../../lib/diagnostics.js";

type SsePayload = Record<string, unknown>;

export function isSseReplyWritable(reply: FastifyReply): boolean {
  return !reply.raw.destroyed && !reply.raw.writableEnded && !reply.raw.writableFinished;
}

export function startSseReply(reply: FastifyReply, extraHeaders: Record<string, string> = {}) {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Connection: "keep-alive",
    ...extraHeaders,
  });
}

export function startSseKeepalive(reply: FastifyReply, intervalMs = 15_000): () => void {
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

export function sendSseEvent(reply: FastifyReply, payload: SsePayload): boolean {
  let event = payload;
  const isFailedAgentResult =
    payload.type === "agent_result" &&
    payload.data &&
    typeof payload.data === "object" &&
    !Array.isArray(payload.data) &&
    (payload.data as Record<string, unknown>).success === false;
  if (payload.type === "error" || payload.type === "agent_error" || isFailedAgentResult) {
    const rawData = payload.data;
    const supplied =
      rawData && typeof rawData === "object" && !Array.isArray(rawData)
        ? (rawData as Record<string, unknown>)
        : payload;
    const referenceSource = typeof payload.errorId === "string" ? payload : supplied;
    const existingReference =
      typeof referenceSource.code === "string" && typeof referenceSource.errorId === "string"
        ? {
            code: referenceSource.code,
            errorId: referenceSource.errorId,
            ...(typeof referenceSource.requestId === "string" ? { requestId: referenceSource.requestId } : {}),
          }
        : null;
    const message =
      typeof rawData === "string"
        ? rawData
        : rawData && typeof rawData === "object" && typeof (rawData as Record<string, unknown>).error === "string"
          ? String((rawData as Record<string, unknown>).error)
          : `SSE ${String(payload.type)} failed`;
    const reference =
      existingReference ??
      reportDiagnosticError(new Error(message), {
        requestId: reply.request.id,
        operation: reply.request.routeOptions.url ?? reply.request.url.split(/[?#]/, 1)[0] ?? reply.request.url,
        stage: "stream",
      });
    const visibleError = (value: string) => {
      const safe = sanitizeDiagnosticText(value);
      return safe.includes(reference.errorId) ? safe : `${safe} [${reference.code} ${reference.errorId}]`;
    };
    if (typeof rawData === "string") {
      event = { ...payload, ...reference, data: visibleError(rawData) };
    } else if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
      const data = rawData as Record<string, unknown>;
      event = {
        ...payload,
        data: {
          ...data,
          ...(typeof data.error === "string" ? { error: visibleError(data.error) } : {}),
          ...reference,
        },
      };
    } else {
      event = { ...payload, ...reference };
    }
  }
  // Report errors before checking writability: disconnected clients still need
  // a durable record for HTTP-200 SSE failures.
  if (!isSseReplyWritable(reply)) return false;
  try {
    return reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
  } catch (error) {
    reportDiagnosticError(
      error,
      {
        requestId: reply.request.id,
        operation: reply.request.routeOptions.url ?? reply.request.url.split(/[?#]/, 1)[0],
        stage: "stream-write",
      },
      "ME_STREAM_WRITE",
    );
    return false;
  }
}
