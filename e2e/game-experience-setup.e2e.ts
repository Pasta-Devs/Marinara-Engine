import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

// An Experience with an inline setup block: a seed, a generated config and a custom widget
// requirement the wizard has to apply for as long as the Experience is switched on.
const experienceFixture = {
  id: "setup-fixture",
  version: "1.0.0",
  status: "active",
  readiness: "ready",
  manifest: {
    schemaVersion: 2,
    id: "setup-fixture",
    name: "Setup fixture",
    version: "1.0.0",
    capabilityApi: { major: 1, minor: 18 },
    kind: ["agent"],
    entrypoints: { client: "client.mjs" },
    contributions: {
      slots: ["game-surface"],
      gameSurface: {
        setup: {
          seed: { key: "worldSeed" },
          config: { generate: true },
          requires: { enableCustomWidgets: false },
        },
      },
    },
    permissions: ["ui"],
  },
};

const wizardConnections = [
  { id: "wizard-connection", name: "Wizard connection", provider: "custom", model: "fixture", isDefault: true },
];

/** The package client entry every fixture package serves: one custom element per package id. */
const capabilityClientScript = (ids: string[]) => `for (const id of ${JSON.stringify(ids)}) {
        const tag = 'marinara-capability-' + id;
        if (!customElements.get(tag)) customElements.define(tag, class extends HTMLElement {
          connectedCallback() { this.textContent = 'Legacy package setup fixture'; }
        });
      }`;

type WizardMountOptions = {
  isNewGame: boolean;
  chatMetadata?: Record<string, unknown>;
  characters?: Array<{ id: string; name: string }>;
};

/** Mount the wizard on its own so a case can drive it without a surrounding chat. */
async function mountWizard(page: Page, testInfo: TestInfo, options: WizardMountOptions): Promise<Locator> {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
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
  await page.evaluate(
    async ({ isNewGame, chatMetadata, characters }) => {
      const { GameSetupWizard } = await import("/src/components/game/GameSetupWizard.tsx" as string);
      const dependencyUrl = window.__viteFixtureDependencyUrl;
      const { default: React } = await import(dependencyUrl("react"));
      const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
      const { QueryClient, QueryClientProvider } = await import(dependencyUrl("@tanstack_react-query"));
      const container = document.createElement("div");
      document.body.append(container);
      const result = document.createElement("output");
      result.dataset.testid = "wizard-result";
      container.append(result);
      ReactDOM.createRoot(container).render(
        React.createElement(
          QueryClientProvider,
          { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          React.createElement(GameSetupWizard, {
            activeChatId: "wizard-chat",
            isNewGame,
            chatMetadata,
            onSetupError: () => false,
            onCancel: () => {},
            isLoading: false,
            isDraftingMap: false,
            isLinkingSharedWorld: false,
            characters,
            onComplete: (
              config: unknown,
              _preferences: unknown,
              _connections: unknown,
              _name: unknown,
              mapPlan: unknown,
            ) => {
              const output =
                document.querySelector('[data-testid="wizard-result"]') ??
                document.body.appendChild(document.createElement("output"));
              output.setAttribute("data-testid", "wizard-result");
              output.textContent = JSON.stringify({ config, mapPlan });
            },
          }),
        ),
      );
    },
    {
      isNewGame: options.isNewGame,
      chatMetadata: options.chatMetadata ?? {},
      characters: options.characters ?? [],
    },
  );
  const wizard = page.locator('[data-component="GameSetupWizard"]');
  await expect(wizard).toBeVisible();
  return wizard;
}

/** Step buttons that wait for the step to actually change before the case moves on. */
function stepNavigation(wizard: Locator) {
  const navigate = async (direction: "Next" | "Back") => {
    const heading = wizard.getByRole("heading", { level: 4 }).first();
    const previous = await heading.innerText();
    await wizard.getByRole("button", { name: direction, exact: true }).click();
    await expect(heading).not.toHaveText(previous);
    await expect(heading).toBeVisible();
  };
  return { next: () => navigate("Next"), back: () => navigate("Back") };
}

test("Game Features switches keep equal thumb insets and do not shrink on mobile", async ({ page }, info) => {
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/agents", (route) =>
    route.fulfill({
      json: [
        {
          id: "world-state",
          name: "World State",
          description: "Fixture",
          phase: "post_processing",
          settings: {},
        },
      ],
    }),
  );
  await page.route("**/api/connections", (route) => route.fulfill({ json: wizardConnections }));
  await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
  const wizard = await mountWizard(page, info, { isNewGame: true });
  const { next } = stepNavigation(wizard);
  for (let step = 0; step < 5; step++) await next();
  const names = [
    /^Quick Time Events/u,
    /^Enable Agents/u,
    /^Custom HUD Widgets/u,
    /^Build Widget Setup/u,
    /^Sound effects/u,
    /^Music Generate/u,
  ];
  for (const name of names) {
    const button = wizard.getByRole("button", { name });
    await button.scrollIntoViewIfNeeded();
    const track = button.locator(":scope > .rounded-full");
    const assertInsets = async () => {
      await expect
        .poll(() =>
          track.evaluate((element) => {
            const outer = element.getBoundingClientRect();
            const inner = element.firstElementChild!.getBoundingClientRect();
            const scale = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
            const px = (value: number) => Math.round((value / scale) * 1000) / 1000;
            return {
              width: px(outer.width),
              height: px(outer.height),
              top: px(inner.top - outer.top),
              bottom: px(outer.bottom - inner.bottom),
              edge: px(Math.min(inner.left - outer.left, outer.right - inner.right)),
            };
          }),
        )
        .toEqual({ width: 36, height: 20, top: 2, bottom: 2, edge: 2 });
    };
    await assertInsets();
    if (await button.isEnabled()) {
      const before = await button.getAttribute("aria-pressed");
      await button.press("Space");
      await expect(button).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");
      await assertInsets();
      await button.press("Space");
    } else {
      await expect(button).toHaveAttribute("aria-pressed", "false");
    }
  }
  await wizard.getByRole("button", { name: /^Quick Time Events/u }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("game-feature-switches.png"), animations: "disabled" });
});

