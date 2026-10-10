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

/**
 * While the reader follows the newest output, keep the transcript pinned to the bottom on every size
 * change of its content, not only when state changes. Content that grows smoothly (Mari's live reply
 * animates its height) then pushes the older lines up smoothly too, instead of sliding out of view.
 * `onGrown` reports whether newer output now sits below the fold of a reader who is not following.
 * Returns the cleanup.
 */
export function followTranscriptGrowth(
  scroller: HTMLElement,
  stack: HTMLElement,
  isFollowing: () => boolean,
  onGrown?: (newerBelow: boolean) => void,
): () => void {
  const observer = new ResizeObserver(() => {
    const following = isFollowing();
    const { scrollTo } = transcriptScrollAction({
      event: "grow",
      nearBottom: isProfessorMariTranscriptNearBottom(scroller),
      following,
    });
    if (scrollTo === "bottom") scrollProfessorMariTranscriptToBottom(scroller);
    // Slice 67: output that grew past the fold while the reader is not following gets the jump arrow,
    // not only after they scroll by hand - otherwise her answer can end hidden under the composer.
    onGrown?.(!following && !isProfessorMariTranscriptNearBottom(scroller));
  });
  observer.observe(stack);
  return () => observer.disconnect();
}

export type ProfessorMariTranscriptScrollEvent = "send" | "grow" | "complete" | "user-scroll";

export interface ProfessorMariTranscriptScrollInput {
  event: ProfessorMariTranscriptScrollEvent;
  /** Is the reader currently within the near-bottom threshold? */
  nearBottom: boolean;
  /** Was the reader following the newest output before this event? */
  following: boolean;
}

export interface ProfessorMariTranscriptScrollDecision {
  /** Where to move the scroll position, or `null` to leave it alone. */
  scrollTo: "top" | "bottom" | null;
  /** The follow state to carry forward after this event. */
  following: boolean;
}

/**
 * M4: on send, the question goes to the top once; afterwards the transcript follows new output only
 * while the reader is at the bottom; completion never moves the scroll position on its own (the
 * reload that lands the reply must apply in the same frame the live timeline clears, see
 * `HomeProfessorMariChat`'s `refreshAfterWorkspaceRun`, so there is nothing left for "complete" to fix).
 */
export function transcriptScrollAction({
  event,
  nearBottom,
  following,
}: ProfessorMariTranscriptScrollInput): ProfessorMariTranscriptScrollDecision {
  switch (event) {
    case "send":
      return { scrollTo: "top", following: false };
    case "grow":
      // nearBottom is measured fresh off the live DOM, not the (event-driven, so possibly one frame
      // stale) following flag: a reader who has just scrolled away must never get pulled back because
      // growth raced ahead of the browser's own "scroll" event.
      return { scrollTo: following && nearBottom ? "bottom" : null, following };
    case "complete":
      return { scrollTo: null, following };
    case "user-scroll":
      return { scrollTo: null, following: nearBottom };
  }
}
