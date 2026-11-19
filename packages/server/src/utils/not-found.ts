import type { FastifyReply } from "fastify";

/** Sends the standard 404 body `{ error }` that routes use for a missing record. */
export function notFound(reply: FastifyReply, error: string) {
  return reply.status(404).send({ error });
}
