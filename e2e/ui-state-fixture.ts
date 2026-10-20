import type { BrowserContext, Page } from "@playwright/test";
import type { pickPersistedUIState } from "../packages/client/src/stores/ui.store.js";
import { UI_PERSISTENCE } from "../packages/client/src/lib/ui-persistence.js";

type PersistedUIState = ReturnType<typeof pickPersistedUIState>;

const silencedContexts = new WeakSet<BrowserContext>();

/**
 * Runs before the app in every page of a seeded context, so a local run stays quiet on WebKit too (it has no mute
 * switch). The browser mutes every media element while `muted` still reads what the app or a test set, and Web Audio
 * reaches the speakers only through a gain of 0. Playback, its events and play() spies behave as before.
 */
function keepAudioSilent() {
  const media = HTMLMediaElement.prototype;
  const muted = Object.getOwnPropertyDescriptor(media, "muted")!;
  const wanted = new WeakMap<HTMLMediaElement, boolean>();
  const silence = (element: HTMLMediaElement) => {
    if (!wanted.has(element)) wanted.set(element, muted.get!.call(element));
    muted.set!.call(element, true);
  };
  Object.defineProperty(media, "muted", {
    ...muted,
    get(this: HTMLMediaElement) {
      return wanted.has(this) ? wanted.get(this) : muted.get!.call(this);
    },
    set(this: HTMLMediaElement, value: unknown) {
      wanted.set(this, Boolean(value));
      muted.set!.call(this, true);
    },
  });
  const play = media.play;
  media.play = function (this: HTMLMediaElement) {
    silence(this);
    return play.call(this);
  };
  // Elements in the page can start by themselves (autoplay) without play().
  for (const type of ["loadstart", "play"]) {
    window.addEventListener(type, (event) => event.target instanceof HTMLMediaElement && silence(event.target), true);
  }
  const connect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown;
  const zeroGains = new WeakMap<BaseAudioContext, GainNode>();
  AudioNode.prototype.connect = function (this: AudioNode, target: unknown, ...rest: unknown[]) {
    const { context } = this;
    // An offline context renders into a buffer, never to the speakers.
    if (target !== context.destination || context instanceof OfflineAudioContext) {
      return connect.call(this, target, ...rest);
    }
    let zero = zeroGains.get(context);
    if (!zero) {
      zero = context.createGain();
      zero.gain.value = 0;
      connect.call(zero, context.destination);
      zeroGains.set(context, zero);
    }
    connect.call(this, zero, ...rest);
    return target;
  } as typeof AudioNode.prototype.connect;
}

/** Seed current persisted preferences. Migration tests should keep their explicit legacy payloads. */
export async function seedUIState(
  page: Page | BrowserContext,
  state: Partial<PersistedUIState>,
  mode: "replace" | "merge" | "if-missing" = "replace",
) {
  // On the context, so pages a test opens later stay quiet too.
  const context = "context" in page ? page.context() : page;
  if (!silencedContexts.has(context)) {
    silencedContexts.add(context);
    await context.addInitScript(keepAudioSilent);
  }
  await page.addInitScript(
    ({ name, version, state, mode }) => {
      const stored = localStorage.getItem(name);
      if (mode === "if-missing" && stored) return;
      let previous = {};
      if (mode === "merge" && stored) {
        try {
          previous = JSON.parse(stored).state;
        } catch {
          // A fresh fixture can replace malformed browser-local preferences.
        }
      }
      localStorage.setItem(name, JSON.stringify({ state: { ...previous, ...state }, version }));
    },
    // Keep unrelated proofs clear of surprise visits, the one-time chat introduction, on its holiday the seasonal
    // theme greeting, and the reply pings. A spec about one of these turns it back on.
    {
      ...UI_PERSISTENCE,
      state: {
        chibiProfessorMariEnabled: false,
        chatWindowIntroDismissed: true,
        seasonalThemesDisabled: true,
        convoNotificationSound: false,
        rpNotificationSound: false,
        gameNotificationSound: false,
        ...state,
      },
      mode,
    },
  );
}

/**
 * Keep this page off the UI settings saved on the shared e2e server. Every test in a shard talks to one
 * server, so settings an earlier test synced (onboarding, Mari packs, accent) would otherwise override
 * what this test seeded. The app finds nothing saved, and its own write-back goes nowhere.
 */
export async function isolateSyncedUISettings(page: Page | BrowserContext) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
}
