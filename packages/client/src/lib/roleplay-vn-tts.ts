import type { TTSConfig } from "@marinara-engine/shared";
import { cleanTTSInputText, type TTSVoiceRequest } from "./tts-dialogue";
import { splitRoleplayParagraphs } from "./roleplay-vn-paragraphs";

export const ROLEPLAY_TTS_PARAGRAPH_EVENT = "marinara:roleplay-tts-paragraph";
export type RoleplayTTSParagraphDetail = {
  chatId: string;
  messageId: string;
  requests: TTSVoiceRequest[];
  chunkIndex: number;
};

/** Split existing speech at source paragraph boundaries, retaining its voice and filtering. */
export function withRoleplayTTSParagraphs(
  requests: TTSVoiceRequest[],
  content: string,
  config: TTSConfig,
  splitRequests = true,
): TTSVoiceRequest[] {
  let length = 0;
  const paragraphs = splitRoleplayParagraphs(content).map((paragraph, paragraphIndex) => {
    const text = cleanTTSInputText(paragraph, config);
    const start = length;
    if (text) length += text.length + 1;
    return { text, start, end: start + text.length, paragraphIndex };
  });
  const source = paragraphs
    .map((paragraph) => paragraph.text)
    .filter(Boolean)
    .join(" ");
  let cursor = 0;
  return requests.flatMap((request) => {
    const start = source.indexOf(request.text, cursor);
    // ponytail: only verbatim speech can be aligned safely. Rewritten extractor
    // output still plays normally; supporting it needs provider timing/alignment.
    if (start < 0) return [splitRequests ? request : { ...request, paragraphIndex: undefined }];
    const end = start + request.text.length;
    cursor = end;
    if (!splitRequests) {
      const paragraph = paragraphs.find(
        (paragraph) => paragraph.end > start && paragraph.start < end && paragraph.text,
      );
      return [{ ...request, paragraphIndex: paragraph?.paragraphIndex }];
    }
    const parts: TTSVoiceRequest[] = paragraphs
      .filter((paragraph) => paragraph.end > start && paragraph.start < end && paragraph.text)
      .map((paragraph) => ({
        ...request,
        text: source.slice(Math.max(start, paragraph.start), Math.min(end, paragraph.end)).trim(),
        paragraphIndex: paragraph.paragraphIndex,
        pauseAfterMs: undefined,
      }));
    if (parts.length) parts[parts.length - 1]!.pauseAfterMs = request.pauseAfterMs;
    return parts.length ? parts : [request];
  });
}

export function notifyRoleplayTTSParagraph(
  chatId: string,
  messageId: string,
  requests: TTSVoiceRequest[],
  chunkIndex: number,
) {
  window.dispatchEvent(
    new CustomEvent<RoleplayTTSParagraphDetail>(ROLEPLAY_TTS_PARAGRAPH_EVENT, {
      detail: { chatId, messageId, requests, chunkIndex },
    }),
  );
}
