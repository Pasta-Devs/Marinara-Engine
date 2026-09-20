import type { FastifyInstance } from "fastify";
import { reportDiagnosticError } from "../lib/diagnostic-operation.js";
import { sanitizeDiagnosticText } from "../lib/diagnostics.js";
import { logger } from "../lib/logger.js";

const MAX_CLIENT_REPORT_BYTES = 16 * 1024;
const CLIENT_REPORT_WINDOW_MS = 60_000;
const CLIENT_REPORTS_PER_WINDOW = 30;
const reportWindows = new Map<string, { startedAt: number; count: number }>();

type ClientReport = {
  kind: "error" | "unhandledrejection" | "react" | "network";
  message: string;
  stack?: string;
  path?: string;
  clientEventId: string;
};

function clientPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, 512);
  if (!trimmed) return undefined;
  return sanitizeDiagnosticText(trimmed.split(/[?#]/, 1)[0] ?? "") || undefined;
}

function takeClientReportSlot(key: string): boolean {
  const now = Date.now();
  const current = reportWindows.get(key);
  if (!current || now - current.startedAt >= CLIENT_REPORT_WINDOW_MS) {
    reportWindows.set(key, { startedAt: now, count: 1 });
    if (reportWindows.size > 2048) {
      let oldestKey: string | undefined;
      let oldestStartedAt = Number.POSITIVE_INFINITY;
      for (const [entryKey, entry] of reportWindows) {
        if (now - entry.startedAt >= CLIENT_REPORT_WINDOW_MS) reportWindows.delete(entryKey);
        else if (entry.startedAt < oldestStartedAt) {
          oldestStartedAt = entry.startedAt;
          oldestKey = entryKey;
        }
      }
      if (reportWindows.size > 2048 && oldestKey) reportWindows.delete(oldestKey);
    }
    return true;
  }
  if (current.count >= CLIENT_REPORTS_PER_WINDOW) return false;
  current.count++;
  return true;
}

export async function diagnosticsRoutes(app: FastifyInstance) {
  app.post<{ Body: Partial<ClientReport> }>(
    "/client",
    { bodyLimit: MAX_CLIENT_REPORT_BYTES },
    async (request, reply) => {
      const body = request.body;
      if (!body || typeof body !== "object") return reply.status(400).send({ error: "Invalid client report" });
      if (!takeClientReportSlot(request.ip)) return reply.status(429).send({ error: "Too many client reports" });

      const allowedKinds = new Set<ClientReport["kind"]>(["error", "unhandledrejection", "react", "network"]);
      if (!allowedKinds.has(body.kind as ClientReport["kind"])) {
        return reply.status(400).send({ error: "Invalid client report kind" });
      }
      const message = typeof body.message === "string" ? sanitizeDiagnosticText(body.message.slice(0, 4096)) : "";
      const clientEventId = typeof body.clientEventId === "string" ? body.clientEventId.trim().slice(0, 128) : "";
      if (!message || !/^[A-Za-z0-9._:-]+$/.test(clientEventId)) {
        return reply.status(400).send({ error: "Invalid client report" });
      }

      const error = new Error(message);
      const stack = typeof body.stack === "string" ? sanitizeDiagnosticText(body.stack.slice(0, 8192)) : "";
      if (stack) error.stack = stack;
      const reference = reportDiagnosticError(
        error,
        {
          requestId: request.id,
          operation: "client-runtime",
          stage: body.kind,
        },
        "ME_CLIENT_RUNTIME",
      );
      logger.info(
        { diagnostic: reference, clientEventId, path: clientPath(body.path), kind: body.kind },
        "Client diagnostic received",
      );
      return reply.status(202).send(reference);
    },
  );
}
