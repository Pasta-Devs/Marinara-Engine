import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { clickTopbarPanel } from "./topbar-navigation.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
const silentAudio = Buffer.from(
  readFileSync(new URL("../packages/client/src/lib/silent-audio.ts", import.meta.url), "utf8").match(
    /data:audio\/wav;base64,([^"\s]+)/u,
  )![1]!,
  "base64",
);

declare global {
  interface Window {
    __personaGameVoiceAudios: HTMLMediaElement[];
  }
}

async function create(request: APIRequestContext, path: string, data: unknown) {
  const response = await request.post(`/api${path}`, { data });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as { id: string };
}

async function preparePage(page: Page, chatId?: string) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    roleplayDisplayStyle: "classic",
    trackerPanelEnabled: false,
    appAccentPulseMode: false,
    enableStreaming: false,
  });
  await page.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      if (chatId) localStorage.setItem("marinara-active-chat-id", chatId);
    },
    { chatId, version },
  );
}

test("personas share the existing voice selector and assignment shape", async ({ page, request }, testInfo) => {
  const name = `Voice identity ${testInfo.project.name}`;
  const persona = await create(request, "/characters/personas", { name });
  const character = await create(request, "/characters", { data: { name } });
  const original = await (await request.get("/api/tts/config")).json();
  let config = { ...original, enabled: true, source: "openai", voiceMode: "per-character", voiceAssignments: [] };
  try {
    await page.route("**/api/tts/config", async (route) => {
      if (route.request().method() === "PUT") config = { ...config, ...route.request().postDataJSON() };
      await route.fulfill({ json: config });
    });
    await page.route("**/api/tts/voices", (route) =>
      route.fulfill({ json: { voices: ["alloy"], fromProvider: false } }),
    );
    await preparePage(page);
    await page.goto("/");
    await clickTopbarPanel(page, "connections");
    const card = page
      .locator('[data-component="RightPanel"]')
      .getByText("Text to Speech", { exact: true })
      .locator("xpath=../../..");
    await card.getByTitle("Expand").click();
    await card.getByRole("button", { name: "Add voice", exact: true }).click();
    await card.getByRole("button", { name: "Select character or persona", exact: true }).click();
    const choices = page.getByTestId("tts-character-options");
    await expect(choices.getByRole("option", { name, exact: true })).toBeVisible();
    await choices.getByRole("option", { name: `${name} (Persona)`, exact: true }).click();
    const voice = card.getByTestId(`tts-custom-voice-input-character-${persona.id}`);
    await voice.fill("persona-voice");
    await expect
      .poll(() => config.voiceAssignments)
      .toEqual([{ characterId: persona.id, characterName: name, voice: "persona-voice" }]);
    await page.reload();
    await clickTopbarPanel(page, "connections");
    await card.getByTitle("Expand").click();
    await expect(voice).toHaveValue("persona-voice");
    for (const theme of ["dark", "light"] as const) {
      await page.evaluate(async (theme) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setTheme(theme);
      }, theme);
      await voice.scrollIntoViewIfNeeded();
      await expect(voice).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`persona-voice-${theme}.png`) });
    }
  } finally {
    await request.delete(`/api/characters/personas/${persona.id}`);
    await request.delete(`/api/characters/${character.id}`);
  }
});

