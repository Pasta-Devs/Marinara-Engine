import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { WORLD_STARTER_KITS, parseWorldKit } from "@marinara-engine/shared";
import { seedUIState } from "./ui-state-fixture.js";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";

/**
 * Classic Game Mode or the Overworld RPG, on screen: a new game starts on the Overworld, whose World step
 * asks for a setting kit (the chosen genre's until the player picks one) and lays out a world for it;
 * Classic shows neither and starts a game with no kit, no world and tactical turns by side; and the
 * server refuses a Classic game sent with a world.
 */

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

declare global {
  interface Window {
    __styleSetup?: Record<string, unknown>;
  }
}

/** A fresh new-game setup wizard, on its own; what it starts is kept on `window.__styleSetup`. */
async function mountWizard(page: Page, testInfo: TestInfo): Promise<Locator> {
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
  await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
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
          onComplete: (config: Record<string, unknown>) => {
            window.__styleSetup = config;
          },
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

/** Clicks Next once and waits for the next step's heading. */
async function next(wizard: Locator) {
  const heading = wizard.getByRole("heading", { level: 4 }).first();
  const previous = await heading.innerText();
  await wizard.getByRole("button", { name: "Next", exact: true }).click();
  await expect(heading).not.toHaveText(previous);
}

/** Walks on with Next to the step whose heading is `title`. */
async function stepTo(wizard: Locator, title: string) {
  const heading = wizard.getByRole("heading", { level: 4 }).first();
  for (let guard = 0; guard < 8 && (await heading.innerText()) !== title; guard++) await next(wizard);
  await expect(heading).toHaveText(title);
}

/** Walks on to the last step and starts the game; the setup it started. */
async function start(page: Page, wizard: Locator): Promise<Record<string, any>> {
  const startButton = wizard.getByRole("button", { name: "Create world", exact: true });
  for (let guard = 0; guard < 8 && !(await startButton.isVisible()); guard++) await next(wizard);
  await startButton.click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__styleSetup))).toBe(true);
  return (await page.evaluate(() => window.__styleSetup)) as Record<string, any>;
}

test("a new game starts on the Overworld RPG, with a setting kit for its genre and a world", async ({
  page,
}, testInfo) => {
  const wizard = await mountWizard(page, testInfo);
  const styles = wizard.getByTestId("game-style-chooser");
  await expect(styles.getByRole("radio", { name: /Overworld RPG/ })).toHaveAttribute("aria-checked", "true");
  await expect(styles.getByRole("radio", { name: /Classic/ })).toHaveAttribute("aria-checked", "false");
  if (testInfo.project.name === "desktop-chromium") {
    await styles.screenshot({ path: testInfo.outputPath("game-mode-style.png") });
  }
  // A radio group: the chosen style is the one tab stop, and the arrow keys move the choice.
  await expect(styles.getByRole("radio", { name: /Overworld RPG/ })).toHaveAttribute("tabindex", "0");
  await expect(styles.getByRole("radio", { name: /Classic/ })).toHaveAttribute("tabindex", "-1");
  await styles.getByRole("radio", { name: /Overworld RPG/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(styles.getByRole("radio", { name: /Classic/ })).toHaveAttribute("aria-checked", "true");
  await expect(styles.getByRole("radio", { name: /Classic/ })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(styles.getByRole("radio", { name: /Overworld RPG/ })).toHaveAttribute("aria-checked", "true");

  await stepTo(wizard, "World");
  await expect(wizard.getByText("Setting kit", { exact: true })).toBeVisible();
  // The Overworld's world needs a kit: there is no kit-less card, and the genre's kit is taken.
  await expect(wizard.getByRole("button", { name: /No setting kit/ })).toHaveCount(0);
  await expect(wizard.getByRole("button", { name: /^High fantasy/u })).toHaveAttribute("aria-pressed", "true");
  await expect(wizard.getByText("Your world", { exact: true })).toBeVisible();
  await expect(wizard.getByRole("checkbox", { name: /Make a world/ })).toHaveCount(0);
  await expect(wizard.getByLabel("World seed", { exact: true })).toHaveValue(/^\d+$/);
  // Another genre, chosen before any kit, brings its own kit.
  await wizard.getByRole("button", { name: "Fantasy", exact: true }).click();
  await wizard.getByRole("button", { name: "Sci-Fi", exact: true }).click();
  await expect(wizard.getByRole("button", { name: /^Space opera/u })).toHaveAttribute("aria-pressed", "true");

  const setup = await start(page, wizard);
  expect(setup.gameStyle).toBe("overworld");
  expect(setup.worldKit?.id).toBe("space_opera");
  expect(typeof setup.world?.seed).toBe("number");
  expect(setup.tacticalTurnOrder).toBe("initiative");
});

test("a Classic game has no setting kit or world, and keeps tactical turns by side", async ({ page }, testInfo) => {
  const wizard = await mountWizard(page, testInfo);
  await wizard
    .getByTestId("game-style-chooser")
    .getByRole("radio", { name: /Classic/ })
    .click();
  await stepTo(wizard, "World");
  await expect(wizard.getByText("Setting kit", { exact: true })).toHaveCount(0);
  await expect(wizard.getByText("Your world", { exact: true })).toHaveCount(0);
  await expect(wizard.getByRole("checkbox", { name: /Make a world/ })).toHaveCount(0);

  const setup = await start(page, wizard);
  expect(setup.gameStyle).toBe("classic");
  expect(setup.worldKit).toBeUndefined();
  expect(setup.world).toBeUndefined();
  expect(setup.tacticalTurnOrder).toBeUndefined();
});

test("the server refuses a Classic game sent with a setting kit", async ({ request }) => {
  const read = parseWorldKit(WORLD_STARTER_KITS[0]!);
  if (!read.ok) throw new Error("The first starter kit does not read");
  const worldKit = read.kit;
  const created = await request.post("/api/game/create", {
    data: {
      name: "Classic with a kit",
      setupConfig: {
        genre: "Fantasy",
        setting: "A quiet valley",
        tone: "Heroic",
        difficulty: "Normal",
        gmMode: "standalone",
        partyCharacterIds: [],
        gameStyle: "classic",
        worldKit,
      },
    },
  });
  expect(created.status()).toBe(400);
  expect(((await created.json()) as { error?: string }).error).toContain("A Classic game has no setting kit or world");
});
