export type ProfessorMariTranscriptScrollContainer = {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
};

/** Keep streaming output pinned only while the reader remains near the newest message. */
export function isProfessorMariTranscriptNearBottom(container: ProfessorMariTranscriptScrollContainer, threshold = 72) {
  return container.scrollHeight - container.clientHeight - container.scrollTop <= threshold;
}

/** Align a mounted Professor Mari transcript with its newest message. */
export function scrollProfessorMariTranscriptToBottom(container: ProfessorMariTranscriptScrollContainer) {
  container.scrollTop = container.scrollHeight;
}
