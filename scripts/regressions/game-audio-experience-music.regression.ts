// An Experience's own music (Capability API 1.345) holds the Engine's cue aside and gives it back when the
// story's track ends, but never over another source: the player's own music, a replay or a closed game
// ends the Experience track without bringing the held cue back. Drives the real audio manager with
// stubbed browser globals before the player has interacted, so music is only chosen, never played.
import assert from "node:assert/strict";

class AudioStub {
  preload = "";
  muted = false;
  volume = 1;
  src = "";
  play() {
    return Promise.resolve();
  }
  pause() {}
  addEventListener() {}
  removeEventListener() {}
}
Object.assign(globalThis, {
  Audio: AudioStub,
  window: { addEventListener() {}, removeEventListener() {} },
  document: { addEventListener() {}, removeEventListener() {}, visibilityState: "visible" },
});
if (!("navigator" in globalThis)) Object.assign(globalThis, { navigator: {} });

const { audioManager } = await import("../../packages/client/src/lib/game-audio.js");
const state = audioManager as unknown as { currentMusicTag: string | null; asideMusic: { tag: string } | null };
const track = { tag: "experience:pack:harvest", url: "/assets/harvest.ogg" };

// The story's track ends: the Engine's cue held aside comes back.
audioManager.playMusic("music:town");
audioManager.setExperienceMusic(track);
assert.equal(state.currentMusicTag, track.tag);
audioManager.playMusic("music:battle");
assert.equal(state.currentMusicTag, track.tag, "the Engine's cue waits while the Experience's track plays");
audioManager.setExperienceMusic(null);
assert.equal(state.currentMusicTag, "music:battle");

// The player's own music takes over: the stop ends the Experience's track and drops the held cue, and
// the Experience's end that follows brings nothing back.
audioManager.setExperienceMusic(track);
audioManager.playMusic("music:battle-2");
audioManager.stopMusic();
assert.equal(state.asideMusic, null);
audioManager.setExperienceMusic(null, { resume: false });
assert.equal(state.currentMusicTag, null);
audioManager.setExperienceMusic(null);
assert.equal(state.currentMusicTag, null);

// A replay or a closed game ends the Experience's track without the held cue coming back.
audioManager.setExperienceMusic(track);
audioManager.playMusic("music:town");
audioManager.setExperienceMusic(null, { resume: false });
assert.equal(state.currentMusicTag, null);
assert.equal(state.asideMusic, null);

console.log("Experience music: the Engine's cue comes back when the story's track ends, never over another source.");
