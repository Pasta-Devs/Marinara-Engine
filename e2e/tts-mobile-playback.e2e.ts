import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const silentAudio = readFileSync(new URL("../packages/client/src/lib/silent-audio.ts", import.meta.url), "utf8").match(
  /data:audio\/wav;base64,([^"\s]+)/u,
)![1]!;

interface PlaybackProof {
  gesture: boolean;
  primed: number;
  played: number;
  rejected: { source: string; stack: string }[];
  elements: HTMLMediaElement[];
  finish: () => void;
}
declare global {
  interface Window {
    __ttsPlaybackProof: PlaybackProof;
  }
}

test("Roleplay speech keeps tap permission through delayed synthesis and later clips", async ({
  page,
  request,
}, testInfo) => {
  const character = await (await request.post("/api/characters", { data: { data: { name: "Voice fixture" } } })).json();
  const chat = await (
    await request.post("/api/chats", {
      data: { name: "Delayed voice playback", mode: "roleplay", characterIds: [character.id] },
    })
  ).json();
  let releaseSynthesis!: () => void;
  const synthesisGate = new Promise<void>((resolve) => (releaseSynthesis = resolve));
  try {
    const messages = [];
    for (const content of ['"First line." She pauses. "Second line."', '"Another message."']) {
      messages.push(
        await (
          await request.post(`/api/chats/${chat.id}/messages`, {
            data: { role: "assistant", characterId: character.id, content },
          })
        ).json(),
      );
    }
    const config = await (await request.get("/api/tts/config")).json();
    await page.route("**/api/tts/config", (route) =>
      route.fulfill({ json: { ...config, enabled: true, dialogueOnly: true, dialoguePauseMs: 0 } }),
    );
    let synthesisRequests = 0;
    await page.route("**/api/tts/speak", async (route) => {
      synthesisRequests += 1;
      await synthesisGate;
      await route.fulfill({ contentType: "audio/wav", body: Buffer.from(silentAudio, "base64") });
    });
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["roleplay"],
      theme: testInfo.project.name === "desktop-chromium" ? "light" : "dark",
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
        // A deterministic per-element autoplay policy, not physical iOS calibration.
        // Only the real click task grants permission; the provider response waits until it expires.
        const authorized = new WeakSet<HTMLMediaElement>();
        const proof: PlaybackProof = {
          gesture: false,
          primed: 0,
          played: 0,
          rejected: [],
          elements: [],
          finish: () => proof.elements.at(-1)?.dispatchEvent(new Event("ended")),
        };
        window.__ttsPlaybackProof = proof;
        window.addEventListener(
          "click",
          (event) => {
            proof.gesture = event.isTrusted;
            setTimeout(() => (proof.gesture = false), 0);
          },
          true,
        );
        HTMLMediaElement.prototype.play = function () {
          // Muted global primers may play, but cannot authorize later audible TTS.
          if (this.muted) return Promise.resolve();
          if (proof.gesture) authorized.add(this);
          if (!authorized.has(this)) {
            proof.rejected.push({ source: this.src, stack: new Error().stack ?? "" });
            return Promise.reject(new DOMException("The browser blocked audio playback", "NotAllowedError"));
          }
          if (!proof.elements.includes(this)) proof.elements.push(this);
          if (this.src.startsWith("data:audio")) proof.primed += 1;
          else proof.played += 1;
          return Promise.resolve();
        };
      },
      { id: chat.id, version },
    );
    await page.goto("/");
    const first = page.locator(`[data-message-id="${messages[0].id}"]`);
    const second = page.locator(`[data-message-id="${messages[1].id}"]`);
    const audioMenu = page.getByRole("dialog", { name: /^Voice controls/ });
    const speak = audioMenu.getByRole("button", { name: "Speak", exact: true });
    await first.scrollIntoViewIfNeeded();
    if (testInfo.project.use.hasTouch) await first.getByText('"First line."', { exact: true }).tap();
    else await first.hover();
    await first.getByRole("button", { name: /^Voice controls/ }).click();
    if (testInfo.project.use.hasTouch) await speak.tap();
    else await speak.click();
    await expect.poll(() => synthesisRequests).toBe(1);
    await expect.poll(() => page.evaluate(() => window.__ttsPlaybackProof.gesture)).toBe(false);
    expect(await page.evaluate(() => window.__ttsPlaybackProof.primed)).toBe(1);
    releaseSynthesis();
    await expect(audioMenu.getByRole("button", { name: "Pause speaking", exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__ttsPlaybackProof.played)).toBe(1);
    await page.evaluate(() => window.__ttsPlaybackProof.finish());
    await expect.poll(() => page.evaluate(() => window.__ttsPlaybackProof.played)).toBe(2);
    await page.evaluate(() => window.__ttsPlaybackProof.finish());
    await expect(speak).toBeVisible();
    await second.scrollIntoViewIfNeeded();
    if (testInfo.project.use.hasTouch) await second.getByText('"Another message."', { exact: true }).tap();
    else await second.hover();
    await second.getByRole("button", { name: /^Voice controls/ }).click();
    const secondSpeak = audioMenu.getByRole("button", { name: "Speak", exact: true });
    if (testInfo.project.use.hasTouch) await secondSpeak.tap();
    else await secondSpeak.click();
    await expect(audioMenu.getByRole("button", { name: "Stop speaking", exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__ttsPlaybackProof.played)).toBe(3);
    expect(await page.evaluate(() => window.__ttsPlaybackProof.elements.length)).toBe(1);
    expect(await page.evaluate(() => window.__ttsPlaybackProof.rejected)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("roleplay-voice-playing.png") });
    const stop = audioMenu.getByRole("button", { name: "Stop speaking", exact: true });
    if (testInfo.project.use.hasTouch) await stop.tap();
    else await stop.click();
    await expect(audioMenu.getByRole("button", { name: "Speak", exact: true })).toBeVisible();
    await audioMenu.getByRole("button", { name: "Clear cached voice", exact: true }).click();
    await expect(secondSpeak).toBeEnabled();
    expect(synthesisRequests).toBe(3); // Clearing never starts playback.
    await secondSpeak.click();
    await expect.poll(() => synthesisRequests).toBe(4);
    await audioMenu.getByRole("button", { name: "Stop speaking", exact: true }).click();
    expect(
      await page.evaluate(() => {
        const audio = window.__ttsPlaybackProof.elements[0]!;
        return { source: audio.getAttribute("src"), ended: audio.onended, error: audio.onerror };
      }),
    ).toEqual({ source: null, ended: null, error: null });
  } finally {
    releaseSynthesis();
    await request.delete(`/api/chats/${chat.id}?force=true`);
    await request.delete(`/api/characters/${character.id}`);
  }
});
