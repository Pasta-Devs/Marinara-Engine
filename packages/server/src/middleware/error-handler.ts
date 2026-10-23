// ──────────────────────────────────────────────
// Error Handler Middleware
// ──────────────────────────────────────────────
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { failureLevel } from "../lib/log-context.js";

const MAX_VALIDATION_DETAILS = 50;

export function errorHandler(error: FastifyError, _request: FastifyRequest, reply: FastifyReply) {
  // Zod validation errors → 400
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: "Validation Error",
      details: error.issues.slice(0, MAX_VALIDATION_DETAILS).map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
  }

  // Known HTTP errors
  if (error.statusCode === 413 && error.code?.startsWith("FST_")) {
    // Routes carry their own bodyLimit (64 KB on experience-generation, 256 MB
    // app-wide for profile imports), so the message must not name one number.
    // A 413 the app raises itself (an export's image budget) keeps its own advice.
    return reply.status(413).send({
      error: "The request body is larger than this endpoint accepts.",
    });
  }

  if (error.statusCode) {
    return reply.status(error.statusCode).send({
      error: error.message,
    });
  }

  // Unknown errors → 500. This is the only line for the failure (a client
  // that went away is logged at info); Fastify's request-completed line only
  // records the status.
  reply.log[failureLevel(error)](error);
  return reply.status(500).send({
    error: "Internal Server Error",
  });
}
