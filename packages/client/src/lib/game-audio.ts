// ──────────────────────────────────────────────
// Game: Audio Manager
//
// Handles music playback with crossfade, SFX,
// and ambient sound layers. Uses Web Audio API
// for smooth transitions.
// ──────────────────────────────────────────────

const CROSSFADE_MS = 2000;
const SFX_POOL_SIZE = 8;

type AssetMap = Record<string, { path: string }>;

/** Release an audio element without triggering an "Invalid URI" console error. */
function releaseAudio(el: HTMLAudioElement): void {
  el.pause();
  el.removeAttribute("src");
  el.load();
}

function normalizeAssetTag(tag: string): string {
  return tag.trim().replace(/\\/g, "/").replace(/\//g, ":");
}

function assetTagToPath(tag: string): string {
  return normalizeAssetTag(tag).replace(/:/g, "/");
}

/** Singleton audio manager for game mode. */
class GameAudioManager {
  private musicElement: HTMLAudioElement | null = null;
  private nextMusicElement: HTMLAudioElement | null = null;
  private ambientElement: HTMLAudioElement | null = null;
  private sfxPool: HTMLAudioElement[] = [];
  private sfxIndex = 0;
  private sfxAudioContext: AudioContext | null = null;
  private musicVolume = 0.5;
  private sfxVolume = 0.5;
  private ambientVolume = 0.35;
  private isMuted = false;
  private currentMusicTag: string | null = null;
  private currentAmbientTag: string | null = null;
  private fadeInterval: ReturnType<typeof setInterval> | null = null;
  /** Tracks tags whose play() was rejected by autoplay policy. */
  private pendingMusic: { tag: string; manifest?: Record<string, { path: string }> | null } | null = null;
  private pendingAmbient: { tag: string; manifest?: Record<string, { path: string }> | null } | null = null;
  private gestureListenerAttached = false;
  /** True after the user has interacted with the page (click/touch/key). */
  private userHasInteracted = false;
  private interactionListenerAttached = false;

  constructor() {
    // Pre-create SFX pool
    for (let i = 0; i < SFX_POOL_SIZE; i++) {
      const el = new Audio();
      el.preload = "auto";
      this.sfxPool.push(el);
    }
    this.attachInteractionListener();
  }

  /** Track user interaction so we know autoplay is allowed. */
  private attachInteractionListener(): void {
    if (this.interactionListenerAttached) return;
    this.interactionListenerAttached = true;
    const handler = () => {
      this.userHasInteracted = true;
      document.removeEventListener("click", handler, true);
      document.removeEventListener("touchstart", handler, true);
      document.removeEventListener("keydown", handler, true);
      document.removeEventListener("pointerdown", handler, true);
      // Retry any pending audio now that the user has interacted
      this.retryPending();
    };
    document.addEventListener("click", handler, true);
    document.addEventListener("touchstart", handler, true);
    document.addEventListener("keydown", handler, true);
    document.addEventListener("pointerdown", handler, true);
  }

  /** Attach a one-time user gesture listener to retry blocked audio. */
  private ensureGestureListener(): void {
    if (this.gestureListenerAttached) return;
    this.gestureListenerAttached = true;
    const handler = () => {
      document.removeEventListener("click", handler, true);
      document.removeEventListener("touchstart", handler, true);
      document.removeEventListener("keydown", handler, true);
      document.removeEventListener("pointerdown", handler, true);
      this.gestureListenerAttached = false;
      this.retryPending();
    };
    document.addEventListener("click", handler, true);
    document.addEventListener("touchstart", handler, true);
    document.addEventListener("keydown", handler, true);
    document.addEventListener("pointerdown", handler, true);
  }

  /** Retry any autoplay-blocked audio. Call from a user gesture for best results. */
  retryPending(): void {
    if (this.pendingMusic) {
      const { tag, manifest } = this.pendingMusic;
      this.pendingMusic = null;
      this.currentMusicTag = null;
      this.playMusic(tag, manifest);
    }
    if (this.pendingAmbient) {
      const { tag, manifest } = this.pendingAmbient;
      this.pendingAmbient = null;
      this.currentAmbientTag = null;
      this.playAmbient(tag, manifest);
    }
  }

  /** Resolve an asset tag to a URL. */
  private resolveUrl(tag: string): string {
    // Tag format: "category:subcategory:name" → path: "category/subcategory/name.*"
    // The manifest stores the full relative path with extension
    const path = assetTagToPath(tag);
    return `/api/game-assets/file/${path}`;
  }

  /** Try to find the full path from manifest, falling back to tag-based URL. */
  resolveAssetUrl(tag: string, manifest?: AssetMap | null): string {
    const normalizedTag = normalizeAssetTag(tag);
    const manifestEntry = manifest?.[tag] ?? manifest?.[normalizedTag];
    if (manifestEntry) {
      return `/api/game-assets/file/${manifestEntry.path}`;
    }
    return this.resolveUrl(tag);
  }

  private getSfxAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.sfxAudioContext) {
      const AudioContextCtor =
        window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return null;
      this.sfxAudioContext = new AudioContextCtor();
    }
    if (this.sfxAudioContext.state === "suspended") {
      void this.sfxAudioContext.resume();
    }
    return this.sfxAudioContext;
  }

  private playTone(
    ctx: AudioContext,
    startOffset: number,
    duration: number,
    fromFrequency: number,
    toFrequency: number,
    volume: number,
    type: OscillatorType = "sine",
  ): void {
    const now = ctx.currentTime + startOffset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromFrequency, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, toFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * this.sfxVolume), now + duration * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private playNoise(
    ctx: AudioContext,
    startOffset: number,
    duration: number,
    volume: number,
    filterType: BiquadFilterType = "highpass",
    frequency = 900,
  ): void {
    const now = ctx.currentTime + startOffset;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const decay = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * decay;
    }
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(Math.max(0.0001, volume * this.sfxVolume), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
  }

  private playProceduralSfx(tag: string): boolean {
    if (this.isMuted || this.sfxVolume <= 0 || !this.userHasInteracted) return false;
    const ctx = this.getSfxAudioContext();
    if (!ctx) return false;
    const normalizedTag = normalizeAssetTag(tag);

    if (/menu-hover$/.test(normalizedTag)) {
      this.playTone(ctx, 0, 0.04, 760, 920, 0.08, "triangle");
      return true;
    }
    if (/(menu-confirm|menu-select|click)$/.test(normalizedTag)) {
      this.playTone(ctx, 0, 0.045, 520, 760, 0.1, "triangle");
      this.playTone(ctx, 0.04, 0.055, 760, 1040, 0.08, "triangle");
      return true;
    }
    if (/(coin-pickup|victory)$/.test(normalizedTag)) {
      [523, 659, 784, 1047].forEach((freq, index) => {
        this.playTone(ctx, index * 0.07, 0.12, freq, freq * 1.01, 0.1, "triangle");
      });
      return true;
    }
    if (/(menu-cancel|defeat)$/.test(normalizedTag)) {
      this.playTone(ctx, 0, 0.16, 220, 110, 0.13, "sawtooth");
      return true;
    }
    if (/(magic-cast)$/.test(normalizedTag)) {
      [440, 660, 880].forEach((freq, index) => {
        this.playTone(ctx, index * 0.035, 0.16, freq, freq * 1.35, 0.07, "sine");
      });
      return true;
    }
    if (/(spell-hit)$/.test(normalizedTag)) {
      this.playTone(ctx, 0, 0.16, 150, 70, 0.12, "sawtooth");
      this.playNoise(ctx, 0, 0.12, 0.08, "lowpass", 800);
      return true;
    }
    if (/(sword-swing-2)$/.test(normalizedTag)) {
      this.playNoise(ctx, 0, 0.18, 0.13, "highpass", 1200);
      this.playTone(ctx, 0.02, 0.14, 280, 520, 0.09, "square");
      return true;
    }
    if (/(sword-swing-3)$/.test(normalizedTag)) {
      this.playNoise(ctx, 0, 0.12, 0.09, "highpass", 1600);
      return true;
    }
    if (/(sword-swing|sword-unsheathe)$/.test(normalizedTag)) {
      this.playNoise(ctx, 0, 0.14, 0.1, "highpass", 1300);
      this.playTone(ctx, 0.015, 0.08, 360, 620, 0.06, "triangle");
      return true;
    }
    if (/(chainmail|metal-ring)$/.test(normalizedTag)) {
      this.playNoise(ctx, 0, 0.1, 0.08, "bandpass", 1800);
      this.playTone(ctx, 0.02, 0.11, 520, 460, 0.07, "square");
      return true;
    }
    if (/(potion|item)$/.test(normalizedTag)) {
      this.playTone(ctx, 0, 0.08, 420, 560, 0.08, "sine");
      this.playTone(ctx, 0.07, 0.09, 560, 740, 0.07, "sine");
      return true;
    }

    return false;
  }

  /** Play background music with crossfade. */
  playMusic(tag: string, manifest?: Record<string, { path: string }> | null): void {
    if (tag === this.currentMusicTag) return;
    const previousMusicTag = this.currentMusicTag;
    this.currentMusicTag = tag;

    // Defer playback if the user hasn't interacted yet (avoids autoplay warnings)
    if (!this.userHasInteracted) {
      this.pendingMusic = { tag, manifest };
      return;
    }

    const url = this.resolveAssetUrl(tag, manifest);
    const newAudio = new Audio(url);
    newAudio.loop = true;
    newAudio.volume = 0;
    newAudio.muted = this.isMuted;

    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    const oldAudio = this.musicElement;
    if (this.nextMusicElement && this.nextMusicElement !== oldAudio) {
      releaseAudio(this.nextMusicElement);
      this.nextMusicElement = null;
    }
    if (oldAudio) {
      oldAudio.volume = this.isMuted ? 0 : this.musicVolume;
      oldAudio.muted = this.isMuted;
    }
    this.nextMusicElement = newAudio;

    newAudio
      .play()
      .then(() => {
        if (this.nextMusicElement !== newAudio) {
          releaseAudio(newAudio);
          return;
        }
        // Playback started — clear any pending retry
        this.pendingMusic = null;
        const steps = CROSSFADE_MS / 50;
        const fadeStep = this.musicVolume / steps;
        let step = 0;

        const interval = setInterval(() => {
          if (this.nextMusicElement !== newAudio) {
            clearInterval(interval);
            if (this.fadeInterval === interval) this.fadeInterval = null;
            releaseAudio(newAudio);
            return;
          }

          step++;
          // Fade in new
          newAudio.volume = Math.min(this.isMuted ? 0 : this.musicVolume, fadeStep * step);
          // Fade out old
          if (oldAudio) {
            oldAudio.volume = Math.max(0, (this.isMuted ? 0 : this.musicVolume) - fadeStep * step);
          }

          if (step >= steps) {
            clearInterval(interval);
            if (this.fadeInterval === interval) this.fadeInterval = null;
            if (oldAudio) {
              releaseAudio(oldAudio);
            }
            this.musicElement = newAudio;
            this.nextMusicElement = null;
          }
        }, 50);

        this.fadeInterval = interval;
      })
      .catch(() => {
        if (this.nextMusicElement !== newAudio) {
          releaseAudio(newAudio);
          return;
        }

        this.nextMusicElement = null;
        releaseAudio(newAudio);

        // Autoplay blocked — queue for retry on user gesture
        this.pendingMusic = { tag, manifest };
        this.currentMusicTag = previousMusicTag;
        if (oldAudio) {
          oldAudio.volume = this.isMuted ? 0 : this.musicVolume;
          oldAudio.muted = this.isMuted;
        }
        this.ensureGestureListener();
      });
  }

  /** Stop music with fade out. */
  stopMusic(): void {
    this.currentMusicTag = null;
    this.pendingMusic = null;

    // Cancel any running crossfade so the next-element doesn't keep playing
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    if (this.nextMusicElement) {
      releaseAudio(this.nextMusicElement);
      this.nextMusicElement = null;
    }

    if (!this.musicElement) return;

    const audio = this.musicElement;
    this.musicElement = null;
    const steps = CROSSFADE_MS / 50;
    const fadeStep = audio.volume / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      audio.volume = Math.max(0, audio.volume - fadeStep);
      if (step >= steps) {
        clearInterval(interval);
        releaseAudio(audio);
      }
    }, 50);
  }

  /** Play a one-shot sound effect. */
  playSfx(tag: string, manifest?: AssetMap | null): void {
    if (this.isMuted || this.sfxVolume <= 0 || !this.userHasInteracted) return;
    const url = this.resolveAssetUrl(tag, manifest);
    const audio = this.sfxPool[this.sfxIndex % SFX_POOL_SIZE]!;
    this.sfxIndex++;
    audio.onerror = () => {
      audio.onerror = null;
      this.playProceduralSfx(tag);
    };
    audio.src = url;
    audio.volume = this.sfxVolume;
    audio.muted = false;
    audio.currentTime = 0;
    audio.play().catch(() => {
      this.playProceduralSfx(tag);
    });
  }

  /** Set looping ambient sound. */
  playAmbient(tag: string, manifest?: Record<string, { path: string }> | null): void {
    if (tag === this.currentAmbientTag) return;
    const previousAmbientTag = this.currentAmbientTag;
    const previousAmbient = this.ambientElement;
    this.currentAmbientTag = tag;

    // Defer playback if the user hasn't interacted yet (avoids autoplay warnings)
    if (!this.userHasInteracted) {
      this.pendingAmbient = { tag, manifest };
      return;
    }

    const url = this.resolveAssetUrl(tag, manifest);
    const nextAmbient = new Audio(url);
    nextAmbient.loop = true;
    nextAmbient.volume = this.isMuted ? 0 : this.ambientVolume;
    nextAmbient.muted = this.isMuted;
    nextAmbient
      .play()
      .then(() => {
        if (this.currentAmbientTag !== tag) {
          releaseAudio(nextAmbient);
          return;
        }

        if (previousAmbient && previousAmbient !== nextAmbient) {
          releaseAudio(previousAmbient);
        }
        this.ambientElement = nextAmbient;
        this.pendingAmbient = null;
      })
      .catch((err) => {
        releaseAudio(nextAmbient);
        if (this.currentAmbientTag !== tag) {
          return;
        }

        console.warn("[audio] Ambient playback failed:", tag, err);
        this.pendingAmbient = { tag, manifest };
        this.currentAmbientTag = previousAmbientTag;
        this.ambientElement = previousAmbient ?? null;
        if (previousAmbient) {
          previousAmbient.volume = this.isMuted ? 0 : this.ambientVolume;
          previousAmbient.muted = this.isMuted;
        }
        this.ensureGestureListener();
      });
  }

  /** Stop ambient sound. */
  stopAmbient(): void {
    this.currentAmbientTag = null;
    this.pendingAmbient = null;
    if (this.ambientElement) {
      releaseAudio(this.ambientElement);
      this.ambientElement = null;
    }
  }

  /** Set global mute state. */
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.musicElement) {
      this.musicElement.volume = muted ? 0 : this.musicVolume;
      this.musicElement.muted = muted;
    }
    if (this.nextMusicElement) {
      this.nextMusicElement.volume = muted ? 0 : this.musicVolume;
      this.nextMusicElement.muted = muted;
    }
    if (this.ambientElement) {
      this.ambientElement.volume = muted ? 0 : this.ambientVolume;
      this.ambientElement.muted = muted;
    }
    // Mute any currently-playing SFX
    for (const el of this.sfxPool) {
      el.muted = muted;
    }
  }

  /** Set volume levels (0–1). */
  setVolumes(music: number, sfx: number, ambient: number): void {
    this.musicVolume = Math.max(0, Math.min(1, music));
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
    this.ambientVolume = Math.max(0, Math.min(1, ambient));
    if (!this.isMuted) {
      if (this.musicElement) this.musicElement.volume = this.musicVolume;
      if (this.ambientElement) this.ambientElement.volume = this.ambientVolume;
    }
    for (const el of this.sfxPool) {
      el.volume = this.sfxVolume;
    }
  }

  /** Stop everything and clean up. */
  dispose(): void {
    this.stopMusic();
    this.stopAmbient();
    for (const el of this.sfxPool) {
      releaseAudio(el);
    }
  }

  /** Get current playback state. */
  getState() {
    return {
      musicTag: this.currentMusicTag,
      ambientTag: this.currentAmbientTag,
      isMuted: this.isMuted,
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
      ambientVolume: this.ambientVolume,
    };
  }
}

/** Global singleton instance. */
export const audioManager = new GameAudioManager();
