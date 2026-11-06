import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";
import { clickTopbarPanel } from "./topbar-navigation.js";
import { chooseConnection } from "./connection-picker.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

async function prepare(page: Page, theme: "dark" | "light") {
  await isolateSyncedUISettings(page);
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    appAccentPulseMode: false,
    theme,
  });
  await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
  await page.goto("/");
  await expect(page.locator('[data-component="AppShell"]')).toBeVisible();
}

async function openConnection(page: Page, id: string) {
  // As `prepare` does: after a reload the editor is only opened once the app shell is up.
  await expect(page.locator('[data-component="AppShell"]')).toBeVisible();
  await page.evaluate(async (connectionId) => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().openConnectionDetail(connectionId);
  }, id);
  const editor = page.locator(".mari-editor-shell");
  await expect(editor).toBeVisible();
  return editor;
}

/** The Model's own model list (#8456): its search takes a model ID, which its "Use …" row then picks. */
async function typeModel(editor: Locator, id: string) {
  await editor.getByRole("searchbox", { name: "Search models or type a model ID", exact: true }).fill(id);
  await editor.locator("[data-model-use-typed]").click();
}

/**
 * Saves a change the stored row already shows, and waits for the save and the editor's reload from it: until
 * then a later click can be undone by that reload, and a poll of the row proves nothing.
 */
async function saveUnchanged(page: Page, editor: Locator, id: string) {
  const save = editor.getByRole("button", { name: "Save", exact: true });
  const patched = page.waitForResponse(
    (answer) => answer.request().method() === "PATCH" && new URL(answer.url()).pathname === `/api/connections/${id}`,
  );
  await save.click();
  expect((await patched).ok()).toBe(true);
  await expect(save).toBeEnabled();
}

/** The model the list marks as the Model's current one. */
const currentModel = (editor: Locator) =>
  editor.locator('[data-model-row]:has([data-model-option][aria-current="true"])');

