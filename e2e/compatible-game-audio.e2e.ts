import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";

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
  await anchor.scrollIntoViewIfNeeded();
  const path = info.outputPath(`${label}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await info.attach(label, { path, contentType: "image/png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const theme of ["dark", "light"] as const) {
  test(`compatible Game audio settings save and reopen (${theme})`, async ({ page, request }, info) => {
    const response = await request.post("/api/connections", {
      data: {
        name: `Compatible audio ${theme} ${info.project.name}`,
        provider: "audio",
        audioSource: "elevenlabs",
        baseUrl: "https://audio.example.test/v1",
        model: "fixture-audio-model",
      },
    });
    expect(response.ok()).toBeTruthy();
    const { id } = (await response.json()) as { id: string };
    const stored = async () => (await request.get(`/api/connections/${id}`)).json();
    try {
      await prepare(page, theme);
      let editor = await openConnection(page, id);
      await editor.getByRole("button", { name: /OpenAI-compatible/u }).click();
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
      await editor.getByText("Game sound effects", { exact: true }).click();
      await editor.getByText("Game music", { exact: true }).click();
      await expect(editor.getByRole("checkbox", { name: /^Game sound effects/u })).toBeChecked();
      await expect(editor.getByRole("checkbox", { name: /^Game music/u })).toBeChecked();
      const save = editor.getByRole("button", { name: "Save", exact: true });
      await save.click();
      await expect.poll(stored).toMatchObject({
        audioSource: "openai",
        audioGenerationFormat: "chat_completions",
        audioMusicEndpoint: "chat/completions",
        audioSoundEffectsEndpoint: "audio/generations",
        audioMusic: "true",
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
      await expect(editor.getByRole("checkbox", { name: /^Game sound effects/u })).toBeChecked();
      await expect(editor.getByRole("checkbox", { name: /^Game music/u })).toBeChecked();

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
        audioSource: "elevenlabs",
        audioMusicEndpoint: null,
        audioSoundEffectsEndpoint: null,
        audioGenerationFormat: "binary",
      });
      await expect(editor.getByRole("button", { name: "Dismiss save error", exact: true })).toBeHidden();
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
      provider: "audio",
      audioSource: "openai",
      audioSoundEffects: true,
      audioMusic: true,
      audioSoundEffectsEndpoint: "audio/generations",
    },
    {
      id: "audio-music",
      name: "Music only",
      provider: "audio",
      audioSource: "openai",
      audioSoundEffects: true,
      audioMusic: true,
      audioMusicEndpoint: "chat/completions",
    },
    {
      id: "audio-unconfigured",
      name: "Unconfigured capabilities",
      provider: "audio",
      audioSource: "openai",
      audioSoundEffects: true,
      audioMusic: true,
    },
    {
      id: "audio-legacy",
      name: "Legacy ElevenLabs",
      provider: "audio",
      audioSource: "elevenlabs",
      audioSoundEffects: true,
      audioMusic: true,
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