/** A fresh new-game wizard with only the inline-setup Experience installed and switched on. */
async function openWizardWithExperience(page: Page, testInfo: TestInfo): Promise<Locator> {
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [experienceFixture] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/*/client?*", (route) =>
    route.fulfill({ contentType: "text/javascript", body: capabilityClientScript(["setup-fixture"]) }),
  );
  await page.route("**/api/connections", (route) => route.fulfill({ json: wizardConnections }));
  await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
  const wizard = await mountWizard(page, testInfo, { isNewGame: true });
  await wizard.getByRole("button", { name: "Show", exact: true }).click();
  await wizard.getByRole("switch", { name: "Setup fixture", exact: true }).click();
  return wizard;
}

for (const isNewGame of [true, false]) {
  test(`Experience wizard preserves ordinary steps and import scope (${isNewGame ? "new" : "existing"} game)`, async ({
    page,
  }, testInfo) => {
    // Includes legacy setup, file import and two passes through all seven steps.
    if (isNewGame) test.setTimeout(120_000);
    const books = [
      { id: "free-book", name: "Unattached lore", enabled: true },
      { id: "excluded-book", name: "Excluded lore", enabled: true },
      { id: "disabled-book", name: "Disabled lore", enabled: false },
      { id: "keeper-book", name: "Keeper lore", enabled: true, sourceAgentId: "game-lorebook-keeper" },
    ];
    await page.route("**/api/capability-packages/installed", (route) =>
      route.fulfill({
        json: [
          experienceFixture,
          {
            ...experienceFixture,
            id: "legacy-fixture",
            manifest: {
              ...experienceFixture.manifest,
              id: "legacy-fixture",
              name: "Legacy fixture",
              contributions: { slots: ["game-surface"] },
            },
          },
        ],
      }),
    );
    await page.route("**/api/capability-packages/agents", (route) =>
      route.fulfill({
        json: [
          {
            id: "hierarchical-maps",
            name: "World Maps",
            description: "Fixture",
            phase: "post_generation",
            category: "tracker",
          },
        ],
      }),
    );
    await page.route("**/api/capability-packages/*/client?*", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: capabilityClientScript(["setup-fixture", "legacy-fixture"]),
      }),
    );
    await page.route("**/api/connections", (route) => route.fulfill({ json: wizardConnections }));
    await page.route("**/api/lorebooks", (route) => route.fulfill({ json: books }));
    await page.route("**/api/lorebooks/keeper-book/entries", (route) => route.fulfill({ json: [] }));
    let failEntryFetch = true;
    await page.route("**/api/lorebooks/free-book/entries", (route) =>
      failEntryFetch
        ? route.fulfill({ status: 503, json: { error: "Temporary entry loading failure" } })
        : route.fulfill({
            json: [
              {
                id: "keyword-entry",
                lorebookId: "free-book",
                name: "Keyword entry",
                enabled: true,
                constant: false,
                order: 0,
              },
              {
                id: "constant-entry",
                lorebookId: "free-book",
                name: "Constant entry",
                enabled: true,
                constant: true,
                order: 1,
              },
              { id: "disabled-entry", lorebookId: "free-book", name: "Disabled entry", enabled: false, order: 2 },
              {
                id: "chat-disabled-entry",
                lorebookId: "free-book",
                name: "Chat disabled entry",
                enabled: true,
                order: 3,
              },
            ],
          }),
    );
    const wizard = await mountWizard(page, testInfo, {
      isNewGame,
      chatMetadata: {
        excludedLorebookIds: ["excluded-book"],
        entryStateOverrides: { "chat-disabled-entry": { enabled: false } },
      },
      characters: [{ id: "party-fixture", name: "Companion fixture" }],
    });
    const { next, back } = stepNavigation(wizard);
    if (isNewGame) {
      await page.screenshot({ path: testInfo.outputPath("setup-before-experience.png") });
      await expect(wizard.getByRole("button", { name: "Import setup", exact: true })).toBeEnabled();
      await wizard
        .locator('input[type="file"]')
        .first()
        .setInputFiles({
          name: "legacy.marinara-game-setup.json",
          mimeType: "application/json",
          buffer: Buffer.from(
            JSON.stringify({
              format: "marinara-game-setup",
              version: 1,
              gameName: "Imported legacy adventure",
              setup: {
                config: {
                  genre: "Fantasy",
                  setting: "Legacy Harbor",
                  tone: "Hopeful",
                  difficulty: "Normal",
                  rating: "sfw",
                  gmMode: "standalone",
                  partyCharacterIds: [],
                  playerGoals: "Find the missing keeper",
                  gameExperienceId: "legacy-fixture",
                  experienceConfig: { stalePackageState: "discard me" },
                },
              },
            }),
          ),
        });
      const legacy = page.getByRole("dialog", { name: "Legacy fixture", exact: true });
      await expect(legacy).toBeVisible();
      await expect(legacy.getByText("Legacy package setup fixture", { exact: true })).toBeVisible();
      await expect(legacy).toHaveCSS("opacity", "1");
      await page.screenshot({ path: testInfo.outputPath("setup-imported-legacy-experience.png") });
      await expect(legacy.getByRole("button", { name: "Close setup", exact: true })).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(legacy.getByRole("button", { name: "Back", exact: true })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(legacy.getByRole("button", { name: "Close setup", exact: true })).toBeFocused();
      await legacy.getByRole("button", { name: "Back", exact: true }).click();
      await expect(wizard).toBeFocused();
      await expect(wizard.getByText(/The saved Experience is unavailable/u)).toHaveCount(0);
      await wizard.getByRole("button", { name: "Show", exact: true }).click();
      await wizard.getByRole("switch", { name: "Setup fixture", exact: true }).click();
      const seedInvalid = "Enter a whole number from 0 to 4294967295 before starting.";
      await wizard.getByRole("spinbutton", { name: "World seed" }).fill("");
      await expect(wizard.getByRole("alert")).toHaveText(seedInvalid);
      // The seed is an unsigned whole number, so a fraction is refused instead of being rounded silently.
      await wizard.getByRole("spinbutton", { name: "World seed" }).fill("1.5");
      await expect(wizard.getByRole("alert")).toHaveText(seedInvalid);
      await wizard.getByRole("button", { name: "Randomize", exact: true }).click();
      await expect(wizard.getByRole("alert")).toHaveCount(0);
      await expect(wizard.getByRole("spinbutton", { name: "World seed" })).not.toHaveValue("");
      await wizard.getByRole("spinbutton", { name: "World seed" }).fill("4242");
      await page.screenshot({ path: testInfo.outputPath("setup-inline-experience.png") });
    } else {
      await expect(wizard.getByText("Experiences", { exact: true })).toHaveCount(0);
    }
    // Import carries only the numeric seed and keeps all the built-in steps.
    await wizard
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: "fixture.marinara-game-setup.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            format: "marinara-game-setup",
            version: 1,
            gameName: "Imported adventure",
            gmConnectionId: "wizard-connection",
            setup: {
              config: {
                genre: "Fantasy",
                setting: "Copper Harbor",
                tone: "Hopeful",
                difficulty: "Normal",
                rating: "sfw",
                gmMode: "standalone",
                partyCharacterIds: ["party-fixture"],
                playerGoals: "Find the missing keeper",
                enableAgents: true,
                gameExperienceId: "setup-fixture",
                experienceConfig: { worldSeed: 7, stalePackageState: "discard me", generate: false },
                activeLorebookEntryIds: ["keyword-entry", "missing-entry"],
              },
            },
          }),
        ),
      });
    // The picked entries have not loaded yet, so none of them may be reported as missing.
    await expect(wizard.getByText(/available here and w/u)).toHaveCount(0);
    if (isNewGame) {
      await expect(wizard.getByRole("spinbutton", { name: "World seed" })).toHaveValue("7");
      await wizard.getByRole("switch", { name: "Setup fixture", exact: true }).click();
      await expect(wizard.getByRole("switch", { name: "Setup fixture", exact: true })).toBeVisible();
      await wizard.getByRole("switch", { name: "Setup fixture", exact: true }).click();
    } else
      await expect(
        wizard.getByText("The Experience and seed were skipped. They can only be selected for a new game."),
      ).toBeVisible();
    await next();
    await expect(wizard.getByRole("heading", { name: "World", exact: true })).toBeVisible();
    await next();
    await expect(wizard.getByRole("heading", { name: "Party", exact: true })).toBeVisible();
    await expect(wizard.getByText("Companion fixture", { exact: true }).first()).toBeVisible();
    await next();
    await expect(wizard.getByRole("heading", { name: "Goals", exact: true })).toBeVisible();
    await next();
    await wizard.getByRole("button", { name: "Select individual entries", exact: true }).click();
    await expect(wizard.locator("summary").filter({ hasText: "Keeper lore" })).toHaveCount(0);
    await expect(wizard.getByRole("alert")).toContainText("Could not load the entries.");
    await next();
    await next();
    await expect(wizard.getByRole("button", { name: /Start/u })).toBeDisabled();
    await back();
    await expect(wizard.getByRole("heading", { name: "Features", exact: true })).toBeVisible();
    await back();
    await expect(wizard.getByRole("heading", { name: "Lorebooks", exact: true })).toBeVisible();
    failEntryFetch = false;
    await wizard.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(wizard.getByRole("alert")).toHaveCount(0);
    await wizard.locator("summary").filter({ hasText: "Unattached lore" }).click();
    await expect(wizard.getByRole("checkbox")).toHaveCount(2);
    await expect(wizard.getByRole("checkbox").first()).toHaveAccessibleName("Constant entry");
    await expect(wizard.getByRole("checkbox", { name: "Keyword entry", exact: true })).toBeChecked();
    await page.screenshot({ path: testInfo.outputPath("setup-lore-entry-picker.png") });
    await next();
    await expect(wizard.getByRole("heading", { name: "Features", exact: true })).toBeVisible();
    const widgetToggle = wizard.getByRole("button", { name: /^Custom HUD Widgets/u });
    if (isNewGame) {
      // The declared requirement is applied and the control is locked while the Experience is on.
      await expect(wizard.getByText("Setup fixture turns custom HUD widgets off for this game.")).toBeVisible();
      await expect(widgetToggle).toBeDisabled();
      await expect(widgetToggle).toHaveAttribute("aria-pressed", "false");
      await widgetToggle.click({ force: true });
      await expect(widgetToggle).toHaveAttribute("aria-pressed", "false");
      await expect(wizard.getByText("Hierarchical world map", { exact: true })).toHaveCount(0);
    } else {
      await expect(wizard.getByText("Hierarchical world map", { exact: true })).toBeVisible();
    }
    await next();
    await expect(wizard.getByRole("heading", { name: "GM", exact: true })).toBeVisible();
    await wizard.getByRole("button", { name: /Start/u }).click();
    const result = JSON.parse((await page.getByTestId("wizard-result").textContent()) ?? "{}");
    expect(result.config.partyCharacterIds).toEqual(["party-fixture"]);
    expect(result.config.playerGoals).toBe("Find the missing keeper");
    expect(result.config.activeLorebookEntryIds).toEqual(["keyword-entry"]);
    expect(result.config.activeLorebookIds).toBeUndefined();
    expect(result.mapPlan).toBeUndefined();
    if (isNewGame) {
      expect(result.config.gameExperienceId).toBe("setup-fixture");
      expect(result.config.experienceConfig).toEqual({ worldSeed: 7, generate: true });
      // Starting cannot serialize an invalid seed.
      for (let step = 0; step < 6; step++) await back();
      // The entries have loaded by now, so the one imported pick that does not exist here is reported.
      await expect(
        wizard.getByText("1 selected lorebook entry from this file is not available here and was skipped."),
      ).toBeVisible();
      await wizard.getByRole("spinbutton", { name: "World seed" }).fill("");
      for (let step = 0; step < 6; step++) await next();
      await expect(wizard.getByRole("button", { name: /Start/u })).toBeDisabled();
    } else {
      expect(result.config).not.toHaveProperty("gameExperienceId");
      expect(result.config).not.toHaveProperty("experienceConfig");
    }
  });
}

