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
 * #9115: pin a newly opened transcript to its newest line until its height holds still. Older turns off
 * screen have only an estimated height (content-visibility), and the ones the bottom brings into view take
 * their real height a frame or more later, pushing the newest line down again, and her window animates its
 * height for a few hundred milliseconds as it opens - so both the content height and the viewport height
 * move after the first pin, and only a geometry that holds still ends the loop. It stops as soon as the
 * transcript moves without it (the reader scrolling), so it never pulls a reader back. A hidden transcript
 * (no height yet) waits for one. Returns the cancel.
 */
export function landProfessorMariTranscript(
  node: HTMLElement,
  schedule: (frame: () => void) => number,
  cancel: (handle: number) => void,
  onPinned?: () => void,
  frames = 120,
  stableFrames = 6,
): () => void {
  let handle: number | null = null;
  let geometry = "";
  let stable = 0;
  // The card's opening position is not a scroll the reader made: the bottom test applies only after a pin.
  let pinned = false;
  let pinnedTop = node.scrollTop;
  let moved = false;
  let used = 0;
  const land = () => {
    handle = null;
    if (moved || used++ > frames) return;
    if (node.clientHeight > 0) {
      // A transcript the reader has scrolled up from leaves its newest line below the fold. Growth below
      // that line leaves the position alone (the pin moves it back itself), and a viewport that grows lets
      // the browser clamp the position down to the new bottom - neither is the reader, so the test is
      // "is the newest line still on screen", not "is the position where I left it" (#9115, Dottore MEDIUM).
      // Where the last pin left the transcript, or the bottom it clamped to when the viewport grew - any
      // other position is the reader.
      if (pinned) moved = node.scrollTop !== pinnedTop && node.scrollTop !== node.scrollHeight - node.clientHeight;
      if (moved) return;
      const next = `${node.scrollHeight}:${node.clientHeight}`;
      if (next === geometry && ++stable >= stableFrames) return;
      if (next !== geometry) stable = 0;
      geometry = next;
      scrollProfessorMariTranscriptToBottom(node);
      pinned = true;
      pinnedTop = node.scrollTop;
      onPinned?.();
    }
    handle = schedule(land);
  };
  handle = schedule(land);
  return () => {
    if (handle !== null) cancel(handle);
    handle = null;
    moved = true;
  };
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
  // A hidden window has no height and loses its scroll position, so the first layout after she is shown
  // pins to the newest line for a reader who was following, whatever position the hidden scroll left.
  let shown = scroller.clientHeight > 0;
  const observer = new ResizeObserver(() => {
    const revealed = !shown && scroller.clientHeight > 0;
    shown = scroller.clientHeight > 0;
    const following = isFollowing();
    const { scrollTo } = transcriptScrollAction({
      event: "grow",
      nearBottom: revealed || isProfessorMariTranscriptNearBottom(scroller),
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
