// 2D and 3D avatars in a real Roleplay chat while a reply streams and text-to-speech reads it afterwards. A fake
// model streams a reply whose paragraphs read happy, sad and angry; a fake voice answers seconds later (or fails).
// The stage's own director frames are recorded, with what the renderer drew: the PNGTuber picture on screen (each
// face and its talk picture have their own colour) or the VRM's expression weights (a model with a face, built in
// code from the small fixture). With the voice off, the avatar talks and changes faces with the text. With it on,
// the text moves nothing: the voice moves the mouth, the faces change as the voice reaches each paragraph, and
// the face relaxes after the voice. A voice that fails right away replays the text animation once.
import { expect, test, type Page } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { paintPng, solid } from "../scripts/regressions/fixtures/avatar-2d-fixtures.js";
import { expressiveVrm } from "../scripts/regressions/fixtures/avatar-3d-fixtures.js";
import { seedUIState } from "./ui-state-fixture.js";

// Text-to-speech starts after the reply, with no click in between: Chromium must allow it.
test.use({
  launchOptions: { args: ["--disable-audio-output", "--mute-audio", "--autoplay-policy=no-user-gesture-required"] },
});

const version = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string })
  .version;
const REPLY = [
  'Maukie beams at you, delighted. "This is wonderful, I am so happy you came!"',
  'Then her face falls and she sobs quietly. "But I miss him so much, it hurts."',
  'She clenches her fists, furious. "I am furious, I hate them!"',
].join("\n\n");
const FEELINGS = ["happy", "sad", "angry"] as const;
type Rgb = [number, number, number];
/** Each face and its talk picture. */
const SPRITES: Record<string, Rgb> = {
  neutral: [128, 128, 128],
  neutral_talk: [40, 200, 60],
  happy: [240, 200, 40],
  happy_talk: [250, 120, 0],
  sad: [40, 80, 220],
  sad_talk: [0, 220, 230],
  angry: [220, 40, 40],
  angry_talk: [230, 110, 170],
};

type Kind = "2d" | "3d";
type Voice = "off" | "late" | "fails";
interface Recording {
  /** [ms, emotion, label, state, mouthOpen] per director frame for the character. */
  frames: Array<[number, string, string | null, string, number]>;
  /** What the renderer showed: the PNGTuber picture's name, or the VRM's face and whether a mouth shape is on. */
  drawn: Array<[number, string, boolean]>;
  tts: Array<[number, string]>;
  generating: Array<[number, boolean]>;
}

function wav(seconds: number): Buffer {
  const rate = 16_000;
  const samples = Math.round(rate * seconds);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index += 1) {
    const time = index / rate;
    // Syllables: four a second, a 220 Hz tone with gaps.
    const syllable = Math.sin(2 * Math.PI * 4 * time) > -0.3 ? 1 : 0;
    buffer.writeInt16LE(Math.round(16_000 * syllable * Math.sin(2 * Math.PI * 220 * time)), 44 + index * 2);
  }
  return buffer;
}

function avatarPackage(kind: Kind) {
  const id = kind === "2d" ? "2d-avatars" : "3d-avatars";
  const name = kind === "2d" ? "2D Avatars" : "3D Avatars";
  const agent = {
    id,
    packageId: id,
    name,
    description: "Avatars.",
    phase: "post_processing",
    enabledByDefault: false,
    category: "misc",
    execution: "host",
    defaultPromptTemplate: "",
  };
  const installed = {
    id,
    version: "1.0.0",
    status: "active",
    readiness: "ready",
    readinessError: null,
    error: null,
    legacy: false,
    installedAt: "2026-10-19T00:00:00.000Z",
    manifest: {
      schemaVersion: 2,
      id,
      name,
      version: "1.0.0",
      description: agent.description,
      engine: { min: "2.5.0", maxExclusive: "4.0.0" },
      capabilityApi: { major: 1, minor: 73 },
      kind: ["agent"],
      entrypoints: { agents: "agents.json" },
      files: [{ path: "agents.json", sha256: "0".repeat(64), bytes: 1 }],
      permissions: ["ui"],
      restartRequired: false,
    },
  };
  return { agent, installed };
}

