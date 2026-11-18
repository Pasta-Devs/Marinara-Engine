import type { FastifyReply } from "fastify";
import type { z } from "zod";

/**
 * Parse a request body, or send `400 { error, issues }` (first 10 Zod issues) and
 * return `undefined`. Callers then `return reply`.
 */
export function parseBody<S extends z.ZodType>(
  schema: S,
  body: unknown,
  reply: FastifyReply,
  error: string,
): z.output<S> | undefined {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  reply.status(400).send({ error, issues: parsed.error.issues.slice(0, 10) });
  return undefined;
}
