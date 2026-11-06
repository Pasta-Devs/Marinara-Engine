import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { playbackErrorMessage } from "../../packages/client/src/lib/local-music-playback.js";

// #8618: the custom Music DJ player showed "The play() request was interrupted by …" and "Playback needs attention"
// while music played. A new track pauses and reloads the element, which rejects any pending play() with an AbortError,
// and the resume button's catch then set that as the current error after the new track had already cleared it.

const abort = Object.assign(new Error("The play() request was interrupted by a call to pause()."), {
  name: "AbortError",
});
const domAbort = new DOMException("The play() request was interrupted by a new load request.", "AbortError");

// An attempt cut short on purpose is not a failure, however the browser spells it.
assert.equal(playbackErrorMessage(abort, 3, 3), null, "an AbortError from pause() shows nothing");
assert.equal(playbackErrorMessage(domAbort, 3, 3), null, "a DOMException AbortError from load() shows nothing");

// A newer track took over: this attempt's outcome is stale, even when it is a real failure.
assert.equal(
  playbackErrorMessage(new Error("Failed to load because no supported source was found."), 3, 4),
  null,
  "a superseded attempt never overwrites the newer track's state",
);

// Genuine failures of the current track still show, with the browser's own message.
assert.equal(
  playbackErrorMessage(
    Object.assign(new Error("play() failed because the user didn't interact with the document first."), {
      name: "NotAllowedError",
    }),
    4,
    4,
  ),
  "play() failed because the user didn't interact with the document first.",
);
assert.equal(
  playbackErrorMessage(
    new DOMException("Failed to load because no supported source was found.", "NotSupportedError"),
    4,
    4,
  ),
  "Failed to load because no supported source was found.",
);
assert.equal(playbackErrorMessage("boom", 4, 4), "Local playback failed", "a non-Error rejection gets the fallback");
assert.equal(playbackErrorMessage(null, 4, 4), "Local playback failed");

// The player wires the helper into both play() paths, and clears a stale error once the element actually plays.
const player = readFileSync(
  new URL("../../packages/client/src/components/chat/LocalMusicPlayer.tsx", import.meta.url),
  "utf8",
);
assert.equal(
  player.match(/playbackErrorMessage\(err, /gu)?.length,
  2,
  "the track loader and the resume button both classify their rejections",
);
assert.doesNotMatch(
  player,
  /\.catch\(\(err\) => setError\(/u,
  "no play() rejection sets the error without classifying it",
);
assert.equal(
  player.match(/<audio ref=\{audioRef\} className="hidden" onPlaying=\{clearPlaybackError\} \/>/gu)?.length,
  2,
  "both the desktop and the mobile player clear the error when the element starts playing",
);

console.log("local music playback error regression passed");