test("Experience without inline setup keeps its own setup dialog", async ({ page }, testInfo) => {
  // The pre-seam compatibility path: a game-surface package that declares no setup block still owns
  // its whole setup form, so the wizard steps step aside for it and come back when the player goes back.
  const legacy = {
    id: "legacy-only-fixture",
    version: "1.0.0",
    status: "active",
    readiness: "ready",
    manifest: {
      schemaVersion: 2,
      id: "legacy-only-fixture",
      name: "Legacy only fixture",
      version: "1.0.0",
      capabilityApi: { major: 1, minor: 18 },
      kind: ["agent"],
      entrypoints: { client: "client.mjs" },
      contributions: { slots: ["game-surface"] },
      permissions: ["ui"],
    },
  };
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [legacy] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/*/client?*", (route) =>
    route.fulfill({ contentType: "text/javascript", body: capabilityClientScript(["legacy-only-fixture"]) }),
  );
  await page.route("**/api/connections", (route) => route.fulfill({ json: wizardConnections }));
  await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
  const wizard = await mountWizard(page, testInfo, { isNewGame: true });
  await expect(wizard.getByRole("button", { name: "Next", exact: true })).toBeVisible();
  await wizard.getByRole("button", { name: "Show", exact: true }).click();
  await wizard.getByRole("switch", { name: "Legacy only fixture", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Legacy only fixture", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Legacy package setup fixture", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close setup", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Back", exact: true })).toBeVisible();
  // The package owns the whole form here, so none of the wizard's own steps stay on screen behind it.
  await expect(wizard).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("setup-legacy-only-dialog.png") });
  await dialog.getByRole("button", { name: "Back", exact: true }).click();
  await expect(wizard).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await expect(wizard.getByRole("button", { name: "Next", exact: true })).toBeVisible();
  // The list comes back collapsed with the package turned off again, ready to be chosen a second time.
  await wizard.getByRole("button", { name: "Show", exact: true }).click();
  await expect(wizard.getByRole("switch", { name: "Legacy only fixture", exact: true })).toHaveAttribute(
    "aria-checked",
    "false",
  );
});

