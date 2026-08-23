// ──────────────────────────────────────────────
// Error Handler Middleware
// ──────────────────────────────────────────────
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export function errorHandler(error: FastifyError, _request: FastifyRequest, reply: FastifyReply) {
  // Zod validation errors → 400
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: "Validation Error",
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
    });
  }

  if (error.statusCode) {
    return reply.status(error.statusCode).send({
      error: error.message,
    });
  }

  // Unknown errors → 500
  reply.log.error(error);
  return reply.status(500).send({
    error: "Internal Server Error",
  });
}