async function capture(page: Page, info: TestInfo, label: string, anchor: Locator) {
  const updateToast = page.locator("[data-sonner-toast]").filter({ hasText: "A Marinara update is ready." });
  if (await updateToast.isVisible()) {
    await updateToast.getByRole("button", { name: "Close toast", exact: true }).click();
    await expect(updateToast).toBeHidden();
  }
  await anchor.scrollIntoViewIfNeeded();
  const path = info.outputPath(`${label}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await info.attach(label, { path, contentType: "image/png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const theme of ["dark", "light"] as const) {
  test(`Music connection test saves, plays a sample and reports provider errors without stale results (${theme})`, async ({
    page,
    request,
  }, info) => {
    const created = await request.post("/api/connections", {
      data: {
        name: `Music sample ${theme} ${info.project.name}`,
        provider: "audio_generation",
        audioGenerationSource: "elevenlabs",
        model: "music_v2_5",
        audioMusic: false,
      },
    });
    expect(created.ok()).toBeTruthy();
    const { id } = await created.json();
    const sent: Record<string, unknown>[] = [];
    let mode:
      "success" | "error" | "invalid-audio" | "invalid_api_key" | "unauthorized" | "auth-reason" | "input" | "hold" =
      "success";
    let release: (() => void) | undefined;
    let heldSettled = false;
    // Reuse a bundled MP3 to verify real decoding/playback without a paid provider call.
    const sample = readFileSync(
      new URL(
        "../packages/server/src/assets/default-game-assets/music/dialogue/slice_of_life/calm/town-peaceful.mp3",
        import.meta.url,
      ),
    );
    await page.route("**/api/game-assets/file/music/contexts/connection-test/**", (route) =>
      route.fulfill({ contentType: "audio/mpeg", body: sample }),
    );
    await page.route("**/api/audio/generate", async (route) => {
      const input = route.request().postDataJSON();
      sent.push(input);
      expect((await (await request.get(`/api/connections/${id}`)).json()).model).toBe("music_v2");
      expect(input).toMatchObject({
        kind: "music",
        audioConnectionId: id,
        context: { scope: "connection-test", lengthMs: 10000 },
      });
      if (mode === "error") {
        await route.fulfill({
          status: 502,
          json: {
            error: "Audio generation failed",
            detail: "ElevenLabs audio request returned HTTP 400",
            providerStatus: 400,
            reason: "The selected music model is unavailable.",
          },
        });
        return;
      }
      if (mode === "invalid-audio") {
        await route.fulfill({
          status: 502,
          json: { error: "Audio generation failed", detail: "private raw provider text", failureCode: "invalid_audio" },
        });
        return;
      }
      if (mode === "invalid_api_key" || mode === "unauthorized" || mode === "auth-reason") {
        await route.fulfill({
          status: 502,
          json: {
            error: "Audio generation failed",
            detail: "private raw provider text",
            providerStatus: 401,
            providerCode: mode === "auth-reason" ? "invalid_api_key" : mode,
            ...(mode === "auth-reason" ? { reason: "This API key is missing the music-generation permission." } : {}),
          },
        });
        return;
      }
      if (mode === "input") {
        await route.fulfill({
          status: 502,
          json: { error: "Audio generation failed", detail: "private endpoint settings", failureCode: "invalid_input" },
        });
        return;
      }
      if (mode === "hold")
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      await route
        .fulfill({
          json: {
            tag: "fixture",
            path: `music/contexts/connection-test/${input.context.key}/generated-fixture.mp3`,
            cached: false,
          },
        })
        .catch(() => {});
      if (mode === "hold") heldSettled = true;
    });
    try {
      await prepare(page, theme);
      const editor = await openConnection(page, id);
      const generate = editor.getByRole("button", { name: "Generate test music", exact: true });
      await expect(generate).toBeDisabled();
      // Its provider-credits help went in #8456; the section now says why the test is off.
      await expect(
        editor.getByText("Enable Music generation above to test this account.", { exact: true }),
      ).toBeVisible();
      expect(sent).toHaveLength(0);
      await editor.getByText("Music generation", { exact: true }).click();
      await typeModel(editor, "music_v2");
      expect(sent).toHaveLength(0);
      await generate.click();
      const player = editor.getByLabel("Test music playback", { exact: true });
      await expect(player).toBeVisible();
      await player.evaluate((element: HTMLAudioElement) => {
        element.addEventListener(
          "click",
          () => {
            void element.play();
          },
          { once: true },
        );
      });
      await player.click({ position: { x: 20, y: 20 } });
      await expect
        .poll(() => player.evaluate((element: HTMLAudioElement) => element.readyState))
        .toBeGreaterThanOrEqual(2);
      await expect.poll(() => player.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0);
      await player.evaluate((element: HTMLAudioElement) => element.pause());
      await capture(page, info, `music-test-playback-${theme}`, player);
      expect(sent).toHaveLength(1);
      mode = "error";
      await generate.click();
      await expect(editor.getByRole("alert")).toHaveText(
        "Music service returned HTTP 400: The selected music model is unavailable.",
      );
      await expect(player).toHaveCount(0);
      expect(sent).toHaveLength(2);
      await capture(page, info, `music-test-error-${theme}`, generate);
      mode = "invalid-audio";
      await generate.click();
      // Reworded for providers and accounts in #8456.
      await expect(editor.getByRole("alert")).toHaveText(
        "The test track could not be played. Check the provider’s audio response format.",
      );
      expect(sent).toHaveLength(3);
      for (const code of ["invalid_api_key", "unauthorized"] as const) {
        mode = code;
        await generate.click();
        await expect(editor.getByRole("alert")).toHaveText(
          "The music service rejected the API key. Check the key and its music-generation permissions.",
        );
      }
      expect(sent).toHaveLength(5);
      await capture(page, info, `music-test-auth-error-${theme}`, editor.getByRole("alert"));
      mode = "auth-reason";
      await generate.click();
      await expect(editor.getByRole("alert")).toHaveText(
        "Music service returned HTTP 401: This API key is missing the music-generation permission.",
      );
      expect(sent).toHaveLength(6);
      mode = "input";
      await generate.click();
      await expect(editor.getByRole("alert")).toHaveText(
        "The test input or account settings are invalid. Check the track length, selected model, and endpoint settings.",
      );
      expect(sent).toHaveLength(7);
      await capture(page, info, `music-test-input-error-${theme}`, editor.getByRole("alert"));
      mode = "hold";
      await generate.click();
      await expect.poll(() => !!release).toBe(true);
      await expect(editor.getByRole("button", { name: "Generating test music…", exact: true })).toBeDisabled();
      await typeModel(editor, "new-manual-model");
      await expect(generate).toBeEnabled();
      release!();
      await expect.poll(() => heldSettled).toBe(true);
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
      );
      await expect(player).toHaveCount(0);
      await expect(editor.getByRole("alert")).toHaveCount(0);
      expect(sent).toHaveLength(8);
    } finally {
      release?.();
      await request.delete(`/api/connections/${id}`);
    }
  });

  test(`ElevenLabs music model can be selected without replacing manual source models (${theme})`, async ({
    page,
    request,
  }, info) => {
    const created = await request.post("/api/connections", {
      data: {
        name: `Music model picker ${theme} ${info.project.name}`,
        provider: "audio_generation",
        audioGenerationSource: "elevenlabs",
        audioMusic: false,
        audioSoundEffects: false,
        model: "music_v2",
        maxContext: 64000,
        maxTokensOverride: 777,
      },
    });
    expect(created.ok()).toBeTruthy();
    const { id } = await created.json();
    const stored = async () => (await request.get(`/api/connections/${id}`)).json();
    const before = await stored();
    // Since #8456 the editor's model list asks the Engine for the Model's models. A Music & Sound Effects Model
    // gets none from it: an empty list, or a refusal while its account has no key and no address of its own
    // (ElevenLabs here, and the custom server, whose address the account sets). So every choice below is the
    // built-in Eleven Music one or a typed ID.
    const engineModels = async () => {
      const res = await request.get(`/api/connections/${id}/models`);
      return { status: res.status(), body: await res.json() };
    };
    const noModels = { status: 200, body: { models: [] } };
    const keylessAccount = {
      status: 400,
      body: { error: "This connection is off, under review, or needs an API key." },
    };
    try {
      await prepare(page, theme);
      let editor = await openConnection(page, id);
      // The model list (#8456) replaced the typed field and its dropdown: the current model is the marked row.
      await expect(currentModel(editor)).toHaveAttribute("data-model-id", "music_v2");
      const option = () => editor.locator('[data-model-row][data-model-id="music_v2_5"] [data-model-option]');
      await expect(option()).toBeVisible();
      await expect(option()).toContainText("Eleven Music v2.5");
      await capture(page, info, `elevenlabs-music-option-${theme}`, option());
      await option().click();
      await expect(currentModel(editor)).toHaveAttribute("data-model-id", "music_v2_5");
      expect(await engineModels()).toEqual(keylessAccount);
      await expect(editor.getByText("Context:", { exact: true })).toHaveCount(0);
      await expect(editor.getByText("Max Output:", { exact: true })).toHaveCount(0);
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      await expect.poll(stored).toMatchObject({
        model: "music_v2_5",
        maxContext: before.maxContext,
        maxTokensOverride: before.maxTokensOverride,
      });
      await page.reload();
      editor = await openConnection(page, id);
      await expect(currentModel(editor)).toHaveAttribute("data-model-id", "music_v2_5");
      await editor.getByRole("button", { name: /^SunoAPI Generate audio/u }).click();
      await expect(currentModel(editor)).toHaveAttribute("data-model-id", "V6");
      await expect(option()).toHaveCount(0);
      await typeModel(editor, "saved-suno-model");
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      await expect.poll(stored).toMatchObject({ audioGenerationSource: "sunoapi", model: "saved-suno-model" });
      expect(await engineModels()).toEqual(noModels);
      await page.reload();
      editor = await openConnection(page, id);
      await expect(currentModel(editor)).toHaveAttribute("data-model-id", "saved-suno-model");
      await editor.getByRole("button", { name: /^ElevenLabs/u }).click();
      await expect(currentModel(editor)).toHaveAttribute("data-model-id", "saved-suno-model");
      await expect(option()).toBeVisible();
      // The server address of a Model of a Connection is the Connection's to set since #8456, not this editor's.
      await editor.getByRole("button", { name: /^Custom compatible server/u }).click();
      await typeModel(editor, "saved-custom-model");
      await expect(option()).toHaveCount(0);
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      await expect.poll(stored).toMatchObject({ audioGenerationSource: "custom", model: "saved-custom-model" });
      await page.reload();
      editor = await openConnection(page, id);
      await expect(currentModel(editor)).toHaveAttribute("data-model-id", "saved-custom-model");
      expect(await engineModels()).toEqual(keylessAccount);
    } finally {
      await request.delete(`/api/connections/${id}`);
    }
  });

  test(`Custom audio source switches to preset defaults (${theme})`, async ({ page, request }, info) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const custom = {
      audioGenerationSource: "custom",
      baseUrl: "https://custom-audio.example.test/v1",
      model: "custom-music",
      audioSoundEffectsModel: "custom-sfx",
    };
    const created = await request.post("/api/connections", {
      data: {
        name: `Custom source switch ${theme} ${info.project.name}`,
        provider: "audio_generation",
        apiKey: "fixture-custom-source-key",
        ...custom,
      },
    });
    expect(created.ok()).toBeTruthy();
    const { id } = await created.json();
    const stored = async () => (await request.get(`/api/connections/${id}`)).json();
    try {
      await prepare(page, theme);
      let editor = await openConnection(page, id);
      await editor.getByRole("button", { name: /^Custom compatible server/u }).click();
      await saveUnchanged(page, editor, id);
      await expect.poll(stored).toMatchObject({ ...custom, apiKeyEncrypted: "••••••••" });
      await editor.getByRole("button", { name: /^ElevenLabs/u }).click();
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      const preset = {
        audioGenerationSource: "elevenlabs",
        baseUrl: "https://api.elevenlabs.io",
        model: "music_v2_5",
        audioSoundEffectsModel: "eleven_text_to_sound_v2",
        apiKeyEncrypted: "",
      };
      await expect.poll(stored).toMatchObject(preset);
      await page.reload();
      editor = await openConnection(page, id);
      await expect(editor.getByRole("button", { name: /^ElevenLabs/u })).toHaveAttribute("aria-pressed", "true");
      expect(await stored()).toMatchObject(preset);
      await capture(page, info, `custom-to-preset-${theme}`, editor.getByRole("button", { name: /^ElevenLabs/u }));
      expect(pageErrors).toEqual([]);
    } finally {
      await request.delete(`/api/connections/${id}`);
    }
  });

  test(`compatible Game audio settings save and reopen (${theme})`, async ({ page, request }, info) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const response = await request.post("/api/connections", {
      data: {
        name: `Compatible audio ${theme} ${info.project.name}`,
        provider: "audio_generation",
        audioGenerationSource: "elevenlabs",
        apiKey: "fixture-original-audio-key",
        baseUrl: "https://audio.example.test/v1",
        model: "fixture-audio-model",
      },
    });
    expect(response.ok()).toBeTruthy();
    const { id } = (await response.json()) as { id: string };
    const stored = async () => (await request.get(`/api/connections/${id}`)).json();
    try {
      await prepare(page, theme);
      await clickTopbarPanel(page, "connections");
      const row = page.locator(`[data-connection-id="${id}"]`);
      await expect(row).toBeVisible();
      // #8456 drew every Model tile as its provider's icon: the shared music one replaced the blue gradient.
      await expect(row.locator(".mari-provider-icon svg.lucide-music")).toBeVisible();
      await capture(page, info, `audio-category-theme-${theme}`, row);
      let editor = await openConnection(page, id);
      await expect(editor.getByRole("button", { name: "Test Connection", exact: true })).not.toBeVisible();
      await expect(editor.getByRole("button", { name: "Send Test Message", exact: true })).not.toBeVisible();
      // Its help text went in #8456; the music test itself is what this Model offers instead.
      await expect(editor.getByRole("button", { name: "Generate test music", exact: true })).toBeVisible();
      await editor.getByRole("button", { name: /^SunoAPI Generate audio/u }).click();
      await editor.getByRole("button", { name: /^ElevenLabs/u }).click();
      await saveUnchanged(page, editor, id);
      await expect.poll(async () => (await stored()).apiKeyEncrypted).toBe("••••••••");
      await editor.getByRole("button", { name: /^Custom compatible server/u }).click();
      const format = editor.getByRole("combobox", { name: "Generation API format", exact: true });
      const musicPath = editor.getByLabel("Music endpoint path", { exact: true });
      const sfxPath = editor.getByLabel("Sound-effect endpoint path", { exact: true });
      await expect(format).toHaveValue("binary");
      if (info.project.name.startsWith("mobile-")) {
        const typography = await Promise.all(
          [format, musicPath, sfxPath].map((control) =>
            control.evaluate((element) => ({
              coarsePointer: matchMedia("(pointer: coarse)").matches,
              rootFontSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
              fontSize: parseFloat(getComputedStyle(element).fontSize),
            })),
          ),
        );
        for (const metrics of typography) {
          expect(metrics.coarsePointer).toBe(true);
          expect(metrics.fontSize).toBe(metrics.rootFontSize);
          expect(metrics.fontSize).toBeGreaterThanOrEqual(16);
        }
        await info.attach("mobile-audio-control-typography", {
          body: JSON.stringify(typography),
          contentType: "application/json",
        });
      }
      // #8456 removed the compatible server's help text; its format and endpoint fields are checked above.
      await format.selectOption("chat_completions");
      await musicPath.fill("chat/completions");
      await sfxPath.fill("audio/generations");
      await editor.getByText("Sound-effect generation", { exact: true }).click();
      await editor.getByText("Music generation", { exact: true }).click();
      await expect(editor.getByRole("checkbox", { name: /^Sound-effect generation/u })).toBeChecked();
      await expect(editor.getByRole("checkbox", { name: /^Music generation/u })).toBeChecked();
      const save = editor.getByRole("button", { name: "Save", exact: true });
      await save.click();
      await expect.poll(stored).toMatchObject({
        audioGenerationSource: "custom",
        audioGenerationFormat: "chat_completions",
        audioMusicEndpoint: "chat/completions",
        audioSoundEffectsEndpoint: "audio/generations",
        audioMusic: "true",
        apiKeyEncrypted: "",
        audioSoundEffects: "true",
      });
      await expect(editor.getByText("Unsaved", { exact: true })).toBeHidden();
      await capture(page, info, `compatible-audio-${theme}`, format);

      await page.reload();
      editor = await openConnection(page, id);
      await expect(editor.getByRole("combobox", { name: "Generation API format", exact: true })).toHaveValue(
        "chat_completions",
      );
      await expect(editor.getByLabel("Music endpoint path", { exact: true })).toHaveValue("chat/completions");
      await expect(editor.getByLabel("Sound-effect endpoint path", { exact: true })).toHaveValue("audio/generations");
      await expect(editor.getByRole("checkbox", { name: /^Sound-effect generation/u })).toBeChecked();
      await expect(editor.getByRole("checkbox", { name: /^Music generation/u })).toBeChecked();

      await editor.getByLabel("Music endpoint path", { exact: true }).fill("https://other.example.test/generate");
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      await expect(editor.getByRole("button", { name: "Dismiss save error", exact: true })).toBeVisible();
      await expect(
        editor.getByText(
          "Enter an endpoint path without a host, query, fragment, backslash, or spaces (for example, chat/completions).",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(editor.getByLabel("Music endpoint path", { exact: true })).toHaveValue(
        "https://other.example.test/generate",
      );
      expect((await stored()).audioMusicEndpoint).toBe("chat/completions");
      await capture(
        page,
        info,
        `compatible-audio-invalid-${theme}`,
        editor.getByRole("button", { name: "Save", exact: true }),
      );
      await editor.getByRole("button", { name: /^ElevenLabs/u }).click();
      await expect(editor.getByLabel("Music endpoint path", { exact: true })).toBeHidden();
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      await expect.poll(stored).toMatchObject({
        audioGenerationSource: "elevenlabs",
        audioMusicEndpoint: null,
        audioSoundEffectsEndpoint: null,
        audioGenerationFormat: "binary",
      });
      await expect(editor.getByRole("button", { name: "Dismiss save error", exact: true })).toBeHidden();
      await editor.getByRole("button", { name: /^SunoAPI Generate audio/u }).click();
      await editor.getByText("Music generation", { exact: true }).click();
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      await expect.poll(stored).toMatchObject({
        audioGenerationSource: "sunoapi",
        audioGenerationCallbackUrl: null,
        audioMusic: "false",
        audioSoundEffects: "true",
      });
      await expect(editor.getByText("Unsaved", { exact: true })).toBeHidden();
      const rejectedCallbackPatches: string[] = [];
      const captureCallbackPatch = (sent: import("@playwright/test").Request) => {
        if (sent.method() === "PATCH" && sent.url().endsWith(`/api/connections/${id}`))
          rejectedCallbackPatches.push(sent.postData() || "");
      };
      page.on("request", captureCallbackPatch);
      await editor.getByLabel(/^SunoAPI music callback URL/u).fill("not-a-url");
      await editor.getByRole("button", { name: /^ElevenLabs/u }).click();
      await editor.getByRole("button", { name: /^SunoAPI Generate audio/u }).click();
      await expect(editor.getByLabel(/^SunoAPI music callback URL/u)).toHaveValue("not-a-url");
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      await expect(
        editor
          .getByRole("button", { name: "Dismiss save error", exact: true })
          .locator("..")
          .getByText("SunoAPI music requires a public HTTPS callback URL, even when polling.", { exact: true }),
      ).toBeVisible();
      expect(rejectedCallbackPatches).toEqual([]);
      expect((await stored()).audioGenerationCallbackUrl).toBeNull();
      // A stale nonempty callback is validated even while music is off and SFX stays enabled.
      for (const callback of ["https://192.168.1.20/hook", "https://user:pass@example.com/hook"]) {
        await editor.getByLabel(/^SunoAPI music callback URL/u).fill(callback);
        await editor.getByRole("button", { name: "Save", exact: true }).click();
        await expect(
          editor
            .getByRole("button", { name: "Dismiss save error", exact: true })
            .locator("..")
            .getByText("SunoAPI music requires a public HTTPS callback URL, even when polling.", { exact: true }),
        ).toBeVisible();
        expect(rejectedCallbackPatches, callback).toEqual([]);
        expect((await stored()).audioGenerationCallbackUrl).toBeNull();
      }
      page.off("request", captureCallbackPatch);
      await editor.getByLabel(/^SunoAPI music callback URL/u).fill("https://8.8.8.8/completed");
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      await expect.poll(stored).toMatchObject({
        audioGenerationCallbackUrl: "https://8.8.8.8/completed",
        audioMusic: "false",
        audioSoundEffects: "true",
      });
      await expect(editor.getByText("Unsaved", { exact: true })).toBeHidden();
      await editor.getByLabel(/^SunoAPI music callback URL/u).fill("");
      await expect(editor.getByLabel(/^SunoAPI music callback URL/u)).toHaveValue("");
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      await expect(editor.getByText("Unsaved", { exact: true })).toBeHidden();
      await expect.poll(async () => (await stored()).audioGenerationCallbackUrl).toBeNull();
      await editor.getByText("Music generation", { exact: true }).click();
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      await expect(
        editor
          .getByRole("button", { name: "Dismiss save error", exact: true })
          .locator("..")
          .getByText("SunoAPI music requires a public HTTPS callback URL, even when polling.", { exact: true }),
      ).toBeVisible();
      expect((await stored()).audioMusic).toBe("false");
      page.on("request", captureCallbackPatch);
      const privateCallbacks = [
        "https://localhost:8443/hook",
        "https://child.localhost./hook",
        "https://workstation.local/hook",
        "https://service.internal/hook",
        "https://192.168.1.20/hook",
        "https://127.0.0.1/completed",
        "https://2130706433/hook",
        "https://0.0.0.0/hook",
        "https://10.1.2.3/hook",
        "https://172.16.0.1/hook",
        "https://169.254.1.1/hook",
        "https://100.64.0.1/hook",
        "https://192.0.2.1/hook",
        "https://[::1]/hook",
        "https://[fd12::1]/hook",
        "https://[fe80::1]/hook",
        "https://[::ffff:192.168.1.2]/hook",
        "https://user:pass@example.com/hook",
      ];
      for (const callback of privateCallbacks) {
        await editor.getByLabel(/^SunoAPI music callback URL/u).fill(callback);
        await editor.getByRole("button", { name: "Save", exact: true }).click();
        const error = editor.getByRole("button", { name: "Dismiss save error", exact: true }).locator("..");
        await expect(error).toBeVisible();
        await info.attach("callback-preflight", {
          body: JSON.stringify({ callback, patches: [...rejectedCallbackPatches], error: await error.innerText() }),
          contentType: "application/json",
        });
        await expect(
          error.getByText("SunoAPI music requires a public HTTPS callback URL, even when polling.", { exact: true }),
        ).toBeVisible();
        expect(rejectedCallbackPatches, callback).toEqual([]);
        expect((await stored()).audioGenerationCallbackUrl).toBeNull();
      }
      await capture(
        page,
        info,
        `sunoapi-callback-preflight-${theme}`,
        editor.getByLabel(/^SunoAPI music callback URL/u),
      );
      page.off("request", captureCallbackPatch);
      expect((await stored()).audioMusic).toBe("false");
      await editor.getByLabel(/^SunoAPI music callback URL/u).fill("https://8.8.8.8/completed");
      await editor.getByLabel(/^Sound-effect model/u).fill("fixture-sfx-model");
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      await expect.poll(stored).toMatchObject({
        provider: "audio_generation",
        audioSource: null,
        audioVoice: null,
        audioGenerationSource: "sunoapi",
        audioGenerationCallbackUrl: "https://8.8.8.8/completed",
        audioSoundEffectsModel: "fixture-sfx-model",
      });
      await expect(editor.getByText("Unsaved", { exact: true })).toBeHidden();
      await capture(page, info, `sunoapi-audio-${theme}`, editor.getByLabel(/^SunoAPI music callback URL/u));
      await page.reload();
      editor = await openConnection(page, id);
      await expect(editor.getByLabel(/^SunoAPI music callback URL/u)).toHaveValue("https://8.8.8.8/completed");
      await expect(editor.getByLabel(/^Sound-effect model/u)).toHaveValue("fixture-sfx-model");
      expect(pageErrors).toEqual([]);
    } finally {
      await request.delete(`/api/connections/${id}`);
    }
  });
}

test("Game setup enables only the configured compatible audio capabilities", async ({ page }, info) => {
  const rows = [
    {
      id: "audio-sfx",
      name: "Sound effects only",
      provider: "audio_generation",
      audioGenerationSource: "custom",
      audioSoundEffects: true,
      audioMusic: true,
      audioSoundEffectsEndpoint: "audio/generations",
    },
    {
      id: "audio-music",
      name: "Music only",
      provider: "audio_generation",
      audioGenerationSource: "custom",
      audioSoundEffects: true,
      audioMusic: true,
      audioMusicEndpoint: "chat/completions",
    },
    {
      id: "audio-unconfigured",
      name: "Unconfigured capabilities",
      provider: "audio_generation",
      audioGenerationSource: "custom",
      audioSoundEffects: true,
      audioMusic: true,
    },
    {
      id: "audio-legacy",
      name: "Legacy ElevenLabs",
      provider: "audio_generation",
      audioGenerationSource: "elevenlabs",
      audioGenerationLegacyConnectionId: "speech-only",
      audioSoundEffects: true,
      audioMusic: true,
    },
    {
      id: "speech-only",
      name: "Character voices only",
      provider: "audio",
      audioSource: "elevenlabs",
      audioSoundEffects: true,
      audioMusic: true,
    },
    {
      id: "needs-review",
      name: "Quarantined audio",
      provider: "audio_generation",
      audioGenerationSource: "elevenlabs",
      audioSoundEffects: true,
      audioMusic: true,
      profileImportReviewRequired: "true",
    },
  ];
  await page.route("**/api/connections", (route) => route.fulfill({ json: rows }));
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
  await prepare(page, "dark");
  await prepareViteFixtureDependencies(page);
  await page.evaluate(async () => {
    const { GameSetupWizard } = await import("/src/components/game/GameSetupWizard.tsx" as string);
    const dependencyUrl = window.__viteFixtureDependencyUrl;
    const { default: React } = await import(dependencyUrl("react"));
    const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
    const { QueryClient, QueryClientProvider } = await import(dependencyUrl("@tanstack_react-query"));
    const container = document.createElement("div");
    document.body.append(container);
    ReactDOM.createRoot(container).render(
      React.createElement(
        QueryClientProvider,
        {
          client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
        },
        React.createElement(GameSetupWizard, {
          activeChatId: "compatible-audio-wizard",
          isNewGame: true,
          chatMetadata: {},
          characters: [],
          onSetupError: () => false,
          onCancel: () => {},
          onComplete: () => {},
          isLoading: false,
          isDraftingMap: false,
          isLinkingSharedWorld: false,
        }),
      ),
    );
  });
  const wizard = page.locator('[data-component="GameSetupWizard"]');
  await expect(wizard).toBeVisible();
  for (const heading of ["World", "Party", "Goals", "Lorebooks", "Features"]) {
    await wizard.getByRole("button", { name: "Next", exact: true }).click();
    await expect(wizard.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  // The account <select> became a ConnectionSelect and its "Model for Game audio" picker in #8456.
  const connection = wizard.getByLabel("Music & Sound Effects account", { exact: true });
  await connection.click();
  const picker = page.locator(".connection-picker-dialog");
  await expect(picker.getByRole("searchbox")).toBeVisible();
  // It offers the Music & Sound Effects Models, never a speech-only one or an import awaiting review.
  for (const offered of ["audio-sfx", "audio-music", "audio-unconfigured", "audio-legacy"]) {
    await expect(picker.locator(`[data-switcher-entry="${offered}"]`).first()).toBeAttached();
  }
  await expect(picker.locator('[data-switcher-entry="speech-only"]')).toHaveCount(0);
  await expect(picker.locator('[data-switcher-entry="needs-review"]')).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  const sfx = wizard.getByRole("button", { name: /^Sound effects Generate short scene sound effects/u });
  const music = wizard.getByRole("button", { name: /^Music Generate background music/u });
  await chooseConnection(page, connection, "audio-sfx");
  await expect(sfx).toBeEnabled();
  await expect(music).toBeDisabled();
  await capture(page, info, "compatible-audio-wizard-sfx-only", connection);
  await chooseConnection(page, connection, "audio-music");
  await expect(sfx).toBeDisabled();
  await expect(music).toBeEnabled();
  await chooseConnection(page, connection, "audio-unconfigured");
  await expect(sfx).toBeDisabled();
  await expect(music).toBeDisabled();
  await chooseConnection(page, connection, "audio-legacy");
  await expect(sfx).toBeEnabled();
  await expect(music).toBeEnabled();
});
