// ──────────────────────────────────────────────
// Error Handler Middleware
// ──────────────────────────────────────────────
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { reportDiagnosticError } from "../lib/diagnostic-operation.js";
import { sanitizeDiagnosticText } from "../lib/diagnostics.js";

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const reference = reportDiagnosticError(error, {
    requestId: request.id,
    operation: request.routeOptions.url ?? request.url.split(/[?#]/, 1)[0] ?? request.url,
    stage: "http",
  });
  // Zod validation errors → 400
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: "Validation Error",
      ...reference,
      details: error.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
  }

  // Known HTTP errors
  if (error.statusCode === 413) {
    // Routes carry their own bodyLimit (64 KB on experience-generation, 256 MB
    // app-wide for profile imports), so the message must not name one number.
    return reply.status(413).send({
      error: "The request body is larger than this endpoint accepts.",
      ...reference,
    });
  }

  if (error.statusCode) {
    return reply.status(error.statusCode).send({
      error: error.message ? sanitizeDiagnosticText(error.message) : "Internal Server Error",
      ...reference,
    });
  }

  // Unknown errors → 500
  return reply.status(500).send({
    error: "Internal Server Error",
    ...reference,
  });
}
