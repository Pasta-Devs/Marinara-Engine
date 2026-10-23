import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";
import { clickTopbarPanel } from "./topbar-navigation.js";

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
  await page.evaluate(async (connectionId) => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().openConnectionDetail(connectionId);
  }, id);
  const editor = page.locator(".mari-editor-shell");
  await expect(editor).toBeVisible();
  return editor;
}

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
      await editor.getByRole("button", { name: "Save", exact: true }).click();
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
      const icon = row.getByRole("button", { name: "Upload connection picture", exact: true }).locator("span").first();
      const colors = await icon.evaluate((element) => {
        const probe = document.createElement("span");
        element.append(probe);
        probe.style.color = "var(--color-sky-400)";
        const from = getComputedStyle(probe).color;
        probe.style.color = "var(--color-blue-500)";
        const to = getComputedStyle(probe).color;
        probe.remove();
        const computed = getComputedStyle(element);
        return { from, to, gradient: computed.backgroundImage, color: computed.color };
      });
      expect(colors.gradient).toContain(colors.from);
      expect(colors.gradient).toContain(colors.to);
      expect(colors.color).toBe("rgb(255, 255, 255)");
      await capture(page, info, `audio-category-theme-${theme}`, row);
      let editor = await openConnection(page, id);
      await expect(editor.getByRole("button", { name: "Test Connection", exact: true })).not.toBeVisible();
      await expect(editor.getByRole("button", { name: "Send Test Message", exact: true })).not.toBeVisible();
      await expect(editor.getByText(/To test this connection, generate music or a sound effect/u)).toBeVisible();
      await editor.getByRole("button", { name: /^SunoAPI Generate audio/u }).click();
      await editor.getByRole("button", { name: /^ElevenLabs/u }).click();
      await editor.getByRole("button", { name: "Save", exact: true }).click();
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
      await expect(editor.getByText(/Only enable capabilities your server supports\./u)).toBeVisible();
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
  const connection = wizard.locator("select").filter({ has: page.locator('option[value="audio-sfx"]') });
  await expect(connection.locator('option[value="speech-only"]')).toHaveCount(0);
  await expect(connection.locator('option[value="needs-review"]')).toHaveCount(0);
  const sfx = wizard.getByRole("button", { name: /^Sound effects Generate short scene sound effects/u });
  const music = wizard.getByRole("button", { name: /^Music Generate background music/u });
  await connection.selectOption("audio-sfx");
  await expect(sfx).toBeEnabled();
  await expect(music).toBeDisabled();
  await capture(page, info, "compatible-audio-wizard-sfx-only", connection);
  await connection.selectOption("audio-music");
  await expect(sfx).toBeDisabled();
  await expect(music).toBeEnabled();
  await connection.selectOption("audio-unconfigured");
  await expect(sfx).toBeDisabled();
  await expect(music).toBeDisabled();
  await connection.selectOption("audio-legacy");
  await expect(sfx).toBeEnabled();
  await expect(music).toBeEnabled();
});
