// Professor Mari's transcript scrolling: it lands on the newest message and keeps pinning while late turns measure
// and her window opens, stops following once the reader scrolls away, and lets go once the transcript settles.
import assert from "node:assert/strict";
import {
  followTranscriptGrowth,
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
// #9821: after she landed, a picture in one of her replies loads and grows the transcript by its whole height at
// once. A following reader at the bottom stays on the newest line; one who scrolled away stays where they are, even
// before their scroll event clears "following"; a disclosure the reader opens stays where they opened it; a click on
// her reply text just before a picture loads does not stop the follow; neither does the pin's own scroll event when
// it arrives after the next picture grew; a pin from just before a send does not make it follow her reply; and a pin
// the transcript has scrolled off no longer counts.
{
  let grow = () => {};
  let click = (_event: { target: unknown }) => {};
  let frames: Array<() => void> = [];
  let following = true;
  const nextFrame = () => {
    const due = frames;
    frames = [];
    for (const frame of due) frame();
  };
  const realResizeObserver = globalThis.ResizeObserver;
  const realRequestAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) {
      grow = callback;
    }
    observe() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  globalThis.requestAnimationFrame = ((frame: () => void) => frames.push(frame)) as typeof requestAnimationFrame;
  try {
    let scrolled = () => {}; // the transcript's scroll event
    const scrollEvents = {
      addEventListener: (type: string, listener: () => void) => type === "scroll" && (scrolled = listener),
      removeEventListener() {},
    };
    const scroller = { clientHeight: 600, scrollHeight: 4000, scrollTop: 3400, ...scrollEvents };
    const summary = {}; // the summary of a disclosure in her newest reply
    const stack = {
      addEventListener: (type: string, listener: typeof click) => type === "click" && (click = listener),
      removeEventListener() {},
      contains: (node: unknown) => node === summary,
    };
    const { stop } = followTranscriptGrowth(
      scroller as unknown as HTMLElement,
      stack as unknown as HTMLElement,
      () => following,
    );
    scroller.scrollHeight = 4512; // a 512px picture took its height
    grow();
    assert.equal(scroller.scrollTop, 4512, "a picture that loads after the landing keeps the newest line in view");
    scroller.scrollTop = 2000; // the reader scrolled up to read; their scroll event has not arrived yet
    scroller.scrollHeight = 5024;
    grow();
    assert.equal(scroller.scrollTop, 2000, "a reader who scrolled away is not pulled down by a picture");
    scroller.scrollTop = 4424; // back at the bottom
    click({ target: { closest: () => summary } }); // they open a 400px disclosure in her newest reply
    nextFrame();
    scroller.scrollHeight = 5424;
    grow();
    assert.equal(scroller.scrollTop, 4424, "a disclosure the reader opens stays where they opened it");
    nextFrame();
    scroller.scrollTop = 4824; // back at the bottom; another picture loads
    scroller.scrollHeight = 5936;
    grow();
    assert.equal(scroller.scrollTop, 5936, "after the reader's click, a picture keeps the newest line in view again");
    scroller.scrollTop = 5336; // at the bottom; they click her reply text just before another picture loads
    click({ target: { closest: () => null } });
    scroller.scrollHeight = 6448;
    grow();
    assert.equal(scroller.scrollTop, 6448, "a click on her reply text does not stop a picture keeping the newest line");
    nextFrame();
    scroller.scrollHeight = 6960; // the next picture grew before that pin's scroll event arrived
    scrolled();
    following = false; // the scroll handler found the reader 512px above the new bottom
    grow();
    assert.equal(scroller.scrollTop, 6960, "the pin's own scroll event does not stop the next picture's follow");
    scroller.scrollTop = 6300; // the reader scrolled up a little; their scroll event cleared "following"
    scrolled();
    scroller.scrollHeight = 7472;
    grow();
    assert.equal(scroller.scrollTop, 6300, "a reader who moved after the pin is not pulled down");
    stop();
    // An empty chat: everything fits, so the pin on Enter (her welcome gives way to the question) leaves the
    // transcript at the top. The send right after it stops following and places her question under the header, which
    // is the top already, so it does not move; her reply must not pull it down.
    const short = {
      clientHeight: 600,
      scrollHeight: 400,
      top: 0,
      get scrollTop() {
        return Math.min(this.top, Math.max(0, this.scrollHeight - this.clientHeight));
      },
      set scrollTop(value: number) {
        this.top = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight));
      },
      ...scrollEvents,
    };
    following = true;
    const reports: boolean[] = [];
    const shortFollow = followTranscriptGrowth(
      short as unknown as HTMLElement,
      stack as unknown as HTMLElement,
      () => following,
      (newerBelow) => reports.push(newerBelow),
    );
    grow(); // Enter: the question replaces her welcome, and the follow pins it where it is
    assert.equal(short.scrollTop, 0);
    following = false; // the send, before the next frame
    shortFollow.unpin();
    short.scrollHeight = 616; // the turn reserves the transcript's height
    grow();
    short.scrollHeight = 1400; // her reply grows past the reserve
    grow();
    assert.equal(short.scrollTop, 0, "the first question in an empty chat stays under the header as her reply grows");
    short.scrollTop = 800; // the reader scrolled to the bottom, so they follow again
    scrolled();
    following = true;
    short.scrollHeight = 1912; // a picture
    grow();
    assert.equal(short.scrollTop, 1312);
    scrolled(); // that pin's own scroll event
    short.scrollTop = 900; // the reader scrolled up to read, and stopped following
    scrolled();
    following = false;
    short.scrollHeight = 2600; // her next lines grew below
    grow();
    short.scrollTop = 1312; // they scrolled down again, to where the old pin left them, still 688px above the bottom
    scrolled();
    reports.length = 0;
    short.scrollHeight = 3000;
    grow();
    assert.deepEqual(reports, [true], "a reader back where an old pin left them still gets the jump arrow");
    assert.equal(short.scrollTop, 1312);
    shortFollow.stop();
  } finally {
    globalThis.ResizeObserver = realResizeObserver;
    globalThis.requestAnimationFrame = realRequestAnimationFrame;
  }
}
