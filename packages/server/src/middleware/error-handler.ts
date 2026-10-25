// ──────────────────────────────────────────────
// Error Handler Middleware
// ──────────────────────────────────────────────
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { ZodError as LegacyZodError } from "zod-v3";
import { failureLevel } from "../lib/log-context.js";

const MAX_VALIDATION_DETAILS = 50;

export function* validationDetails(
  issues: ZodError["issues"] | LegacyZodError["issues"],
  prefix: PropertyKey[] = [],
): Generator<{ path: string; message: string }> {
  for (const issue of issues) {
    const path = [...prefix, ...issue.path];
    if (issue.code === "invalid_union" && "errors" in issue && issue.errors.length === 2) {
      const [omitted, supplied] = issue.errors;
      // partialInput's omission branch cannot explain a rejected, supplied value.
      if (
        omitted?.length === 1 &&
        omitted[0]?.code === "invalid_type" &&
        omitted[0].expected === "undefined" &&
        supplied
      ) {
        yield* validationDetails(supplied, path);
        continue;
      }
    }
    yield { path: path.map(String).join("."), message: issue.message };
  }
}

export function errorHandler(error: FastifyError, _request: FastifyRequest, reply: FastifyReply) {
  // Zod validation errors → 400
  if (error instanceof ZodError || error instanceof LegacyZodError) {
    const details = [];
    for (const detail of validationDetails(error.issues)) {
      details.push(detail);
      if (details.length === MAX_VALIDATION_DETAILS) break;
    }
    return reply.status(400).send({
      error: "Validation Error",
      details,
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