for (const mode of ["conversation", "roleplay", "game"] as const) {
  test(`${mode} reads newly sent persona messages once and respects narration gates`, async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(90_000);
    const personaName = "Voice Persona";
    const characterName = "Voice Companion";
    const reply =
      mode === "game"
        ? `[${personaName}] [neutral]: "Generated persona line."\n[${characterName}] [neutral]: "Companion line."`
        : `<speaker="${personaName}">"Generated persona line."</speaker><speaker="${characterName}">"Companion line."</speaker>Silence returns.`;
    const provider = createServer(async (incoming, response) => {
      let body = "";
      for await (const chunk of incoming) body += String(chunk);
      if (!incoming.url?.endsWith("/chat/completions")) return void response.writeHead(404).end();
      if (JSON.parse(body).stream) {
        response.writeHead(200, { "content-type": "text/event-stream" });
        response.end(
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: reply } }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
        );
      } else {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({ choices: [{ message: { role: "assistant", content: reply }, finish_reason: "stop" }] }),
        );
      }
    });
    await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
    const { port } = provider.address() as { port: number };
    const cleanup: string[] = [];
    try {
      const connection = await create(request, "/connections", {
        name: "Persona voice fixture",
        provider: "custom",
        model: "fixture",
        baseUrl: `http://127.0.0.1:${port}/v1`,
        apiKey: "fixture",
        treatAsLocalEndpoint: true,
      });
      cleanup.push(`/connections/${connection.id}`);
      const persona = await create(request, "/characters/personas", { name: personaName });
      const nextPersona = await create(request, "/characters/personas", { name: "Another Persona" });
      cleanup.push(`/characters/personas/${persona.id}`, `/characters/personas/${nextPersona.id}`);
      const character = await create(request, "/characters", { data: { name: characterName, first_mes: "" } });
      cleanup.push(`/characters/${character.id}`);
      const chat = await create(request, "/chats", {
        name: `Persona voice ${mode}`,
        mode,
        characterIds: [character.id],
        personaId: persona.id,
        connectionId: connection.id,
      });
      cleanup.unshift(`/chats/${chat.id}`);
      expect(
        (
          await request.patch(`/api/chats/${chat.id}/metadata`, {
            data: {
              enableAgents: false,
              enableTools: false,
              roleplayDisplayStyle: "classic",
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
          })
        ).ok(),
      ).toBeTruthy();
      const original = await (await request.get("/api/tts/config")).json();
      let enabledForMode = true;
      let assigned = true;
      let cacheEpoch = 0;
      await page.route("**/api/tts/config", (route) =>
        route.fulfill({
          json: {
            ...original,
            enabled: true,
            source: "openai",
            connectionId: "",
            voiceMode: "per-character",
            model: `persona-tts-${chat.id}-${cacheEpoch}`,
            voice: "global-voice",
            narratorVoiceEnabled: true,
            narratorVoice: "narrator-voice",
            voiceAssignments: [
              ...(assigned ? [{ characterId: persona.id, characterName: personaName, voice: "persona-voice" }] : []),
              { characterId: nextPersona.id, characterName: "Another Persona", voice: "other-persona-voice" },
              { characterId: character.id, characterName, voice: "character-voice" },
            ],
            autoplayRP: mode === "roleplay" && enabledForMode,
            autoplayConvo: mode === "conversation" && enabledForMode,
            autoplayGame: mode === "game" && enabledForMode,
            dialogueOnly: false,
            progressivePlayback: false,
            roleplaySpeakerExtractorEnabled: false,
            dialoguePauseMs: 0,
          },
        }),
      );
      const spoken: Array<{ text: string; voice?: string; characterId?: string }> = [];
      await page.route("**/api/tts/speak", (route) => {
        spoken.push(route.request().postDataJSON());
        return route.fulfill({ contentType: "audio/wav", body: silentAudio });
      });
      await preparePage(page, chat.id);
      if (mode === "game") {
        await page.addInitScript(() => {
          window.__personaGameVoiceAudios = [];
          const play = HTMLMediaElement.prototype.play;
          HTMLMediaElement.prototype.play = function () {
            if (this.src.startsWith("blob:") && (new Error().stack ?? "").includes("GameNarration.tsx")) {
              window.__personaGameVoiceAudios.push(this);
            }
            return play.call(this);
          };
        });
      }
      await page.goto("/");
      const send = async (text: string) => {
        const input = page.locator("textarea[data-chat-composer]").filter({ visible: true });
        if (mode === "game") {
          // Finish reading the fixture's current GM segments before submitting another turn.
          await expect
            .poll(async () => {
              if (await input.isVisible()) return true;
              const next = page.getByRole("button", { name: "Next", exact: true });
              if (await next.isVisible()) await next.click();
              return false;
            })
            .toBe(true);
        }
        await expect(input).toBeEnabled();
        await input.fill(text);
        if (mode === "game") await page.getByRole("button", { name: "Send game turn", exact: true }).click();
        else await page.getByRole("button", { name: "Send", exact: true }).filter({ visible: true }).click();
        await expect
          .poll(async () => {
            const messages = await (await request.get(`/api/chats/${chat.id}/messages`)).json();
            return messages.some(
              (message: { role: string; content: string }) => message.role === "user" && message.content.includes(text),
            );
          })
          .toBe(true);
        await expect
          .poll(() =>
            page.evaluate(async () => {
              const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
              return useChatStore.getState().isStreaming;
            }),
          )
          .toBe(false);
      };
      const ownLine = "My persona speaks this newly sent line.";
      await send(ownLine);
      await expect.poll(() => spoken.filter((row) => row.text.includes(ownLine))).toHaveLength(1);
      expect(spoken.find((row) => row.text.includes(ownLine))?.voice).toBe("persona-voice");
      if (mode === "roleplay") {
        await expect
          .poll(() =>
            spoken.some((row) => row.text.includes("Generated persona line.") && row.voice === "persona-voice"),
          )
          .toBe(true);
        await expect
          .poll(() => spoken.some((row) => row.text.includes("Companion line.") && row.voice === "character-voice"))
          .toBe(true);
      }
      if (mode === "game") {
        await expect.poll(() => page.evaluate(() => window.__personaGameVoiceAudios.at(-1)?.ended)).toBe(true);
        const gamePlays = await page.evaluate(() => window.__personaGameVoiceAudios.length);
        await page.evaluate(async () => {
          const { ttsService } = await import("/src/lib/tts-service.ts" as string);
          await ttsService.speak("A settings voice preview.", "persona-test-preview", { voice: "preview-voice" });
        });
        await expect.poll(() => spoken.some((row) => row.text === "A settings voice preview.")).toBe(true);
        await page.waitForTimeout(250);
        expect(await page.evaluate(() => window.__personaGameVoiceAudios.length)).toBe(gamePlays);
        await send("*The battle is won.*\n\n[combat_result]\nAutomatic recap must stay unspoken.\n[/combat_result]");
        expect(spoken.some((row) => /battle is won|Automatic recap must stay unspoken/.test(row.text))).toBe(false);
      }
      enabledForMode = false;
      await page.reload();
      await send("Mode narration is disabled for this line.");
      expect(spoken.some((row) => row.text.includes("Mode narration is disabled"))).toBe(false);
      enabledForMode = true;
      assigned = false;
      await page.reload();
      await send("This persona has no assigned voice.");
      expect(spoken.some((row) => row.text.includes("This persona has no assigned voice"))).toBe(false);
      expect(spoken.filter((row) => row.text.includes(ownLine))).toHaveLength(1);

      if (mode === "roleplay") {
        const messages = await (await request.get(`/api/chats/${chat.id}/messages`)).json();
        const first = messages.find(
          (message: { role: string; content: string }) => message.role === "user" && message.content.includes(ownLine),
        );
        const extra = typeof first.extra === "string" ? JSON.parse(first.extra) : first.extra;
        expect(extra.personaSnapshot.personaId).toBe(persona.id);
        expect(
          (await request.patch(`/api/chats/${chat.id}`, { data: { personaId: nextPersona.id } })).ok(),
        ).toBeTruthy();
        assigned = true;
        cacheEpoch += 1;
        await page.reload();
        const row = page.locator(`[data-message-id="${first.id}"]`);
        await row.scrollIntoViewIfNeeded();
        if (testInfo.project.use.hasTouch) await row.getByText(ownLine, { exact: true }).tap();
        else await row.hover();
        await row.getByRole("button", { name: /^Voice controls/ }).click();
        await page
          .getByRole("dialog", { name: /^Voice controls/ })
          .getByRole("button", { name: "Speak", exact: true })
          .click();
        await expect.poll(() => spoken.filter((row) => row.text.includes(ownLine))).toHaveLength(2);
        expect(spoken.filter((row) => row.text.includes(ownLine)).at(-1)?.voice).toBe("persona-voice");
      }
    } finally {
      try {
        for (const path of cleanup) await request.delete(`/api${path}`);
      } finally {
        provider.closeAllConnections();
        await new Promise<void>((resolve) => provider.close(() => resolve()));
      }
    }
  });
}
