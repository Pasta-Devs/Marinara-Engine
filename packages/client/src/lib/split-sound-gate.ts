// ──────────────────────────────────────────────
// UI overhaul: split view sound
//
// Each side of a split view is its own copy of the app, so two games (or a game
// and a voiced chat) would play music, effects and voices on top of each other.
// Only the side you clicked last plays sound; the other one keeps running quietly.
//
// This works for every sound the window makes, without each player knowing:
// - <audio>/<video> elements: the window mutes them on top of whatever the app
//   set (reading `muted` still gives the app's own value).
// - Web Audio: everything that plays into a context's speakers goes through one
//   gate per context, turned down while the window is quiet. The context keeps
//   running, so music stays in time and comes back where it would be.
//
// Installed once, at startup (main.tsx), in every window: sounds that start
// before a split opens must already pass through the gate. With no split open
// the window is never quiet and the gate changes nothing.
// ──────────────────────────────────────────────

import { SPLIT_PANE } from "./split-view-env";

let quiet = false;

/** Media elements the window has seen play. Weak, so finished players can go. */
const mediaSeen = new Set<WeakRef<HTMLMediaElement>>();
/** What the app set `muted` to, per element (only known once it set it or the window muted it). */
const ownMuted = new WeakMap<HTMLMediaElement, boolean>();
/** One gate per audio context, between everything that plays and the speakers. */
const gates = new Map<BaseAudioContext, GainNode>();

let nativeMuted: PropertyDescriptor | undefined;

function applyToMedia(el: HTMLMediaElement) {
  if (!nativeMuted?.get || !nativeMuted.set) return;
  if (!ownMuted.has(el)) ownMuted.set(el, Boolean(nativeMuted.get.call(el)));
  nativeMuted.set.call(el, quiet || ownMuted.get(el) === true);
}

function rememberMedia(el: HTMLMediaElement) {
  for (const ref of mediaSeen) if (ref.deref() === el) return applyToMedia(el);
  mediaSeen.add(new WeakRef(el));
  applyToMedia(el);
}

function gateFor(context: BaseAudioContext): GainNode | null {
  // An offline context renders into memory (voice lip-sync analysis), never to the speakers.
  if (typeof OfflineAudioContext === "function" && context instanceof OfflineAudioContext) return null;
  let gate = gates.get(context);
  if (!gate) {
    gate = context.createGain();
    gate.gain.value = quiet ? 0 : 1;
    (nativeConnect as (...args: unknown[]) => unknown).call(gate, context.destination);
    gates.set(context, gate);
  }
  return gate;
}

let nativeConnect: AudioNode["connect"] | undefined;

function install() {
  if (typeof window === "undefined") return;
  try {
    nativeMuted = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "muted");
    if (nativeMuted?.get && nativeMuted.set && nativeMuted.configurable) {
      const { get, set } = nativeMuted;
      Object.defineProperty(HTMLMediaElement.prototype, "muted", {
        configurable: true,
        enumerable: nativeMuted.enumerable,
        get(this: HTMLMediaElement) {
          return ownMuted.has(this) ? ownMuted.get(this)! : Boolean(get.call(this));
        },
        set(this: HTMLMediaElement, value: boolean) {
          ownMuted.set(this, Boolean(value));
          set.call(this, quiet || Boolean(value));
        },
      });
      const nativePlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
        rememberMedia(this);
        return nativePlay.call(this);
      };
      // Players in the page that start on their own (autoplay) never call play().
      document.addEventListener(
        "play",
        (event) => {
          if (event.target instanceof HTMLMediaElement) rememberMedia(event.target);
        },
        true,
      );
    }
  } catch {
    nativeMuted = undefined;
  }

  try {
    if (typeof AudioNode === "undefined" || typeof AudioDestinationNode === "undefined") return;
    const proto = AudioNode.prototype as AudioNode & Record<string, unknown>;
    nativeConnect = proto.connect;
    const nativeDisconnect = proto.disconnect as (...args: unknown[]) => void;
    proto.connect = function (this: AudioNode, target: AudioNode | AudioParam, ...rest: number[]) {
      if (target instanceof AudioDestinationNode) {
        const gate = gateFor(target.context);
        if (gate) {
          (nativeConnect as (...args: unknown[]) => unknown).call(this, gate, ...rest);
          return target;
        }
      }
      return (nativeConnect as (...args: unknown[]) => unknown).call(this, target, ...rest);
    } as AudioNode["connect"];
    proto.disconnect = function (this: AudioNode, ...args: unknown[]) {
      const [target] = args;
      if (target instanceof AudioDestinationNode) {
        const gate = gates.get(target.context);
        if (gate) return nativeDisconnect.call(this, gate, ...args.slice(1));
      }
      return nativeDisconnect.apply(this, args);
    } as AudioNode["disconnect"];
  } catch {
    /* no Web Audio: nothing to gate */
  }
}

install();

/** Whether this window is the split side that plays sound (always true with no split open). */
export function splitSideHasSound() {
  return !quiet;
}

/** Make this window quiet (the other side was clicked) or let it play again. */
export function setSplitSideQuiet(next: boolean) {
  if (quiet === next) return;
  quiet = next;
  for (const ref of mediaSeen) {
    const el = ref.deref();
    if (el) applyToMedia(el);
    else mediaSeen.delete(ref);
  }
  for (const el of document.querySelectorAll<HTMLMediaElement>("audio, video")) rememberMedia(el);
  for (const [context, gate] of gates) {
    if (context.state === "closed") {
      gates.delete(context);
      continue;
    }
    // A short ramp, so cutting the sound mid-note doesn't click.
    const now = context.currentTime;
    gate.gain.cancelScheduledValues(now);
    gate.gain.setValueAtTime(gate.gain.value, now);
    gate.gain.linearRampToValueAtTime(quiet ? 0 : 1, now + 0.05);
  }
}

/**
 * Hand the sound to this window when it is clicked or typed in. `onClaim` tells the other side to go
 * quiet; it only runs when this window didn't already have the sound. `skip` leaves out presses that
 * aren't really on this side (the divider). Returns the cleanup.
 */
export function claimSoundOnPress(onClaim: () => void, skip?: (target: EventTarget | null) => boolean) {
  const claim = (event: Event) => {
    if (!quiet || skip?.(event.target)) return;
    setSplitSideQuiet(false);
    onClaim();
  };
  window.addEventListener("pointerdown", claim, true);
  window.addEventListener("keydown", claim, true);
  return () => {
    window.removeEventListener("pointerdown", claim, true);
    window.removeEventListener("keydown", claim, true);
  };
}

// The second side opens quiet: you were working on the main side when you opened it.
if (SPLIT_PANE) setSplitSideQuiet(true);
