import type { FastifyReply } from "fastify";
import {
  encodeGenerationFallbackNotice,
  GENERATION_FALLBACK_HEADER,
  type GenerationFallbackNotice,
  type GenerationFallbackNotifier,
} from "../../services/generation/fallback-notification.js";
import { sendSseEvent } from "./sse.js";

export function createReplyFallbackNotifier(reply: FastifyReply): GenerationFallbackNotifier {
  return (notice: GenerationFallbackNotice) => {
    if (reply.raw.headersSent) {
      sendSseEvent(reply, { type: "fallback_used", data: notice });
      return;
    }
    reply.header(GENERATION_FALLBACK_HEADER, encodeGenerationFallbackNotice(notice));
  };
}