/** Records the stage's director frames for the character and what its renderer drew, from now on. */
async function record(
  page: Page,
  ownerId: string,
  chatId: string,
  kind: Kind,
  sprites: Record<string, Rgb>,
  game = false,
) {
  await page.evaluate(
    async ({ ownerId, chatId, kind, sprites, game }) => {
      type Loose = any; // eslint-disable-line @typescript-eslint/no-explicit-any
      const started = performance.now();
      const at = () => Math.round(performance.now() - started);
      const recording = { frames: [], drawn: [], tts: [], generating: [] } as Loose;
      (window as Loose).__voiceRecording = recording;
      if (game) {
        window.Audio = new Proxy(window.Audio, {
          construct(target, args) {
            const audio = Reflect.construct(target, args) as HTMLAudioElement;
            if (audio.src.startsWith("blob:")) {
              (window as Loose).__gameVoiceAudio = audio;
              for (const [event, state] of [
                ["playing", "playing"],
                ["pause", "paused"],
                ["ended", "idle"],
                ["error", "error"],
              ]) {
                audio.addEventListener(event!, () => recording.tts.push([at(), state]));
              }
            }
            return audio;
          },
        });
      }
      // The stage keeps its director and renderers in React state; find them from its element.
      const stage = document.querySelector("[data-avatar-stage]") as Loose;
      let fiber = stage[Object.keys(stage).find((key) => key.startsWith("__reactFiber$"))!];
      let director: Loose = null;
      let slots: Map<string, Loose> | null = null;
      for (; fiber && !director; fiber = fiber.return) {
        if (typeof fiber.type !== "function" || fiber.type.name !== "AvatarStage") continue;
        for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const value = hook.memoizedState;
          if (typeof value?.frame === "function" && typeof value.pushStreamText === "function") director = value;
          if (value?.current instanceof Map && [...value.current.values()].every((slot: Loose) => slot?.renderer))
            slots ??= value.current;
        }
      }
      if (!director || !slots) throw new Error("The avatar stage's director was not found");
      const frame = director.frame;
      director.frame = (id: string, now: number) => {
        const result = frame(id, now);
        if (id === ownerId)
          recording.frames.push([at(), result.emotion, result.label ?? null, result.state, result.mouthOpen]);
        return result;
      };
      const { ttsService } = await import("/src/lib/tts-service.ts" as string);
      ttsService.subscribe((state: string) => recording.tts.push([at(), state]));
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      let generating = false;
      useChatStore.subscribe((state: Loose) => {
        const busy = state.abortControllers.has(chatId);
        if (busy !== generating) recording.generating.push([at(), (generating = busy)]);
      });
      const nearest = (rgb: number[]) => {
        let best = "";
        let distance = Infinity;
        for (const [name, colour] of Object.entries(sprites)) {
          const d = colour.reduce((sum, value, index) => sum + (value - rgb[index]!) ** 2, 0);
          if (d < distance) [best, distance] = [name, d];
        }
        return distance < 40 ** 2 ? best : "mixed";
      };
      setInterval(() => {
        const renderer = slots!.get(ownerId)?.renderer;
        if (kind === "2d") {
          const canvas = document.querySelector(`[data-avatar-owner="${ownerId}"] canvas`) as HTMLCanvasElement | null;
          const context = canvas?.getContext("2d");
          if (!canvas?.width || !context) return;
          const picture = nearest([...context.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data]);
          recording.drawn.push([at(), picture.replace(/_talk$/u, ""), picture.endsWith("_talk")]);
        } else if (renderer?.weights instanceof Map) {
          let face = "neutral";
          let mouth = false;
          for (const [name, weight] of renderer.weights as Map<string, number>) {
            if (["aa", "ih", "ou", "ee", "oh"].includes(name)) mouth ||= weight > 0.1;
            else if (weight > 0.3 && name !== "blink") face = name;
          }
          recording.drawn.push([at(), face, mouth]);
        }
      }, 50);
    },
    { ownerId, chatId, kind, sprites, game },
  );
}