test("locked widget requirement is restored when the Experience is turned off", async ({ page }, testInfo) => {
  // Three walks between the first step and Features, so this case needs the larger scenario budget.
  test.setTimeout(120_000);
  const wizard = await openWizardWithExperience(page, testInfo);
  const { next, back } = stepNavigation(wizard);
  const widgetToggle = wizard.getByRole("button", { name: /^Custom HUD Widgets/u });
  // The declared requirement is applied and the control is locked while the Experience is on.
  for (let step = 0; step < 5; step++) await next();
  await expect(wizard.getByRole("heading", { name: "Features", exact: true })).toBeVisible();
  await expect(wizard.getByText("Setup fixture turns custom HUD widgets off for this game.")).toBeVisible();
  await expect(widgetToggle).toBeDisabled();
  await expect(widgetToggle).toHaveAttribute("aria-pressed", "false");
  // Turning the Experience off unlocks the control at the player's own earlier choice.
  for (let step = 0; step < 5; step++) await back();
  await wizard.getByRole("switch", { name: "Setup fixture", exact: true }).click();
  for (let step = 0; step < 5; step++) await next();
  await expect(wizard.getByRole("heading", { name: "Features", exact: true })).toBeVisible();
  await expect(widgetToggle).toBeEnabled();
  await expect(widgetToggle).toHaveAttribute("aria-pressed", "true");
  await expect(wizard.getByText(/turns custom HUD widgets/u)).toHaveCount(0);
});

