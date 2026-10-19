import { expect, test } from "@playwright/test";
import { SILENT_AUDIO_DATA_URI } from "../packages/client/src/lib/silent-audio.js";
import { UI_PERSISTENCE } from "../packages/client/src/lib/ui-persistence.js";
import { seedUIState } from "./ui-state-fixture";

type Proof = { browserMuted: (media: HTMLMediaElement) => boolean; edges: [AudioNode, unknown][] };

test("seeded pages still play media, muted, and Web Audio reaches the speakers only through a gain of 0", async ({
  page,
}) => {
  // Registered before the fixture, so it sees the browser's own muted state and every connection Web Audio makes.
  await page.context().addInitScript(() => {
    const browserMuted = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "muted")!.get!;
    const connect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown;
    const proof: Proof = { browserMuted: (media) => browserMuted.call(media), edges: [] };
    AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
      proof.edges.push([this, args[0]]);
      return connect.apply(this, args);
    } as typeof AudioNode.prototype.connect;
    Object.assign(window, { __silenceProof: proof });
  });
  await seedUIState(page, { rpNotificationSound: true });
  await page.route("**/silence-proof", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Silence proof</title>" }),
  );
  await page.goto("/silence-proof");

  const result = await page.evaluate(async (source) => {
    const proof = (window as unknown as { __silenceProof: Proof }).__silenceProof;
    const voice = new Audio(source);
    voice.muted = false;
    const played = await voice.play().then(
      () => true,
      (error: Error) => error.name,
    );
    const autoplay = Object.assign(document.createElement("audio"), { autoplay: true });
    const loading = new Promise((resolve) => autoplay.addEventListener("loadstart", resolve, { once: true }));
    autoplay.src = source;
    document.body.append(autoplay);
    await loading;

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const level = context.createGain();
    // Wired as the notification ping is, but never started: the wiring is the proof, and a broken fixture stays quiet.
    const chained = oscillator.connect(level).connect(context.destination);
    const intoSpeakers = proof.edges.filter(([, to]) => to === context.destination).map(([from]) => from);
    voice.pause();
    autoplay.pause();
    void context.close();
    return {
      played,
      voice: { reads: voice.muted, browser: proof.browserMuted(voice) },
      autoplay: { reads: autoplay.muted, browser: proof.browserMuted(autoplay) },
      chainReturnsDestination: chained === context.destination,
      speakerInputs: intoSpeakers.map((node) => (node instanceof GainNode ? node.gain.value : node.constructor.name)),
      appGainReachesSpeakers: intoSpeakers.includes(level),
    };
  }, SILENT_AUDIO_DATA_URI);

  expect(result).toEqual({
    played: true,
    voice: { reads: false, browser: true },
    autoplay: { reads: false, browser: true },
    chainReturnsDestination: true,
    speakerInputs: [0],
    appGainReachesSpeakers: false,
  });
  // Reply pings start off, and a spec about them can still turn one on.
  const stored = await page.evaluate((name) => JSON.parse(localStorage.getItem(name)!).state, UI_PERSISTENCE.name);
  expect(stored).toMatchObject({
    convoNotificationSound: false,
    rpNotificationSound: true,
    gameNotificationSound: false,
  });
});