const read = (page: Page) => page.evaluate(() => (window as any).__voiceRecording as Recording); // eslint-disable-line @typescript-eslint/no-explicit-any
const clipMouthDelays = (recording: Recording) =>
  recording.tts
    .filter(([, state]) => state === "playing")
    .map(([started]) => {
      const mouth = recording.frames.find(
        ([at, , , state, open]) => at >= started && state === "talking" && open > 0.1,
      );
      return mouth ? mouth[0] - started : null;
    });

/** When each feeling first shows, in the director's frames and in what was drawn, from `after` on. */
function firstFaces(recording: Recording, after = 0) {
  const frame = FEELINGS.map(
    (feeling) => recording.frames.find(([at, emotion]) => at >= after && emotion === feeling)?.[0],
  );
  const drawn = FEELINGS.map((feeling) => recording.drawn.find(([at, face]) => at >= after && face === feeling)?.[0]);
  return { frame, drawn };
}

for (const kind of ["2d", "3d"] as const) {
  const cases: Array<{ voice: Voice; mode: "roleplay" | "game"; streaming: boolean }> = [
    ...(["off", "late", "fails"] as const).map((voice) => ({ voice, mode: "roleplay" as const, streaming: true })),
    { voice: "off", mode: "roleplay", streaming: false },
    { voice: "late", mode: "roleplay", streaming: false },
    { voice: "late", mode: "game", streaming: true },
  ];
  for (const { voice, mode, streaming } of cases) {
    test(`a ${kind.toUpperCase()} avatar follows the ${mode} reply with the voice ${voice}, streaming ${streaming ? "on" : "off"}`, async ({
      page,
      request,
    }, info) => {
      test.skip(info.project.name !== "desktop-chromium", "One desktop Chromium run covers the timeline.");
      test.setTimeout(150_000);
      const created: string[] = [];
      const create = async (path: string, data: unknown) => {
        const response = await request.post(path, { data });
        expect(response.ok(), await response.text()).toBeTruthy();
        const value = (await response.json()) as { id: string };
        created.unshift(`${path}/${value.id}`);
        return value;
      };
      // A model that streams the reply a word every 80 ms.
      const provider = createServer(async (incoming, response) => {
        let body = "";
        for await (const chunk of incoming) body += String(chunk);
        if (!incoming.url?.endsWith("/chat/completions")) return void response.writeHead(404).end();
        if (!JSON.parse(body).stream) {
          response.writeHead(200, { "content-type": "application/json" });
          return void response.end(
            JSON.stringify({ choices: [{ message: { role: "assistant", content: REPLY }, finish_reason: "stop" }] }),
          );
        }
        response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
        for (const word of REPLY.split(/(?<=\s)/u)) {
          response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: word } }] })}\n\n`);
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
        response.end(
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
        );
      });
      try {
        await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
        const { port } = provider.address() as { port: number };
        const connection = await create("/api/connections", {
          name: `Avatar voice ${kind} ${voice}`,
          provider: "custom",
          model: "fixture",
          baseUrl: `http://127.0.0.1:${port}/v1`,
          apiKey: "fixture",
          treatAsLocalEndpoint: true,
          maxContext: 32768,
        });
        const character = await create("/api/characters", { data: { name: "Maukie", first_mes: "" } });
        if (kind === "2d") {
          for (const [expression, [r, g, b]] of Object.entries(SPRITES)) {
            const png = await paintPng(50, 100, solid(r, g, b));
            const saved = await request.post(`/api/sprites/${character.id}`, {
              data: { expression, image: `data:image/png;base64,${png.toString("base64")}` },
            });
            expect(saved.ok(), await saved.text()).toBeTruthy();
          }
        } else {
          const imported = await request.post(`/api/avatar-models/character/${character.id}/import`, {
            multipart: {
              kind: "vrm",
              file: { name: "maukie.vrm", mimeType: "model/gltf-binary", buffer: expressiveVrm() },
            },
          });
          expect(imported.ok(), await imported.text()).toBeTruthy();
        }
        const { agent, installed } = avatarPackage(kind);
        const chat = await create("/api/chats", {
          name: `Avatar voice ${kind} ${voice}`,
          mode,
          connectionId: connection.id,
          characterIds: [character.id],
        });
        const saved = await request.patch(`/api/chats/${chat.id}/metadata`, {
          data: {
            enableAgents: true,
            activeAgentIds: [agent.id],
            enableTools: false,
            ...(mode === "game"
              ? {
                  gameId: chat.id,
                  gameSessionStatus: "active",
                  gameSessionNumber: 1,
                  gameIntroPresented: true,
                  gameImageAutoGenerationEnabled: false,
                }
              : {}),
          },
        });
        expect(saved.ok(), await saved.text()).toBeTruthy();
        await create(`/api/chats/${chat.id}/messages`, {
          role: "assistant",
          content:
            mode === "game"
              ? '[Maukie] [happy]: "Ah, I am so happy you came. This is wonderful, and I have so much to tell you about today."'
              : "Maukie waits by the window.",
        });

        await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
        await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [installed] }));
        await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [agent] }));
        await page.route("**/api/avatar-models", async (route) => {
          const response = await route.fetch();
          const rows = (await response.json()) as Array<{ owner: { ownerId: string } }>;
          await route.fulfill({ response, json: rows.filter((row) => row.owner.ownerId === character.id) });
        });
        // The keyword list reads the moods; the local emotion model is never downloaded here.
        await page.route("**/api/avatar-classify/model", (route) =>
          route.fulfill({
            json: { unsupported: "lite", state: "not-downloaded", downloadedBytes: 0, totalBytes: 1 },
          }),
        );
        await page.route("**/api/tts/config", async (route) => {
          if (route.request().method() !== "GET") return route.continue();
          const response = await route.fetch();
          const config = await response.json();
          const on = voice !== "off";
          await route.fulfill({
            response,
            json: {
              ...config,
              // Each case synthesizes its fixture rather than inheriting another run's persistent audio.
              model: `avatar-voice-fixture-${chat.id}`,
              enabled: on,
              autoplayRP: on,
              autoplayGame: on,
              progressivePlayback: false,
              dialogueOnly: false,
              roleplaySpeakerExtractorEnabled: false,
            },
          });
        });
        const spoken: string[] = [];
        let releaseGameVoice = () => {};
        const gameVoiceGate = new Promise<void>((resolve) => (releaseGameVoice = resolve));
        await page.route("**/api/tts/speak", async (route) => {
          const { text } = JSON.parse(route.request().postData() ?? "{}") as { text: string };
          spoken.push(text);
          if (mode === "game") await gameVoiceGate;
          // The voice arrives 3 s after it was asked for, or fails after 1 s.
          await new Promise((resolve) => setTimeout(resolve, voice === "fails" ? 1_000 : 3_000));
          if (voice === "fails") return route.fulfill({ status: 500, json: { error: "Fixture voice failed" } });
          await route.fulfill({ contentType: "audio/wav", body: wav(Math.min(9, text.length * 0.04)) });
        });
        await seedUIState(page, {
          hasCompletedOnboarding: true,
          sidebarOpen: false,
          rightPanelOpen: false,
          chatHelpSeenModes: ["roleplay", "game"],
          trackerPanelEnabled: false,
          appAccentPulseMode: false,
          enableStreaming: streaming,
          streamingSpeed: 100,
        });
        await page.addInitScript(
          ({ id, version }) => {
            localStorage.setItem("marinara-active-chat-id", id);
            localStorage.setItem("marinara:whats-new:seen-version", version);
          },
          { id: chat.id, version },
        );
        await page.goto("/");
        const avatar = page.locator(`[data-avatar-stage] [data-avatar-owner="${character.id}"]`);
        await expect(avatar).toHaveAttribute("data-avatar-kind", kind === "2d" ? "pngtuber" : "vrm", {
          timeout: 60_000,
        });
        await record(page, character.id, chat.id, kind, SPRITES, mode === "game");
        await expect.poll(async () => (await read(page)).drawn.length, { timeout: 30_000 }).toBeGreaterThan(5);

        if (mode === "game") releaseGameVoice();
        else {
          await page.locator("textarea[data-chat-composer]").fill("Hi Maukie.");
          await page.locator("button.mari-chat-send-btn").click();
        }
        const sentAt = (await read(page)).frames.at(-1)?.[0] ?? 0;
        if (mode !== "game")
          await expect
            .poll(async () => (await read(page)).generating.some(([, busy]) => !busy), { timeout: 30_000 })
            .toBe(true);
        let recording = await read(page);
        const streamEnd = mode === "game" ? sentAt : recording.generating.find(([, busy]) => !busy)![0];
        const talking = ([, , , state, open]: Recording["frames"][number]) => state === "talking" && open > 0.3;
        const relaxed = () =>
          expect
            .poll(
              async () => {
                recording = await read(page);
                const last = recording.frames.at(-1);
                return (
                  last?.[1] === "neutral" &&
                  recording.frames.some(([at, emotion]) => at > sentAt && emotion !== "neutral")
                );
              },
              { timeout: 30_000 },
            )
            .toBe(true);

        if (mode === "game") {
          await expect
            .poll(
              async () => {
                recording = await read(page);
                return recording.tts.some(([, state]) => state === "idle");
              },
              { timeout: 45_000 },
            )
            .toBe(true);
          const start = recording.tts.find(([, state]) => state === "playing")![0];
          const end = recording.tts.find(([, state]) => state === "idle")![0];
          expect(
            recording.frames.filter(([at]) => at >= sentAt && at < start).some(talking),
            "Game text waits for its delayed voice",
          ).toBe(false);
          expect(
            recording.frames.some(([at, , , , open]) => at >= start && at < end && open > 0.3),
            "Game audio moves the mouth",
          ).toBe(true);
          expect(
            recording.drawn.some(([at, , mouth]) => at >= start && at < end && mouth),
            "the Game mouth is drawn",
          ).toBe(true);
          expect(
            recording.frames.filter(([at]) => at >= start && at < end).every(([, , label]) => label === "happy"),
            "Game keeps its authored expression",
          ).toBe(true);
          expect(
            clipMouthDelays(recording).every((delay) => delay !== null && delay < 200),
            "Game mouth moves from the clip's first spoken frames",
          ).toBe(true);
        } else if (voice === "off") {
          await relaxed();
          const { frame, drawn } = firstFaces(recording, sentAt);
          expect(
            frame.every((at) => at !== undefined && at < streamEnd + (streaming ? 3_000 : 9_000)),
            `faces with the text: ${frame}`,
          ).toBe(true);
          expect(frame[0]! < frame[1]! && frame[1]! < frame[2]!, "in the reply's order").toBe(true);
          expect(
            drawn.every((at) => at !== undefined),
            `and drawn: ${drawn}`,
          ).toBe(true);
          expect(
            recording.frames.some((frame) => frame[0] < streamEnd + (streaming ? 3_000 : 9_000) && talking(frame)),
            "talks with the text",
          ).toBe(true);
          expect(
            recording.drawn.some(([at, , mouth]) => at < streamEnd + (streaming ? 3_000 : 9_000) && mouth),
            "and draws it",
          ).toBe(true);
          expect(spoken, "no voice was asked for").toEqual([]);
        } else if (voice === "late") {
          await expect
            .poll(
              async () => {
                recording = await read(page);
                const playing = recording.tts.findIndex(([, state]) => state === "playing");
                return playing >= 0 && recording.tts.slice(playing).some(([, state]) => state === "idle");
              },
              { timeout: 45_000 },
            )
            .toBe(true);
          const playIndex = recording.tts.findIndex(([, state]) => state === "playing");
          const voiceFrom = recording.tts[playIndex]![0];
          const voiceTo = recording.tts.slice(playIndex).find(([, state]) => state === "idle")![0];
          await relaxed();
          const before = recording.frames.filter(([at]) => at > sentAt && at < voiceFrom);
          expect(before.some(talking), "the text moves no mouth before the voice").toBe(false);
          expect(
            before.every(([, emotion]) => emotion === "neutral"),
            "and shows no mood before the voice",
          ).toBe(true);
          expect(
            recording.drawn.some(([at, face, mouth]) => at > sentAt && at < voiceFrom && (mouth || face !== "neutral")),
            "nothing is drawn early either",
          ).toBe(false);
          expect(
            recording.frames.some((frame) => frame[0] >= voiceFrom && frame[0] <= voiceTo && talking(frame)),
            "the voice moves the mouth",
          ).toBe(true);
          expect(recording.drawn.some(([at, , mouth]) => at >= voiceFrom && at <= voiceTo + 200 && mouth)).toBe(true);
          expect(
            clipMouthDelays(recording).every((delay) => delay !== null && delay < 200),
            "each clip starts without a decode gap",
          ).toBe(true);
          const { frame, drawn } = firstFaces(recording, voiceFrom);
          expect(
            frame.every((at) => at !== undefined && at <= voiceTo),
            `every mood shows while the voice reads it: ${frame} (voice ${voiceFrom}-${voiceTo})`,
          ).toBe(true);
          expect(frame[0]! < frame[1]! && frame[1]! < frame[2]!, "in the reply's order").toBe(true);
          const span = voiceTo - voiceFrom;
          expect(frame[1]! - voiceFrom, "sad waits for the voice to reach its paragraph").toBeGreaterThan(span * 0.25);
          expect(frame[2]! - voiceFrom, "angry too").toBeGreaterThan(span * 0.55);
          expect(
            drawn.every((at) => at !== undefined && at <= voiceTo + 500),
            `and drawn: ${drawn}`,
          ).toBe(true);
          const calm = recording.frames.find(([at, emotion]) => at > voiceTo && emotion === "neutral")![0];
          expect(calm - voiceTo, "the face relaxes about 4 s after the voice").toBeGreaterThan(3_500);
        } else {
          await relaxed();
          const failedAt = recording.tts.find(([, state]) => state === "error")?.[0];
          expect(failedAt, "the voice failed").toBeDefined();
          const before = recording.frames.filter(([at]) => at > sentAt && at < failedAt!);
          expect(before.some(talking), "the text moves no mouth while the voice may still come").toBe(false);
          const after = recording.frames.filter(([at]) => at >= failedAt!);
          expect(after.some(talking), "then the text animation plays once").toBe(true);
          const { frame } = firstFaces(recording, failedAt!);
          expect(
            frame.every((at) => at !== undefined),
            `with its moods: ${frame}`,
          ).toBe(true);
          expect(
            recording.drawn.some(([at, , mouth]) => at >= failedAt! && mouth),
            "drawn",
          ).toBe(true);
        }
        await page.screenshot({ path: info.outputPath(`${kind}-${voice}.png`) });
        writeFileSync(
          info.outputPath("timeline.json"),
          JSON.stringify({ sentAt, streamEnd, clipMouthDelays: clipMouthDelays(recording), ...recording }),
        );
      } finally {
        await page.close();
        for (const path of created) await request.delete(path).catch(() => undefined);
        provider.close();
      }
    });
  }
}