test("an ordinary setup import keeps the prefilled seed", async ({ page }, testInfo) => {
  const wizard = await openWizardWithExperience(page, testInfo);
  const seedField = wizard.getByRole("spinbutton", { name: "World seed" });
  await seedField.fill("4242");
  // An ordinary setup file carries no Experience, so it must leave the prefilled seed alone.
  await wizard
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "ordinary.marinara-game-setup.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "marinara-game-setup",
          version: 1,
          gameName: "Imported ordinary adventure",
          setup: {
            config: {
              genre: "Fantasy",
              setting: "Copper Harbor",
              tone: "Hopeful",
              difficulty: "Normal",
              rating: "sfw",
              gmMode: "standalone",
              partyCharacterIds: [],
              playerGoals: "Find the missing keeper",
            },
          },
        }),
      ),
    });
  // The import handler is async, so wait for it to land before switching the Experience back on.
  await expect(wizard.getByRole("switch", { name: "Setup fixture", exact: true })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await wizard.getByRole("switch", { name: "Setup fixture", exact: true }).click();
  await expect(seedField).toHaveValue("4242");
  await expect(wizard.getByRole("alert")).toHaveCount(0);
});

test("Tactical setup keeps size and retires battlefield seed and terrain guidance", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/connections", (route) => route.fulfill({ json: wizardConnections }));
  await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
  const wizard = await mountWizard(page, testInfo, { isNewGame: true });
  await wizard
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "tactical.marinara-game-setup.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "marinara-game-setup",
          version: 1,
          gameName: "River crossing",
          gmConnectionId: "wizard-connection",
          setup: {
            config: {
              genre: "Fantasy",
              setting: "River crossing",
              tone: "Hopeful",
              difficulty: "normal",
              rating: "sfw",
              gmMode: "standalone",
              partyCharacterIds: [],
              playerGoals: "Reach the far shore",
              combatStyle: "tactical",
              tacticalBattlefield: { seed: 0, size: "large", instructions: "Ruins beside a forest clearing." },
            },
          },
        }),
      ),
    });
  await expect(wizard.getByPlaceholder("Name your adventure...", { exact: true })).toHaveValue("River crossing");
  const { next } = stepNavigation(wizard);
  await next();
  await expect(wizard.getByLabel("Battlefield seed", { exact: true })).toHaveCount(0);
  const size = wizard.getByLabel("Battlefield size", { exact: true });
  await expect(size).toHaveValue("large");
  await expect(wizard.getByLabel("Terrain guidance", { exact: true })).toHaveCount(0);
  await expect(wizard.getByText(/Fire Emblem|current style/)).toHaveCount(0);
  await wizard.getByRole("button", { name: /^Classic/ }).click();
  await expect(size).toHaveCount(0);
  await expect(wizard.getByText("Cinematic menu battles", { exact: true })).toBeVisible();
  await wizard.getByRole("button", { name: /^Tactical/ }).click();
  await expect(size).toHaveValue("large");
  await size.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("hybrid-terrain-setup.png") });
  for (let step = 0; step < 5; step++) await next();
  await expect(wizard.getByRole("button", { name: "Download setup", exact: true })).toBeEnabled();
  await wizard.getByRole("button", { name: /Start/u }).click();
  const result = JSON.parse((await page.getByTestId("wizard-result").textContent()) ?? "{}");
  expect(result.config.combatStyle).toBe("tactical");
  expect(result.config.difficulty).toBe("normal");
  expect(result.config.tacticalBattlefield).toEqual({
    size: "large",
  });
});
