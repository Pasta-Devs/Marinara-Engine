import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";

/**
 * The new-game wizard and the start screen after it: Goals and preferences kept from the last game say so
 * and can be cleared, an empty lorebook list says there are none yet, and the start screen's Start Game
 * starts the game: the starting widgets sheet opens only when asked for, as the one Start Game on screen.
 */

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

const LAST_GOALS = "Break the Ashen Choir's hold on Varrow Hold";
const LAST_PREFERENCES = "slow-burn mystery";

/**
 * A fresh new-game setup wizard, on its own, opened after a game that kept its goals and preferences.
 * Its lorebook list answers once `lorebooksAnswered` settles: empty, or with an error when it rejects.
 */
async function mountWizard(page: Page, testInfo: TestInfo, lorebooksAnswered: Promise<void>): Promise<Locator> {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/connections", (route) =>
    route.fulfill({
      json: [
        { id: "wizard-connection", name: "Wizard connection", provider: "custom", model: "fixture", isDefault: true },
      ],
    }),
  );
  await page.route("**/api/lorebooks", async (route) => {
    await lorebooksAnswered.then(
      () => route.fulfill({ json: [] }),
      () => route.fulfill({ status: 500, json: { error: "Lorebooks are unavailable" } }),
    );
  });
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    rememberedGameSetupText: { playerGoals: LAST_GOALS, preferences: LAST_PREFERENCES },
    theme: testInfo.project.name === "desktop-chromium" ? "light" : "dark",
  });
  await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What shall we cook tonight?", exact: true })).toBeVisible({
    timeout: 40_000,
  });
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
        { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        React.createElement(GameSetupWizard, {
          activeChatId: "wizard-chat",
          isNewGame: true,
          chatMetadata: {},
          onSetupError: () => false,
          onCancel: () => {},
          isLoading: false,
          isDraftingMap: false,
          isLinkingSharedWorld: false,
          characters: [],
          onComplete: () => {},
        }),
      ),
    );
  });
  const wizard = page.locator('[data-component="GameSetupWizard"]');
  await expect(wizard).toBeVisible();
  await wizard
    .locator("select")
    .filter({ has: page.locator('option[value="wizard-connection"]') })
    .first()
    .selectOption("wizard-connection");
  return wizard;
}

/** Walks on with Next to the step whose heading is `title`. */
async function stepTo(wizard: Locator, title: string) {
  const heading = wizard.getByRole("heading", { level: 4 }).first();
  for (let guard = 0; guard < 8 && (await heading.innerText()) !== title; guard++) {
    const previous = await heading.innerText();
    await wizard.getByRole("button", { name: "Next", exact: true }).click();
    await expect(heading).not.toHaveText(previous);
  }
  await expect(heading).toHaveText(title);
}

test("goals and preferences kept from the last game say so and can be cleared", async ({ page }, testInfo) => {
  let answerLorebooks = () => {};
  const wizard = await mountWizard(page, testInfo, new Promise((resolve) => (answerLorebooks = resolve)));
  await stepTo(wizard, "Goals");
  const goals = wizard.getByPlaceholder("What do you want to achieve?");
  const preferences = wizard.locator("textarea").nth(1);
  await expect(goals).toHaveValue(LAST_GOALS);
  await expect(preferences).toHaveValue(LAST_PREFERENCES);
  const notes = wizard.getByText("From your last game.", { exact: true });
  await expect(notes).toHaveCount(2);
  if (testInfo.project.name === "desktop-chromium") {
    await wizard.screenshot({ path: testInfo.outputPath("remembered-goals.png") });
  }

  // Clear empties the field, and the note goes with the old text.
  await wizard.getByRole("button", { name: "Clear", exact: true }).first().click();
  await expect(goals).toHaveValue("");
  await expect(notes).toHaveCount(1);
  // Text the player writes is their own: no note.
  await preferences.fill(`${LAST_PREFERENCES}, no romance`);
  await expect(notes).toHaveCount(0);

  // While the list is still loading it claims nothing; with no lorebooks at all it says so, instead of
  // "All lorebooks already added".
  await stepTo(wizard, "Lorebooks");
  await expect(wizard.getByPlaceholder("Search lorebooks…")).toBeVisible();
  await expect(wizard.getByText("No lorebooks yet", { exact: true })).toHaveCount(0);
  answerLorebooks();
  await expect(wizard.getByText("No lorebooks yet", { exact: true })).toBeVisible();
  await expect(wizard.getByText("All lorebooks already added.", { exact: true })).toHaveCount(0);
});

test("a lorebook list that failed to load claims nothing", async ({ page }, testInfo) => {
  const unavailable = Promise.reject(new Error("unavailable"));
  unavailable.catch(() => {});
  const wizard = await mountWizard(page, testInfo, unavailable);
  await stepTo(wizard, "Lorebooks");
  await expect(wizard.getByPlaceholder("Search lorebooks…")).toBeVisible();
  await expect(wizard.getByText("No lorebooks yet", { exact: true })).toHaveCount(0);
  await expect(wizard.getByText("All lorebooks already added.", { exact: true })).toHaveCount(0);
});

test("Start Game starts the game, and the starting widgets sheet is optional", async ({ page, request }, testInfo) => {
  const chat = (await (
    await request.post("/api/chats", { data: { name: "Starting widgets", mode: "game", characterIds: [] } })
  ).json()) as { id: string };
  try {
    expect(
      (
        await request.patch(`/api/chats/${chat.id}/metadata`, {
          data: {
            gameId: chat.id,
            gameSessionStatus: "ready",
            gameIntroPresented: false,
            gameWorldOverview: "A new adventure.",
            enableAgents: false,
            gameImageAutoGenerationEnabled: false,
            gameBackgroundAutoGenerationEnabled: false,
          },
        })
      ).ok(),
    ).toBeTruthy();
    const widgets = [
      {
        id: "party-health",
        type: "gauge",
        label: "Party health",
        position: "hud_left",
        config: { startingValue: 20, value: 20, max: 100 },
      },
    ];
    expect((await request.put(`/api/game/${chat.id}/widgets`, { data: { widgets } })).ok()).toBeTruthy();

    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["game"],
      theme: testInfo.project.name === "desktop-chromium" ? "light" : "dark",
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chat.id, version },
    );
    const starts: string[] = [];
    await page.route("**/api/game/start", async (route) => {
      starts.push(route.request().postData() ?? "");
      await route.fulfill({ json: { alreadyStarted: true } });
    });
    await page.goto("/");
    const start = page.getByRole("button", { name: "Start Game", exact: true });
    const review = page.getByRole("button", { name: "Review starting widgets", exact: true });
    await expect(start).toHaveCount(1);
    await expect(review).toBeVisible();

    // Reviewing is asked for: the sheet is then the one Start Game on screen.
    await review.click();
    const sheet = page.getByRole("dialog", { name: "Review Starting Widgets" });
    await expect(sheet).toBeVisible();
    await expect(start).toHaveCount(1);
    await expect(sheet.getByRole("button", { name: "Start Game", exact: true })).toBeVisible();
    if (testInfo.project.name === "desktop-chromium") {
      await page.screenshot({ path: testInfo.outputPath("starting-widgets-sheet.png") });
    }
    await sheet.getByRole("button", { name: "Back", exact: true }).click();
    await expect(sheet).toHaveCount(0);
    await expect(review).toBeVisible();

    // Start Game itself starts the game, with no sheet in between.
    await start.click();
    await expect.poll(() => starts.length).toBe(1);
    expect(JSON.parse(starts[0]!)).toMatchObject({ chatId: chat.id });
    await expect(sheet).toHaveCount(0);
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});
