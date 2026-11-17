// Professor Mari's transcript scrolling: it lands on the newest message and keeps pinning while late turns measure
// and her window opens, stops following once the reader scrolls away, and lets go once the transcript settles.
import assert from "node:assert/strict";
import {
  isProfessorMariTranscriptNearBottom,
  landProfessorMariTranscript,
  scrollProfessorMariTranscriptToBottom,
} from "../../../packages/client/src/lib/professor-mari-transcript-scroll.js";

const professorMariTranscript = { clientHeight: 240, scrollHeight: 720, scrollTop: 0 };
scrollProfessorMariTranscriptToBottom(professorMariTranscript);
assert.equal(
  professorMariTranscript.scrollTop,
  professorMariTranscript.scrollHeight,
  "Professor Mari transcript scrolling must align a mounted pane with its newest message",
);
assert.equal(isProfessorMariTranscriptNearBottom(professorMariTranscript), true);
// #9115: opening her console left the transcript mid-history. The turns below the fold measure frames
// after the first pin, and the landing must keep pinning through that, not stop at the first settle.
{
  const frame = { clientHeight: 600, scrollHeight: 4000, scrollTop: 0 };
  const pending: Array<() => void> = [];
  const run = landProfessorMariTranscript(
    frame,
    (callback) => pending.push(callback),
    () => {},
  );
  const tick = () => pending.shift()?.();
  tick();
  assert.equal(frame.scrollTop, 4000, "the first frame pins to the newest line");
  // Her window is still animating its height open: the content is unchanged, the viewport is not. The loop
  // must not read that as settled (#9115), so a frame budget of 6 is given to prove it keeps the frames.
  frame.clientHeight = 900;
  // A growing viewport lets the browser clamp the position down to the new bottom; that is not the reader.
  frame.scrollTop = frame.scrollHeight - frame.clientHeight;
  tick();
  assert.equal(pending.length, 1, "a viewport that is still growing does not end the landing");
  frame.scrollHeight = 5200; // a turn below the fold took its real height
  tick();
  assert.equal(frame.scrollTop, 5200, "a later measure pins again, rather than leaving the view mid-history");
  frame.scrollTop = 3000; // the reader scrolled up to read
  tick();
  frame.scrollHeight = 5600;
  tick();
  assert.equal(frame.scrollTop, 3000, "a reader who scrolled away is never pulled back");
  run();
  assert.equal(pending.length, 0, "the landing stops when the node or chat goes");
  // Once the geometry holds still for a few frames the loop lets go, so it cannot pin the reader forever.
  const held = { clientHeight: 600, scrollHeight: 4000, scrollTop: 0 };
  const frames: Array<() => void> = [];
  landProfessorMariTranscript(
    held,
    (callback) => frames.push(callback),
    () => {},
    undefined,
    120,
    3,
  );
  for (let frame = 0; frame < 6; frame += 1) frames.shift()?.();
  assert.equal(frames.length, 0, "a settled transcript stops the landing");
}
professorMariTranscript.scrollTop = 200;
assert.equal(
  isProfessorMariTranscriptNearBottom(professorMariTranscript),
  false,
  "Professor Mari streaming must stop following output after the reader scrolls away from the bottom",
);
