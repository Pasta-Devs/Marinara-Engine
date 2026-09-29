import {
  encodeGenerationFallbackNotice,
  GENERATION_FALLBACK_HEADER,
  type GenerationFallbackNotice,
  type GenerationFallbackNotifier,
} from "../../services/generation/fallback-notification.js";
import { generationOutputStarted, sendSseEvent, setGenerationOutputHeader, type GenerationOutput } from "./sse.js";

export function createReplyFallbackNotifier(reply: GenerationOutput): GenerationFallbackNotifier {
  return (notice: GenerationFallbackNotice) => {
    if (generationOutputStarted(reply)) {
      sendSseEvent(reply, { type: "fallback_used", data: notice });
      return;
    }
    setGenerationOutputHeader(reply, GENERATION_FALLBACK_HEADER, encodeGenerationFallbackNotice(notice));
  };
}
